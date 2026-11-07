import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  parseDependencyCell,
  parseLedger,
  validateEvidenceGate,
  validateManifest,
  validateStatusTrajectories,
} from '../../scripts/audit/p1r-evidence-gate.mjs';

function row(id, depends, status) {
  return `| \`${id}\` | task | trace | owner | ${depends} | NEW | evidence | \`${status}\` | \`不适用\` |`;
}

function withTempRepo(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p1r-evidence-gate-'));
  try {
    fs.mkdirSync(path.join(root, 'evidence', 'p1r', 'm0', 'P1R-M0-001'), { recursive: true });
    fs.writeFileSync(path.join(root, 'artifact.txt'), 'stable artifact\n');
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function acceptedManifest(root, overrides = {}) {
  const digest = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, 'artifact.txt'))).digest('hex');
  return {
    taskId: 'P1R-M0-001',
    canonicalTaskStatus: 'ACCEPTED',
    sourceCommit: 'a'.repeat(40),
    artifactDigests: [{ path: 'artifact.txt', algorithm: 'sha256', digest }],
    environment: 'test',
    startedAt: '2026-08-29T00:00:00.000Z',
    finishedAt: '2026-08-29T00:01:00.000Z',
    actors: ['executor'],
    sourceIds: ['P1R-M0-001'],
    commands: ['node test'],
    results: [{ check: 'unit', status: 'PASS' }],
    rollbackEvidence: [{ status: 'NOT_APPLICABLE', reason: 'read-only artifact' }],
    knownGaps: [],
    reviewer: 'independent-reviewer',
    decision: 'ACCEPTED',
    ...overrides,
  };
}

function gitCommandEnv() {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_PREFIX;
  return env;
}

function git(root, args, encoding = 'utf8') {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding,
    windowsHide: true,
    env: gitCommandEnv(),
  });
  assert.equal(result.status, 0, String(result.stderr || result.stdout));
  return result.stdout;
}

function initGit(root) {
  git(root, ['init']);
  git(root, ['config', 'user.email', 'p1r-test@example.invalid']);
  git(root, ['config', 'user.name', 'P1R Test']);
  git(root, ['config', 'core.autocrlf', 'false']);
  git(root, ['config', 'commit.gpgsign', 'false']);
}

function commitPaths(root, paths, message) {
  git(root, ['add', '--', ...paths]);
  git(root, ['commit', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']).trim();
}

function blobDigest(root, revision, relativePath) {
  const bytes = git(root, ['show', `${revision}:${relativePath}`], null);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function boundManifest(root, sourceCommit, digest, overrides = {}) {
  return acceptedManifest(root, {
    sourceCommit,
    artifactDigests: [{ path: 'artifact.txt', algorithm: 'sha256', digest }],
    ...overrides,
  });
}

function manifestErrors(root, manifest) {
  const task = { id: 'P1R-M0-001', status: manifest.canonicalTaskStatus };
  const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
  return validateManifest({ root, task, manifest, manifestPath, checkGit: true });
}

function historyWithMovedHead(root) {
  initGit(root);
  fs.writeFileSync(path.join(root, 'artifact.txt'), 'version A\n');
  const ancestor = commitPaths(root, ['artifact.txt'], 'record A');
  const digest = blobDigest(root, ancestor, 'artifact.txt');
  fs.writeFileSync(path.join(root, 'artifact.txt'), 'version B\n');
  const head = commitPaths(root, ['artifact.txt'], 'record B');
  return { ancestor, head, digest };
}

function runRebind(root, args) {
  const scriptDir = path.join(root, 'scripts', 'audit');
  fs.mkdirSync(scriptDir, { recursive: true });
  const scriptPath = path.join(scriptDir, 'rebind-manifests.mjs');
  fs.copyFileSync(
    fileURLToPath(new URL('../../scripts/audit/rebind-manifests.mjs', import.meta.url)),
    scriptPath,
  );
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    env: gitCommandEnv(),
  });
}

const milestoneCounts = { M0: 8, M1: 18, M2: 10, M3: 10, M4: 10, M5: 14, M6: 11, M7: 11, M8: 16 };

function writeSyntheticLedger(root, overrides = {}) {
  const planRoot = path.join(root, 'requirements', 'backlog', 'v2-phase1-rebaseline');
  fs.mkdirSync(planRoot, { recursive: true });
  const rows = [];
  for (const [milestone, count] of Object.entries(milestoneCounts)) {
    for (let index = 1; index <= count; index += 1) {
      const id = `P1R-${milestone}-${String(index).padStart(3, '0')}`;
      const override = overrides[id] ?? {};
      rows.push(row(id, override.depends ?? '无', override.status ?? 'PLANNED'));
    }
  }
  fs.writeFileSync(path.join(planRoot, '02-编号任务台账.md'), rows.join('\n'));
}

test('ledger parser extracts statuses and normalized dependencies', () => {
  const tasks = parseLedger([
    row('P1R-M0-001', '无', 'ACCEPTED'),
    row('P1R-M0-002', 'M0-001', 'READY'),
  ].join('\n'));
  assert.equal(tasks.length, 2);
  assert.deepEqual(tasks[1].dependencies, ['P1R-M0-001']);
  assert.equal(tasks[1].status, 'READY');
});

test('dependency ranges expand completely and reject malformed ranges', () => {
  assert.deepEqual(
    parseDependencyCell('M8-002…006,M8-008'),
    ['P1R-M8-002', 'P1R-M8-003', 'P1R-M8-004', 'P1R-M8-005', 'P1R-M8-006', 'P1R-M8-008'],
  );
  assert.throws(() => parseDependencyCell('M8-006…002'), /descending/);
  assert.throws(() => parseDependencyCell('M7-010…M8-002'), /crosses milestones/);
});

test('status trajectories reject skipped transitions and ledger mismatch', () => {
  withTempRepo((root) => {
    const executionRoot = path.join(root, 'requirements', 'backlog', 'v2-phase1-rebaseline', 'execution');
    fs.mkdirSync(executionRoot, { recursive: true });
    fs.writeFileSync(path.join(executionRoot, 'status-trajectories.json'), JSON.stringify({
      schemaVersion: 'p1r.status-trajectories.v1',
      records: [{
        taskId: 'P1R-M0-001',
        path: ['PLANNED', 'ACCEPTED'],
        recordedAt: '2026-08-29T00:00:00.000Z',
        actor: 'coordinator',
        reason: 'test invalid skip',
        evidencePath: 'evidence/p1r/m0/P1R-M0-001/manifest.json',
      }],
    }));
    const errors = validateStatusTrajectories({
      root,
      tasks: [{ id: 'P1R-M0-001', milestone: 'M0', status: 'REVIEW' }],
      checkGit: false,
    });
    assert(errors.some((error) => error.includes('illegal transition PLANNED -> ACCEPTED')));
    assert(errors.some((error) => error.includes('does not match ledger REVIEW')));
  });
});

test('accepted manifest validates artifact digest and independent reviewer', () => {
  withTempRepo((root) => {
    const task = { id: 'P1R-M0-001', status: 'ACCEPTED' };
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
    const errors = validateManifest({ root, task, manifest: acceptedManifest(root), manifestPath, checkGit: false });
    assert.deepEqual(errors, []);
  });
});

test('git-backed digest is portable across checkout line endings and detects committed drift', () => {
  withTempRepo((root) => {
    git(root, ['init']);
    git(root, ['config', 'user.email', 'p1r-test@example.invalid']);
    git(root, ['config', 'user.name', 'P1R Test']);
    git(root, ['config', 'core.autocrlf', 'false']);
    git(root, ['add', 'artifact.txt']);
    git(root, ['commit', '-m', 'fixture']);
    const sourceCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const sourceBytes = git(root, ['show', `${sourceCommit}:artifact.txt`], null);
    const digest = crypto.createHash('sha256').update(sourceBytes).digest('hex');
    git(root, ['config', 'core.autocrlf', 'true']);
    fs.writeFileSync(path.join(root, 'artifact.txt'), 'stable artifact\r\n');

    const task = { id: 'P1R-M0-001', status: 'ACCEPTED' };
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
    const manifest = acceptedManifest(root, {
      sourceCommit,
      artifactDigests: [{ path: 'artifact.txt', algorithm: 'sha256', digest }],
    });
    assert.deepEqual(validateManifest({ root, task, manifest, manifestPath, checkGit: true }), []);

    fs.writeFileSync(path.join(root, 'artifact.txt'), 'changed content\n');
    const errors = validateManifest({ root, task, manifest, manifestPath, checkGit: true });
    assert(errors.some((error) => error.includes('unstaged changes')));
  });
});

test('accepted manifest fails closed on digest mismatch and self review', () => {
  withTempRepo((root) => {
    const task = { id: 'P1R-M0-001', status: 'ACCEPTED' };
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
    const manifest = acceptedManifest(root, {
      artifactDigests: [{ path: 'artifact.txt', algorithm: 'sha256', digest: '0'.repeat(64) }],
      reviewer: 'executor',
    });
    const errors = validateManifest({ root, task, manifest, manifestPath, checkGit: false });
    assert(errors.some((error) => error.includes('digest does not match')));
    assert(errors.some((error) => error.includes('reviewer must be independent')));
  });
});

test('accepted reviewer identity rejects surrounding-whitespace bypass', () => {
  withTempRepo((root) => {
    const task = { id: 'P1R-M0-001', status: 'ACCEPTED' };
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
    const errors = validateManifest({
      root,
      task,
      manifest: acceptedManifest(root, { reviewer: ' executor ' }),
      manifestPath,
      checkGit: false,
    });
    assert(errors.some((error) => error.includes('surrounding whitespace')));
    assert(errors.some((error) => error.includes('terminal reviewer must be independent')));
  });
});

test('blocked manifest requires blockers and next steps', () => {
  withTempRepo((root) => {
    const task = { id: 'P1R-M0-001', status: 'BLOCKED' };
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
    const manifest = acceptedManifest(root, {
      canonicalTaskStatus: 'BLOCKED',
      decision: 'BLOCKED',
      reviewer: 'coordinator',
      blockers: [],
      nextSteps: [],
    });
    const errors = validateManifest({ root, task, manifest, manifestPath, checkGit: false });
    assert(errors.some((error) => error.includes('blockers are required')));
    assert(errors.some((error) => error.includes('nextSteps are required')));
  });
});

test('blocked and rework decisions reject self review', () => {
  withTempRepo((root) => {
    for (const status of ['BLOCKED', 'REWORK']) {
      const task = { id: 'P1R-M0-001', status };
      const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
      const manifest = acceptedManifest(root, {
        canonicalTaskStatus: status,
        decision: status,
        reviewer: 'executor',
        blockers: ['blocked for test'],
        nextSteps: ['assign independent reviewer'],
      });
      const errors = validateManifest({ root, task, manifest, manifestPath, checkGit: false });
      assert(errors.some((error) => error.includes('terminal reviewer must be independent')));
    }
  });
});

test('artifact path traversal is rejected', () => {
  withTempRepo((root) => {
    const task = { id: 'P1R-M0-001', status: 'ACCEPTED' };
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', task.id, 'manifest.json');
    const manifest = acceptedManifest(root, {
      artifactDigests: [{ path: '../outside.txt', algorithm: 'sha256', digest: '0'.repeat(64) }],
    });
    const errors = validateManifest({ root, task, manifest, manifestPath, checkGit: false });
    assert(errors.some((error) => error.includes('escapes the repository')));
  });
});

test('full gate rejects a task whose dependency is neither finished nor accepted', () => {
  withTempRepo((root) => {
    // The dependency is PLANNED, so it is neither accepted nor finished and the task may not proceed.
    writeSyntheticLedger(root, {
      'P1R-M0-002': { depends: 'M0-001', status: 'READY' },
    });
    const report = validateEvidenceGate({ root, milestone: 'M0', runPlanCheck: false, checkGit: false });
    assert.equal(report.result, 'FAIL');
    assert(report.errors.some((error) => error.includes('requires finished dependencies')));
  });
});

test('a finished dependency satisfies the task that depends on it', () => {
  withTempRepo((root) => {
    // DEV_DONE means built, tested and evidenced. Waiting for a review of every link is what the owner's direction
    // removes, so this must not be reported as an unmet dependency; whether the task then fails for some other reason
    // is not this case's business.
    writeSyntheticLedger(root, {
      'P1R-M0-002': { depends: 'M0-001', status: 'READY' },
      'P1R-M0-001': { status: 'DEV_DONE' },
    });
    const report = validateEvidenceGate({ root, milestone: 'M0', runPlanCheck: false, checkGit: false });
    assert(!report.errors.some((error) => error.includes('requires finished dependencies')),
      report.errors.join('; '));
  });
});

test('full gate rejects REVIEW without canonical evidence manifest', () => {
  withTempRepo((root) => {
    writeSyntheticLedger(root, {
      'P1R-M0-001': { status: 'REVIEW' },
    });
    const report = validateEvidenceGate({ root, milestone: 'M0', runPlanCheck: false, checkGit: false });
    assert.equal(report.result, 'FAIL');
    assert(report.errors.some((error) => error.includes('REVIEW requires')));
  });
});

test('full gate rejects uncommitted ledger and canonical manifest', () => {
  withTempRepo((root) => {
    git(root, ['init']);
    git(root, ['config', 'user.email', 'p1r-test@example.invalid']);
    git(root, ['config', 'user.name', 'P1R Test']);
    git(root, ['config', 'core.autocrlf', 'false']);
    git(root, ['add', 'artifact.txt']);
    git(root, ['commit', '-m', 'artifact only']);
    const sourceCommit = git(root, ['rev-parse', 'HEAD']).trim();
    const sourceBytes = git(root, ['show', `${sourceCommit}:artifact.txt`], null);
    const digest = crypto.createHash('sha256').update(sourceBytes).digest('hex');

    writeSyntheticLedger(root, { 'P1R-M0-001': { status: 'REVIEW' } });
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', 'P1R-M0-001', 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(acceptedManifest(root, {
      canonicalTaskStatus: 'REVIEW',
      sourceCommit,
      artifactDigests: [{ path: 'artifact.txt', algorithm: 'sha256', digest }],
      decision: 'PENDING',
    })));

    const report = validateEvidenceGate({ root, milestone: 'M0', runPlanCheck: false, checkGit: true });
    assert.equal(report.result, 'FAIL');
    assert(report.errors.some((error) => error.includes('canonical ledger must be tracked')));
    assert(report.errors.some((error) => error.includes('canonical manifest must be tracked')));
  });
});

test('historical ancestor digest matches the source blob while HEAD bytes differ', () => {
  withTempRepo((root) => {
    const { ancestor, head, digest } = historyWithMovedHead(root);
    assert.notEqual(ancestor, head);
    const errors = manifestErrors(root, boundManifest(root, ancestor, digest));
    assert.equal(errors.some((error) => error.includes('stale at HEAD')), false);
    assert.equal(errors.some((error) => error.includes('does not match sourceCommit')), false);
    assert.deepEqual(errors, []);
  });
});

test('digest mismatch against sourceCommit fails and does not rewrite the manifest', () => {
  withTempRepo((root) => {
    const { ancestor } = historyWithMovedHead(root);
    const manifest = boundManifest(root, ancestor, '0'.repeat(64));
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', 'P1R-M0-001', 'manifest.json');
    const body = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(manifestPath, body);
    const errors = manifestErrors(root, manifest);
    assert(errors.some((error) => error.includes('does not match sourceCommit')));
    assert.deepEqual(fs.readFileSync(manifestPath), body);
  });
});

test('sourceCommit equal to HEAD with a parent digest is stale at HEAD', () => {
  withTempRepo((root) => {
    const { head, digest } = historyWithMovedHead(root);
    const errors = manifestErrors(root, boundManifest(root, head, digest));
    assert(errors.some((error) => error.includes('stale at HEAD')));
  });
});

test('audited implementation source equal to HEAD is stale at HEAD', () => {
  withTempRepo((root) => {
    const { ancestor, head, digest } = historyWithMovedHead(root);
    const errors = manifestErrors(root, boundManifest(root, ancestor, digest, {
      provenance: { currentSourceRevalidationAuditedImplementationSource: head },
    }));
    assert(errors.some((error) => error.includes('stale at HEAD')));
  });
});

test('integration checkpoint equal to HEAD is stale at HEAD', () => {
  withTempRepo((root) => {
    const { ancestor, head, digest } = historyWithMovedHead(root);
    const errors = manifestErrors(root, boundManifest(root, ancestor, digest, {
      provenance: { currentSourceRevalidationIntegrationCheckpoint: head },
    }));
    assert(errors.some((error) => error.includes('stale at HEAD')));
  });
});

test('environment.currentSourceCommit equal to HEAD is stale at HEAD', () => {
  withTempRepo((root) => {
    const { ancestor, head, digest } = historyWithMovedHead(root);
    const errors = manifestErrors(root, boundManifest(root, ancestor, digest, {
      environment: { currentSourceCommit: head },
    }));
    assert(errors.some((error) => error.includes('stale at HEAD')));
  });
});

test('environment string test is not a HEAD claim', () => {
  withTempRepo((root) => {
    const { ancestor, digest } = historyWithMovedHead(root);
    const errors = manifestErrors(root, boundManifest(root, ancestor, digest, { environment: 'test' }));
    assert.equal(errors.some((error) => error.includes('stale at HEAD')), false);
    assert.deepEqual(errors, []);
  });
});

test('historical current-source SHAs equal to the ancestor do not require HEAD bytes', () => {
  withTempRepo((root) => {
    const { ancestor, head, digest } = historyWithMovedHead(root);
    assert.notEqual(ancestor, head);
    const errors = manifestErrors(root, boundManifest(root, ancestor, digest, {
      environment: { currentSourceCommit: ancestor },
      provenance: {
        currentSourceRevalidationAuditedImplementationSource: ancestor,
        currentSourceRevalidationIntegrationCheckpoint: ancestor,
      },
    }));
    assert.equal(errors.some((error) => error.includes('stale at HEAD')), false);
    assert.deepEqual(errors, []);
  });
});

test('history rows are not live HEAD claims', () => {
  withTempRepo((root) => {
    const { ancestor, head, digest } = historyWithMovedHead(root);
    const errors = manifestErrors(root, boundManifest(root, ancestor, digest, {
      provenance: {
        currentSourceRevalidationAuditedImplementationSource: ancestor,
        currentSourceRevalidationIntegrationCheckpoint: ancestor,
        currentSourceRevalidationHistory: [{ sourceCommit: head, auditedImplementationSource: head }],
      },
    }));
    assert.equal(errors.some((error) => error.includes('stale at HEAD')), false);
    assert.deepEqual(errors, []);
  });
});

test('path absent from sourceCommit fails', () => {
  withTempRepo((root) => {
    initGit(root);
    fs.writeFileSync(path.join(root, 'other.txt'), 'other\n');
    const ancestor = commitPaths(root, ['other.txt'], 'without artifact');
    const head = commitPaths(root, ['artifact.txt'], 'add artifact');
    assert.notEqual(ancestor, head);
    const digest = blobDigest(root, head, 'artifact.txt');
    const errors = manifestErrors(root, boundManifest(root, ancestor, digest));
    assert(errors.some((error) => error.includes('absent from sourceCommit')));
  });
});

test('path absent from HEAD fails when the path is deleted at HEAD', () => {
  withTempRepo((root) => {
    initGit(root);
    fs.writeFileSync(path.join(root, 'artifact.txt'), 'version A\n');
    const ancestor = commitPaths(root, ['artifact.txt'], 'record A');
    const digest = blobDigest(root, ancestor, 'artifact.txt');
    const manifest = boundManifest(root, ancestor, digest);
    git(root, ['rm', 'artifact.txt']);
    git(root, ['commit', '-m', 'delete artifact']);
    const errors = manifestErrors(root, manifest);
    assert(errors.some((error) => error.includes('absent from HEAD')));
  });
});

test('sourceCommit that is not an ancestor of HEAD fails', () => {
  withTempRepo((root) => {
    initGit(root);
    fs.writeFileSync(path.join(root, 'artifact.txt'), 'main line\n');
    const main = commitPaths(root, ['artifact.txt'], 'main');
    git(root, ['checkout', '-b', 'side']);
    fs.writeFileSync(path.join(root, 'artifact.txt'), 'side line\n');
    const side = commitPaths(root, ['artifact.txt'], 'side');
    git(root, ['checkout', '-']);
    assert.equal(git(root, ['rev-parse', 'HEAD']).trim(), main);
    const digest = blobDigest(root, side, 'artifact.txt');
    const errors = manifestErrors(root, boundManifest(root, side, digest));
    assert(errors.some((error) => error.includes('not an ancestor of HEAD')));
  });
});

test('unstaged and staged changes still fail for a historical digest', () => {
  withTempRepo((root) => {
    const { ancestor, digest } = historyWithMovedHead(root);
    const manifest = boundManifest(root, ancestor, digest);
    fs.writeFileSync(path.join(root, 'artifact.txt'), 'dirty worktree\n');
    const unstaged = manifestErrors(root, manifest);
    assert(unstaged.some((error) => error.includes('unstaged changes')));
    assert.equal(unstaged.some((error) => error.includes('does not match sourceCommit')), false);
    git(root, ['add', '--', 'artifact.txt']);
    const staged = manifestErrors(root, manifest);
    assert(staged.some((error) => error.includes('staged changes')));
    assert.equal(staged.some((error) => error.includes('does not match sourceCommit')), false);
  });
});

test('ACCEPTED self-review still fails the independent reviewer check on a git manifest', () => {
  withTempRepo((root) => {
    initGit(root);
    fs.writeFileSync(path.join(root, 'artifact.txt'), 'version A\n');
    const head = commitPaths(root, ['artifact.txt'], 'record A');
    const digest = blobDigest(root, head, 'artifact.txt');
    const errors = manifestErrors(root, boundManifest(root, head, digest, { reviewer: 'executor' }));
    assert(errors.some((error) => error.includes('terminal reviewer must be independent')));
  });
});

test('rebind skips and does not write a manifest whose source blob already matches', () => {
  withTempRepo((root) => {
    const { ancestor, digest } = historyWithMovedHead(root);
    const manifestPath = path.join(root, 'evidence', 'p1r', 'm0', 'P1R-M0-001', 'manifest.json');
    const manifest = {
      taskId: 'P1R-M0-001',
      sourceCommit: ancestor,
      artifactDigests: [{ path: 'artifact.txt', algorithm: 'sha256', digest }],
    };
    const body = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(manifestPath, body);
    fs.writeFileSync(path.join(root, 'artifact.txt'), 'worktree differs\n');

    const dry = runRebind(root, []);
    assert.equal(dry.status, 0, `${dry.stdout}\n${dry.stderr}`);
    assert.equal(dry.stdout.includes('P1R-M0-001'), false, dry.stdout);
    assert.match(dry.stdout, /would rebind 0 manifest/);

    const wrote = runRebind(root, ['--write']);
    assert.equal(wrote.status, 0, `${wrote.stdout}\n${wrote.stderr}`);
    assert.equal(wrote.stdout.includes('P1R-M0-001'), false, wrote.stdout);
    assert.match(wrote.stdout, /rebound 0 manifest/);
    assert.deepEqual(fs.readFileSync(manifestPath), body);
  });
});

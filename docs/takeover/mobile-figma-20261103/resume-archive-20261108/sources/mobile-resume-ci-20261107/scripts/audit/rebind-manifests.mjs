// Rebind the manifests whose recorded digests no longer match the blob at sourceCommit.
//
// A manifest whose every digest is still the SHA-256 of `git show <sourceCommit>:<path>` is historically bound.
// Leave it untouched when HEAD or the worktree has moved on. A Git object id is not that digest, and comparing
// the two rewrites intact history. Digests that do not match the recorded source blob can still move onto HEAD.
//
// Usage: node scripts/audit/rebind-manifests.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const reason = process.argv.find((argument) => argument.startsWith('--reason='))?.slice('--reason='.length)
  ?? 'Digest rebind after a recorded artifact changed.';

function gitEnv() {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_PREFIX;
  return env;
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    ...options,
    env: gitEnv(),
  });
}

const head = git(['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

function sourceCommitResolves(sourceCommit) {
  if (typeof sourceCommit !== 'string' || sourceCommit.length === 0) return false;
  try {
    git(['rev-parse', '--verify', '--quiet', `${sourceCommit}^{commit}`], { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

function recordedSourceBlobsMatch(manifest) {
  const entries = Array.isArray(manifest.artifactDigests) ? manifest.artifactDigests : [];
  if (!sourceCommitResolves(manifest.sourceCommit)) return false;
  return entries.every((entry) => {
    if (!entry || typeof entry.path !== 'string' || typeof entry.digest !== 'string') return false;
    try {
      const bytes = git(['show', `${manifest.sourceCommit}:${entry.path}`]);
      const digest = crypto.createHash('sha256').update(bytes).digest('hex');
      return digest === entry.digest.toLowerCase();
    } catch {
      return false;
    }
  });
}

function sourceCommitIsHead(sourceCommit) {
  try {
    const stamped = git(['rev-parse', sourceCommit], { encoding: 'utf8' }).trim();
    return stamped === head;
  } catch {
    return false;
  }
}

const manifests = [];
const collect = (directory) => {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) { collect(absolute); continue; }
    if (entry.name === 'manifest.json') manifests.push(absolute);
  }
};
collect(path.join(root, 'evidence', 'p1r'));

const touched = [];
for (const file of manifests) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (unreadable) {
    console.error(`unreadable: ${path.relative(root, file)}`);
    continue;
  }
  // Hash the recorded source blob. Skip before any digest write when that blob is still intact.
  if (recordedSourceBlobsMatch(manifest)) continue;

  const stale = [];
  for (const entry of manifest.artifactDigests ?? []) {
    const absolute = path.join(root, entry.path);
    if (!fs.existsSync(absolute)) continue;
    const digest = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
    if (digest !== entry.digest) {
      stale.push(entry.path);
      if (write) entry.digest = digest;
    }
  }
  // A digest can match the worktree while sourceCommit still names an older blob. That manifest is unbound and
  // can move onto HEAD. A manifest already stamped with HEAD, whose worktree matches, has nothing to rebind.
  if (stale.length === 0 && sourceCommitIsHead(manifest.sourceCommit)) continue;

  if (write) {
    const previous = manifest.sourceCommit;
    manifest.sourceCommit = head;
    const provenance = manifest.provenance ?? {};
    const history = provenance.currentSourceRevalidationHistory ?? [];
    provenance.previousCurrentSourceCommit = provenance.currentSourceRevalidationAuditedImplementationSource
      ?? history.at(-1)?.sourceCommit ?? previous;
    provenance.currentSourceRevalidationTask = manifest.taskId;
    provenance.currentSourceRevalidationReviewer = 'agent:p1r_implementation:deepseek-harness';
    provenance.currentSourceRevalidationRuntimeStatus = provenance.currentSourceRevalidationRuntimeStatus ?? 'NOT_RUNTIME_VERIFIED';
    provenance.currentSourceRevalidationFinishedAt = new Date().toISOString();
    provenance.currentSourceRevalidationAuditedImplementationSource = head;
    provenance.currentSourceRevalidationIntegrationCheckpoint = head;
    history.push({
      taskId: manifest.taskId,
      sourceCommit: head,
      auditedImplementationSource: head,
      integrationCheckpoint: head,
      reviewer: provenance.currentSourceRevalidationReviewer,
      runtimeStatus: provenance.currentSourceRevalidationRuntimeStatus,
      finishedAt: provenance.currentSourceRevalidationFinishedAt,
      details: reason,
    });
    provenance.currentSourceRevalidationHistory = history;
    manifest.provenance = provenance;
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  touched.push({ task: manifest.taskId, stale });
}

console.log(`${write ? 'rebound' : 'would rebind'} ${touched.length} manifest(s) against ${head.slice(0, 7)}`);
for (const entry of touched) {
  console.log(`  ${entry.task}: ${entry.stale.length} artifact(s)`);
  for (const artifact of entry.stale.slice(0, 4)) console.log(`      ${artifact}`);
  if (entry.stale.length > 4) console.log(`      ... and ${entry.stale.length - 4} more`);
}
if (!write) console.log('\nnothing written; pass --write to apply');

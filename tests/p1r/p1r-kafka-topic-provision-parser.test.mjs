import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(root, 'scripts/runtime/provision-kafka-topics.mjs');
const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'kafka-topic-parser-'));
const sentinelContainer = 'ci-parser-no-broker';

fs.writeFileSync(path.join(bin, 'fake-docker.mjs'), [
  "import fs from 'node:fs';",
  'const log = process.env.FAKE_DOCKER_CALLS;',
  "if (log) fs.appendFileSync(log, JSON.stringify(process.argv.slice(2)) + '\\n');",
  "process.stderr.write('fake-docker: broker unavailable\\n');",
  'process.exit(1);',
  '',
].join('\n'));
const fakeDocker = path.join(bin, 'fake-docker.mjs');
fs.writeFileSync(path.join(bin, 'docker'), `#!/bin/sh
exec ${JSON.stringify(process.execPath)} ${JSON.stringify(fakeDocker)} "$@"
`);
fs.writeFileSync(path.join(bin, 'docker.cmd'), [
  '@echo off',
  'node "%~dp0fake-docker.mjs" %*',
  '',
].join('\n'));
fs.chmodSync(path.join(bin, 'docker'), 0o755);
fs.chmodSync(path.join(bin, 'fake-docker.mjs'), 0o755);

test.after(() => {
  fs.rmSync(bin, { recursive: true, force: true });
});

function run(args) {
  const log = path.join(bin, `calls-${process.pid}-${Math.random().toString(16).slice(2)}.log`);
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000,
    killSignal: 'SIGKILL',
    windowsHide: true,
    env: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
      FAKE_DOCKER_CALLS: log,
      KAFKA_CONTAINER: sentinelContainer,
      DOCKER_HOST: `unix://${path.join(bin, 'no-docker.sock')}`,
    },
  });
  const calls = fs.existsSync(log)
    ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
    : [];
  const stdout = result.stdout ?? '';
  const json = stdout.trim().startsWith('{') ? JSON.parse(stdout) : null;
  return { status: result.status, stdout, stderr: result.stderr ?? '', calls, json, error: result.error ?? null };
}

function assertFakeBroker(calls) {
  assert.ok(calls.length > 0);
  for (const call of calls) {
    assert.equal(call[0], 'exec');
    assert.equal(call[1], sentinelContainer);
    assert.equal(call.includes('yuxuexing-local-kafka-1'), false);
  }
}

test('a leading pnpm separator stays plan-only and matches the direct plan cli', () => {
  const direct = run([]);
  const separated = run(['--']);
  assert.equal(direct.error, null);
  assert.equal(direct.status, 0, direct.stderr);
  assert.equal(separated.status, 0, separated.stderr);
  assert.equal(direct.json.mode, 'plan');
  assert.equal(direct.json.result, 'PLAN');
  assert.equal(direct.json.container, sentinelContainer);
  assert.ok(direct.json.created > 0);
  assert.deepEqual(separated.json, direct.json);
  assert.equal(separated.calls.length, direct.calls.length);
  assertFakeBroker(direct.calls);
  assert.ok(direct.calls.every((call) => call.join(' ').includes('--describe')));
  assert.ok(direct.calls.every((call) => !call.join(' ').includes('--create')));
  assert.doesNotMatch(direct.stderr, /unsupported argument/);
  assert.doesNotMatch(separated.stderr, /unsupported argument/);
});

test('pnpm separator still applies and matches the direct apply cli', () => {
  const direct = run(['--apply']);
  const separated = run(['--', '--apply']);
  assert.equal(direct.status, 1, direct.stderr);
  assert.equal(separated.status, 1, separated.stderr);
  assert.equal(direct.json.mode, 'apply');
  assert.equal(direct.json.result, 'FAIL');
  assert.equal(separated.json.mode, 'apply');
  assert.ok(direct.json.checks.errors.length > 0);
  assert.match(direct.json.checks.errors[0], /create failed/);
  assert.deepEqual(separated.json, direct.json);
  assert.equal(separated.calls.length, direct.calls.length);
  assert.ok(direct.calls.length > direct.json.declaredTopics);
  assertFakeBroker(direct.calls);
  assert.ok(direct.calls.some((call) => call.join(' ').includes('--create')));
  assert.doesNotMatch(direct.stderr, /unsupported argument/);
  assert.doesNotMatch(separated.stderr, /unsupported argument\(s\): --/);
});

test('unknown flags are denied before any broker command', () => {
  const cases = [
    ['--bogus'],
    ['--', '--bogus'],
    ['--', '--', '--apply'],
    ['--apply', '--extra'],
    ['--', '--apply', '--extra'],
    ['--apply', '--'],
  ];
  for (const args of cases) {
    const result = run(args);
    assert.equal(result.status, 2, `${args.join(' ')} -> ${result.stderr}`);
    assert.match(result.stderr, /unsupported argument\(s\):/);
    assert.equal(result.calls.length, 0, args.join(' '));
    assert.equal(result.json, null, args.join(' '));
  }
});

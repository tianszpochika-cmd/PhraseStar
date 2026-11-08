import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  isDeniedLicense,
  isUnknownLicense,
  legitimateAbsence,
  missingPackageIndexIds,
  parsePnpmLock,
  recoverNodeLicenseInventory
} from './p1r-node-license-inventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'package.json'));
const virtualStore = path.join(root, 'node_modules/.pnpm');
const semverDir = fs.readdirSync(virtualStore).filter((entry) => entry.startsWith('semver@7.')).sort().at(-1);
const { satisfies } = require(path.join(virtualStore, semverDir, 'node_modules/semver'));
const denied = ['AGPL-1.0', 'AGPL-3.0', 'SSPL-1.0'];

function missingIndex(id) {
  return JSON.stringify({
    error: {
      code: 'ERR_PNPM_MISSING_PACKAGE_INDEX_FILE',
      message: `Failed to find package index file for ${id} (at /store/index/${id}.json), please consider running 'pnpm install'`
    }
  });
}

function lockFrom(packages, entries) {
  const map = new Map(packages.map((pkg) => [pkg.depPath, {
    dependencies: {},
    optionalDependencies: {},
    ...pkg
  }]));
  return { packages: map, importers: new Map([['.', { entries }]]) };
}

function installed(records) {
  return new Map(records.map((record) => [`${record.name}@${record.version}`, {
    manifest: record,
    licenseText: record.licenseText ?? null
  }]));
}

function names(result) {
  return result.groups.flatMap((group) => group.packages.flatMap((pkg) => pkg.versions.map((version) => `${pkg.name}@${version}`)));
}

test('unclassified pnpm failure is not an inventory', () => {
  const result = recoverNodeLicenseInventory({
    diagnostic: 'pnpm: command not found',
    lock: lockFrom([], []),
    platform: { os: 'linux', cpu: 'x64', libc: 'glibc' },
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([])
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'unclassified-command-failure');
  assert.equal(missingPackageIndexIds('ENOENT'), null);
  assert.deepEqual(missingPackageIndexIds(`WARN ignored\n${missingIndex('@napi-rs/lzma-linux-x64-gnu@1.5.1')}`), ['@napi-rs/lzma-linux-x64-gnu@1.5.1']);
});

test('foreign-platform optional absence keeps installed denied and unknown licenses', () => {
  const lock = lockFrom([
    { depPath: 'app@1.0.0', name: 'app', version: '1.0.0', optional: false, dependencies: { kept: '1.0.0', 'foreign-linux': '1.0.0', 'optional-agpl': '1.0.0', mystery: '1.0.0' } },
    { depPath: 'kept@1.0.0', name: 'kept', version: '1.0.0', optional: false },
    { depPath: 'foreign-linux@1.0.0', name: 'foreign-linux', version: '1.0.0', optional: true, os: ['linux'], cpu: ['x64'] },
    { depPath: 'optional-agpl@1.0.0', name: 'optional-agpl', version: '1.0.0', optional: true, os: ['darwin'], cpu: ['arm64'] },
    { depPath: 'mystery@1.0.0', name: 'mystery', version: '1.0.0', optional: false }
  ], [['app', '1.0.0']]);
  const result = recoverNodeLicenseInventory({
    diagnostic: missingIndex('foreign-linux@1.0.0'),
    lock,
    platform: { os: 'darwin', cpu: 'arm64', libc: 'unknown' },
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([
      { name: 'app', version: '1.0.0', license: 'MIT' },
      { name: 'kept', version: '1.0.0', license: 'Unknown' },
      { name: 'optional-agpl', version: '1.0.0', license: 'AGPL-3.0' },
      { name: 'mystery', version: '1.0.0', licenseText: 'All rights reserved. No grant.' }
    ])
  });
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(names(result).sort(), ['app@1.0.0', 'kept@1.0.0', 'mystery@1.0.0', 'optional-agpl@1.0.0']);
  assert.equal(result.groups.find((group) => group.license === 'AGPL-3.0').packages[0].name, 'optional-agpl');
  assert.equal(result.groups.find((group) => group.license === 'Unknown').packages.map((pkg) => pkg.name).sort().join(), 'kept,mystery');
  assert.equal(result.absences.some((entry) => entry.packageId === 'foreign-linux@1.0.0' && entry.reason.startsWith('foreign-platform')), true);
  assert.equal(names(result).includes('foreign-linux@1.0.0'), false);
});

test('missing current-platform native package stays a failure', () => {
  const linux = { os: 'linux', cpu: 'x64', libc: 'glibc' };
  const native = { depPath: '@rollup/rollup-linux-x64-gnu@4.62.4', name: '@rollup/rollup-linux-x64-gnu', version: '4.62.4', optional: true, os: ['linux'], cpu: ['x64'], engines: { node: '>=18' } };
  const app = { depPath: 'app@1.0.0', name: 'app', version: '1.0.0', optional: false, optionalDependencies: { '@rollup/rollup-linux-x64-gnu': '4.62.4' } };
  const result = recoverNodeLicenseInventory({
    diagnostic: missingIndex(native.depPath),
    lock: lockFrom([app, native], [['app', '1.0.0']]),
    platform: linux,
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([{ name: 'app', version: '1.0.0', license: 'MIT' }])
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /missing installed metadata for @rollup\/rollup-linux-x64-gnu@4\.62\.4/);
});

test('optional engine mismatch on the current platform can be omitted with the rest inventoried', () => {
  const linux = { os: 'linux', cpu: 'x64', libc: 'glibc' };
  const napi = {
    depPath: '@napi-rs/lzma-linux-x64-gnu@1.5.1',
    name: '@napi-rs/lzma-linux-x64-gnu',
    version: '1.5.1',
    optional: true,
    os: ['linux'],
    cpu: ['x64'],
    engines: { node: '^22.20 || ^24.12 || >=25' }
  };
  const app = { depPath: 'rollup@4.62.4', name: 'rollup', version: '4.62.4', optional: false, optionalDependencies: { '@napi-rs/lzma-linux-x64-gnu': '1.5.1' } };
  const result = recoverNodeLicenseInventory({
    diagnostic: missingIndex(napi.depPath),
    lock: lockFrom([app, napi], [['rollup', '4.62.4']]),
    platform: linux,
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([{ name: 'rollup', version: '4.62.4', license: 'MIT' }])
  });
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(names(result), ['rollup@4.62.4']);
  assert.match(result.detail, /unsupported-engine node=\^22\.20 \|\| \^24\.12 \|\| >=25/);
  const accepted = recoverNodeLicenseInventory({
    diagnostic: missingIndex(napi.depPath),
    lock: lockFrom([app, napi], [['rollup', '4.62.4']]),
    platform: linux,
    nodeVersion: 'v22.20.0',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([{ name: 'rollup', version: '4.62.4', license: 'MIT' }])
  });
  assert.equal(accepted.ok, false);
  assert.match(accepted.reason, /missing installed metadata/);
});

test('non-optional engine mismatch and an empty recovery stay failures', () => {
  const linux = { os: 'linux', cpu: 'x64', libc: 'glibc' };
  const visualizer = { depPath: 'rollup-plugin-visualizer@7.1.1', name: 'rollup-plugin-visualizer', version: '7.1.1', optional: false, engines: { node: '>=22' } };
  const rejected = recoverNodeLicenseInventory({
    diagnostic: missingIndex(visualizer.depPath),
    lock: lockFrom([visualizer], [['rollup-plugin-visualizer', '7.1.1']]),
    platform: linux,
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([])
  });
  assert.equal(rejected.ok, false);
  const onlyAbsent = {
    depPath: '@napi-rs/lzma-linux-x64-gnu@1.5.1',
    name: '@napi-rs/lzma-linux-x64-gnu',
    version: '1.5.1',
    optional: true,
    os: ['linux'],
    cpu: ['x64'],
    engines: { node: '^22.20 || ^24.12 || >=25' }
  };
  const empty = recoverNodeLicenseInventory({
    diagnostic: missingIndex(onlyAbsent.depPath),
    lock: lockFrom([onlyAbsent], [['@napi-rs/lzma-linux-x64-gnu', '1.5.1']]),
    platform: linux,
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([])
  });
  assert.equal(empty.ok, false);
  assert.match(empty.reason, /empty/);
});

test('same-os optional musl binary is foreign on gnu and the gnu build is not skipped', () => {
  const linux = { os: 'linux', cpu: 'x64', libc: 'glibc' };
  const gnu = { depPath: '@rollup/rollup-linux-x64-gnu@4.62.4', name: '@rollup/rollup-linux-x64-gnu', version: '4.62.4', optional: true, os: ['linux'], cpu: ['x64'] };
  const musl = { depPath: '@rollup/rollup-linux-x64-musl@4.62.4', name: '@rollup/rollup-linux-x64-musl', version: '4.62.4', optional: true, os: ['linux'], cpu: ['x64'] };
  const app = { depPath: 'rollup@4.62.4', name: 'rollup', version: '4.62.4', optional: false, optionalDependencies: { '@rollup/rollup-linux-x64-gnu': '4.62.4', '@rollup/rollup-linux-x64-musl': '4.62.4' } };
  const result = recoverNodeLicenseInventory({
    diagnostic: missingIndex(musl.depPath),
    lock: lockFrom([app, gnu, musl], [['rollup', '4.62.4']]),
    platform: linux,
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([
      { name: 'rollup', version: '4.62.4', license: 'MIT' },
      { name: '@rollup/rollup-linux-x64-gnu', version: '4.62.4', license: 'MIT' }
    ])
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(names(result).includes('@rollup/rollup-linux-x64-gnu@4.62.4'), true);
  assert.equal(names(result).includes('@rollup/rollup-linux-x64-musl@4.62.4'), false);
  const missingGnu = recoverNodeLicenseInventory({
    diagnostic: missingIndex(gnu.depPath),
    lock: lockFrom([app, gnu], [['rollup', '4.62.4']]),
    platform: linux,
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([{ name: 'rollup', version: '4.62.4', license: 'MIT' }])
  });
  assert.equal(missingGnu.ok, false);
  assert.match(missingGnu.reason, /rollup-linux-x64-gnu/);
  const installedMusl = recoverNodeLicenseInventory({
    diagnostic: missingIndex(musl.depPath),
    lock: lockFrom([app, gnu, musl], [['rollup', '4.62.4']]),
    platform: linux,
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([
      { name: 'rollup', version: '4.62.4', license: 'MIT' },
      { name: '@rollup/rollup-linux-x64-gnu', version: '4.62.4', license: 'MIT' },
      { name: '@rollup/rollup-linux-x64-musl', version: '4.62.4', license: 'AGPL-3.0' }
    ])
  });
  assert.equal(installedMusl.ok, true, installedMusl.reason);
  assert.equal(installedMusl.groups.some((group) => group.license === 'AGPL-3.0' && group.packages.some((pkg) => pkg.name === '@rollup/rollup-linux-x64-musl')), true);
});

test('transitive optional subtrees are omitted and transitive required gaps stay failures', () => {
  const linux = { os: 'linux', cpu: 'x64', libc: 'glibc' };
  const darwin = { os: 'darwin', cpu: 'arm64', libc: 'unknown' };
  const child = { depPath: 'only-through-optional@1.0.0', name: 'only-through-optional', version: '1.0.0', optional: false };
  const foreign = { depPath: 'foreign-linux@1.0.0', name: 'foreign-linux', version: '1.0.0', optional: true, os: ['linux'], cpu: ['x64'], dependencies: { 'only-through-optional': '1.0.0' } };
  const napi = {
    depPath: '@napi-rs/lzma-linux-x64-gnu@1.5.1',
    name: '@napi-rs/lzma-linux-x64-gnu',
    version: '1.5.1',
    optional: true,
    os: ['linux'],
    cpu: ['x64'],
    engines: { node: '^22.20 || ^24.12 || >=25' },
    dependencies: { 'only-through-optional': '1.0.0' }
  };
  const mid = { depPath: 'mid@1.0.0', name: 'mid', version: '1.0.0', optional: false, dependencies: { leaf: '1.0.0', 'current-native': '1.0.0' } };
  const leaf = { depPath: 'leaf@1.0.0', name: 'leaf', version: '1.0.0', optional: false };
  const currentNative = { depPath: 'current-native@1.0.0', name: 'current-native', version: '1.0.0', optional: true, os: ['linux'], cpu: ['x64'] };
  const app = { depPath: 'app@1.0.0', name: 'app', version: '1.0.0', optional: false, dependencies: { mid: '1.0.0' }, optionalDependencies: { '@napi-rs/lzma-linux-x64-gnu': '1.5.1' } };
  const omitted = recoverNodeLicenseInventory({
    diagnostic: missingIndex(napi.depPath),
    lock: lockFrom([app, mid, leaf, currentNative, napi, child], [['app', '1.0.0']]),
    platform: linux,
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([
      { name: 'app', version: '1.0.0', license: 'MIT' },
      { name: 'mid', version: '1.0.0', license: 'MIT' },
      { name: 'leaf', version: '1.0.0', license: 'MIT' },
      { name: 'current-native', version: '1.0.0', license: 'MIT' }
    ])
  });
  assert.equal(omitted.ok, true, omitted.reason);
  assert.equal(names(omitted).includes('only-through-optional@1.0.0'), false);
  assert.equal(names(omitted).includes('@napi-rs/lzma-linux-x64-gnu@1.5.1'), false);
  assert.equal(names(omitted).includes('leaf@1.0.0'), true);
  assert.equal(names(omitted).includes('current-native@1.0.0'), true);
  const missingLeaf = recoverNodeLicenseInventory({
    diagnostic: missingIndex('leaf@1.0.0'),
    lock: lockFrom([app, mid, leaf], [['app', '1.0.0']]),
    platform: linux,
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([
      { name: 'app', version: '1.0.0', license: 'MIT' },
      { name: 'mid', version: '1.0.0', license: 'MIT' }
    ])
  });
  assert.equal(missingLeaf.ok, false);
  assert.match(missingLeaf.reason, /leaf@1\.0\.0/);
  const missingNative = recoverNodeLicenseInventory({
    diagnostic: missingIndex(currentNative.depPath),
    lock: lockFrom([
      { ...app, optionalDependencies: {} },
      mid,
      currentNative
    ], [['app', '1.0.0']]),
    platform: linux,
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([
      { name: 'app', version: '1.0.0', license: 'MIT' },
      { name: 'mid', version: '1.0.0', license: 'MIT' }
    ])
  });
  assert.equal(missingNative.ok, false);
  assert.match(missingNative.reason, /current-native@1\.0\.0/);
  const requiredChild = recoverNodeLicenseInventory({
    diagnostic: missingIndex(child.depPath),
    lock: lockFrom([
      { ...app, dependencies: { mid: '1.0.0', 'only-through-optional': '1.0.0' }, optionalDependencies: { '@napi-rs/lzma-linux-x64-gnu': '1.5.1' } },
      mid,
      napi,
      child
    ], [['app', '1.0.0']]),
    platform: linux,
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([
      { name: 'app', version: '1.0.0', license: 'MIT' },
      { name: 'mid', version: '1.0.0', license: 'MIT' }
    ])
  });
  assert.equal(requiredChild.ok, false);
  assert.match(requiredChild.reason, /only-through-optional@1\.0\.0/);
  const darwinForeign = recoverNodeLicenseInventory({
    diagnostic: missingIndex(foreign.depPath),
    lock: lockFrom([
      { ...app, dependencies: {}, optionalDependencies: { 'foreign-linux': '1.0.0' } },
      foreign,
      child
    ], [['app', '1.0.0']]),
    platform: darwin,
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies,
    manifests: installed([{ name: 'app', version: '1.0.0', license: 'MIT' }])
  });
  assert.equal(darwinForeign.ok, true, darwinForeign.reason);
  assert.equal(names(darwinForeign).includes('only-through-optional@1.0.0'), false);
});

test('license policy still rejects denied and unknown expressions', () => {
  assert.equal(isDeniedLicense('AGPL-3.0', denied), true);
  assert.equal(isDeniedLicense('(MIT OR AGPL-3.0)', denied), true);
  assert.equal(isDeniedLicense('GPL-3.0', denied), false);
  assert.equal(isDeniedLicense('MIT', denied), false);
  assert.equal(isUnknownLicense('Unknown'), true);
  assert.equal(isUnknownLicense('SEE LICENSE IN LICENSE'), true);
  assert.equal(isUnknownLicense(''), true);
  assert.equal(isUnknownLicense('MIT'), false);
});

test('the installed G447 lock proves the napi package absence without skipping current-platform natives', () => {
  const lock = parsePnpmLock(fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8'), root);
  const napi = lock.packages.get('@napi-rs/lzma-linux-x64-gnu@1.5.1');
  assert.equal(napi.optional, true);
  assert.deepEqual(napi.os, ['linux']);
  assert.deepEqual(napi.cpu, ['x64']);
  assert.equal(napi.engines.node, '^22.20 || ^24.12 || >=25');
  assert.match(legitimateAbsence(napi, { os: 'darwin', cpu: 'arm64', libc: 'unknown' }, 'v20.19.5', '10.19.0', satisfies), /^foreign-platform/);
  assert.match(legitimateAbsence(napi, { os: 'linux', cpu: 'x64', libc: 'glibc' }, 'v20.19.5', '10.19.0', satisfies), /^unsupported-engine/);
  assert.equal(legitimateAbsence(napi, { os: 'linux', cpu: 'x64', libc: 'glibc' }, 'v22.20.0', '10.19.0', satisfies), null);
  const native = [...lock.packages.values()].find((pkg) => pkg.name === '@rollup/rollup-linux-x64-gnu' && pkg.version === '4.62.4');
  assert.equal(native.optional, true);
  assert.equal(legitimateAbsence(native, { os: 'linux', cpu: 'x64', libc: 'glibc' }, 'v20.19.5', '10.19.0', satisfies), null);
  assert.match(legitimateAbsence(native, { os: 'darwin', cpu: 'arm64', libc: 'unknown' }, 'v20.19.5', '10.19.0', satisfies), /^foreign-platform/);
  const musl = [...lock.packages.values()].find((pkg) => pkg.name === '@rollup/rollup-linux-x64-musl' && pkg.version === '4.62.4');
  assert.match(legitimateAbsence(musl, { os: 'linux', cpu: 'x64', libc: 'glibc' }, 'v20.19.5', '10.19.0', satisfies), /^foreign-platform package-id/);
  assert.equal(legitimateAbsence(musl, { os: 'linux', cpu: 'x64', libc: 'unknown' }, 'v20.19.5', '10.19.0', satisfies), null);
  const esbuild = [...lock.packages.values()].find((pkg) => pkg.name === '@esbuild/linux-x64');
  assert.equal(legitimateAbsence(esbuild, { os: 'linux', cpu: 'x64', libc: 'glibc' }, 'v20.19.5', '10.19.0', satisfies), null);
  const portableName = { ...musl, os: ['linux'], cpu: ['x64'], name: 'helper-win32-x64-msvc' };
  assert.equal(legitimateAbsence(portableName, { os: 'linux', cpu: 'x64', libc: 'glibc' }, 'v20.19.5', '10.19.0', satisfies), null);
});

test('fresh G447 install recovers a non-empty inventory when the linux optional index is the only reported gap', () => {
  const diagnostic = missingIndex('@napi-rs/lzma-linux-x64-gnu@1.5.1');
  const result = recoverNodeLicenseInventory({
    diagnostic,
    lockText: fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8'),
    root,
    platform: { os: 'darwin', cpu: 'arm64', libc: 'unknown' },
    nodeVersion: 'v20.19.5',
    pnpmVersion: '10.19.0',
    satisfies
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(names(result).includes('@napi-rs/lzma-linux-x64-gnu@1.5.1'), false);
  assert.equal(result.groups.some((group) => group.license === 'MIT' && group.packages.some((pkg) => pkg.name === '@alloc/quick-lru' && pkg.versions.includes('5.2.0'))), true);
  assert.equal(result.groups.some((group) => group.license === 'Unknown' && group.packages.some((pkg) => pkg.name === '@dcloudio/uts')), true);
  assert.equal(result.groups.some((group) => isDeniedLicense(group.license, denied)), false);
  assert.ok(names(result).length > 900);
});

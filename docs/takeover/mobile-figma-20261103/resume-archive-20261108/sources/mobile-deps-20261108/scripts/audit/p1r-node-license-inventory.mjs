import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const LICENSE_FILES = [
  'LICENSE',
  'LICENCE',
  'LICENSE.md',
  'LICENCE.md',
  'LICENSE.txt',
  'LICENCE.txt',
  'MIT-LICENSE.txt',
  'MIT-LICENSE.md',
  'MIT-LICENSE'
];

// Names pnpm's license scanner accepts from a LICENSE file body. A non-match stays Unknown.
const LICENSE_NAMES = [
  'Apache1_1', 'Apache-1.1', 'Apache 1.1',
  'Apache2', 'Apache-2.0', 'Apache 2.0',
  'BSD', 'BSD-4-Clause',
  'CC01', 'CC0-1.0', 'CC0 1.0',
  'CDDL1', 'CDDL-1.0', 'Common Development and Distribution License 1.0',
  'EPL1', 'EPL-1.0', 'Eclipse Public License 1.0',
  'GPLv2', 'GPL-2.0-only',
  'GPLv3', 'GPL-3.0-only',
  'ISC',
  'LGPL', 'LGPL-3.0-only',
  'LGPL2_1', 'LGPL-2.1-only',
  'MIT',
  'MPL1_1', 'MPL-1.1', 'Mozilla Public License 1.1',
  'MPL2', 'MPL-2.0', 'Mozilla Public License 2.0',
  'NewBSD', 'BSD-3-Clause', 'New BSD',
  'OFL', 'OFL-1.1', 'SIL OPEN FONT LICENSE Version 1.1',
  'Python', 'PSF-2.0', 'Python Software Foundation License',
  'Ruby',
  'SimplifiedBSD', 'BSD-2-Clause', 'Simplified BSD',
  'WTFPL',
  '0BSD', 'BSD Zero Clause License',
  'Zlib', 'zlib/libpng license'
];

const MISSING_INDEX_CODE = 'ERR_PNPM_MISSING_PACKAGE_INDEX_FILE';
const MISSING_INDEX_PATTERN = /Failed to find package index file for (.+?) \(at /g;

export function isDeniedLicense(expression, denied) {
  return denied.some((item) => new RegExp(`(^|[^A-Za-z0-9.-])${String(item).replaceAll('.', '\\.')}(?=$|[^A-Za-z0-9.-])`).test(expression));
}

export function isUnknownLicense(expression) {
  return !expression || /unknown|unlicensed|see license/i.test(expression);
}

export function currentLibc() {
  if (process.platform !== 'linux') return 'unknown';
  try {
    const report = process.report?.getReport?.() ?? {};
    if (report.header?.glibcVersionRuntime) return 'glibc';
    const shared = Array.isArray(report.sharedObjects) ? report.sharedObjects : [];
    if (shared.some((file) => String(file).includes('libc.musl-') || String(file).includes('ld-musl-'))) return 'musl';
  } catch {
    return 'unknown';
  }
  return 'unknown';
}

export function missingPackageIndexIds(diagnostic) {
  const text = String(diagnostic ?? '');
  let code = null;
  let message = text;
  const start = text.indexOf('{');
  if (start >= 0) {
    try {
      const parsed = JSON.parse(text.slice(start));
      code = parsed?.error?.code ?? parsed?.code ?? null;
      message = parsed?.error?.message ?? parsed?.message ?? text;
    } catch {
      code = null;
    }
  }
  const ids = [];
  for (const source of [message, text]) {
    MISSING_INDEX_PATTERN.lastIndex = 0;
    let match = MISSING_INDEX_PATTERN.exec(source);
    while (match) {
      if (!ids.includes(match[1])) ids.push(match[1]);
      match = MISSING_INDEX_PATTERN.exec(source);
    }
  }
  if (code === MISSING_INDEX_CODE) return ids;
  if (ids.length > 0 && text.includes(MISSING_INDEX_CODE)) return ids;
  return null;
}

export function recoverNodeLicenseInventory(options) {
  try {
    return recoverUncaught(options);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function recoverUncaught(options) {
  const ids = missingPackageIndexIds(options.diagnostic);
  if (ids === null) {
    return { ok: false, reason: 'unclassified-command-failure' };
  }
  if (ids.length === 0) {
    return { ok: false, reason: 'missing package index error did not name a package' };
  }
  const lock = options.lock ?? parsePnpmLock(options.lockText, options.root);
  const satisfies = options.satisfies ?? loadSatisfies(options.root);
  const platform = options.platform;
  const manifests = options.manifests ?? indexInstalledManifests(options.root);
  const requested = platformMatchingPackages(lock, platform);
  const byId = indexLockPackages(lock);
  const absences = [];
  const included = [];

  for (const pkg of requested) {
    const key = `${pkg.name}@${pkg.version}`;
    const manifest = manifests.get(key) ?? null;
    if (manifest?.conflict) {
      return { ok: false, reason: `installed license metadata conflicts for ${key}` };
    }
    if (manifest) {
      included.push({ pkg, license: licenseFromInstalled(manifest) });
      continue;
    }
    const reason = legitimateAbsence(pkg, platform, options.nodeVersion, options.pnpmVersion, satisfies);
    if (reason) {
      absences.push({ id: pkg.depPath, packageId: key, reason });
      continue;
    }
    return { ok: false, reason: `missing installed metadata for ${key}` };
  }

  for (const id of ids) {
    const explained = explainDiagnosticId(id, byId, manifests, absences, platform, options.nodeVersion, options.pnpmVersion, satisfies);
    if (!explained.ok) return explained;
  }

  if (included.length === 0) {
    return { ok: false, reason: 'recovered license inventory is empty' };
  }

  const detail = `installed package manifests; omitted ${absences.map((entry) => `${entry.packageId} (${entry.reason})`).join(', ') || 'none'}`;
  return {
    ok: true,
    groups: compactLicenseGroups(included),
    absences,
    provenance: 'installed-manifests',
    detail
  };
}

function explainDiagnosticId(id, byId, manifests, absences, platform, nodeVersion, pnpmVersion, satisfies) {
  const pkg = byId.get(id) ?? [...byId.values()].find((entry) => `${entry.name}@${entry.version}` === id || entry.depPath === id);
  if (!pkg) return { ok: false, reason: `missing package index names ${id}, which is not in the lockfile` };
  const key = `${pkg.name}@${pkg.version}`;
  if (manifests.get(key) && !manifests.get(key).conflict) return { ok: true };
  if (absences.some((entry) => entry.packageId === key || entry.id === pkg.depPath || entry.id === id)) return { ok: true };
  const reason = legitimateAbsence(pkg, platform, nodeVersion, pnpmVersion, satisfies);
  if (reason && !manifests.has(key)) {
    if (!absences.some((entry) => entry.packageId === key)) {
      absences.push({ id: pkg.depPath, packageId: key, reason });
    }
    return { ok: true };
  }
  return { ok: false, reason: `missing package index for ${id} is not a proven optional absence` };
}

export function legitimateAbsence(pkg, platform, nodeVersion, pnpmVersion, satisfies) {
  if (!pkg?.optional) return null;
  if (!platformMatches(pkg, platform)) {
    return `foreign-platform os=${JSON.stringify(pkg.os ?? ['any'])} cpu=${JSON.stringify(pkg.cpu ?? ['any'])} libc=${JSON.stringify(pkg.libc ?? ['any'])}`;
  }
  const encoded = encodedPlatform(pkg.name);
  if (encoded && encodedPlatformConflicts(encoded, platform)) {
    return `foreign-platform package-id os=${encoded.os} cpu=${encoded.cpu} libc=${encoded.libc ?? 'any'}`;
  }
  const engines = pkg.engines ?? null;
  if (!engines?.node && !engines?.pnpm) return null;
  if (typeof satisfies !== 'function') return null;
  if (engines.pnpm && !pnpmVersion) return null;
  const nodeDecision = engines.node ? satisfiesSafe(satisfies, nodeVersion, engines.node) : true;
  const pnpmDecision = engines.pnpm ? satisfiesSafe(satisfies, pnpmVersion, engines.pnpm) : true;
  if (nodeDecision === null || pnpmDecision === null) return null;
  if (nodeDecision === false || pnpmDecision === false) {
    return `unsupported-engine node=${engines.node ?? ''} pnpm=${engines.pnpm ?? ''}`;
  }
  return null;
}

function satisfiesSafe(satisfies, version, range) {
  try {
    return satisfies(version, range, { includePrerelease: true }) ? true : false;
  } catch {
    return null;
  }
}

export function platformMatches(pkg, platform) {
  const osOk = pkg.os ? checkList(platform.os, pkg.os) : true;
  const cpuOk = pkg.cpu ? checkList(platform.cpu, pkg.cpu) : true;
  const libcOk = pkg.libc && platform.libc && platform.libc !== 'unknown' ? checkList(platform.libc, pkg.libc) : true;
  return osOk && cpuOk && libcOk;
}

const LIBC_TOKENS = new Set(['gnu', 'musl', 'glibc', 'msvc', 'gnueabihf', 'musleabihf']);
const CPU_TOKENS = new Set(['x64', 'arm64', 'arm', 'ia32', 'ppc64', 'riscv64', 's390x', 'loong64', 'mips64el']);
const OS_TOKENS = new Set(['linux', 'darwin', 'win32', 'freebsd', 'openbsd', 'android', 'netbsd', 'sunos', 'openharmony', 'aix']);

// Optional native packages encode the target in the package id. The lockfile records os/cpu and
// usually omits libc, so gnu and musl builds are not distinguishable from os/cpu alone.
function encodedPlatform(name) {
  const tokens = String(name).split('/').pop().split('-');
  if (tokens.length < 2) return null;
  const encoded = {};
  let index = tokens.length - 1;
  if (LIBC_TOKENS.has(tokens[index])) {
    encoded.libc = tokens[index];
    index -= 1;
  }
  if (index >= 1 && tokens[index] === 'eabi' && tokens[index - 1] === 'arm') {
    encoded.cpu = 'arm';
    index -= 2;
  } else if (index >= 0 && CPU_TOKENS.has(tokens[index])) {
    encoded.cpu = tokens[index];
    index -= 1;
  } else {
    return null;
  }
  if (index >= 0 && OS_TOKENS.has(tokens[index])) {
    encoded.os = tokens[index];
    return encoded;
  }
  return null;
}

function encodedPlatformConflicts(encoded, platform) {
  if (encoded.os && encoded.os !== platform.os) return true;
  if (encoded.cpu && encoded.cpu !== platform.cpu) return true;
  if (!encoded.libc || !platform.libc || platform.libc === 'unknown') return false;
  return normalizeLibc(encoded.libc) !== normalizeLibc(platform.libc);
}

function normalizeLibc(libc) {
  if (libc === 'glibc' || libc === 'gnu' || libc === 'gnueabihf') return 'gnu';
  if (libc === 'musl' || libc === 'musleabihf') return 'musl';
  return libc;
}

function checkList(value, list) {
  let match = false;
  let blc = 0;
  if (typeof list === 'string') list = [list];
  list = list.filter((item) => typeof item === 'string');
  if (list.length === 1 && list[0] === 'any') return true;
  const values = Array.isArray(value) ? value : [value];
  for (const value2 of values) {
    for (const item of list) {
      if (item[0] === '!') {
        if (item.slice(1) === value2) return false;
        blc += 1;
      } else {
        match = match || item === value2;
      }
    }
  }
  return match || blc === list.length;
}

function platformMatchingPackages(lock, platform) {
  const seen = new Set();
  const requested = [];
  const visit = (depPath) => {
    if (!depPath || seen.has(depPath)) return;
    const pkg = lock.packages.get(depPath);
    if (!pkg) {
      seen.add(depPath);
      return;
    }
    seen.add(depPath);
    // Same gate as pnpm's license scanner: os/cpu/libc only. Engines are intentionally not applied here.
    if (!platformMatches(pkg, platform)) return;
    requested.push(pkg);
    for (const [name, reference] of Object.entries({ ...pkg.dependencies, ...pkg.optionalDependencies })) {
      visit(refToRelative(reference, name));
    }
  };
  for (const importer of lock.importers.values()) {
    for (const [name, reference] of importer.entries) visit(refToRelative(reference, name));
  }
  return requested;
}

function indexLockPackages(lock) {
  const byId = new Map();
  for (const pkg of lock.packages.values()) {
    byId.set(pkg.depPath, pkg);
    byId.set(`${pkg.name}@${pkg.version}`, pkg);
  }
  return byId;
}

export function parsePnpmLock(lockText, root) {
  const yaml = loadYaml(root);
  const document = yaml.parse(lockText);
  const packages = new Map();
  const bases = document.packages ?? {};
  const snapshots = document.snapshots ?? {};
  for (const depPath of Object.keys(snapshots)) {
    const identity = nameVer(depPath);
    const base = bases[identity.id] ?? {};
    const snapshot = snapshots[depPath] ?? {};
    packages.set(depPath, {
      depPath,
      name: identity.name,
      version: identity.version,
      optional: snapshot.optional === true,
      os: base.os ?? snapshot.os,
      cpu: base.cpu ?? snapshot.cpu,
      libc: base.libc ?? snapshot.libc,
      engines: base.engines ?? snapshot.engines ?? null,
      dependencies: stringifyEdges(snapshot.dependencies),
      optionalDependencies: stringifyEdges(snapshot.optionalDependencies)
    });
  }
  const importers = new Map();
  for (const [importerId, importer] of Object.entries(document.importers ?? {})) {
    const entries = [];
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const [name, entry] of Object.entries(importer?.[field] ?? {})) {
        const reference = typeof entry === 'string' ? entry : entry?.version;
        if (reference) entries.push([name, reference]);
      }
    }
    importers.set(importerId, { entries });
  }
  return { packages, importers };
}

function stringifyEdges(edges) {
  const result = {};
  for (const [name, reference] of Object.entries(edges ?? {})) result[name] = String(reference);
  return result;
}

function nameVer(depPath) {
  const id = String(depPath).split('(')[0];
  const at = id.lastIndexOf('@');
  return { id, name: id.slice(0, at), version: id.slice(at + 1) };
}

function refToRelative(reference, pkgName) {
  if (!reference || String(reference).startsWith('link:')) return null;
  const value = String(reference);
  if (value[0] === '@') return value;
  const atIndex = value.indexOf('@');
  if (atIndex === -1) return `${pkgName}@${value}`;
  const colonIndex = value.indexOf(':');
  const bracketIndex = value.indexOf('(');
  if ((colonIndex === -1 || atIndex < colonIndex) && (bracketIndex === -1 || atIndex < bracketIndex)) return value;
  return `${pkgName}@${value}`;
}

function licenseFromInstalled(record) {
  const field = record.manifest.license ?? record.manifest.licenses;
  const parsed = parseLicenseManifestField(field);
  if (parsed && !/see license/i.test(parsed)) return parsed;
  const fromFile = licenseFromFiles(record.directory, record.licenseText);
  return fromFile ?? 'Unknown';
}

function parseLicenseManifestField(field) {
  if (Array.isArray(field)) {
    const licenseTypes = field.map((license) => coerceToString(license?.type) ?? coerceToString(license?.name)).filter(Boolean);
    if (licenseTypes.length > 1) return `(${licenseTypes.join(' OR ')})`;
    return licenseTypes[0] ?? null;
  }
  if (field && typeof field === 'object') return field.type ?? coerceToString(field);
  return coerceToString(field);
}

function coerceToString(field) {
  if (field == null) return null;
  const string = String(field);
  return typeof field === 'string' || field === string ? string : null;
}

function licenseFromFiles(directory, licenseText) {
  const contents = licenseText ?? readLicenseFile(directory);
  if (!contents) return null;
  const match = contents.match(new RegExp(`\\b(${LICENSE_NAMES.join('|')})\\b`, 'gi'));
  if (!match) return null;
  return [...new Set(match)].join(' OR ');
}

function readLicenseFile(directory) {
  if (!directory) return null;
  for (const name of LICENSE_FILES) {
    const file = path.join(directory, name);
    if (!fs.existsSync(file)) continue;
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > 1024 * 1024) continue;
    return fs.readFileSync(file, 'utf8');
  }
  return null;
}

function compactLicenseGroups(included) {
  const byLicense = new Map();
  for (const entry of included) {
    if (!byLicense.has(entry.license)) byLicense.set(entry.license, new Map());
    const versions = byLicense.get(entry.license);
    if (!versions.has(entry.pkg.name)) versions.set(entry.pkg.name, new Set());
    versions.get(entry.pkg.name).add(entry.pkg.version);
  }
  return [...byLicense.entries()].map(([license, packages]) => ({
    license,
    packages: [...packages.entries()].map(([name, versions]) => ({
      name,
      versions: [...versions].sort((left, right) => left.localeCompare(right, 'en')),
      license
    })).sort((left, right) => left.name.localeCompare(right.name, 'en'))
  })).sort((left, right) => left.license.localeCompare(right.license, 'en'));
}

function indexInstalledManifests(root) {
  const virtualStore = path.join(root, 'node_modules', '.pnpm');
  const manifests = new Map();
  if (!fs.existsSync(virtualStore)) return manifests;
  for (const entry of fs.readdirSync(virtualStore, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const modules = path.join(virtualStore, entry.name, 'node_modules');
    if (!fs.existsSync(modules)) continue;
    for (const child of fs.readdirSync(modules, { withFileTypes: true })) {
      if (child.name.startsWith('.')) continue;
      if (child.name.startsWith('@')) {
        const scope = path.join(modules, child.name);
        for (const inner of fs.readdirSync(scope, { withFileTypes: true })) {
          considerManifest(manifests, path.join(scope, inner.name));
        }
      } else {
        considerManifest(manifests, path.join(modules, child.name));
      }
    }
  }
  return manifests;
}

function considerManifest(manifests, directory) {
  const manifestPath = path.join(directory, 'package.json');
  if (!fs.existsSync(manifestPath)) return;
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return;
  }
  if (!manifest?.name || !manifest?.version) return;
  const key = `${manifest.name}@${manifest.version}`;
  const record = { manifest, directory };
  const existing = manifests.get(key);
  if (!existing) {
    manifests.set(key, record);
    return;
  }
  if (licenseFromInstalled(existing) !== licenseFromInstalled(record)) {
    manifests.set(key, { conflict: true, manifest, directory });
  }
}

function loadYaml(root) {
  return loadVirtualPackage(root, 'yaml@2.', 'yaml');
}

function loadSatisfies(root) {
  try {
    return loadVirtualPackage(root, 'semver@7.', 'semver').satisfies;
  } catch {
    return null;
  }
}

function loadVirtualPackage(root, prefix, name) {
  const virtualStore = path.join(root, 'node_modules', '.pnpm');
  const directory = fs.readdirSync(virtualStore).filter((entry) => entry.startsWith(prefix)).sort().at(-1);
  if (!directory) throw new Error(`installed ${name} parser is unavailable`);
  const require = createRequire(path.join(root, 'package.json'));
  return require(path.join(virtualStore, directory, 'node_modules', name));
}

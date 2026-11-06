#!/bin/bash
# Supervisor lease for the frozen G331 other-sessions probe. Identity 383.
# Supervisor means this process, running as Mac user Admin (uid 502).
# Unix uid 0 is rejected. This file does not call sudo, git, or install packages,
# does not read, stat, chmod, or copy ~/.docker/config.json, does not use registry auth,
# publishes no port except 127.0.0.1:13306, and does not delete a Docker volume.
# MySQL is the pinned local image only (--pull=never).
set -euo pipefail
umask 077

PREFIX='/tmp/grok-mobile-device-guard-source-directory-383'
PRIVATE_PREFIX='/private/tmp/grok-mobile-device-guard-source-directory-383'
PRIOR_OUT='/tmp/grok-mobile-device-others-revoke-h5-probe-331'
PRIOR_PRIVATE='/private/tmp/grok-mobile-device-others-revoke-h5-probe-331'
OWNER_UID=502
OWNER_USER='Admin'
OWNER_HOME='/Users/Admin'
RESUME='/LOCAL_HANDOFF_HOME/supervision-root/mobile-supervision/resume-20261105'
G331="$RESUME/device-others-revoke-h5-probe-331-frozen/device-others-owner.cjs"
G331_SHA='704943be048fda4933327ca91e6870b08eb8fa70557ff3d0908c0591aa4ba6af'
G331_REPORT="$RESUME/device-others-revoke-h5-probe-331-frozen/REPORT.md"
G331_REPORT_SHA='527843fef5fa89868d1ac4e8d99f7c4a9f77e1654dfa0aa3a214eb389186d795'
G318="$RESUME/auth-negative-aggregate-318-frozen"
G318_ACCEPTANCE_SHA='9e72c956715e907fc9720af09dcbd3cf9c0e2633ef84c1ed3827f65e9254e1d5'
G318_PROBE_SHA='06e718d5905354b736509fc4876f35c51ff39e5b47f9674d769aff82c84577bb'
G318_OBSERVE_SHA='fee4072c7e4300b3ed79b90d71d1c150131f1400e3040358f5e03c82bb8b99b9'
B116_INDEX="$RESUME/reading-focus-multiline-padding-222-root/h5/index.html"
B116_SHA='94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520'
DEVICE_HARNESS="$RESUME/iam-device-browser-67-b73-root/harness"
DEVICE_PROBE_SHA='dad7f0dbbae75f9fdb2dc73c666b9420f03632ca84afff2554d92d144e281a41'
DEVICE_HTTP_SHA='091ecd308bf68ac31c5a874abe6bd9f9e86b9690084df7e06c9814767bd6ae91'
CONSENT_HARNESS="$RESUME/current-b81-consent-settle-74-root/harness"
REPO='/LOCAL_HANDOFF_HOME/.codex/worktrees/mobile-iam-http-acceptance-20261105/cloudstudy'
PLAYWRIGHT_ROOT='/LOCAL_HANDOFF_HOME/.codex/worktrees/mobile-figma-integration-20261103/cloudstudy'
JAVA_HOME_PIN='/LOCAL_HANDOFF_HOME/.local/tools/jdk-25.0.4.1+1/Contents/Home'
JAVA_ALIAS='/LOCAL_HANDOFF_HOME/.local/tools/jdk'
MYSQL_IMAGE='sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b'
LABEL_BASE='cloudstudy.qa.mobile-device-guard-source-directory-383'
NAME_BASE='cloudstudy-owner-383'
PORTS=(13306 18070 18087 18183)

qa_suffix=''
qa_name=''
qa_label=''
qa_cid=''
qa_scratch=''
qa_node=''
qa_timed_out=0
qa_node_status=0
qa_prior_leak=0
qa_prior_snapshot=''
qa_prior_result='absent'
qa_prior_result_sha=''
qa_mysql_admin_password=''
qa_password=''

die() {
  printf 'device-others-runtime: %s\n' "$1" >&2
  exit 2
}

canon_path() {
  node - "$1" <<'NODE'
process.stdout.write(require('fs').realpathSync(process.argv[2]))
NODE
}

describe_path() {
  node - "$1" <<'NODE'
const fs = require('fs')
const s = fs.lstatSync(process.argv[2])
const k = s.isSocket() ? 'socket' : s.isSymbolicLink() ? 'symlink' : s.isDirectory() ? 'dir' : s.isFile() ? 'file' : 'other'
process.stdout.write([k, String(s.uid), String(s.gid), (s.mode & 511).toString(8)].join(' '))
NODE
}

mode_owner() { printf '%s' "${1%??}"; }
mode_group() { local rest="${1#?}"; printf '%s' "${rest%?}"; }
mode_other() { printf '%s' "${1#??}"; }

writable_digit() {
  case "$1" in
    2|3|6|7) return 0 ;;
  esac
  return 1
}

reject_shared_write() {
  local mode="$1" path="$2"
  case "$mode" in
    [0-7][0-7][0-7]) ;;
    *) die "mode:$path" ;;
  esac
  if writable_digit "$(mode_group "$mode")" || writable_digit "$(mode_other "$mode")"; then
    die "mode:$path"
  fi
  return 0
}

require_owned_file() {
  local path="$1" desc kind uid mode
  [ ! -L "$path" ] || die "symlink:$path"
  [ -f "$path" ] || die "missing:$path"
  [ "$(canon_path "$path")" = "$path" ] || die "canon:$path"
  desc="$(describe_path "$path" 2>/dev/null)" || die "stat:$path"
  kind="${desc%% *}"
  desc="${desc#* }"
  uid="${desc%% *}"
  desc="${desc#* }"
  desc="${desc#* }"
  mode="$desc"
  [ "$kind" = 'file' ] || die "type:$path"
  [ "$uid" = "$OWNER_UID" ] || die "owner:$path"
  reject_shared_write "$mode" "$path"
}

require_owned_dir() {
  local path="$1" desc kind uid mode
  [ ! -L "$path" ] || die "symlink:$path"
  [ -d "$path" ] || die "missing:$path"
  [ "$(canon_path "$path")" = "$path" ] || die "canon:$path"
  desc="$(describe_path "$path" 2>/dev/null)" || die "stat:$path"
  kind="${desc%% *}"
  desc="${desc#* }"
  uid="${desc%% *}"
  desc="${desc#* }"
  desc="${desc#* }"
  mode="$desc"
  [ "$kind" = 'dir' ] || die "type:$path"
  [ "$uid" = "$OWNER_UID" ] || die "owner:$path"
  reject_shared_write "$mode" "$path"
}

require_private_prefix() {
  local real desc kind uid mode
  [ "$(basename "$PREFIX")" = 'grok-mobile-device-guard-source-directory-383' ] || die 'prefix'
  [ ! -L "$PREFIX" ] || die 'prefix-symlink'
  [ -d "$PREFIX" ] || die 'prefix-missing'
  real="$(canon_path "$PREFIX")"
  [ "$real" = "$PREFIX" ] || [ "$real" = "$PRIVATE_PREFIX" ] || die 'prefix-canon'
  desc="$(describe_path "$PREFIX" 2>/dev/null)" || die 'prefix-stat'
  kind="${desc%% *}"
  desc="${desc#* }"
  uid="${desc%% *}"
  desc="${desc#* }"
  desc="${desc#* }"
  mode="$desc"
  [ "$kind" = 'dir' ] || die 'prefix-type'
  [ "$uid" = "$OWNER_UID" ] || die 'prefix-owner'
  [ "$mode" = '700' ] || die 'prefix-mode'
}

require_prefix_file() {
  local path="$1" real desc kind uid mode
  case "$path" in
    "$PREFIX"/*) ;;
    *) die "canon:$path" ;;
  esac
  [ ! -L "$path" ] || die "symlink:$path"
  [ -f "$path" ] || die "missing:$path"
  real="$(canon_path "$path")"
  case "$real" in
    "$PREFIX"/*|"$PRIVATE_PREFIX"/*) ;;
    *) die "canon:$path" ;;
  esac
  desc="$(describe_path "$path" 2>/dev/null)" || die "stat:$path"
  kind="${desc%% *}"
  desc="${desc#* }"
  uid="${desc%% *}"
  desc="${desc#* }"
  desc="${desc#* }"
  mode="$desc"
  [ "$kind" = 'file' ] || die "type:$path"
  [ "$uid" = "$OWNER_UID" ] || die "owner:$path"
  reject_shared_write "$mode" "$path"
}

resolve_alias() {
  node - "$1" <<'NODE'
const fs = require('fs')
const path = require('path')
const alias = process.argv[2]
const st = fs.lstatSync(alias)
if (!st.isSymbolicLink()) process.exit(3)
const raw = fs.readlinkSync(alias)
process.stdout.write(path.resolve(path.dirname(alias), raw))
NODE
}

require_java() {
  local real home desc uid resolved
  require_owned_dir "$JAVA_HOME_PIN"
  [ -x "$JAVA_HOME_PIN/bin/java" ] || die 'java-missing'
  real="$(canon_path "$JAVA_HOME_PIN/bin/java")"
  home="$(canon_path "$JAVA_HOME_PIN")"
  [ "$home" = "$JAVA_HOME_PIN" ] || die 'java-canon'
  case "$real" in
    "$home"/*) ;;
    *) die 'java-canon' ;;
  esac
  desc="$(describe_path "$real" 2>/dev/null)" || die 'java-owner'
  uid="${desc#* }"
  uid="${uid%% *}"
  [ "$uid" = "$OWNER_UID" ] || die 'java-owner'
  # The original tools/jdk name is an optional alias. Accept that one link
  # only: one readlink step must land on the pinned Home. Other directory,
  # socket, scratch, credential, and receipt checks still reject symlinks.
  # The bin/java leaf may still resolve to a file inside this pin.
  [ -L "$JAVA_ALIAS" ] || die 'java-alias'
  resolved="$(resolve_alias "$JAVA_ALIAS" 2>/dev/null)" || die 'java-alias'
  [ "$resolved" = "$JAVA_HOME_PIN" ] || die 'java-alias'
  require_owned_dir "$resolved"
  [ -x "$resolved/bin/java" ] || die 'java-missing'
}

require_docker_socket() {
  local context endpoint sock desc kind uid gid mode owner group other
  [ -z "${DOCKER_CONTEXT:-}" ] || [ "$DOCKER_CONTEXT" = 'desktop-linux' ] || die 'docker-context'
  context="$(docker context show 2>/dev/null || true)"
  [ "$context" = 'desktop-linux' ] || die 'docker-context'
  endpoint="$(docker context inspect desktop-linux --format '{{.Endpoints.docker.Host}}' 2>/dev/null || true)"
  case "$endpoint" in
    unix:///LOCAL_HANDOFF_HOME/.docker/*) ;;
    *) die 'docker-endpoint' ;;
  esac
  [ -z "${DOCKER_HOST:-}" ] || [ "$DOCKER_HOST" = "$endpoint" ] || die 'docker-host'
  case "${DOCKER_HOST:-unix}" in
    unix*) ;;
    *) die 'docker-host' ;;
  esac
  sock="${endpoint#unix://}"
  [ ! -L "$sock" ] || die 'docker-socket-symlink'
  [ -S "$sock" ] || die 'docker-socket'
  [ "$(canon_path "$sock")" = "$sock" ] || die 'docker-socket-canon'
  case "$sock" in
    /LOCAL_HANDOFF_HOME/.docker/*) ;;
    *) die 'docker-socket-path' ;;
  esac
  desc="$(describe_path "$sock" 2>/dev/null)" || die 'docker-socket-stat'
  kind="${desc%% *}"
  desc="${desc#* }"
  uid="${desc%% *}"
  desc="${desc#* }"
  gid="${desc%% *}"
  mode="${desc#* }"
  [ "$kind" = 'socket' ] || die 'docker-socket-type'
  [ "$uid" = "$OWNER_UID" ] || die 'docker-socket-owner'
  case "$mode" in
    [0-7][0-7][0-7]) ;;
    *) die 'docker-socket-mode' ;;
  esac
  owner="$(mode_owner "$mode")"
  group="$(mode_group "$mode")"
  other="$(mode_other "$mode")"
  if ! writable_digit "$owner"; then
    die 'docker-socket-mode'
  fi
  if writable_digit "$other"; then
    die 'docker-socket-mode'
  fi
  if writable_digit "$group"; then
    [ "$gid" = "$(id -g)" ] || die 'docker-socket-group'
  fi
  return 0
}

require_scratch_private() {
  local path="$1" real desc kind uid mode
  [ -n "$path" ] || die 'scratch-missing'
  case "$path" in
    "$PREFIX"/scratch.*) ;;
    *) die 'scratch-path' ;;
  esac
  [ ! -L "$path" ] || die 'scratch-symlink'
  [ -d "$path" ] || die 'scratch-missing'
  real="$(canon_path "$path")"
  case "$real" in
    "$PREFIX"/scratch.*|"$PRIVATE_PREFIX"/scratch.*) ;;
    *) die 'scratch-canon' ;;
  esac
  desc="$(describe_path "$path" 2>/dev/null)" || die 'scratch-stat'
  kind="${desc%% *}"
  desc="${desc#* }"
  uid="${desc%% *}"
  desc="${desc#* }"
  desc="${desc#* }"
  mode="$desc"
  [ "$kind" = 'dir' ] || die 'scratch-type'
  [ "$uid" = "$OWNER_UID" ] || die 'scratch-owner'
  [ "$mode" = '700' ] || die 'scratch-mode'
  if writable_digit "$(mode_group "$mode")" || writable_digit "$(mode_other "$mode")"; then
    die 'scratch-mode'
  fi
}

require_ephemeral_credential() {
  local path="$1" real scratch_real desc kind uid mode
  [ -n "$qa_scratch" ] || die 'credential-path'
  case "$path" in
    "$qa_scratch"/mysql.env) ;;
    *) die 'credential-path' ;;
  esac
  [ ! -L "$path" ] || die 'credential-symlink'
  [ -f "$path" ] || die 'credential-missing'
  real="$(canon_path "$path")"
  scratch_real="$(canon_path "$qa_scratch")"
  case "$real" in
    "$scratch_real"/mysql.env) ;;
    *) die 'credential-canon' ;;
  esac
  case "$real" in
    "$PREFIX"/scratch.*/mysql.env|"$PRIVATE_PREFIX"/scratch.*/mysql.env) ;;
    *) die 'credential-canon' ;;
  esac
  desc="$(describe_path "$path" 2>/dev/null)" || die 'credential-mode'
  kind="${desc%% *}"
  desc="${desc#* }"
  uid="${desc%% *}"
  desc="${desc#* }"
  desc="${desc#* }"
  mode="$desc"
  [ "$kind" = 'file' ] || die 'credential-mode'
  [ "$uid" = "$OWNER_UID" ] || die 'credential-owner'
  [ "$mode" = '600' ] || die 'credential-mode'
  [ "$(mode_group "$mode")" = '0' ] && [ "$(mode_other "$mode")" = '0' ] || die 'credential-mode'
}

require_supervisor() {
  local script_path
  [ "$UID" -eq "$OWNER_UID" ] || die 'uid'
  [ "$EUID" -eq "$OWNER_UID" ] || die 'uid'
  [ "$UID" -ne 0 ] || die 'unix-root-rejected'
  [ "$EUID" -ne 0 ] || die 'unix-root-rejected'
  [ "$(id -u)" -eq "$OWNER_UID" ] || die 'uid'
  [ "$(id -un)" = "$OWNER_USER" ] || die 'user'
  [ -z "${SUDO_UID:-}${SUDO_USER:-}${SUDO_GID:-}${SUDO_COMMAND:-}" ] || die 'sudo'
  [ "${HOME:-}" = "$OWNER_HOME" ] || die 'home'
  case "$0" in
    "$PREFIX"/device-others-runtime.sh) script_path="$0" ;;
    *) die 'script-path' ;;
  esac
  command -v node >/dev/null 2>&1 || die 'node-missing'
  command -v docker >/dev/null 2>&1 || die 'docker-missing'
  command -v perl >/dev/null 2>&1 || die 'perl-missing'
  command -v openssl >/dev/null 2>&1 || die 'openssl-missing'
  command -v lsof >/dev/null 2>&1 || die 'lsof-missing'
  command -v shasum >/dev/null 2>&1 || die 'shasum-missing'
  require_private_prefix
  require_prefix_file "$script_path"
  require_owned_dir "$OWNER_HOME"
  require_owned_dir "$OWNER_HOME/.docker"
  # Client metadata at ~/.docker/config.json is not this lease's secret.
  # Preflight does not stat, read, chmod, or copy it. Registry auth is unused.
  require_docker_socket
  require_owned_dir "$RESUME"
  require_owned_dir "$G318"
  require_owned_dir "$DEVICE_HARNESS"
  require_owned_dir "$CONSENT_HARNESS"
  require_owned_dir "$REPO"
  require_owned_dir "$PLAYWRIGHT_ROOT"
  require_java
  require_owned_file "$G331"
  require_owned_file "$G318/acceptance.mjs"
  require_owned_file "$G318/browser-probe.cjs"
  require_owned_file "$G318/observe-auth.cjs"
  require_owned_file "$B116_INDEX"
  require_owned_file "$DEVICE_HARNESS/browser-probe.cjs"
  require_owned_file "$DEVICE_HARNESS/acceptance.mjs"
  require_owned_file "$DEVICE_HARNESS/seed/Seed.java"
  require_owned_file "$DEVICE_HARNESS/sql/seed-full.sql"
  require_owned_file "$DEVICE_HARNESS/sql/seed-partial.sql"
  require_owned_file "$DEVICE_HARNESS/sql/cleanup-fixtures.sql"
  require_owned_file "$CONSENT_HARNESS/seed/Seed.java"
  require_owned_file "$CONSENT_HARNESS/sql/seed-full.sql"
  require_owned_file "$CONSENT_HARNESS/sql/seed-partial.sql"
  require_owned_file "$CONSENT_HARNESS/sql/cleanup-fixtures.sql"
  require_owned_file "$REPO/AGENTS.md"
  require_owned_file "$REPO/apps/mobile/tests/fixtures/mock-consent-publication.json"
  [ -d "$PLAYWRIGHT_ROOT/node_modules/playwright" ] || die 'playwright-missing'
}

prepare_output() {
  local path="$1" desc uid
  case "$path" in
    "$PREFIX"/preflight.json|"$PREFIX"/instrument-result.json|"$PREFIX"/receipt.json) ;;
    *) die 'receipt-path' ;;
  esac
  if [ -L "$path" ]; then
    die 'receipt-symlink'
  fi
  if [ -e "$path" ]; then
    [ -f "$path" ] || die 'receipt-type'
    desc="$(describe_path "$path" 2>/dev/null)" || die 'receipt-stat'
    uid="${desc#* }"
    uid="${uid%% *}"
    [ "$uid" = "$OWNER_UID" ] || die 'receipt-owner'
  fi
}

sha256_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

require_sha() {
  local file="$1" expected="$2" actual
  [ -f "$file" ] || die "missing:$file"
  actual="$(sha256_file "$file")"
  [ "$actual" = "$expected" ] || die "hash:$file"
}

same_file() {
  local left="$1" right="$2"
  [ -f "$left" ] && [ -f "$right" ] || die "fixture-missing:$(basename "$left")"
  [ "$(sha256_file "$left")" = "$(sha256_file "$right")" ] || die "fixture-mismatch:$(basename "$left")"
}

port_busy() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

ports_clear() {
  local port
  [ "${#PORTS[@]}" -eq 4 ] || die 'ports'
  [ "${PORTS[0]}" = '13306' ] && [ "${PORTS[1]}" = '18070' ] && [ "${PORTS[2]}" = '18087' ] && [ "${PORTS[3]}" = '18183' ] || die 'ports'
  for port in "${PORTS[@]}"; do
    if port_busy "$port"; then
      return 1
    fi
  done
  return 0
}

assert_loopback_ports() {
  local port lines line
  for port in "${PORTS[@]}"; do
    lines="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    [ -n "$lines" ] || continue
    while IFS= read -r line; do
      case "$line" in
        *":${port}"*) ;;
        *) continue ;;
      esac
      case "$line" in
        *'0.0.0.0:'*|*'[::]:'*|*'*:'"$port"*) die "port-origin:${port}" ;;
      esac
      case "$line" in
        *'127.0.0.1:'"$port"*) ;;
        *) die "port-origin:${port}" ;;
      esac
    done <<< "$lines"
  done
}

require_fixtures() {
  local pair
  for pair in seed-full.sql seed-partial.sql; do
    same_file "$DEVICE_HARNESS/sql/$pair" "$CONSENT_HARNESS/sql/$pair"
    grep -q 'NOT_RUNTIME_VERIFIED' "$DEVICE_HARNESS/sql/$pair" || die "fixture-status:$pair"
  done
  same_file "$DEVICE_HARNESS/sql/cleanup-fixtures.sql" "$CONSENT_HARNESS/sql/cleanup-fixtures.sql"
  if grep -q 'NOT_RUNTIME_VERIFIED' "$DEVICE_HARNESS/sql/cleanup-fixtures.sql"; then
    die 'fixture-status:cleanup-fixtures.sql'
  fi
  grep -q 'DELETE FROM iam_consent_document_version' "$DEVICE_HARNESS/sql/cleanup-fixtures.sql" || die 'fixture-cleanup-shape'
  same_file "$DEVICE_HARNESS/seed/Seed.java" "$CONSENT_HARNESS/seed/Seed.java"
}

read_prior_snapshot() {
  node - "$PRIOR_OUT" "$G331_SHA" "$G331_REPORT_SHA" "$OWNER_UID" <<'NODE'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const dir = process.argv[2]
const sourceSha = process.argv[3]
const reportSha = process.argv[4]
const owner = process.argv[5]
const hex = /^[0-9a-f]{64}$/
function fail(reason) {
  process.stdout.write('ERR ' + reason)
  process.exit(0)
}
if (!hex.test(sourceSha) || !hex.test(reportSha) || owner !== '502') fail('prior-snapshot')
function writableDigit(ch) {
  return ch === '2' || ch === '3' || ch === '6' || ch === '7'
}
function modeText(mode) {
  return (mode & 511n).toString(8).padStart(3, '0')
}
function rejectShared(mode) {
  const text = modeText(mode)
  if (writableDigit(text[1]) || writableDigit(text[2])) fail('prior-mode')
  return text
}
let dirStat
try { dirStat = fs.lstatSync(dir, { bigint: true }) } catch (error) { fail('prior-stat') }
if (dirStat.isSymbolicLink()) fail('prior-symlink')
if (!dirStat.isDirectory()) fail('prior-type')
if (String(dirStat.uid) !== owner) fail('prior-owner')
const dirMode = rejectShared(dirStat.mode)
let realDir
try { realDir = fs.realpathSync(dir) } catch (error) { fail('prior-canon') }
if (realDir !== dir && realDir !== '/private' + dir) fail('prior-canon')
let names
try { names = fs.readdirSync(dir) } catch (error) { fail('prior-stat') }
const allowed = { 'device-others-owner.cjs': true, 'REPORT.md': true, 'result.json': true }
for (const name of names) {
  if (!allowed[name]) fail('prior-entry')
}
if (!names.includes('device-others-owner.cjs') || !names.includes('REPORT.md')) fail('prior-entry')
const hasResult = names.includes('result.json')
if (names.length !== (hasResult ? 3 : 2)) fail('prior-entry')
function describeFile(name, expectSha) {
  const file = dir + '/' + name
  let st
  try { st = fs.lstatSync(file, { bigint: true }) } catch (error) { fail('prior-stat') }
  if (st.isSymbolicLink()) fail('prior-symlink')
  if (!st.isFile()) fail('prior-type')
  if (String(st.uid) !== owner) fail('prior-owner')
  const text = rejectShared(st.mode)
  let real
  try { real = fs.realpathSync(file) } catch (error) { fail('prior-canon') }
  if (real !== path.resolve(realDir, name)) fail('prior-canon')
  let bytes
  try { bytes = fs.readFileSync(file) } catch (error) { fail('prior-stat') }
  const sha = crypto.createHash('sha256').update(bytes).digest('hex')
  if (expectSha && sha !== expectSha) fail('prior-hash')
  return [name, String(st.uid), String(st.gid), text, st.size.toString(), sha, st.mtimeNs.toString(), st.ino.toString(), st.nlink.toString()].join(':')
}
const source = describeFile('device-others-owner.cjs', sourceSha)
const report = describeFile('REPORT.md', reportSha)
const result = hasResult ? ('present:' + describeFile('result.json', '')) : 'absent'
const dirPart = ['dir', String(dirStat.uid), String(dirStat.gid), dirMode, dirStat.mtimeNs.toString(), dirStat.ino.toString(), dirStat.nlink.toString()].join(':')
process.stdout.write('OK ' + [dirPart, 'file:' + source, 'file:' + report, 'result:' + result].join('|'))
NODE
}

capture_prior_snapshot() {
  local real raw result_part
  [ ! -L "$PRIOR_OUT" ] || die 'prior-symlink'
  [ -d "$PRIOR_OUT" ] || die 'prior-missing'
  real="$(canon_path "$PRIOR_OUT")"
  [ "$real" = "$PRIOR_OUT" ] || [ "$real" = "$PRIOR_PRIVATE" ] || die 'prior-canon'
  require_owned_file "$G331_REPORT"
  require_sha "$G331" "$G331_SHA"
  require_sha "$G331_REPORT" "$G331_REPORT_SHA"
  raw="$(read_prior_snapshot)" || die 'prior-snapshot'
  case "$raw" in
    'OK '*) qa_prior_snapshot="${raw#OK }" ;;
    'ERR '*) die "${raw#ERR }" ;;
    *) die 'prior-snapshot' ;;
  esac
  [ -n "$qa_prior_snapshot" ] || die 'prior-snapshot'
  case "$qa_prior_snapshot" in
    *'|result:absent')
      qa_prior_result='absent'
      qa_prior_result_sha=''
      ;;
    *'|result:present:'*)
      qa_prior_result='unchanged'
      result_part="${qa_prior_snapshot##*|result:present:}"
      qa_prior_result_sha="$(printf '%s' "$result_part" | awk -F: 'NF >= 6 { print $6; exit }')"
      printf '%s' "$qa_prior_result_sha" | grep -q '^[0-9a-f]\{64\}$' || die 'prior-snapshot'
      ;;
    *) die 'prior-snapshot' ;;
  esac
}

preflight() {
  local image
  require_sha "$G331" "$G331_SHA"
  require_sha "$G318/acceptance.mjs" "$G318_ACCEPTANCE_SHA"
  require_sha "$G318/browser-probe.cjs" "$G318_PROBE_SHA"
  require_sha "$G318/observe-auth.cjs" "$G318_OBSERVE_SHA"
  require_sha "$B116_INDEX" "$B116_SHA"
  require_sha "$DEVICE_HARNESS/browser-probe.cjs" "$DEVICE_PROBE_SHA"
  require_sha "$DEVICE_HARNESS/acceptance.mjs" "$DEVICE_HTTP_SHA"
  require_fixtures
  image="$(docker image inspect -f '{{.Id}}' mysql:8.0 2>/dev/null || true)"
  [ "$image" = "$MYSQL_IMAGE" ] || die 'mysql-image'
  ports_clear || die 'port-busy'
  capture_prior_snapshot
  [ -z "$(docker ps -aq --filter "label=cloudstudy.qa.scope=$qa_label")" ] || die 'label-present'
  if docker inspect "$qa_name" >/dev/null 2>&1; then
    die 'name-present'
  fi
}

assert_private_db() {
  node - "$qa_cid" <<'NODE'
const {execFileSync} = require('child_process')
const cid = process.argv[2]
function inspect(template) {
  return execFileSync('docker', ['inspect', '-f', template, cid], {encoding: 'utf8'}).trim()
}
if (inspect('{{.Name}}') !== '/' + process.env.QA_NAME) process.exit(2)
if (inspect('{{.HostConfig.Privileged}}') !== 'false') process.exit(2)
if (inspect('{{.HostConfig.NetworkMode}}') === 'host') process.exit(2)
if (inspect('{{.HostConfig.PidMode}}') === 'host') process.exit(2)
const binds = inspect('{{json .HostConfig.Binds}}')
if (binds !== 'null' && binds !== '[]') process.exit(2)
const mounts = JSON.parse(inspect('{{json .Mounts}}'))
if (!Array.isArray(mounts) || mounts.some((row) => row && (row.Type === 'volume' || row.Type === 'bind'))) process.exit(2)
const tmpfs = JSON.parse(inspect('{{json .HostConfig.Tmpfs}}'))
if (!tmpfs || tmpfs['/var/lib/mysql'] !== 'rw,nosuid,size=512m') process.exit(2)
const published = JSON.parse(inspect('{{json .HostConfig.PortBindings}}'))
const binding = published && published['3306/tcp']
if (!Array.isArray(binding) || binding.length !== 1 || binding[0].HostIp !== '127.0.0.1' || binding[0].HostPort !== '13306') process.exit(2)
if (Object.keys(published).length !== 1) process.exit(2)
if (Number(inspect('{{.HostConfig.Memory}}')) !== 768 * 1024 * 1024) process.exit(2)
const label = inspect('{{index .Config.Labels "cloudstudy.qa.scope"}}')
if (label !== process.env.QA_LABEL) process.exit(2)
NODE
}

wait_mysql() {
  local attempt
  for attempt in $(seq 1 60); do
    if docker exec "$qa_cid" sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --protocol=TCP --host=127.0.0.1 --user="$MYSQL_USER" "$MYSQL_DATABASE" --batch --skip-column-names -e "SELECT 1"' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  die 'mysql-not-ready'
}

write_helpers() {
  cat > "$qa_scratch/lease-hook.cjs" <<'HOOK'
'use strict'
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const path = require('path')
const Module = require('module')
const {spawn} = require('child_process')
const PAGE_ORIGIN = 'http://127.0.0.1:18183'
const STATIC_HOST = '127.0.0.1:18183'
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
}
function asset(root, rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > 2048) return null
  if (rawUrl.includes('://') || rawUrl.startsWith('//')) return null
  let pathname = '/'
  try { pathname = new URL(rawUrl, PAGE_ORIGIN).pathname } catch { return null }
  let relative = '/'
  try { relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '') } catch { return null }
  if (!relative || relative.includes('\0') || relative.split('/').includes('..') || path.isAbsolute(relative)) return null
  const canonRoot = fs.realpathSync(root)
  const file = path.resolve(canonRoot, relative)
  if (!(file === path.join(canonRoot, 'index.html') || file.startsWith(canonRoot + path.sep))) return null
  let canon = file
  try {
    if (!fs.statSync(file).isFile()) return null
    canon = fs.realpathSync(file)
  } catch { return null }
  if (!(canon === path.join(canonRoot, 'index.html') || canon.startsWith(canonRoot + path.sep))) return null
  return canon
}
function headerFree(exported) {
  const open = async function openOwnedNonceStatic({artifactRoot, expectedIndexSha} = {}) {
    const root = exported.CANONICAL_H5_ROOT
    const sha = exported.CANONICAL_H5_SHA
    const denied = (reason, extra) => ({ok: false, reason, marker: '', indexMatch: false, expectedIndexSha256: sha, ...extra, async close() {}})
    if (artifactRoot !== root || expectedIndexSha !== sha) return denied('frozen-sha-not-canonical')
    let real
    try { real = fs.realpathSync(artifactRoot) } catch { return denied('frozen-root-unavailable') }
    if (real !== fs.realpathSync(root)) return denied('frozen-root-not-canonical')
    const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(real, 'index.html'))).digest('hex')
    if (digest !== sha) return denied('index-sha-mismatch', {indexSha256: digest, expectedIndexSha256: sha})
    const server = http.createServer((req, res) => {
      const host = req && req.headers ? req.headers.host : ''
      const origin = req && req.headers ? req.headers.origin : undefined
      const allowedOrigin = origin === undefined || origin === PAGE_ORIGIN
      if (!req || (req.method !== 'GET' && req.method !== 'HEAD') || host !== STATIC_HOST || !allowedOrigin) {
        res.writeHead(404, {'cache-control': 'no-store', 'content-length': '0', 'x-content-type-options': 'nosniff'})
        res.end()
        return
      }
      const file = asset(real, req.url || '/')
      if (!file) {
        res.writeHead(404, {'cache-control': 'no-store', 'content-length': '0', 'x-content-type-options': 'nosniff'})
        res.end()
        return
      }
      const body = fs.readFileSync(file)
      res.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'content-length': String(body.length),
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      })
      if (req.method === 'HEAD') res.end()
      else res.end(body)
    })
    server.requestTimeout = 15000
    server.headersTimeout = 5000
    server.keepAliveTimeout = 1000
    server.maxHeadersCount = 40
    server.on('connect', (_request, socket) => { socket.destroy() })
    server.on('upgrade', (_request, socket) => { socket.destroy() })
    let listenError = null
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen({host: '127.0.0.1', port: 18183, exclusive: true}, resolve)
    }).catch((error) => { listenError = error || new Error('static-listen-failed') })
    if (listenError) {
      const reason = listenError.code === 'EADDRINUSE' ? 'static-port-busy' : 'static-listen-failed'
      return denied(reason, {indexSha256: digest, indexMatch: true})
    }
    server.on('error', () => {})
    const addr = server.address()
    if (!server.listening || !addr || addr.address !== '127.0.0.1' || addr.port !== 18183) {
      await new Promise((resolve) => server.close(() => resolve()))
      return denied('static-listen-failed', {indexSha256: digest, indexMatch: true})
    }
    let closed = false
    return {
      ok: true,
      reason: null,
      marker: '',
      indexSha256: digest,
      expectedIndexSha256: sha,
      indexMatch: true,
      async close() {
        if (closed) return
        closed = true
        await new Promise((resolve) => server.close(() => resolve()))
      },
    }
  }
  open.g383 = true
  return open
}
function runInstrument(input) {
  const caPem = input && typeof input.caPem === 'string' ? input.caPem : ''
  const resultPath = process.env.MB383_INSTRUMENT_RESULT
  const redirect = process.env.MB383_REDIRECT
  const probe = process.env.MB383_PROBE
  const playwright = process.env.MB383_PLAYWRIGHT_ROOT
  if (!caPem || !path.isAbsolute(caPem) || !resultPath || !redirect || !probe || !playwright) {
    return {cases: {preflight: {status: 'BLOCKED', reason: 'instrument-env'}}}
  }
  const env = {...process.env}
  delete env.MB004_MYSQL_PASSWORD
  delete env.MB004_MYSQL_USER
  delete env.MB004_MYSQL_ROOT
  delete env.SUDO_UID
  delete env.SUDO_USER
  delete env.SUDO_GID
  delete env.SUDO_COMMAND
  env.NODE_OPTIONS = '--require ' + redirect
  env.MB025_OTHERS_H5 = 'YES_LOCAL_OTHERS_REVOKE'
  env.MB025_IAM_CA_FILE = caPem
  env.MB025_PLAYWRIGHT_ROOT = playwright
  env.MB383_INSTRUMENT_RESULT = resultPath
  return new Promise((resolve) => {
    let settled = false
    let timer = null
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({cases: {preflight: {status: 'SKIPPED', reason: 'device-others-instrument'}}})
    }
    const child = spawn(process.execPath, ['--unhandled-rejections=strict', probe], {
      env, cwd: path.dirname(redirect), stdio: 'ignore',
    })
    timer = setTimeout(() => {
      child.kill('SIGTERM')
      const killer = setTimeout(() => child.kill('SIGKILL'), 2000)
      if (typeof killer.unref === 'function') killer.unref()
    }, 240000)
    child.on('close', finish)
    child.on('error', finish)
  })
}
runInstrument.g383 = true
const original = Module._load
Module._load = function load(request, parent, isMain) {
  const loaded = original.apply(this, arguments)
  let filename = ''
  try { filename = Module._resolveFilename(request, parent, isMain) } catch { return loaded }
  if (filename.endsWith('/browser-probe.cjs') && loaded && typeof loaded.openOwnedNonceStatic === 'function' && !loaded.openOwnedNonceStatic.g383) {
    loaded.openOwnedNonceStatic = headerFree(loaded)
  }
  if (filename.endsWith('/observe-auth.cjs') && loaded && typeof loaded.observeAuth === 'function' && !loaded.observeAuth.g383) {
    loaded.observeAuth = runInstrument
  }
  return loaded
}
HOOK
  cat > "$qa_scratch/redirect-result.cjs" <<'REDIRECT'
'use strict'
const fs = require('fs')
const path = require('path')
const blockedDir = '/tmp/grok-mobile-device-others-revoke-h5-probe-331'
const blockedPrivate = '/private/tmp/grok-mobile-device-others-revoke-h5-probe-331'
const blockedFile = blockedDir + '/result.json'
const prefix = '/tmp/grok-mobile-device-guard-source-directory-383'
const privatePrefix = '/private/tmp/grok-mobile-device-guard-source-directory-383'
function priorPath(file) {
  if (typeof file !== 'string' || file.length === 0) return false
  const resolved = path.resolve(file)
  if (resolved === blockedDir || resolved.startsWith(blockedDir + path.sep)) return true
  if (resolved === blockedPrivate || resolved.startsWith(blockedPrivate + path.sep)) return true
  return false
}
function writeRedirect(data) {
  const target = process.env.MB383_INSTRUMENT_RESULT
  if (typeof target !== 'string' || path.resolve(target) !== prefix + '/instrument-result.json') {
    throw new Error('instrument-result-prefix')
  }
  const realPrefix = fs.realpathSync(prefix)
  if (realPrefix !== prefix && realPrefix !== privatePrefix) throw new Error('instrument-result-prefix')
  if (fs.realpathSync(path.dirname(path.resolve(target))) !== realPrefix) throw new Error('instrument-result-prefix')
  if (fs.existsSync(target)) {
    const st = fs.lstatSync(target)
    if (!st.isFile() || st.isSymbolicLink()) throw new Error('instrument-result-symlink')
  }
  let flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC
  if (typeof fs.constants.O_NOFOLLOW === 'number') flags |= fs.constants.O_NOFOLLOW
  const fd = openSync(target, flags, 0o600)
  try {
    writeFileSync.call(fs, fd, data)
    fs.fchmodSync(fd, 0o600)
  } finally {
    fs.closeSync(fd)
  }
}
const mkdirSync = fs.mkdirSync
fs.mkdirSync = function redirectMkdir(dir, options) {
  const resolved = path.resolve(String(dir))
  if (resolved === blockedDir) {
    let existing = null
    try { existing = fs.lstatSync(blockedDir) } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error
    }
    if (existing && (existing.isSymbolicLink() || !existing.isDirectory())) throw new Error('prior-dir')
    return undefined
  }
  if (priorPath(resolved)) throw new Error('prior-dir')
  return mkdirSync.call(fs, dir, options)
}
const writeFileSync = fs.writeFileSync
const openSync = fs.openSync
fs.writeFileSync = function redirectWrite(file, data, options) {
  if (typeof file === 'number') return writeFileSync.call(fs, file, data, options)
  const resolved = path.resolve(String(file))
  if (resolved === blockedFile) {
    let existing = null
    try { existing = fs.lstatSync(blockedFile) } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error
    }
    if (existing && (existing.isSymbolicLink() || !existing.isFile())) throw new Error('prior-dir')
    writeRedirect(data)
    return
  }
  if (priorPath(resolved)) throw new Error('prior-dir')
  return writeFileSync.call(fs, file, data, options)
}
function wrap(owner, name, indexes) {
  const original = owner[name]
  if (typeof original !== 'function') return
  owner[name] = function guarded() {
    for (let i = 0; i < indexes.length; i += 1) {
      const value = arguments[indexes[i]]
      if (typeof value === 'string' && priorPath(value)) throw new Error('prior-dir')
    }
    return original.apply(owner, arguments)
  }
}
wrap(fs, 'appendFileSync', [0])
wrap(fs, 'copyFileSync', [0, 1])
wrap(fs, 'renameSync', [0, 1])
wrap(fs, 'linkSync', [0, 1])
wrap(fs, 'symlinkSync', [0, 1])
wrap(fs, 'unlinkSync', [0])
wrap(fs, 'rmSync', [0])
wrap(fs, 'chmodSync', [0])
wrap(fs, 'chownSync', [0])
wrap(fs, 'truncateSync', [0])
wrap(fs, 'openSync', [0])
wrap(fs, 'appendFile', [0])
wrap(fs, 'copyFile', [0, 1])
wrap(fs, 'rename', [0, 1])
wrap(fs, 'rm', [0])
wrap(fs, 'unlink', [0])
wrap(fs, 'chmod', [0])
wrap(fs, 'chown', [0])
wrap(fs, 'truncate', [0])
wrap(fs, 'open', [0])
wrap(fs, 'mkdir', [0])
wrap(fs, 'writeFile', [0])
if (fs.promises) {
  wrap(fs.promises, 'mkdir', [0])
  wrap(fs.promises, 'writeFile', [0])
  wrap(fs.promises, 'appendFile', [0])
  wrap(fs.promises, 'copyFile', [0, 1])
  wrap(fs.promises, 'rename', [0, 1])
  wrap(fs.promises, 'rm', [0])
  wrap(fs.promises, 'unlink', [0])
  wrap(fs.promises, 'chmod', [0])
  wrap(fs.promises, 'chown', [0])
  wrap(fs.promises, 'truncate', [0])
  wrap(fs.promises, 'open', [0])
  wrap(fs.promises, 'symlink', [0, 1])
  wrap(fs.promises, 'link', [0, 1])
}
REDIRECT
}

count_rows() {
  # The image's disposable database account is selected inside the container.
  # That account is not the Unix supervisor.
  docker exec "$qa_cid" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot --batch --skip-column-names -e "SELECT CONCAT((SELECT COUNT(*) FROM iam_service.iam_account),\" \",(SELECT COUNT(*) FROM iam_service.iam_session),\" \",(SELECT COUNT(*) FROM iam_service.iam_device),\" \",(SELECT COUNT(*) FROM iam_service.iam_consent_document_version),\" \",(SELECT COUNT(*) FROM iam_service.iam_consent_document_version WHERE runtime_status='\''NOT_RUNTIME_VERIFIED'\''));"' 2>"$qa_scratch/counts.err" || true
}

stop_node_group() {
  [ -n "$qa_node" ] || return 0
  kill -0 "$qa_node" 2>/dev/null || return 0
  kill -TERM -- -"$qa_node" 2>/dev/null || kill -TERM "$qa_node" 2>/dev/null || true
  sleep 2
  kill -KILL -- -"$qa_node" 2>/dev/null || kill -KILL "$qa_node" 2>/dev/null || true
}

remove_scratch() {
  local scratch_real
  [ -n "$qa_scratch" ] || return 0
  case "$qa_scratch" in
    "$PREFIX"/scratch.*) ;;
    *) return 0 ;;
  esac
  [ ! -L "$qa_scratch" ] || return 0
  [ -d "$qa_scratch" ] || return 0
  scratch_real="$(canon_path "$qa_scratch" 2>/dev/null || true)"
  case "$scratch_real" in
    "$PREFIX"/scratch.*|"$PRIVATE_PREFIX"/scratch.*) rm -rf -- "$qa_scratch" || true ;;
  esac
}

cleanup() {
  local result=$? actual name
  trap - EXIT
  set +e
  stop_node_group
  if [ -n "$qa_cid" ]; then
    actual="$(docker inspect -f '{{index .Config.Labels "cloudstudy.qa.scope"}}' "$qa_cid" 2>/dev/null || true)"
    name="$(docker inspect -f '{{.Name}}' "$qa_cid" 2>/dev/null || true)"
    if [ "$actual" = "$qa_label" ] && [ "$name" = "/$qa_name" ]; then
      docker stop --time 8 "$qa_cid" >/dev/null 2>&1 || true
    fi
  fi
  qa_password=''
  qa_mysql_admin_password=''
  remove_scratch
  exit "$result"
}

write_preflight_note() {
  node - "$PREFIX/preflight.json" "$qa_suffix" "$qa_label" "$qa_name" "$qa_prior_result" "$qa_prior_result_sha" <<'NODE'
const fs = require('fs')
const path = require('path')
function writePrivate(file, text) {
  const prefix = '/tmp/grok-mobile-device-guard-source-directory-383'
  const privatePrefix = '/private/tmp/grok-mobile-device-guard-source-directory-383'
  if (path.resolve(file) !== file || !file.startsWith(prefix + '/')) throw new Error('receipt-prefix')
  const realPrefix = fs.realpathSync(prefix)
  if (realPrefix !== prefix && realPrefix !== privatePrefix) throw new Error('receipt-prefix')
  if (fs.realpathSync(path.dirname(file)) !== realPrefix) throw new Error('receipt-prefix')
  if (fs.existsSync(file)) {
    const st = fs.lstatSync(file)
    if (!st.isFile() || st.isSymbolicLink()) throw new Error('receipt-symlink')
  }
  let flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC
  if (typeof fs.constants.O_NOFOLLOW === 'number') flags |= fs.constants.O_NOFOLLOW
  const fd = fs.openSync(file, flags, 0o600)
  try {
    fs.writeFileSync(fd, text)
    fs.fchmodSync(fd, 0o600)
  } finally {
    fs.closeSync(fd)
  }
}
const priorResult = process.argv[6]
const priorResultSha = process.argv[7] || ''
if (priorResult !== 'absent' && priorResult !== 'unchanged') throw new Error('prior-snapshot')
if (priorResult === 'absent' && priorResultSha !== '') throw new Error('prior-snapshot')
if (priorResult === 'unchanged' && !/^[0-9a-f]{64}$/.test(priorResultSha)) throw new Error('prior-snapshot')
const body = {
  status: 'CLEAN',
  executed: false,
  supervisor: {process: 'device-others-runtime', user: 'Admin', uid: 502, unixRoot: false, sudo: false},
  prefix: '/tmp/grok-mobile-device-guard-source-directory-383',
  suffix: process.argv[3] || null,
  label: process.argv[4] || null,
  containerName: process.argv[5] || null,
  labelPrefix: 'cloudstudy.qa.mobile-device-guard-source-directory-383-',
  ports: ['127.0.0.1:13306', '127.0.0.1:18070', '127.0.0.1:18087', '127.0.0.1:18183'],
  mysqlImage: 'sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b',
  b116IndexSha256: '94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520',
  g331Sha256: '704943be048fda4933327ca91e6870b08eb8fa70557ff3d0908c0591aa4ba6af',
  g331ReportSha256: '527843fef5fa89868d1ac4e8d99f7c4a9f77e1654dfa0aa3a214eb389186d795',
  g318AcceptanceSha256: '9e72c956715e907fc9720af09dcbd3cf9c0e2633ef84c1ed3827f65e9254e1d5',
  g318ProbeSha256: '06e718d5905354b736509fc4876f35c51ff39e5b47f9674d769aff82c84577bb',
  g318ObserveSha256: 'fee4072c7e4300b3ed79b90d71d1c150131f1400e3040358f5e03c82bb8b99b9',
  b78BrowserProbeSha256: 'dad7f0dbbae75f9fdb2dc73c666b9420f03632ca84afff2554d92d144e281a41',
  b78HttpHarnessSha256: '091ecd308bf68ac31c5a874abe6bd9f9e86b9690084df7e06c9814767bd6ae91',
  fixtureRuntimeStatus: 'NOT_RUNTIME_VERIFIED',
  cleanupSqlCarriesRuntimeStatus: false,
  dockerContext: 'desktop-linux',
  dockerUserConfig: 'not-consulted',
  registryAuth: false,
  imagePull: 'never',
  credentialGuard: 'admin-socket-and-ephemeral-mysql-env',
  priorDirectory: 'historical-two-file',
  priorResult,
  priorResultSha256: priorResult === 'unchanged' ? priorResultSha : null,
  priorCleanup: 'not-deleted',
  volumeDeletion: false,
  packageChange: false,
  gitInvocation: false,
  sudo: false,
}
writePrivate(process.argv[2], JSON.stringify(body, null, 2) + '\n')
NODE
}

evaluate() {
  node - "$PREFIX/instrument-result.json" "$qa_scratch/acceptance-result.json" "$qa_scratch/counts.txt" "$PREFIX/receipt.json" "$qa_timed_out" "$qa_node_status" "$qa_prior_leak" "$qa_label" "$qa_name" "$qa_prior_result" "$qa_prior_result_sha" <<'NODE'
const fs = require('fs')
const path = require('path')
const instrumentPath = process.argv[2]
const acceptancePath = process.argv[3]
const countsPath = process.argv[4]
const receiptPath = process.argv[5]
const timedOut = process.argv[6] === '1'
const nodeStatus = Number(process.argv[7])
const priorLeak = process.argv[8] === '1'
const label = process.argv[9]
const containerName = process.argv[10]
const priorResult = process.argv[11]
const priorResultSha = process.argv[12] || ''
if (priorResult !== 'absent' && priorResult !== 'unchanged') {
  process.stderr.write('prior-snapshot\n')
  process.exit(2)
}
if (priorResult === 'absent' && priorResultSha !== '') {
  process.stderr.write('prior-snapshot\n')
  process.exit(2)
}
if (priorResult === 'unchanged' && !/^[0-9a-f]{64}$/.test(priorResultSha)) {
  process.stderr.write('prior-snapshot\n')
  process.exit(2)
}
const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
const supervisor = {process: 'device-others-runtime', user: 'Admin', uid: 502, unixRoot: false, sudo: false}
function writePrivate(file, text) {
  const prefix = '/tmp/grok-mobile-device-guard-source-directory-383'
  const privatePrefix = '/private/tmp/grok-mobile-device-guard-source-directory-383'
  if (path.resolve(file) !== file || !file.startsWith(prefix + '/')) throw new Error('receipt-prefix')
  const realPrefix = fs.realpathSync(prefix)
  if (realPrefix !== prefix && realPrefix !== privatePrefix) throw new Error('receipt-prefix')
  if (fs.realpathSync(path.dirname(file)) !== realPrefix) throw new Error('receipt-prefix')
  if (fs.existsSync(file)) {
    const st = fs.lstatSync(file)
    if (!st.isFile() || st.isSymbolicLink()) throw new Error('receipt-symlink')
  }
  let flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC
  if (typeof fs.constants.O_NOFOLLOW === 'number') flags |= fs.constants.O_NOFOLLOW
  const fd = fs.openSync(file, flags, 0o600)
  try {
    fs.writeFileSync(fd, text)
    fs.fchmodSync(fd, 0o600)
  } finally {
    fs.closeSync(fd)
  }
}
function fail(reason, extra) {
  const receipt = {
    status: 'FAIL', reason, timedOut, nodeStatus, priorLeak, supervisor, label, containerName,
    prefix: '/tmp/grok-mobile-device-guard-source-directory-383',
    dockerUserConfig: 'not-consulted', registryAuth: false, imagePull: 'never',
    credentialGuard: 'admin-socket-and-ephemeral-mysql-env',
    priorDirectory: 'historical-two-file',
    priorResult,
    priorResultSha256: priorResult === 'unchanged' ? priorResultSha : null,
    priorUnchanged: !priorLeak,
    priorCleanup: 'not-deleted',
    ...extra,
  }
  writePrivate(receiptPath, JSON.stringify(receipt, null, 2) + '\n')
  process.exit(1)
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}
if (priorLeak) fail('prior-output-created')
if (!fs.existsSync(instrumentPath)) fail('instrument-result-absent')
const raw = fs.readFileSync(instrumentPath, 'utf8')
if (uuid.test(raw) || /eyJ[A-Za-z0-9_-]{10,}/.test(raw) || /@/.test(raw) || /bearer\s/i.test(raw)) fail('instrument-private-data')
const instrument = readJson(instrumentPath)
const acceptance = readJson(acceptancePath)
if (!instrument || !acceptance) fail('result-unreadable')
const counts = acceptance.counts && typeof acceptance.counts === 'object' ? acceptance.counts : {}
const seed = acceptance.runtime && acceptance.runtime.seed && typeof acceptance.runtime.seed === 'object' ? acceptance.runtime.seed : {}
const ui = instrument.browser && instrument.browser.ui ? instrument.browser.ui : {}
const api = instrument.browser && instrument.browser.api ? instrument.browser.api : {}
const before = instrument.ownerBefore && typeof instrument.ownerBefore === 'object' ? instrument.ownerBefore : {}
const after = instrument.ownerAfter && typeof instrument.ownerAfter === 'object' ? instrument.ownerAfter : {}
const fixture = instrument.fixture && typeof instrument.fixture === 'object' ? instrument.fixture : {}
const statuses = Array.isArray(api.kickoutStatuses) ? api.kickoutStatuses : []
const refreshes = Array.isArray(instrument.oldRefreshStatuses) ? instrument.oldRefreshStatuses : []
let sql = null
if (fs.existsSync(countsPath)) {
  const parts = fs.readFileSync(countsPath, 'utf8').trim().split(/\s+/).map(Number)
  if (parts.length === 5 && parts.every((value) => Number.isInteger(value) && value >= 0)) {
    sql = {accounts: parts[0], sessions: parts[1], devices: parts[2], consentRows: parts[3], notRuntimeVerified: parts[4]}
  }
}
const wire = instrument.status === 'OBSERVED'
  && ui.mode === 'bulk'
  && ui.bulkClicks === 1
  && ui.confirmClicks === 1
  && ui.rowExitClicks === 0
  && ui.cancelClicks === 0
  && ui.exactBeforeClick === true
  && ui.dialogMatched === true
  && ui.currentExitBefore === 0
  && ui.otherExitBefore === 2
  && ui.successAfterReadback === true
  && ui.successBeforeReadback !== true
  && ui.currentTaggedAfter === true
  && ui.revokedTagsAfter === 2
  && ui.ctaDisabledAfter === true
  && api.loginPosts === 1
  && api.kickoutPosts === 2
  && api.kickoutPathsExact === true
  && api.idempotencyKeysNonempty === true
  && statuses.length === 2
  && statuses.every((status) => status === 200)
  && api.deviceGetsBefore >= 1
  && api.deviceGetsAfterKicks >= 1
  && api.refreshPostsInBrowser === 0
  && api.logoutAborts === 0
  && api.currentKickoutAborts === 0
  && api.ownerKickoutAborts === 0
  && api.unexpectedAborts === 0
  && api.syntheticTargetGets === 0
  && instrument.oldRefreshDenied === 2
  && instrument.oldRefreshAccepted === 0
  && refreshes.length === 2
  && refreshes.every((status) => status === 401)
  && instrument.actorStillAccepted === true
  && instrument.actorDistinctFromOwner === true
  && instrument.ownerUnchanged === true
  && before.total === 1 && before.active === 1 && before.revoked === 0 && before.current === 1
  && before.ownerActive === true && before.ownerCurrent === true && before.ownerTypeH5 === true
  && after.total === 1 && after.active === 1 && after.revoked === 0 && after.current === 1
  && fixture.expectedRows === 3
  && fixture.actorOtherType === 'WEB'
  && fixture.browserType === 'H5'
  && fixture.ownerType === 'H5'
const ledger = (acceptance.status === 'PASS' || acceptance.status === 'PARTIAL')
  && counts.passed === 184
  && counts.requiredFailed === 0
  && seed.runtimeStatus === 'NOT_RUNTIME_VERIFIED'
const admission = Boolean(sql && sql.consentRows === 3 && sql.notRuntimeVerified === 3)
const passed = wire && ledger && admission && !timedOut && !priorLeak
const receipt = {
  status: passed ? 'PASS' : 'FAIL',
  reason: passed ? null : (!wire ? 'wire-outcome' : !ledger ? 'ledger' : !admission ? 'fixture-admission' : 'timeout'),
  timedOut,
  nodeStatus,
  priorLeak,
  supervisor,
  label,
  containerName,
  prefix: '/tmp/grok-mobile-device-guard-source-directory-383',
  dockerUserConfig: 'not-consulted',
  registryAuth: false,
  imagePull: 'never',
  credentialGuard: 'admin-socket-and-ephemeral-mysql-env',
  ledger: {status: acceptance.status, passed: counts.passed ?? null, requiredFailed: counts.requiredFailed ?? null, runtimeStatus: seed.runtimeStatus ?? null},
  wire: {
    instrumentStatus: instrument.status,
    mode: ui.mode ?? null,
    bulkClicks: ui.bulkClicks ?? null,
    confirmClicks: ui.confirmClicks ?? null,
    rowExitClicks: ui.rowExitClicks ?? null,
    kickoutPosts: api.kickoutPosts ?? null,
    kickoutStatuses: statuses,
    kickoutPathsExact: api.kickoutPathsExact === true,
    refreshStatuses: refreshes,
    currentStays: ui.currentTaggedAfter === true,
    foreignUnchanged: instrument.ownerUnchanged === true,
    expectedRows: fixture.expectedRows ?? null,
  },
  counts: sql,
  ports: ['127.0.0.1:13306', '127.0.0.1:18070', '127.0.0.1:18087', '127.0.0.1:18183'],
  priorDirectory: 'historical-two-file',
  priorResult,
  priorResultSha256: priorResult === 'unchanged' ? priorResultSha : null,
  priorUnchanged: !priorLeak,
  priorCleanup: 'not-deleted',
}
writePrivate(receiptPath, JSON.stringify(receipt, null, 2) + '\n')
process.exit(passed ? 0 : 1)
NODE
}

main() {
  local mode="${1:-run}" qa_user qa_env published
  require_supervisor
  [ "$mode" = 'run' ] || [ "$mode" = '--preflight-only' ] || die 'usage'
  qa_suffix="$(openssl rand -hex 4)"
  qa_label="${LABEL_BASE}-${qa_suffix}"
  qa_name="${NAME_BASE}-${qa_suffix}"
  qa_user="o383${qa_suffix}"
  export QA_LABEL="$qa_label"
  export QA_NAME="$qa_name"
  preflight
  prepare_output "$PREFIX/preflight.json"
  prepare_output "$PREFIX/instrument-result.json"
  prepare_output "$PREFIX/receipt.json"
  if [ "$mode" = '--preflight-only' ]; then
    write_preflight_note
    printf 'preflight clean\n'
    exit 0
  fi
  qa_scratch="$(mktemp -d "$PREFIX/scratch.XXXXXXXX")"
  trap cleanup EXIT
  require_scratch_private "$qa_scratch"
  mkdir -p "$qa_scratch/harness"
  cp "$G318/acceptance.mjs" "$G318/browser-probe.cjs" "$G318/observe-auth.cjs" "$qa_scratch/harness/"
  cp -R "$DEVICE_HARNESS/seed" "$DEVICE_HARNESS/sql" "$qa_scratch/harness/"
  require_sha "$qa_scratch/harness/acceptance.mjs" "$G318_ACCEPTANCE_SHA"
  require_sha "$qa_scratch/harness/browser-probe.cjs" "$G318_PROBE_SHA"
  require_sha "$qa_scratch/harness/observe-auth.cjs" "$G318_OBSERVE_SHA"
  write_helpers
  qa_mysql_admin_password="$(openssl rand -hex 18)"
  qa_password="$(openssl rand -hex 18)"
  qa_env="$qa_scratch/mysql.env"
  printf 'MYSQL_ROOT_PASSWORD=%s\nMYSQL_DATABASE=iam_service\nMYSQL_USER=%s\nMYSQL_PASSWORD=%s\n' "$qa_mysql_admin_password" "$qa_user" "$qa_password" > "$qa_env"
  require_ephemeral_credential "$qa_env"
  qa_cid="$(docker run --pull=never --rm --detach --name "$qa_name" --label "cloudstudy.qa.scope=$qa_label" --cpus=1 --memory=768m --tmpfs /var/lib/mysql:rw,nosuid,size=512m --env-file "$qa_env" -p 127.0.0.1:13306:3306 "$MYSQL_IMAGE" --innodb-buffer-pool-size=64M --max-connections=16 --performance-schema=OFF)"
  rm -f -- "$qa_env"
  published="$(docker port "$qa_cid" 3306/tcp 2>/dev/null || true)"
  [ "$published" = '127.0.0.1:13306' ] || die 'port-publish'
  assert_private_db
  assert_loopback_ports
  wait_mysql
  write_preflight_note
  QA_LABEL="$qa_label" \
  QA_NAME="$qa_name" \
  JAVA_HOME="$JAVA_HOME_PIN" \
  PATH="$JAVA_HOME_PIN/bin:$PATH" \
  MB004_RUN_APPROVAL='YES_RUN_MB004_LOCAL_ACCEPTANCE' \
  MB004_MYSQL_DISPOSABLE='YES_DISPOSABLE_MYSQL_13306_IAM_SERVICE' \
  MB004_MYSQL_USER="$qa_user" \
  MB004_MYSQL_PASSWORD="$qa_password" \
  MB004_G210_AUTH='YES_LOCAL_H5_AUTH_ONLY' \
  MB004_BROWSER_PROBE= \
  MB025_DEVICE_BROWSER_PROBE= \
  MB383_INSTRUMENT_RESULT="$PREFIX/instrument-result.json" \
  MB383_REDIRECT="$qa_scratch/redirect-result.cjs" \
  MB383_PROBE="$G331" \
  MB383_PLAYWRIGHT_ROOT="$PLAYWRIGHT_ROOT" \
  NODE_OPTIONS="--require $qa_scratch/lease-hook.cjs" \
  perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV or die $!' \
    node --unhandled-rejections=strict "$qa_scratch/harness/acceptance.mjs" --mode run --repo "$REPO" \
      --out "$qa_scratch/acceptance-result.json" --report "$qa_scratch/acceptance-report.md" \
    >"$qa_scratch/node.stdout" 2>"$qa_scratch/node.stderr" &
  qa_node=$!
  qa_password=''
  qa_mysql_admin_password=''
  local deadline=$((SECONDS + 720))
  while kill -0 "$qa_node" 2>/dev/null; do
    assert_loopback_ports
    if [ "$SECONDS" -ge "$deadline" ]; then
      qa_timed_out=1
      stop_node_group
      break
    fi
    sleep 1
  done
  if [ "$qa_timed_out" -eq 0 ]; then
    set +e
    wait "$qa_node"
    qa_node_status=$?
    set -e
  fi
  qa_node=''
  assert_loopback_ports
  local prior_now
  prior_now="$(read_prior_snapshot 2>/dev/null || true)"
  case "$prior_now" in
    'OK '*) prior_now="${prior_now#OK }" ;;
    *) prior_now='' ;;
  esac
  if [ -z "$qa_prior_snapshot" ] || [ "$prior_now" != "$qa_prior_snapshot" ]; then
    qa_prior_leak=1
  fi
  count_rows > "$qa_scratch/counts.txt" || true
  set +e
  evaluate
  local evaluated=$?
  set -e
  exit "$evaluated"
}

main "${1:-run}"

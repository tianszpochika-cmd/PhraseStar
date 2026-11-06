#!/bin/bash
# B139 course-shelf H5 lease.
# Exact G361 runner rebound to this directory, the same pins, and port 18183.
# run_probe still requires a real empty catalog, then lease-tail.mjs opens the
# G388 nonce listener and the G369 observer. Authoring did not execute this file.
set -u
umask 077

REQUESTED_ROOT="/tmp/grok-mobile-learn-shelf-rebind-runner-392"
PROBE_DIR_NAME="grok-mobile-learn-catalog-real-owner-probe-329"
PROBE_NAME="learn-catalog-owner.mjs"
HOOK_NAME="reading-live-hook.mjs"
FROZEN_PROBE="/LOCAL_HANDOFF_HOME/supervision-root/mobile-supervision/resume-20261105/learn-catalog-real-owner-probe-329-frozen/${PROBE_NAME}"
FROZEN_HOOK="/LOCAL_HANDOFF_HOME/supervision-root/mobile-supervision/resume-20261105/reading-runtime-grant-quoting-303-frozen/${HOOK_NAME}"
HARNESS="/LOCAL_HANDOFF_HOME/supervision-root/mobile-supervision/resume-20261105/mb006-placement-full-browser-96-root/harness"
JAR_ROOT="/LOCAL_HANDOFF_HOME/.codex/worktrees/mobile-figma-integration-20261103/cloudstudy/services"
CONTENT_JAR="/LOCAL_HANDOFF_HOME/supervision-root/mobile-supervision/resume-20261105/reading-content-owner-b118-package/content-service-b118.jar"
LEARNER_JAR="/LOCAL_HANDOFF_HOME/supervision-root/mobile-supervision/resume-20261105/learner-preference-jackson3-test-278-root/learner-preference-owner-combined.jar"

PROBE_SHA="8267b3cd791ff1c4e2538df78987edf34b47f18fc4760ec7815c8aa50d33b410"
PROBE_BYTES="27647"
HOOK_SHA="d5d1cfb8f083dd72fd4386dff5ae0e1a12f7ab5890fba64652bc9d8da7779ace"
HOOK_BYTES="13799"
SEED_JAVA_SHA="fde6075e353fec4e12385e6e66bc1a74cece280289210adea9906c99cfa3cb9a"
SEED_SQL_SHA="c507b3fe1c8078700e177d4a168619e69c1c5f7136243e6a98f72d412403fbd9"
IAM_JAR_SHA="98f6b2d6b8c44de9d94f44bcf498d154f009c52faf4aa3615d2a9e513b390007"
GATEWAY_JAR_SHA="7f796cfb60f571beb155ce3fad87a3e9e6cb13ddddd3f91e2ca9d9771ca6a0a1"
LEARNER_JAR_SHA="0a9c41599ad3759ba37259308ffa36df35b65a52ee252c620ffe659b797687b1"
CONTENT_JAR_SHA="852578df43b40fdc45569a6e60c074c3561c0b43bf8e7bd6b8acafd51e2f3eb2"
MYSQL_IMAGE_ID="sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b"

LABEL="cloudstudy.qa.mobile-learn-shelf-rebind-runner-392-20261106"
NAME="cloudstudy-mobile-learn-shelf-rebind-runner-392-20261106"
DOCKER_CONTEXT="desktop-linux"
DOCKER_SOCKET="unix:///LOCAL_HANDOFF_HOME/.docker/run/docker.sock"
GATEWAY_ORIGIN="http://127.0.0.1:18070"
JDBC_QUERY="useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true"
WALL_S=900

REASON=""
EXIT_CODE=1
PREFLIGHT=0
STARTED=0
CLEANED=0
RELEASED=0
ROOT=""
SCRATCH=""
CONTAINER=""
RUN_ID=""
SCHEMA=""
CONTENT_USER=""
STAGE="init"
PROBE_STATUS=""
PROBE_OUTCOME=""
PROBE_ITEMS=""
PROBE_LOCALE=""
LEARNER_VISIBLE=""
SEALED_PUBLISHED=""
FLYWAY_FAILED=""
SQL_STEP=""
SQL_ERRNO=""
H5_STARTED=0
SHELF_STATUS=""

die() {
  REASON="$1"
  case "$1" in
    script-root|argv-rejected|java-version|tool-missing|mysql-image-missing|mysql-inventory|mysql-name-present|ports-busy|ports-busy:*|probe-path|docker-context|hook-guard|publication-not-admitted|port-lease|hash-mismatch|hash-mismatch:*|lease-tail)
      EXIT_CODE=2
      ;;
    *)
      EXIT_CODE=1
      ;;
  esac
  exit "$EXIT_CODE"
}

sha256_file() {
  openssl dgst -sha256 "$1" | awk '{print $NF}'
}

bytes_of() {
  stat -f%z "$1"
}

regular_file() {
  local path="$1"
  [[ ! -L "$path" && -f "$path" ]]
}

java_bin() {
  if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/$1" ]]; then
    printf '%s\n' "${JAVA_HOME}/bin/$1"
  else
    command -v "$1" 2>/dev/null || true
  fi
}

docker_cmd() {
  docker --context "$DOCKER_CONTEXT" "$@"
}

require_hash() {
  local path="$1"
  local expected="$2"
  local bytes="${3:-}"
  regular_file "$path" || die "hash-mismatch:$(basename "$path")"
  [[ "$(sha256_file "$path")" == "$expected" ]] || die "hash-mismatch:$(basename "$path")"
  if [[ -n "$bytes" ]]; then
    [[ "$(bytes_of "$path")" == "$bytes" ]] || die "hash-mismatch:$(basename "$path")"
  fi
}

listeners() {
  local port="$1"
  local out code
  set +e
  out="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -Fp 2>/dev/null)"
  code=$?
  set -e
  if [[ "$code" -ne 0 && "$code" -ne 1 ]]; then
    return 1
  fi
  printf '%s\n' "$out" | awk '/^p[0-9]+$/ { print substr($0, 2) }'
}

port_busy() {
  local found
  if ! found="$(listeners "$1")"; then
    if [[ "${CLEANED:-0}" == "1" ]]; then
      return 0
    fi
    die "lsof-failed-${1}"
  fi
  [[ -n "$found" ]]
}

require_script_root() {
  local here physical private_root
  here="$(cd "$(dirname "$0")" && pwd -P)"
  physical="$here"
  ROOT="$physical"
  [[ "$(basename "$physical")" == "$(basename "$REQUESTED_ROOT")" ]] || die script-root
  private_root="/private/tmp/$(basename "$REQUESTED_ROOT")"
  [[ -d "$REQUESTED_ROOT" && ! -L "$REQUESTED_ROOT" ]] || die script-root
  [[ -d "$private_root" && ! -L "$private_root" ]] || die script-root
  python3 - "$REQUESTED_ROOT" "$private_root" "$physical" <<'PY' || die script-root
import os, sys
requested, private_root, physical = sys.argv[1:]
if os.path.realpath(requested) != physical or os.path.realpath(private_root) != physical:
    raise SystemExit(1)
if not os.path.samefile(requested, private_root):
    raise SystemExit(1)
PY
  regular_file "$physical/learn-catalog-runtime.sh" || die script-root
  [[ "$(basename "$0")" == "learn-catalog-runtime.sh" || "$(basename "$0")" == "bash" ]] || true
  local self
  self="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$0")"
  [[ "$self" == "$physical/learn-catalog-runtime.sh" ]] || die script-root
}

require_tools() {
  local name
  for name in docker node openssl lsof python3 shasum; do
    command -v "$name" >/dev/null 2>&1 || die tool-missing
  done
  [[ -n "$(java_bin java)" && -n "$(java_bin javac)" && -n "$(java_bin keytool)" ]] || die tool-missing
}

require_java() {
  local text major
  text="$("$(java_bin java)" -version 2>&1 || true)"
  printf '%s\n' "$text" | grep -q 'version "' || die java-version
  major="$(printf '%s\n' "$text" | sed -n 's/.*version "\([0-9][0-9]*\).*/\1/p' | head -n 1)"
  [[ "$major" == "25" ]] || die java-version
}

require_docker() {
  local host
  host="$(docker_cmd context inspect "$DOCKER_CONTEXT" 2>/dev/null | python3 -c '
import json, sys
try:
    payload = json.load(sys.stdin)
except Exception:
    raise SystemExit(1)
row = payload[0] if isinstance(payload, list) and payload else payload
endpoints = row.get("Endpoints") if isinstance(row, dict) else None
docker = endpoints.get("docker") if isinstance(endpoints, dict) else None
print(docker.get("Host") if isinstance(docker, dict) else "")
' || true)"
  [[ "$host" == "$DOCKER_SOCKET" ]] || die docker-context
  local image
  image="$(docker_cmd image inspect -f '{{.Id}}' "$MYSQL_IMAGE_ID" 2>/dev/null || true)"
  [[ "$image" == "$MYSQL_IMAGE_ID" ]] || die mysql-image-missing
  local existing named
  existing="$(docker_cmd ps -aq --filter "label=cloudstudy.qa.scope=${LABEL}" 2>/dev/null || true)"
  named="$(docker_cmd ps -aq --filter "name=^/${NAME}$" 2>/dev/null || true)"
  [[ -n "$existing" || -n "$named" ]] && die mysql-name-present
  docker_cmd ps -aq --filter "label=cloudstudy.qa.scope=${LABEL}" >/dev/null || die mysql-inventory
}

require_ports_free() {
  local port
  for port in 13306 18070 18087 18088 18089 18183; do
    if port_busy "$port"; then
      die "ports-busy:${port}"
    fi
  done
}

require_hook_guard() {
  local text
  text="$(python3 -c 'import pathlib,sys; print(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))' "$FROZEN_HOOK")"
  printf '%s\n' "$text" | grep -q 'MB303_READING_LIVE_HOOK' || die hook-guard
  printf '%s\n' "$text" | grep -q 'MB303_RUN_ID' || die hook-guard
  printf '%s\n' "$text" | grep -q 'content.read' || die hook-guard
  printf '%s\n' "$text" | grep -q '/api/v1/auth/register' || die hook-guard
  printf '%s\n' "$text" | grep -q '/api/v1/learner/targets' || die hook-guard
  if printf '%s\n' "$text" | grep -q 'route.fulfill'; then die hook-guard; fi
  if printf '%s\n' "$text" | grep -q '/api/v1/reading'; then die hook-guard; fi
  if printf '%s\n' "$text" | grep -q '/api/v1/assessment'; then die hook-guard; fi
}

require_lease_files() {
  regular_file "$ROOT/lease-tail.mjs" || die lease-tail
  regular_file "$ROOT/pinned-static-nonce.mjs" || die lease-tail
  regular_file "$ROOT/shelf-empty-observer.mjs" || die lease-tail
}

require_probe() {
  require_hash "$FROZEN_PROBE" "$PROBE_SHA" "$PROBE_BYTES"
  local live physical receipt
  live="/tmp/${PROBE_DIR_NAME}/${PROBE_NAME}"
  receipt="/tmp/${PROBE_DIR_NAME}/actual-receipt.json"
  if [[ ! -e "$live" || -L "$live" || ! -f "$receipt" || -L "$receipt" ]]; then
    die probe-path
  fi
  physical="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$live")"
  [[ "$physical" == "/private/tmp/${PROBE_DIR_NAME}/${PROBE_NAME}" || "$physical" == "/tmp/${PROBE_DIR_NAME}/${PROBE_NAME}" ]] || die probe-path
  require_hash "$physical" "$PROBE_SHA" "$PROBE_BYTES"
  python3 - "$FROZEN_PROBE" "$ROOT/${PROBE_NAME}" "/tmp/${PROBE_DIR_NAME}" "/tmp/$(basename "$REQUESTED_ROOT")" <<'PY' || die probe-path
import os, pathlib, sys
frozen_path, copy_path, old_dir, new_dir = sys.argv[1:]
frozen = pathlib.Path(frozen_path).read_bytes()
old = ("const OUT_DIR = '%s'" % old_dir).encode("utf-8")
new = ("const OUT_DIR = '%s'" % new_dir).encode("utf-8")
if frozen.count(old) != 1 or new in frozen or old_dir == new_dir:
    raise SystemExit(1)
expected = frozen.replace(old, new, 1)
if expected == frozen or expected.count(new) != 1 or old in expected:
    raise SystemExit(1)
copy = pathlib.Path(copy_path)
if copy.exists():
    if copy.is_symlink() or not copy.is_file() or copy.read_bytes() != expected:
        raise SystemExit(1)
else:
    fd = os.open(copy_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.write(fd, expected)
    os.close(fd)
    os.chmod(copy_path, 0o600)
if pathlib.Path(copy_path).read_bytes() != expected:
    raise SystemExit(1)
PY
  PROBE_PATH="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$ROOT/${PROBE_NAME}")"
  case "$PROBE_PATH" in
    "$ROOT/${PROBE_NAME}"|"/private/tmp/$(basename "$REQUESTED_ROOT")/${PROBE_NAME}"|"/tmp/$(basename "$REQUESTED_ROOT")/${PROBE_NAME}") ;;
    *) die probe-path ;;
  esac
}

preflight() {
  STAGE="preflight"
  require_script_root
  require_lease_files
  if [[ "${LC_OWNER_PUBLISH:-}" != "" ]]; then
    die publication-not-admitted
  fi
  require_tools
  require_java
  require_hash "${JAR_ROOT}/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar" "$IAM_JAR_SHA"
  require_hash "${JAR_ROOT}/api-gateway/target/api-gateway-0.1.0-SNAPSHOT.jar" "$GATEWAY_JAR_SHA"
  require_hash "$LEARNER_JAR" "$LEARNER_JAR_SHA"
  require_hash "$CONTENT_JAR" "$CONTENT_JAR_SHA"
  require_hash "${HARNESS}/seed/Seed.java" "$SEED_JAVA_SHA"
  require_hash "${HARNESS}/sql/seed-full.sql" "$SEED_SQL_SHA"
  require_hash "$FROZEN_HOOK" "$HOOK_SHA" "$HOOK_BYTES"
  require_hook_guard
  require_probe
  require_docker
  require_ports_free
}

remain_ok() {
  local now left
  now="$(date +%s)"
  left="$((WALL_S - (now - STARTED_AT)))"
  [[ "$left" -gt 0 ]] || die wall-timeout
}

mysql_root() {
  local step="$1"
  local sql="$2"
  case "$step" in
    partial_revokes|admin-grants|schema-count|grantee-probe) ;;
    *) die mysql-query ;;
  esac
  [[ -n "$CONTAINER" ]] || die mysql-label
  local label
  label="$(docker_cmd inspect -f '{{index .Config.Labels "cloudstudy.qa.scope"}}' "$CONTAINER" 2>/dev/null || true)"
  [[ "$label" == "$LABEL" ]] || die mysql-label
  local errfile
  errfile="${SCRATCH}/mysql.err"
  if ! printf '%s\n' "$sql" | docker_cmd exec -i "$CONTAINER" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket --user=root --batch --skip-column-names' >"${SCRATCH}/mysql.out" 2>"$errfile"; then
    local errno
    errno="$(sed -n 's/.*ERROR \([0-9][0-9]*\).*/\1/p' "$errfile" | head -n 1)"
    if [[ -n "$errno" ]]; then
      SQL_ERRNO="$errno"
      SQL_STEP="$step"
    else
      SQL_STEP="$step"
    fi
    die mysql-query
  fi
}

start_mysql() {
  STAGE="mysql"
  remain_ok
  local root_pw iam_pw learner_pw content_pw
  root_pw="$(openssl rand -hex 18)"
  iam_pw="$(openssl rand -hex 18)"
  learner_pw="$(openssl rand -hex 18)"
  content_pw="$(openssl rand -hex 18)"
  SCHEMA="lc340$(openssl rand -hex 8)"
  CONTENT_USER="lc340u$(openssl rand -hex 6)"
  [[ "$SCHEMA" =~ ^lc340[a-f0-9]{16}$ ]] || die schema-name
  [[ "$CONTENT_USER" =~ ^lc340u[a-f0-9]{12}$ ]] || die schema-name
  [[ "$root_pw" != "$iam_pw" && "$root_pw" != "$learner_pw" && "$root_pw" != "$content_pw" && "$iam_pw" != "$learner_pw" && "$iam_pw" != "$content_pw" && "$learner_pw" != "$content_pw" ]] || die db-secrets
  local env_path cid_path
  env_path="${SCRATCH}/mysql.env"
  cid_path="${SCRATCH}/mysql.cid"
  umask 077
  {
    printf 'MYSQL_ROOT_PASSWORD=%s\n' "$root_pw"
    printf 'MYSQL_DATABASE=iam_service\n'
    printf 'MYSQL_USER=iam_mobile_http_probe\n'
    printf 'MYSQL_PASSWORD=%s\n' "$iam_pw"
  } >"$env_path"
  chmod 600 "$env_path"
  if ! docker_cmd run --pull=never --rm --detach --cidfile "$cid_path" \
      --name "$NAME" --label "cloudstudy.qa.scope=${LABEL}" --cpus=1 --memory=768m \
      --tmpfs /var/lib/mysql:rw,nosuid,size=512m --env-file "$env_path" \
      -p 127.0.0.1:13306:3306 "$MYSQL_IMAGE_ID" \
      --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci \
      --innodb-buffer-pool-size=64M --max-connections=40 --performance-schema=OFF \
      >"${SCRATCH}/mysql-start.out" 2>"${SCRATCH}/mysql-start.err"; then
    rm -f "$env_path"
    die mysql-start
  fi
  rm -f "$env_path"
  CONTAINER="$(tr -d '[:space:]' <"$cid_path")"
  [[ "$CONTAINER" =~ ^[0-9a-f]{64}$ ]] || die mysql-id
  local got_name
  got_name="$(docker_cmd inspect -f '{{.Name}}' "$CONTAINER" 2>/dev/null || true)"
  got_name="${got_name#/}"
  [[ "$got_name" == "$NAME" ]] || die mysql-label
  local i ready
  ready=0
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46 47 48 49 50 51 52 53 54 55 56 57 58 59 60; do
    remain_ok
    if docker_cmd exec "$CONTAINER" sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --protocol=TCP --host=127.0.0.1 --user="$MYSQL_USER" "$MYSQL_DATABASE" --batch --skip-column-names -e "SELECT 1"' >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done
  [[ "$ready" == "1" ]] || die mysql-ready
  local partial
  mysql_root partial_revokes 'SELECT @@GLOBAL.partial_revokes;'
  partial="$(sql_cell)"
  [[ "$partial" == "0" || "$partial" == "1" ]] || die mysql-partial-revokes
  local grant_schema schema_sql
  grant_schema="$SCHEMA"
  schema_sql="'${SCHEMA}'"
  if [[ "$partial" == "0" ]]; then
    schema_sql="REPLACE('${SCHEMA}','_',CONCAT(CHAR(92),'_'))"
  fi
  mysql_root admin-grants "CREATE DATABASE learner_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE \`${SCHEMA}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'learner_mobile_target_probe'@'%' IDENTIFIED BY '${learner_pw}';
CREATE USER '${CONTENT_USER}'@'%' IDENTIFIED BY '${content_pw}';
GRANT ALL PRIVILEGES ON learner_service.* TO 'learner_mobile_target_probe'@'%';
GRANT ALL PRIVILEGES ON \`${grant_schema}\`.* TO '${CONTENT_USER}'@'%';"
  local counted
  mysql_root schema-count "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('iam_service','learner_service','${SCHEMA}') AND default_collation_name='utf8mb4_unicode_ci';"
  counted="$(sql_cell)"
  [[ "$counted" == "3" ]] || die mysql-schemas
  local grantee foreign owned
  grantee="CONCAT(QUOTE('${CONTENT_USER}'),'@',QUOTE('%'))"
  mysql_root grantee-probe "SELECT COUNT(*) FROM information_schema.schema_privileges WHERE grantee = ${grantee} AND table_schema <> ${schema_sql};"
  foreign="$(sql_cell)"
  mysql_root grantee-probe "SELECT COUNT(*) FROM information_schema.schema_privileges WHERE grantee = ${grantee} AND table_schema = ${schema_sql};"
  owned="$(sql_cell)"
  [[ "$foreign" == "0" && "$owned" != "0" ]] || die db-grant-scope
  IAM_PW="$iam_pw"
  LEARNER_PW="$learner_pw"
  CONTENT_PW="$content_pw"
  printf '%s' "$root_pw" >/dev/null
  root_pw=""
}

prepare_tls() {
  STAGE="tls"
  remain_ok
  local dir="$SCRATCH/tls"
  mkdir -m 700 "$dir"
  local cert="$dir/test-ca.pem" key="$dir/test-key.pem" keystore="$dir/iam-server.p12" trust="$dir/trust.p12" signer="$dir/iam-signer.pem"
  KEY_PW="$(openssl rand -hex 24)"
  TRUST_PW="$(openssl rand -hex 24)"
  MB004_KEYSTORE_PASSWORD="$KEY_PW" MB004_TRUSTSTORE_PASSWORD="$TRUST_PW" \
    openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 2 \
      -subj "/CN=mb004 local IAM loopback" -addext "subjectAltName=IP:127.0.0.1,DNS:localhost" \
      -keyout "$key" -out "$cert" >/dev/null 2>&1 || die tls
  MB004_KEYSTORE_PASSWORD="$KEY_PW" \
    openssl pkcs12 -export -in "$cert" -inkey "$key" -out "$keystore" -name mb004-iam \
      -passout env:MB004_KEYSTORE_PASSWORD >/dev/null 2>&1 || die tls
  MB004_TRUSTSTORE_PASSWORD="$TRUST_PW" \
    "$(java_bin keytool)" -importcert -noprompt -alias mb004-iam -file "$cert" \
      -keystore "$trust" -storetype PKCS12 -storepass:env MB004_TRUSTSTORE_PASSWORD >/dev/null 2>&1 || die tls
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$signer" >/dev/null 2>&1 || die tls
  chmod 600 "$cert" "$key" "$keystore" "$trust" "$signer"
  TLS_CERT="$cert"
  TLS_KEYSTORE="$keystore"
  TLS_TRUST="$trust"
  TLS_SIGNER="$signer"
}

spawn_service() {
  local name="$1"
  shift
  local log="$SCRATCH/logs/${name}.log"
  python3 - "$SCRATCH" "$log" "$@" <<'PY' &
import os, sys
scratch, log, *cmd = sys.argv[1:]
os.chdir(scratch)
os.setsid()
null = os.open("/dev/null", os.O_RDONLY)
os.dup2(null, 0)
os.close(null)
fd = os.open(log, os.O_CREAT | os.O_WRONLY | os.O_APPEND, 0o600)
os.dup2(fd, 1)
os.dup2(fd, 2)
os.close(fd)
os.execvp(cmd[0], cmd)
PY
  local pid=$!
  printf '%s\n' "$pid" >>"$SCRATCH/pids"
  sleep 0.2
  local pgid
  pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
  [[ "$pgid" == "$pid" ]] || die "${name}-ownership"
}

health_once() {
  local port="$1"
  local path="$2"
  local ca="${3:-}"
  python3 - "$port" "$path" "$ca" <<'PY'
import http.client, json, ssl, sys
port = int(sys.argv[1])
path = sys.argv[2]
ca = sys.argv[3]
try:
    if ca:
        context = ssl.create_default_context(cafile=ca)
        conn = http.client.HTTPSConnection("127.0.0.1", port, context=context, timeout=2.5)
    else:
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=2.5)
    conn.request("GET", path, headers={"Accept": "application/json"})
    response = conn.getresponse()
    raw = response.read(8192)
    status = response.status
    conn.close()
    if status != 200 or len(raw) >= 8192:
        raise SystemExit(1)
    body = json.loads(raw.decode("utf-8"))
except Exception:
    raise SystemExit(1)
data = body.get("data") if isinstance(body, dict) else None
up = (isinstance(body, dict) and body.get("status") == "UP") or (isinstance(data, dict) and data.get("status") == "UP")
service = data.get("service") if isinstance(data, dict) else ""
sys.stdout.write(("up" if up else "down") + "\t" + (service if isinstance(service, str) else "") + "\n")
PY
}

wait_health() {
  local name="$1"
  local port="$2"
  local seconds="$3"
  local ca="${4:-}"
  local deadline now line
  deadline="$(( $(date +%s) + seconds ))"
  while true; do
    remain_ok
    now="$(date +%s)"
    [[ "$now" -lt "$deadline" ]] || die "${name}-health-timeout"
    line="$(health_once "$port" /actuator/health/readiness "$ca" 2>/dev/null || true)"
    [[ "${line%%$'\t'*}" == "up" ]] && return 0
    sleep 0.5
  done
}

gateway_api_ready() {
  local line service
  line="$(health_once 18070 /api/v1/health "" 2>/dev/null || true)"
  service="${line#*$'\t'}"
  [[ "${line%%$'\t'*}" == "up" && "$service" == "api-gateway" ]] || die gateway-api-health
}

base_env() {
  ENV_PATH="${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"
  ENV_HOME="${HOME:-}"
  ENV_LANG="C.UTF-8"
}

start_iam() {
  STAGE="iam"
  remain_ok
  local replay fingerprint digest java
  replay="$(openssl rand -hex 32)"
  fingerprint="$(openssl rand -hex 32)"
  [[ "$fingerprint" != "$replay" ]] || fingerprint="$(openssl rand -hex 32)"
  CLIENT_SECRET="$(openssl rand -hex 24)"
  digest="$(printf '%s' "$CLIENT_SECRET" | openssl dgst -sha256 | awk '{print $NF}')"
  java="$(java_bin java)"
  spawn_service iam \
    env PATH="$ENV_PATH" HOME="$ENV_HOME" TMPDIR="$SCRATCH" LANG="$ENV_LANG" LC_ALL="$ENV_LANG" ${JAVA_HOME:+JAVA_HOME="$JAVA_HOME"} \
    OTEL_ENABLED=false MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED=false MANAGEMENT_TRACING_EXPORT_ENABLED=false SPRING_MAIN_BANNER_MODE=off \
    SPRING_PROFILES_ACTIVE=local SERVER_ADDRESS=127.0.0.1 SERVER_PORT=18087 \
    SERVER_SSL_ENABLED=true SERVER_SSL_KEYSTORETYPE=PKCS12 SERVER_SSL_KEY_STORE_TYPE=PKCS12 \
    SERVER_SSL_KEYALIAS=mb004-iam SERVER_SSL_KEY_ALIAS=mb004-iam \
    SERVER_SSL_KEYSTORE="$TLS_KEYSTORE" SERVER_SSL_KEY_STORE="$TLS_KEYSTORE" \
    SERVER_SSL_KEYSTOREPASSWORD="$KEY_PW" SERVER_SSL_KEY_STORE_PASSWORD="$KEY_PW" \
    IAM_PERSISTENCE_ENABLED=true IAM_FLYWAY_ENABLED=true IAM_PERSISTENCE_SCHEMA=iam_service \
    IAM_JDBC_URL="jdbc:mysql://127.0.0.1:13306/iam_service?${JDBC_QUERY}" \
    IAM_JDBC_USERNAME=iam_mobile_http_probe IAM_JDBC_PASSWORD="$IAM_PW" \
    IAM_CONSENT_POLICY_SOURCE=control-plane IAM_LOCAL_ADULT_GATE_ENABLED=true \
    IAM_IDEMPOTENCY_REPLAYSECRET="$replay" IAM_IDEMPOTENCY_REPLAY_SECRET="$replay" \
    IAM_IDEMPOTENCY_FINGERPRINTSECRET="$fingerprint" IAM_IDEMPOTENCY_FINGERPRINT_SECRET="$fingerprint" \
    IAM_IDEMPOTENCY_V13WRITERSDRAINED=true IAM_IDEMPOTENCY_V13_WRITERS_DRAINED=true \
    IAM_JWT_ISSUER="http://127.0.0.1:18087" IAM_JWT_AUDIENCE=yuxuexing-api IAM_JWT_ALGORITHM=RS256 \
    IAM_JWT_PRIVATEKEYFILE="$TLS_SIGNER" IAM_JWT_PRIVATE_KEY_FILE="$TLS_SIGNER" \
    IAM_JWT_EPHEMERALKEYSALLOWED=false IAM_JWT_EPHEMERAL_KEYS_ALLOWED=false \
    IAM_JWT_REFRESHCOOKIESECURE=true IAM_JWT_REFRESH_COOKIE_SECURE=true \
    IAM_POLICY_BOOTSTRAP_ENABLED=false IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST="$digest" \
    "$java" -Xms64m -Xmx384m -XX:ActiveProcessorCount=2 -Dfile.encoding=UTF-8 "-Djava.io.tmpdir=${SCRATCH}" \
    -jar "${JAR_ROOT}/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar" --iam.jwt.refresh-cookie-secure=true
  wait_health iam 18087 90 "$TLS_CERT"
}

seed_consents() {
  STAGE="seed"
  remain_ok
  local classes connector entry
  classes="$SCRATCH/seed-classes"
  mkdir -m 700 "$classes"
  "$(java_bin javac)" -encoding UTF-8 -d "$classes" "${HARNESS}/seed/Seed.java" >/dev/null 2>"$SCRATCH/logs/seed-compile.err" || die seed-compile
  entry="$(unzip -l "${JAR_ROOT}/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar" | awk '{print $NF}' | grep -E '^BOOT-INF/lib/mysql-connector-j-.*\.jar$' | head -n 1 || true)"
  [[ -n "$entry" ]] || die mysql-connector
  connector="$SCRATCH/mysql-connector-j.jar"
  unzip -p "${JAR_ROOT}/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar" "$entry" >"$connector" || die mysql-connector
  chmod 600 "$connector"
  MB004_DB_PASSWORD="$IAM_PW" MB004_SEED_ERROR_FILE="$SCRATCH/seed-error.log" \
    "$(java_bin java)" -Xms64m -Xmx384m -XX:ActiveProcessorCount=2 -cp "${connector}:${classes}" Seed \
      --url "jdbc:mysql://127.0.0.1:13306/iam_service?${JDBC_QUERY}" \
      --user iam_mobile_http_probe --sql "${HARNESS}/sql/seed-full.sql" \
      >"$SCRATCH/logs/seed.out" 2>"$SCRATCH/logs/seed.err" || die seed-full
  python3 - "$SCRATCH/logs/seed.out" <<'PY' || die seed-full
import json, pathlib, sys
text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
line = next((item for item in reversed(text.splitlines()) if item.startswith("{")), "")
try:
    parsed = json.loads(line) if line else {}
except json.JSONDecodeError:
    parsed = {}
if parsed.get("ok") is not True or parsed.get("fixtureRows") != 3 or parsed.get("documentBodyColumn") is not True:
    raise SystemExit(1)
PY
  local counted
  counted="$(MYSQL_PWD="$IAM_PW" docker_cmd exec -e MYSQL_PWD "$CONTAINER" sh -c 'mysql --protocol=TCP --host=127.0.0.1 --user=iam_mobile_http_probe iam_service --batch --skip-column-names -e "SELECT COUNT(*), SUM(document_digest = SHA2(document_body, 256)) FROM iam_consent_document_version WHERE tenant_id='"'"'platform'"'"' AND consent_document_id IN ('"'"'b0040000-0000-4000-8000-000000000001'"'"','"'"'b0040000-0000-4000-8000-000000000002'"'"','"'"'b0040000-0000-4000-8000-000000000003'"'"');"' || true)"
  counted="$(printf '%s' "$counted" | tr '\t' ' ' | tr -d '\r')"
  [[ "$counted" == "3 3" ]] || die consent-digest
}

start_gateway() {
  STAGE="gateway"
  remain_ok
  local java
  java="$(java_bin java)"
  spawn_service gateway \
    env PATH="$ENV_PATH" HOME="$ENV_HOME" TMPDIR="$SCRATCH" LANG="$ENV_LANG" LC_ALL="$ENV_LANG" ${JAVA_HOME:+JAVA_HOME="$JAVA_HOME"} \
    OTEL_ENABLED=false MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED=false MANAGEMENT_TRACING_EXPORT_ENABLED=false SPRING_MAIN_BANNER_MODE=off \
    SPRING_PROFILES_ACTIVE=local SERVER_ADDRESS=127.0.0.1 API_GATEWAY_PORT=18070 \
    IAM_SERVICE_BASE_URL="https://127.0.0.1:18087" IAM_ROUTE_ENABLED=true \
    IAM_JWT_ISSUER="http://127.0.0.1:18087" IAM_JWT_JWKS_URI="https://127.0.0.1:18087/api/v1/auth/jwks" IAM_JWT_AUDIENCE=yuxuexing-api \
    GATEWAY_RESOURCE_SERVER_ENABLED=true GATEWAY_JWT_PREVALIDATION_ENABLED=true \
    GATEWAY_RATE_LIMIT_ENABLED=true GATEWAY_RATE_LIMIT_BACKEND=memory GATEWAY_RATE_LIMIT_FAIL_OPEN=false \
    GATEWAY_SECURITY_AUDIT_ENABLED=true MANAGEMENT_HEALTH_REDIS_ENABLED=false \
    B12_SERVICES_ENABLED=false B13_SERVICES_ENABLED=false B14_STRANGLER_ENABLED=true WORKFLOW_SERVICES_ENABLED=false \
    B14_ROUTE_MODE_LEARNER=TARGET B14_ROUTE_MODE_CONTENT=TARGET \
    B14_ROUTE_MODE_LEARNING=LEGACY B14_ROUTE_MODE_ASSESSMENT=LEGACY B14_ROUTE_MODE_MEDIA=LEGACY \
    B14_ROUTE_MODE_GAMIFICATION=LEGACY B14_ROUTE_MODE_SOCIAL=LEGACY B14_ROUTE_MODE_COMMERCE=LEGACY \
    LEARNER_SERVICE_BASE_URL="http://127.0.0.1:18088" CONTENT_SERVICE_BASE_URL="http://127.0.0.1:18089" \
    "$java" -Xms64m -Xmx384m -XX:ActiveProcessorCount=2 -Dfile.encoding=UTF-8 "-Djava.io.tmpdir=${SCRATCH}" \
    "-Djavax.net.ssl.trustStore=${TLS_TRUST}" -Djavax.net.ssl.trustStoreType=PKCS12 \
    "-Djavax.net.ssl.trustStorePassword=${TRUST_PW}" -Dio.netty.handler.ssl.noOpenSsl=true \
    -jar "${JAR_ROOT}/api-gateway/target/api-gateway-0.1.0-SNAPSHOT.jar"
  wait_health gateway 18070 90
  gateway_api_ready
}

start_learner() {
  STAGE="learner"
  remain_ok
  local java
  java="$(java_bin java)"
  spawn_service learner \
    env PATH="$ENV_PATH" HOME="$ENV_HOME" TMPDIR="$SCRATCH" LANG="$ENV_LANG" LC_ALL="$ENV_LANG" ${JAVA_HOME:+JAVA_HOME="$JAVA_HOME"} \
    OTEL_ENABLED=false MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED=false MANAGEMENT_TRACING_EXPORT_ENABLED=false SPRING_MAIN_BANNER_MODE=off \
    SERVER_ADDRESS=127.0.0.1 SERVER_PORT=18088 LEARNER_SERVICE_PORT=18088 LEARNER_PHASE=phase-1 \
    LEARNER_PERSISTENCE_MODE=jdbc \
    LEARNER_JDBC_URL="jdbc:mysql://127.0.0.1:13306/learner_service?${JDBC_QUERY}" \
    LEARNER_JDBC_USERNAME=learner_mobile_target_probe LEARNER_JDBC_PASSWORD="$LEARNER_PW" \
    LEARNER_JDBC_DRIVER=com.mysql.cj.jdbc.Driver LEARNER_SCHEMA=learner_service LEARNER_FLYWAY_ENABLED=true \
    LEARNER_RESOURCE_SERVER_ENABLED=true LEARNER_SECURITY_ISSUER_URI="http://127.0.0.1:18087" \
    LEARNER_SECURITY_JWK_SET_URI="https://127.0.0.1:18087/api/v1/auth/jwks" LEARNER_SECURITY_AUDIENCE=yuxuexing-api \
    LEARNER_CONSENT_RECHECK_ENABLED=true LEARNER_CONSENT_RECHECK_IAM_BASE_URL="https://127.0.0.1:18087" \
    LEARNER_CONSENT_RECHECK_CLIENT_ID=learner-service LEARNER_CONSENT_RECHECK_CLIENT_SECRET="$CLIENT_SECRET" \
    "$java" -Xms64m -Xmx384m -XX:ActiveProcessorCount=2 -Dfile.encoding=UTF-8 "-Djava.io.tmpdir=${SCRATCH}" \
    "-Djavax.net.ssl.trustStore=${TLS_TRUST}" -Djavax.net.ssl.trustStoreType=PKCS12 \
    "-Djavax.net.ssl.trustStorePassword=${TRUST_PW}" -Dio.netty.handler.ssl.noOpenSsl=true \
    -jar "$LEARNER_JAR"
  wait_health learner 18088 90
}

start_content() {
  STAGE="content"
  remain_ok
  local java
  java="$(java_bin java)"
  spawn_service content \
    env PATH="$ENV_PATH" HOME="$ENV_HOME" TMPDIR="$SCRATCH" LANG="$ENV_LANG" LC_ALL="$ENV_LANG" ${JAVA_HOME:+JAVA_HOME="$JAVA_HOME"} \
    OTEL_ENABLED=false OTEL_TRACING_ENABLED=false MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED=false MANAGEMENT_TRACING_EXPORT_ENABLED=false SPRING_MAIN_BANNER_MODE=off \
    SERVER_ADDRESS=127.0.0.1 SERVER_PORT=18089 CONTENT_SERVICE_SERVER_ADDRESS=127.0.0.1 CONTENT_SERVICE_PORT=18089 \
    CONTENT_PERSISTENCE_MODE=jdbc CONTENT_FLYWAY_ENABLED=true CONTENT_SERVICE_SCHEMA="$SCHEMA" \
    CONTENT_JDBC_URL="jdbc:mysql://127.0.0.1:13306/${SCHEMA}?${JDBC_QUERY}" \
    CONTENT_JDBC_USERNAME="$CONTENT_USER" CONTENT_JDBC_PASSWORD="$CONTENT_PW" \
    CONTENT_JDBC_DRIVER=com.mysql.cj.jdbc.Driver \
    CONTENT_EVENT_RELAY_ENABLED=false CONTENT_EVENT_CONSUMER_ENABLED=false \
    CONTENT_SERVICE_RESOURCE_SERVER_ENABLED=true \
    CONTENT_SERVICE_SECURITY_ISSUER_URI="http://127.0.0.1:18087" \
    CONTENT_SERVICE_SECURITY_JWK_SET_URI="https://127.0.0.1:18087/api/v1/auth/jwks" \
    CONTENT_SERVICE_SECURITY_AUDIENCE=yuxuexing-api \
    "$java" -Xms64m -Xmx384m -XX:ActiveProcessorCount=2 -Dfile.encoding=UTF-8 "-Djava.io.tmpdir=${SCRATCH}" \
    "-Djavax.net.ssl.trustStore=${TLS_TRUST}" -Djavax.net.ssl.trustStoreType=PKCS12 \
    "-Djavax.net.ssl.trustStorePassword=${TRUST_PW}" -Dio.netty.handler.ssl.noOpenSsl=true \
    -jar "$CONTENT_JAR"
  wait_health content 18089 120
}

content_user_sql() {
  local step="$1"
  local sql="$2"
  [[ "$step" == "catalog-count" ]] || die mysql-query
  [[ -n "$CONTAINER" ]] || die mysql-label
  local label
  label="$(docker_cmd inspect -f '{{index .Config.Labels "cloudstudy.qa.scope"}}' "$CONTAINER" 2>/dev/null || true)"
  [[ "$label" == "$LABEL" ]] || die mysql-label
  local errfile
  errfile="${SCRATCH}/mysql.err"
  if ! printf '%s\n' "$sql" | MYSQL_PWD="$CONTENT_PW" docker_cmd exec -i \
      -e MYSQL_PWD -e MYSQL_USER="$CONTENT_USER" -e MYSQL_DATABASE="$SCHEMA" "$CONTAINER" \
      sh -c 'mysql --protocol=TCP --host=127.0.0.1 --user="$MYSQL_USER" "$MYSQL_DATABASE" --batch --skip-column-names' \
      >"${SCRATCH}/mysql.out" 2>"$errfile"; then
    local errno
    errno="$(sed -n 's/.*ERROR \([0-9][0-9]*\).*/\1/p' "$errfile" | head -n 1)"
    SQL_STEP="$step"
    if [[ -n "$errno" ]]; then
      SQL_ERRNO="$errno"
    fi
    die mysql-query
  fi
}

sql_cell() {
  tr -d '[:space:]' <"${SCRATCH}/mysql.out"
}

assert_genuine_zero() {
  STAGE="catalog-count"
  remain_ok
  content_user_sql catalog-count "SELECT COUNT(*) FROM flyway_schema_history WHERE success = 0;"
  FLYWAY_FAILED="$(sql_cell)"
  [[ "$FLYWAY_FAILED" =~ ^[0-9]+$ ]] || die catalog-count
  [[ "$FLYWAY_FAILED" == "0" ]] || die flyway-failed
  content_user_sql catalog-count "SELECT COUNT(*) FROM content_definition d JOIN content_version v ON v.content_version_id = d.current_published_version_id WHERE d.tenant_id = 'platform' AND v.status = 'PUBLISHED' AND v.copyright_status = 'ACTIVE' AND v.rights_allows_learning = 1 AND (JSON_CONTAINS(v.rights_permitted_channels, '\"LEARNER\"') OR JSON_CONTAINS(v.rights_permitted_channels, '\"*\"'));"
  LEARNER_VISIBLE="$(sql_cell)"
  [[ "$LEARNER_VISIBLE" =~ ^[0-9]+$ ]] || die catalog-count
  [[ "$LEARNER_VISIBLE" == "0" ]] || die catalog-not-zero
  content_user_sql catalog-count "SELECT COUNT(*) FROM content_definition d JOIN content_version v ON v.content_version_id = d.current_published_version_id WHERE d.tenant_id = 'platform' AND v.status = 'PUBLISHED' AND JSON_CONTAINS(v.rights_permitted_channels, '\"SEALED\"') AND NOT JSON_CONTAINS(v.rights_permitted_channels, '\"LEARNER\"');"
  SEALED_PUBLISHED="$(sql_cell)"
  [[ "$SEALED_PUBLISHED" =~ ^[0-9]+$ ]] || die catalog-count
}

write_credential() {
  STAGE="credential"
  local identifier password path
  identifier="mb340-${RUN_ID}@example.invalid"
  password="${CLOUDSTUDY_SYNTHETIC_PASSWORD:?set a fresh local test password}"
  path="$SCRATCH/credential.json"
  python3 - "$path" "$identifier" "$password" <<'PY' || die credential-size
import json, os, sys
path, identifier, password = sys.argv[1:]
body = json.dumps({"identifier": identifier, "password": password}, ensure_ascii=True, separators=(",", ":"))
fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
os.write(fd, body.encode("utf-8"))
os.close(fd)
os.chmod(path, 0o600)
size = os.path.getsize(path)
if size < 16 or size > 4096:
    raise SystemExit(1)
PY
  CREDENTIAL="$path"
  identifier=""
  password=""
}

run_hook() {
  STAGE="hook"
  remain_ok
  env -u LC_OWNER_ACCESS_TOKEN \
    PATH="$ENV_PATH" HOME="$ENV_HOME" TMPDIR="$SCRATCH" LANG="$ENV_LANG" LC_ALL="$ENV_LANG" \
    MB014_CREDENTIAL_FILE="$CREDENTIAL" MB014_IAM_CERT="$TLS_CERT" MB303_RUN_ID="$RUN_ID" NODE_NO_WARNINGS=1 \
    node "$FROZEN_HOOK" >"$SCRATCH/logs/hook.out" 2>"$SCRATCH/logs/hook.err" || die hook
  python3 - "$SCRATCH/logs/hook.out" <<'PY' || die hook
import json, pathlib, sys
text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
line = next((item for item in reversed(text.splitlines()) if item.startswith("{")), "")
parsed = json.loads(line) if line else {}
if parsed.get("ok") is not True or parsed.get("profileWrite") is not False or parsed.get("targetWrite") is not True:
    raise SystemExit(1)
if parsed.get("contentRead") is not True or parsed.get("assessmentWrites") != 0 or parsed.get("learningProgressWrites") != 0:
    raise SystemExit(1)
PY
}

run_h5_lease() {
  STAGE="h5-lease"
  remain_ok
  local shelf_code=0
  local shelf_reason=""
  env -u LC_OWNER_ACCESS_TOKEN \
    PATH="$ENV_PATH" HOME="$ENV_HOME" TMPDIR="$SCRATCH" LANG="$ENV_LANG" LC_ALL="$ENV_LANG" \
    MB014_CREDENTIAL_FILE="$CREDENTIAL" MB014_IAM_CERT="$TLS_CERT" NODE_NO_WARNINGS=1 \
    node "$ROOT/lease-tail.mjs" >"$SCRATCH/logs/shelf.out" 2>"$SCRATCH/logs/shelf.err" || true
  set +e
  python3 - "$SCRATCH/logs/shelf.out" "$CREDENTIAL" "$SCRATCH/logs/shelf.summary" <<'PY'
import json, pathlib, sys
text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
credential = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
line = next((item for item in reversed(text.splitlines()) if item.startswith("{")), "")
if credential["identifier"] in line or credential["password"] in line:
    raise SystemExit(1)
if "Bearer " in line or "eyJ" in line:
    raise SystemExit(1)
parsed = json.loads(line) if line else {}
reason = parsed.get("reason")
if not isinstance(reason, str) or not reason or len(reason) > 40:
    reason = "shelf-not-empty"
if any(ch not in "abcdefghijklmnopqrstuvwxyz0123456789-" for ch in reason):
    reason = "shelf-not-empty"
ready = (
    parsed.get("status") == "OBSERVED"
    and parsed.get("outcome") == "empty"
    and parsed.get("shelfEmptyReady") is True
    and parsed.get("observed") is True
    and parsed.get("subjectPrinted") is False
    and parsed.get("passwordOmitted") is True
    and parsed.get("identifierOmitted") is True
    and parsed.get("nonceValueOmitted") is True
    and parsed.get("subjectOmitted") is True
)
summary = {
    "ok": ready,
    "h5Started": parsed.get("h5Started") is True,
    "status": "OBSERVED" if ready else "FAILED",
    "reason": "empty" if ready else reason,
}
pathlib.Path(sys.argv[3]).write_text(json.dumps(summary, sort_keys=True), encoding="utf-8")
if not ready:
    raise SystemExit(1)
PY
  shelf_code=$?
  set -e
  if [[ -f "$SCRATCH/logs/shelf.summary" ]]; then
    H5_STARTED="$(python3 -c 'import json,sys; print("1" if json.load(open(sys.argv[1])).get("h5Started") else "0")' "$SCRATCH/logs/shelf.summary")"
    SHELF_STATUS="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("status") or "")' "$SCRATCH/logs/shelf.summary")"
    shelf_reason="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("reason") or "")' "$SCRATCH/logs/shelf.summary")"
  fi
  if [[ "$shelf_code" -ne 0 ]]; then
    case "$shelf_reason" in
      ""|empty|*[!a-z0-9-]*) die shelf-not-empty ;;
      *) die "$shelf_reason" ;;
    esac
  fi
}

run_probe() {
  STAGE="probe"
  remain_ok
  env -u LC_OWNER_ACCESS_TOKEN \
    PATH="$ENV_PATH" HOME="$ENV_HOME" TMPDIR="$SCRATCH" LANG="$ENV_LANG" LC_ALL="$ENV_LANG" \
    MB014_CREDENTIAL_FILE="$CREDENTIAL" LC_OWNER_GATEWAY_ORIGIN="$GATEWAY_ORIGIN" NODE_NO_WARNINGS=1 \
    node "$PROBE_PATH" >"$SCRATCH/logs/probe.out" 2>"$SCRATCH/logs/probe.err" || true
  python3 - "$SCRATCH/logs/probe.out" "$CREDENTIAL" <<'PY' || die probe-not-empty
import json, pathlib, sys
text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
credential = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
line = next((item for item in reversed(text.splitlines()) if item.startswith("{")), "")
if credential["identifier"] in line or credential["password"] in line:
    raise SystemExit(1)
parsed = json.loads(line) if line else {}
if parsed.get("status") != "OBSERVED" or parsed.get("pass") is not True:
    raise SystemExit(1)
if parsed.get("outcome") != "empty" or parsed.get("itemCount") != 0 or parsed.get("unrelatedWrites") != 0:
    raise SystemExit(1)
if parsed.get("stage") != "pair":
    raise SystemExit(1)
pathlib.Path(sys.argv[1] + ".summary").write_text(json.dumps({
    "status": parsed.get("status"),
    "outcome": parsed.get("outcome"),
    "itemCount": parsed.get("itemCount"),
    "contentLocale": parsed.get("contentLocale"),
    "freshAlias0": parsed.get("freshAlias0") is True,
    "unrelatedWrites": parsed.get("unrelatedWrites"),
}, sort_keys=True), encoding="utf-8")
PY
  PROBE_STATUS="OBSERVED"
  PROBE_OUTCOME="empty"
  PROBE_ITEMS="0"
  PROBE_LOCALE="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("contentLocale") or "")' "$SCRATCH/logs/probe.out.summary")"
  run_h5_lease
}

container_absent() {
  local names labels
  names="$(docker_cmd ps -aq --no-trunc --filter "name=^/${NAME}$" 2>/dev/null || echo FAIL)"
  labels="$(docker_cmd ps -aq --no-trunc --filter "label=cloudstudy.qa.scope=${LABEL}" 2>/dev/null || echo FAIL)"
  [[ "$names" != "FAIL" && "$labels" != "FAIL" && -z "$names" && -z "$labels" ]]
}

release_all() {
  local pid
  if [[ -f "${SCRATCH:-}/pids" ]]; then
    while read -r pid; do
      [[ "$pid" =~ ^[0-9]+$ ]] || continue
      kill -TERM -- "-${pid}" 2>/dev/null || true
    done <"${SCRATCH}/pids"
    sleep 0.8
    while read -r pid; do
      [[ "$pid" =~ ^[0-9]+$ ]] || continue
      kill -KILL -- "-${pid}" 2>/dev/null || true
    done <"${SCRATCH}/pids"
  fi
  if [[ -n "$CONTAINER" ]]; then
    local label got_name
    label="$(docker_cmd inspect -f '{{index .Config.Labels "cloudstudy.qa.scope"}}' "$CONTAINER" 2>/dev/null || true)"
    got_name="$(docker_cmd inspect -f '{{.Name}}' "$CONTAINER" 2>/dev/null || true)"
    got_name="${got_name#/}"
    if [[ "$label" == "$LABEL" && "$got_name" == "$NAME" ]]; then
      docker_cmd stop --timeout 8 "$CONTAINER" >/dev/null 2>&1 || true
      if ! container_absent; then
        docker_cmd rm -f "$CONTAINER" >/dev/null 2>&1 || true
      fi
    fi
  fi
  local i
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    container_absent && break
    sleep 0.25
  done
  if [[ -n "${CREDENTIAL:-}" && -f "${CREDENTIAL:-}" ]]; then
    rm -f "$CREDENTIAL" || true
  fi
  if [[ -n "$SCRATCH" && "$SCRATCH" == "$ROOT"/run.* && -d "$SCRATCH" ]]; then
    rm -rf "$SCRATCH" || true
  fi
  local port busy
  busy=0
  for port in 13306 18070 18087 18088 18089 18183; do
    if port_busy "$port"; then
      busy=1
    fi
  done
  if container_absent && [[ "$busy" == "0" && ! -d "${SCRATCH:-/nonexistent}" ]]; then
    RELEASED=1
  fi
}

write_receipt() {
  [[ -n "$ROOT" && -d "$ROOT" ]] || return 0
  python3 - "$ROOT/runtime-receipt.json" <<PY
import json, os
body = {
    "kind": "MB009_LEARN_SHELF_H5_LEASE_392",
    "status": "${PREFLIGHT}" == "1" and "${REASON}" == "" and "PREFLIGHT" or ("PASS" if "${REASON}" == "" and "${RELEASED}" == "1" and "${PROBE_OUTCOME}" == "empty" and "${SHELF_STATUS}" == "OBSERVED" and "${H5_STARTED}" == "1" else "FAIL"),
    "reason": "${REASON}",
    "stage": "${STAGE}",
    "preflightOnly": "${PREFLIGHT}" == "1",
    "ports": ["13306", "18070", "18087", "18088", "18089", "18183"],
    "untouched": ["18090", "18091"],
    "contentPort": 18089,
    "learningPortNotStarted": 18090,
    "assessmentPortNotStarted": 18091,
    "h5Started": "${H5_STARTED}" == "1",
    "publication": "skipped",
    "runnerBusinessInserts": 0,
    "learnerVisiblePublished": int("${LEARNER_VISIBLE}") if "${LEARNER_VISIBLE}".isdigit() else None,
    "sealedPublished": int("${SEALED_PUBLISHED}") if "${SEALED_PUBLISHED}".isdigit() else None,
    "flywayFailed": int("${FLYWAY_FAILED}") if "${FLYWAY_FAILED}".isdigit() else None,
    "probeStatus": "${PROBE_STATUS}" or None,
    "probeOutcome": "${PROBE_OUTCOME}" or None,
    "probeItemCount": int("${PROBE_ITEMS}") if "${PROBE_ITEMS}" != "" else None,
    "contentLocale": "${PROBE_LOCALE}" or None,
    "shelfStatus": "${SHELF_STATUS}" or None,
    "databaseReleased": "${RELEASED}" == "1",
    "sqlStep": "${SQL_STEP:-}",
    "sqlErrno": int("${SQL_ERRNO:-}") if "${SQL_ERRNO:-}" != "" else None,
}
text = json.dumps(body, sort_keys=True) + "\n"
path = "$ROOT/runtime-receipt.json"
fd = os.open(path, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600)
os.write(fd, text.encode("utf-8"))
os.close(fd)
os.chmod(path, 0o600)
sys_stdout = os.fdopen(1, "w")
sys_stdout.write(text)
PY
}

cleanup() {
  local status=$?
  [[ "$CLEANED" == "1" ]] && exit "$status"
  CLEANED=1
  set +e
  if [[ "$STARTED" == "1" ]]; then
    release_all
    if [[ "$RELEASED" != "1" && -z "$REASON" ]]; then
      REASON="cleanup"
      status=1
    elif [[ "$RELEASED" != "1" && "$status" -eq 0 ]]; then
      status=1
    fi
  fi
  if [[ "$PREFLIGHT" == "1" && -z "$REASON" ]]; then
    if write_receipt && [[ -n "$ROOT" && -f "$ROOT/runtime-receipt.json" ]]; then
      status=0
    else
      status=1
    fi
  else
    write_receipt || true
  fi
  exit "$status"
}

accept_argv() {
  if [[ "$#" -eq 0 ]]; then
    return
  fi
  if [[ "$#" -eq 1 && "$1" == "--preflight-only" ]]; then
    PREFLIGHT=1
    return
  fi
  die argv-rejected
}

main() {
  set -e
  trap cleanup EXIT
  accept_argv "$@"
  preflight
  if [[ "$PREFLIGHT" == "1" ]]; then
    REASON=""
    EXIT_CODE=0
    exit 0
  fi
  STARTED=1
  STARTED_AT="$(date +%s)"
  RUN_ID="$(openssl rand -hex 6)"
  [[ "$RUN_ID" =~ ^[0-9a-f]{12}$ ]] || die run-id
  SCRATCH="$(mktemp -d "${ROOT}/run.${RUN_ID}.XXXXXX")"
  chmod 700 "$SCRATCH"
  mkdir -m 700 "$SCRATCH/logs"
  : >"$SCRATCH/pids"
  base_env
  listeners 18090 >"$SCRATCH/untouched-18090.before" || true
  listeners 18091 >"$SCRATCH/untouched-18091.before" || true
  start_mysql
  prepare_tls
  start_iam
  seed_consents
  start_gateway
  start_learner
  start_content
  assert_genuine_zero
  write_credential
  run_hook
  run_probe
  STAGE="done"
  REASON=""
  exit 0
}

main "$@"


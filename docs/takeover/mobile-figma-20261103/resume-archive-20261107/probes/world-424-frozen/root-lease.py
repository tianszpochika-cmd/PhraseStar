#!/usr/bin/env python3
"""MB424 H5 default-owner lease for MB018.

Derives the sealed G347 IAM/MySQL/Gateway helpers the same way G382 did,
caps Gateway onto gamification 18094, then opens 18183 through the G388
nonce helper and the G424 observer. Authoring did not execute this file.
"""

from __future__ import annotations

import ast
import base64
import errno
import hashlib
import http.client
import json
import os
import shutil
import signal
import socket
import ssl
import stat
import subprocess
import sys
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path

sys.tracebacklimit = 0

JOB = Path("/tmp/grok-mobile-resume-world-repair-424")
RECEIPT = JOB / "world-h5-default-receipt.json"
WRAPPER = JOB / "root-lease.py"
OBSERVER = JOB / "world-default-observer.mjs"
TAIL = JOB / "h5-lease-tail.mjs"
G347_RUNNER = Path("/tmp/grok-mobile-commerce-h5-empty-owned-runtime-347/run-commerce-owner.py")
G337_RUNNER = Path("/tmp/grok-mobile-support-legacy-h5-source-guard-337/run-support-owner.py")
CLASSIFIER = Path("/tmp/grok-mobile-world-real-owner-read-h5-probe-368/world-empty-owner.cjs")
NONCE = Path("/tmp/grok-mobile-learn-shelf-derived-current-h5-lease-388/pinned-static-nonce.mjs")
G382_FROZEN = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/resume-20261105/world-gateway-default-owned-runtime-382-frozen/root-lease.py"
)
G382_RECEIPT = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/resume-20261105/world-gateway-default-owned-runtime-382-root/"
    "gateway-default-receipt.json"
)
BLOCKED_ROOTS = (
    G347_RUNNER.parent,
    G337_RUNNER.parent,
    CLASSIFIER.parent,
    NONCE.parent,
    G382_FROZEN.parent,
    G382_RECEIPT.parent,
    Path("/tmp/grok-mobile-world-gateway-default-owned-runtime-382"),
    Path("/tmp/grok-mobile-world-real-default-wire-owner-377"),
)

KNOWN_MARKER = "MB018-H5-DEFAULT-424"
CONTAINER_NAME = "cloudstudy-mobile-world-h5-default-424"
SCOPE_LABEL = "cloudstudy.qa.mobile-world-h5-default-424"
PORTS = (13306, 18070, 18087, 18094, 18183)
READ_PATHS = (
    "/api/v1/gamification/me/summary",
    "/api/v1/gamification/streak",
    "/api/v1/gamification/quests",
    "/api/v1/gamification/season",
    "/api/v1/gamification/me/rewards",
)
FACT_TABLES = (
    "xp_ledger",
    "coin_ledger",
    "reward_grant",
    "gamification_event_record",
    "gamification_idempotency_record",
    "gamification_active_date",
    "gamification_season_fact",
    "gamification_user_timezone",
    "gamification_outbox_event",
    "gamification_feature_state",
    "gamification_game_session",
)
EXPECTED_CLASSES = {
    "summary": "DEFAULT_PROJECTION",
    "streak": "DEFAULT_ZERO",
    "season": "DEFAULT_CALENDAR_SHELL",
    "quests": "IMPLEMENTED_EMPTY_LIST",
    "rewards": "EMPTY_GRANT_LIST",
}
EXPECTED_BOOTSTRAP = {
    "register": 1,
    "adultGate": 1,
    "consent": 3,
}
GATEWAY_CAP = (
    ("set", "B14_ROUTE_MODE_GAMIFICATION", "LEGACY", "TARGET"),
    ("set", "B14_ROUTE_MODE_COMMERCE", "TARGET", "LEGACY"),
    ("add", "GAMIFICATION_SERVICE_BASE_URL", None, "http://127.0.0.1:18094"),
)
ROUTE_SEALED = {
    "API_GATEWAY_PORT": "18070",
    "B12_SERVICES_ENABLED": "false",
    "B13_SERVICES_ENABLED": "false",
    "B14_ROUTE_MODE_ASSESSMENT": "LEGACY",
    "B14_ROUTE_MODE_COMMERCE": "TARGET",
    "B14_ROUTE_MODE_CONTENT": "LEGACY",
    "B14_ROUTE_MODE_GAMIFICATION": "LEGACY",
    "B14_ROUTE_MODE_LEARNER": "LEGACY",
    "B14_ROUTE_MODE_LEARNING": "LEGACY",
    "B14_ROUTE_MODE_MEDIA": "LEGACY",
    "B14_ROUTE_MODE_SOCIAL": "LEGACY",
    "B14_STRANGLER_ENABLED": "true",
    "COMMERCE_SERVICE_BASE_URL": "http://127.0.0.1:18096",
    "CORE_API_COMPAT_ENABLED": "false",
    "GATEWAY_JWT_PREVALIDATION_ENABLED": "true",
    "GATEWAY_RATE_LIMIT_BACKEND": "memory",
    "GATEWAY_RATE_LIMIT_ENABLED": "true",
    "GATEWAY_RATE_LIMIT_FAIL_OPEN": "false",
    "GATEWAY_RESOURCE_SERVER_ENABLED": "true",
    "GATEWAY_SECURITY_AUDIT_ENABLED": "true",
    "IAM_JWT_AUDIENCE": "yuxuexing-api",
    "IAM_JWT_ISSUER": "http://127.0.0.1:18087",
    "IAM_JWT_JWKS_URI": "https://127.0.0.1:18087/api/v1/auth/jwks",
    "IAM_ROUTE_ENABLED": "true",
    "IAM_SERVICE_BASE_URL": "https://127.0.0.1:18087",
    "MANAGEMENT_HEALTH_REDIS_ENABLED": "false",
    "SERVER_ADDRESS": "127.0.0.1",
    "SPRING_PROFILES_ACTIVE": "local",
    "WORKFLOW_SERVICES_ENABLED": "false",
}
PINNED = (
    "remember_secret",
    "sha256_file",
    "require_file",
    "parent_pid",
    "signal_verified",
    "run_command",
    "docker",
    "java_bin",
    "hex_id",
    "full_id",
    "docker_inspect",
    "owned_exact_name",
    "exact_filter_ids",
    "require_name_absent",
    "created_unix",
    "loopback_bindings",
    "ports_match",
    "mounts_disposable",
    "identity_matches",
    "remember_id",
    "candidate_ids",
    "adopt_container",
    "mysql_root",
    "start_mysql",
    "prepare_tls",
    "base_env",
    "spawn_service",
    "wait_http",
    "start_iam",
    "extract_connector",
    "seed_fixture",
    "start_gateway",
    "make_scratch",
    "require_python",
    "require_java",
    "require_tools",
    "require_docker_context",
    "require_image",
    "listeners",
    "require_ports_free",
    "profile_active",
    "exact_id_state",
    "release_owned_container",
    "release_truth",
    "remove_scratch",
)
SEALED = ("prepare_tls", "start_iam", "extract_connector")
MYSQL_RUN = (
    '"run", "--pull=never", "--rm", "--detach", "--cidfile", str(cid_path),\n'
    '                    "--name", NAME, "--label", f"cloudstudy.qa.scope={LABEL}",\n'
    '                    "--cpus=1", "--memory=768m",\n'
    '                    "--tmpfs", "/var/lib/mysql:rw,nosuid,size=512m",\n'
    '                    "--env-file", str(env_path),\n'
    '                    "-p", "127.0.0.1:13306:3306", "mysql:8.0",\n'
    '                    "--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci",\n'
    '                    "--innodb-buffer-pool-size=64M", "--max-connections=40", "--performance-schema=OFF",'
)
ACTOR_ORIGIN = "http://127.0.0.1:18183"
CANDIDATE = Path("/Users/Admin/.codex/worktrees/mobile-iam-http-acceptance-20261105/cloudstudy")
VIS = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/resume-20261105"
)
IAM_JAR = CANDIDATE / "services/iam-service/target/iam-service-0.1.0-SNAPSHOT.jar"
IAM_SHA = "98f6b2d6b8c44de9d94f44bcf498d154f009c52faf4aa3615d2a9e513b390007"
GATEWAY_JAR = CANDIDATE / "services/api-gateway/target/api-gateway-0.1.0-SNAPSHOT.jar"
GATEWAY_SHA = "7f796cfb60f571beb155ce3fad87a3e9e6cb13ddddd3f91e2ca9d9771ca6a0a1"
FIXTURE = CANDIDATE / "apps/mobile/tests/fixtures/mock-consent-publication.json"
FIXTURE_SHA = "aaf60cd02f10ae6eec3534edd9bc304baa7b9cc6b766012591d98f2430ac9846"
SEED_JAVA = VIS / "iam-http-24-dsh-draft" / "seed" / "Seed.java"
SEED_JAVA_SHA = "248094e5a2e6ceb2f1c5433a15d8908dad194e0b0d5e6a421987a5c6c998536e"
SEED_SQL = VIS / "iam-http-24-dsh-draft" / "sql" / "seed-full.sql"
SEED_SQL_SHA = "c507b3fe1c8078700e177d4a168619e69c1c5f7136243e6a98f72d412403fbd9"
GAMIFICATION_JAR = VIS / "world-read-only-owner-combined-352-root" / "gamification-b138.jar"
GAMIFICATION_SHA = "42c97423e9ea1d2dbe917530730637b251953325368fa0cc53bd59e89261aaca"
B139_H5 = VIS / "reading-practice-integrated-g351-root" / "h5"
B139_INDEX = B139_H5 / "index.html"
B139_SHA = "706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32"
B116_SHA = "94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520"
G382_FROZEN_SHA = "3a2e78d7cfdd79f31c47b1be83d0315ce3fa656454258217e8963ec417ef164a"
MYSQL_IMAGE = "sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b"
DOCKER_CONTEXT = "desktop-linux"
DOCKER_ENDPOINT = "unix:///Users/Admin/.docker/run/docker.sock"
IAM_USER = "iam_mobile_http_probe"
GAMIFICATION_USER = "svc_gamification"
JDBC_QUERY = (
    "useUnicode=true&characterEncoding=utf8&serverTimezone=UTC"
    "&useSSL=false&allowPublicKeyRetrieval=true"
)
IAM_JDBC = f"jdbc:mysql://127.0.0.1:13306/iam_service?{JDBC_QUERY}"
GAMIFICATION_JDBC = f"jdbc:mysql://127.0.0.1:13306/gamification_service?{JDBC_QUERY}"
MEMORY = ["-Xms64m", "-Xmx384m", "-XX:ActiveProcessorCount=2"]
JAR_PREFIX = "BOOT-INF/classes/db/migration/"
GATEWAY_CLASS = "BOOT-INF/classes/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.class"
IAM_V19 = "BOOT-INF/classes/db/migration/V19__add_iam_consent_document_body.sql"
WORLD_CHUNK = "pages-world-world.12rRwasU.js"
TAIL_TIMEOUT_SECONDS = 180


class Stop(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class Runtime:
    def __init__(self) -> None:
        self.reason = "not-started"
        self.stage = "not-started"
        self.scratch: Path | None = None
        self.container = ""
        self.processes: list[subprocess.Popen[bytes]] = []
        self.secrets: list[str] = []
        self.evidence: dict[str, object] = {}
        self.launch_attempted = False
        self.launch_unix: float | None = None
        self.auto_removed = False
        self.identity_ambiguous = False
        self.exact_name_mismatch = False
        self.owned_container_id = ""
        self.explicit_removed = False
        self.preflight_only = False
        self.business_window = False
        self.gateway_caps = 0
        self.ledger = {key: 0 for key in EXPECTED_BOOTSTRAP}
        self.hook_parent = 0
        self.browser_pids: list[int] = []
        self.ns: dict[str, object] | None = None


RT = Runtime()


def same_exact(left: Path, right: Path) -> bool:
    def canonical(path: Path) -> tuple[str, int, int] | None:
        try:
            listed = path.lstat()
        except OSError:
            return None
        if stat.S_ISLNK(listed.st_mode) or not stat.S_ISREG(listed.st_mode):
            return None
        try:
            real = os.path.realpath(path, strict=True)
            stated = os.lstat(real)
        except (OSError, ValueError):
            return None
        if stat.S_ISLNK(stated.st_mode) or not stat.S_ISREG(stated.st_mode):
            return None
        if (listed.st_dev, listed.st_ino) != (stated.st_dev, stated.st_ino):
            return None
        return (real, stated.st_dev, stated.st_ino)

    actual = canonical(left)
    authorized = canonical(right)
    return actual is not None and actual == authorized


def require_guard() -> None:
    if not same_exact(Path(__file__), WRAPPER) or not same_exact(Path(sys.argv[0]), WRAPPER):
        raise Stop("script-root")
    args = sys.argv[1:]
    if args == ["--preflight-only"]:
        RT.preflight_only = True
        return
    if args:
        raise Stop("argv-rejected")


def authorize_write(path: Path) -> Path:
    raw = os.path.realpath(path)
    root = os.path.realpath(JOB)
    if raw != root and not raw.startswith(root + os.sep):
        raise Stop("source-write")
    for blocked in BLOCKED_ROOTS:
        prefix = os.path.realpath(blocked)
        if raw == prefix or raw.startswith(prefix + os.sep):
            raise Stop("source-write")
    return Path(raw)


def guard_rejects_original() -> None:
    for sample in (G347_RUNNER, G337_RUNNER, CLASSIFIER, NONCE, G382_FROZEN, G382_RECEIPT, *BLOCKED_ROOTS):
        try:
            authorize_write(sample)
        except Stop as stopped:
            if stopped.reason != "source-write":
                raise
            continue
        raise Stop("source-write")


def read_source(path: Path) -> str:
    try:
        info = path.lstat()
    except OSError:
        raise Stop("source-pin") from None
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
        raise Stop("source-pin")
    return path.read_text(encoding="utf-8")


def function_sources(text: str) -> dict[str, str]:
    try:
        tree = ast.parse(text)
    except SyntaxError:
        raise Stop("source-pin") from None
    found: dict[str, str] = {}
    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            segment = ast.get_source_segment(text, node)
            if not segment:
                raise Stop("source-pin")
            found[node.name] = segment
    return found


def require_rebind(ns: dict[str, object]) -> None:
    if ns.get("JOB") != JOB or ns.get("NAME") != CONTAINER_NAME or ns.get("LABEL") != SCOPE_LABEL:
        raise Stop("script-root")
    if ns.get("OWNED_EXACT_NAME") != f"/{CONTAINER_NAME}":
        raise Stop("script-root")
    if tuple(ns.get("PORTS") or ()) != PORTS:
        raise Stop("ports-busy")
    if 18183 not in PORTS or 18096 in PORTS or 18088 in PORTS:
        raise Stop("ports-busy")


def derive(ns: dict[str, object]) -> None:
    g347 = read_source(G347_RUNNER)
    g337 = read_source(G337_RUNNER)
    if g347.count(MYSQL_RUN) != 1 or g337.count(MYSQL_RUN) != 1:
        raise Stop("sealed-mysql")
    left = function_sources(g347)
    right = function_sources(g337)
    missing = [name for name in PINNED if name not in left]
    if missing:
        raise Stop("source-pin")
    for name in SEALED:
        if left.get(name) != right.get(name):
            raise Stop("sealed-iam")
    gateway = left["start_gateway"]
    mysql = left["start_mysql"]
    iam = left["start_iam"]
    if gateway.count("spawn_service(") != 1 or "18094" in gateway or "18183" in gateway:
        raise Stop("gateway-cap")
    if 'B14_ROUTE_MODE_COMMERCE": "TARGET"' not in gateway:
        raise Stop("gateway-cap")
    if 'for domain in ("LEARNER", "CONTENT", "LEARNING", "ASSESSMENT", "MEDIA", "GAMIFICATION", "SOCIAL")' not in gateway:
        raise Stop("gateway-cap")
    if mysql.count("apply_commerce_schema(container, commerce)") != 1:
        raise Stop("source-pin")
    if "gamification" in mysql or "18094" in mysql:
        raise Stop("source-pin")
    if "18094" in iam or "GAMIFICATION" in iam or 'IAM_JWT_ALGORITHM": "RS256"' not in iam:
        raise Stop("sealed-iam")
    if "control-plane" not in iam or "18087" not in iam:
        raise Stop("sealed-iam")
    ordered = [left[name] for name in PINNED]
    exec(compile("\n\n".join(ordered), "<g347-derived>", "exec"), ns, ns)
    if any(name not in ns for name in PINNED):
        raise Stop("source-pin")
    if "start_commerce" in ns or "run_hook" in ns or "write_evidence" in ns:
        raise Stop("source-pin")


def cap_gateway(env: dict[str, str]) -> dict[str, str]:
    for key, value in ROUTE_SEALED.items():
        if env.get(key) != value:
            raise Stop("gateway-cap")
    if "GAMIFICATION_SERVICE_BASE_URL" in env:
        raise Stop("gateway-cap")
    for value in env.values():
        if ":18183" in str(value) or ":18094" in str(value):
            raise Stop("gateway-cap")
    changed = dict(env)
    for kind, key, previous, new in GATEWAY_CAP:
        if kind == "set":
            if changed.get(key) != previous:
                raise Stop("gateway-cap")
            changed[key] = new
        elif kind == "add":
            if key in changed:
                raise Stop("gateway-cap")
            changed[key] = new
        else:
            raise Stop("gateway-cap")
    delta = sorted(key for key in set(env) | set(changed) if env.get(key) != changed.get(key))
    if delta != ["B14_ROUTE_MODE_COMMERCE", "B14_ROUTE_MODE_GAMIFICATION", "GAMIFICATION_SERVICE_BASE_URL"]:
        raise Stop("gateway-cap")
    if changed["B14_ROUTE_MODE_GAMIFICATION"] != "TARGET" or changed["B14_ROUTE_MODE_COMMERCE"] != "LEGACY":
        raise Stop("gateway-cap")
    if changed["GAMIFICATION_SERVICE_BASE_URL"] != "http://127.0.0.1:18094":
        raise Stop("gateway-cap")
    RT.gateway_caps += 1
    return changed


def jar_entries() -> list[str]:
    names: list[tuple[int, str]] = []
    with zipfile.ZipFile(GAMIFICATION_JAR) as archive:
        for name in archive.namelist():
            if not name.startswith(JAR_PREFIX) or not name.endswith(".sql"):
                continue
            leaf = name[len(JAR_PREFIX):]
            if not leaf.startswith("V") or "__" not in leaf:
                raise Stop("gamification-migration")
            number = leaf[1:].split("__", 1)[0]
            if not number.isdigit():
                raise Stop("gamification-migration")
            names.append((int(number), name))
    versions = [number for number, _name in sorted(names)]
    if versions != [1, 2, 3, 4]:
        raise Stop("gamification-migration")
    return [name for _number, name in sorted(names)]


def jar_text(entry: str) -> str:
    with zipfile.ZipFile(GAMIFICATION_JAR) as archive:
        return archive.read(entry).decode("utf-8")


def apply_gamification_schema(container: str, commerce: str) -> None:
    RT.stage = "gamification-schema"
    if len(commerce) != 36:
        raise Stop("db-secrets")
    grant = (
        "CREATE DATABASE gamification_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n"
        f"CREATE USER '{GAMIFICATION_USER}'@'%' IDENTIFIED BY '{commerce}';\n"
        f"GRANT SELECT, INSERT, UPDATE, DELETE ON gamification_service.* TO '{GAMIFICATION_USER}'@'%';\n"
        "FLUSH PRIVILEGES;\n"
    )
    ns_root = apply_gamification_schema.root
    ns_root(container, grant)
    for entry in jar_entries():
        ns_root(container, "USE gamification_service;\n" + jar_text(entry))
    shown = ns_root(
        container,
        "SELECT TABLE_NAME FROM information_schema.TABLES "
        "WHERE TABLE_SCHEMA = 'gamification_service' AND TABLE_TYPE = 'BASE TABLE' "
        "ORDER BY TABLE_NAME;\n",
    )
    present = {line.strip() for line in shown.splitlines() if line.strip()}
    if present != set(FACT_TABLES):
        raise Stop("gamification-migration")


def install(ns: dict[str, object]) -> None:
    original_root = ns["mysql_root"]

    def mysql_root(container: str, sql: str) -> str:
        if RT.business_window:
            raise Stop("extra-write")
        return original_root(container, sql)

    apply_gamification_schema.root = mysql_root
    ns["apply_commerce_schema"] = apply_gamification_schema
    ns["mysql_root"] = mysql_root
    original_spawn = ns["spawn_service"]

    def spawn_service(args: list[str], env: dict[str, str], log_path: Path) -> subprocess.Popen[bytes]:
        if isinstance(env, dict) and "API_GATEWAY_PORT" in env and "B14_STRANGLER_ENABLED" in env:
            env = cap_gateway(dict(env))
        return original_spawn(args, env, log_path)

    ns["spawn_service"] = spawn_service


def build_namespace() -> dict[str, object]:
    ns: dict[str, object] = {
        "__builtins__": __builtins__,
        "os": os,
        "sys": sys,
        "errno": errno,
        "hashlib": hashlib,
        "json": json,
        "shutil": shutil,
        "signal": signal,
        "socket": socket,
        "stat": stat,
        "subprocess": subprocess,
        "time": time,
        "zipfile": zipfile,
        "datetime": datetime,
        "timezone": timezone,
        "Path": Path,
        "Stop": Stop,
        "RT": RT,
        "JOB": JOB,
        "NAME": CONTAINER_NAME,
        "LABEL": SCOPE_LABEL,
        "OWNED_EXACT_NAME": f"/{CONTAINER_NAME}",
        "PORTS": PORTS,
        "IAM_USER": IAM_USER,
        "IAM_JAR": IAM_JAR,
        "IAM_JDBC": IAM_JDBC,
        "GATEWAY_JAR": GATEWAY_JAR,
        "SEED_JAVA": SEED_JAVA,
        "SEED_SQL": SEED_SQL,
        "MYSQL_IMAGE": MYSQL_IMAGE,
        "DOCKER_CONTEXT": DOCKER_CONTEXT,
        "DOCKER_ENDPOINT": DOCKER_ENDPOINT,
        "MEMORY": MEMORY,
    }
    derive(ns)
    install(ns)
    require_rebind(ns)
    RT.ns = ns
    return ns


def leaked(text: str) -> bool:
    if "Bearer " in text or "eyJ" in text:
        return True
    for secret in RT.secrets:
        if secret and len(secret) >= 8 and secret in text:
            return True
    return False


def zeros(counts: dict[str, int] | None) -> bool:
    if not isinstance(counts, dict):
        return False
    return all(counts.get(table) == 0 for table in FACT_TABLES)


def select_facts(ns: dict[str, object], container: str, password: str) -> dict[str, int]:
    sql = " UNION ALL ".join(f"SELECT '{table}', COUNT(*) FROM {table}" for table in FACT_TABLES) + ";\n"
    if not sql.lstrip().upper().startswith("SELECT"):
        raise Stop("sql-not-readonly")
    code, out, _err = ns["docker"](
        ["exec", "-i", "-e", f"MYSQL_PWD={password}", container,
         "mysql", "--protocol=TCP", "--host=127.0.0.1", f"--user={GAMIFICATION_USER}",
         "--database=gamification_service", "--batch", "--skip-column-names"],
        20,
        sql,
    )
    if code != 0:
        raise Stop("sql-read")
    found: dict[str, int] = {}
    for line in out.splitlines():
        if not line.strip():
            continue
        table, separator, count = line.partition("\t")
        if separator != "\t" or table not in FACT_TABLES or not count.isdigit():
            raise Stop("sql-read")
        found[table] = int(count)
    if set(found) != set(FACT_TABLES):
        raise Stop("sql-read")
    return found


def prove_scope(ns: dict[str, object], container: str, password: str) -> None:
    RT.stage = "db-grant"
    ready = select_facts(ns, container, password)
    if not zeros(ready):
        raise Stop("startup-write")
    privileges = ns["mysql_root"](
        container,
        "SELECT PRIVILEGE_TYPE FROM information_schema.schema_privileges "
        f"WHERE grantee = \"'{GAMIFICATION_USER}'@'%'\" AND table_schema = 'gamification_service' "
        "ORDER BY PRIVILEGE_TYPE;\n"
        "SELECT COUNT(*) FROM information_schema.table_privileges "
        f"WHERE grantee = \"'{GAMIFICATION_USER}'@'%'\";\n"
        "SELECT COUNT(*) FROM information_schema.schema_privileges "
        f"WHERE grantee = \"'{GAMIFICATION_USER}'@'%'\" AND table_schema = 'iam_service';\n"
        "SELECT COUNT(*) FROM information_schema.schema_privileges "
        f"WHERE grantee = \"'{IAM_USER}'@'%'\" AND table_schema = 'gamification_service';\n",
    )
    rows = [line.strip() for line in privileges.splitlines() if line.strip()]
    if rows != ["DELETE", "INSERT", "SELECT", "UPDATE", "0", "0", "0"]:
        raise Stop("db-grant-scope")
    code, _out, _err = ns["docker"](
        ["exec", "-i", "-e", f"MYSQL_PWD={password}", container,
         "mysql", "--protocol=TCP", "--host=127.0.0.1", f"--user={GAMIFICATION_USER}",
         "--database=gamification_service", "--batch", "--skip-column-names"],
        20,
        "CREATE TABLE mb424_ddl_should_fail (id INT);\n",
    )
    if code == 0:
        ns["mysql_root"](container, "DROP TABLE IF EXISTS gamification_service.mb424_ddl_should_fail;\n")
        raise Stop("db-grant-scope")
    cross, _out, _err = ns["docker"](
        ["exec", container, "sh", "-c",
         'MYSQL_PWD="$MYSQL_PASSWORD" mysql --protocol=TCP --host=127.0.0.1 '
         '--user="$MYSQL_USER" --database=gamification_service --batch --skip-column-names '
         '-e "SELECT COUNT(*) FROM xp_ledger"'],
        15,
    )
    if cross == 0:
        raise Stop("db-grant-scope")


def zip_has(path: Path, entry: str) -> bool:
    with zipfile.ZipFile(path) as archive:
        try:
            archive.getinfo(entry)
        except KeyError:
            return False
    return True


def pin(ns: dict[str, object]) -> None:
    ns["require_file"](IAM_JAR, IAM_SHA, "iam-jar-pin")
    ns["require_file"](GATEWAY_JAR, GATEWAY_SHA, "gateway-jar-pin")
    ns["require_file"](FIXTURE, FIXTURE_SHA, "fixture-pin")
    ns["require_file"](SEED_JAVA, SEED_JAVA_SHA, "seed-java-pin")
    ns["require_file"](SEED_SQL, SEED_SQL_SHA, "seed-sql-pin")
    ns["require_file"](GAMIFICATION_JAR, GAMIFICATION_SHA, "gamification-jar-pin")
    ns["require_file"](G382_FROZEN, G382_FROZEN_SHA, "g382-frozen")
    ns["require_file"](B139_INDEX, B139_SHA, "b139-index")
    if ns["sha256_file"](B139_INDEX) == B116_SHA:
        raise Stop("b116-index")
    chunk = B139_H5 / "assets" / WORLD_CHUNK
    if not chunk.is_file():
        raise Stop("world-chunk")
    if not zip_has(IAM_JAR, IAM_V19):
        raise Stop("migration-absent")
    with zipfile.ZipFile(GATEWAY_JAR) as archive:
        try:
            blob = archive.read(GATEWAY_CLASS)
        except KeyError:
            raise Stop("prefix-routing-absent") from None
    for path in READ_PATHS:
        if path.encode("utf-8") not in blob:
            raise Stop("prefix-routing-absent")
    entries = jar_entries()
    if len(entries) != 4:
        raise Stop("gamification-migration")
    classifier = read_source(CLASSIFIER)
    if "function classifyRead" not in classifier or "DEFAULT_OWNER_EMPTY" not in classifier:
        raise Stop("classifier-pin")
    if "function observeWorldOwner" not in classifier or "b116-index" not in classifier:
        raise Stop("classifier-pin")
    nonce = read_source(NONCE)
    if "openPinnedNonceStatic" not in nonce or B139_SHA not in nonce:
        raise Stop("nonce-pin")
    if B116_SHA not in nonce or "x-mb004-static-qa" not in nonce:
        raise Stop("nonce-pin")
    observer = read_source(OBSERVER)
    if "observeWorldDefault" not in observer or B139_SHA not in observer:
        raise Stop("observer-pin")
    if "route.fulfill(" in observer or "unused-for-live-b139" not in observer:
        raise Stop("observer-pin")
    tail = read_source(TAIL)
    if "openPinnedNonceStatic" not in tail or "observeWorldDefault" not in tail:
        raise Stop("observer-pin")
    if KNOWN_MARKER not in observer or KNOWN_MARKER not in tail:
        raise Stop("marker")


def receipt_blocks() -> None:
    try:
        RECEIPT.lstat()
    except FileNotFoundError:
        return
    raise Stop("replay-refused")


def data_of(parsed: object) -> dict | None:
    if isinstance(parsed, dict) and isinstance(parsed.get("data"), dict):
        return parsed["data"]
    return None


def http_exchange(method: str, url: str, body: object, headers: dict[str, str], ca: str) -> tuple[int, object]:
    parsed = urllib_parse(url)
    if parsed.hostname != "127.0.0.1":
        raise Stop("extra-write")
    if parsed.scheme == "https" and parsed.port == 18087:
        context = ssl.create_default_context(cafile=ca)
        connection: http.client.HTTPConnection = http.client.HTTPSConnection(
            "127.0.0.1", 18087, timeout=12, context=context,
        )
    elif parsed.scheme == "http" and parsed.port == 18070:
        connection = http.client.HTTPConnection("127.0.0.1", 18070, timeout=12)
    else:
        raise Stop("extra-write")
    payload = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    sent = dict(headers)
    if payload is not None:
        sent["content-type"] = "application/json"
        sent["content-length"] = str(len(payload))
    try:
        connection.request(method, parsed.path, body=payload, headers=sent)
        response = connection.getresponse()
        raw = response.read(1024 * 1024 + 1)
        status = response.status
    finally:
        connection.close()
    if len(raw) > 1024 * 1024:
        raise Stop("response-too-large")
    if not raw:
        return status, None
    try:
        return status, json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        return status, None


def urllib_parse(url: str):
    import urllib.parse
    return urllib.parse.urlsplit(url)


def actor_headers(token: str | None, key: str | None) -> dict[str, str]:
    headers = {
        "accept": "application/json",
        "origin": ACTOR_ORIGIN,
        "referer": ACTOR_ORIGIN + "/",
    }
    if token:
        headers["authorization"] = f"Bearer {token}"
    if key:
        headers["idempotency-key"] = key
    return headers


def remember(value: str) -> str:
    if value and value not in RT.secrets:
        RT.secrets.append(value)
    return value


def tick(name: str) -> None:
    if RT.ledger.get(name, 0) >= EXPECTED_BOOTSTRAP[name]:
        raise Stop("extra-write")
    RT.ledger[name] += 1


def acceptable(value: str, low: int, high: int) -> bool:
    if not low <= len(value) <= high:
        return False
    return not any(ord(char) <= 31 or ord(char) == 127 or char.isspace() for char in value)


def load_documents() -> list[dict[str, str]]:
    parsed = json.loads(FIXTURE.read_text(encoding="utf-8"))
    documents = parsed.get("documents") if isinstance(parsed, dict) else None
    if not isinstance(parsed, dict) or parsed.get("fixtureScope") != "SYNTHETIC_TEST_ONLY":
        raise Stop("fixture-shape")
    if not isinstance(documents, list):
        raise Stop("fixture-shape")
    order = [item.get("type") if isinstance(item, dict) else None for item in documents]
    if order != ["TERMS", "PRIVACY", "ADULT_LEARNING"]:
        raise Stop("fixture-shape")
    loaded = []
    for item in documents:
        loaded.append({
            "type": item["type"],
            "version": item["documentVersion"],
            "digest": item["documentDigest"],
        })
    return loaded


def approve_actor(ca: str) -> dict[str, str]:
    run_id = os.urandom(4).hex()
    identifier = remember(f"mb424-{run_id}@example.invalid")
    password = remember("Mb424!" + base64.urlsafe_b64encode(os.urandom(18)).decode("ascii").rstrip("="))
    if not acceptable(identifier, 3, 128) or not acceptable(password, 12, 128) or len(run_id) != 8:
        raise Stop("actor-shape")
    device = {"deviceType": "H5", "clientVersion": "local-dev", "deviceName": "语学星移动端"}
    tick("register")
    status, parsed = http_exchange(
        "POST",
        "https://127.0.0.1:18087/api/v1/auth/register",
        {"identifier": identifier, "password": password, "device": device},
        actor_headers(None, f"mb424-{run_id}-register"),
        ca,
    )
    if isinstance(parsed, dict) and isinstance(parsed.get("error"), dict):
        if parsed["error"].get("message") == "iam.consent.version_unavailable":
            raise Stop("consent-publication-absent")
    registered = data_of(parsed)
    token = registered.get("accessToken") if registered else None
    if status != 201 or not isinstance(token, str):
        raise Stop("register")
    token = remember(token)
    tick("adultGate")
    status, parsed = http_exchange(
        "POST",
        "http://127.0.0.1:18070/api/v1/iam/adult-gate",
        {"confirmed": True, "birthYear": 1995, "policyVersion": "b30-adult-v1"},
        actor_headers(token, f"mb424-{run_id}-adult"),
        ca,
    )
    adult = data_of(parsed)
    if status != 200 or adult is None or adult.get("status") != "PASSED" or adult.get("learningAccess") != "ELIGIBLE":
        raise Stop("adult-gate")
    for document in load_documents():
        tick("consent")
        status, parsed = http_exchange(
            "PUT",
            "http://127.0.0.1:18070/api/v1/iam/consents",
            {
                "type": document["type"],
                "version": document["version"],
                "decision": "ACCEPTED",
                "expectedDocumentDigest": document["digest"],
            },
            actor_headers(token, f"mb424-{run_id}-{document['type'].lower()}"),
            ca,
        )
        consent = data_of(parsed)
        if status != 200 or consent is None or consent.get("state") != "GRANTED" or consent.get("decision") != "ACCEPTED":
            raise Stop("consent")
    if RT.ledger != EXPECTED_BOOTSTRAP:
        raise Stop("extra-write")
    return {"identifier": identifier, "password": password, "runId": run_id}


def start_gamification(ns: dict[str, object], tls: dict[str, str], password: str, log_path: Path) -> None:
    env = ns["base_env"]()
    env.update({
        "SERVER_ADDRESS": "127.0.0.1",
        "SERVER_PORT": "18094",
        "GAMIFICATION_SERVICE_PORT": "18094",
        "SPRING_PROFILES_ACTIVE": "v2,local-real",
        "LOCAL_RUNTIME_MODE": "local-real",
        "TZ": "Asia/Shanghai",
        "SPRING_DATASOURCE_URL": GAMIFICATION_JDBC,
        "SPRING_DATASOURCE_USERNAME": GAMIFICATION_USER,
        "SPRING_DATASOURCE_PASSWORD": password,
        "GAMIFICATION_SCHEMA": "gamification_service",
        "GAMIFICATION_FLYWAY_ENABLED": "false",
        "SPRING_FLYWAY_ENABLED": "false",
        "GAMIFICATION_RESOURCE_SERVER_ENABLED": "true",
        "GAMIFICATION_SECURITY_ISSUER_URI": "http://127.0.0.1:18087",
        "GAMIFICATION_SECURITY_JWK_SET_URI": "https://127.0.0.1:18087/api/v1/auth/jwks",
        "GAMIFICATION_SECURITY_AUDIENCE": "yuxuexing-api",
        "GAMIFICATION_EVENT_CONSUMER_ENABLED": "false",
        "GAMIFICATION_DEFAULT_TIME_ZONE": "Asia/Shanghai",
    })
    if "GAMIFICATION_FEATURE_ENABLED" in env or env.get("GAMIFICATION_EVENT_CONSUMER_ENABLED") != "false":
        raise Stop("profile")
    args = [
        ns["java_bin"]("java"), *MEMORY,
        "-Dfile.encoding=UTF-8",
        "-Duser.timezone=Asia/Shanghai",
        f"-Djava.io.tmpdir={log_path.parent}",
        f"-Djavax.net.ssl.trustStore={tls['trustStore']}",
        "-Djavax.net.ssl.trustStoreType=PKCS12",
        f"-Djavax.net.ssl.trustStorePassword={tls['trustPassword']}",
        "-Dio.netty.handler.ssl.noOpenSsl=true",
        "-jar", str(GAMIFICATION_JAR),
        "--server.address=127.0.0.1",
        "--server.port=18094",
        "--spring.profiles.active=v2,local-real",
        "--local.runtime.mode=local-real",
    ]
    proc = ns["spawn_service"](args, env, log_path)
    ns["wait_http"](18094, "/actuator/health/readiness", proc)


def node_env() -> dict[str, str]:
    return {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin:/usr/sbin:/sbin"),
        "HOME": os.environ.get("HOME", ""),
        "TMPDIR": str(RT.scratch) if RT.scratch is not None else str(JOB),
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "NODE_NO_WARNINGS": "1",
    }


def command_of(proc: subprocess.Popen[bytes]) -> list[str]:
    args = proc.args
    if isinstance(args, (list, tuple)):
        return [str(item) for item in args]
    return [str(args)]


def is_tail_process(proc: subprocess.Popen[bytes]) -> bool:
    return any(item.endswith("h5-lease-tail.mjs") for item in command_of(proc))


def is_java_process(proc: subprocess.Popen[bytes]) -> bool:
    command = command_of(proc)
    return bool(command) and Path(command[0]).name == "java"


def snapshot_browser_children(ns: dict[str, object], parent: int) -> list[int]:
    if parent <= 1:
        return []
    try:
        code, out, _err = ns["run_command"](["ps", "-ax", "-o", "pid=,ppid=,command="], 5)
    except Stop:
        return []
    if code != 0:
        return []
    found: list[int] = []
    for line in out.splitlines():
        parts = line.strip().split(None, 2)
        if len(parts) != 3 or not parts[0].isdigit() or not parts[1].isdigit():
            continue
        pid = int(parts[0])
        ppid = int(parts[1])
        command = parts[2].lower()
        if ppid != parent or pid <= 1:
            continue
        if "chrome" not in command and "chromium" not in command:
            continue
        if "python" in command or command.strip().startswith("ps "):
            continue
        found.append(pid)
    return found


def blank_reap() -> dict[str, int]:
    return {"signaled": 0, "reaped": 0, "unverified": 0, "remaining": 0}


def reap_settled(counts: object) -> bool:
    if counts == "not-started":
        return True
    if not isinstance(counts, dict):
        return False
    signaled = counts.get("signaled", 0)
    reaped = counts.get("reaped", 0)
    unverified = counts.get("unverified", 0)
    remaining = counts.get("remaining", 0)
    if not all(isinstance(item, int) and item >= 0 for item in (signaled, reaped, unverified, remaining)):
        return False
    if remaining or unverified:
        return False
    return signaled <= reaped


def verified_exit(proc: subprocess.Popen[bytes]) -> bool:
    if proc.poll() is not None:
        return True
    try:
        proc.wait(timeout=1)
    except subprocess.TimeoutExpired:
        return False
    return proc.poll() is not None


def release_popen(ns: dict[str, object], procs: list[subprocess.Popen[bytes]], pause: float) -> dict[str, int]:
    counts = blank_reap()
    armed: list[subprocess.Popen[bytes]] = []
    for proc in procs:
        if proc.poll() is not None:
            counts["reaped"] += 1
            continue
        state = ns["signal_verified"](proc, signal.SIGTERM)
        if state == "signaled":
            counts["signaled"] += 1
            armed.append(proc)
            continue
        if state == "reaped" and verified_exit(proc):
            counts["reaped"] += 1
            continue
        counts["unverified"] += 1
        if proc.poll() is None:
            counts["remaining"] += 1
    if armed and pause > 0:
        time.sleep(pause)
    still: list[subprocess.Popen[bytes]] = []
    for proc in armed:
        if proc.poll() is not None:
            counts["reaped"] += 1
        else:
            still.append(proc)
    for proc in still:
        state = ns["signal_verified"](proc, signal.SIGKILL)
        if state not in {"signaled", "reaped"}:
            counts["unverified"] += 1
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            pass
        if proc.poll() is not None:
            counts["reaped"] += 1
        else:
            counts["remaining"] += 1
            counts["unverified"] += 1
    return counts


def release_tail(ns: dict[str, object]) -> dict[str, int]:
    tails = [proc for proc in RT.processes if is_tail_process(proc)]
    return release_popen(ns, tails, 0.5)


def browser_command(ns: dict[str, object], pid: int) -> str | None:
    try:
        code, out, _err = ns["run_command"](["ps", "-p", str(pid), "-o", "command="], 5)
    except Stop:
        return None
    if code != 0:
        return ""
    return out.lower()


def release_browser(ns: dict[str, object], pids: list[int], parent: int) -> dict[str, int]:
    counts = blank_reap()
    if not pids or parent <= 1:
        return counts
    owned: list[int] = []
    for pid in pids:
        parent_now = ns["parent_pid"](pid)
        if parent_now not in {parent, 1}:
            counts["unverified"] += 1
            continue
        command = browser_command(ns, pid)
        if command is None:
            counts["unverified"] += 1
            continue
        if command == "":
            counts["reaped"] += 1
            continue
        if "chrome" not in command and "chromium" not in command:
            counts["unverified"] += 1
            continue
        owned.append(pid)
    for sig in (signal.SIGTERM, signal.SIGKILL):
        if not owned:
            break
        for pid in list(owned):
            command = browser_command(ns, pid)
            if command is None:
                counts["unverified"] += 1
                owned.remove(pid)
                continue
            if command == "":
                counts["reaped"] += 1
                owned.remove(pid)
                continue
            if "chrome" not in command and "chromium" not in command:
                counts["unverified"] += 1
                owned.remove(pid)
                continue
            try:
                os.kill(pid, sig)
            except OSError as error:
                if error.errno == errno.ESRCH:
                    counts["reaped"] += 1
                else:
                    counts["unverified"] += 1
                owned.remove(pid)
                continue
            if sig == signal.SIGTERM:
                counts["signaled"] += 1
        time.sleep(0.4)
    for pid in owned:
        command = browser_command(ns, pid)
        if command == "":
            counts["reaped"] += 1
            continue
        if command is None:
            counts["unverified"] += 1
            counts["remaining"] += 1
            continue
        try:
            os.kill(pid, 0)
        except OSError as error:
            if error.errno == errno.ESRCH:
                counts["reaped"] += 1
            else:
                counts["unverified"] += 1
                counts["remaining"] += 1
            continue
        counts["remaining"] += 1
    return counts


def release_java(ns: dict[str, object]) -> dict[str, int]:
    javas = [proc for proc in RT.processes if is_java_process(proc)]
    return release_popen(ns, javas, 0.8)


def safe_token(value: object) -> str | None:
    if not isinstance(value, str) or not 1 <= len(value) <= 80:
        return None
    for char in value:
        if not (char.isascii() and (char.isalnum() or char in ":_|,.-")):
            return None
    return value


PACK_REASON_KEYS = {
    "title", "subtitle", "level", "xp", "days", "streakUnknown", "zone", "dateUnknown",
    "calendar", "map", "seasonId", "seasonPoints", "noQuests", "rewardsEmpty", "lastUpdated", "page",
}
FORBIDDEN_REASON_KEYS = {"streakEmpty", "seasonEmpty", "closed", "claim", "granted"}


def exact_pack_reason(payload: dict[str, object]) -> str | None:
    rendered = payload.get("rendered") if isinstance(payload.get("rendered"), dict) else payload
    if not isinstance(rendered, dict) or rendered.get("holds") is True:
        return None
    missing = rendered.get("missing") if isinstance(rendered.get("missing"), list) else []
    forbidden = rendered.get("presentForbidden") if isinstance(rendered.get("presentForbidden"), list) else []
    bits: list[str] = []
    safe_missing = [item for item in missing if item in PACK_REASON_KEYS]
    safe_forbidden = [item for item in forbidden if item in FORBIDDEN_REASON_KEYS]
    if safe_missing:
        bits.append("missing:" + ",".join(safe_missing))
    if safe_forbidden:
        bits.append("forbidden:" + ",".join(safe_forbidden))
    if "questRows" in rendered and rendered.get("questRows") != 0:
        bits.append("quest-rows")
    if "rewardRows" in rendered and rendered.get("rewardRows") != 0:
        bits.append("reward-rows")
    if "claimButtons" in rendered and rendered.get("claimButtons") != 0:
        bits.append("claim-buttons")
    if "entries" in rendered and rendered.get("entries") != 4:
        bits.append("entries")
    if "route" in rendered and rendered.get("route") != "/pages/world/world":
        bits.append("route")
    if not bits:
        return None
    return safe_token("|".join(bits))


def observer_reason(payload: dict[str, object]) -> str | None:
    direct = safe_token(payload.get("reason"))
    if direct and direct != "rendered-pack":
        return direct
    promoted = exact_pack_reason(payload)
    if promoted:
        return promoted
    return direct


def public_observer(payload: dict[str, object]) -> dict[str, object]:
    wire = payload.get("wire") if isinstance(payload.get("wire"), dict) else {}
    rendered = payload.get("rendered") if isinstance(payload.get("rendered"), dict) else {}
    counts = payload.get("counts") if isinstance(payload.get("counts"), dict) else {}
    classes = wire.get("classes") if isinstance(wire.get("classes"), dict) else None
    return {
        "status": payload.get("status") if payload.get("status") in {"OBSERVED", "FAILED", "BLOCKED", "TIMEOUT"} else None,
        "reason": observer_reason(payload),
        "observed": payload.get("observed") is True,
        "worldEmptyReady": payload.get("worldEmptyReady") is True,
        "launched": payload.get("launched") is True,
        "h5Started": payload.get("h5Started") is True,
        "indexMatch": payload.get("indexMatch") is True,
        "nonceClosed": payload.get("nonceClosed") is True,
        "historicalReceiptUsed": payload.get("historicalReceiptUsed") is False,
        "routeFulfill": payload.get("routeFulfill") is False,
        "principalEligible": payload.get("principalEligible") is True,
        "onboardingOpened": payload.get("onboardingOpened") is True,
        "forbiddenOpened": payload.get("forbiddenOpened") is True,
        "clickedClaim": payload.get("clickedClaim") is True,
        "writes": payload.get("writes") if payload.get("writes") in {0, 1} else None,
        "counts": {
            "loginPost": counts.get("loginPost") if counts.get("loginPost") in {0, 1} else None,
            "principal": counts.get("principal") if isinstance(counts.get("principal"), int) else None,
            "summary": counts.get("summary") if counts.get("summary") in {0, 1} else None,
            "streak": counts.get("streak") if counts.get("streak") in {0, 1} else None,
            "season": counts.get("season") if counts.get("season") in {0, 1} else None,
            "quests": counts.get("quests") if counts.get("quests") in {0, 1} else None,
            "rewards": counts.get("rewards") if counts.get("rewards") in {0, 1} else None,
            "write": counts.get("write") if counts.get("write") in {0, 1} else None,
            "claim": counts.get("claim") if counts.get("claim") in {0, 1} else None,
            "probability": counts.get("probability") if counts.get("probability") in {0, 1} else None,
        },
        "wire": {
            "surface": "wire",
            "holds": wire.get("holds") is True,
            "className": wire.get("className") if isinstance(wire.get("className"), str) else None,
            "classes": classes if classes == EXPECTED_CLASSES else classes,
            "classifierStatus": wire.get("classifierStatus") if isinstance(wire.get("classifierStatus"), str) else None,
            "classifierReason": wire.get("classifierReason") if isinstance(wire.get("classifierReason"), str) else None,
            "observed": False,
            "g368ObserveWorldOwner": wire.get("g368ObserveWorldOwner"),
        },
        "rendered": {
            "surface": "rendered",
            "holds": rendered.get("holds") is True,
            "copy": rendered.get("copy") if rendered.get("copy") in {"zh", "en"} else None,
            "missing": rendered.get("missing") if isinstance(rendered.get("missing"), list) else None,
            "presentForbidden": rendered.get("presentForbidden") if isinstance(rendered.get("presentForbidden"), list) else None,
            "questRows": rendered.get("questRows") if rendered.get("questRows") in {0, 1} else None,
            "rewardRows": rendered.get("rewardRows") if rendered.get("rewardRows") in {0, 1} else None,
            "claimButtons": rendered.get("claimButtons") if rendered.get("claimButtons") in {0, 1} else None,
            "entries": rendered.get("entries") if rendered.get("entries") in {0, 4} else None,
            "route": rendered.get("route") if isinstance(rendered.get("route"), str) else None,
        },
        "passwordOmitted": True,
        "subjectOmitted": True,
        "identifierOmitted": True,
        "nonceValueOmitted": True,
    }


def run_h5(ns: dict[str, object], tls: dict[str, str], actor: dict[str, str]) -> dict[str, object]:
    payload = {
        "ownedLease": True,
        "profile": "local-real",
        "seeded": False,
        "caPem": tls["ca"],
        "approved": {
            "identifier": actor["identifier"],
            "password": actor["password"],
        },
    }
    proc = subprocess.Popen(
        ["node", str(TAIL)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=node_env(),
        cwd=str(JOB),
        start_new_session=True,
    )
    RT.processes.append(proc)
    RT.hook_parent = proc.pid if isinstance(proc.pid, int) else 0
    try:
        out, err = proc.communicate(json.dumps(payload).encode("utf-8"), timeout=TAIL_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        RT.browser_pids = snapshot_browser_children(ns, RT.hook_parent)
        ns["signal_verified"](proc, signal.SIGKILL)
        try:
            proc.communicate(timeout=5)
        except (OSError, subprocess.TimeoutExpired):
            pass
        raise Stop("h5-timeout") from None
    RT.browser_pids = snapshot_browser_children(ns, RT.hook_parent)
    text = out.decode("utf-8", "replace")
    errors = err.decode("utf-8", "replace")
    if leaked(text) or leaked(errors):
        raise Stop("secret-in-output")
    line = text.strip().splitlines()[-1] if text.strip() else ""
    try:
        parsed = json.loads(line)
    except json.JSONDecodeError:
        raise Stop(safe_token(line.strip()) or "h5") from None
    if not isinstance(parsed, dict):
        raise Stop(safe_token(line.strip()) or "h5")
    promoted = observer_reason(parsed)
    if promoted and promoted != parsed.get("reason"):
        parsed = dict(parsed)
        parsed["reason"] = promoted
    return public_observer(parsed)


def run_preflight(ns: dict[str, object]) -> None:
    guard_rejects_original()
    pin(ns)
    ns["require_python"]()
    ns["require_java"]()
    ns["require_tools"]()
    ns["require_docker_context"]()
    ns["require_image"]()
    ns["require_ports_free"]()
    ns["require_name_absent"]()


def run_lease(ns: dict[str, object], public: dict[str, object]) -> None:
    receipt_blocks()
    run_preflight(ns)
    scratch = ns["make_scratch"]()
    container, iam_password, gamification_password = ns["start_mysql"](scratch)
    RT.launch_attempted = True
    public["executed"] = True
    prove_scope(ns, container, gamification_password)
    public["scopeClean"] = True
    public["applied"] = True
    ready = select_facts(ns, container, gamification_password)
    public["factsReady"] = ready
    if not zeros(ready):
        raise Stop("startup-write")
    tls = ns["prepare_tls"](scratch)
    ns["start_iam"](tls, iam_password, scratch / "iam.log")
    connector = ns["extract_connector"](scratch)
    ns["seed_fixture"](scratch, connector, iam_password)
    public["fixtureRows"] = 3
    public["seeded"] = False
    ns["start_gateway"](tls, scratch / "gateway.log")
    if RT.gateway_caps != 1:
        raise Stop("gateway-cap")
    public["gatewayCaps"] = 1
    start_gamification(ns, tls, gamification_password, scratch / "gamification.log")
    if ns["profile_active"](scratch / "gamification.log") is not True:
        raise Stop("profile")
    RT.business_window = True
    actor = approve_actor(tls["ca"])
    before = select_facts(ns, container, gamification_password)
    public["factsBefore"] = before
    if before != ready:
        raise Stop("extra-write")
    observed = run_h5(ns, tls, actor)
    public["h5"] = observed
    public["h5PortOpened"] = observed.get("h5Started") is True
    public["h5Claimed"] = True
    after = select_facts(ns, container, gamification_password)
    public["factsAfter"] = after
    public["ledger"] = dict(RT.ledger)
    wire = observed.get("wire") if isinstance(observed.get("wire"), dict) else {}
    rendered = observed.get("rendered") if isinstance(observed.get("rendered"), dict) else {}
    counts = observed.get("counts") if isinstance(observed.get("counts"), dict) else {}
    public["wire"] = wire
    public["rendered"] = rendered
    public["observed"] = observed.get("observed") is True
    public["worldEmptyReady"] = observed.get("worldEmptyReady") is True
    public["className"] = wire.get("className")
    public["classes"] = wire.get("classes")
    public["classifierStatus"] = wire.get("classifierStatus")
    public["classifierReason"] = wire.get("classifierReason")
    public["runId"] = actor.get("runId")
    public["factsStayZero"] = zeros(before) and zeros(after) and before == after
    extra = 0 if (
        public["ledger"] == EXPECTED_BOOTSTRAP
        and public["factsStayZero"] is True
        and counts.get("write") == 0
        and counts.get("claim") == 0
        and counts.get("probability") == 0
    ) else 1
    public["extraWrites"] = extra
    hold = (
        public["ledger"] == EXPECTED_BOOTSTRAP
        and zeros(ready) and zeros(before) and zeros(after)
        and before == ready == after
        and public["factsStayZero"] is True
        and extra == 0
        and observed.get("status") == "OBSERVED"
        and observed.get("observed") is True
        and observed.get("worldEmptyReady") is True
        and observed.get("h5Started") is True
        and observed.get("indexMatch") is True
        and observed.get("nonceClosed") is True
        and observed.get("historicalReceiptUsed") is False
        and observed.get("routeFulfill") is False
        and observed.get("clickedClaim") is False
        and observed.get("onboardingOpened") is False
        and observed.get("forbiddenOpened") is False
        and wire.get("holds") is True
        and wire.get("className") == "DEFAULT_OWNER_EMPTY"
        and wire.get("classes") == EXPECTED_CLASSES
        and wire.get("observed") is False
        and rendered.get("holds") is True
        and rendered.get("questRows") == 0
        and rendered.get("rewardRows") == 0
        and rendered.get("claimButtons") == 0
        and counts.get("loginPost") == 1
        and counts.get("summary") == 1
        and counts.get("streak") == 1
        and counts.get("season") == 1
        and counts.get("quests") == 1
        and counts.get("rewards") == 1
        and public["seeded"] is False
        and public["gatewayCaps"] == 1
        and public["scopeClean"] is True
    )
    public["status"] = "PASS" if hold else "FAIL"
    public["reason"] = "default-owner-empty" if hold else (observed.get("reason") or "shape")
    public["historicalReceiptUsed"] = False
    public["g382Wire"] = {
        "path": str(G382_RECEIPT),
        "usedAsH5Proof": False,
        "role": "historical-wire-pin",
    }


def base_public() -> dict[str, object]:
    return {
        "account": GAMIFICATION_USER,
        "actorOrigin": ACTOR_ORIGIN,
        "applied": False,
        "className": None,
        "classes": None,
        "classifierReason": None,
        "classifierStatus": None,
        "container": CONTAINER_NAME,
        "executed": False,
        "extraWrites": None,
        "factsAfter": None,
        "factsBefore": None,
        "factsReady": None,
        "factsStayZero": False,
        "fixtureRows": None,
        "gatewayCaps": 0,
        "guard": str(WRAPPER),
        "h5Claimed": False,
        "h5PortOpened": False,
        "historicalReceiptUsed": False,
        "knownMarker": KNOWN_MARKER,
        "label": SCOPE_LABEL,
        "ledger": None,
        "observed": None,
        "passwordOmitted": True,
        "ports": {
            "mysql": 13306,
            "gateway": 18070,
            "iam": 18087,
            "gamification": 18094,
            "h5": 18183,
        },
        "reason": "not-started",
        "receipt": str(RECEIPT),
        "released": None,
        "rendered": None,
        "schema": "gamification_service",
        "scopeClean": False,
        "seeded": False,
        "sourceWritten": False,
        "status": "FAIL_CLOSED",
        "wire": None,
        "worldEmptyReady": None,
    }


def scrub(public: dict[str, object]) -> dict[str, object]:
    text = json.dumps(public, ensure_ascii=True, sort_keys=True)
    if leaked(text):
        return {
            "executed": bool(public.get("executed")),
            "h5Claimed": False,
            "historicalReceiptUsed": False,
            "passwordOmitted": True,
            "reason": "secret-in-receipt",
            "sourceWritten": False,
            "status": "FAIL_CLOSED",
        }
    return public


def write_receipt(public: dict[str, object]) -> None:
    target = authorize_write(RECEIPT)
    if target.name != "world-h5-default-receipt.json" or target.parent != Path(os.path.realpath(JOB)):
        raise Stop("source-write")
    payload = json.dumps(public, ensure_ascii=True, indent=2, sort_keys=True) + "\n"
    if leaked(payload):
        raise Stop("secret-in-receipt")
    fd = os.open(target, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())


def ports_snapshot(ns: dict[str, object]) -> dict[str, bool]:
    return {str(port): not ns["listeners"](port) for port in PORTS}


def safe_cleanup(ns: dict[str, object] | None) -> dict[str, object]:
    result: dict[str, object] = {
        "java": "not-started",
        "tail": "not-started",
        "browser": "not-started",
        "released": not RT.launch_attempted,
        "scratch": False,
        "portsFree": {},
    }
    if ns is None:
        return result
    try:
        if RT.hook_parent <= 1:
            for proc in RT.processes:
                if is_tail_process(proc) and isinstance(proc.pid, int):
                    RT.hook_parent = proc.pid
        if not RT.browser_pids:
            RT.browser_pids = snapshot_browser_children(ns, RT.hook_parent)
        result["tail"] = release_tail(ns)
        result["browser"] = release_browser(ns, RT.browser_pids, RT.hook_parent)
        java_counts = release_java(ns)
        result["java"] = java_counts
        if RT.launch_attempted:
            ns["release_owned_container"]()
            released, _auto = ns["release_truth"](RT.owned_container_id)
            result["released"] = (
                released is True
                and reap_settled(result["tail"])
                and reap_settled(result["browser"])
                and reap_settled(java_counts)
            )
        ns["remove_scratch"]()
        result["scratch"] = RT.scratch is None
        result["portsFree"] = ports_snapshot(ns)
        ports_ok = all(result["portsFree"].get(str(port)) is True for port in PORTS)
        if result["released"] is True and ports_ok is not True:
            result["released"] = False
    except Exception:
        result["released"] = False
    return result


def emit(public: dict[str, object]) -> None:
    sys.stdout.write(json.dumps(public, ensure_ascii=True, sort_keys=True) + "\n")


def main() -> int:
    code = 1
    public = base_public()
    ns: dict[str, object] | None = None
    try:
        require_guard()
        ns = build_namespace()
        if RT.preflight_only:
            run_preflight(ns)
            public["status"] = "PREFLIGHT"
            public["reason"] = "prepared"
            public["executed"] = False
            public["derived"] = list(PINNED)
            public["sealed"] = list(SEALED)
            public["gatewayCap"] = [item[1] for item in GATEWAY_CAP]
            public["ports"] = {
                "mysql": 13306,
                "gateway": 18070,
                "iam": 18087,
                "gamification": 18094,
                "h5": 18183,
            }
            code = 0
        else:
            run_lease(ns, public)
            code = 0 if public["status"] == "PASS" else 1
    except Stop as stopped:
        public["status"] = "FAIL_CLOSED"
        public["reason"] = stopped.reason
        RT.reason = stopped.reason
        code = 2
    except Exception:
        public["status"] = "FAIL"
        public["reason"] = "lease"
        code = 1
    public["ledger"] = dict(RT.ledger)
    if public["extraWrites"] is None:
        public["extraWrites"] = 0 if public["ledger"] == EXPECTED_BOOTSTRAP and public["factsStayZero"] is True else 1
    cleaned = safe_cleanup(ns)
    public["released"] = cleaned["released"]
    public["cleanup"] = cleaned
    if public["status"] == "PASS" and cleaned["released"] is not True:
        public["status"] = "FAIL"
        public["reason"] = "cleanup"
        code = 1
    public = scrub(public)
    if public["reason"] == "secret-in-receipt":
        public["released"] = cleaned["released"]
        code = 2
    if not RT.preflight_only and public.get("reason") != "script-root":
        try:
            write_receipt(public)
        except Stop as stopped:
            public["status"] = "FAIL_CLOSED"
            public["reason"] = stopped.reason
            code = 2
            emit(scrub(public))
            return code
    emit(public)
    return code


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception:
        sys.stdout.write('{"executed":false,"reason":"lease","sourceWritten":false,"status":"FAIL"}\n')
        raise SystemExit(1)

#!/usr/bin/env python3
"""MB-005 IAM TLS logout H5 lease. Rebinds frozen G393 in memory and does not run it now.

Root runs this file later. Preflight starts no MySQL, IAM, Gateway, or Chrome.
The full run is one fresh synthetic actor: IAM register, Gateway adult-gate denial,
principal RESTRICTED, the real forbidden page, and one current-session logout at
IAM https://127.0.0.1:18087 with bearer and credentials. Gateway logout is not
accepted for this H5. Old IAM and Gateway jars are reused. This checkout HEAD is
ed6a1e57 plus the recorded dependency and mobile files; it is not dev@84f0dead.
"""

from __future__ import annotations

import errno
import hashlib
import json
import os
import shutil
import signal
import socket
import stat
import subprocess
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True

JOB = Path("/tmp/grok-mobile-resume-h5-logout-live-candidate-457")
FROZEN = Path("/tmp/grok-mobile-forbidden-iam-canonical-node-entry-393/iam-only-lease.py")
OBSERVER = JOB / "forbidden-h5-observer.mjs"
TAIL = JOB / "h5-lease-tail.mjs"
NONCE = JOB / "pinned-static-nonce.mjs"
CHECKOUT = Path("/Users/Admin/.codex/worktrees/mobile-deps-20261108/cloudstudy")
GIT_ROOT = Path("/Users/Admin/Desktop/work/cloudstudy/.git")
SOURCE_HEAD = "ed6a1e57347448a25d7f92d02cb6ea8fad03e1db"
INTEGRATED_DEV = "84f0dead8e8d3ea32a1f5d5d7c13b76167371b34"
CANDIDATE = Path("/Users/Admin/.codex/worktrees/mobile-iam-http-acceptance-20261105/cloudstudy")
GATEWAY_JAR = CANDIDATE / "services/api-gateway/target/api-gateway-0.1.0-SNAPSHOT.jar"
GATEWAY_SHA = "7f796cfb60f571beb155ce3fad87a3e9e6cb13ddddd3f91e2ca9d9771ca6a0a1"
H5 = Path("/tmp/grok-mobile-resume-h5-logout-live-candidate-457/OUTPUT/h5")
H5_SHA = "8233e1edfaf8bb40489c80ce068ccc9abd6901a4fbb828bc012e999eaa91e7a3"
B139_H5 = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5"
)
B139_SHA = "706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32"
B116_SHA = "94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520"
G447_SHA = "7622ab9cc7ceeaf68fa009921bb0187232b4cc7a1dcd0913b16f560cbaf4a9d8"
REJECTED_INDEX = frozenset({B139_SHA, B116_SHA, G447_SHA})
ADULT_TITLE = "暂时无法开始学习"
ADULT_DESCRIPTION = "当前版本仅向年满18周岁的用户开放学习。你仍可管理账号或查看帮助。"
UNKNOWN_TITLE = "暂时无法确认访问状态"
LOGOUT_LABEL = "退出登录"
LOGIN_TITLE = "欢迎回来"
TITLE_KINDS = {"adult", "unknown", "gate", "login", "none", "other", "unread"}
SURFACE_NAMES = {"register", "onboarding-gate", "forbidden", "login", "protected", "other", "unread"}
PATH_CLASSES = {
    "/pages/login/login",
    "/pages/forbidden/forbidden",
    "/pages/register/register",
    "/pages/reset-password/reset-password",
    "/pages/report-share/report-share",
    "/pages/onboarding/onboarding",
    "/pages/devices/devices",
    "/pages/settings/settings",
    "/pages/profile/profile",
    "/pages/support/support",
    "/pages/b6-platform/b6-platform",
    "/pages/home/home",
    "/pages/learn/learn",
    "/pages/today/today",
    "/pages/world/world",
    "/pages/practice/practice",
    "/pages/assessment/assessment",
    "/pages/b2-practice/b2-practice",
    "/pages/b2-vocabulary/b2-vocabulary",
    "/pages/b3-grammar/b3-grammar",
    "/pages/b3-listening/b3-listening",
    "/pages/b3-reading/b3-reading",
    "/pages/b3-speaking/b3-speaking",
    "/pages/b3-writing/b3-writing",
    "/pages/b4-avatar/b4-avatar",
    "/pages/b4-games/b4-games",
    "/pages/b4-offline/b4-offline",
    "/pages/b4-social/b4-social",
    "/pages/b5-commerce/b5-commerce",
    "/pages/b10-report/b10-report",
    "/pages/b11-listening/b11-listening",
    "/pages/b11-reading/b11-reading",
    "/pages/b11-speaking/b11-speaking",
    "other",
    "unread",
    "none",
}
JOB_ID = "MB005-H5-IAM-LOGOUT-457"
CONTAINER = "cloudstudy-mobile-h5-logout-457"
LABEL = "cloudstudy.qa.mobile-h5-logout-457"
MARKER = "grok-mobile-resume-h5-logout-live-candidate-457"
PORTS = (13306, 18070, 18087, 18183)
DOMAINS = ("LEARNER", "CONTENT", "LEARNING", "ASSESSMENT", "MEDIA", "GAMIFICATION", "SOCIAL", "COMMERCE")
TAIL_TIMEOUT_SECONDS = 180
REBIND = (
    (
        'JOB = Path("/tmp/grok-mobile-forbidden-iam-canonical-node-entry-393")',
        'JOB = Path("/tmp/grok-mobile-resume-h5-logout-live-candidate-457")',
    ),
    (
        'JOB_ID = "MB005-G393-canonical-node-entry"',
        'JOB_ID = "MB005-H5-IAM-LOGOUT-457"',
    ),
    (
        'JOB_MARKER = "grok-mobile-forbidden-iam-canonical-node-entry-393"',
        'JOB_MARKER = "grok-mobile-resume-h5-logout-live-candidate-457"',
    ),
    (
        'LABEL = "cloudstudy.qa.mobile-forbidden-iam-canonical-node-entry-393"',
        'LABEL = "cloudstudy.qa.mobile-h5-logout-457"',
    ),
    (
        'NAME = "cloudstudy-mobile-forbidden-iam-canonical-node-entry-393"',
        'NAME = "cloudstudy-mobile-h5-logout-457"',
    ),
)
SOURCE_BANS = ("route.fulfill(", "addCookies(", "addInitScript(", "localStorage.setItem")
PROBE_FIELDS = ("probeSha256", "probeBytes", "substitution", "boundReceipt", "entryGap", "nodeEntry")
NEEDED = (
    "require_pins", "require_python", "require_tools", "require_java", "require_docker_context",
    "require_image", "require_name_absent", "require_ports_free", "make_scratch", "start_mysql",
    "prepare_tls", "start_iam", "extract_connector", "seed_publication", "spawn_service",
    "wait_http", "base_env", "java_bin", "cleanup", "write_json", "listeners", "require_file",
    "parent_pid", "run_command", "signal_verified", "exact_filter_ids", "exact_id_state",
    "is_java_process", "is_probe_process", "MEMORY", "Stop", "RT", "IAM_SHA",
)


class Stop(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class Tail:
    def __init__(self) -> None:
        self.proc: subprocess.Popen[bytes] | None = None
        self.pid = 0
        self.children: list[int] = []


TAIL_STATE = Tail()


def token(value: object, limit: int = 64) -> str | None:
    if not isinstance(value, str) or not value.isascii() or not value or len(value) > limit:
        return None
    if any(char.isspace() for char in value):
        return None
    return value


def reason_of(error: BaseException) -> str:
    value = getattr(error, "reason", None)
    return token(value) or (type(error).__name__ if type(error).__name__.isascii() else "error")


def say(status: str, reason: object) -> None:
    sys.stderr.write(f"status={status} reason={reason}\n")


def same_script() -> bool:
    try:
        left = Path(sys.argv[0]).resolve(strict=True)
        right = Path(__file__).resolve(strict=True)
    except OSError:
        return False
    return left == right and left.is_file()


def refuse_frozen(*_args: object, **_kwargs: object) -> None:
    raise Stop("probe-executed")


def rebind_source() -> str:
    if not FROZEN.is_file() or FROZEN.is_symlink():
        raise Stop("rebind")
    text = FROZEN.read_text(encoding="utf-8")
    for old, new in REBIND:
        if text.count(old) != 1:
            raise Stop("rebind")
        text = text.replace(old, new, 1)
    stale = (
        "grok-mobile-forbidden-iam-canonical-node-entry-393",
        "cloudstudy-mobile-forbidden-iam-canonical-node-entry-393",
        "cloudstudy.qa.mobile-forbidden-iam-canonical-node-entry-393",
        "MB005-G393-canonical-node-entry",
    )
    if any(item in text for item in stale):
        raise Stop("rebind")
    if text.count('JOB = Path("/tmp/grok-mobile-resume-h5-logout-live-candidate-457")') != 1:
        raise Stop("rebind")
    return text


def load_supervisor() -> dict[str, object]:
    source = rebind_source()
    namespace: dict[str, object] = {"__name__": "g393_rebound", "__file__": str(JOB / "forbidden-h5-wrapper.py"), "__package__": None}
    exec(compile(source, str(FROZEN), "exec"), namespace)  # noqa: S102 - in-memory rebind of the frozen supervisor
    if namespace.get("JOB") != JOB or namespace.get("NAME") != CONTAINER:
        raise Stop("rebind")
    if namespace.get("LABEL") != LABEL or namespace.get("JOB_ID") != JOB_ID or namespace.get("JOB_MARKER") != MARKER:
        raise Stop("rebind")
    for name in NEEDED:
        if name not in namespace:
            raise Stop("rebind")
    for name in ("main", "classify", "run", "run_probe", "emit_lease", "require_script_root"):
        namespace[name] = refuse_frozen

    def remove_scratch() -> None:
        runtime = namespace["RT"]
        scratch_path = runtime.scratch
        if scratch_path is None:
            return
        expected = (JOB / "scratch").resolve()
        try:
            info = scratch_path.lstat()
            resolved = scratch_path.resolve()
        except OSError:
            return
        if resolved != expected or stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
            return
        try:
            shutil.rmtree(scratch_path)
        except OSError:
            return
        runtime.scratch = None

    namespace["remove_scratch"] = remove_scratch
    return namespace


def source_head() -> str:
    pointer = CHECKOUT / ".git"
    if not pointer.is_file() or pointer.is_symlink():
        raise Stop("source-head")
    raw = pointer.read_text(encoding="utf-8").strip()
    if not raw.startswith("gitdir: "):
        raise Stop("source-head")
    gitdir = Path(raw.split("gitdir: ", 1)[1].strip()).resolve()
    root = GIT_ROOT.resolve()
    if gitdir != root and root not in gitdir.parents:
        raise Stop("source-head")
    current = (gitdir / "HEAD").read_text(encoding="utf-8").strip()
    for _ in range(4):
        if not current.startswith("ref: "):
            break
        ref = current.split("ref: ", 1)[1].strip()
        if not ref or ref.startswith("/") or ".." in ref.split("/"):
            raise Stop("source-head")
        current = (gitdir / ref).read_text(encoding="utf-8").strip()
    if current.startswith("ref: "):
        raise Stop("source-head")
    if len(current) != 40 or any(char not in "0123456789abcdef" for char in current):
        raise Stop("source-head")
    if current == INTEGRATED_DEV or current != SOURCE_HEAD:
        raise Stop("source-head")
    return current


def require_local_sources() -> None:
    for path in (OBSERVER, TAIL, NONCE):
        if not path.is_file() or path.is_symlink():
            raise Stop("observer-source")
    observer = OBSERVER.read_text(encoding="utf-8")
    tail = TAIL.read_text(encoding="utf-8")
    nonce = NONCE.read_text(encoding="utf-8")
    if any(ban in observer or ban in tail for ban in SOURCE_BANS):
        raise Stop("observer-source")
    if "start_gateway" in observer or "route.fulfill(" in nonce:
        raise Stop("observer-source")
    if "openPinnedNonceStatic" not in nonce or "18183" not in nonce or "x-mb004-static-qa" not in nonce:
        raise Stop("nonce-pin")
    if str(NONCE) not in tail or str(OBSERVER) not in tail or "ownedLease" not in tail:
        raise Stop("observer-source")
    if any(token in observer for token in ("g413-", "G413!", "g435-", "G435!", "g444-", "G444!")):
        raise Stop("observer-source")
    if "g457-" not in observer or "G457!" not in observer:
        raise Stop("observer-source")
    if H5_SHA not in nonce or "expectedIndexSha !== H5_INDEX_SHA" not in nonce:
        raise Stop("nonce-pin")
    if "expectedIndexSha !== B139_INDEX_SHA" in nonce or B139_SHA not in nonce or G447_SHA not in nonce or B116_SHA not in nonce:
        raise Stop("nonce-pin")
    index = H5 / "index.html"
    if not index.is_file() or index.is_symlink():
        raise Stop("h5-index")
    digest = hashlib.sha256(index.read_bytes()).hexdigest()
    if digest != H5_SHA or digest in REJECTED_INDEX:
        raise Stop("h5-index")
    if H5.resolve() == B139_H5.resolve():
        raise Stop("h5-index")
    assets = H5 / "assets"
    if not assets.is_dir() or assets.is_symlink():
        raise Stop("forbidden-chunk")
    names = [item.name for item in assets.iterdir() if item.is_file() and not item.is_symlink()]
    if not any(name.startswith("pages-forbidden-forbidden.") and name.endswith(".js") for name in names):
        raise Stop("forbidden-chunk")
    found = False
    for name in names:
        if not name.endswith(".js"):
            continue
        file = assets / name
        try:
            info = file.stat()
        except OSError:
            continue
        if info.st_size > 4_000_000:
            continue
        text = file.read_text(encoding="utf-8", errors="ignore")
        if ADULT_TITLE in text and ADULT_DESCRIPTION in text and LOGOUT_LABEL in text:
            found = True
            break
    if not found:
        raise Stop("adult-copy-missing")



DEPENDENCY_FILES = {
    "apps/mobile/package.json": "e08004d99a0486f6cb56fa2cca5f60f4e22455cc6fc5e0dff09b9e1fbfcad298",
    "apps/admin-web/package.json": "64e1d7a3770486130fde979cadfe02349bda7cbfe7d8fcf77c5f28d5fc617b31",
    "apps/learner-web/package.json": "c5dc4a4911fc2cf8c72c2d0c69f55755a5e240362061651a9206424dd21812d9",
    "apps/official-site/package.json": "8ca60badfff0e3b9328edadad8ba2381e3a7135024931d11bf93bf40735d3716",
    "pnpm-workspace.yaml": "e0dec117f697e0c96824fc5b648a8ad65e2ec3ac160ab2d76d8d79e92f1fdc62",
    "pnpm-lock.yaml": "762e018cb7a02d3d3c5c3b5c031229f45b81951308bd57591f76848e02842e3b",
}
MOBILE_FILES = {
    "apps/mobile/src/api/client.ts": "136f297ddad8337bcf4125026455aec51ecdc8db951d398cab758eb90c0dd16f",
    "apps/mobile/src/auth/gateway-auth.ts": "08f59285061940606e8eb520c50cb4c81f8881539b52ba366aab525388971ab1",
    "apps/mobile/tests/iam-auth-transport.test.mjs": "08db1dd787b76091907fa02d7072ff9e2223f91de15d23c1908782f49ef93478",
    "apps/mobile/tests/mobile-gateway-auth-bootstrap.test.mjs": "30901b7a4282f1526a8f54e576afd22a9890b1f74afb2480c5a713e7478d9c89",
    "apps/mobile/tests/onboarding-auth-projection.test.mjs": "59f0fa23808ae2253b64d54360737b11852a762d5ab0557920bf2f6b40cbe5a4",
}


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require_composition() -> None:
    for rel, digest in {**DEPENDENCY_FILES, **MOBILE_FILES}.items():
        path = CHECKOUT / rel
        if not path.is_file() or path.is_symlink() or file_sha(path) != digest:
            raise Stop("composition")
    iam_test = CHECKOUT / "services/iam-service/src/test/java/com/englishflow/iam/web/IamLogoutCookieClearControllerTest.java"
    if iam_test.exists():
        raise Stop("composition")


def port_open(port: int) -> bool:
    probe = socket.socket()
    probe.settimeout(0.2)
    try:
        return probe.connect_ex(("127.0.0.1", port)) == 0
    finally:
        probe.close()


def ports_free(ns: dict[str, object]) -> dict[str, bool]:
    found: dict[str, bool] = {}
    for port in PORTS:
        listening = bool(ns["listeners"](port))
        found[str(port)] = not listening and not port_open(port)
    return found


def require_all_ports_free(ns: dict[str, object]) -> None:
    ns["require_ports_free"]()
    if not all(ports_free(ns).values()):
        raise Stop("ports-busy")


def gateway_env(ns: dict[str, object]) -> dict[str, str]:
    env = ns["base_env"]()
    env.update({
        "SPRING_PROFILES_ACTIVE": "local",
        "SERVER_ADDRESS": "127.0.0.1",
        "API_GATEWAY_PORT": "18070",
        "IAM_SERVICE_BASE_URL": "https://127.0.0.1:18087",
        "IAM_ROUTE_ENABLED": "true",
        "IAM_JWT_ISSUER": "http://127.0.0.1:18087",
        "IAM_JWT_JWKS_URI": "https://127.0.0.1:18087/api/v1/auth/jwks",
        "IAM_JWT_AUDIENCE": "yuxuexing-api",
        "GATEWAY_RESOURCE_SERVER_ENABLED": "true",
        "GATEWAY_JWT_PREVALIDATION_ENABLED": "true",
        "GATEWAY_RATE_LIMIT_ENABLED": "true",
        "GATEWAY_RATE_LIMIT_BACKEND": "memory",
        "GATEWAY_RATE_LIMIT_FAIL_OPEN": "false",
        "GATEWAY_SECURITY_AUDIT_ENABLED": "true",
        "MANAGEMENT_HEALTH_REDIS_ENABLED": "false",
        "B12_SERVICES_ENABLED": "false",
        "B13_SERVICES_ENABLED": "false",
        "B14_STRANGLER_ENABLED": "true",
        "CORE_API_COMPAT_ENABLED": "false",
        "WORKFLOW_SERVICES_ENABLED": "false",
    })
    for domain in DOMAINS:
        env[f"B14_ROUTE_MODE_{domain}"] = "LEGACY"
    if env.get("IAM_ROUTE_ENABLED") != "true" or "COMMERCE_SERVICE_BASE_URL" in env:
        raise Stop("gateway-mode")
    if any(env.get(f"B14_ROUTE_MODE_{domain}") != "LEGACY" for domain in DOMAINS):
        raise Stop("gateway-mode")
    return env


def start_gateway(ns: dict[str, object], tls: dict[str, str], log_path: Path) -> None:
    env = gateway_env(ns)
    args = [
        ns["java_bin"]("java"), *ns["MEMORY"],
        f"-Djavax.net.ssl.trustStore={tls['trustStore']}",
        "-Djavax.net.ssl.trustStoreType=PKCS12",
        f"-Djavax.net.ssl.trustStorePassword={tls['trustPassword']}",
        "-Dio.netty.handler.ssl.noOpenSsl=true",
        "-Dfile.encoding=UTF-8",
        "-jar", str(GATEWAY_JAR),
    ]
    proc = ns["spawn_service"](args, env, log_path)
    ns["wait_http"](18070, "/actuator/health/readiness", proc)


def node_env(scratch: Path) -> dict[str, str]:
    return {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin:/usr/sbin:/sbin"),
        "HOME": os.environ.get("HOME", ""),
        "TMPDIR": str(scratch),
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "NODE_NO_WARNINGS": "1",
    }


def command_text(ns: dict[str, object], pid: int) -> tuple[int | None, str]:
    try:
        code, out, _err = ns["run_command"](["ps", "-p", str(pid), "-o", "ppid=,command="], 5)
    except Exception:
        return None, ""
    if code != 0:
        return None, ""
    parts = out.strip().split(None, 1)
    if len(parts) < 1 or not parts[0].isdigit():
        return None, ""
    return int(parts[0]), parts[1] if len(parts) == 2 else ""


def chrome_command(command: str) -> bool:
    lowered = command.lower()
    if "python" in lowered or lowered.strip().startswith("ps "):
        return False
    return "chrome" in lowered or "chromium" in lowered


def capture_children(ns: dict[str, object], parent: int) -> list[int]:
    if parent <= 1:
        return []
    try:
        code, out, _err = ns["run_command"](["ps", "-ax", "-o", "pid=,ppid=,command="], 5)
    except Exception:
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
        if ppid == parent and pid > 1 and chrome_command(parts[2]):
            found.append(pid)
    return found


def marker_orphans(ns: dict[str, object], markers: tuple[str, ...]) -> list[int]:
    try:
        code, out, _err = ns["run_command"](["ps", "-ax", "-o", "pid=,ppid=,command="], 5)
    except Exception:
        return []
    if code != 0:
        return []
    found: list[int] = []
    for line in out.splitlines():
        parts = line.strip().split(None, 2)
        if len(parts) != 3 or not parts[0].isdigit() or not parts[1].isdigit():
            continue
        if int(parts[1]) != 1 or int(parts[0]) <= 1 or not chrome_command(parts[2]):
            continue
        if any(marker and marker in parts[2] for marker in markers):
            found.append(int(parts[0]))
    return found


def blank_reap() -> dict[str, int]:
    return {"signaled": 0, "reaped": 0, "unverified": 0, "remaining": 0}


def reap_settled(counts: object) -> bool:
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


def note_exit(counts: dict[str, int], proc: subprocess.Popen[bytes]) -> None:
    if proc.poll() is not None:
        counts["reaped"] += 1
    else:
        counts["remaining"] += 1


def wait_exit(proc: subprocess.Popen[bytes], timeout: float) -> bool:
    if proc.poll() is not None:
        return True
    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        return False
    return proc.poll() is not None


def release_tail(ns: dict[str, object]) -> dict[str, int]:
    counts = blank_reap()
    proc = TAIL_STATE.proc
    if proc is None:
        return counts
    if proc.poll() is not None:
        counts["reaped"] += 1
        return counts
    pid = proc.pid
    if not isinstance(pid, int) or pid <= 1:
        counts["unverified"] += 1
        note_exit(counts, proc)
        return counts
    TAIL_STATE.children = capture_children(ns, pid)
    try:
        code, out, _err = ns["run_command"](["ps", "-p", str(pid), "-o", "ppid=,sess="], 5)
        ps_parent, ps_sid = (int(item) for item in out.split()) if code == 0 and len(out.split()) == 2 else (None, None)
        pgid = os.getpgid(pid)
        sid = os.getsid(pid)
    except Exception:
        counts["unverified"] += 1
        note_exit(counts, proc)
        return counts
    parent = ns["parent_pid"](pid)
    if parent != os.getpid() or ps_parent != os.getpid() or ps_sid != pid or pgid != pid or sid != pid:
        counts["unverified"] += 1
        note_exit(counts, proc)
        return counts
    try:
        os.killpg(pid, signal.SIGTERM)
        counts["signaled"] += 1
    except OSError as error:
        if error.errno == errno.ESRCH or proc.poll() is not None:
            counts["reaped"] += 1
            return counts
        counts["unverified"] += 1
        counts["remaining"] += 1
        return counts
    if not wait_exit(proc, 3):
        try:
            os.killpg(pid, signal.SIGKILL)
        except OSError as error:
            if error.errno != errno.ESRCH:
                counts["unverified"] += 1
        wait_exit(proc, 3)
    if proc.poll() is not None:
        counts["reaped"] += 1
    else:
        counts["remaining"] += 1
        counts["unverified"] += 1
    return counts


def process_command(ns: dict[str, object], pid: int) -> str | None:
    try:
        code, out, _err = ns["run_command"](["ps", "-p", str(pid), "-o", "command="], 5)
    except Exception:
        return None
    if code != 0:
        return ""
    return out.strip()


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
        if state == "reaped" and wait_exit(proc, 1):
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
        wait_exit(proc, 2)
        if proc.poll() is not None:
            counts["reaped"] += 1
        else:
            counts["remaining"] += 1
            counts["unverified"] += 1
    return counts


def recount_owned(ns: dict[str, object], predicate: object) -> dict[str, int]:
    counts = blank_reap()
    runtime = ns["RT"]
    selected = [proc for proc in runtime.processes if predicate(proc)]
    alive: list[subprocess.Popen[bytes]] = []
    for proc in selected:
        if proc.poll() is not None:
            counts["reaped"] += 1
        else:
            alive.append(proc)
    if not alive:
        return counts
    follow = release_popen(ns, alive, 0.8)
    for key in ("signaled", "reaped", "unverified", "remaining"):
        counts[key] += follow[key]
    return counts


def release_chrome(ns: dict[str, object], markers: tuple[str, ...]) -> dict[str, int]:
    counts = blank_reap()
    parent = TAIL_STATE.pid if isinstance(TAIL_STATE.pid, int) else 0
    pids = list(dict.fromkeys([*TAIL_STATE.children, *marker_orphans(ns, markers)]))
    owned: list[int] = []
    for pid in pids:
        command = process_command(ns, pid)
        if command is None:
            counts["unverified"] += 1
            continue
        if command == "":
            counts["reaped"] += 1
            continue
        if not chrome_command(command):
            counts["unverified"] += 1
            continue
        parent_now = ns["parent_pid"](pid)
        marker_hit = any(marker and marker in command for marker in markers)
        captured = pid in TAIL_STATE.children
        child = parent > 1 and parent_now == parent and captured
        orphan = parent_now == 1 and (captured or marker_hit)
        if not child and not orphan:
            counts["unverified"] += 1
            continue
        owned.append(pid)
    for sig in (signal.SIGTERM, signal.SIGKILL):
        if not owned:
            break
        for pid in list(owned):
            command = process_command(ns, pid)
            if command is None:
                counts["unverified"] += 1
                owned.remove(pid)
                continue
            if command == "":
                counts["reaped"] += 1
                owned.remove(pid)
                continue
            if not chrome_command(command):
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
        command = process_command(ns, pid)
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
        counts["unverified"] += 1
    return counts


def container_facts(ns: dict[str, object]) -> dict[str, object]:
    runtime = ns["RT"]
    ambiguous = bool(getattr(runtime, "identity_ambiguous", False))
    try:
        names = ns["exact_filter_ids"]("name")
        labels = ns["exact_filter_ids"]("label")
    except Exception:
        names, labels = None, None
    cid = getattr(runtime, "owned_container_id", "")
    if not isinstance(cid, str):
        cid = ""
    id_state = "empty"
    if cid:
        try:
            id_state = ns["exact_id_state"](cid)
        except Exception:
            id_state = "unknown"
        if id_state not in {"absent", "present", "unknown"}:
            id_state = "unknown"
    queries_ok = isinstance(names, set) and isinstance(labels, set)
    name_absent = queries_ok and len(names) == 0
    label_absent = queries_ok and len(labels) == 0
    current = bool(queries_ok and not ambiguous and name_absent and label_absent and id_state in {"empty", "absent"})
    return {
        "nameAbsent": name_absent if queries_ok else None,
        "labelAbsent": label_absent if queries_ok else None,
        "idState": id_state,
        "identityAmbiguous": ambiguous,
        "currentReleased": current,
    }


def count_snapshot(value: object) -> dict[str, int] | None:
    if not isinstance(value, dict):
        return None
    snapshot: dict[str, int] = {}
    for key in ("signaled", "reaped", "unverified", "remaining"):
        item = value.get(key)
        if not isinstance(item, int) or item < 0:
            return None
        snapshot[key] = item
    return snapshot


def probe_public(payload: dict[str, object]) -> dict[str, object]:
    if "substituted" in payload:
        raise Stop("probe-output-constant")
    public: dict[str, object] = {}
    for key in PROBE_FIELDS:
        public[key] = payload.get(key)
    if not isinstance(public.get("probeSha256"), str) or public.get("substitution") != "receipt-constant-only":
        raise Stop("probe-output-constant")
    return public


def rows_of(payload: dict[str, object]) -> list[dict[str, object]] | None:
    raw = payload.get("requests")
    if not isinstance(raw, list):
        return None
    rows: list[dict[str, object]] = []
    for row in raw:
        if not isinstance(row, dict):
            return None
        method = row.get("method")
        path = row.get("path")
        status = row.get("status")
        via = row.get("via")
        if method not in {"GET", "POST", "OPTIONS", "HEAD"} or via not in {"iam", "gateway"}:
            return None
        if not isinstance(path, str) or len(path) > 80 or "?" in path or not path.startswith("/api/v1/"):
            return None
        if not isinstance(status, int):
            return None
        rows.append({"method": method, "path": path, "status": status, "via": via})
    return rows


def one(rows: list[dict[str, object]], method: str, path: str, status: int, via: str) -> bool:
    found = [row for row in rows if row["method"] == method and row["path"] == path]
    return len(found) == 1 and found[0]["status"] == status and found[0]["via"] == via


def title_kind(value: object) -> str:
    return value if isinstance(value, str) and value in TITLE_KINDS else "unread"


def surface_name(value: object) -> str:
    return value if isinstance(value, str) and value in SURFACE_NAMES else "unread"


def path_class(value: object) -> str:
    return value if isinstance(value, str) and value in PATH_CLASSES else "other"


COOKIE_BOOLS = (
    "storedBefore",
    "jarRemains",
    "headerReadable",
    "headerNameMatch",
    "headerEmptyValue",
    "headerPathMatch",
    "headerMaxAgeZero",
    "headerExpiresPast",
    "headerSecure",
    "headerHttpOnly",
    "headerSameSiteNone",
    "headerPartitioned",
    "clearOverHttps",
    "beforeSecure",
    "beforeHttpOnly",
    "beforeSameSiteNone",
    "beforePartitioned",
    "beforeHostOnlyLoopback",
)


def cookie_evidence(logout: dict[str, object]) -> dict[str, object]:
    evidence: dict[str, object] = {}
    for key in COOKIE_BOOLS:
        if isinstance(logout.get(key), bool):
            evidence[key] = logout[key]
    count = logout.get("headerCount")
    if isinstance(count, int) and not isinstance(count, bool) and 0 <= count <= 8:
        evidence["headerCount"] = count
    return evidence


def canonical_title(value: object) -> str:
    if value in {ADULT_TITLE, UNKNOWN_TITLE}:
        return str(value)
    return ""


def surface_of(value: object) -> dict[str, str]:
    data = value if isinstance(value, dict) else {}
    return {"surface": surface_name(data.get("surface")), "title": title_kind(data.get("title")), "path": path_class(data.get("path"))}


def observer_holds(payload: dict[str, object]) -> tuple[bool, dict[str, object]]:
    rows = rows_of(payload)
    gate = payload.get("gate") if isinstance(payload.get("gate"), dict) else {}
    rendered = payload.get("rendered") if isinstance(payload.get("rendered"), dict) else {}
    logout = payload.get("logout") if isinstance(payload.get("logout"), dict) else {}
    after = payload.get("afterLogout") if isinstance(payload.get("afterLogout"), dict) else {}
    principal_ok = (
        payload.get("principalStatus") == "RESTRICTED"
        and payload.get("principalAdultStatus") == "REJECTED"
        and payload.get("principalLearningAccess") == "RESTRICTED"
        and payload.get("learningPermissionCount") == 0
        and payload.get("targetWritePresent") is False
        and payload.get("consentAccepted") is False
        and payload.get("publishedConsentDocuments") is False
    )
    gate_ok = (
        gate.get("status") == "REJECTED"
        and gate.get("learningAccess") == "RESTRICTED"
        and gate.get("evidenceStatus") == "REJECTED"
        and gate.get("policyVersion") == "b30-adult-v1"
        and gate.get("minimumAge") == 18
        and gate.get("retryAllowed") is True
    )
    evidence = cookie_evidence(logout)
    logout_ok = (
        logout.get("count") == 1
        and logout.get("status") == 200
        and logout.get("revocationStatus") == "REVOKED"
        and logout.get("revocationScope") == "CURRENT_SESSION_AND_TOKEN_FAMILY"
        and logout.get("cookieCleared") is True
        and evidence.get("storedBefore") is True
        and evidence.get("jarRemains") is False
        and evidence.get("headerReadable") is True
        and evidence.get("headerNameMatch") is True
        and evidence.get("headerEmptyValue") is True
        and evidence.get("headerPathMatch") is True
        and evidence.get("headerMaxAgeZero") is True
        and evidence.get("headerExpiresPast") is True
        and evidence.get("headerSecure") is True
        and evidence.get("headerHttpOnly") is True
        and evidence.get("headerSameSiteNone") is True
        and evidence.get("headerPartitioned") is True
        and evidence.get("clearOverHttps") is True
        and logout.get("authorizationBearer") is True
        and logout.get("credentialCookie") is True
        and logout.get("transportHeader") is False
    )
    page_ok = (
        rendered.get("title") == ADULT_TITLE
        and rendered.get("description") == ADULT_DESCRIPTION
        and rendered.get("logout") == LOGOUT_LABEL
        and rendered.get("reason") == "adult"
        and after.get("loginTitle") == LOGIN_TITLE
        and after.get("forbiddenTitleVisible") is False
    )
    counts_ok = (
        payload.get("consentRequestCount") == 0
        and payload.get("learningWriteCount") == 0
        and payload.get("targetWriteCount") == 0
        and payload.get("blockedWriteCount") == 0
        and payload.get("routeFulfillCount") == 0
        and payload.get("fakedResponse") is False
        and payload.get("injectedAuthState") is False
        and payload.get("mockDocuments") == "synthetic-fixture-only"
        and payload.get("indexSha256") == H5_SHA
        and payload.get("nonceClosed") is True
        and payload.get("passwordOmitted") is True
        and payload.get("identifierOmitted") is True
        and payload.get("nonceOmitted") is True
        and payload.get("actor") == "disposable-generated"
        and payload.get("domain") == "example.invalid"
        and payload.get("birthYear") == 2015
        and payload.get("policyVersion") == "b30-adult-v1"
    )
    wire_ok = bool(rows) and one(rows, "POST", "/api/v1/auth/register", 201, "iam") and one(rows, "POST", "/api/v1/iam/adult-gate", 200, "gateway") and one(rows, "POST", "/api/v1/auth/logout", 200, "iam")
    gateway_logout = bool(rows) and any(row["method"] == "POST" and row["path"] == "/api/v1/auth/logout" and row["via"] == "gateway" for row in rows or [])
    principal_read = bool(rows) and any(row["method"] == "GET" and row["path"] == "/api/v1/iam/principal/me" and row["status"] == 200 and row["via"] == "gateway" for row in rows or [])
    allowed = {"/api/v1/auth/register", "/api/v1/auth/token/refresh", "/api/v1/iam/adult-gate", "/api/v1/iam/principal/me", "/api/v1/iam/permissions", "/api/v1/auth/logout"}
    unexpected = bool(rows) and any(row["path"] not in allowed for row in rows or [])
    holds = bool(
        payload.get("status") == "OBSERVED"
        and payload.get("observed") is True
        and payload.get("reason") is None
        and principal_ok and gate_ok and logout_ok and page_ok and counts_ok and wire_ok and principal_read and not unexpected and not gateway_logout
    )
    public = {
        "status": payload.get("status") if payload.get("status") in {"OBSERVED", "FAILED", "BLOCKED"} else None,
        "reason": token(payload.get("reason")),
        "observed": payload.get("observed") is True,
        "nonceClosed": payload.get("nonceClosed") is True,
        "requests": rows or [],
        "gate": {key: gate.get(key) for key in ("status", "learningAccess", "evidenceStatus", "policyVersion", "minimumAge", "retryAllowed")},
        "principalStatus": payload.get("principalStatus") if isinstance(payload.get("principalStatus"), str) else None,
        "principalAdultStatus": payload.get("principalAdultStatus") if isinstance(payload.get("principalAdultStatus"), str) else None,
        "principalLearningAccess": payload.get("principalLearningAccess") if isinstance(payload.get("principalLearningAccess"), str) else None,
        "learningPermissionCount": payload.get("learningPermissionCount") if isinstance(payload.get("learningPermissionCount"), int) else None,
        "targetWritePresent": payload.get("targetWritePresent") if isinstance(payload.get("targetWritePresent"), bool) else None,
        "consentAccepted": payload.get("consentAccepted") if isinstance(payload.get("consentAccepted"), bool) else None,
        "publishedConsentDocuments": payload.get("publishedConsentDocuments") if isinstance(payload.get("publishedConsentDocuments"), bool) else None,
        "consentRequestCount": payload.get("consentRequestCount") if isinstance(payload.get("consentRequestCount"), int) else None,
        "learningWriteCount": payload.get("learningWriteCount") if isinstance(payload.get("learningWriteCount"), int) else None,
        "targetWriteCount": payload.get("targetWriteCount") if isinstance(payload.get("targetWriteCount"), int) else None,
        "blockedWriteCount": payload.get("blockedWriteCount") if isinstance(payload.get("blockedWriteCount"), int) else None,
        "routeFulfillCount": payload.get("routeFulfillCount") if isinstance(payload.get("routeFulfillCount"), int) else None,
        "permissionsEndpoint": payload.get("permissionsEndpoint") if payload.get("permissionsEndpoint") in {"not-called-by-h5", "observed"} else None,
        "rendered": {
            "title": canonical_title(rendered.get("title")),
            "description": rendered.get("description") if rendered.get("description") == ADULT_DESCRIPTION else "",
            "logout": rendered.get("logout") if rendered.get("logout") == LOGOUT_LABEL else "",
            "reason": title_kind(rendered.get("reason")),
        },
        "surface": surface_of(payload.get("surface")),
        "logout": {
            "count": logout.get("count") if isinstance(logout.get("count"), int) else None,
            "status": logout.get("status") if isinstance(logout.get("status"), int) else None,
            "revocationStatus": logout.get("revocationStatus") if isinstance(logout.get("revocationStatus"), str) else None,
            "revocationScope": logout.get("revocationScope") if isinstance(logout.get("revocationScope"), str) else None,
            "authorizationBearer": logout.get("authorizationBearer") if isinstance(logout.get("authorizationBearer"), bool) else None,
            "credentialCookie": logout.get("credentialCookie") if isinstance(logout.get("credentialCookie"), bool) else None,
            "transportHeader": logout.get("transportHeader") if isinstance(logout.get("transportHeader"), bool) else None,
            "cookieCleared": logout.get("cookieCleared") if isinstance(logout.get("cookieCleared"), bool) else None,
            **evidence,
        },
        "afterLogout": {
            "loginTitle": after.get("loginTitle") if after.get("loginTitle") == LOGIN_TITLE else "",
            "forbiddenTitleVisible": after.get("forbiddenTitleVisible") if isinstance(after.get("forbiddenTitleVisible"), bool) else None,
            "surface": surface_name(after.get("surface")),
            "title": title_kind(after.get("title")),
            "path": path_class(after.get("path")),
        },
        "fakedResponse": payload.get("fakedResponse") is True,
        "injectedAuthState": payload.get("injectedAuthState") is True,
        "mockDocuments": "synthetic-fixture-only",
        "actor": "disposable-generated",
        "domain": "example.invalid",
        "birthYear": 2015,
        "passwordOmitted": True,
        "identifierOmitted": True,
        "nonceOmitted": True,
    }
    return holds, public


def contains_secret(ns: dict[str, object], text: str) -> bool:
    secrets = ns["RT"].secrets
    return any(isinstance(secret, str) and secret and secret in text for secret in secrets)


def run_tail(ns: dict[str, object], tls: dict[str, str], scratch: Path) -> dict[str, object]:
    payload = {"ownedLease": True, "caPem": tls["ca"]}
    proc = subprocess.Popen(
        ["node", "--unhandled-rejections=strict", str(TAIL)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=node_env(scratch),
        cwd=str(JOB),
        start_new_session=True,
    )
    TAIL_STATE.proc = proc
    TAIL_STATE.pid = proc.pid if isinstance(proc.pid, int) else 0
    try:
        out, err = proc.communicate(json.dumps(payload).encode("utf-8"), timeout=TAIL_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        release_tail(ns)
        try:
            proc.communicate(timeout=5)
        except (OSError, subprocess.TimeoutExpired):
            pass
        raise Stop("h5-timeout") from None
    text = out.decode("utf-8", "replace")
    errors = err.decode("utf-8", "replace")
    if contains_secret(ns, text) or contains_secret(ns, errors):
        raise Stop("secret-in-output")
    line = text.strip().splitlines()[-1] if text.strip() else ""
    try:
        parsed = json.loads(line)
    except json.JSONDecodeError:
        raise Stop("h5") from None
    if not isinstance(parsed, dict) or parsed.get("job") != JOB_ID:
        raise Stop("h5")
    encoded = json.dumps(parsed, sort_keys=True)
    if contains_secret(ns, encoded) or "sessionId" in encoded or any(marker in encoded for marker in ("G413!", "g413-", "G435!", "g435-", "G444!", "g444-", "G457!", "g457-")):
        raise Stop("secret-in-output")
    return parsed


def base_receipt(head: str, probe: dict[str, object], stage: str) -> dict[str, object]:
    return {
        "job": JOB_ID,
        "sourceHead": head,
        "sourceHeadRole": "git-HEAD-only",
        "checkoutHeadIsIntegratedDev": False,
        "integratedDevCommit": INTEGRATED_DEV,
        "composition": "ed6a1e57 base + B153/G447 dependency files + B156 five mobile files",
        "stage": stage,
        "executed": False,
        "processesStarted": False,
        "probeExecuted": False,
        "probe": probe,
        "iamJarSha256": None,
        "gatewayJarSha256": GATEWAY_SHA,
        "indexSha256": H5_SHA,
        "ports": list(PORTS),
        "containerName": CONTAINER,
        "label": LABEL,
        "gatewayModes": {domain: "LEGACY" for domain in DOMAINS},
        "commerceTarget": False,
        "domainProcesses": "not-started",
        "publicationSeed": "three-synthetic-fixtures",
        "consentWrite": "not-sent",
        "gateway": "not-started",
        "browser": "not-started",
        "h5": "not-started",
        "actor": "disposable-generated",
        "passwordOmitted": True,
    }


def write_preflight(ns: dict[str, object], payload: dict[str, object]) -> None:
    ns["write_json"](JOB / "preflight.json", payload)


def preflight(ns: dict[str, object]) -> dict[str, object]:
    runtime = ns["RT"]
    runtime.stage = "source-head"
    head = source_head()
    runtime.stage = "sources"
    require_local_sources()
    runtime.stage = "composition"
    require_composition()
    runtime.stage = "pins"
    pinned = ns["require_pins"]()
    substituted = pinned.pop("substituted", None)
    if not isinstance(substituted, str) or "start_gateway" in substituted or "route.fulfill(" in substituted:
        raise Stop("probe-rejection-check")
    del substituted
    probe = probe_public(pinned)
    runtime.stage = "gateway-jar"
    ns["require_file"](GATEWAY_JAR, GATEWAY_SHA, "gateway-jar-pin")
    runtime.stage = "gateway-mode"
    sealed = gateway_env(ns)
    if any(sealed.get(f"B14_ROUTE_MODE_{domain}") != "LEGACY" for domain in DOMAINS):
        raise Stop("gateway-mode")
    runtime.stage = "python-version"
    ns["require_python"]()
    runtime.stage = "tools"
    ns["require_tools"]()
    runtime.stage = "java-version"
    ns["require_java"]()
    runtime.stage = "docker-context"
    ns["require_docker_context"]()
    runtime.stage = "mysql-image"
    ns["require_image"]()
    runtime.stage = "mysql-name"
    ns["require_name_absent"]()
    runtime.stage = "ports"
    require_all_ports_free(ns)
    body = base_receipt(head, probe, "preflight")
    body["iamJarSha256"] = ns["IAM_SHA"]
    body["status"] = "PREFLIGHT"
    body["reason"] = None
    return body


def finish(ns: dict[str, object], markers: tuple[str, ...]) -> dict[str, object]:
    tail_counts = release_tail(ns)
    chrome_counts = release_chrome(ns, markers)
    try:
        body = ns["cleanup"]()
    except Exception:
        body = {}
    body = body if isinstance(body, dict) else {}
    body["javaReported"] = count_snapshot(body.get("java"))
    body["probeReported"] = count_snapshot(body.get("probe"))
    try:
        body["java"] = recount_owned(ns, ns["is_java_process"])
    except Exception:
        body["java"] = {"signaled": 0, "reaped": 0, "unverified": 1, "remaining": 1}
    try:
        body["probe"] = recount_owned(ns, ns["is_probe_process"])
    except Exception:
        body["probe"] = {"signaled": 0, "reaped": 0, "unverified": 1, "remaining": 1}
    body["tail"] = tail_counts
    body["chrome"] = chrome_counts
    try:
        body["containerFacts"] = container_facts(ns)
    except Exception:
        body["containerFacts"] = {
            "nameAbsent": None,
            "labelAbsent": None,
            "idState": "unknown",
            "identityAmbiguous": True,
            "currentReleased": False,
        }
    time.sleep(0.5)
    try:
        free = ports_free(ns)
    except Exception:
        free = {str(port): False for port in PORTS}
    body["extraPortsFree"] = free
    body["ports"] = list(PORTS)
    return body


def cleanup_holds(body: dict[str, object]) -> bool:
    facts = body.get("containerFacts")
    free = body.get("extraPortsFree")
    if not isinstance(facts, dict) or facts.get("currentReleased") is not True or facts.get("identityAmbiguous") is not False:
        return False
    if body.get("scratchRemoved") is not True:
        return False
    if not all(reap_settled(body.get(name)) for name in ("java", "probe", "tail", "chrome")):
        return False
    return isinstance(free, dict) and all(free.get(str(port)) is True for port in PORTS)


def run_services(ns: dict[str, object], public: dict[str, object]) -> dict[str, object]:
    runtime = ns["RT"]
    scratch: Path | None = None
    markers: tuple[str, ...] = ()
    iam_password = ""
    try:
        runtime.stage = "scratch"
        scratch = ns["make_scratch"]()
        public["processesStarted"] = True
        public["executed"] = True
        logs = scratch / "logs"
        logs.mkdir(mode=0o700)
        markers = (str(scratch), str(scratch.resolve()))
        runtime.stage = "mysql-launch"
        _container, iam_password, admin_password = ns["start_mysql"](scratch)
        admin_password = ""
        runtime.stage = "tls"
        tls = ns["prepare_tls"](scratch)
        runtime.stage = "iam-start"
        ns["start_iam"](tls, iam_password, logs / "iam.log")
        runtime.stage = "publication-seed"
        ns["seed_publication"](scratch, ns["extract_connector"](scratch), iam_password)
        runtime.stage = "gateway-start"
        start_gateway(ns, tls, logs / "gateway.log")
        public["gateway"] = "started"
        runtime.stage = "h5"
        observed, projection = observer_holds(run_tail(ns, tls, scratch))
        public["browser"] = "started"
        public["h5"] = "started"
        public["observer"] = projection
        public["observerStatus"] = projection.get("status")
        if not observed:
            raise Stop(token(projection.get("reason")) or "receipt-not-observed")
        public["status"] = "OBSERVED"
        public["reason"] = None
    finally:
        iam_password = ""
        if public.get("processesStarted") is True:
            if scratch is not None and not markers:
                markers = (str(scratch),)
            public["cleanup"] = finish(ns, markers)
    return public


def main() -> int:
    args = sys.argv[1:]
    preflight_only = args == ["--preflight-only"]
    if args and not preflight_only:
        say("CLOSED", "argv-rejected")
        return 2
    if not same_script():
        say("CLOSED", "script-root")
        return 2
    receipt = JOB / "lease-receipt.json"
    scratch = JOB / "scratch"
    if receipt.exists() or receipt.is_symlink():
        say("CLOSED", "receipt-present")
        return 2
    if scratch.exists() or scratch.is_symlink():
        say("CLOSED", "scratch-present")
        return 2
    namespace: dict[str, object] | None = None
    public: dict[str, object] = {"job": JOB_ID, "status": "FAILED", "reason": "not-started", "processesStarted": False, "executed": False}
    try:
        namespace = load_supervisor()
        public = preflight(namespace)
        if preflight_only:
            write_preflight(namespace, public)
            written = json.loads((JOB / "preflight.json").read_text(encoding="utf-8"))
            if written.get("status") != "PREFLIGHT" or written.get("processesStarted") is not False or written.get("executed") is not False:
                say("PREFLIGHT_FAIL", written.get("reason") or "preflight")
                return 2
            say("PREFLIGHT", None)
            return 0
        public = run_services(namespace, public)
    except KeyboardInterrupt:
        public["status"] = "FAILED"
        public["reason"] = "signal"
    except Exception as error:
        public["status"] = "FAILED"
        public["reason"] = reason_of(error)
    if public.get("processesStarted") is not True:
        reason = token(public.get("reason")) or "preflight-failed"
        if namespace is not None:
            try:
                write_preflight(namespace, {
                    "job": JOB_ID,
                    "status": "PREFLIGHT_FAIL",
                    "reason": reason,
                    "stage": namespace["RT"].stage,
                    "processesStarted": False,
                    "executed": False,
                    "probeExecuted": False,
                })
            except Exception:
                pass
        say("PREFLIGHT_FAIL", reason)
        return 2
    if public.get("status") == "OBSERVED" and not cleanup_holds(public.get("cleanup") if isinstance(public.get("cleanup"), dict) else {}):
        public["status"] = "FAILED"
        public["reason"] = "cleanup-incomplete"
    public["probeExecuted"] = False
    public["iamJarSha256"] = namespace["IAM_SHA"] if namespace is not None else None
    public["stage"] = namespace["RT"].stage if namespace is not None else public.get("stage")
    if namespace is None:
        say("FAILED", "receipt-write")
        return 1
    try:
        namespace["write_json"](receipt, public)
        written = json.loads(receipt.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, Exception):
        say("FAILED", "receipt-write")
        return 1
    say(str(written.get("status")), written.get("reason"))
    if written.get("status") == "OBSERVED" and written.get("reason") is None and written.get("probeExecuted") is False and written.get("processesStarted") is True:
        return 0
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        say("FAILED", "signal")
        sys.exit(1)

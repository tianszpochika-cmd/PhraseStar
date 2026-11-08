#!/usr/bin/env python3
"""Release the one process group created with Popen(start_new_session=True)."""

from __future__ import annotations

import argparse
import errno
import json
import os
import signal
import subprocess
import sys
import tempfile
import time

USAGE, TIMEOUT_EXIT, SPAWN, REMAINS = 2, 124, 127, 1
TERM_GRACE, KILL_GRACE, SLICE = 0.8, 0.4, 0.2
_SEEN: int | None = None


def _flag(signum: int, _frame: object) -> None:
    global _SEEN
    if _SEEN is None:
        _SEEN = signum


def _own() -> tuple[int, int, int]:
    pid = os.getpid()
    return (pid, os.getpgrp(), os.getsid(pid))


def _safe(pgid: int, own: tuple[int, int, int]) -> bool:
    return pgid > 1 and pgid not in own


def _live(pgid: int, own: tuple[int, int, int]) -> bool | None:
    if not _safe(pgid, own):
        return None
    try:
        os.killpg(pgid, 0)
    except OSError as exc:
        if exc.errno == errno.ESRCH:
            return False
        if exc.errno == errno.EPERM:
            return True
        raise
    return True


def _kill(pgid: int, sig: int, own: tuple[int, int, int]) -> None:
    if _live(pgid, own) is not True:
        return
    try:
        os.killpg(pgid, sig)
    except OSError as exc:
        if exc.errno not in (errno.ESRCH, errno.EPERM):
            raise


def _bound(proc: subprocess.Popen[bytes], pgid: int, own: tuple[int, int, int], grace: float) -> None:
    end = time.monotonic() + grace
    while time.monotonic() < end:
        proc.poll()
        if _live(pgid, own) is not True:
            return
        time.sleep(0.05)
    proc.poll()


def _release(proc: subprocess.Popen[bytes], pgid: int, own: tuple[int, int, int]) -> bool:
    _kill(pgid, signal.SIGTERM, own)
    _bound(proc, pgid, own, TERM_GRACE)
    _kill(pgid, signal.SIGKILL, own)
    _bound(proc, pgid, own, KILL_GRACE)
    return proc.poll() is not None and _live(pgid, own) is False


def _group(proc: subprocess.Popen[bytes], own: tuple[int, int, int]) -> int | None:
    # Live leader: getpgid(pid) == getsid(pid) == pid. ps sess is 0 on this Mac; do not read it.
    pid = proc.pid
    try:
        pgid, sid = os.getpgid(pid), os.getsid(pid)
    except OSError as exc:
        if exc.errno != errno.ESRCH:
            raise
        return pid if _safe(pid, own) else None
    if pgid == sid == pid and _safe(pgid, own):
        return pgid
    return None


def _save(path: str, outcome: str, launched: bool, rc: int | None, guard: int, released: bool, ok: bool) -> int:
    body = {
        "outcome": outcome,
        "launched": launched,
        "commandReturnCode": rc,
        "guardExit": guard,
        "spawnedGroupReleased": released,
        "cleanupOk": ok,
    }
    folder = os.path.dirname(path) or "/"
    fd, tmp = tempfile.mkstemp(prefix=".pg-", dir=folder)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(body, handle, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
        tmp = ""
    finally:
        if tmp:
            try:
                os.unlink(tmp)
            except OSError:
                pass
    os.chmod(path, 0o600)
    return guard


def _cli(argv: list[str]) -> tuple[str, float, list[str]] | None:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--timeout", required=True, type=float)
    try:
        ns, rest = parser.parse_known_args(argv)
    except SystemExit:
        return None
    if rest[:1] == ["--"]:
        rest = rest[1:]
    if os.path.isabs(ns.receipt) and ns.timeout > 0:
        return ns.receipt, float(ns.timeout), rest
    return None


def main(argv: list[str]) -> int:
    for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, _flag)
    own = _own()
    parsed = _cli(argv)
    if parsed is None:
        return USAGE
    receipt, timeout, command = parsed
    if not command:
        return _save(receipt, "no_command", False, None, USAGE, True, True)
    try:
        proc = subprocess.Popen(command, start_new_session=True, stdout=None, stderr=None, env=None)
    except OSError:
        return _save(receipt, "spawn_failure", False, None, SPAWN, True, True)
    pgid = _group(proc, own)
    if pgid is None:
        if proc.poll() is None and _safe(proc.pid, own):
            proc.terminate()
        try:
            proc.wait(timeout=TERM_GRACE)
        except subprocess.TimeoutExpired:
            pass
        return _save(receipt, "ownership_rejected", True, proc.poll(), REMAINS, False, False)
    deadline, outcome = time.monotonic() + timeout, "exited"
    while proc.poll() is None:
        if _SEEN is not None:
            outcome = "signaled"
            break
        left = deadline - time.monotonic()
        if left <= 0:
            outcome = "timeout"
            break
        try:
            proc.wait(timeout=min(SLICE, left))
        except subprocess.TimeoutExpired:
            continue
    released = _release(proc, pgid, own)
    rc = proc.returncode
    if not released:
        guard = REMAINS
        if outcome == "exited":
            outcome = "group_remains"
    elif outcome == "timeout":
        guard = TIMEOUT_EXIT
    elif outcome == "signaled":
        guard = 128 + int(_SEEN or signal.SIGTERM)
    elif rc is None:
        guard = REMAINS
    elif rc < 0:
        guard = 128 + (-rc)
    else:
        guard = rc
    return _save(receipt, outcome, True, rc, guard, released, released)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

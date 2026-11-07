#!/usr/bin/env python3
"""G403 one-click published-reading score lease.

Checks the frozen G314 runner and hook, the G280 observer, the G360/G399
wrapper pin, the G351/B139 H5 index, and the G387 score CLI pin by SHA-256.
Rebinds the G403 lease, keeps the G338 answer-leak and keyboard practice
entry, then requires one visible CHOICE click, one continued attempt POST,
saved/feedback DOM, same-key replay, and G387 session readback. Hashing uses
hashlib of the exact file bytes. This seam does not call a shell.
"""

from __future__ import annotations

import hashlib
import json
import os
import stat
import sys
from pathlib import Path

REQUESTED_ROOT = Path("/tmp/grok-mobile-resume-reading-403")
PRIVATE_ROOT = Path("/private/tmp/grok-mobile-resume-reading-403")
AUTHORIZED = REQUESTED_ROOT.resolve()
KIND = "MB403"
FROZEN_RUNNER = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/resume-20261105/reading-practice-owner-grant-314-frozen/run-reading-owner.py"
)
FROZEN_HOOK = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/resume-20261105/reading-practice-owner-grant-314-frozen/reading-live-hook.mjs"
)
FROZEN_G280 = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/resume-20261105/reading-pinned-practice-h5-observer-280-frozen/reading-practice-h5.cjs"
)
FROZEN_G360_WRAPPER = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/resume-20261105/reading-integrated-h5-runtime-pin-360-frozen/reading-practice-h5.cjs"
)
FROZEN_G360_HOOK = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/resume-20261105/reading-integrated-h5-runtime-pin-360-frozen/reading-live-hook.mjs"
)
FROZEN_G360_RUNNER = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/resume-20261105/reading-integrated-h5-runtime-pin-360-frozen/run-reading-owner.py"
)
FROZEN_G387_SCORE = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/resume-20261105/reading-score-login-envelope-bound-387-frozen/"
    "reading-assessment-score.mjs"
)
FROZEN_G399_HOOK = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/user-pause-20261106/worker-snapshots/399/reading-live-hook.mjs"
)
FROZEN_G399_OBSERVER = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/user-pause-20261106/worker-snapshots/399/reading-practice-h5.cjs"
)
FROZEN_G399_RUNNER = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/user-pause-20261106/worker-snapshots/399/run-reading-owner.py"
)
FROZEN_RUNNER_SHA = "415f98729c5670a5662a1467ef719bbea230705920749b715391485c35e244d4"
FROZEN_HOOK_SHA = "0a3f35a5f894f298919420c3d93c55f8b2c36dfd8be9e8e3f8eb98e45dc2ec47"
G280_OBSERVER_SHA = "679db31207ef097a117170a88b1ba2d305f0755b7f2ddc38f5c070be91573137"
G360_WRAPPER_SHA = "fa504d284cbcd8fe9a56c9f32cf0c1d5c871b53dc288a2f60a858c557b3ac0a1"
G360_HOOK_SHA = "b2260bb649fd8d6ab0c3cdf7e82ccdec10edf27453670c205612bf5b9ee8b5e8"
G360_RUNNER_SHA = "70d2cb1c92afc5b64fd913949f6fc6eea6ad3ab4dbe5c3387b54190558f7e55c"
G387_SCORE_SHA = "d5435882744debab29b679c65da88935978dd0c25b110cc613a507ea12e16fa5"
G271_H5_INDEX_SHA = "6774df66f2ac6521640295859b0f419b710565863ec5908c82c6ef13917ea546"
G271_H5_DIR_MARK = "reading-practice-expiry-271-root/h5"
B139_H5_INDEX_SHA = "706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32"
G351_H5_INDEX_SHA = B139_H5_INDEX_SHA
G351_H5_DIR_MARK = "reading-practice-integrated-g351-root/h5"
G351_H5_LITERAL = (
    '"/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"\n'
    '    "mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5"'
)
ASSESSMENT_JAR_SHA = "467fb91b9299c0569f48d52b482be580a18b6a9b90bd74aa523659e16fed6912"
CONTENT_JAR_SHA = "852578df43b40fdc45569a6e60c074c3561c0b43bf8e7bd6b8acafd51e2f3eb2"
FIXTURE_SHA = "591ed6e403e2bc2a7ba84029435f8907737fdc095b47bf45f7625b449500ca06"
OBSERVER_ASSIGNMENT = """OBSERVER = Path(
    "/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/"
    "mobile-supervision/resume-20261105/reading-pinned-practice-h5-observer-280-frozen/reading-practice-h5.cjs"
)"""


def fail(reason: str) -> None:
    sys.stdout.write(json.dumps({
        "historicalReceiptsAreNotRuntime": True,
        "kind": KIND,
        "reason": reason,
        "stage": "preflight",
        "status": "FAIL",
    }, sort_keys=True) + "\n")
    raise SystemExit(2)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def regular(path: Path) -> bool:
    try:
        listed = path.lstat()
        real = path.resolve(strict=True)
    except OSError:
        return False
    return stat.S_ISREG(listed.st_mode) and not stat.S_ISLNK(listed.st_mode) and real == path


def replace_exact(source: str, old: str, new: str, count: int, label: str) -> str:
    if source.count(old) != count:
        fail(label)
    return source.replace(old, new)


def reject_stale_identity(text: str, label: str) -> None:
    for marker in (
        "MB314", "mb314", "Mb314",
        "MB360", "mb360", "Mb360",
        "MB387", "mb387", "Mb387",
        "MB399", "mb399", "Mb399",
    ):
        if marker in text:
            fail(label)


def write_bytes(path: Path, text: str) -> None:
    if path.parent != AUTHORIZED:
        fail("script-root")
    fd = os.open(path, os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o644)
    with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())


def file_row(path: Path) -> dict[str, object]:
    return {"bytes": path.stat().st_size, "name": path.name, "sha256": sha256_file(path)}


def hook_text(raw: str) -> str:
    text = raw
    pairs = (
        ("MB314_READING_LIVE_HOOK", "MB403_READING_LIVE_HOOK", 1),
        ("MB314_RUN_ID", "MB403_RUN_ID", 1),
        ("mb314-reading-live-hook/1", "mb403-reading-live-hook/1", 1),
        ("mb314-${suffix}-${runId}-1", "mb403-${suffix}-${runId}-1", 1),
    )
    for old, new, count in pairs:
        if text.count(old) != count:
            fail("wrapper-files")
        text = text.replace(old, new)
    reject_stale_identity(text, "wrapper-files")
    if "route.fulfill" in text or "/api/v1/reading" in text or "/api/v1/assessment" in text:
        fail("wrapper-files")
    for needle in (
        "MB403_READING_LIVE_HOOK",
        "MB403_RUN_ID",
        "mb403-reading-live-hook/1",
        "mb403-${suffix}-${runId}-1",
        "content.read",
        "Idempotency-Key",
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "response.statusCode",
        "once('end'",
        "statusOf(",
        "assessment.session.write",
        "assessment.session.read",
        "learner.target.write",
        "consent_state",
        "GRANTED",
    ):
        if needle not in text:
            fail("wrapper-files")
    return text


def require_g387_pin() -> None:
    if not regular(FROZEN_G387_SCORE) or sha256_file(FROZEN_G387_SCORE) != G387_SCORE_SHA:
        fail("hash-mismatch")
    text = FROZEN_G387_SCORE.read_text(encoding="utf-8")
    for needle in (
        "selectedOptionKeys",
        "已保存",
        "ASSESSED",
        "enterPhase('replay')",
        "snap_reading_",
        "ownerCountUnchanged",
        "h5Proof",
        "reading.bind.b9",
        "88062",
        "content:answer-rules:read",
    ):
        if needle not in text:
            fail("g387-pin")
    if "child_process" in text or "createServer" in text or "18091" in text:
        fail("g387-pin")


def require_observer_text(text: str) -> None:
    for needle in (
        "settleLiveDetailCta",
        'button.reading-cta[data-action="published-practice"]',
        '.reading-cta[data-action="published-practice"]',
        "published-practice-scored",
        "data-save-receipt",
        "data-feedback-text",
        ".b10-exercise-card .b10-option",
        "attempt-post",
        "attempt-replay",
        "attemptBodyVerdict",
        "selectedOptionKeys",
        "clickVisibleChoice",
        "feedback-not-rendered",
        "reading-pinned-practice-h5-observer-280-frozen/reading-practice-h5.cjs",
    ):
        if needle not in text:
            fail("observer-seam")
    stem_needle = "\\'\"gradableQuestions\"\\', \\'readingRuleSeal\\', \\'Owner stem\\',"
    stem_kept = "\\'\"gradableQuestions\"\\', \\'readingRuleSeal\\',"
    if text.count(stem_needle) != 1 or text.count(stem_kept) != 2:
        fail("observer-seam")
    if "\\'Owner stem\\', \\'Owned  sentence\\'" not in text:
        fail("observer-seam")
    if "shell=True" in text or "os.system(" in text or "/bin/bash" in text:
        fail("observer-seam")


def require_script_root() -> Path:
    if REQUESTED_ROOT.name != "grok-mobile-resume-reading-403":
        fail("script-root")
    if REQUESTED_ROOT != Path("/tmp") / REQUESTED_ROOT.name:
        fail("script-root")
    if PRIVATE_ROOT != Path("/private/tmp") / REQUESTED_ROOT.name:
        fail("script-root")
    if AUTHORIZED != REQUESTED_ROOT.resolve():
        fail("script-root")
    try:
        if REQUESTED_ROOT.is_symlink() or not REQUESTED_ROOT.is_dir():
            fail("script-root")
        if PRIVATE_ROOT.is_symlink() or not PRIVATE_ROOT.is_dir():
            fail("script-root")
        if REQUESTED_ROOT.resolve(strict=True) != AUTHORIZED:
            fail("script-root")
        if PRIVATE_ROOT.resolve(strict=True) != AUTHORIZED:
            fail("script-root")
        if not os.path.samefile(REQUESTED_ROOT, PRIVATE_ROOT):
            fail("script-root")
    except OSError:
        fail("script-root")
    here = Path(__file__).resolve()
    if here.parent != AUTHORIZED or here.name != "run-reading-owner.py":
        fail("script-root")
    if here != AUTHORIZED / "run-reading-owner.py":
        fail("script-root")
    for name in ("run-reading-owner.py", "reading-practice-h5.cjs"):
        expected = AUTHORIZED / name
        if not regular(expected):
            fail("script-root")
        try:
            if (REQUESTED_ROOT / name).resolve(strict=True) != expected:
                fail("script-root")
            if (PRIVATE_ROOT / name).resolve(strict=True) != expected:
                fail("script-root")
            if not os.path.samefile(REQUESTED_ROOT / name, expected):
                fail("script-root")
            if not os.path.samefile(PRIVATE_ROOT / name, expected):
                fail("script-root")
        except OSError:
            fail("script-root")
    return here


def read_own_file(here: Path) -> str:
    if here != AUTHORIZED / "run-reading-owner.py":
        fail("script-root")
    text = here.read_text(encoding="utf-8")
    for needle in (
        "/tmp/grok-mobile-resume-reading-403",
        "/private/tmp/grok-mobile-resume-reading-403",
        "MB403",
        "MB403_RUN_ID",
        "MB403_READING_LIVE_HOOK",
        "Mb403!",
        "mb403-{rt.run_id}@example.invalid",
        "mobile-resume-reading-403",
        "G403 canonical directory",
        B139_H5_INDEX_SHA,
        G387_SCORE_SHA,
        G360_WRAPPER_SHA,
        "published-practice-scored",
        "BINARY 'ASSESSED'",
    ):
        if needle not in text:
            fail("script-root")
    return text


def transform(source: str, observer_sha: str) -> str:
    source = replace_exact(
        source,
        "/tmp/grok-mobile-reading-practice-owner-grant-314",
        "/tmp/grok-mobile-resume-reading-403",
        2,
        "lease-path",
    )
    source = replace_exact(
        source,
        "mobile-reading-practice-owner-grant-314",
        "mobile-resume-reading-403",
        3,
        "lease-name",
    )
    source = replace_exact(source, "G314 canonical directory", "G403 canonical directory", 1, "lease-name")
    source = replace_exact(source, "MB314_READING_LIVE_HOOK", "MB403_READING_LIVE_HOOK", 1, "lease-name")
    source = replace_exact(source, "MB314_RUN_ID", "MB403_RUN_ID", 1, "lease-name")
    source = replace_exact(source, "MB314_PINNED_PRACTICE_RUNTIME", KIND, 1, "lease-name")
    source = replace_exact(
        source,
        'f"mb314-{rt.run_id}@example.invalid"',
        'f"mb403-{rt.run_id}@example.invalid"',
        1,
        "lease-name",
    )
    source = replace_exact(source, '"Mb314!"', '"Mb403!"', 1, "lease-name")
    source = replace_exact(source, "The frozen G280 observer owns", "The trusted G403 observer owns", 1, "lease-name")
    source = replace_exact(source, OBSERVER_ASSIGNMENT, 'OBSERVER = AUTHORIZED / "reading-practice-h5.cjs"', 1, "observer-seam")
    source = replace_exact(
        source,
        f'OBSERVER_SHA = "{G280_OBSERVER_SHA}"',
        f'OBSERVER_SHA = "{observer_sha}"',
        1,
        "observer-seam",
    )
    source = replace_exact(
        source,
        "def run_observer(rt: Runtime) -> None:\n",
        '''def safe_cta(parsed: dict[str, object]):
    raw = parsed.get("cta")
    if not isinstance(raw, dict):
        return None
    tag = raw.get("tag")
    if tag not in {"button", "uni-button", "other", "mixed", "none"}:
        return None
    tags = raw.get("tags") if isinstance(raw.get("tags"), dict) else {}

    def count(name: str) -> int:
        value = tags.get(name)
        return value if type(value) is int and 0 <= value <= 99 else 0

    total = raw.get("count")
    return {
        "count": total if type(total) is int and 0 <= total <= 99 else 0,
        "tag": tag,
        "tags": {"button": count("button"), "uniButton": count("uniButton"), "other": count("other")},
        "visible": raw.get("visible") is True,
        "disabled": raw.get("disabled") is True,
        "openLabel": raw.get("openLabel") is True,
        "closedLabel": raw.get("closedLabel") is True,
    }


def redacted_observer_failure(parsed: dict[str, object]) -> dict[str, object]:
    reason = parsed.get("reason")
    allowed = {
        "choice-not-clicked", "choice-target", "second-submit-present",
        "attempt-not-one", "attempt-leak", "attempt-key-rejected",
        "attempt-body-rejected", "feedback-not-rendered", "replay-not-200",
        "replay-not-sent", "replay-not-one", "replay-attempt-mismatch",
        "cta-not-activated", "cta-not-open", "cta-not-visible",
        "ui-not-question", "observer-failed", "deadline",
    }
    receipt = {
        "status": parsed.get("status") if parsed.get("status") in {"FAILED", "HELD", "BLOCKED", "OBSERVED"} else None,
        "reason": reason if isinstance(reason, str) and reason in allowed else None,
        "h5Proof": False,
    }
    choice = parsed.get("choice") if isinstance(parsed.get("choice"), dict) else {}
    if choice.get("gesture") in {"click", "none"}:
        receipt["choiceGesture"] = choice.get("gesture")
    return receipt


def run_observer(rt: Runtime) -> None:
''',
        1,
        "observer-seam",
    )
    source = replace_exact(
        source,
        '''        rt.observer["dialedMysql"] = dialed.get("mysql") is True
    rt.summary["observer"] = rt.observer
''',
        '''        rt.observer["dialedMysql"] = dialed.get("mysql") is True
    if parsed.get("status") != "OBSERVED":
        cta = safe_cta(parsed)
        if cta is not None:
            rt.observer["cta"] = cta
        rt.summary["observerFailure"] = redacted_observer_failure(parsed)
    rt.summary["observer"] = rt.observer
    rt.summary["h5Proof"] = parsed.get("status") == "OBSERVED" and parsed.get("reason") == "published-practice-scored"
''',
        1,
        "observer-seam",
    )
    source = replace_exact(
        source,
        '        "sameSession": practice.get("sameSession") is True,\n'
        '        "questionSame": practice.get("questionSame") is True,\n'
        "    }\n",
        '        "sameSession": practice.get("sameSession") is True,\n'
        '        "questionSame": practice.get("questionSame") is True,\n'
        '        "choiceGesture": practice.get("choiceGesture") if practice.get("choiceGesture") in {"click", "none"} else None,\n'
        '        "choiceCount": practice.get("choiceCount") if type(practice.get("choiceCount")) is int else None,\n'
        '        "attemptStatus": practice.get("attemptStatus") if type(practice.get("attemptStatus")) is int else None,\n'
        '        "replayStatus": practice.get("replayStatus") if type(practice.get("replayStatus")) is int else None,\n'
        '        "savedReceipt": practice.get("savedReceipt") is True,\n'
        '        "feedbackVisible": practice.get("feedbackVisible") is True,\n'
        '        "sameAttempt": practice.get("sameAttempt") is True,\n'
        '        "scoreBucket": practice.get("scoreBucket") if practice.get("scoreBucket") in {"FULL", "ZERO"} else None,\n'
        "    }\n",
        1,
        "observer-seam",
    )
    source = replace_exact(
        source,
        '        or parsed.get("status") != "OBSERVED" or parsed.get("reason") != "published-practice"\n'
        '        or parsed.get("publishedDetail") != "article-88061" or parsed.get("practiceEntry") != "opened"\n'
        "        or parsed.get(\"acceptsEmpty\") is not False\n"
        '        or parsed.get("indexPin") != "pinned" or safe_counts.get("syntheticFulfills") != 0\n'
        '        or safe_counts.get("practicePosts") != 1 or safe_counts.get("practiceGets") != 1\n'
        '        or safe_counts.get("attemptWrites") != 0 or safe_counts.get("scoreWrites") != 0\n'
        '        or safe_counts.get("learningWrites") != 0 or safe_counts.get("legacyCreates") != 0\n',
        '        or parsed.get("status") != "OBSERVED" or parsed.get("reason") != "published-practice-scored"\n'
        '        or parsed.get("publishedDetail") != "article-88061" or parsed.get("practiceEntry") != "opened"\n'
        "        or parsed.get(\"acceptsEmpty\") is not False\n"
        '        or parsed.get("indexPin") != "pinned" or safe_counts.get("syntheticFulfills") != 0\n'
        '        or safe_counts.get("practicePosts") != 1 or safe_counts.get("practiceGets") != 1\n'
        '        or safe_counts.get("attemptPosts") != 1 or safe_counts.get("attemptReplays") != 1\n'
        '        or safe_counts.get("attemptWrites") != 0 or safe_counts.get("scoreWrites") != 0\n'
        '        or safe_counts.get("learningWrites") != 0 or safe_counts.get("legacyCreates") != 0\n',
        1,
        "observer-seam",
    )
    source = replace_exact(
        source,
        '        or practice.get("questionSame") is not True\n',
        '        or practice.get("questionSame") is not True\n'
        '        or practice.get("choiceGesture") != "click" or practice.get("choiceCount") != 1\n'
        '        or practice.get("attemptStatus") != 200 or practice.get("replayStatus") != 200\n'
        '        or practice.get("savedReceipt") is not True or practice.get("feedbackVisible") is not True\n'
        '        or practice.get("sameAttempt") is not True\n'
        '        or practice.get("scoreBucket") not in {"FULL", "ZERO"}\n',
        1,
        "observer-seam",
    )
    source = replace_exact(
        source,
        "   AND status = BINARY 'IN_PROGRESS'\n"
        "   AND content_code = BINARY 'reading.bind.b9'\n"
        "   AND content_version_id = {version}\n"
        "   AND alternative_content_version_id IS NULL\n"
        "   AND alternative_content_code IS NULL\n"
        "   AND alternative_reason_code IS NULL\n"
        "   AND owner_snapshot_ref = BINARY '{ref}'\n"
        "   AND snapshot_id = {version}\n"
        "   AND content_epoch >= 0\n"
        "   AND CHAR_LENGTH(snapshot_hash) = 64\n"
        "   AND snapshot_hash REGEXP '^[a-f0-9]{{64}}$'\n"
        "   AND state_version = 1\n"
        "   AND attempt_count = 0\n"
        "   AND JSON_TYPE(answers_json) = 'OBJECT'\n"
        "   AND JSON_LENGTH(answers_json) = 0\n",
        "   AND status = BINARY 'ASSESSED'\n"
        "   AND content_code = BINARY 'reading.bind.b9'\n"
        "   AND content_version_id = {version}\n"
        "   AND alternative_content_version_id IS NULL\n"
        "   AND alternative_content_code IS NULL\n"
        "   AND alternative_reason_code IS NULL\n"
        "   AND owner_snapshot_ref = BINARY '{ref}'\n"
        "   AND snapshot_id = {version}\n"
        "   AND content_epoch >= 0\n"
        "   AND CHAR_LENGTH(snapshot_hash) = 64\n"
        "   AND snapshot_hash REGEXP '^[a-f0-9]{{64}}$'\n"
        "   AND state_version = 2\n"
        "   AND attempt_count = 1\n"
        "   AND JSON_TYPE(answers_json) = 'OBJECT'\n"
        "   AND JSON_LENGTH(answers_json) = 1\n",
        1,
        "session-readback",
    )
    source = replace_exact(
        source,
        "    expected = {\n"
        '        "session_ok": 1,\n'
        '        "session_all": 1,\n'
        '        "attempts": 0,\n'
        '        "checkpoints": 0,\n'
        '        "outbox": 0,\n'
        "    }\n"
        "    if found != expected:\n"
        '        raise Stop("session-readback")\n'
        "    rt.session_readback_ok = True\n"
        '    rt.summary["sessionReadback"] = expected\n',
        "    expected = {\n"
        '        "session_ok": 1,\n'
        '        "session_all": 1,\n'
        '        "attempts": 1,\n'
        '        "checkpoints": 0,\n'
        '        "outbox": 3,\n'
        "    }\n"
        "    if found != expected:\n"
        '        raise Stop("session-readback")\n'
        "    rt.session_readback_ok = True\n"
        '    rt.summary["sessionReadback"] = {\n'
        "        **expected,\n"
        '        "attemptCountUnchanged": True,\n'
        "    }\n"
        '    rt.summary["canonicalOwnerRef"] = f"snap_reading_{rt.content_version}"\n'
        '    rt.summary["replayAttemptCount"] = 1\n'
        '    rt.summary["ownerCountUnchanged"] = True\n',
        1,
        "session-readback",
    )
    source = replace_exact(
        source,
        '        and rt.observer.get("status") == "OBSERVED"\n'
        '        and rt.observer.get("reason") == "published-practice"\n'
        '        and rt.observer.get("practiceEntry") == "opened"\n',
        '        and rt.observer.get("status") == "OBSERVED"\n'
        '        and rt.observer.get("reason") == "published-practice-scored"\n'
        '        and rt.observer.get("practiceEntry") == "opened"\n'
        '        and rt.summary.get("h5Proof") is True\n'
        '        and rt.summary.get("replayAttemptCount") == 1\n'
        '        and rt.summary.get("ownerCountUnchanged") is True\n',
        1,
        "observer-seam",
    )
    if any(char in G351_H5_DIR_MARK for char in "*?[]{}") or any(char in G351_H5_INDEX_SHA for char in "*?[]{}"):
        fail("h5-dir")
    if len(G351_H5_INDEX_SHA) != 64 or any(char not in "0123456789abcdef" for char in G351_H5_INDEX_SHA):
        fail("h5-dir")
    if G351_H5_DIR_MARK != "reading-practice-integrated-g351-root/h5":
        fail("h5-dir")
    if G351_H5_INDEX_SHA != B139_H5_INDEX_SHA:
        fail("h5-dir")
    if source.count(G271_H5_INDEX_SHA) != 1 or source.count(G271_H5_DIR_MARK) != 1:
        fail("h5-dir")
    source = replace_exact(source, G271_H5_DIR_MARK, G351_H5_DIR_MARK, 1, "h5-dir")
    source = replace_exact(source, G271_H5_INDEX_SHA, G351_H5_INDEX_SHA, 1, "h5-dir")
    if G271_H5_INDEX_SHA in source or G271_H5_DIR_MARK in source:
        fail("h5-dir")
    if source.count(G351_H5_INDEX_SHA) != 1 or source.count(G351_H5_DIR_MARK) != 1:
        fail("h5-dir")
    if source.count(G351_H5_LITERAL) != 1:
        fail("h5-dir")
    pin_line = f'H5_INDEX_SHA = "{G351_H5_INDEX_SHA}"\nH5_INDEX_PIN = H5_INDEX_SHA'
    if source.count(pin_line) != 1:
        fail("h5-dir")
    if ASSESSMENT_JAR_SHA not in source or CONTENT_JAR_SHA not in source or FIXTURE_SHA not in source:
        fail("hash-mismatch")
    if "UNTOUCHED = (18090,)" not in source or '"assessment", 18091' not in source:
        fail("port-lease")
    if "reading-pinned-practice-h5-observer-280-frozen/reading-practice-h5.cjs" in source:
        fail("observer-seam")
    if 'OBSERVER = AUTHORIZED / "reading-practice-h5.cjs"' not in source:
        fail("observer-seam")
    if "shell=True" in source or "os.system(" in source or "/bin/bash" in source:
        fail("observer-seam")
    reject_stale_identity(source, "observer-seam")
    if '"attempts": 0' in source or "AND attempt_count = 0" in source:
        fail("session-readback")
    if '"attempts": 1' not in source or "AND attempt_count = 1" not in source:
        fail("session-readback")
    if "BINARY 'ASSESSED'" not in source or "AND state_version = 2" not in source:
        fail("session-readback")
    if '"outbox": 3' not in source:
        fail("session-readback")
    if "published-practice-scored" not in source:
        fail("observer-seam")
    if 'practice.get("choiceGesture") != "click"' not in source:
        fail("observer-seam")
    if "lambda: run_observer(" not in source:
        fail("observer-seam")
    return source


def main() -> None:
    here = require_script_root()
    read_own_file(here)
    for path, expected in (
        (FROZEN_RUNNER, FROZEN_RUNNER_SHA),
        (FROZEN_HOOK, FROZEN_HOOK_SHA),
        (FROZEN_G280, G280_OBSERVER_SHA),
        (FROZEN_G360_WRAPPER, G360_WRAPPER_SHA),
        (FROZEN_G360_HOOK, G360_HOOK_SHA),
        (FROZEN_G360_RUNNER, G360_RUNNER_SHA),
        (FROZEN_G387_SCORE, G387_SCORE_SHA),
        (FROZEN_G399_HOOK, G360_HOOK_SHA),
        (FROZEN_G399_OBSERVER, G360_WRAPPER_SHA),
        (FROZEN_G399_RUNNER, G360_RUNNER_SHA),
    ):
        if not regular(path) or sha256_file(path) != expected:
            fail("hash-mismatch")
    require_g387_pin()
    observer = AUTHORIZED / "reading-practice-h5.cjs"
    if not regular(observer) or sha256_file(observer) == G280_OBSERVER_SHA:
        fail("hash-mismatch")
    if sha256_file(observer) == G360_WRAPPER_SHA:
        fail("observer-seam")
    require_observer_text(observer.read_text(encoding="utf-8"))
    observer_sha = sha256_file(observer)
    source = transform(FROZEN_RUNNER.read_text(encoding="utf-8"), observer_sha)
    text = hook_text(FROZEN_HOOK.read_text(encoding="utf-8"))
    write_bytes(AUTHORIZED / "reading-live-hook.mjs", text)
    rows = [file_row(observer), file_row(AUTHORIZED / "reading-live-hook.mjs"), file_row(here)]
    report = AUTHORIZED / "REPORT.md"
    if regular(report):
        rows.append(file_row(report))
    pins = AUTHORIZED / "pins.json"
    if regular(pins):
        rows.append(file_row(pins))
    manifest = {
        "b139IndexSha256": B139_H5_INDEX_SHA,
        "files": rows,
        "job": "resume-20261107-mobile-reading-403",
        "kind": KIND,
        "source": "/tmp/grok-mobile-resume-reading-403",
    }
    write_bytes(AUTHORIZED / "manifest.json", json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    compiled = compile(source, str(here), "exec")
    exec(compiled, {"__name__": "__main__", "__file__": str(here)})


if __name__ == "__main__":
    main()

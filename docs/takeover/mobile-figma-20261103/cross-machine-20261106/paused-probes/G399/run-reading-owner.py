#!/usr/bin/env python3
"""G360 canonical lease seam for the pinned practice owner runtime.

Checks the G314 runner and hook by SHA-256, rebinds the G360 lease and the
trusted observer path, and keeps the G338 answer-leak, keyboard, session-match,
and readback seam. The derived runner's H5 directory and index hash are
replaced with the literal G351 build. Hashing uses hashlib of the exact file
bytes. This seam does not call a shell.
"""

from __future__ import annotations

import hashlib
import json
import os
import stat
import sys
from pathlib import Path

REQUESTED_ROOT = Path("/tmp/grok-mobile-reading-integrated-h5-runtime-pin-360")
AUTHORIZED = REQUESTED_ROOT.resolve()
FROZEN_RUNNER = Path(
    "/LOCAL_HANDOFF_HOME/supervision-root/"
    "mobile-supervision/resume-20261105/reading-practice-owner-grant-314-frozen/run-reading-owner.py"
)
FROZEN_HOOK = Path(
    "/LOCAL_HANDOFF_HOME/supervision-root/"
    "mobile-supervision/resume-20261105/reading-practice-owner-grant-314-frozen/reading-live-hook.mjs"
)
FROZEN_RUNNER_SHA = "415f98729c5670a5662a1467ef719bbea230705920749b715391485c35e244d4"
FROZEN_HOOK_SHA = "0a3f35a5f894f298919420c3d93c55f8b2c36dfd8be9e8e3f8eb98e45dc2ec47"
G280_OBSERVER_SHA = "679db31207ef097a117170a88b1ba2d305f0755b7f2ddc38f5c070be91573137"
G271_H5_INDEX_SHA = "6774df66f2ac6521640295859b0f419b710565863ec5908c82c6ef13917ea546"
G271_H5_DIR_MARK = "reading-practice-expiry-271-root/h5"
G351_H5_INDEX_SHA = "706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32"
G351_H5_DIR_MARK = "reading-practice-integrated-g351-root/h5"
G351_H5_LITERAL = (
    '"/LOCAL_HANDOFF_HOME/supervision-root/"\n'
    '    "mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5"'
)
ASSESSMENT_JAR_SHA = "467fb91b9299c0569f48d52b482be580a18b6a9b90bd74aa523659e16fed6912"
CONTENT_JAR_SHA = "852578df43b40fdc45569a6e60c074c3561c0b43bf8e7bd6b8acafd51e2f3eb2"
FIXTURE_SHA = "591ed6e403e2bc2a7ba84029435f8907737fdc095b47bf45f7625b449500ca06"
OBSERVER_ASSIGNMENT = """OBSERVER = Path(
    "/LOCAL_HANDOFF_HOME/supervision-root/"
    "mobile-supervision/resume-20261105/reading-pinned-practice-h5-observer-280-frozen/reading-practice-h5.cjs"
)"""


def fail(reason: str) -> None:
    sys.stdout.write(json.dumps({
        "historicalReceiptsAreNotRuntime": True,
        "kind": "MB360_PINNED_PRACTICE_RUNTIME",
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


def replace_exact(source: str, old: str, new: str, count: int) -> str:
    if source.count(old) != count:
        fail("observer-seam")
    return source.replace(old, new)


def hook_text(raw: str) -> str:
    text = raw
    pairs = (
        ("MB314_READING_LIVE_HOOK", "MB360_READING_LIVE_HOOK", 1),
        ("MB314_RUN_ID", "MB360_RUN_ID", 1),
        ("mb314-reading-live-hook/1", "mb360-reading-live-hook/1", 1),
        ("mb314-${suffix}-${runId}-1", "mb360-${suffix}-${runId}-1", 1),
    )
    for old, new, count in pairs:
        if text.count(old) != count:
            fail("wrapper-files")
        text = text.replace(old, new)
    if "MB314" in text or "mb314" in text:
        fail("wrapper-files")
    if "route.fulfill" in text or "/api/v1/reading" in text or "/api/v1/assessment" in text:
        fail("wrapper-files")
    for needle in (
        "MB360_READING_LIVE_HOOK",
        "MB360_RUN_ID",
        "content.read",
        "Idempotency-Key",
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "response.statusCode",
        "once('end'",
        "statusOf(",
        "assessment.session.write",
        "assessment.session.read",
    ):
        if needle not in text:
            fail("wrapper-files")
    return text


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


def main() -> None:
    if REQUESTED_ROOT.name != "grok-mobile-reading-integrated-h5-runtime-pin-360":
        fail("script-root")
    if not regular(FROZEN_RUNNER) or sha256_file(FROZEN_RUNNER) != FROZEN_RUNNER_SHA:
        fail("hash-mismatch")
    if not regular(FROZEN_HOOK) or sha256_file(FROZEN_HOOK) != FROZEN_HOOK_SHA:
        fail("hash-mismatch")
    here = Path(__file__).resolve()
    if here.parent != AUTHORIZED or here.name != "run-reading-owner.py":
        fail("script-root")
    observer = AUTHORIZED / "reading-practice-h5.cjs"
    if not regular(observer) or sha256_file(observer) == G280_OBSERVER_SHA:
        fail("hash-mismatch")
    observer_text = observer.read_text(encoding="utf-8")
    if "settleLiveDetailCta" not in observer_text:
        fail("observer-seam")
    if 'button.reading-cta[data-action="published-practice"]' not in observer_text:
        fail("observer-seam")
    if ".reading-cta[data-action=\"published-practice\"]" not in observer_text:
        fail("observer-seam")
    stem_needle = "\\'\"gradableQuestions\"\\', \\'readingRuleSeal\\', \\'Owner stem\\',"
    stem_kept = "\\'\"gradableQuestions\"\\', \\'readingRuleSeal\\',"
    if observer_text.count(stem_needle) != 1 or observer_text.count(stem_kept) != 2:
        fail("observer-seam")
    if "\\'Owner stem\\', \\'Owned  sentence\\'" not in observer_text:
        fail("observer-seam")
    if FROZEN_RUNNER_SHA not in "" and "reading-pinned-practice-h5-observer-280-frozen/reading-practice-h5.cjs" not in observer_text:
        fail("observer-seam")
    source = FROZEN_RUNNER.read_text(encoding="utf-8")
    source = replace_exact(
        source,
        "/tmp/grok-mobile-reading-practice-owner-grant-314",
        "/tmp/grok-mobile-reading-integrated-h5-runtime-pin-360",
        2,
    )
    source = replace_exact(
        source,
        "mobile-reading-practice-owner-grant-314",
        "mobile-reading-integrated-h5-runtime-pin-360",
        3,
    )
    source = replace_exact(source, "G314 canonical directory", "G360 canonical directory", 1)
    source = replace_exact(source, "MB314_READING_LIVE_HOOK", "MB360_READING_LIVE_HOOK", 1)
    source = replace_exact(source, "MB314_RUN_ID", "MB360_RUN_ID", 1)
    source = replace_exact(source, "MB314_PINNED_PRACTICE_RUNTIME", "MB360_PINNED_PRACTICE_RUNTIME", 1)
    source = replace_exact(
        source,
        'f"mb314-{rt.run_id}@example.invalid"',
        'f"mb360-{rt.run_id}@example.invalid"',
        1,
    )
    source = replace_exact(source, '"Mb314!"', '"Mb360!"', 1)
    source = replace_exact(source, "The frozen G280 observer owns", "The trusted G360 observer owns", 1)
    source = replace_exact(source, OBSERVER_ASSIGNMENT, 'OBSERVER = AUTHORIZED / "reading-practice-h5.cjs"', 1)
    source = replace_exact(
        source,
        f'OBSERVER_SHA = "{G280_OBSERVER_SHA}"',
        f'OBSERVER_SHA = "{sha256_file(observer)}"',
        1,
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


def run_observer(rt: Runtime) -> None:
''',
        1,
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
    rt.summary["observer"] = rt.observer
''',
        1,
    )
    if any(char in G351_H5_DIR_MARK for char in "*?[]{}") or any(char in G351_H5_INDEX_SHA for char in "*?[]{}"):
        fail("h5-dir")
    if len(G351_H5_INDEX_SHA) != 64 or any(char not in "0123456789abcdef" for char in G351_H5_INDEX_SHA):
        fail("h5-dir")
    if G351_H5_DIR_MARK != "reading-practice-integrated-g351-root/h5":
        fail("h5-dir")
    if source.count(G271_H5_INDEX_SHA) != 1 or source.count(G271_H5_DIR_MARK) != 1:
        fail("h5-dir")
    source = replace_exact(source, G271_H5_DIR_MARK, G351_H5_DIR_MARK, 1)
    source = replace_exact(source, G271_H5_INDEX_SHA, G351_H5_INDEX_SHA, 1)
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
    if "MB314" in source or "mb314" in source or "Mb314" in source:
        fail("observer-seam")
    if "attemptWrites" not in source or '"attempts": 0' not in source:
        fail("observer-seam")
    text = hook_text(FROZEN_HOOK.read_text(encoding="utf-8"))
    write_bytes(AUTHORIZED / "reading-live-hook.mjs", text)
    rows = [file_row(observer), file_row(AUTHORIZED / "reading-live-hook.mjs"), file_row(here)]
    report = AUTHORIZED / "REPORT.md"
    if regular(report):
        rows.append(file_row(report))
    manifest = {
        "files": rows,
        "job": "resume-20261105-mobile-reading-integrated-h5-runtime-pin-360",
        "source": "/tmp/grok-mobile-reading-integrated-h5-runtime-pin-360",
    }
    write_bytes(AUTHORIZED / "manifest.json", json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    compiled = compile(source, str(here), "exec")
    exec(compiled, {"__name__": "__main__", "__file__": str(here)})


if __name__ == "__main__":
    main()

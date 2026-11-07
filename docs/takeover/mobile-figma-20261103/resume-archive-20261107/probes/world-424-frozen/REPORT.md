# MB018 world-default H5 observer (G424 repair of G404)

Status: offline checks ran. The root lease, Chrome, and H5 did not run.

G404 stays at `/tmp/grok-mobile-resume-world-404`. Its receipt remains the actual `FAIL` / `rendered-pack` record at `/tmp/grok-mobile-resume-world-404/world-h5-default-receipt.json` and under `world-404-root`. This directory does not rewrite that receipt and does not use it as H5 proof. Re-running the original observer still prints `OBSERVER_FAILED` / `rendered-pack` and exits 1.

G398 left no artifact. This job writes only under `/tmp/grok-mobile-resume-world-repair-424`.

## What changed

The offline sample was the B139 default page for the B146 `DEFAULT_OWNER_EMPTY` wire: `Lv.1`, `0 XP`, streak `0 天` / `状态待确认`, zone `Asia/Shanghai`, `日期未提供`, calendar `每日记录暂未提供。`, map `成长地图暂未提供。`, season `SEASON_2026_Q4` with `0 赛季点 · 状态待确认`, empty quests, and the B12 empty chest `当前没有待开启奖励箱。`. That chest sentence contains the forbidden labels `待开启` and `开启奖励箱`. The old blob check treated those substrings as a claim surface, so `runObserverChecks` threw `rendered-pack` before the browser.

`classifyRendered` still requires every visible label and still rejects forbidden copy. A forbidden label counts only when it remains after the required pack sentences are removed. The empty chest sentence is allowed. A separate closed title or an extra `开启奖励箱` still fails, and the failure token is `forbidden:closed` or `forbidden:claim|claim-buttons`. Populated XP, quest rows, claim writes, and probability closes are still rejected. The selfcheck stays `observed: false` and is not an H5 result.

The tail keeps a safe ASCII reason token before it falls back to `rendered-pack` or `tail`. The lease does the same before `h5` or a generic `rendered-pack`. DOM text and secrets do not fit the token.

Reaping counts `reaped` only after `poll` / `wait` or a verified pid absence. A signal by itself stays `signaled`. A process that was signaled and did not exit is `remaining` and `unverified`. `released` also requires that java, tail, and browser accounting. The old java tuple `signaled` 4, `reaped` 0, `remaining` 0, `unverified` 0 does not count as settled.

Identity inside this directory is `MB018-H5-DEFAULT-424`, container `cloudstudy-mobile-world-h5-default-424`, label `cloudstudy.qa.mobile-world-h5-default-424`. Jar hashes, the B139 index `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`, the B116 rejection, ports, and the G382 frozen pin are unchanged. Python 3.9 still cannot run the lease: `os.path.realpath(..., strict=True)` raises `TypeError`. That call was not loosened.

## Files

| Path | Role |
| --- | --- |
| `/tmp/grok-mobile-resume-world-repair-424/world-default-observer.mjs` | In-memory `observeWorldDefault`. Direct node runs checks only. |
| `/tmp/grok-mobile-resume-world-repair-424/h5-lease-tail.mjs` | Opens G388 on `18183`, calls the observer, closes the listener. |
| `/tmp/grok-mobile-resume-world-repair-424/root-lease.py` | Owned MySQL/IAM/Gateway/gamification lease plus the tail. |
| `/tmp/grok-mobile-resume-world-repair-424/pin.json` | Input pins. |
| `/tmp/grok-mobile-resume-world-repair-424/REPORT.md` | This note. |

A later receipt, written only by a no-argument lease, is `/tmp/grok-mobile-resume-world-repair-424/world-h5-default-receipt.json`. Replay of that inode is refused. It does not exist yet.

## Actual vs `NOT_RUN`

| Check | Result |
| --- | --- |
| `node --check` observer and tail | actual, exit 0 |
| `node .../world-default-observer.mjs` | actual `OBSERVER_PREPARED`, `observed` false, `worldEmptyReady` false, `launched` false, exit 0 |
| Original `node /tmp/grok-mobile-resume-world-404/world-default-observer.mjs` | actual `OBSERVER_FAILED` / `rendered-pack`, exit 1 |
| Python 3.12.15 `ast.parse` of `root-lease.py` | actual |
| In-process reap fakes on `Popen` doubles, no OS signals | actual: verified exit is `reaped` 4 / `signaled` 4; unverified exit is `reaped` 0 / `remaining` 4 / `unverified` 4; historical `signaled` 4 with `reaped` 0 is not settled |
| Python 3.9.6 `realpath(..., strict=True)` | actual `TypeError`; lease not started |
| `python3.12 .../root-lease.py --preflight-only` | `NOT_RUN` |
| Full lease / Chrome / five Gateway GETs | `NOT_RUN` |
| Visible default labels in a browser | `NOT_RUN` |
| 11 gamification tables before/after | `NOT_RUN` |
| Owned cleanup / ports touched | `NOT_RUN` |
| Route or DoD signoff | not claimed |

No listener was opened. Ports `13306`, `18070`, `18087`, `18094`, and `18183` were not bound. Git, product source, credentials, plans, and config were not changed.

## Safe commands

Observer checks, no socket:

```text
node /tmp/grok-mobile-resume-world-repair-424/world-default-observer.mjs
```

Preflight, when a later root lease is allowed. Python 3.12. It prints `PREFLIGHT` with `executed` false and does not write the receipt:

```text
python3.12 /tmp/grok-mobile-resume-world-repair-424/root-lease.py --preflight-only
```

Full serialized run, after that preflight, once:

```text
python3.12 /tmp/grok-mobile-resume-world-repair-424/root-lease.py
```

Exit 0 is `PREFLIGHT` or `PASS`. Exit 2 is a closed reason. Exit 1 is any other failure. Cleanup stops container `cloudstudy-mobile-world-h5-default-424`, the owned Java processes, the tail, and Chrome children of that tail. Scratch stays under this directory.

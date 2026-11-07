# MB-005 forbidden H5 lease (G413)

Lease status: `NOT_RUN`. This session did not start Docker, Java, Chrome, Gateway, IAM, MySQL, or the 18183 listener. No `PASS` is claimed.

Offline checks that did run:

| Check | Result |
| --- | --- |
| Python 3.12.15 `ast` parse and `rebind_source()` only | `SELFCHECK_OK` |
| `node --check` observer and tail | exit 0 |
| `node forbidden-h5-observer.mjs` | `OBSERVER_PREPARED`, `observed` false, `launched` false |
| `node h5-lease-tail.mjs` with empty stdin | `USAGE`, `launched` false |
| `lsof` TCP 18183 listen | no listener |

`rebind_source()` was not followed by `load_supervisor()` or `main()`. Default `python3` on this machine is 3.9.6. The lease rejects that interpreter. Root runs the wrapper with Python 3.12.15.

## Files

| Path | Role |
| --- | --- |
| `forbidden-h5-observer.mjs` | One register, one adult-gate denial, forbidden DOM, one logout. No `route.fulfill(`. |
| `h5-lease-tail.mjs` | Opens frozen G388 on 18183 only after owned-lease stdin. A TTY or empty stdin does not bind. |
| `forbidden-h5-wrapper.py` | In-memory rebind of frozen G393. Adds Gateway. Does not execute the G378 probe. |
| `pin.json` | Input pins. `executed` remains false. |
| `REPORT.md` | This note. |

## Source pins

| Item | Value |
| --- | --- |
| Worktree HEAD | `61b9ede7c65ef065c76c846c27fb69a52cd042cd` |
| Frozen G393 source | `/tmp/grok-mobile-forbidden-iam-canonical-node-entry-393/iam-only-lease.py` |
| Frozen G393 `JOB_ID` | `MB005-G393-canonical-node-entry` |
| Derived job id | `MB005-H5-FORBIDDEN-413` |
| B139 index SHA-256 | `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32` |
| Rejected B116 index | `94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520` |
| B139 root | `reading-practice-integrated-g351-root/h5` |
| IAM jar | `98f6b2d6b8c44de9d94f44bcf498d154f009c52faf4aa3615d2a9e513b390007` |
| Gateway jar | `7f796cfb60f571beb155ce3fad87a3e9e6cb13ddddd3f91e2ca9d9771ca6a0a1` |
| MySQL image | `sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b` |
| Container | `cloudstudy-mobile-forbidden-h5-413` |
| Label | `cloudstudy.qa.scope=cloudstudy.qa.mobile-forbidden-h5-413` |
| Ports | `13306`, `18070`, `18087`, `18183` |

The recorded B145 wire source is the G393 lease above. The visualization copy `forbidden-iam-canonical-node-entry-393-root` points at that lease. Its copy status is `FAIL` / `cleanup-incomplete`; the probe inside that copy is `OBSERVED`. This lease does not rerun that probe. The browser is the one actor. Three publication rows stay synthetic fixtures, not a consent signature.

Rebind replaces five lines, once each: `JOB`, `JOB_ID`, `JOB_MARKER`, `LABEL`, `NAME`. After replacement the frozen job id string is absent. `main`, `classify`, `run`, `run_probe`, `emit_lease`, and `require_script_root` are shadowed so the probe cannot start as a second actor.

Gateway modes for `LEARNER`, `CONTENT`, `LEARNING`, `ASSESSMENT`, `MEDIA`, `GAMIFICATION`, `SOCIAL`, and `COMMERCE` are `LEGACY`. IAM route stays on. No commerce target and no domain service process.

`OBSERVED` requires the real register `201`, adult-gate `REJECTED`, principal `RESTRICTED`, the forbidden title `暂时无法开始学习`, one logout `REVOKED` with `CURRENT_SESSION_AND_TOKEN_FAMILY` and a cleared `yuxuexing_refresh` cookie, then the login title `欢迎回来`. Learning, target, and consent writes must stay 0. `routeFulfillCount` must stay 0.

## Root commands

Pins and process-free preflight, only after `13306`, `18070`, `18087`, and `18183` are free:

```text
/Users/Admin/.local/bin/python3.12 /tmp/grok-mobile-resume-forbidden-h5-413/forbidden-h5-wrapper.py --preflight-only
```

That writes `preflight.json` with `processesStarted` false. It does not write `lease-receipt.json`.

Full serialized run, once, after that preflight:

```text
/Users/Admin/.local/bin/python3.12 /tmp/grok-mobile-resume-forbidden-h5-413/forbidden-h5-wrapper.py
```

Exit 0 is `PREFLIGHT` or `OBSERVED` with cleanup. Exit 2 is a closed pin, argv, replay, or scratch refusal. Exit 1 is any other failure. Top-level `OBSERVED` also requires cleanup. An observer `OBSERVED` with `cleanup-incomplete` stays a failed lease.

Already-run no-listen checks, safe to repeat:

```text
node /tmp/grok-mobile-resume-forbidden-h5-413/forbidden-h5-observer.mjs
node /tmp/grok-mobile-resume-forbidden-h5-413/h5-lease-tail.mjs </dev/null
```

## Cleanup

The wrapper stops the tail process group only when that process is this wrapper's child and its session id equals its pid, then stops Chrome children of that tail and Chrome orphans whose command contains this job's scratch path. It then calls rebound `cleanup()`, which stops owned Java processes and the exact container name and label, and removes `scratch/`.

If that cleanup is incomplete, root may remove only:

```text
docker --context desktop-linux rm -f cloudstudy-mobile-forbidden-h5-413
rm -rf /tmp/grok-mobile-resume-forbidden-h5-413/scratch
```

Confirm the container label before `rm`. Do not delete the scripts, `pin.json`, `REPORT.md`, frozen G378/G384/G393/G388 trees, or unrelated Java. Replay requires deleting `lease-receipt.json` by hand. An unexpected `scratch/` directory is not auto-deleted.

## Remaining prerequisites

1. Serial lease: nothing else holds `13306`, `18070`, `18087`, or `18183`.
2. Docker context `desktop-linux`, image `mysql:8.0` at the digest above, and Java 25.
3. Python 3.12.15 at `/Users/Admin/.local/bin/python3.12`. Node v20.19.5 is present.
4. Chrome and Playwright resolve from one of the three worktree `package.json` files named in the observer.
5. Frozen G378 probe and fixture, G393 supervisor, G388 nonce, IAM jar, Gateway jar, seed Java/SQL, and the B139 `h5` directory remain at the pinned paths.
6. No `lease-receipt.json` and no `scratch/` under this directory. Neither exists now.
7. Worktree `.git` still resolves to HEAD `61b9ede7c65ef065c76c846c27fb69a52cd042cd`. The wrapper checks that before starting.
8. Cookie clear depends on Gateway forwarding IAM `Set-Cookie` for `yuxuexing_refresh`. If it does not, the receipt stays `FAILED` with `cookie-not-cleared`.

# MB018 world-default H5 observer (G437 flag repair of G424)

Status: `PREPARED`. Offline checks ran. Docker, JVM, Chrome, listeners, and the live actor did not run.

G424 stays at `/tmp/grok-mobile-resume-world-repair-424`. Its live receipt `/tmp/grok-mobile-resume-world-repair-424/world-h5-default-receipt.json` is unchanged. Root's independent release note stays at `resume-20261107/world-424-root/INDEPENDENT-RELEASE.json`. This directory does not rewrite either file.

The live G424 result had H5 observed, default wire and DOM holds, five Gateway reads, an eligible principal, 11 tables at 0 before and after, no writes, and `released` true. The top status was still `FAIL`. `public_observer` stored `historicalReceiptUsed` and `routeFulfill` with `value is False`, so a raw `false` became `true`. The proof gate then required `is False` and rejected the run. The observer `blankReceipt` already sets both flags `false`. There is no historical-receipt reuse and no business `route.fulfill`.

## What changed

`native_bool` keeps a native `True` or `False` and returns `None` for a missing value or any non-bool, including `0`, `1`, and text. `public_observer` uses it for those two fields only. `observer_flags_allow_proof` is the same two `is False` gates the proof already had. `False` is the only value that passes. `True` and `None` fail closed. The other oracles, cleanup accounting, B139 pin, read-only gamification reads, fresh actor, pins, and ports are unchanged.

Identity in this directory is `MB018-H5-DEFAULT-437`, container `cloudstudy-mobile-world-h5-default-437`, label `cloudstudy.qa.mobile-world-h5-default-437`.

## Files

| Path | Role |
| --- | --- |
| `/tmp/grok-mobile-resume-world-flags-437/world-default-observer.mjs` | In-memory observer. Direct node runs checks only. |
| `/tmp/grok-mobile-resume-world-flags-437/h5-lease-tail.mjs` | G388 tail on `18183`. |
| `/tmp/grok-mobile-resume-world-flags-437/root-lease.py` | Owned lease plus the two-flag serializer. |
| `/tmp/grok-mobile-resume-world-flags-437/pin.json` | Input pins. |
| `/tmp/grok-mobile-resume-world-flags-437/REPORT.md` | This note. |

A later no-argument lease would write `/tmp/grok-mobile-resume-world-flags-437/world-h5-default-receipt.json`. That file is not created yet.

## Actual vs `NOT_RUN`

| Check | Result |
| --- | --- |
| `node --check` observer and tail | actual, exit 0 |
| `node .../world-default-observer.mjs` | actual `OBSERVER_PREPARED`, job `MB018-H5-DEFAULT-437`, `observed` false, exit 0 |
| Python 3.12.15 `ast.parse` of `root-lease.py` | actual |
| `flag_table_checks` | actual, 12 rows. `false` stays `false` and the proof accepts only that pair. `true` stays `true`. Missing, `0`, `1`, and text become `null`. Each unsafe or missing flag makes the proof `false` |
| Docker, JVM, Chrome, listeners, live actor, preflight, full lease | `NOT_RUN` |
| Route or DoD signoff | not claimed |

## Flag table

| Case | historicalReceiptUsed | routeFulfill | proof |
| --- | --- | --- | --- |
| false | false | false | true |
| true | true | true | false |
| missing | null | null | false |
| zero | null | null | false |
| one | null | null | false |
| text | null | null | false |
| route-true | false | true | false |
| historical-true | true | false | false |
| route-missing | false | null | false |
| historical-missing | null | false | false |
| route-one | false | null | false |
| historical-zero | null | false | false |

## Later root command

```text
python3.12 /tmp/grok-mobile-resume-world-flags-437/root-lease.py
```

Exit 0 is `PREFLIGHT` or `PASS`. Exit 2 is a closed reason. Exit 1 is any other failure. This session did not run it.

# MB018 world-default H5 observer (G443 release certificate of G437)

Status: `PREPARED`. Offline checks ran. Docker, JVM, Chrome, listeners, and the live actor did not run.

G437 stays at `/tmp/grok-mobile-resume-world-flags-437`. Its live receipt `/tmp/grok-mobile-resume-world-flags-437/world-h5-default-receipt.json` is unchanged (`sha256 e66965aed4751ffdcd3e37068bfde598340bd0de044829268c935d16a292e44e`). Root's independent release note stays at `resume-20261107/world-437-root/INDEPENDENT-RELEASE.json`. G382 frozen `root-lease.py` is unchanged (`sha256 3a2e78d7cfdd79f31c47b1be83d0315ce3fa656454258217e8963ec417ef164a`). This directory does not rewrite those files.

Root's G437 run was H5 `OBSERVED`, five Gateway reads, 11 tables 0/0, no writes, `historicalReceiptUsed` and `routeFulfill` raw `false`. Process cleanup settled (`java` 3/3, `tail` 1/0 signaled, `browser` 0, remaining 0, unverified 0) and all ports free. The top status was still `FAIL` / `cleanup` because `released` was `false`. Root later proved the exact owned name and label absent.

## Why rebound frozen `release_truth` stays false

The wrapper still derives G347 `release_truth`. That function returns true only when:

1. identity is not ambiguous and the exact name is not a mismatch
2. the exact name filter and the exact label filter both succeed and are empty
3. the stored id is non-empty
4. `exact_id_state(stored_id) == "absent"`

`exact_id_state` maps inspect errors to `absent` only when the text contains `no such object` or `no such container`. A successful inspect of a removed id that returns `[]` is `unknown`. A missing stored id after launch is also false. `release_owned_container` treats `docker_inspect is None` as auto-removed success; that `None` is also used for timeouts, connect errors, and empty output. Frozen `release_truth` then fails closed for missing id, empty-list inspect, and unrecognized inspect text, the same way it fails for a still-running container. The wrapper copied that single boolean into `cleanup.released`.

Independent current own-container facts close the certificate only when Docker name and label queries succeed, the exact owned name **and** label are absent, the stored id is `absent` or inspect is `absent-inspect`, identity is not ambiguous, PID reaping is settled (`signaled <= reaped`, remaining 0, unverified 0), and the five ports are free. Query failure is not treated as absence. Other project resources are not removed. Frozen `reportedRelease` stays a separate field.

## What changed

Identity in this directory is `MB018-H5-DEFAULT-443`, container `cloudstudy-mobile-world-h5-default-443`, label `cloudstudy.qa.mobile-world-h5-default-443`. Fresh actor prefix is `mb443-`. `native_bool`, the two-flag proof, B139 index pin `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`, read-only gamification facts, five GET paths, and poll/wait reaping are unchanged.

## Files

| Path | Role |
| --- | --- |
| `/tmp/grok-mobile-resume-world-release-443/world-default-observer.mjs` | In-memory observer. Direct node runs checks only. |
| `/tmp/grok-mobile-resume-world-release-443/h5-lease-tail.mjs` | G388 tail on `18183`. |
| `/tmp/grok-mobile-resume-world-release-443/root-lease.py` | Owned lease plus independent release certificate. |
| `/tmp/grok-mobile-resume-world-release-443/pin.json` | Input pins plus the original G437 result pointer. |
| `/tmp/grok-mobile-resume-world-release-443/REPORT.md` | This note. |

A later no-argument lease would write `/tmp/grok-mobile-resume-world-release-443/world-h5-default-receipt.json`. That file is not created yet.

## Actual vs `NOT_RUN`

| Check | Result |
| --- | --- |
| `node --check` observer and tail | actual, exit 0 |
| `node .../world-default-observer.mjs` | actual `OBSERVER_PREPARED`, job `MB018-H5-DEFAULT-443`, `observed` false, exit 0 |
| Python 3.12.15 `ast.parse` of `root-lease.py` | actual |
| `flag_table_checks` | actual, 12 rows, same as G437 |
| `cleanup_table_checks` | actual, 16 rows. Removed container with stored id `absent` or inspect `absent-inspect` may close. Frozen `[]` inspect stays reported false and certificate true. Running, name/label mismatch, Docker error, invalid/ambiguous id, unknown inspect, unknown PID, unsettled java, and busy ports stay closed |
| Docker, JVM, Chrome, listeners, live actor, preflight, full lease | `NOT_RUN` |
| Route or DoD signoff | not claimed |

## Cleanup table

| Case | queries | name/label absent | stored | inspect | reported | certificate |
| --- | --- | --- | --- | --- | --- | --- |
| removed-absent-id | yes | yes/yes | absent | null | false | true |
| removed-absent-inspect | yes | yes/yes | held | absent-inspect | true | true |
| removed-empty-list | yes | yes/yes | held | absent-inspect | false | true |
| running | yes | no/no | held | present | false | false |
| name-mismatch | yes | no/yes | held | present | false | false |
| label-mismatch | yes | yes/no | held | present | false | false |
| docker-error-name | no | no | absent | null | false | false |
| docker-error-both | no | no | held | absent-inspect | false | false |
| invalid-id | yes | yes/yes | unknown | unknown | false | false |
| ambiguous-id | yes | no/no | held | present | false | false |
| ambiguous-flag | yes | yes/yes | held | absent-inspect | false | false |
| unknown-inspect | yes | yes/yes | held | unknown | false | false |
| unknown-pid | yes | yes/yes | held | absent-inspect | true | false |
| unsettled-java | yes | yes/yes | held | absent-inspect | true | false |
| ports-busy | yes | yes/yes | held | absent-inspect | true | false |
| no-launch-absent | yes | yes/yes | absent | null | true | true |

## Exact pins

| Pin | Value |
| --- | --- |
| B139 index | `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32` |
| B116 rejected | `94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520` |
| G382 frozen | `3a2e78d7cfdd79f31c47b1be83d0315ce3fa656454258217e8963ec417ef164a` |
| G437 receipt | `e66965aed4751ffdcd3e37068bfde598340bd0de044829268c935d16a292e44e` |
| IAM / Gateway / gamification jars | `98f6b2d6…390007` / `7f796cfb…a6a0a1` / `42c97423…61aaca` |
| ports | `13306` `18070` `18087` `18094` `18183` |
| 443 root-lease.py | `fab5e13e9c36981efdce02970fd315b6573f86d589d1786db71c8f98d213eb5f` |

Python 3.9.6 still cannot run the lease: `os.path.realpath(..., strict=True)` raises `TypeError`.

## Later root command

```text
python3.12 /tmp/grok-mobile-resume-world-release-443/root-lease.py --preflight-only
python3.12 /tmp/grok-mobile-resume-world-release-443/root-lease.py
```

Exit 0 is `PREFLIGHT` or `PASS`. Exit 2 is a closed reason. Exit 1 is any other failure. This session did not run them. Root owns the serialized runtime. Cleanup stops only container `cloudstudy-mobile-world-h5-default-443`, the owned Java processes, the tail, and Chrome children of that tail.

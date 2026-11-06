# B139 course-shelf H5 lease

Status: COMPOSED. This session wrote the isolated derivative and stopped before execution. `composition-receipt.json` records that state. No shelf observation was produced.

## Files

| File | Role |
| --- | --- |
| `learn-catalog-runtime.sh` | G361 runner copied into this directory |
| `lease-tail.mjs` | `run_probe` tail |
| `pinned-static-nonce.mjs` | G388 nonce listener, B139 index pin, header `x-mb004-static-qa` |
| `shelf-empty-observer.mjs` | G369 observer |
| `composition-receipt.json` | Explicit composition receipt |
| `REPORT.md` | This note |

`JOB` in the observer is `/tmp/grok-mobile-learn-shelf-rebind-runner-392`. `WIRE_DIR` remains `/tmp/grok-mobile-learn-catalog-preference-jar-rebind-361`. A later `shelf-receipt.json` is written only under this directory, mode `0600`.

## Rebind

| Item | Value |
| --- | --- |
| Root | `/tmp/grok-mobile-learn-shelf-rebind-runner-392` |
| Label | `cloudstudy.qa.mobile-learn-shelf-rebind-runner-392-20261106` |
| Container | `cloudstudy-mobile-learn-shelf-rebind-runner-392-20261106` |
| Receipt kind | `MB009_LEARN_SHELF_H5_LEASE_392` |
| Leased ports | `13306`, `18070`, `18087`, `18088`, `18089`, `18183` |
| Left down | `18090` Learning, `18091` Assessment |

Jar, hook, probe, seed, and MySQL image pins are the G361 literals. The H5 pin is the B139 index `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32` at `reading-practice-integrated-g351-root/h5`. The B116 digest stays fail-closed inside the nonce helper. This session did not recompute those digests.

`LC_OWNER_PUBLISH` still refuses publication. The runner inserts no catalog rows. Gateway keeps Learning and Assessment in `LEGACY` with those base URLs unset. The observer may continue `GET /api/v1/learning/today` and `GET /api/v1/learning/review-queue`; those stay real gateway responses and are not required for an empty shelf.

## Tail

`run_probe` still runs the rebound catalog probe and accepts only `OBSERVED` / `empty` / stage `pair` / `itemCount` 0. The probe copy is created at preflight from the frozen G329 file, with `OUT_DIR` set to this directory.

After that empty result, `run_h5_lease` runs `lease-tail.mjs` in one Node process:

1. The frozen G303 hook remains the only register, adult-gate, consent, and target write. Its success line has no subject.
2. The tail logs that same synthetic owner in once, over IAM TLS with the run CA, then reads `GET /api/v1/iam/principal/me` with the bearer.
3. The subject is taken from that body and kept only when it matches the access-token subject and the approved learner shape. Identifier, password, subject, nonce, and bearer stay off stdout and argv.
4. `openPinnedNonceStatic` listens on `127.0.0.1:18183` for the pinned H5 tree.
5. `observeShelfEmpty` receives `{ ownedLease, caPem, staticNonce, approved }` in memory. The page route stays `route.continue` with `x-mb004-static-qa`.
6. The listener is closed before the process exits. `release_all` then requires `18183` to be free along with the other leased ports.

A passing runtime receipt in this directory requires probe `empty`, shelf `OBSERVED`, `h5Started` true, and a clean release. That receipt is separate from the G361 gate pair.

## Gate already on disk

The observer still reads the G361 pair. A read of those files shows `MB009_LEARN_CATALOG_RUNTIME_361`, status `PASS`, `learnerVisiblePublished` 0, probe `empty`, stage `pair`, page `catalog-empty`, home `contentStatus` `EMPTY`, `unrelatedWrites` 0, `planReads` 0, and `contentLocale` `en-US`. This session did not rewrite them.

## Scope kept

Applicable `AGENTS.md` was in force. Writes stayed under `/tmp/grok-mobile-learn-shelf-rebind-runner-392`. The G361, G369, and G388 directories were not written. The product repository, credentials, plans, config, ports, and Git state were left as they were. MySQL, IAM, Gateway, Learner, Content, Learning, Assessment, Chrome, and port `18183` were not started.

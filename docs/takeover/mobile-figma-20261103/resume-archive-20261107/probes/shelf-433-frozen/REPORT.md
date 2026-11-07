# G433 course-shelf H5 lease, live home contentStatus contract

Status: **COMPOSED**. Identity is rebound to `/tmp/grok-mobile-resume-shelf-contract-433`. G419 originals under `/tmp/grok-mobile-resume-shelf-network-419` were not edited, including `shelf-receipt.json`, `actual-receipt.json`, and `runtime-receipt.json`. This session did not start Docker, JVM, Chrome, or listeners.

Root executed G419 once after offline and runtime preflight PASS. Optional bridge `10.254.254.0/28` created (`networkCreateCategory` `supplied-ok`). Owned ports, container, and network released. Live G329 probe passed `empty` with `PLACEMENT_REQUIRED`. Live B139 H5 logged in 200, `principalOk` true, `catalogContract` true, locale/pair passed, DOM `catalog-empty`. Observer FAIL `contract-unresolved` / `homeReason` `content-status`.

## Diagnosis

Observer mistake, not a backend or H5 bug.

G329 `pageOf` derives `contentStatus` from catalog accessible count, then writes that derived value onto receipt `home.contentStatus`. G419 `actual-receipt.json` therefore shows `EMPTY` even when learner-service never sent that field.

Pinned `learner-preference-owner-combined.jar` `LearnerHttpController$HomeData` fields are `firstDay`, `tasks`, `projectionVersion`, `contentEpoch`, `generatedAt`. OpenAPI `B9HomeProjection` is `additionalProperties: false` and has no `contentStatus`. Mobile `parseHome` also derives `READY`/`EMPTY`/`UNAVAILABLE` from catalog length, using home `contentStatus` only to pass through `UNAVAILABLE`. Learn shelf `catalog-empty` is classified from accessible count, not from a home `EMPTY` wire field.

`B9FirstDayProjection` state `READY` requires `taskCount >= 1` and at least one task. Home `READY` alongside an empty task list is not a permitted schema variant. Client-derived `READY` means catalog cards exist, which contradicts an empty catalog. Those READY cases stay negative.

Live home `contentStatus` for this placement-required empty shelf:

| Variant | Result | Evidence |
| --- | --- | --- |
| field absent | permitted | HomeData record + B9HomeProjection |
| `EMPTY` | permitted | optional extra; matches catalog-empty client derivation and G329 page class |
| `UNAVAILABLE` | rejected `unavailable` | client unavailable shelf |
| `READY` | rejected `content-status` | not a home-wire field; READY+empty catalog contradicts B9 taskCount and catalog empty |
| other / null | rejected `content-status` | unknown enum |
| `firstDay.state=READY` with 0 tasks | rejected `state` | B9 READY requires tasks |

B140/G329 composition pins still carry derived `EMPTY`. The wrapper still treats that derived probe receipt as the G329 page class. The live observer no longer requires `EMPTY` on the learner home body.

## Files

| File | Role |
| --- | --- |
| `learn-catalog-runtime.sh` | Bounded lease, optional `--bridge-subnet`, exact owned release |
| `owned-bridge-subnet.py` | Unchanged 29-check helper from G419 |
| `lease-tail.mjs` | IAM TLS login, principal subject, G388 listener, observer |
| `pinned-static-nonce.mjs` | B139 index pin, header `x-mb004-static-qa` |
| `shelf-empty-observer.mjs` | Live home permits absent/EMPTY; DOM empty vs no-hit; restricted ACL |
| `frozen/*` | Byte copies of G329 probe and G303 hook |
| `b140-wire/*` | Preserved B140/G361 evidence copies |
| `PINS.json` | Copied vs pinned dependency table |
| `composition-receipt.json` | Explicit composition receipt |
| `REPORT.md` | This note |

## Exact changes from G419

- Job root is `/tmp/grok-mobile-resume-shelf-contract-433`. Label, container, and network are `...-shelf-433-20261107`. Schema/user prefixes are `lc433` / `lc433u`. Synthetic identifier prefix is `mb433-`. User-Agent is `mb009-learn-shelf-lease-433/1`. Login idempotency is `mb433-login-`. Receipt kind is `MB009_LEARN_SHELF_H5_LEASE_433`.
- Frozen jar/H5 hashes unchanged: IAM `98f6b2d6…`, Gateway `7f796cfb…`, Learner `0a9c4159…`, Content `852578df…`, B139 index `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`.
- Network helper remains 29 self-checks, optional `10.254.254.0/28`, fail-closed overlap/invalid CIDR, default IPAM when unset. No daemon edit, no existing-network delete, no published-port broaden.
- Observer ACL unchanged: no `route.fulfill`, no fake catalog/home bodies, no auth injection, mutations aborted, search catalog query aborted.
- Live shelf receipt may include redacted `homeContentStatus` (`absent`/`EMPTY`/`READY`/`UNAVAILABLE`/`other`) without secrets.

## Input pins

Copied or hashed values are in `PINS.json`. Playwright stays on the archived worktree `package.json`. Learning `18090` and Assessment/Qida `18091` stay down.

## Actual checks vs NOT_RUN

| Check | Result |
| --- | --- |
| Read G419 `shelf-receipt.json`, `actual-receipt.json`, frozen observer, HomeData, B9HomeProjection | Done |
| Diagnosis: observer mistake; G329 derived EMPTY; live home has no contentStatus | Done |
| Rebind identity 433 in this directory only | Done |
| Permitted absent/EMPTY; negatives READY/UNAVAILABLE/other/firstDay READY | Done |
| Offline self-checks | `owned-bridge-subnet.py --self-check` 29/29; `bash -n`; `node --check`; observer/helper/nonce/tail usage lines |
| `python3 -m py_compile` | NOT_RUN here (`PermissionError` writing pycache); `ast.parse` succeeded |
| Docker/JVM/Chrome/listener | NOT_RUN |
| Product/Git writes | NOT_RUN |

This is not route or DoD signoff.

## Remaining prerequisites

1. Root exclusive serial lease of `13306 18070 18087 18088 18089 18183`.
2. Java 25, Docker context `desktop-linux` on `unix:///Users/Admin/.docker/run/docker.sock`, MySQL image `sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b`.
3. Pinned jars, frozen H5 tree, Playwright in the archived worktree, Chrome for `chromium.launch({ channel: 'chrome' })`.
4. `LC_OWNER_PUBLISH` unset.
5. Operator subnet `10.254.254.0/28` (or another free private CIDR) at execution; Root revalidates IPAM then.

## Exact safe validation command

From any working directory, no Docker mutation:

```bash
python3 /tmp/grok-mobile-resume-shelf-contract-433/owned-bridge-subnet.py --self-check
bash -n /tmp/grok-mobile-resume-shelf-contract-433/learn-catalog-runtime.sh
node --check /tmp/grok-mobile-resume-shelf-contract-433/lease-tail.mjs
node --check /tmp/grok-mobile-resume-shelf-contract-433/pinned-static-nonce.mjs
node --check /tmp/grok-mobile-resume-shelf-contract-433/shelf-empty-observer.mjs
node --check /tmp/grok-mobile-resume-shelf-contract-433/frozen/learn-catalog-owner.mjs
node --check /tmp/grok-mobile-resume-shelf-contract-433/frozen/reading-live-hook.mjs
python3 -m py_compile /tmp/grok-mobile-resume-shelf-contract-433/owned-bridge-subnet.py
node /tmp/grok-mobile-resume-shelf-contract-433/shelf-empty-observer.mjs
node /tmp/grok-mobile-resume-shelf-contract-433/pinned-static-nonce.mjs
node /tmp/grok-mobile-resume-shelf-contract-433/lease-tail.mjs
python3 /tmp/grok-mobile-resume-shelf-contract-433/owned-bridge-subnet.py
```

Those commands must not start MySQL, Java, Node listeners, Chrome, or `docker network create`. Observer direct-run must print `call-observeShelfEmpty` after self-check. Helper `--self-check` must report 29 checks.

After Root grants the serial runtime:

```bash
bash /tmp/grok-mobile-resume-shelf-contract-433/learn-catalog-runtime.sh --preflight-only
```

Full run with the inspected free CIDR:

```bash
bash /tmp/grok-mobile-resume-shelf-contract-433/learn-catalog-runtime.sh --bridge-subnet 10.254.254.0/28
```

Exit 0 requires live probe `empty` with `PLACEMENT_REQUIRED`, observer `OBSERVED` / `empty`, `h5Started` true, and owned processes, container, and network released. Identifier, password, subject, nonce, and bearer stay out of stdout, argv, and receipts.

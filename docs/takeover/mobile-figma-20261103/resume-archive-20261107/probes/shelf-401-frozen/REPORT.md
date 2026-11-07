# G401 course-shelf actual H5 lease

Status: **COMPOSED**. This session copied the G392/G329/G303/G388/G369 sources into this directory, rebound them, and stopped before execution. `composition-receipt.json` records that state. No MySQL, IAM, Gateway, Learner, Content, Chrome, or port `18183` listener was started.

Scope is MB009 `/pages/learn/learn`. The proof, when Root grants the serial runtime, is a real placement-required empty shelf: live Learner home `NOT_READY` / `PLACEMENT_REQUIRED` / `EMPTY`, live Content catalog `itemCount` 0, and the H5 `#learn-shell` `data-shelf-state=catalog-empty` copy. No catalog rows are inserted. No response is fulfilled.

## Files

| File | Role |
| --- | --- |
| `learn-catalog-runtime.sh` | Bounded lease: preflight or one full run, then exact owned release |
| `lease-tail.mjs` | After empty probe: IAM TLS login, principal subject read, G388 listener, observer |
| `pinned-static-nonce.mjs` | G388 helper, B139 index pin, header `x-mb004-static-qa` |
| `shelf-empty-observer.mjs` | G369 observer rebound here; live placement-required empty contract |
| `frozen/learn-catalog-owner.mjs` | Byte copy of frozen G329 probe |
| `frozen/reading-live-hook.mjs` | Byte copy of frozen G303 hook |
| `b140-wire/runtime-receipt.json` | Preserved B140/G361 runtime receipt |
| `b140-wire/actual-receipt.json` | Preserved B140/G361 empty pair |
| `b140-wire/ROOT-B140-LEARN-CATALOG-OWNER-WIRE-20261106.json` | Published B140 evidence copy |
| `PINS.json` | Copied vs pinned dependency table |
| `composition-receipt.json` | Explicit composition receipt |
| `REPORT.md` | This note |

Preflight may write `learn-catalog-owner.mjs` (G329 with `OUT_DIR` rebound to this directory) and may refresh the frozen/B140 copies from the pinned sources if the authoring bytes differ. A later live `actual-receipt.json` and `runtime-receipt.json` stay in this directory. `b140-wire/` is not overwritten by the live probe.

## Exact changes from G392

- Job root, label, container, and network are `...-shelf-401-20261107`. Schema/user prefixes are `lc401` / `lc401u`. Synthetic identifier prefix is `mb401-`. Passwords are still `openssl rand` at runtime.
- Frozen G329 probe and G303 hook are copied under `frozen/`. Preflight hashes the original frozen files, syncs those bytes here, then creates the rebound probe with one `OUT_DIR` replacement. The live G329 `/tmp/grok-mobile-learn-catalog-real-owner-probe-329` directory is no longer required.
- G388 helper and G369 observer live in this directory. Observer `JOB` is this directory. `WIRE_DIR` is `b140-wire/`.
- B140 evidence is preserved as copies and as hash pins `e6dc4df5edf8745ed7190215e294f5bd4636ef9d8c8f6b695a4f32dea0472585` / `499d6920f8fed1245add57e7c74ad52818b480536c1604794e05efdf87df5aab`. If the G361 originals remain, preflight hashes them and syncs those bytes into `b140-wire/`.
- Live home contract requires `contentStatus=EMPTY`, `firstDay.state=NOT_READY`, `firstDay.blocker=PLACEMENT_REQUIRED`, and zero tasks. The live probe receipt must carry the same blocker before H5 starts.
- `release_all` signals exact recorded PIDs whose parent is this script and whose command contains the recorded token. It does not send `kill -- -pid`. It stops the labeled container, then removes the labeled network `cloudstudy-mobile-resume-shelf-401-20261107-net`.
- Preflight runs `bash -n`, `node --check` on the Node files, and the three direct-run usage lines (helper, tail, observer). Those paths do not listen and do not start services.
- Ports remain `13306 18070 18087 18088 18089 18183`. Learning `18090` and Assessment `18091` stay down. Gateway keeps those routes in `LEGACY` with base URLs unset.

## Input pins

Copied or hashed values are in `PINS.json`. The B139 H5 index pin is `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`. The B116 digest stays fail-closed. Current `dev@61b9ede7` has no IAM/Gateway `target` jars; the lease pins the archived worktree jars that still match the G361 hashes. Playwright is loaded from that same archived worktree `package.json`. Learner and Content jars stay the frozen B128/B118 packages.

## Actual checks vs NOT_RUN

| Check | Result |
| --- | --- |
| Read AGENTS.md, CURRENT-HANDOFF, STATUS, CURRENT-PROGRESS | Done |
| Inspect G392 snapshot, G388 helper, G329 probe, G303 hook, G361/B140 receipts | Done |
| Copy/rebind into `/tmp/grok-mobile-resume-shelf-401` | Done |
| `bash -n` / `node --check` / observer selfCheck | NOT_RUN (authoring has no shell) |
| Hash of frozen copies, jars, H5 index, B140 receipts | NOT_RUN (preflight) |
| Docker context, MySQL image, name/network/port free | NOT_RUN (preflight) |
| Real IAM/Gateway/Learner/Content empty pair | NOT_RUN |
| Real H5 shelf observer | NOT_RUN |
| Owned PID/container/network release | NOT_RUN |

This is not route or DoD signoff.

## Remaining prerequisites

1. Root exclusive serial lease of `13306 18070 18087 18088 18089 18183`.
2. Java 25, Docker context `desktop-linux` on `unix:///Users/Admin/.docker/run/docker.sock`, MySQL image `sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b`.
3. Pinned jars, frozen H5 tree, Playwright in the archived worktree, and Chrome available for `chromium.launch({ channel: 'chrome' })`.
4. `LC_OWNER_PUBLISH` unset. Any other argv than `--preflight-only` is rejected.

If `--preflight-only` exits 2 with `hash-mismatch` on a frozen copy, replace that file from the source path in `PINS.json` and rerun preflight. If it exits 2 with `syntax` on the observer usage line, the B140 copies did not satisfy `readWireGate`.

## Exact safe validation command

From any working directory, as the user that owns the local Docker context:

```bash
bash /tmp/grok-mobile-resume-shelf-401/learn-catalog-runtime.sh --preflight-only
```

That command must not start MySQL, Java, Node listeners, or Chrome. Success writes `runtime-receipt.json` in this directory with `status` `PREFLIGHT`, `preflightOnly` true, and `h5Started` false, then exits 0.

After Root grants the serial runtime, the one full command is:

```bash
bash /tmp/grok-mobile-resume-shelf-401/learn-catalog-runtime.sh
```

Exit 0 requires live probe `empty` with `PLACEMENT_REQUIRED`, observer `OBSERVED` / `empty`, `h5Started` true, and owned processes, container, and network released. Identifier, password, subject, nonce, and bearer stay out of stdout, argv, and receipts.

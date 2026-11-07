# G419 course-shelf H5 lease, optional owned-bridge subnet

Status: **COMPOSED**. Identity is rebound to `/tmp/grok-mobile-resume-shelf-network-419`. G401 originals under `/tmp/grok-mobile-resume-shelf-401` were not edited. This session did not start MySQL, create or delete Docker networks, publish ports, or run the lease.

Root already ran G401 `--preflight-only` PASS, then one full run FAIL at `mysql-network` before MySQL start. Daemon text in `shelf-401-root/network-diagnostic.json` is `all predefined address pools have been fully subnetted`. Owned ports, container, and network were released. Root inspected 38 current networks and reports `10.254.254.0/28` free; Root revalidates that range at execution.

## Files

| File | Role |
| --- | --- |
| `learn-catalog-runtime.sh` | Bounded lease, optional `--bridge-subnet` / `LC_OWNER_BRIDGE_SUBNET`, exact owned release |
| `owned-bridge-subnet.py` | Canonical RFC1918 CIDR parse, IPAM overlap check, stderr category, `--self-check` |
| `lease-tail.mjs` | After empty probe: IAM TLS login, principal subject read, G388 listener, observer |
| `pinned-static-nonce.mjs` | G388 helper, B139 index pin, header `x-mb004-static-qa` |
| `shelf-empty-observer.mjs` | Live placement-required empty contract |
| `frozen/learn-catalog-owner.mjs` | Byte copy of frozen G329 probe |
| `frozen/reading-live-hook.mjs` | Byte copy of frozen G303 hook |
| `b140-wire/*` | Preserved B140/G361 evidence copies |
| `PINS.json` | Copied vs pinned dependency table |
| `composition-receipt.json` | Explicit composition receipt |
| `REPORT.md` | This note |

A later live `actual-receipt.json`, `runtime-receipt.json`, and `network-create-diagnostic.json` stay in this directory.

## Exact changes from G401

- Job root is `/tmp/grok-mobile-resume-shelf-network-419`. Label, container, and network are `...-shelf-419-20261107`. Schema/user prefixes are `lc419` / `lc419u`. Synthetic identifier prefix is `mb419-`. User-Agent is `mb009-learn-shelf-lease-419/1`. Login idempotency is `mb419-login-`. Receipt kind is `MB009_LEARN_SHELF_H5_LEASE_419`.
- Frozen jar and H5 hashes are unchanged: IAM `98f6b2d6…`, Gateway `7f796cfb…`, Learner `0a9c4159…`, Content `852578df…`, B139 index `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`, G329 probe `8267b3cd…` 27647 bytes, G303 hook `d5d1cfb8…` 13799 bytes.
- Operator may supply one private IPv4 CIDR for this owned temporary bridge with `--bridge-subnet CIDR` or `LC_OWNER_BRIDGE_SUBNET`. Flag and env must match when both are set.
- A supplied CIDR must be canonical RFC1918, prefix 24–29, network-aligned. The helper compares it to existing Docker IPAM IPv4 ranges and fails closed on overlap, invalid CIDR, or inspect failure. Adjacent ranges such as `10.254.254.0/28` and `10.254.254.16/28` are allowed.
- Unset keeps G401 default `docker network create --driver bridge --label … NAME` with daemon IPAM. This session does not change daemon `default-address-pools`, does not delete existing networks, and does not broaden published ports.
- After a failed owned `network create`, the wrapper classifies redacted stderr into `address-pools-exhausted` / `overlap` / `invalid-cidr` / `create-failed`, writes `network-create-diagnostic.json`, and removes only the labeled owned network if it exists. `release_all` still signals exact recorded PIDs, stops the labeled container, then removes that labeled network.
- Ports remain `13306 18070 18087 18088 18089 18183`. Learning `18090` and Assessment `18091` stay down. Gateway keeps those routes in `LEGACY`.

## Input pins

Copied or hashed values are in `PINS.json`. The B139 H5 index pin is `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`. The B116 digest stays fail-closed. Current `dev@61b9ede7` has no IAM/Gateway `target` jars; the lease pins the archived worktree jars that still match the G361 hashes. Playwright is loaded from that same archived worktree `package.json`.

## Actual checks vs NOT_RUN

| Check | Result |
| --- | --- |
| Read G401 root `network-diagnostic.json`, 401 originals, 419 preseed | Done |
| Rebind identity 419 in this directory only | Done |
| Optional CIDR helper + wrapper path | Done |
| `python3 owned-bridge-subnet.py --self-check` | See validation below |
| `bash -n` / `node --check` / usage lines | See validation below |
| Docker network create/rm, daemon edit, existing-network delete | NOT_RUN (forbidden here) |
| Full `--preflight-only` (jar hash, docker context, ports) | NOT_RUN |
| Real IAM/Gateway/Learner/Content empty pair | NOT_RUN |
| Real H5 shelf observer | NOT_RUN |

This is not route or DoD signoff.

## Remaining prerequisites

1. Root exclusive serial lease of `13306 18070 18087 18088 18089 18183`.
2. Java 25, Docker context `desktop-linux` on `unix:///Users/Admin/.docker/run/docker.sock`, MySQL image `sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b`.
3. Pinned jars, frozen H5 tree, Playwright in the archived worktree, and Chrome available for `chromium.launch({ channel: 'chrome' })`.
4. `LC_OWNER_PUBLISH` unset.
5. For the exhausted default pools, Root supplies `10.254.254.0/28` (or another free private CIDR) at execution and revalidates IPAM then. Unset still uses default IPAM.

## Exact safe validation command

From any working directory, no Docker mutation:

```bash
python3 /tmp/grok-mobile-resume-shelf-network-419/owned-bridge-subnet.py --self-check
bash -n /tmp/grok-mobile-resume-shelf-network-419/learn-catalog-runtime.sh
node --check /tmp/grok-mobile-resume-shelf-network-419/lease-tail.mjs
node --check /tmp/grok-mobile-resume-shelf-network-419/pinned-static-nonce.mjs
node --check /tmp/grok-mobile-resume-shelf-network-419/shelf-empty-observer.mjs
node --check /tmp/grok-mobile-resume-shelf-network-419/frozen/learn-catalog-owner.mjs
node --check /tmp/grok-mobile-resume-shelf-network-419/frozen/reading-live-hook.mjs
python3 -m py_compile /tmp/grok-mobile-resume-shelf-network-419/owned-bridge-subnet.py
```

Those commands must not start MySQL, Java, Node listeners, Chrome, or `docker network create`.

After Root grants the serial runtime, default IPAM (will fail again if pools stay exhausted):

```bash
bash /tmp/grok-mobile-resume-shelf-network-419/learn-catalog-runtime.sh --preflight-only
```

Full run with the inspected free CIDR:

```bash
bash /tmp/grok-mobile-resume-shelf-network-419/learn-catalog-runtime.sh --bridge-subnet 10.254.254.0/28
```

Equivalent env form: `LC_OWNER_BRIDGE_SUBNET=10.254.254.0/28` with no flag, or the same value on both. Exit 0 requires live probe `empty` with `PLACEMENT_REQUIRED`, observer `OBSERVED` / `empty`, `h5Started` true, and owned processes, container, and network released. Identifier, password, subject, nonce, and bearer stay out of stdout, argv, and receipts. `network-create-diagnostic.json` records the redacted category only.

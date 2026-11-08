# ADR proposal: application-maintained Vite 8.2.4 peer for `@dcloudio/vite-plugin-uni`

**Status:** PROPOSAL. Root reviews before integration.  
**ID (working):** ADR-vite-8.2.4-uni-plugin-peer-G447  
**Date:** 2026-11-08  
**Checkout:** detached `ed6a1e57347448a25d7f92d02cb6ea8fad03e1db`  
**Baseline to keep recoverable:** B153 `30985b80` + freeze `supervision resume-20261108/dependency-440-reviewed`

This file is a draft only. It is not an accepted ADR and is not written under `docs/10-decisions/`.

## Context

B153 / G440 left one fail-closed high: `vite@8.2.2` on mobile, `GHSA-587h-7wmj-h5pm` / npm `1242661`, patched `>=8.2.4`. `@dcloudio/vite-plugin-uni@3.0.0-alpha-1000920260909822` still publishes exact peer `vite: 8.2.2`. G440 found no matched `@dcloudio` 10.x/`10009` release that peers `>=8.2.4` while keeping the same App-Plus/UTS family.

This experiment applies the security patch by an **application-maintained parent peer override**. It is **not** a claim that DCloud or Vite upstream supports this pair.

## Proposed decision

1. Pin `apps/mobile` direct `vite` to `8.2.4`.
2. Add one parent selector in `pnpm-workspace.yaml`:

   `'@dcloudio/vite-plugin-uni>vite': 8.2.4`

3. Keep the matched `@dcloudio` 10.x family `3.0.0-alpha-1000920260909822`, App-Plus/UTS, Vue 3.5.45, Nuxt 3.21.11, Pinia 2.3.1, Element Plus 2.14.4, Vite 6.4.5 (admin/learner), and `'@nuxt/vite-builder>vite': 7.3.7`.
4. Do not patch vendor code, ignore peer rules, rewrite multi-major `vite` peers, or relax the high/critical gate.

Official pnpm 10 docs (`https://pnpm.io/settings/dependency-resolution#overrides`): a parent selector `qar@1>zoo` rewrites that parent’s edge only; default coverage includes peerDependencies.

## Audited Vite 8.2.2 → 8.2.4 changes

Evidence: npm 200 for `https://registry.npmjs.org/vite/8.2.4`, GitHub release `v8.2.4` (2026-10-06), compare `v8.2.2...v8.2.4` ahead 6. npm `8.2.3` is 404; 8.2.3 exists as a git tag folded into 8.2.4.

Changelog folded into 8.2.4:

- `launch-editor` 2.14.2
- `transformIndexHtml` filename must not include queries
- `fs.serve` check for `?vite-wasm-instance`
- store ids in `safeModulePaths` rather than URLs

These are the remaining GHSA/npm findings for Vite `>=8.2.0 <=8.2.3`. Integrity of 8.2.4: `sha512-lfauXnrf2x0p+UoA+wXh0dgFWnUjCyG6Js95KBkgaCwUU9k0DAHI4W6Q0WCx+h+5g+Alce1y4Zi2QjjK0UvGBw==`.

## Uni plugin compatibility evidence (this experiment)

Inspected `@dcloudio/vite-plugin-uni` runtime (`dist/cli/*.js`, `bin/uni.js`):

- Loads Vite dynamically (`require('vite')` / `import('vite')`).
- Prints `vite v${require('vite/package.json').version}` from whatever is resolved.
- `UNI_COMPILER_VERSION` is plugin `uni-app.compilerVersion` `4.81`, not Vite.
- No `semver` assert and no throw on a different 8.2.x.
- Nested `@vitejs/plugin-vue@6.0.7` peer `^5 || ^6 || ^7 || ^8` still covers 8.2.4.

After the parent selector:

- Installed mobile Vite is `8.2.4`.
- Lock snapshot peer of `@dcloudio/vite-plugin-uni` is rewritten to `vite: 8.2.4`.
- **Published** plugin `package.json` still declares peer `8.2.2` (vendor not patched).
- `@vitejs/plugin-vue@6.0.7` published range was **not** rewritten (the G432 broad-selector failure mode).

H5 and app JS/UTS compilation both printed `DONE Build complete` with compiler 4.81. Tests and four-app typecheck/build completed. Native host/device was not present.

## Benefits

- Clears the remaining high `GHSA-587h-7wmj-h5pm` and the same-installed Vite 8.2.2 moderate/low siblings that patch at `>=8.2.4`.
- Keeps the 10.x uni family, App-Plus/UTS, and other framework majors unchanged.
- Scope is one parent selector plus the mobile direct pin. Rollback is mechanical.

## Compatibility risks

- **No upstream matched release.** DCloud still publishes exact peer 8.2.2. Future plugin updates may assume 8.2.2-only behavior.
- **Lock metadata vs published peer.** pnpm lock shows 8.2.4; the installed plugin package still says 8.2.2. Fresh installs without the override will conflict again.
- **Rolldown / Vite 8.2.4 compile warnings on `build:app`:** `Invalid output options amd`; `[EMPTY_IMPORT_META]` in `\0vite/preload-helper.js` under IIFE. Bundle still `DONE`. G440 did not run `build:app`, so this job cannot prove those warnings are new.
- **H5 runtime** (browser, device, live navigation) was **not** executed here. Root reviews that independently.
- **Native host / HBuilderX / device** missing. Compile success is not a native PASS.
- Pre-existing mobile warnings remain: `vite.config.ts` ESM-in-CJS vs `configLoader: 'native'`; `[INEFFECTIVE_DYNAMIC_IMPORT]` on `src/stores/session.ts`; Sass `@import` deprecation.

## Rollback

Do **not** reset unrelated versions.

1. Restore B153 bytes for the three experiment files from `30985b80` or the freeze `supervision resume-20261108/dependency-440-reviewed`:
   - `apps/mobile/package.json` → `vite: 8.2.2`  
     SHA-256 `edbfcdca12677c30d6693ac3f458da717ed50a46a4be78d6149174f9790cd308`
   - `pnpm-workspace.yaml` → delete `'@dcloudio/vite-plugin-uni>vite': 8.2.4`  
     SHA-256 `bd44ffef7784beaed6d6fb8da6e76389a17292d980950df639ba8bf2a741da65`
   - `pnpm-lock.yaml`  
     SHA-256 `6d6c5afa27e996ed1174270e7da18df241529daa52b73aff88e7094177ca5dd4`
2. `pnpm install --frozen-lockfile` on that lock.
3. Leave admin/learner/official pins and other overrides as B153.

## Integration gate (Root)

Integrate only after Root accepts this ADR and independently reviews the new H5 runtime. Until then this remains a bounded experiment on the detached checkout. High/critical count in this audit is 0; native host is still not PASS.

Evidence: `/tmp/grok-mobile-resume-vite-security-447/REPORT.md`, `INSPECTION.md`, `h5-artifact.json`, `audit-after.json`, `steps/*.log`.

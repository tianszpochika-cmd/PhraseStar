# G447 inspection (before lock change)

Checkout: detached `ed6a1e57` with B153 six-file bytes still in the working tree.
B153 commit `30985b80` on `dev` matches those six SHA-256s. Original candidate remains recoverable from that commit and Root freeze `supervision resume-20261108/dependency-440-reviewed`. This experiment does not rewrite B153.

## Uni plugin runtime Vite guards

Package: `@dcloudio/vite-plugin-uni@3.0.0-alpha-1000920260909822`
Peer: exact `vite: 8.2.2` (also `devDependencies.vite: 8.2.2`).
Compiler: `uni-app.compilerVersion` `4.81`.

Runtime (`dist/cli/*.js`, `bin/uni.js`):
- Dynamic `require('vite')` / `import('vite')` for `createLogger`, `createServer`, `build`.
- Prints `vite v${require('vite/package.json').version}` — uses whatever is resolved.
- `UNI_COMPILER_VERSION` comes from the plugin package `compilerVersion` (4.81), not from Vite.
- Pinia major check exists (`isPiniaVersion3`); Pinia stays 2.3.1.
- No `semver` assert, no `vite === '8.2.2'` guard, no throw on a different 8.2.x.

`@dcloudio/uni-h5-vite` and `@dcloudio/uni-app-vite` list `vite: 8.2.2` only as **devDependency**, no peer.

Nested `@vitejs/plugin-vue@6.0.7` peer `^5 || ^6 || ^7 || ^8`.
`@vitejs/plugin-legacy@8.1.0` peer `^8.0.0`.
`@vitejs/plugin-vue-jsx@5.1.6` peer `^5 || ^6 || ^7 || ^8`.
Those ranges include 8.2.4.

## Vite 8.2.2 → 8.2.4 official evidence

- npm 8.2.4 200: https://registry.npmjs.org/vite/8.2.4 tarball https://registry.npmjs.org/vite/-/vite-8.2.4.tgz
- Release: https://github.com/vitejs/vite/releases/tag/v8.2.4 published 2026-10-06
- Compare: https://github.com/vitejs/vite/compare/v8.2.2...v8.2.4 ahead 6, behind 0
- npm 8.2.3 is 404; 8.2.3 exists only as a git tag the same day as 8.2.4

Changelog 8.2.3 (folded into 8.2.4 on npm):
- deps: launch-editor v2.14.2
- html: transformIndexHtml filename must not include queries
- server: check `fs.serve` for `?vite-wasm-instance`
- server: store ids in `safeModulePaths` rather than URLs

These are the remaining GHSA/npm high+moderate Vite 8.2.0–8.2.3 findings.

## Official pnpm override behavior

https://pnpm.io/settings/dependency-resolution#overrides (fetched 200)

- Root `pnpm-workspace.yaml` `overrides` may override any graph edge, including peers.
- Parent selector `qar@1>zoo` overrides `zoo` only under that parent.
- Default applies to dependencies, devDependencies, optionalDependencies, and peerDependencies.
- `:peer` restricts to peerDependencies (`react-dom>react:peer`).

Chosen selector (as authorized): `@dcloudio/vite-plugin-uni>vite: 8.2.4` plus direct mobile `vite: 8.2.4`.
This is an application-maintained peer adjustment. It is not an upstream support claim.

Not used: range selector `vite@8.2.2` (would be broader), `vite@>=7 <8` (G432 already rejected), vendor patches, `peerDependencyRules.ignore`.

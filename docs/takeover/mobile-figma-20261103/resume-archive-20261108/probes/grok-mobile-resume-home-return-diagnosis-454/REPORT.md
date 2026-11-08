# G405 home return — diagnosis

Verdict: **probe oracle**. The actual G405 run stays **FAIL** (`home-return-final-hash`). The fresh browser did return to the frozen Home entry. `location.hash` was `#/`, and the G405 observer required the alias `#/pages/home/home`.

This is not an insufficient wait, not an onboarding/login guard bounce, and not a product defect in the current mobile auth routing. No product source was changed. No G454 runtime was started.

## What the actual run recorded

Ready-root receipts, not the earlier missing-jar preflight:

- `EXIT.json`: exit 1, `timedOut` false, `2026-11-08T01:01:30Z`
- `INDEPENDENT-RELEASE.json`: `RELEASED_INDEPENDENTLY_VERIFIED`, ports `13306`, `18070`, `18087`, `18088`, `18089`, `18090`, `18091`, `18183` free, owned container/label absent, `completedActorMustNotBeReplayed` true
- `runner-exit.log`: `1`
- `runner.log`: `run complete: status=FAIL, passed=184/184, required failures=0`
- `result.json` `candidate.head`: `61b9ede7c65ef065c76c846c27fb69a52cd042cd`, `trackedClean` true, `authorOnly` true, `preflightStatus` `PASS`
- `fullBrowser.observer.reason`: `home-return-final-hash`
- `full` journey before that gate: target PUT 1/200, preference writes 0, consent writes 0, placement create 1, ten responses all 200, final report `ASSESSED`, one `plans:ensure` 200, `planEnsurePlanVersion` 2, retest writes 0, skip writes 0, unexpected plan writes 0

The 184/184 count is the harness check list. Acceptance still sets the process status to FAIL when `fullBrowser.status !== 'PASS'` (`staged-harness/acceptance-learner-target.mjs` around the final status gate). `browser.status` is that failure. Required-failure count stayed 0.

`home-return-receipt.json` (redacted, unchanged by this diagnosis):

| Field | Value |
| --- | --- |
| status / reason | `FAILED` / `final-hash` |
| finalHash | `/` |
| loginReturnTo | `/pages/home/home` |
| leftLogin | true |
| login | one POST 200, refresh posts 0 |
| principal | GET 200, `PASSED`, `ELIGIBLE`, `learning.plan.read` |
| home | GET 200 once, `READY`, profile ready, target ready, placement `COMPLETED`, blocker null, taskCount 3 = tasksLength 3, planning input and plan present, planVersion 2 matches ensure |
| routeFulfill / storageInjection / locationAssign | false |
| extra writes / fulfills | 0 |
| index | `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32` |

Home `taskCount` 3 is the first-day projection. The same run's today rows were also 3. The learning-owner expectation of 10 plan tasks and plan version 2 stays on the wrapper SQL gate. Those are different counts.

The earlier missing-jar failure is a different run: `home-405-root` / `/private/tmp/grok-mobile-resume-home-405/run-preflight-failed-20261108` (`preflightStatus` FAIL, IAM jar missing). It is not this hash failure.

## Why the hash is `/`

G405 `safeHash` strips `#` and keeps a path that starts with `/`. `#/` is therefore recorded as `/`, not as null and not as `/pages/home/home`. The observer then did:

1. Open `#/pages/login/login?returnTo=%2Fpages%2Fhome%2Fhome` (this check passed; otherwise the reason would be `not-login`).
2. Submit the password. No `location` assign, no storage write, no `route.fulfill`.
3. Wait until the hash left login, then wait until principal and home bodies arrived (up to 20s).
4. Fail immediately when `finalHash !== '/pages/home/home'`.

Step 4 ran only after the home body existed. The snapshot is not a cutoff before Home loaded.

Frozen B139 route table in `assets/index-CyPYQAYX.js`:

`window.__uniRoutes=[{path:"/",alias:"/pages/home/home",meta:{isQuit:!0,isEntry:!0,isTabBar:!0,tabBarIndex:0,navigationBar:{titleText:"学习",...}}}]`

Frozen uni-h5 formatter in `assets/_plugin-vue_export-helper.B5ssqoSF.js`:

`a.meta.isEntry&&(n=n.replace(a.alias,"/"))`

For `switchTab` of a tab page, the same formatter first takes the path without query, then replaces the entry alias with `/`, then assigns `o.url`. Home is that entry. `switchTab({url:'/pages/home/home'})` is committed as `/`.

Frozen `openUniPage` (`gateway.CdAddI9b.js` `function f`) puts `/pages/home/home` in the tab set and calls `uni.switchTab`. `getUniRuntime` returns the real `uni` object when `switchTab` exists, which this H5 bundle provides. The fallback that would assign `location.hash = '#/pages/home/home'` does not run.

Login calls that path. `pages-login-login.CtHiC6sh.js` does `await R(consumeReturnTo())`. `R` is `Sa` in `index-CyPYQAYX.js`:

`async function Sa(e){... !ga(n)||t.isLearningReady ? ga(n)&&await Ia(n)||ga(n)&&!(await Aa())||z(n) : Ea(n)}`

`z` is `openUniPage`. `Ea` is onboarding. With a learning-ready session, `Sa` opens the return path unless the resume step redirects.

Current source at the declared head matches that shape:

- `apps/mobile/src/pages/login/login.vue` calls `continueAfterLogin(session.consumeReturnTo())`
- `apps/mobile/src/auth/navigation.ts` `continueAfterLogin` calls `openUniPage(safe)` unless rejected, not learning-ready, resume-blocked, or locale hydrate fails
- `apps/mobile/src/platform/uni-runtime.ts` `openUniPage` uses `switchTab` for `/pages/home/home`
- `apps/mobile/src/pages.json` lists `pages/home/home` first and as tab index 0
- `redirectIfResumeBlocksLearning` redirects only for `rejected`, `gate`, `consent`, or a readable unsaved goal. A saved goal stays step `assessment` and does not redirect (`apps/mobile/src/domain/onboarding-resume.ts`)

`currentMobilePagePath` treats hash `/` plus an empty fallback as "no hash path" and reads `getCurrentPages()`. `normalizeMobilePagePath('/')` with the home fallback returns `/pages/home/home`. The app already treats this entry hash as Home.

## Ruled out

**Insufficient wait.** The home GET had already returned `READY` when the hash was read. The `/` rewrite is in the navigation formatter, before the route is committed. Extra waiting does not change the entry path from `/` to the alias. G454 still requires three identical hash samples so a moving hash cannot pass. A stable `/` is the entry path, not an early sample of a later alias.

**Guard bounce.** `leftLogin` is true. The hash is not login, onboarding, forbidden, today, learn, or assessment. Principal is `PASSED` / `ELIGIBLE` with `learning.plan.read`. Home is `READY`, placement `COMPLETED`, blocker null, plan version 2. `continueAfterLogin` would have sent onboarding or forbidden for the blocking steps. It did not.

**Product bug.** The mounted entry component is Home. `pages-home-home.CUSHTSq3.js` contains `home-page` and `home-title`. The today and learn chunks do not. Today and learn can also call `loadHome()`, but their routes are not the entry path `/`. One home GET plus hash `/` matches `switchTab` onto that entry, not a wrong page.

Forcing `location.hash = '#/pages/home/home'` in product code would fight `n.replace(alias, "/")`. That is not a minimal fix. No product patch is proposed. No product file was edited.

## G405 stays failed

The original rule still returns `final-hash` for this receipt. The new oracle does **not** promote it. The historical receipt has no live entry proof, top route, or stable hash samples, so `decideHomeReturn` returns `entry-proof-missing`. The receipt file hash was the same before and after the offline check.

Accepting `/pages/home/home` as a second success hash is rejected. On a synthetic receipt that has the entry proof and `finalHash` `/pages/home/home`, the new oracle returns `hash-not-entry-path`.

## G454 candidate

Prepared under `candidate/`. Status `PREPARED_NOT_RUN`.

A later Root lease mints a new `mb004-<runId>@example.invalid` and a random password inside the staged acceptance harness. It does not reuse the G405 run directory, container, or actor. It still does one fresh target PUT, ten real answers, one assessed report, and one `plans:ensure`, then a new non-persistent login with `returnTo=/pages/home/home`.

Pass requires all of:

- frozen index `706fffb7…`
- one entry route, path exactly `/`, alias exactly `/pages/home/home`, tab index 0, title `学习`
- stable `finalHash` `/` (three identical samples)
- `getCurrentPages()` top route `pages/home/home`
- visible `.home-page` and `.home-title`, login control not visible
- the same READY / ELIGIBLE / plan-version facts, placement `COMPLETED`, task count matching tasks length
- no route fulfill, storage injection, location assign, extra writes, retest, second plan, catalog write, or preference write

`NOT_READY` / `PLACEMENT_REQUIRED` still fails even when the hash is the entry path.

## Checks run here

Offline only. No Git, Docker, Java, browser, listener, or G454 lease.

```sh
node --check /tmp/grok-mobile-resume-home-return-diagnosis-454/candidate/oracle.cjs
node --check /tmp/grok-mobile-resume-home-return-diagnosis-454/candidate/oracle-live-gate.cjs
node --check /tmp/grok-mobile-resume-home-return-diagnosis-454/candidate/oracle-offline-check.cjs
node --check /tmp/grok-mobile-resume-home-return-diagnosis-454/candidate/home-return-observer.cjs
node --check /tmp/grok-mobile-resume-home-return-diagnosis-454/candidate/home-return-hook.cjs
bash -n /tmp/grok-mobile-resume-home-return-diagnosis-454/candidate/wrapper.sh
node /tmp/grok-mobile-resume-home-return-diagnosis-454/candidate/oracle-offline-check.cjs
bash /tmp/grok-mobile-resume-home-return-diagnosis-454/candidate/wrapper.sh
```

Result: syntax checks passed. Offline summary `OFFLINE_PASS`, 34 checks. Unleased wrapper exited 2 with `REFUSING: G454 runtime requires Root lease...` and did not start a service.

Frozen index sha recomputed to `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`.

Source head is the value recorded on the ready-root result (`61b9ede7c65ef065c76c846c27fb69a52cd042cd`, author-only, tracked clean). This session did not run Git. The frozen H5 is the B139 artifact above, not a new build. Nothing here is a current-dependency, native, deployed, or signoff claim.

## Later Root command

Not run. Create the empty run directory mode `700`, hold the eight fixed ports, and do not point at the G405 run:

```sh
install -d -m 700 /private/tmp/grok-mobile-resume-home-return-454/run
G454_ROOT_LEASE=YES_RUN_G454_HOME_RETURN \
  bash /tmp/grok-mobile-resume-home-return-diagnosis-454/candidate/wrapper.sh
```

`MB006_PLACEMENT_RETEST_CONTINUATION` must stay unset. Root reviews the live receipt. This diagnosis does not declare that lease passed.

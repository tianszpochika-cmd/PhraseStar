# G454 candidate — prepared, not run

Fresh actor. Same one-plan shape as G405. Corrected home-return oracle. Does not replay the G405 actor, setup, answers, or plan.

## Oracle

`finalHash` must be the frozen entry path `/`.

The route record must also show alias `/pages/home/home`, one entry, tab index 0, title `学习`. The top page route must be `pages/home/home`. `.home-page` and `.home-title` must be visible. The login control must not be visible. The hash must be stable across three samples.

`/pages/home/home` as `location.hash` fails `hash-not-entry-path`. Onboarding, today, learn, assessment, forbidden, and login fail with their own reasons. `NOT_READY` / `PLACEMENT_REQUIRED` fails even if the hash is `/`.

No token injection, route fulfill, cookie injection, fake READY state, programmatic learning write, catalog write, preference write, retest, or second plan. The observer only reads the route table, `getCurrentPages()`, and visibility.

Identity comes from `acceptance-learner-target.mjs`: `mb004-${runId}@example.invalid` and `Mb004!` plus 24 random bytes. The wrapper refuses `/private/tmp/grok-mobile-resume-home-405/run` and `/tmp/grok-mobile-resume-home-405/run`.

## Offline

```sh
node /tmp/grok-mobile-resume-home-return-diagnosis-454/candidate/oracle-offline-check.cjs
bash /tmp/grok-mobile-resume-home-return-diagnosis-454/candidate/wrapper.sh --offline
```

Without `G454_ROOT_LEASE=YES_RUN_G454_HOME_RETURN`, `wrapper.sh` exits 2 and does not start Docker, Java, Chrome, or a listener.

## Later Root lease

```sh
install -d -m 700 /private/tmp/grok-mobile-resume-home-return-454/run
G454_ROOT_LEASE=YES_RUN_G454_HOME_RETURN \
  bash /tmp/grok-mobile-resume-home-return-diagnosis-454/candidate/wrapper.sh
```

Keep `MB006_PLACEMENT_RETEST_CONTINUATION` unset. The wrapper still requires source head `61b9ede7c65ef065c76c846c27fb69a52cd042cd`, a clean tracked tree, the pinned B139 index, and the eight fixed ports free. Root reviews the live receipt. This file does not say that lease passed.

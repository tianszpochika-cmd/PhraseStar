# Mobile 33-route next-test queue

Signoff stays **PENDING**. Full DoD stays **not_run**. RC1 stays **CANDIDATE_NOT_FROZEN**. Runtime for this job is **NOT_RUN**.

Source pin: `dev@61b9ede7`. Evidence pin: `230d19ec` (B146). B125 JSON is dated `b3f0e7cd`.

Machine file: `queue.json`. Validator: `node /tmp/grok-mobile-resume-trace-406/validate-queue.cjs`.

## Distinct tasks, not 33 rewrites

| Rank | Task | Routes | Closeable now | Assigned | Reuse |
|---|---|---|---|---|---|
| 1 | Empty placement-required shelf H5 | MB-009 | yes | 401 | G392 |
| 2 | Published-reading CHOICE score H5 | MB-014 → MB-011 | yes | 403 | G399 |
| 3 | World default H5 | MB-018 | yes | 404 | G368/G382; G398 empty |
| 4 | One bulk device CTA | MB-025 | yes | 402 | G394 + G383 |
| 5 | Login returnTo home READY | MB-001, MB-007 | yes | 405 | G397 report |
| 6 | Same-key retest replay | MB-006 | yes | — | G391 |
| 7 | Forbidden H5 reason + logout | MB-005 | yes | — | B145 |
| 8 | Games catalog owner read | MB-019 | yes | — | B146 stack |
| 9 | Avatar owner reads | MB-021 | yes | — | B146 stack |
| 10 | Register same-key 409 | MB-002 | yes | — | B129 |
| 11 | Graded article read, 168:2513 closed | MB-015 | yes | — | B126 article |
| 12 | Expired share link | MB-017 | yes | — | B117 |
| 13 | Local quality failure, 0 PATCH | MB-027 | yes | — | B40/B142 |
| 14 | Learning consume one Kafka item | MB-013 | yes | — | B110/B122 |
| 15 | Mistake detail after consume | MB-016 | after 14 | — | B134 |

## Keep, do not rewrite

Closed notices MB-029…033 and MB-022. Practice hub tab G183. Skip write is not on MB-006. Due-row click is not on MB-008. Formal consent MB-004. Code delivery MB-003. Native profile MB-023. Purchase MB-026. Social rooms need `social-service:18095`, which was not in the last lease.

## Current-page entry that does not exist

- MB-010 has no learning-service hub load.
- MB-006 has no skip CTA.
- MB-008 due rows are not buttons; `completeTask` is unused.
- MB-014 `submitReadingAttempt` is closed; submit is MB-011 CHOICE click.
- MB-022 `listB4OfflinePackages` is `unavailableOperation()`.

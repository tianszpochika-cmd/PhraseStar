# G458 ordinary reading practice saved feedback — PRODUCT PATCH

Root asked for a minimal product fix after G455. G455 continued one CHOICE click, collected POST 200 `scoreBucket=FULL`, and read owner DB `attempts=1`, `outbox=3`, `session_assessed=1`, `answers_len_sum=1`. The observer then recorded `savedReceipt=false`, `feedbackVisible=false` and failed `feedback-not-rendered`. This session inspected the live page/store/template path and patched that path. Live H5 remains **NOT_RUN**. Frozen B139 and completed G455 actors were not touched.

Directory: `/tmp/grok-mobile-resume-reading-feedback-458`

## Cause (proven before the edit)

G455 already collected the HTTP body. `attemptFacts` only records `scoreBucket` after `data.savedReceipt === '已保存'`. The save happened. The missing evidence was the DOM.

Reading practice opens `/pages/b2-practice/b2-practice?entry=reading`. `B10ExerciseCard` still emits `{selectedOptionKeys}` on a CHOICE click. `store.submitAnswer` POSTs `/assessment/sessions/{id}/attempts`, then writes `answerResults[exerciseId]` and returns the parsed result.

The page chooses the visible item with:

```
list.find((item, index) => index >= start && !store.answerResults[String(item.exerciseId)])
```

On the last question that find returns null. The template keeps `[data-save-receipt]` and `[data-feedback-text]` only under `v-else-if="exercise"`. The finished branch previously showed `本次练习已完成。` and the report button. Vue then paints `data-panel="finished"` with no save receipt and no feedback words. That is the G455 oracle.

This is a product unmount, not an observer-only miss.

## Patch

Owner: `apps/mobile/src/pages/b2-practice/b2-practice.vue` (MB-011 / PAGE-P1-PRACTICE-SESSION). The store write and API parse already returned the server receipt.

1. `acceptedPracticeReceipt` keeps a result only when `savedReceipt` is a non-empty server string.
2. `answer()` assigns that receipt or null. A 401/403/error/null body does not claim 已保存. A FULL bucket without a receipt does not claim 已保存.
3. The finished panel now renders the same save / words / next-question block from that last successful server result.
4. Immediate CHOICE submit is unchanged. Nonterminal items still stay on the unanswered exercise with the last receipt. DEC-04 placement files are unchanged. No API/contract change.

## Requirements trace (existing ids only)

| id | use |
| --- | --- |
| R1-045 / BC-036 | save receipt first, then 正确/需要再练, then next question |
| R1-044 / BC-035 | reading practice pack / last item can close the session |
| R1-043 / BC-033 | published session owner/version pin |
| IC-022 | ordinary practice immediate feedback; DEC-04 placement timing stays pending |
| IC-023 | resume/checkpoint/401/403/reset path left in place |
| IC-111 | save remains readable after the last item |
| PAGE-P1-PRACTICE-SESSION / MB-011 | `#/pages/b2-practice/b2-practice` |
| PAGE-P1-READING / MB-014 | article handoff still uses `READING_PRACTICE_ENTRY_PATH` |
| FEAT-RDG-002 → V2-980-0136 | reading feature |
| PRD-ATOM-0392 → V2-980-0151 | reading slice |
| FEAT-ASM-012 → V2-980-0226 | practice session |
| PRD-ATOM-0474 → V2-980-0236 | practice session atom |
| INT | existing POST `/api/v1/assessment/sessions/{session}/attempts` |
| E2E | G455 FAIL `feedback-not-rendered` remains the live oracle; this candidate is source-only |

No new ids.

## Changed path SHA-256

HEAD `310a7d01e4af6dadeb26a815b4e6e58a7bbd380b` (this worktree).

| path | bytes | SHA-256 |
| --- | ---: | --- |
| `apps/mobile/src/domain/practice-loop.ts` | 3086 | `02c8377ed9253cfc510de106271972beb4a3b9f79d09e826caabd8166f45a1a2` |
| `apps/mobile/src/pages/b2-practice/b2-practice.vue` | 23410 | `74e7822a13c29b331aab1788b1cb96f735f56c56dab56fd4d7d7183fd96ecf4b` |
| `apps/mobile/tests/b2-practice-saved-feedback.test.mjs` | 12443 | `4985e75a7357bd75c11f595a2d34ce7771c9a472192d7dcc811c336237ab760c` |
| `CHANGELOG.md` | 386714 | `1d8f57f45f0577a68950c416bb55f6623317d61e76034f8e5769b94c0f8ec2dc` |

`exact.diff` is 378 lines in this directory.

## Actual command exits

| command | exit | result |
| --- | ---: | --- |
| `node --test apps/mobile/tests/b2-practice-saved-feedback.test.mjs` | 0 | 5/5 pass, including compile + `renderToString` of the finished panel |
| `node --test` practice-core + reading-page + c04 + c08 + saved-feedback | 0 | 21/21 pass |
| `node scripts/dev/run-node-tests.mjs apps/mobile/tests` | 0 | 86 files, **687/687 pass**, 16.4s |
| `pnpm --dir apps/mobile exec tsc --noEmit --strict ... src/domain/practice-loop.ts` | 0 | isolated loop file |
| `pnpm --dir apps/mobile typecheck` | **2** | `TS2307` `@englishflow/contracts` from `packages/api-client/src/generated/index.ts`. Our files are not in the error. Pre-existing worktree resolution gap. |
| `node /tmp/grok-mobile-resume-reading-feedback-458/offline-repro.mjs <repo>` | 0 | finished panel HTML contains `data-save-receipt` / 已保存 / 正确 |
| `node --test apps/learner-web/tests/practice-feedback.test.mjs` | **1** | 2 pass; 1 pre-existing fail: `b3-reading.vue` has no `data-save-receipt`. Reading-page tests forbid that marker on the article page. Not this owner. |

NOT_RUN: live owner H5, G455 re-lease, browser click, Docker/JVM/18183, H5 build, git commit/push, pnpm install, frozen B139 write, G455 actor write.

## Reproduction

From the repo root, already-installed tools only:

```
node --test apps/mobile/tests/b2-practice-saved-feedback.test.mjs
node /tmp/grok-mobile-resume-reading-feedback-458/offline-repro.mjs "$PWD"
```

Live runtime stays with Root. One later serialized lease can use the existing G455 observer against a new H5 build of this source. Do not replay the G455 account or mutate frozen receipts.

## Limits

- Source proof only. G455 FAIL evidence stays immutable.
- Report CTA on the finished panel is the existing complete control, not a second answer submit. CHOICE remains the ordinary submit.
- `practiceFeedback()` still defaults 已保存 when called with a bucket and no receipt. The page no longer calls it on that path.
- Full `apps/mobile` `tsc` still fails on the generated api-client contracts import in this worktree.

# RC-A decision note (not implemented)

For Root review. This job did not change share mint, revoke, signed-access, or upload-url.

## Conflict

AGENTS.md §3.4 and `x-p1r-api-governance.writeIdempotency` require write operations to declare idempotency. The P1R checker treats every external write with `x-idempotency.required: false` as the signed-access exception, and that exception is a singleton: `POST /api/v1/content/media/{mediaAssetId}/signed-access` / `signContentMediaAccess`, count `=== 1`.

`issueLearningReportShare` is a durable write (`required: false`, inline optional `Idempotency-Key`, no `x-p1r-idempotency-exception`). That is a second optional write, so tests 67/70 report “not the sole signed-access exception” and “found 2”. Folding share mint into signed-access, dropping revoke `required: true`, or adding a blanket optional-write allowance would green CI by weakening the gate. Do not do that.

## Existing facts

- Signed-access singleton stays `signContentMediaAccess`. Do not change `=== 1` to `>= 1`.
- `revokeLearningReportShare` already has `x-idempotency.required: true` and no `Idempotency-Key` parameter. Clients (`learner-web` / `mobile` `revokeReportShare`) omit the header. The contract is ahead of the callers; do not drop `required: true` to match them.
- `mintMediaUploadUrl` is fail-closed (`x-fail-closed` `NO_SUCCESS_PATH`, `sideEffects false`, 503, `MEDIA_UPLOAD_PUT_GRANT_UNAVAILABLE`, no 2xx). `validate-contracts.mjs` forbids `x-idempotency` on that route. The p1r checker does not yet recognize that predicate and still demands `x-idempotency`. Do not add the header and do not invent a 2xx upload path.
- First-party share mint: `B25LearningJdbcController.issueReportShare` mints a new unguessable ref when the key is missing/blank; a well-formed key replays the first owner/tenant binding. `apps/learner-web/src/api/b10.ts` `issueReportShare` never sends a key. `apps/mobile/src/api/b10.ts` sends a key only when the caller passes one matching `^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$`.
- No ADR currently names a second optional-write class. ADR-0010/0012/0013 cover IAM/JWT, not this exception. Compatibility pins (M2-001 / M1-018) are unrelated.

## Contract-first forward fix (Root chooses; not done here)

1. Keep `SIGNED_ACCESS_IDEMPOTENCY_EXCEPTION` exactly `{signContentMediaAccess}` and count `=== 1`.
2. Add a reviewed second exception class whose only member is `issueLearningReportShare`, with `x-p1r-idempotency-exception` (`rule`, `reason`, `owner`, `safeBehavior`). A third `required: false` write still fails. Update test 73 to the new exact message. Do not classify report-share as signed-access.
3. Teach the p1r checker to skip the `x-idempotency` requirement only for the existing upload-url fail-closed predicate. Do not add `x-idempotency` to `mintMediaUploadUrl`. `validate-fail-closed-write` must still reject that addition.
4. Keep revoke `required: true`. Add the canonical required `Idempotency-Key` parameter and send it from learning-service, learner-web, and mobile.

Negative checks after that choice: a second signed-access exception still fails; an extra optional write still fails; upload-url with `x-idempotency` still fails; revoke without the header still fails.

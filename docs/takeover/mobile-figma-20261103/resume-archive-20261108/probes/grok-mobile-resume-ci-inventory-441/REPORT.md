# G441 rework — Java-literal SQL equals guard

Base: `ed6a1e57347448a25d7f92d02cb6ea8fad03e1db`. Four-file scope only. Report: this directory. No Git writes, installs, shared-module mutation, Docker/JVM/Chrome/listener, subagents, provider changes, or full 1481.

Root reproduced 37 focused tests PASS on the first G441 candidate, then found a guard regression: `validateOwnerSourceText(learner-service, Java path)` returned `[]` for

- `jdbc.query("SELECT assessment_service.equals(id) FROM local_table");`
- `jdbc.query("CALL ASSESSMENT_SERVICE.equals(?)");`

Real `ASSESSMENT_SERVICE.equals(principal.subject())` must stay allowed. SQL schema routines inside Java strings/text blocks and raw `.sql` must stay denied even when the routine is named `equals` / `equalsIgnoreCase`.

## Prior REWORK status

| item | status |
| --- | --- |
| RC-F inventory fileCounts iam18/content33/learning14/assessment12/admin-ops7 | **closed, preserved**. Policy sha256 still `31333598faae95b7216599b8965c16e4b8f56f249e92131980d78eae585b3d9f`. |
| RC-J derived-age assertion | **closed, preserved**. Adult-gate test sha256 still `a68a0031704b839980d94066902178b42b8e9fca9b36c8b4b4f235e790e19a86`. No auth/Java change. |
| Scanner: bare `.equals(` / `.equalsIgnoreCase(` without source context | **was remaining / regression**. Closed in this rework. |
| RC-A, RC-B, RC-C, RC-D, RC-E, RC-G, RC-H, RC-I | **remaining**. Untouched. |
| Evidence-manifest current-source digest rebase | **remaining**. Historical pins kept. |
| P1R-M2-004 runtime | **remaining** (`NOT_RUNTIME_VERIFIED`). |

## Cause

`foreignSchemaReferences` is used on normalized SQL (`validateMigrationSqlText` ~line 420) and on raw owner source (`validateOwnerSourceText` ~line 1001). The first G441 exemption looked only at the following method token. `assessment_service.equals(` inside a Java string or in raw SQL therefore looked like a Java method.

## Fix

Checker now classifies Java source (`classifyJavaSource`): code / comment / string / text block.

- Java **code** receivers may skip only:
  - quoted `"TOKEN_TYPE_service".method(` (P1-LIVE-008)
  - bare `ASSESSMENT_SERVICE.equals(` / `equalsIgnoreCase(`
- Matches inside Java literals are not exempted.
- Unescaped string and text-block contents are scanned again **without** any Java-method exemption, so `\"assessment_service\".equals` is denied.
- Raw `.sql` / `validateMigrationSqlText` never pass `javaState`, so SQL `schema.equals()` / `CALL ASSESSMENT_SERVICE.equals(?)` stay denied.
- No namespace allowlist. No function-name allowlist. `ASSESSMENT_SERVICE.attempt`, `assessment_service.attempt`, and `ASSESSMENT_SERVICE.length()` still fail.

RC-J and inventory edits were not retouched.

## Tests

`node scripts/dev/run-node-tests.mjs tests/p1r/p1r-m2-002-adult-gate-validation.test.mjs tests/p1r/p1r-data-ownership.test.mjs`

Node v20.19.5. **39 pass / 0 fail** (original 37 plus 2 new tests). Duration 648.259458 ms.

New negatives (do not drop the old ones):

- Java `jdbc.query("SELECT assessment_service.equals(id) FROM local_table");`
- Java `jdbc.query("CALL ASSESSMENT_SERVICE.equals(?)");`
- Java `equalsIgnoreCase` SQL function in a normal string
- Java escaped `"SELECT \"assessment_service\".equals(id)..."`
- Java text block `""" SELECT assessment_service.equals(id) ... """`
- raw SQL `SELECT assessment_service.equals(id) FROM local_table;`
- raw SQL `CALL ASSESSMENT_SERVICE.equals(?);`
- `.sql` path through `validateOwnerSourceText`

New/kept positives:

- `ASSESSMENT_SERVICE.equals(principal.subject())`
- `"TOKEN_TYPE_service".equals(a.getAuthority())`

CLI: `node scripts/audit/p1r-data-ownership-check.mjs --json`

```
result PASS
errors []
runtimeStatus NOT_RUNTIME_VERIFIED
15 services, 14 data owners, 13 existing / 1 planned
```

Copy: `data-ownership-cli.json`.

## Hashes (sha256)

| path | G441 first candidate | this rework |
| --- | --- | --- |
| `config/p1r-data-ownership.v1.json` | `31333598…585b3d9f` | **unchanged** |
| `scripts/audit/p1r-data-ownership-check.mjs` | `7fec2582…0f79cac` | `5b25a2fd3f74265eebb78df8efa635c6a44e70af97e516c084414d6213578ddb` |
| `tests/p1r/p1r-data-ownership.test.mjs` | `58601e23…637f50` | `ba01cbdfe9ba6128ea049a9b315298ec80b3ab53630ff68946d5cff1d3d2a420` |
| `tests/p1r/p1r-m2-002-adult-gate-validation.test.mjs` | `a68a0031…0e19a86` | **unchanged** |

Frozen pins still not retargeted: document-shape `3e39d6ff…` / `507227b4…` / `38c319c1…`; IAM V4/V5 dynamic SQL `ffba958c…` / `2c3b4f4b…`; M2-001 source `a154f200…`; M1-018 expected `5dd1edfa…`; execution-target `f6e9cb48…`.

## Exact diff

Full patch: `exact.diff` (working tree vs `ed6a1e57`).

```
 config/p1r-data-ownership.v1.json                  |  10 +-
 scripts/audit/p1r-data-ownership-check.mjs         | 174 +++++++++++++++++++--
 tests/p1r/p1r-data-ownership.test.mjs              |  92 +++++++++--
 tests/p1r/p1r-m2-002-adult-gate-validation.test.mjs |  39 ++++-
 4 files changed, 284 insertions(+), 31 deletions(-)
```

Policy hunks remain the five reviewed fileCounts only. Adult-gate hunk remains the derived-age locator. This rework adds Java source-context classification and the literal/SQL equals negatives.

Working tree (no commit, no index write):

```
 M config/p1r-data-ownership.v1.json
 M scripts/audit/p1r-data-ownership-check.mjs
 M tests/p1r/p1r-data-ownership.test.mjs
 M tests/p1r/p1r-m2-002-adult-gate-validation.test.mjs
```

HEAD remains `ed6a1e57347448a25d7f92d02cb6ea8fad03e1db`.

## Missing runtime / DoD

- Inventory is still candidate-only / `NOT_RUNTIME_VERIFIED`.
- Evidence manifests still pin pre-G441 artifact digests.
- Full 1481 not rerun.
- Remaining G436 24 failures (RC-A–E, G–I) unchanged and not weakened.
- `POST /api/v1/auth/register` stays. Cross-service SQL-shaped access stays denied.

# G394 uni-button bulk CTA oracle

Status: **PREPARED_NOT_RUN**

This session read the applicable `AGENTS.md`, the preseeded G383 wrapper, the preseeded G331 observer, the redacted G383 instrument and receipt, the B116 H5 root named by that wrapper, and the current devices page. It wrote this report, `runner-394.cjs`, `pin.json`, and `output.json` under `/tmp/grok-mobile-device-bulk-unibutton-oracle-394`. It did not execute the deriver, the device lease, MySQL, IAM, Gateway, Chrome, or a listener. It did not change Git, product source, credentials, plans, ports, the G331 source, the G383 receipts, or the two preseeded files.

## G383 actual

`/tmp/grok-mobile-device-guard-source-directory-383/instrument-result.json` records `FAILED` / `readback-mismatch` after operation `sequential`. The browser posted two kickouts, both HTTP 200, on `/api/v1/iam/devices/<other>/kickout`, with nonempty idempotency keys. The UI recorded `rowExitClicks` 2, `confirmClicks` 2, `bulkClicks` 0, `revokedTagsAfter` 2, `currentTaggedAfter` true, `successAfterReadback` true, and `currentExitBefore` 0. `ownerUnchanged` is true and `actorStillAccepted` is true. `oldRefreshDenied` is 0 and `oldRefreshStatuses` is empty. The refresh loop sits after the browser reason is cleared, so those two old WEB refreshes did not run.

The sibling recorded term that is false is `ctaDisabledAfter`. The receipt is `FAIL` / `wire-outcome`: instrument status `FAILED`, mode `sequential`, `refreshStatuses` [], `currentStays` true, `foreignUnchanged` true, `priorLeak` false. The same redacted objects are in `output.json`.

## Root

G331 `readUi` resolves the batch control twice with `page.locator('button.dev-cta')`: once for `.first()`, once for `.count()`. The later bulk click resolves `page.locator('button.dev-cta')` again. A count other than 1 stores an empty label and forces `ctaDisabled` true through the mismatch branch. `ctaDisabledAfter` then requires that forced flag and the exact label `退出其他设备`, so the empty label fails the readback before the old-token refresh.

The preseeded observer in this directory still has those three `button.dev-cta` sites and `OUT_DIR` `/tmp/grok-mobile-device-others-revoke-h5-probe-331`. The preseeded wrapper is the G383 lease: identity 383, `G331_SHA` `704943be048fda4933327ca91e6870b08eb8fa70557ff3d0908c0591aa4ba6af`, and a wire gate that requires `ui.mode === 'bulk'`.

B116 index pin `94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520` is the H5 root in that wrapper. Its `assets/uni.f315d0bb.css` defines the `uni-button` element. Its `assets/pages-devices-devices.Dt_SyyDs.js` contains both `uni-button` and `dev-cta`. Current `apps/mobile/src/pages/devices/devices.vue` renders one ready-state control with `class="dev-cta"`, `role="button"`, and `:disabled="busy || noIdentity || !revocableDevices.length"`. After zero revocable devices the label is `devicesPage.ctaOthersDisabled`, Chinese `退出其他设备`. With two revocable devices the label is `devicesPage.ctaOthers`, Chinese `退出其他设备（2）`, which is G331 `COPY.cta`.

## Seam

`runner-394.cjs` keeps the preseeded bytes as the only observer input. It requires observer length 43416 and SHA-256 `704943be048fda4933327ca91e6870b08eb8fa70557ff3d0908c0591aa4ba6af`, and it requires the wrapper to carry that pin, the B116 pin, and the 383 header. Each patch must match once.

The derived observer resolves one locator, `.dev-cta[role="button"]`. The same object is clicked. Disabled is the DOM `disabled` property being true, or the `disabled` attribute being present and not the value `false`. A missed element stays enabled-false and fails both exact matches. There is no `uni-button` selector and no second `button.dev-cta` selector.

Prior bulk match: count 1, genuine disabled false, text exactly `退出其他设备（2）`. That path clicks once and confirms once. Sequential fallback is the explicit branch `ctaCount === 1 && genuineDisabled && otherExit === 2`, with two row clicks and two confirms. The readback accepts exactly one of those click shapes, then the same after match: count 1, genuine disabled, text exactly `退出其他设备`.

The two old refresh 401 checks, the current bearer acceptance check, and the foreign owner snapshot stay the loops already in the G331 bytes. A later opt-in result can be written only as `/tmp/grok-mobile-device-bulk-unibutton-oracle-394/oracle-result.json`.

## Pins

`pin.json` records the reviewed pins with `recomputed` false. This session did not hash the files. The deriver, when run, recomputes the observer pin, refuses a mismatch, and writes `device-others-owner-394.cjs` and `derived-pin.json` with the wrapper and derived digests.

| Item | Bytes | SHA-256 |
| --- | --- | --- |
| G331 observer | 43416 | `704943be048fda4933327ca91e6870b08eb8fa70557ff3d0908c0591aa4ba6af` |
| G331 report | 7467 | `527843fef5fa89868d1ac4e8d99f7c4a9f77e1654dfa0aa3a214eb389186d795` |
| B116 index | reviewed | `94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520` |

## Next command

```sh
node /tmp/grok-mobile-device-bulk-unibutton-oracle-394/runner-394.cjs
```

That command is the deriver. It is not the device lease. The lease remains the untouched G383 wrapper and was not started.

## Boundaries

Frozen inputs left in place: `device-others-owner.cjs`, `device-others-runtime.sh`, the G331 directory, and the G383 `instrument-result.json`, `receipt.json`, and `preflight.json`. Product source, Git, credentials, plans, and ports were left unchanged. No digest above was recomputed in this session.

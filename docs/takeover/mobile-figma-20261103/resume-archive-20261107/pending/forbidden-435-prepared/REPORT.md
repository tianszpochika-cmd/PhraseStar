# MB-005 forbidden H5 lease (G435)

435 lease status: `NOT_RUN`. This session did not start Docker, Java, Chrome, Gateway, IAM, MySQL, or a listener. No `PASS` is claimed. The files are prepared for a later root run. They do not validate the current worktree build. The page under test remains the frozen historical B139 H5 bundle.

## What G413 already showed

Root ran `/tmp/grok-mobile-resume-forbidden-h5-413` once. That directory and its receipts were not rewritten.

| Fact | Record |
| --- | --- |
| Lease | `FAILED`, reason `forbidden-reason`, stage `h5`, before logout |
| Register | one `POST /api/v1/auth/register` `201` via IAM |
| Adult gate | one `POST /api/v1/iam/adult-gate` `200` via Gateway: `REJECTED`, `RESTRICTED`, evidence `REJECTED`, policy `b30-adult-v1`, `minimumAge` 18, `retryAllowed` true |
| Principal | `RESTRICTED`, adult `REJECTED`, access `RESTRICTED` |
| Writes | learning, target, and consent counts 0; `routeFulfillCount` 0; permissions endpoint not called by H5 |
| Logout | not reached; count 0 |
| Rendered title, description, logout | empty defaults, reason `other` |
| Cleanup in that receipt | `containerReleased` false; Java `signaled` 3, `reaped` 0, `remaining` 0, `unverified` 0 |
| Supervisor | `resume-20261107/forbidden-413-root`: preflight `PASS_PYTHON312`, result `FAIL_FORBIDDEN_REASON`; later `RELEASED_INDEPENDENTLY_VERIFIED`, ports free, owned container released |

The empty rendered fields are the observer defaults. `state.rendered` was assigned only after the adult-copy wait returned, and that wait timed out first. They are not evidence that the page was empty.

The post-gate request list is register, two principal reads, the adult gate, then one more `GET /api/v1/iam/principal/me` `200`. B139 `confirmAdultGate` does not refresh the token when the parsed gate is `REJECTED`. That last principal read fits a later refresh. It does not identify the visible title.

## Diagnosis

Age rejection does not intentionally remain on retry-capable onboarding.

The frozen B139 chunk `pages-onboarding-onboarding.C3Ku-KWi.js` navigates to `/pages/forbidden/forbidden` in three places: when the loaded session `adultGate` is `REJECTED` or the resume step is `rejected`; again after `confirmAdultGate` when `adultGate` is `REJECTED`; and again when the post-consent resume step is `rejected`. `retryAllowed` occurs in none of the 62 B139 JavaScript files. IAM can return `retryAllowed: true` and the bundle has no branch on it.

`session.B1jpN1ra.js` parses `status: REJECTED` and `learningAccess: RESTRICTED` into the string `REJECTED`. `confirmAdultGate` stores that string and returns false without a refresh. `index-CyPYQAYX.js` treats onboarding and learning paths, including `/pages/home/home`, as rejected-away and sends them to forbidden. Settings is account-only and is not that redirect.

The canonical adult copy is still in `_plugin-vue_export-helper.B5ssqoSF.js`: title `暂时无法开始学习`, description `当前版本仅向年满18周岁的用户开放学习。你仍可管理账号或查看帮助。`, logout `退出登录`. 435 keeps those three strings. It does not accept the unknown title `暂时无法确认访问状态` as the adult reason.

Because the product already auto-navigates, 435 does not hash a protected learning route and does not open `#/pages/forbidden/forbidden` by itself. Doing either would be changing the observation to fit a stay that the bundle does not implement. No product source was written.

Two code paths can still hide the adult copy. G413 did not record which one happened:

1. The onboarding chunk awaits `navigateTo` with no time bound. The forbidden page bounds a hung navigation at 4 seconds. If the onboarding promise never settles, the gate step stays busy and the forbidden view never becomes the adult DOM.
2. The forbidden chunk shows the adult copy only after `readCurrent` latches the same subject and revision and `adultGate` is `REJECTED`. Otherwise the title is `暂时无法确认访问状态`. Its revision watch returns early while that read is in flight, so a revision change during `refreshGateFromServer` can leave the owner unlatched. The logout control can still show `退出登录`.

435 records a closed surface, title, and path classification on every poll, including the read taken when a wait expires. The path is one of the B139 page paths with the query removed, or `other` / `unread`. Raw URL queries, HTML, secrets, and session ids are not stored. A later root run can show `onboarding-gate`, `forbidden` plus `unknown`, or `none` without treating a missing snapshot as an empty page.

The same auto-navigate exists in the current worktree `onboarding.vue`. That file was not the bundle G413 served, and this job does not claim the latest build was exercised.

## 435 behavior

One new disposable actor, prefix `g435-`, domain `example.invalid`. The G413 actor and cookie are not reused. The receipt scan rejects `g413-`, `G413!`, `g435-`, and `G435!`.

The browser still does one register, one adult-gate denial, one principal `RESTRICTED` read after the gate, the real adult forbidden DOM, and one logout click. `OBSERVED` still requires logout `200`, body status `REVOKED`, scope `CURRENT_SESSION_AND_TOKEN_FAMILY`, a cleared `yuxuexing_refresh` cookie, and the login title `欢迎回来`. Learning, target, and consent mutations stay 0. `routeFulfillCount` stays 0. Responses are not fulfilled and auth state is not injected. `REJECTED` still auto-navigates through the product guard. The observer does not open the forbidden route itself.

## Logout host

B139 `pages-forbidden-forbidden.DMhdvssv.js` puts `class:"forbidden-text"` on the logout component inside `class:"forbidden-exit"`. That component is helper export `N`, `name:"Button"`, and its render creates `uni-button`. A native `button` selector does not match it. The reload control also uses `forbidden-text`, outside `.forbidden-exit`.

The read, the count, and the click now use one host selector:

```text
.forbidden-exit button.forbidden-text:not([disabled]):not([aria-disabled="true"]), .forbidden-exit uni-button.forbidden-text:not([disabled]):not([aria-disabled="true"])
```

Exactly one of those hosts must be enabled and its text must be `退出登录`. Any other text, tag, disabled host, or second host does not count. 435 has still not run. The frozen copy at `resume-20261107/forbidden-435-pre-selector` was not modified.

## Cleanup accounting

The hold no longer treats `remaining == 0` as enough. `reap_settled` requires `remaining == 0`, `unverified == 0`, and `signaled <= reaped`. A signal without a verified exit is not a reap.

After the frozen cleanup returns, owned Java and probe processes are counted from their current `poll` state. An already exited process is `reaped` with no new signal. A process that is still alive is stopped with the world-repair-424 pattern: verified signal, wait, then `SIGKILL`, and `reaped` only after `poll` or `wait`. The frozen counters are kept on `javaReported` and `probeReported`. The hold reads the recounted `java` and `probe` values.

`containerReleased` stays the boolean returned by frozen `cleanup()`. A separate `containerFacts.currentReleased` is true only when the exact name `cloudstudy-mobile-forbidden-flow-435` is absent, the exact label `cloudstudy.qa.mobile-forbidden-flow-435` is absent, the identity is not ambiguous, and a stored container id is empty or inspects as absent. A Docker query failure leaves `currentReleased` false. No other project's containers are queried for removal. The 413 receipt field `containerReleased: false` is historical and remains false there.

Tail and Chrome use the same settled rule. Chrome signals are limited to children captured from this tail and to orphans whose command contains this job's scratch path.

## Offline checks this session

| Check | Result |
| --- | --- |
| Python 3.12 `ast` parse of the wrapper, pin JSON parse | `PARSE_OK` |
| `rebind_source()` only | rebound text has the 435 job, container, label, and marker; frozen G393 ids are absent |
| `reap_settled` / `cleanup_holds` | signaled 3 with reaped 0 does not hold; verified reaps can hold while `containerReleased` is still false |
| `node --check` observer and tail | exit 0 |
| Import observer and call `runObserverChecks()` | `OBSERVER_PREPARED`, `observed` false, `launched` false |
| Classification fixtures | adult, unknown, gate, and `/pages/home/home` query stripped; raw title text dropped |
| `lsof` TCP 18183 listen | no listener |
| Direct `node forbidden-h5-observer.mjs` and empty-stdin tail | not executed; the command runner refused those entrypoints |
| Wrapper `--preflight-only` or full lease | not run |

Selector repair checks, this session:

| Check | Result |
| --- | --- |
| `node --check` observer and tail | exit 0 |
| `runObserverChecks()` logout host fixtures and B139 `uni-button` / `forbidden-text` strings | `OBSERVER_PREPARED`, `observed` false, `launched` false |
| Live browser, Docker, JVM, listeners | not started |

Default `python3` on this machine is 3.9.6. Root runs the wrapper with `/Users/Admin/.local/bin/python3.12`.

## Root commands

Pins and process-free preflight, only after `13306`, `18070`, `18087`, and `18183` are free:

```text
/Users/Admin/.local/bin/python3.12 /tmp/grok-mobile-resume-forbidden-flow-435/forbidden-h5-wrapper.py --preflight-only
```

That writes `preflight.json` with `processesStarted` false. It does not write `lease-receipt.json`.

Full serialized run, once:

```text
/Users/Admin/.local/bin/python3.12 /tmp/grok-mobile-resume-forbidden-flow-435/forbidden-h5-wrapper.py
```

Exit 0 is `PREFLIGHT` or `OBSERVED` with cleanup. Exit 2 is a closed pin, argv, replay, or scratch refusal. Exit 1 is any other failure. An observer `OBSERVED` with incomplete cleanup stays a failed lease.

## Identity

| Item | Value |
| --- | --- |
| Derived job id | `MB005-H5-FORBIDDEN-435` |
| Frozen G393 `JOB_ID` before rebind | `MB005-G393-canonical-node-entry` |
| Worktree HEAD pin | `61b9ede7c65ef065c76c846c27fb69a52cd042cd` |
| B139 index SHA-256 | `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32` |
| Container | `cloudstudy-mobile-forbidden-flow-435` |
| Label | `cloudstudy.qa.scope=cloudstudy.qa.mobile-forbidden-flow-435` |
| Ports | `13306`, `18070`, `18087`, `18183` |

Gateway modes for `LEARNER`, `CONTENT`, `LEARNING`, `ASSESSMENT`, `MEDIA`, `GAMIFICATION`, `SOCIAL`, and `COMMERCE` are `LEGACY`. Register stays on IAM `18087`. Adult gate, principal, and logout stay on Gateway `18070`. No domain service process is started.

If cleanup is incomplete, root may remove only:

```text
docker --context desktop-linux rm -f cloudstudy-mobile-forbidden-flow-435
rm -rf /tmp/grok-mobile-resume-forbidden-flow-435/scratch
```

Confirm the label before `rm`. Do not delete the 435 scripts, the 413 tree, frozen G378/G384/G393/G388 trees, or unrelated Java.

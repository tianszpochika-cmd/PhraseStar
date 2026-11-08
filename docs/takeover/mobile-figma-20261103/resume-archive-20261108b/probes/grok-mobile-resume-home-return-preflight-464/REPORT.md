# G464 preflight

Status: `PREPARED_NOT_RUN`.

G454 reached the harness preflight and stopped there. The business journey is `NOT_RUN`. No actor completed. All eight serialized ports were released. This directory is a fresh candidate. It does not retry that lease and it does not loosen the run-directory guard.

## G454 failure, left unchanged

Receipts under `.../resume-20261108b/home-454-root/`:

- `EXIT.json`: exit 1 at `2026-11-08T14:31:06.633474+00:00`, `candidateSourceStable` true.
- `result.json`: `status` FAIL, `preflightStatus` FAIL, head `61b9ede7c65ef065c76c846c27fb69a52cd042cd`.
- `INDEPENDENT-RELEASE.json`: `harnessPreflight` `FAIL_RUN_DIRECTORY_GUARD`, `businessJourney` `NOT_RUN`, `ownedLabelAbsent` true, ports 13306, 18070, 18087, 18088, 18089, 18090, 18091, and 18183 free.
- `/private/tmp/grok-mobile-resume-home-return-454/run/runner.log`: `FAIL harness.preflight` and `MB033_RUN_DIRECTORY must be the exact root artifact directory for the selected mode; no fallback`.

The wrapper set `MB033_RUN_DIRECTORY` to `/private/tmp/grok-mobile-resume-home-return-454/run`. The untouched G405 staged harness still required `/private/tmp/grok-mobile-resume-home-405/run` in `full-browser-owner.mjs` `FULL_BROWSER_ROOT_ARTIFACT_DIR` and in the acceptance `expectedLiteral`. Those two strings differed, so the no-fallback check failed closed before Chrome and before a fresh actor.

The completed G405 home-return receipt stays `FAILED` / `final-hash` / final hash `/`. Its SHA-256 is `dc830241b321dddc9c6532ef888acad3bfc6c91eff548621a046777ce716b126`. G454 artifact hashes are in `PROVENANCE.json`. The stage check hashed them at start and end and they matched.

## What G464 binds

One canonical run directory: `/private/tmp/grok-mobile-resume-home-return-464/run`.

The stage check did not create that directory. Root creates it, mode `0700`, immediately before the lease.

| Piece | Value |
| --- | --- |
| Job | `MB464_FRESH_ACTOR_HOME_RETURN` |
| Container | `cloudstudy-mobile-home-return-464-20261108` |
| Label | `cloudstudy.qa.mobile-home-return-464-20261108` |
| Lease | `G464_ROOT_LEASE=YES_RUN_G464_HOME_RETURN` |
| Arm | `MB464_HOME_RETURN=YES_ONE_FRESH_ACTOR_HOME_RETURN` |
| Harness source | `/tmp/grok-mobile-resume-home-return-preflight-464/staged-harness` |
| Actor | minted by `acceptance-learner-target.mjs` as `mb004-${runId}@example.invalid` plus `Mb004!` and 24 random bytes |

`MB006_PLACEMENT_RETEST_CONTINUATION` stays unset. The retest root `/private/tmp/grok-mobile-placement-retest-canonical-macos-run-372/run` is still in the harness (4 occurrences before and after). A child import with that opt-in still exports the 372 directory. The G464 wrapper exits 2 if the variable is set, so the home-return lease uses the 464 directory.

## Oracle kept

`oracle.cjs` from `const HOME_ALIAS` onward is byte-identical to the G454 oracle.

Pass requires final hash `/`, three identical samples, entry path `/`, alias `/pages/home/home`, one entry, tab index 0, title `学习`, top route `pages/home/home`, visible `.home-page` and `.home-title`, login hidden, real `ELIGIBLE` / `PASSED`, home `READY`, placement `COMPLETED`, and the same plan version. Alias hash `/pages/home/home` fails `hash-not-entry-path`. The historical G405 receipt still fails `entry-proof-missing` under this rule, and the original G405 rule still returns `final-hash`.

The full-browser owner still requires target PUT count 1, ten answers, one plan ensure, and `retestWrites === 0` when retest is off. The observer still requires ten responses and one ensure before it looks at home. The wrapper still expects ten assessment responses, one plan at version 2, and ten learning tasks. Jar SHAs and the B139 index SHA `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32` are unchanged. Rejected index `94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520` is still rejected.

## Path rebind

The staged copy differs from `/tmp/grok-mobile-resume-home-405/staged-harness` only by replacing `/private/tmp/grok-mobile-resume-home-405/run` with `/private/tmp/grok-mobile-resume-home-return-464/run`.

| File | Role | Old count | New count | After SHA-256 |
| --- | --- | --- | --- | --- |
| `full-browser-owner.mjs` | `HISTORICAL_FULL_BROWSER_ROOT`, exported as `FULL_BROWSER_ROOT_ARTIFACT_DIR` when retest is off | 1 | 1 | `ea6643869b0e6118d1e7a3182f9ee73eb4f556a919fd802e19787069f5fe45f6` |
| `learner-target-probe.mjs` | local const, not exported; `fullBrowserRootDirectory()` returns it | 1 | 1 | `b51f9b2cf57a7c56ae2a9b0fe0dad4aa75f0f0af484651de00096787117ec2b1` |
| `acceptance-learner-target.mjs` | non-retest `expectedLiteral` and the matching markdown sentence | 2 | 2 | `55a14ce76190b20a6c7005529a8c325929f8f6a9c6c36587a31ec5784b6bd4a4` |

Cardinality: old path 4 before, 0 after, new path 4 after. The other eight harness files keep the G405 staged SHA-256 values recorded in `HASH-MANIFEST.json`. Before SHAs of the three edited files match those same G405 pins.

Live imports, with retest unset, agreed on `/private/tmp/grok-mobile-resume-home-return-464/run`:

- `full-browser-owner.mjs` export `FULL_BROWSER_ROOT_ARTIFACT_DIR`
- the probe source const
- the acceptance non-retest `expectedLiteral`

`learner-target-probe.mjs` exports only `PLACEMENT_BROWSER_ROOT_ARTIFACT_DIR` and `runLearnerTargetProbe`. It does not export the full-browser root. `browser-target-probe.cjs` exports `runConsentBrowserSmoke` and `runTargetBrowser`. The reviewed signature is `runTargetBrowser({ identifier, password, caPem, outDir, placement = false, placementArtifact, placementIndexSha, full = false, fullArtifact, fullIndexSha, retestContinuation = false })`.

`callbackOptions()` was called against the existing B139 directory. It returned exactly `full`, `fullArtifact`, `fullIndexSha`, in that order. `full` is true. `fullArtifact` is the B139 root. `fullIndexSha` is `706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32`. `retestContinuation` is absent. No browser, database, or listener was started for that call.

Placement, learning, and owner export names match the source `export` lines, including `withFullBrowserServices(input = {}, task)`. Those service starters were not called.

The private-mode and symlink predicates remain in the acceptance and probe sources. A mode `0777` directory fails the `mode & 0o077` check. A symlink fails the canonical check. The wrapper still checks mode `700`, `test ! -L`, and `realpath` on the lease path, after the early refusals and after the git read that only the lease reaches.

## Exact Root command

```sh
install -d -m 700 /private/tmp/grok-mobile-resume-home-return-464/run
G464_ROOT_LEASE=YES_RUN_G464_HOME_RETURN \
  bash /tmp/grok-mobile-resume-home-return-preflight-464/candidate/wrapper.sh
```

Leave `MB006_PLACEMENT_RETEST_CONTINUATION` unset. Do not pass a second or third argument. The wrapper pins the harness to the rebound directory above and pins `MB033_RUN_DIRECTORY` to the 464 run directory. It refuses both G405 run directories, both G454 run directories, any other directory, a symlink, a different harness source, and a missing lease. Those refusals run before `git -C` and before `docker run`.

## Offline checks

| Command | Exit | Result |
| --- | --- | --- |
| `node .../candidate/oracle-offline-check.cjs` | 0 | `OFFLINE_PASS`, 34 checks. Historical receipt stays `final-hash`. Upgraded rule on that receipt is `entry-proof-missing`. Alias hash is `hash-not-entry-path`. |
| `bash .../candidate/wrapper.sh --offline` | 0 | Same `OFFLINE_PASS` body. |
| `bash .../candidate/wrapper.sh --stage-only` | 0 | `STAGE_PASS`, 92 checks. Root, exports, callback keys, and module paths agree. |
| `bash .../candidate/wrapper.sh` with no lease | 2 | `REFUSING: G464 runtime requires Root lease G464_ROOT_LEASE=YES_RUN_G464_HOME_RETURN.` |

Stage-only rejections, each exit 2, from `checks/stage-only.json`:

- missing `G464_ROOT_LEASE`
- `MB006_PLACEMENT_RETEST_CONTINUATION` set
- symlink run directory
- `/private/tmp/grok-mobile-resume-home-405/run`
- `/tmp/grok-mobile-resume-home-405/run`
- `/private/tmp/grok-mobile-resume-home-return-454/run`
- an arbitrary mode `0700` directory
- a harness source other than the rebound copy

Logs are in `checks/`. `HASH-MANIFEST.json`, `PATH-REBIND.json`, and `PROVENANCE.json` record the closure. Source provenance for the G454 candidate and the untouched G405 harness is in `PROVENANCE.json`.

## Limits

No Docker, Java, browser, listener, actor, or git command ran. The worktree was not modified. Source head `61b9ede7c65ef065c76c846c27fb69a52cd042cd` is the pin carried from the G454 result, not a new git read. This prepare step does not say the Root lease passed.

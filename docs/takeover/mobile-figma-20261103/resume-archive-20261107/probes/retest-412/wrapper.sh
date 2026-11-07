#!/bin/bash
# Identity 412 same-key placement retest replay.
# Stages frozen G372 files, overlays the replay seam, then execs that wrapper.
# This file does not edit frozen trees. Root creates the run directory first.
set -euo pipefail

job='/private/tmp/grok-mobile-resume-retest-replay-412'
g372='/tmp/grok-mobile-placement-retest-canonical-macos-run-372'
harness="$g372/run/harness"
run="$job/run"
stage="$job/staged"
b139_h5='/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5'
b139_sha='706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32'
repo_commit='61b9ede7c65ef065c76c846c27fb69a52cd042cd'

if [ "$(cd "$(dirname "$0")" && pwd -P)" != "$job" ]; then
  printf '%s\n' 'REFUSING: wrapper must stay in the canonical 412 directory' >&2
  exit 2
fi
if [ "${MB006_PLACEMENT_RETEST_CONTINUATION:-}" != 'MB006_PLACEMENT_RETEST_CONTINUATION' ]; then
  printf '%s\n' 'REFUSING: MB006_PLACEMENT_RETEST_CONTINUATION must be exact' >&2
  exit 2
fi
if [ "${MB006_PLACEMENT_RETEST_REPLAY:-}" != 'MB006_PLACEMENT_RETEST_REPLAY' ]; then
  printf '%s\n' 'REFUSING: MB006_PLACEMENT_RETEST_REPLAY must be exact' >&2
  exit 2
fi
if [ "$#" -ne 5 ]; then
  printf '%s\n' 'REFUSING: repo, learner jar, content jar, assessment jar, learning jar' >&2
  exit 2
fi

qa_repo="$1"
qa_learner_jar="$2"
qa_content_jar="$3"
qa_assessment_jar="$4"
qa_learning_jar="$5"

test "$(git -C "$qa_repo" rev-parse HEAD)" = "$repo_commit"
test -z "$(git -C "$qa_repo" status --porcelain)"
test -d "$run"
test ! -L "$run"
test "$(cd "$run" && pwd -P)" = "$run"
test ! -e "$run/harness"
test -f "$b139_h5/index.html"
test "$(shasum -a 256 "$b139_h5/index.html" | awk '{print $1}')" = "$b139_sha"
test ! -e "$stage"

for required in \
  "$g372/wrapper.sh" \
  "$g372/acceptance-learner-target.mjs" \
  "$g372/learner-target-probe.mjs" \
  "$g372/browser-target-probe.cjs" \
  "$g372/placement-start-read.mjs" \
  "$harness/learning-plan-ensure.mjs" \
  "$harness/process_guard.py" \
  "$harness/seed/Seed.java" \
  "$harness/sql/seed-full.sql" \
  "$harness/sql/seed-partial.sql" \
  "$harness/sql/cleanup-fixtures.sql" \
  "$job/full-browser-owner.mjs" \
  "$job/placement-retest-same-key-replay.cjs" \
  "$job/apply-replay-seam.mjs"
do
  test -f "$required"
  test ! -L "$required"
done

mkdir -m 0700 "$stage"
cp "$g372/wrapper.sh" "$g372/acceptance-learner-target.mjs" "$g372/learner-target-probe.mjs" \
  "$g372/browser-target-probe.cjs" "$g372/placement-start-read.mjs" "$stage/"
cp "$harness/learning-plan-ensure.mjs" "$harness/process_guard.py" "$stage/"
cp -R "$harness/seed" "$harness/sql" "$stage/"
cp "$job/full-browser-owner.mjs" "$job/placement-retest-same-key-replay.cjs" "$stage/"
node "$job/apply-replay-seam.mjs" "$stage"

exec bash "$stage/wrapper.sh" \
  "$qa_repo" \
  "$stage" \
  "$run" \
  "$qa_learner_jar" \
  "$qa_content_jar" \
  "$qa_assessment_jar" \
  "$qa_learning_jar" \
  "$b139_h5" \
  "$b139_sha"

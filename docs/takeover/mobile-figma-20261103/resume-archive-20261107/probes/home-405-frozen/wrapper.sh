#!/bin/bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
if [ "${1:-}" = '--preflight-only' ]; then
  node "$here/preflight.cjs"
  exit
fi
if [ -n "${MB006_PLACEMENT_RETEST_CONTINUATION:-}" ]; then
  printf '%s\n' 'REFUSING: MB006_PLACEMENT_RETEST_CONTINUATION must be unset for the 405 home-return lease.'
  exit 2
fi
qa_repo="${1:-/Users/Admin/.codex/worktrees/mobile-resume-reference-20261107/cloudstudy}"
qa_source="${2:-$here/staged-harness}"
qa_out="${3:-/private/tmp/grok-mobile-resume-home-405/run}"
qa_learner_jar="${4:-/Users/Admin/.codex/worktrees/mobile-figma-integration-20261103/cloudstudy/services/learner-service/target/learner-service-0.1.0-SNAPSHOT.jar}"
qa_content_jar="${5:-/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-content-owner-b118-package/content-service-b118.jar}"
qa_assessment_jar="${6:-/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-assessment-combined-b122-root/assessment-protected-reading-combined.jar}"
qa_learning_jar="${7:-/Users/Admin/.codex/worktrees/mobile-figma-integration-20261103/cloudstudy/services/learning-service/target/learning-service-0.1.0-SNAPSHOT.jar}"
qa_h5_artifact="${8:-/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5}"
qa_h5_sha="${9:-706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32}"
qa_learning_sha='5eff984611443d2cf842eb5887fdabc160c4c87faff5fd77c471ab510d0a444f'
qa_learner_sha='62b9dda75ec2547a32ef55b99fe6821fdcfe4e65841bf77d54e28289fc5c4733'
qa_content_sha='852578df43b40fdc45569a6e60c074c3561c0b43bf8e7bd6b8acafd51e2f3eb2'
qa_assessment_sha='467fb91b9299c0569f48d52b482be580a18b6a9b90bd74aa523659e16fed6912'
qa_head='61b9ede7c65ef065c76c846c27fb69a52cd042cd'
qa_name='cloudstudy-mobile-home-return-405-20261107'
qa_label='cloudstudy.qa.mobile-home-return-405-20261107'
qa_run_root='/private/tmp/grok-mobile-resume-home-405/run'
qa_b139_h5='/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5'
qa_b139_sha='706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32'
qa_id=''
qa_env=''
qa_scratch=''
umask 077

cleanup() {
  local result=$?
  trap - EXIT
  if [ -n "$qa_id" ]; then
    local actual
    actual="$(docker inspect -f '{{index .Config.Labels "cloudstudy.qa.scope"}}' "$qa_id" 2>/dev/null || true)"
    if [ "$actual" = "$qa_label" ]; then
      docker stop --timeout 8 "$qa_id" > "$qa_out/container-stop.log" 2>&1 || true
    fi
  fi
  if [ -n "$qa_env" ]; then rm -f -- "$qa_env"; fi
  for ((cleanup_attempt=1; cleanup_attempt<=20; cleanup_attempt++)); do
    [ -z "$(docker ps -aq --filter "label=cloudstudy.qa.scope=$qa_label")" ] && break
    sleep 0.25
  done
  {
    for port in 18070 18087 18088 18089 18090 18091 18183 13306; do
      if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
        printf 'PORT_%s_OCCUPIED\n' "$port"
        result=1
      else
        printf 'PORT_%s_RELEASED\n' "$port"
      fi
    done
    if [ -n "$(docker ps -aq --filter "label=cloudstudy.qa.scope=$qa_label")" ]; then
      printf 'TEMP_DB_STILL_PRESENT\n'
      result=1
    else
      printf 'TEMP_DB_RELEASED\n'
    fi
  } > "$qa_out/cleanup-status.log"
  if [ -n "$qa_scratch" ] && [ -d "$qa_scratch" ] && [ ! -L "$qa_scratch" ]; then
    for qa_private_run in "$qa_scratch"/dsh-mb033-b72-* "$qa_scratch"/dsh-mb004-b72-*; do
      if [ -d "$qa_private_run" ] && [ ! -L "$qa_private_run" ] && [ -d "$qa_private_run/tls" ]; then
        rm -rf -- "$qa_private_run/tls"
      fi
    done
    if find "$qa_scratch" -type d -name tls -print -quit | rg -q .; then
      printf 'TEMP_TLS_STILL_PRESENT\n' >> "$qa_out/cleanup-status.log"
      result=1
    else
      printf 'TEMP_TLS_RELEASED\n' >> "$qa_out/cleanup-status.log"
    fi
  fi
  if [ -n "$qa_scratch" ] && [ -d "$qa_scratch" ] && [ ! -L "$qa_scratch" ]; then
    case "$qa_scratch" in
      /tmp/cloudstudy-mobile-placement-qa.*) rm -rf -- "$qa_scratch" ;;
      *) result=1 ;;
    esac
  fi
  if [ -n "$qa_scratch" ] && [ -e "$qa_scratch" ]; then
    printf 'PRIVATE_SCRATCH_STILL_PRESENT\n' >> "$qa_out/cleanup-status.log"
    result=1
  else
    printf 'PRIVATE_SCRATCH_RELEASED\n' >> "$qa_out/cleanup-status.log"
  fi
  exit "$result"
}

node "$here/pin-rebind.cjs" > "$here/pin-rebind.json"
node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(j.status!=="STAGED") process.exit(2)' "$here/pin-rebind.json"
qa_source="$here/staged-harness"
test -d "$qa_out"
test "$qa_out" = "$qa_run_root"
test "$qa_h5_artifact" = "$qa_b139_h5"
test "$qa_h5_sha" = "$qa_b139_sha"
[[ "$qa_h5_artifact" = /* && "$qa_h5_sha" =~ ^[0-9a-f]{64}$ ]]
test -f "$qa_h5_artifact/index.html"
test "$(shasum -a 256 "$qa_h5_artifact/index.html" | awk '{print $1}')" = "$qa_h5_sha"
test "$qa_h5_sha" != '94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520'
test ! -e "$qa_out/harness"
test "$(git -C "$qa_repo" rev-parse HEAD)" = "$qa_head"
test -z "$(git -C "$qa_repo" status --porcelain)"
listed_mode="$(stat -f '%Lp' "$qa_out" 2>/dev/null || stat -c '%a' "$qa_out")"
test "$listed_mode" = '700'
test ! -L "$qa_out"
test "$(python3 -c 'import os,sys; p=sys.argv[1]; print(os.path.realpath(p)==p)' "$qa_out")" = 'True'
for port in 18070 18087 18088 18089 18090 18091 18183 13306; do
  test -z "$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
done
test -z "$(docker ps -aq --filter "label=cloudstudy.qa.scope=$qa_label")"
test -z "$(docker ps -aq --filter "name=^/$qa_name$")"
test -f "$qa_learner_jar"
test "$(shasum -a 256 "$qa_learner_jar" | awk '{print $1}')" = "$qa_learner_sha"
node --check "$qa_source/acceptance-learner-target.mjs"
node --check "$qa_source/learner-target-probe.mjs"
node --check "$qa_source/placement-start-read.mjs"
node --check "$qa_source/learning-plan-ensure.mjs"
node --check "$qa_source/full-browser-owner.mjs"
node --check "$qa_source/browser-target-probe.cjs"
node --check "$here/home-return-observer.cjs"
node --check "$here/home-return-hook.cjs"
node --check "$here/pin-rebind.cjs"
node --check "$here/preflight.cjs"
test "$(shasum -a 256 "$qa_learning_jar" | awk '{print $1}')" = "$qa_learning_sha"
test "$(shasum -a 256 "$qa_content_jar" | awk '{print $1}')" = "$qa_content_sha"
test "$(shasum -a 256 "$qa_assessment_jar" | awk '{print $1}')" = "$qa_assessment_sha"
if rg -n "gatewayRequest\\(['\\\"]/auth/(login|register|token/refresh)" "$qa_source/acceptance-learner-target.mjs"; then
  exit 2
fi
mkdir "$qa_out/harness"
cp "$qa_source/acceptance-learner-target.mjs" "$qa_source/learner-target-probe.mjs" "$qa_source/placement-start-read.mjs" "$qa_source/learning-plan-ensure.mjs" "$qa_source/full-browser-owner.mjs" "$qa_source/browser-target-probe.cjs" "$qa_source/process_guard.py" "$qa_out/harness/"
cp -R "$qa_source/seed" "$qa_source/sql" "$qa_out/harness/"
(cd "$qa_out/harness" && find . -type f -print0 | xargs -0 shasum -a 256) > "$qa_out/harness-sha256.txt"
(cd "$qa_repo" && node scripts/check-fixed-ports.mjs) > "$qa_out/fixed-ports-before.log"
docker image inspect -f '{{.Id}}' mysql:8.0 > "$qa_out/image.log"

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
qa_root_secret="$(openssl rand -hex 18)"
qa_user_secret="$(openssl rand -hex 18)"
qa_env="$(mktemp "$qa_out/.mysql-env.XXXXXXXX")"
printf 'MYSQL_ROOT_PASSWORD=%s\nMYSQL_DATABASE=iam_service\nMYSQL_USER=iam_mobile_http_probe\nMYSQL_PASSWORD=%s\n' "$qa_root_secret" "$qa_user_secret" > "$qa_env"
unset qa_root_secret
qa_id="$(docker run --pull=never --rm --detach --name "$qa_name" --label "cloudstudy.qa.scope=$qa_label" --cpus=1 --memory=768m --tmpfs /var/lib/mysql:rw,nosuid,size=512m --env-file "$qa_env" -p 127.0.0.1:13306:3306 mysql:8.0 --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --innodb-buffer-pool-size=64M --max-connections=40 --performance-schema=OFF)"
rm -f -- "$qa_env"
qa_env=''
printf '%s\n' "$qa_id" > "$qa_out/container-id.log"
qa_ready=0
for ((attempt=1; attempt<=60; attempt++)); do
  if docker exec "$qa_id" sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --protocol=TCP --host=127.0.0.1 --user="$MYSQL_USER" "$MYSQL_DATABASE" --batch --skip-column-names -e "SELECT 1"' >/dev/null 2>&1; then
    qa_ready=1
    break
  fi
  sleep 1
done
test "$qa_ready" = 1
test "$(docker inspect -f '{{index .Config.Labels "cloudstudy.qa.scope"}}' "$qa_id")" = "$qa_label"
qa_learner_secret="$(openssl rand -hex 18)"
[[ "$qa_learner_secret" =~ ^[0-9a-f]{36}$ ]]
{
  printf '%s\n' 'CREATE DATABASE learner_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
  printf "CREATE USER 'learner_mobile_target_probe'@'%%' IDENTIFIED BY '%s';\n" "$qa_learner_secret"
  printf '%s\n' "GRANT ALL PRIVILEGES ON learner_service.* TO 'learner_mobile_target_probe'@'%';"
} | docker exec -i "$qa_id" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket --user=root --batch --skip-column-names' >/dev/null 2>&1
qa_scope_suffix="$(openssl rand -hex 5)"
[[ "$qa_scope_suffix" =~ ^[0-9a-f]{10}$ ]]
qa_content_schema="mb006_cnt_$qa_scope_suffix"
qa_assessment_schema="mb006_asm_$qa_scope_suffix"
qa_content_user="mb006c_$qa_scope_suffix"
qa_assessment_user="mb006a_$qa_scope_suffix"
qa_content_secret="$(openssl rand -hex 18)"
qa_assessment_secret="$(openssl rand -hex 18)"
[[ "$qa_content_secret" =~ ^[0-9a-f]{36}$ && "$qa_assessment_secret" =~ ^[0-9a-f]{36}$ ]]
{
  printf 'CREATE DATABASE %s CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n' "$qa_content_schema" "$qa_assessment_schema"
  printf "CREATE USER '%s'@'%%' IDENTIFIED BY '%s';\n" "$qa_content_user" "$qa_content_secret" "$qa_assessment_user" "$qa_assessment_secret"
  printf "GRANT ALL PRIVILEGES ON %s.* TO '%s'@'%%';\n" "$qa_content_schema" "$qa_content_user" "$qa_assessment_schema" "$qa_assessment_user"
} | docker exec -i "$qa_id" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket --user=root --batch --skip-column-names' >/dev/null 2>&1
qa_learning_schema="mb007_lrn_$qa_scope_suffix"
qa_learning_user="mb007l_$qa_scope_suffix"
qa_learning_secret="$(openssl rand -hex 18)"
[[ "$qa_learning_secret" =~ ^[0-9a-f]{36}$ ]]
{
  printf 'CREATE DATABASE %s CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n' "$qa_learning_schema"
  printf "CREATE USER '%s'@'%%' IDENTIFIED BY '%s';\n" "$qa_learning_user" "$qa_learning_secret"
  printf "GRANT ALL PRIVILEGES ON %s.* TO '%s'@'%%';\n" "$qa_learning_schema" "$qa_learning_user"
} | docker exec -i "$qa_id" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket --user=root --batch --skip-column-names' >/dev/null 2>&1
printf "SELECT schema_name, default_collation_name FROM information_schema.schemata WHERE schema_name IN ('iam_service','learner_service','%s','%s','%s') ORDER BY schema_name;\n" "$qa_content_schema" "$qa_assessment_schema" "$qa_learning_schema" |
  docker exec -i "$qa_id" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket --user=root --batch --skip-column-names' > "$qa_out/schema-collations.tsv"
test "$(awk '$2=="utf8mb4_unicode_ci" {n++} END {print n+0}' "$qa_out/schema-collations.tsv")" = 5
printf '%s\n' 'TEMP_DB_READY_WITH_FIVE_DISTINCT_OWNER_SCHEMAS' > "$qa_out/database-readiness.log"
qa_scratch="$(mktemp -d /tmp/cloudstudy-mobile-placement-qa.XXXXXXXX)"
printf '%s\n' "$qa_scratch" > "$qa_out/scratch-path.log"
qa_client_secret="$(openssl rand -hex 24)"
qa_client_digest="$(printf '%s' "$qa_client_secret" | shasum -a 256 | awk '{print $1}')"
[[ "$qa_client_digest" =~ ^[0-9a-f]{64}$ ]]
qa_score_secret="$(openssl rand -hex 24)"
qa_score_digest="$(printf '%s' "$qa_score_secret" | shasum -a 256 | awk '{print $1}')"
[[ "$qa_score_secret" =~ ^[0-9a-f]{48}$ && "$qa_score_digest" =~ ^[0-9a-f]{64}$ ]]
test "$qa_score_secret" != "$qa_client_secret"
unset MB006_PLACEMENT_START_READ MB006_PLACEMENT_CHECKPOINT MB006_PLACEMENT_COMPLETION MB007_LEARNING_PLAN_ENSURE MB006_ACCESS_TOKEN MB007_ACCESS_TOKEN ASSESSMENT_PLACEMENT_SCORE_TOKEN ASSESSMENT_PLACEMENT_SCORE_SERVICE_TOKEN MB006_PLACEMENT_RETEST_CONTINUATION
qa_node_status=0
TMPDIR="$qa_scratch" \
MB405_HOME_RETURN=YES_ONE_SAME_ACTOR_HOME_RETURN \
MB405_HOME_RETURN_RECEIPT="$qa_out/home-return-receipt.json" \
NODE_OPTIONS="--require $here/home-return-hook.cjs" \
MB004_TARGET_BROWSER_PROBE=YES_LOCAL_H5_TARGET_SMOKE \
MB006_PLACEMENT_BROWSER=MB006_PLACEMENT_BROWSER \
MB006_PLACEMENT_FULL_BROWSER=MB006_PLACEMENT_FULL_BROWSER \
MB006_FULL_BROWSER_ARTIFACT="$qa_h5_artifact" \
MB006_FULL_BROWSER_INDEX_SHA256="$qa_h5_sha" \
MB007_LEARNING_JAR="$qa_learning_jar" \
MB007_LEARNING_JAR_SHA256="$qa_learning_sha" \
MB007_LEARNING_SCHEMA="$qa_learning_schema" \
MB007_LEARNING_JDBC_URL="jdbc:mysql://127.0.0.1:13306/$qa_learning_schema?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true" \
MB007_LEARNING_JDBC_USERNAME="$qa_learning_user" \
MB007_LEARNING_JDBC_PASSWORD="$qa_learning_secret" \
IAM_SERVICE_CLIENT_ASSESSMENT_SECRET_DIGEST="$qa_score_digest" \
ASSESSMENT_PLACEMENT_SCORE_CLIENT_SECRET="$qa_score_secret" \
ASSESSMENT_PLACEMENT_SCORE_IAM_BASE_URL=https://127.0.0.1:18087 \
ASSESSMENT_PLACEMENT_SCORE_CLIENT_ID=assessment-service \
ASSESSMENT_PLACEMENT_SCORE_CONTENT_BASE_URL=http://127.0.0.1:18089 \
MB006_CONTENT_JAR="$qa_content_jar" \
MB006_CONTENT_JAR_SHA256="$qa_content_sha" \
MB006_ASSESSMENT_JAR="$qa_assessment_jar" \
MB006_ASSESSMENT_JAR_SHA256="$qa_assessment_sha" \
MB006_CONTENT_SCHEMA="$qa_content_schema" \
MB006_CONTENT_JDBC_URL="jdbc:mysql://127.0.0.1:13306/$qa_content_schema?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true" \
MB006_CONTENT_JDBC_USERNAME="$qa_content_user" \
MB006_CONTENT_JDBC_PASSWORD="$qa_content_secret" \
MB006_ASSESSMENT_SCHEMA="$qa_assessment_schema" \
MB006_ASSESSMENT_JDBC_URL="jdbc:mysql://127.0.0.1:13306/$qa_assessment_schema?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true" \
MB006_ASSESSMENT_JDBC_USERNAME="$qa_assessment_user" \
MB006_ASSESSMENT_JDBC_PASSWORD="$qa_assessment_secret" \
MB033_LEARNER_TARGET_PROBE=YES_RUN_MB033_LEARNER_TARGET_PROBE \
MB033_RUN_DIRECTORY="$qa_out" \
MB033_LEARNER_JAR="$qa_learner_jar" \
MB033_LEARNER_JAR_SHA256="$qa_learner_sha" \
MB033_LEARNER_JDBC_URL='jdbc:mysql://127.0.0.1:13306/learner_service?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true' \
MB033_LEARNER_SCHEMA=learner_service \
MB033_LEARNER_JDBC_USERNAME=learner_mobile_target_probe \
MB033_LEARNER_JDBC_PASSWORD="$qa_learner_secret" \
IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST="$qa_client_digest" \
LEARNER_CONSENT_RECHECK_ENABLED=true \
LEARNER_CONSENT_RECHECK_IAM_BASE_URL=https://127.0.0.1:18087 \
LEARNER_CONSENT_RECHECK_CLIENT_ID=learner-service \
LEARNER_CONSENT_RECHECK_CLIENT_SECRET="$qa_client_secret" \
MB004_RUN_APPROVAL=YES_RUN_MB004_LOCAL_ACCEPTANCE \
MB004_MYSQL_DISPOSABLE=YES_DISPOSABLE_MYSQL_13306_IAM_SERVICE \
MB004_MYSQL_USER=iam_mobile_http_probe \
MB004_MYSQL_PASSWORD="$qa_user_secret" \
python3 "$qa_out/harness/process_guard.py" --receipt "$qa_out/process-guard.json" --timeout 660 -- node "$qa_out/harness/acceptance-learner-target.mjs" --mode run --repo "$qa_repo" --out "$qa_out/result.json" --report "$qa_out/REPORT.md" > "$qa_out/runner.log" 2>&1 || qa_node_status=$?
unset qa_user_secret qa_learner_secret qa_client_secret qa_client_digest qa_content_secret qa_assessment_secret qa_score_secret qa_score_digest qa_learning_secret
printf '%s\n' "$qa_node_status" > "$qa_out/runner-exit.log"
qa_assessment_sql_status=0
qa_learning_sql_status=0
test "$(docker inspect -f '{{index .Config.Labels "cloudstudy.qa.scope"}}' "$qa_id")" = "$qa_label"
{
  printf "SELECT 'content_bank', COUNT(*), MIN(placement_item_id), MAX(placement_item_id), MIN(content_version_id), MAX(content_version_id) FROM %s.content_placement_item WHERE bank_code='P1_PLACEMENT_V1';\n" "$qa_content_schema"
  printf "SELECT 'assessment_session', COUNT(*), MIN(status), MIN(state_version), MIN(current_sequence) FROM %s.p1_placement_session;\n" "$qa_assessment_schema"
  printf "SELECT 'assessment_responses', COUNT(*), MIN(item_sequence), MAX(item_sequence), MIN(item_id), MAX(item_id), SUM(correct IN (0,1)) FROM %s.p1_placement_response;\n" "$qa_assessment_schema"
  printf "SELECT 'assessment_checkpoint', COUNT(*), MIN(state_version), MAX(state_version), MIN(next_sequence), MAX(next_sequence), SUM(CHAR_LENGTH(checkpoint_digest)=64) FROM %s.p1_placement_checkpoint;\n" "$qa_assessment_schema"
  printf "SELECT 'assessment_result', COUNT(*), MIN(result_kind), MIN(JSON_LENGTH(JSON_EXTRACT(report_json, '$.outcomes'))) FROM %s.p1_placement_result;\n" "$qa_assessment_schema"
  printf "SELECT 'assessment_idempotency', COUNT(*), SUM(operation='CREATE'), SUM(operation='RESPONSE') FROM %s.p1_placement_idempotency;\n" "$qa_assessment_schema"
} | docker exec -i "$qa_id" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket --user=root --batch --skip-column-names' > "$qa_out/owner-db-facts.tsv" 2> "$qa_out/assessment-owner-db-read.stderr" || qa_assessment_sql_status=$?
printf 'content_bank\t10\t266001\t266010\t266100\t266100\nassessment_session\t1\tCOMPLETED\t11\t11\nassessment_responses\t10\t1\t10\t266001\t266010\t10\nassessment_checkpoint\t10\t2\t11\t2\t11\t10\nassessment_result\t1\tASSESSED\t10\nassessment_idempotency\t11\t1\t10\n' > "$qa_out/expected-db-facts.tsv"
{
  printf "SELECT 'learning_plan', COUNT(*), MIN(status), MIN(daily_quota_minutes), MIN(content_version_id), MIN(content_epoch), MIN(plan_version) FROM %s.learning_runtime_plan;\n" "$qa_learning_schema"
  printf "SELECT 'learning_task', COUNT(*), COUNT(DISTINCT learning_plan_id), SUM(content_version_id=266100) FROM %s.learning_runtime_task;\n" "$qa_learning_schema"
  printf "SELECT 'learning_input', COUNT(*), MIN(content_version_id), MIN(content_epoch), MIN(pin_version) FROM %s.learning_plan_input_snapshot;\n" "$qa_learning_schema"
  printf "SELECT 'learning_today', COUNT(*), MIN(status), MIN(target_minutes), MIN(plan_version) FROM %s.b25_learning_plan;\n" "$qa_learning_schema"
  printf "SELECT 'learning_srs', COUNT(*), SUM(practice_ref_json IS NOT NULL) FROM %s.b25_learning_srs_state;\n" "$qa_learning_schema"
  printf "SELECT 'learning_idempotency', COUNT(*), SUM(operation='plan.create'), SUM(operation='plan.resume'), COUNT(DISTINCT SHA2(CASE WHEN operation='plan.resume' THEN LEFT(idempotency_key, CHAR_LENGTH(idempotency_key)-7) ELSE idempotency_key END, 256)) FROM %s.learning_runtime_idempotency_record;\n" "$qa_learning_schema"
  printf "SELECT 'learning_unexercised', (SELECT COUNT(*) FROM %s.learning_plan_replan_receipt), (SELECT COUNT(*) FROM %s.learning_runtime_progress), (SELECT COUNT(*) FROM %s.b25_learning_review);\n" "$qa_learning_schema" "$qa_learning_schema" "$qa_learning_schema"
} | docker exec -i "$qa_id" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket --user=root --batch --skip-column-names' > "$qa_out/learning-owner-db-facts.tsv" 2> "$qa_out/learning-owner-db-read.stderr" || qa_learning_sql_status=$?
printf '%s\n' "$qa_assessment_sql_status" > "$qa_out/assessment-owner-db-read.exit"
printf '%s\n' "$qa_learning_sql_status" > "$qa_out/learning-owner-db-read.exit"
test -f "$qa_out/result.json"
test "$qa_node_status" = 0
test "$qa_assessment_sql_status" = 0
test "$qa_learning_sql_status" = 0
cmp "$qa_out/expected-db-facts.tsv" "$qa_out/owner-db-facts.tsv"
awk -F '\t' '
  $1=="learning_plan" { plan=($2==1 && $3=="ACTIVE" && $4==30 && $5==266100 && $6==1 && $7==2); version=$7 }
  $1=="learning_task" { tasks=($2==10 && $3==1 && $4==$2) }
  $1=="learning_input" { input=($2==1 && $3==266100 && $4==1 && $5>=1) }
  $1=="learning_today" { today=($2==1 && $3=="ACTIVE" && $4==30 && $5>=1); projectedVersion=$5 }
  $1=="learning_srs" { srs=($2==3 && $3==3) }
  $1=="learning_idempotency" { idem=($2==2 && $3==1 && $4==1 && $5==1) }
  $1=="learning_unexercised" { none=($2==0 && $3==0 && $4==0) }
  END { exit !(plan && tasks && input && today && srs && idem && none && version==projectedVersion) }
' "$qa_out/learning-owner-db-facts.tsv"
test -f "$qa_out/home-return-receipt.json"
node -e '
const fs = require("fs");
const receipt = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const home = receipt.home && typeof receipt.home === "object" ? receipt.home : {};
const ok = receipt.status === "OBSERVED"
  && receipt.finalHash === "/pages/home/home"
  && receipt.originFixed === true
  && receipt.loginHttp === 200
  && receipt.principalHttp === 200
  && receipt.learningAccess === "ELIGIBLE"
  && receipt.serverAdultStatus === "PASSED"
  && receipt.homeHttp === 200
  && home.state === "READY"
  && home.targetReady === true
  && home.blocker == null
  && Number(home.taskCount) >= 1
  && home.hasPlan === true
  && home.hasPlanningInput === true
  && receipt.routeFulfill === false
  && receipt.storageInjection === false
  && receipt.locationAssign === false;
if (!ok) process.exit(2);
' "$qa_out/home-return-receipt.json"

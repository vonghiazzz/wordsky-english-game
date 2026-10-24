#!/usr/bin/env bash
# WordSky V6 LOCAL ONLY, never connects to Supabase.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE="$ROOT/dev/wordsky-v6-test/compose.yaml"
LOCAL_URL='postgresql://wordsky_test:wordsky_local_only@localhost:5547/wordsky_v6_test'
cd "$ROOT"
if ! docker compose version >/dev/null 2>&1; then
  echo 'ERROR: Docker Compose is not available; start Docker Desktop or OrbStack.' >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo 'ERROR: Docker daemon is not running.' >&2
  exit 1
fi
dc(){ docker compose -f "$COMPOSE" "$@"; }
up(){
 dc up -d --wait
 echo 'LOCAL ONLY: PostgreSQL 127.0.0.1:5547 / wordsky_v6_test'
}
setup(){
 up
 echo 'Applying base schema to LOCAL test DB...'
 dc exec -T db psql -X -v ON_ERROR_STOP=1 -U wordsky_test -d wordsky_v6_test < db/schema.sql >/dev/null
 echo 'Applying V6 CEFR migration to LOCAL test DB...'
 dc exec -T db psql -X -v ON_ERROR_STOP=1 -U wordsky_test -d wordsky_v6_test < db/migrations/20261021_150000_wordsky_cefr_review.sql >/dev/null
 echo 'Applying gameplay round settings migration to LOCAL test DB...'
 dc exec -T db psql -X -v ON_ERROR_STOP=1 -U wordsky_test -d wordsky_v6_test < db/migrations/20261022_gameplay_round_settings.sql >/dev/null
 echo 'Applying MATCH Solo migration to LOCAL test DB...'
 dc exec -T db psql -X -v ON_ERROR_STOP=1 -U wordsky_test -d wordsky_v6_test < db/migrations/20261023_220000_match_solo.sql >/dev/null
 echo 'Applying BOMB Solo migration to LOCAL test DB...'
 dc exec -T db psql -X -v ON_ERROR_STOP=1 -U wordsky_test -d wordsky_v6_test < db/migrations/20261024_100000_bomb_solo.sql >/dev/null
 echo 'Seeding original 26 topics and 260 words to LOCAL test DB...'
 DATABASE_URL="$LOCAL_URL" node scripts/seed.js
 echo 'LOCAL DB initialized. Draft CEFR records remain PROVISIONAL, no approvals.'
}
status(){
 dc ps
 dc exec -T db psql -X -v ON_ERROR_STOP=1 -U wordsky_test -d wordsky_v6_test -c "SELECT (SELECT count(*) FROM ws_topics) AS topics, (SELECT count(*) FROM ws_words) AS words, (SELECT count(*) FROM ws_words WHERE cefr_review_status='APPROVED') AS approved;"
}
smoke(){
 setup
 fixture=""
 fixture="$(mktemp "${TMPDIR:-/tmp}/wordsky-v6-test.XXXXXXXX")"
 trap 'rm -f "$fixture"' EXIT
 node dev/wordsky-v6-test/make-fixture.mjs "$fixture"
 echo 'Importing SIMULATED approvals into LOCAL test database only...'
 WORDSKY_TEST_DATABASE_URL="$LOCAL_URL" node scripts/import-cefr-approved.js "--file=$fixture" --write-local-test
 echo 'Asserting that every LOCAL fixture approval has an import audit record...'
 audit_count="$(dc exec -T db psql -X -A -t -v ON_ERROR_STOP=1 -U wordsky_test -d wordsky_v6_test -c "SELECT count(*) FROM ws_audit WHERE action='word_cefr_review' AND payload->>'importer'='scripts/import-cefr-approved.js' AND payload->>'test_only'='true';")"
 if [ "$audit_count" -ne 12 ]; then
   echo "ERROR: expected 12 audited fake local approvals, found $audit_count" >&2
   exit 1
 fi
 echo 'LOCAL audit records PASS: 12/12 (TEST_ONLY_FIXTURE). '
 echo 'Running API+PostgreSQL integration smoke against LOCAL DB...'
 DATABASE_URL="$LOCAL_URL" WORDSKY_TEST_DATABASE_URL="$LOCAL_URL" node dev/wordsky-v6-test/smoke-local.mjs
 status
 echo 'LOCAL smoke PASS. This is NOT a production data approval.'
}
case "${1:-}" in
 up) up;;
 init) setup;;
 status) status;;
 test) smoke;;
 stop) dc stop;;
 down) dc down;;
 *) echo 'Usage: bash dev/wordsky-v6-test/local-db.sh {up|init|test|status|stop|down}' >&2; exit 2;;
esac

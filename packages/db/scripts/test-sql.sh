#!/usr/bin/env bash
# รัน migrations ทั้งหมดบน Postgres เปล่า แล้วรัน SQL test ของกฎ
# ใช้ได้ทั้งในเครื่องและใน CI · ต้องมี psql และตั้ง DATABASE_URL (ค่าเริ่มต้นชี้ postgres local)
set -euo pipefail
cd "$(dirname "$0")/.."
URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
DB="registerweb_test_$$"
psql "$URL" -v ON_ERROR_STOP=1 -q -c "create database $DB"
trap 'psql "$URL" -q -c "drop database if exists $DB" >/dev/null' EXIT
TEST_URL=$(printf '%s' "$URL" | sed -E "s#/([^/?]*)(\?.*)?\$#/$DB\2#")
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/auth_stub.sql
for f in supabase/migrations/*.sql; do
  echo "migrate $(basename "$f")"
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
set +e
OUT=""
STATUS=0
for t in supabase/tests/*_test.sql; do
  echo "test $(basename "$t")"
  R=$(psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$t" 2>&1)
  S=$?
  echo "$R" | grep -oE '(ok  .*|FAIL: .*|ERROR: .*)'
  OUT="$OUT
$R"
  if [ $S -ne 0 ]; then STATUS=$S; fi
done
set -e
if [ $STATUS -ne 0 ]; then echo "SQL tests failed"; exit $STATUS; fi
echo "SQL tests passed ($(echo "$OUT" | grep -c 'ok  ') checks)"

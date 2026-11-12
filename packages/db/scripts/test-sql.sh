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
OUT=$(psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/rules_test.sql 2>&1)
STATUS=$?
set -e
echo "$OUT" | grep -oE '(ok  .*|FAIL: .*|ERROR: .*)'
if [ $STATUS -ne 0 ]; then echo "SQL tests failed"; exit $STATUS; fi
echo "SQL tests passed ($(echo "$OUT" | grep -c 'ok  ') checks)"

#!/usr/bin/env bash
# Security checks on the schema built from migrations (security gate, ADR 0002):
#   1. every table in `public` has row-level security enabled
#   2. every SECURITY DEFINER function in `public` pins search_path
# Needs psql and DATABASE_URL (a Postgres the script may create a scratch database in).
set -euo pipefail
export PGOPTIONS="-c client_min_messages=error"
cd "$(dirname "$0")/.."
URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
DB="registerweb_sec_$$"
psql "$URL" -v ON_ERROR_STOP=1 -q -c "create database $DB"
trap 'psql "$URL" -q -c "drop database if exists $DB" >/dev/null' EXIT
DB_URL=$(printf '%s' "$URL" | sed -E "s#/([^/?]*)(\?.*)?\$#/$DB\2#")
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/auth_stub.sql
for f in supabase/migrations/*.sql; do psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null; done

NO_RLS=$(psql "$DB_URL" -Atc "
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity order by 1")
NO_PATH=$(psql "$DB_URL" -Atc "
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) s where s like 'search_path=%') order by 1")

STATUS=0
if [ -n "$NO_RLS" ]; then echo "FAIL: tables without RLS:"; echo "$NO_RLS" | sed 's/^/  - /'; STATUS=1; fi
if [ -n "$NO_PATH" ]; then echo "FAIL: security definer functions without search_path:"; echo "$NO_PATH" | sed 's/^/  - /'; STATUS=1; fi
[ $STATUS -eq 0 ] && echo "schema security checks passed ($(psql "$DB_URL" -Atc "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')") tables)"
exit $STATUS

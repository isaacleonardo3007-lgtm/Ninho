#!/usr/bin/env bash
# Uso: PGHOST=/tmp/pg PGPORT=54329 tests/db/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -U ${PGUSER:-postgres} -v ON_ERROR_STOP=1 -q -t -A"
psql -U ${PGUSER:-postgres} -qc "drop database if exists ninho_test" -c "create database ninho_test"
$P -d ninho_test -f tests/db/supabase-stub.sql
for f in supabase/migrations/*.sql; do $P -d ninho_test -f "$f"; done
$P -d ninho_test -f tests/db/rls-tests.sql 2>&1 | grep -v -E "^(ok|falha|[0-9a-f-]{36})?$" | sed "s/^psql:[^ ]* NOTICE:  /  /"

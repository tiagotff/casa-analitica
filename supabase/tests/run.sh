#!/usr/bin/env bash
# Aplica migrations + seed num banco descartável e roda os testes de regra.
# Uso: DB_URL=postgresql://... bash supabase/tests/run.sh
set -euo pipefail
for f in supabase/migrations/*.sql supabase/seed.sql supabase/tests/regras_de_negocio.sql; do
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

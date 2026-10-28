#!/usr/bin/env bash
# Local Postgres for development: its own cluster inside the repo (.local/postgres, git-ignored) on port 5433,
# so it never touches any other Postgres on this machine. Needs Postgres 15+ with pgvector (Postgres.app has both).
#   bash packages/db/scripts/local-db.sh start|stop|status|destroy
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DATA="$ROOT/.local/postgres"
PORT="${LOCAL_DB_PORT:-5433}"
DB_NAME=instantphotos

PGBIN="$(dirname "$(command -v pg_ctl 2>/dev/null || echo /Applications/Postgres.app/Contents/Versions/latest/bin/pg_ctl)")"
[ -x "$PGBIN/pg_ctl" ] || { echo "pg_ctl not found. Install Postgres 15+ (e.g. Postgres.app) and retry." >&2; exit 1; }
export PATH="$PGBIN:$PATH"

case "${1:-}" in
  start)
    if [ ! -d "$DATA" ]; then
      mkdir -p "$DATA"
      initdb -D "$DATA" -U postgres --auth=trust --encoding=UTF8 >/dev/null
    fi
    pg_ctl -D "$DATA" status >/dev/null 2>&1 || pg_ctl -D "$DATA" -o "-p $PORT -k /tmp" -l "$DATA/server.log" -w start >/dev/null
    psql -h localhost -p "$PORT" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
      || createdb -h localhost -p "$PORT" -U postgres "$DB_NAME"
    echo "Local database is up."
    echo "DATABASE_URL=postgres://postgres@localhost:$PORT/$DB_NAME"
    ;;
  stop) pg_ctl -D "$DATA" stop -m fast ;;
  status) pg_ctl -D "$DATA" status ;;
  destroy)
    pg_ctl -D "$DATA" stop -m fast 2>/dev/null || true
    rm -rf "$DATA"
    echo "Local database removed."
    ;;
  *) echo "usage: local-db.sh start|stop|status|destroy" >&2; exit 2 ;;
esac

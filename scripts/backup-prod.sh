#!/usr/bin/env bash
# Ops: backup and restore drill of the LIVE Supabase project (RUNBOOKS §3). Uses only the founder's `supabase login` +
# `supabase link` (no secret key) and Docker (the CLI runs pg_dump in a container).
#   scripts/backup-prod.sh backup            -> backups/prod-<time>/{data.sql, storage/<bucket>/..., manifest.txt}
#   scripts/backup-prod.sh drill <dir>       -> restores into a scratch Postgres container and compares row counts
# The schema is NOT backed up: it comes from supabase/migrations (git). A restore = migrations first, then data.sql.
# shortcut: the local Supabase stack must be running for the drill (its auth/storage schema definitions are reused);
# the data dump is not one snapshot with the file copy, fine for a quiet pilot database.
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE=public.ecr.aws/supabase/postgres:17.11.0.003 # same major as the live database
SCRATCH=restore_scratch
COUNTS="select (select count(*) from auth.users) users, (select count(*) from public.institutes) institutes,
  (select count(*) from public.memberships) memberships, (select count(*) from private.platform_admins) platform_admins,
  (select count(*) from storage.objects) files, (select count(*) from pg_tables where schemaname in ('public','private')) tables"

backup() {
  dir="backups/prod-$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$dir/storage"
  supabase db dump --linked --data-only --use-copy -s public,private,auth,storage -f "$dir/data.sql"
  for bucket in documents logos; do
    supabase storage cp -r "ss:///$bucket" "$dir/storage/$bucket" --linked --experimental >/dev/null || true
  done
  (cd "$dir" && { echo "# created $(date -u +%FT%TZ)"; find storage -type f -exec shasum -a 256 {} + | sort -k2; shasum -a 256 data.sql; } > manifest.txt)
  echo "Backup $dir: $(du -sh "$dir" | cut -f1), $(find "$dir/storage" -type f | wc -l | tr -d ' ') files"
  echo "Run the drill:  scripts/backup-prod.sh drill $dir"
}

drill() {
  dir="${1:?backup folder}"
  [ -f "$dir/data.sql" ] || { echo "no data.sql in $dir"; exit 1; }
  docker rm -f "$SCRATCH" >/dev/null 2>&1 || true
  docker run -d --name "$SCRATCH" -e POSTGRES_PASSWORD=scratch "$IMAGE" >/dev/null
  psql_() { docker exec -i "$SCRATCH" psql -U supabase_admin -d postgres -q -v ON_ERROR_STOP=1 "$@"; }
  until docker exec "$SCRATCH" psql -U supabase_admin -d postgres -Atc 'select 1' >/dev/null 2>&1; do sleep 2; done
  started=$(date +%s)
  # auth + storage definitions are Supabase's own: take them from the local stack, then apply our migrations.
  psql_ -c 'drop schema if exists auth cascade; drop schema if exists storage cascade; create role worker login;'
  docker exec supabase_db_examedge_ai pg_dump -U supabase_admin -s -n auth -n storage -d postgres | psql_ -v ON_ERROR_STOP=0 >/dev/null 2>&1 || true
  for f in supabase/migrations/*.sql; do psql_ -1 < "$f"; done
  # migrations seed a few rows (settings, buckets, ...): empty the tables so the backup's rows replace them.
  psql_ -c "do \$\$ declare t text; begin for t in select format('%I.%I', schemaname, tablename) from pg_tables
    where schemaname in ('public','private') or (schemaname = 'storage' and tablename in ('buckets','objects'))
    loop execute 'truncate ' || t || ' cascade'; end loop; end \$\$"
  psql_ < "$dir/data.sql" >/dev/null
  echo "Restored in $(( $(date +%s) - started )) s. Restored counts:"
  docker exec "$SCRATCH" psql -U supabase_admin -d postgres -x -c "$COUNTS"
  echo "Live counts (compare):"
  echo "$COUNTS" | supabase db query --linked 2>&1 | grep -E '"(users|institutes|memberships|platform_admins|files|tables)"' | tr -d ' \n'; echo
  echo "Files in the backup: $(find "$dir/storage" -type f | wc -l | tr -d ' ') (restored storage rows are listed under 'files')."
  docker rm -f "$SCRATCH" >/dev/null
}

case "${1:-}" in
  backup) backup ;;
  drill) shift; drill "$@" ;;
  *) echo "usage: $0 backup | drill <backup dir>"; exit 1 ;;
esac

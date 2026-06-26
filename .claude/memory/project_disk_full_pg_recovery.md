---
name: project_disk_full_pg_recovery
description: "\"DB in recovery mode\" / Prisma FATAL errors almost always mean the root disk is 100% full"
metadata: 
  node_type: memory
  type: project
  originSessionId: a7f82d78-7217-4d91-aeb8-f2d530167295
---

When the app throws `FATAL: the database system is in recovery mode` (Prisma, e.g. `prisma.subdivision.findMany()`) and a cascade of failing tRPC queries (geoCore.getMapBundle, notifications.getUnreadCount, messages.getFolderCounts), the root cause on this server is almost always **the root disk (`/dev/vda2`, ~141G) being 100% full**. PostgreSQL can't write WAL / finish crash recovery with 0 bytes free, so it gets stuck in recovery and rejects all queries. App code is not at fault.

**Diagnose:** `df -h /` and `ps aux | grep postgres` (a `postgres: startup` process = actively recovering; once `autovacuum launcher` + `walwriter` + `logical replication launcher` are present and `startup` is gone, recovery is complete).

**Postgres here is DOCKERIZED:** it runs in the `ixstats-postgres` container (image `postgis/postgis:16-3.4-alpine`, host port 5433), which is why host `ps` shows it as uid 70 and `systemctl status postgresql` says "could not be found" / `psql` isn't on the host. Run admin SQL via `docker exec ixstats-postgres psql -U postgres -d ixstats -c "..."`.

**Now Compose-managed (2026-06-05):** previously a bare `docker run` container (no compose labels → `docker compose up` conflicted on the name). Recreated via `/ixwiki/public/projects/ixstats/docker-compose.yml` (`docker compose up -d --wait`; data persisted in named volume `ixstats_pgdata`, now declared `external: true` so `compose down -v` can't delete it). Tuning lives in the compose `command:` `-c` flags (override postgresql.auto.conf, so set perf params THERE, not via ALTER SYSTEM): shared_buffers=256MB, work_mem=16MB, maintenance_work_mem=128MB, effective_cache_size=768MB, random_page_cost=1.1, effective_io_concurrency=200, wal_compression=on, log_min_duration_statement=500, log_connections/disconnections=off. Container capped at 1GB mem (uses ~90MB) + json-file log cap (20m×3). **`pg_stat_statements` is enabled** — find slow queries with `SELECT query,calls,round(mean_exec_time::numeric,1) ms,rows FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 20;`. DB is only ~261MB. Index-usage stats (`pg_stat_user_indexes.idx_scan`) were reset by the crash — let them mature weeks before pruning, and prune via Prisma `@@index` (schema-managed), not raw DROP INDEX. Redis is also Docker (`ixstats-redis-cache`, port 6379). **NEVER `apt purge docker` / `docker system prune -a --volumes` — it would destroy the production DB+cache.** Volumes to protect: `ixstats-postgres-data`, `ixstats_pgdata`, `ixstats-redis-data` (+ anon vol whose owner is `ixstats-redis-cache`). Verify recovery via the app's Prisma client: `node -e` with `prisma.subdivision.count()` + `SELECT pg_is_in_recovery()`. Once disk frees up, Postgres auto-completes recovery within seconds — no manual restart needed.

**Active IDE session = Cursor**, not VS Code: Claude Code runs under `/root/.cursor-server/...`. NEVER remove `.cursor-server` (kills the live session). `.vscode-server` has only a leftover CLI process. Re-downloadable bloat inside both: Cline's puppeteer chromium under `data/User/globalStorage/saoudrizwan.claude-dev/puppeteer`.

**Safe cleanup levers (June 2026 incident freed ~28G):**
- Old backups/dumps in `/root` and `/ixwiki` (`ixwiki-files-*.tar.gz` was 13G, `db-ixwiki-*.sql`, `dbdump-*.sql`, `mysql-data-*.tar.gz`, old `backup-*.sql`)
- Rotated MediaWiki logs: `/ixwiki/private/logs/debug.log.1` + `debug.log.*.gz` (active `debug.log` kept)
- `journalctl --vacuum-size=200M` (~2G)
- pm2 bot logs `/var/log/pm2/`, `/var/log/mysql/slow.log` (truncate, don't rm — processes hold handles)

**Long-term bloat = dev-tool caches on a prod box** (mostly cleared 2026-06-05, freeing root disk 100%→64%): `/root/.bun/install/cache` (clear cache only, keep `~/.bun/bin`), `.lmstudio` (removed — LM Studio uninstalled, PATH lines stripped from `.bashrc`/`.profile`), `.gemini/history` + `.gemini/antigravity*` + top-level `.antigravity-*server` (removed; Antigravity/Gemini IDE not in use), `.npm/_cacache`, `.cache/puppeteer`, Cline puppeteer caches. Wiki images live at `/ixwiki/shared/images` (~40G) — real data, never touch.

**Guardrails installed 2026-06-05 (so this can't silently recur):**
- journald cap: `/etc/systemd/journald.conf.d/99-ixwiki-size.conf` (SystemMaxUse=300M).
- logrotate: `/etc/logrotate.d/ixwiki-custom` (copytruncate; `/ixwiki/private/logs/*.log` @100M×5, `/var/log/pm2/*.log` @50M×5).
- disk alert: `/usr/local/bin/ixwiki-disk-alert.sh` via cron `/etc/cron.d/ixwiki-disk-alert` (every 15min; WARN 85% / CRIT 92%; re-DM ≤ every 6h; recovery notice; state `/var/lib/ixwiki-disk-alert.state`, log `/var/log/ixwiki-disk-alert.log`). Run with `--test` to force a DM.
- **Central notifier `/usr/local/bin/ixwiki-notify.sh "msg"`** — DMs admin Discord user `156198941879304192` via the bot token (read at runtime from `/ixwiki/public/projects/ixstats/.env.production.local` `DISCORD_BOT_TOKEN`; note the bot's own `/ixwiki/shared/bots/discord/.env` has NO token, and ixstats `DISCORD_WEBHOOK_ENABLED=false` + webhooks can't DM). Reusable — call it from any monitor to "ping me for any server alert". Verified working 2026-06-05 (admin confirmed receipt).
- **Already hooked into the notifier (2026-06-05):**
  - `php-fpm-watchdog.sh` (ExecStart `/ixwiki/private/scripts/php-fpm-watchdog.sh`, systemd `php-fpm-watchdog`) — DMs on every PHP-FPM auto-restart and on restart FAILURE.
  - `ixwiki-bot-defense.sh` (ExecStart `/usr/local/bin/ixwiki-bot-defense.sh daemon`, systemd `ixwiki-bot-defense`) — throttled `maybe_alert_attack` DMs ≤1/30min (state `/var/lib/ixwiki-defense/last_alert_epoch`) when new blocks appear in a daemon cycle. Both use a backgrounded `notify()` with `timeout 20` so Discord can't stall the daemon. Restart the service after editing either script for changes to take effect.
  - `ixwiki-pg-slow-report.sh` (cron `/etc/cron.d/ixwiki-pg-slow-report`, Mon 09:00) — weekly digest DM of top-10 slowest Postgres queries from `pg_stat_statements` (avg latency) + DB size / cache-hit%. Reads via `docker exec ixstats-postgres psql`. Set `RESET_AFTER=1` in the script for a fresh weekly window; log `/var/log/ixwiki-pg-slow-report.log`.

---
name: project_disk_reclaim_ide_slowlog
description: Two recurring disk-bloat sources fixed June 2026 — MariaDB slow-log flood and unbounded IDE-server version dirs; both now have automated guardrails
metadata: 
  node_type: memory
  type: project
  originSessionId: 5d48fe90-033f-47a6-90e6-f9a9358f1abe
---

June 2026 disk audit (`/dev/vda2` 76%→68%, ~10G reclaimed) found two recurring
bloat sources, both now self-managing. See [[project_disk_full_pg_recovery]] and
[[project_vps_memory_audit_2026_06]].

**MariaDB slow-log flood (~1.5G/day):** root cause was `log_queries_not_using_indexes = 1`
in `/etc/mysql/conf.d/ixwiki.cnf` — logs *every* unindexed query, and MediaWiki fires
thousands. NOT slow queries. Fixed: set `= 0`, `long_query_time` 2→5, applied live via
`SET GLOBAL` (dynamic, no restart) + persisted in config. Rotation tightened in
`/etc/logrotate.d/mariadb`: monthly/500M → daily/200M/keep-14. Re-enable unindexed
logging only while hunting missing indexes.

**Unbounded IDE servers:** Cursor/VSCode/Antigravity drop a new commit-hash server +
binary dir on every update and never delete old ones (~0.5–1G each) under
`/root/.{cursor,vscode}-server/{cli/servers,bin/linux-x64}`. Fix: `/usr/local/bin/ide-server-prune.sh`
keeps the 2 newest version dirs per location + clears `CachedExtensionVSIXs`; weekly cron
`/etc/cron.d/ide-server-prune` (Sun 04:30). Safe for all 3 IDEs (in-use version is always
newest). Raise `KEEP` only if pinning an old server.

**Other reclaim levers (caches, rebuild on demand):** `bun pm cache rm` (was 4.7G),
`npm cache clean --force`, `/root/.cache/{typescript,pip,composer,ms-playwright-go}`.
Orphaned `next/.../jest-worker/processChild.js` procs (PPID=1, days old) leak RAM+swap —
safe to `kill`. Docker images show "reclaimable" in `docker system df` but are the running
prod stack (kokoro/postgres/redis) — do NOT prune. The 42G `/ixwiki/shared/images` is wiki
media, not bloat; if it ever pressures disk, attach a Vultr block volume at that path before
considering a Cloudflare R2 (object-storage) migration.

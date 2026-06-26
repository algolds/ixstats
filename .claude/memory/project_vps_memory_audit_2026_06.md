---
name: vps-memory-audit-2026-06
description: June 2026 VPS perf audit — root cause of freezes is RAM oversubscription/swap thrash; key configs and findings for future ops work
metadata: 
  node_type: memory
  type: project
  originSessionId: 459915d1-8042-4038-9617-e8a5c4c4f2b1
---

# VPS Performance Audit (2026-06-12), server "Ophiuchus" (Vultr 4 vCPU / 7.2GB RAM / 8GB swapfile)

**Root cause of periodic freezes:** RAM oversubscription during dev sessions → swap storms. sar showed load 105, %system CPU 98%, 6–8k pages/s swapped during a 16:00–16:30 freeze; swap hit 100% full (8GB) at 18:20. No OOM kills (swap absorbs it = thrash instead of kill). Disk reads averaged ~50MB/s since boot = page-cache thrash, not real app I/O.

**Steady-state RAM (~5.5GB of 7.2GB):** PHP-FPM 8.4 ~1.6GB (11 workers ×146MB, pm.max_children=16 in `/etc/php/8.4/fpm/pool.d/www.conf`); MariaDB 11.8 ~1.8GB (innodb_buffer_pool_size=1.5GB — was found 1.27GB swapped OUT); ixworld next-server ~780MB (port 3002); docker ixstats-postgres (256MB shared_buffers, 1GB cap) + redis; memcached -m 256; bots ~150MB. Dev adds Cursor server ~1.2GB + tsserver (cap 4096MB in .vscode/settings.json) + next dev (cap 4096MB in start-development.sh) → demand 11–13GB.

**Key facts:**
- MediaWiki uses **MariaDB** (ixwiki DB = 3.1GB) + memcached, NOT the docker Postgres. XenForo DB also in MariaDB (77MB).
- IxStats Postgres (docker, port 5433) is healthy and tiny: ixstats DB = 275MB, ~13 conns, sane settings. NOT a bottleneck.
- No Elasticsearch installed/running.
- **IxStats prod (port 3550) is NOT running** — nginx has no 3550 proxy, but a daily 05:30 root cron still POSTs to localhost:3550/projects/ixstats/api/lorewards/sync (fails silently). Only ixworld/discord-bot/ixtwitter run under PM2.
- vm.swappiness=60 (default), zswap disabled, plain 8GB /swapfile on same vda2 disk.
- Wiki serves Main_Page in ~40ms when box is unloaded — MediaWiki itself is well-optimized.

**Fixes APPLIED 2026-06-13** (all verified, wiki+maps stayed up; backups `*.bak-2026-06-13`):
- zswap on (zstd, 25%), live + persisted in `/etc/default/grub` (`zswap.enabled=1 ...`)
- `vm.swappiness=10` + `vfs_cache_pressure=100` in `/etc/sysctl.d/99-ixwiki-memory.conf`
- PHP-FPM `max_children 16→10`, start 6→4, spares 3/10→2/5 in `/etc/php/8.4/fpm/pool.d/www.conf` (graceful reload)
- MariaDB `innodb_buffer_pool_size 1536M→768M` in `/etc/mysql/conf.d/ixwiki.cnf` (restarted; **VmSwap went 1.27GB→0**)
- cgroup protection via `systemctl set-property` (persists in `/etc/systemd/system.control/`): mariadb MemoryLow=1G, php8.4-fpm MemoryLow=800M, pm2-root MemoryHigh=1.2G
- earlyoom installed+enabled: `-r 3600 -m 5 -s 5 --avoid '^(mariadbd|postgres|nginx|php-fpm8.4|dockerd|containerd|sshd|systemd|memcached|fail2ban-server|next-server)$'` in `/etc/default/earlyoom`
- next.config.js `experimental.cpus = 2` (gitignored/server-local) + constrained build wrapper `/usr/local/bin/ixstats-build.sh` (systemd-run scope: MemoryHigh=3G/Max=4G/CPUQuota=200%/nice15) — use this for deploy builds
- journald vacuumed to 185M (cap already 300M)

**Gotcha hit:** `needrestart` (default interactive mode) deadlocked apt mid-install holding the dpkg lock. Fixed by setting `$nrconf{restart} = 'l';` in `/etc/needrestart/needrestart.conf` (list-only, no prompt) — future apt installs won't hang. earlyoom conffile needed `dpkg --force-confold --configure earlyoom`.

**Proven at apply-time:** with this remote Cursor session OPEN, tsserver ate **2.6GB** + cursor-server ~1GB + claude agent ~0.5GB = ~4GB of dev tooling ON the box; production-only footprint is ~3GB/7.2GB. Confirms the fix is *closing the remote-SSH workspace* and developing from the local WSL clone — the server tuning just makes production fit comfortably. NOT done (user decisions): remove/keep the 05:30 `lorewards/sync` cron (port 3550 prod still not running); the 16GB RAM upgrade (now optional, not urgent). See plans/vps-stabilization-and-local-dev.md.

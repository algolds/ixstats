# VPS Performance Audit (2026-06-12), server "Ophiuchus" (Vultr 4 vCPU / 7.2GB RAM / 8GB swapfile)

**Root cause of periodic freezes:** RAM oversubscription during dev sessions → swap storms. sar showed load 105, %system CPU 98%, 6–8k pages/s swapped during a 16:00–16:30 freeze; swap hit 100% full (8GB) at 18:20. No OOM kills (swap absorbs it = thrash instead of kill). Disk reads averaged ~50MB/s since boot = page-cache thrash, not real app I/O.

**Steady-state RAM (~5.5GB of 7.2GB):** PHP-FPM 8.4 ~1.6GB (11 workers ×146MB, pm.max_children=16 in `/etc/php/8.4/fpm/pool.d/www.conf`); MariaDB 11.8 ~1.8GB (innodb_buffer_pool_size=1.5GB — was found 1.27GB swapped OUT); ixworld next-server ~780MB (port 3002); docker ixstats-postgres (256MB shared_buffers, 1GB cap) + redis; memcached -m 256; bots ~150MB. Dev adds Cursor server ~1.2GB + tsserver (cap 4096MB in .vscode/settings.json) + next dev (cap 4096MB in start-development.sh) → demand 11–13GB.

## Key facts

- MediaWiki uses **MariaDB** (ixwiki DB = 3.1GB) + memcached, NOT the docker Postgres. XenForo DB also in MariaDB (77MB).
- IxStats Postgres (docker, port 5433) is healthy and tiny: ixstats DB = 275MB, ~13 conns, sane settings. NOT a bottleneck.
- No Elasticsearch installed/running.
- **IxStats prod (port 3550) is NOT running** — nginx has no 3550 proxy, but a daily 05:30 root cron still POSTs to localhost:3550/projects/ixstats/api/lorewards/sync (fails silently). Only ixworld/discord-bot/ixtwitter run under PM2.
- vm.swappiness=60 (default), zswap disabled, plain 8GB /swapfile on same vda2 disk.
- Wiki serves Main_Page in ~40ms when box is unloaded — MediaWiki itself is well-optimized.

## Recommended fixes (as of audit, not yet applied)

Enable zswap (zstd), swappiness=10, MariaDB buffer pool →768M, php-fpm max_children →10/spares →4, cap tsserver+next-dev heaps →3072, earlyoom/systemd-oomd, and ultimately 16GB RAM upgrade (the real fix).

**Execution plan:** see [vps-stabilization-and-local-dev.md](./vps-stabilization-and-local-dev.md) — full phased runbook ($0 server fixes, cgroup guardrails, local-dev migration, deploy workflow) given the no-RAM-upgrade constraint.

## Top 10 bottlenecks (ranked by impact)

1. **RAM oversubscription (root cause)** — steady state ~5.5GB of 7.2GB; a dev session adds Cursor (~1.2GB) + tsserver (≤4GB) + Next dev (≤4GB) → 11–13GB demand.
2. **Swap configuration amplifies the pain** — swappiness=60, zswap disabled, swapfile on the same virtual disk as everything else.
3. **MariaDB's 1.5GB InnoDB buffer pool swapped out** (1.27GB in swap) — the "cache" lives on disk while occupying 1.5GB of commit.
4. **PHP-FPM holds 1.6GB at idle** — 11 workers ×146MB, max_children=16 (worst case 2.3GB) for a wiki serving pages in 39ms.
5. **Page-cache thrash multiplies disk I/O** — ~50MB/s sustained reads since boot (~3.9TB/21h); avg write latency 48ms.
6. **No memory guardrails** — no MemoryMax/MemoryLow on services, no earlyoom; 8GB swap means freezes instead of fast kills.
7. **Dev heap caps sized for a 16GB machine** — 4GB tsserver + 4GB Next dev sanctioned on a 7.2GB box.
8. **ixworld next-server 685MB swapped out** — production maps app pays swap-in latency on cold paths.
9. **Builds/typechecks run unconstrained** — the 16:00 freeze coincided with process count jumping ~495 → ~860 (parallel build worker fan-out).
10. **Zombie prod config** — port 3550 down but daily cron still targets it; decide intentionally (starting prod adds ~0.5–1GB).

**Explicitly NOT bottlenecks:** PostgreSQL (tiny, healthy), Elasticsearch (absent), MediaWiki itself (40ms pages), disk space (42GB free), TypeScript architecture (split tsconfigs + geo router split were right; diplomatic.ts/thinkpages.ts splits are polish).

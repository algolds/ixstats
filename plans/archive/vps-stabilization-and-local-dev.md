# VPS Stabilization + Local Development Migration Plan

**Date:** 2026-06-12 · **Server:** Ophiuchus (Vultr 4 vCPU / 7.2GB RAM / 8GB swap) · **Constraint:** no RAM upgrade for now

**Root cause being fixed:** RAM oversubscription during dev sessions (demand 11–13GB vs 7.2GB) → swap storms
(measured: load 105, 98% kernel CPU, 6–8k pages/s swapped, swap 100% full). The durable fix without more RAM
is (a) tune the server to fit production comfortably in 7.2GB, and (b) **move development off the box entirely**.

---

## Phase 0 — Safety prep (15 min, do FIRST)

The `v2` branch has **261 uncommitted files that exist only on this server**. Before touching anything:

```bash
cd /ixwiki/public/projects/ixstats
git add -A && git commit -m "wip: checkpoint before infra changes + local dev migration"
git push master v2        # remote is named "master" → github.com/algolds/ixstats
```

Snapshot both databases:

```bash
mkdir -p /ixwiki/private/backups/pre-tuning-$(date +%F)
docker exec ixstats-postgres pg_dump -U postgres -Fc ixstats \
  > /ixwiki/private/backups/pre-tuning-$(date +%F)/ixstats.dump
mariadb-dump --all-databases --single-transaction \
  | gzip > /ixwiki/private/backups/pre-tuning-$(date +%F)/mariadb-all.sql.gz
```

---

## Phase 1 — $0 server fixes (~1 hour, do today)

### 1.1 Enable zswap (compressed swap cache) — biggest single win
```bash
echo zstd > /sys/module/zswap/parameters/compressor
echo 25   > /sys/module/zswap/parameters/max_pool_percent
echo Y    > /sys/module/zswap/parameters/enabled
# Persist across reboots:
sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="/GRUB_CMDLINE_LINUX_DEFAULT="zswap.enabled=1 zswap.compressor=zstd zswap.max_pool_percent=25 /' /etc/default/grub
update-grub
```
Verify: `grep -r . /sys/module/zswap/parameters/` → `enabled: Y`.

### 1.2 Drop swappiness
```bash
printf 'vm.swappiness=10\nvm.vfs_cache_pressure=100\n' > /etc/sysctl.d/99-ixwiki-memory.conf
sysctl -p /etc/sysctl.d/99-ixwiki-memory.conf
```

### 1.3 Shrink MariaDB buffer pool 1.5GB → 768MB (frees ~800MB; ~15s wiki blip)
Find the current setting and change it:
```bash
grep -rn innodb_buffer_pool_size /etc/mysql/
# edit the file found, set:
#   innodb_buffer_pool_size = 768M
systemctl restart mariadb
```
Rationale: 1.27GB of the pool was sitting in *swap* — a resident 768MB pool beats a swapped 1.5GB one.
Rollback: restore old value, restart.

### 1.4 Right-size PHP-FPM (frees ~600MB; zero downtime)
Edit `/etc/php/8.4/fpm/pool.d/www.conf`:
```ini
pm.max_children = 10
pm.start_servers = 4
pm.min_spare_servers = 2
pm.max_spare_servers = 5
```
```bash
php-fpm8.4 -t && systemctl reload php8.4-fpm
```
Watch for saturation over a few days: `grep 'max_children' /var/log/php8.4-fpm.log` (should stay quiet).

### 1.5 Install earlyoom — never freeze for 30 minutes again
```bash
apt install -y earlyoom
cat > /etc/default/earlyoom <<'EOF'
EARLYOOM_ARGS="-r 60 -m 5 -s 10 --avoid '(^|/)(mariadbd|postgres|nginx|php-fpm|memcached|dockerd|sshd)' --prefer '(^|/)(node|next|tsserver|bun|claude)'"
EOF
systemctl enable --now earlyoom
```
Kills the largest *dev-tool* process when free RAM+swap drops below 5%/10% — production daemons protected.

### 1.6 Fix the dead 05:30 cron
IxStats prod (port 3550) is not running, but root's crontab POSTs to it daily. Either remove the line
(`crontab -e`, the `lorewards/sync` entry) or consciously bring prod up after Phase 2 (the ~1.4GB freed
in 1.3+1.4 covers its footprint). Decide, don't leave it failing silently.

### 1.7 Emergency on-box dev caps (for the rare day you must dev on the server)
- `.vscode/settings.json`: `"typescript.tsserver.maxTsServerMemory": 3072`
- `start-development.sh`: `--max-old-space-size=4096` → `3072`

**Phase 1 acceptance:** next dev-load event produces slowdown, not freeze. Check the morning after:
`sar -W | tail -20` (pswpin/s should be <500 even at peak) and `free -h` (swap used < 1GB steady-state).

---

## Phase 2 — Guardrails & cleanup (~half day)

### 2.1 Protect production with cgroups
```bash
systemctl edit mariadb        # add: [Service]\nMemoryLow=1G
systemctl edit php8.4-fpm     # add: [Service]\nMemoryLow=800M
systemctl edit pm2-root       # add: [Service]\nMemoryHigh=1200M
systemctl daemon-reload
```
Kernel reclaims everything *else* (dev tooling, caches) before touching these.

### 2.2 Constrained build wrapper (until builds move to CI)
Create `scripts/build-prod.sh`:
```bash
#!/bin/bash
# Build with bounded memory/CPU so production never starves
exec systemd-run --scope -p MemoryHigh=3G -p MemoryMax=3584M -p CPUWeight=30 \
  nice -n 15 bash -c 'cd /ixwiki/public/projects/ixstats && npm run build'
```
And in `next.config.js` add `experimental: { cpus: 2 }` to halve build-worker fan-out.

### 2.3 Disk/RAM cleanup
```bash
apt purge -y 'php8.0*' 'php8.1*' 'php8.2*' 'php8.3*'   # only 8.4 runs; verify first: systemctl status php8.4-fpm
rm -rf /root/.cursor-server/bin/<old-hashes>            # 4.7GB; keep only the newest dir under bin/
journalctl --vacuum-size=200M
```

### 2.4 (Optional) Postgres container cap 1GB → 768M
In `docker-compose.yml` set the memory limit to 768M and `docker compose up -d postgres`
(brief IxStats DB blip; DB is 275MB, 256MB shared_buffers — comfortable).

---

## Phase 3 — Local development environment (the structural fix)

Goal: code, tsserver, Next dev server, and Cursor agent all run on **your local machine**;
the VPS runs production only. You keep full SSH access for ops.

### 3.1 Local prerequisites
- Machine with ≥16GB RAM recommended (the dev stack is exactly what needs the memory)
- Git, **Node 20.x** (match server v20.19.4 — use nvm/fnm), **Bun** (server has 1.3.13), Docker Desktop (or docker-ce on Linux), Cursor

### 3.2 Get the code
Phase 0 already pushed v2. Locally:
```bash
git clone https://github.com/algolds/ixstats.git
cd ixstats && git checkout v2
npm install
```

### 3.3 Copy environment files (securely, via scp — never via chat/email)
```bash
scp root@<server-ip>:"/ixwiki/public/projects/ixstats/.env" .
scp root@<server-ip>:"/ixwiki/public/projects/ixstats/.env.local" .
scp root@<server-ip>:"/ixwiki/public/projects/ixstats/.env.local.dev" .
```
Local edits needed:
- `DATABASE_URL` → point at your **local** docker Postgres (same `localhost:5433`, same credentials — the
  repo's compose file defines them, so the URL likely needs no change at all)
- `IXTIME_BOT_URL` / `NEXT_PUBLIC_IXTIME_BOT_URL` → `http://localhost:13001` (tunnel, see 3.5).
  IxTime degrades gracefully to local calculation if the bot is unreachable, so dev works tunnel-down too.
- Clerk dev keys work on localhost out of the box (dev instances allow localhost origins)
- IxWiki/MediaWiki API calls hit `https://ixwiki.com` publicly — no change

### 3.4 Local database (identical to prod by construction)
The repo's `docker-compose.yml` is the same one that runs prod:
```bash
docker compose up -d          # starts ixstats-postgres (5433) + ixstats-redis-cache (6379) locally
npm run db:generate
```
Seed from production — save as `scripts/refresh-local-db.sh` (run whenever you want fresh data):
```bash
#!/bin/bash
set -euo pipefail
ssh root@<server-ip> "docker exec ixstats-postgres pg_dump -U postgres -Fc ixstats" > /tmp/ixstats-prod.dump
docker exec -i ixstats-postgres pg_restore -U postgres -d ixstats --clean --if-exists --no-owner < /tmp/ixstats-prod.dump
echo "Local DB refreshed from production ($(du -h /tmp/ixstats-prod.dump | cut -f1))"
```
(DB is 275MB → dump is small and fast.)

### 3.5 SSH config — one entry gives you shell access AND service tunnels
`~/.ssh/config` on your local machine:
```
Host ixwiki
    HostName <server-ip>
    User root
    # IxTime Discord-bot API (for live time sync during local dev)
    LocalForward 13001 localhost:3001
    # Production Postgres, read-only inspection (psql -h localhost -p 15433)
    LocalForward 15433 localhost:5433
    ServerAliveInterval 30
```
Then `ssh ixwiki` = full shell for ops, with tunnels alive while connected.

### 3.6 First run + verification
```bash
npm run dev                                    # localhost:3000
```
Check: page loads, Clerk sign-in works, country data renders (local DB), IxTime widget shows
synced time when the tunnel is up.

### 3.7 Day-to-day rules (what "stop developing on production" means)
- **Cursor opens the LOCAL clone.** Never open `/ixwiki/...` as a Cursor remote *workspace* — that is what
  drags tsserver (up to 4GB) + extension host (~600MB) + file watchers onto the box.
- **Server ops = plain `ssh ixwiki`** (logs, pm2, systemctl, db). A terminal SSH session costs ~10MB.
  Running Claude Code CLI on the box for an ops task is fine; opening the monorepo workspace is not.
- **Never run `npm run dev`, typechecks, or tsserver on the server again.** The existing CLAUDE.md
  typecheck bans stay, but they now apply to humans too.

---

## Phase 4 — Deploy workflow (local → GitHub → server)

### 4.1 Interim workflow (works day 1)
```bash
# locally:
git push master v2
# on server (via ssh ixwiki):
cd /ixwiki/public/projects/ixstats
git pull master v2
npm install                       # only when package.json changed
./scripts/build-prod.sh           # the constrained wrapper from 2.2
pm2 restart ixworld               # and ixstats prod if/when it runs
```
Schema changes: keep using the established **`db push` runbook** (NOT `migrate dev` — drifted history,
~82-nation prod data): source `.env`, preview the diff, push.

### 4.2 Target workflow (medium-term): build off-box entirely
GitHub Actions on push to `v2`: `npm ci && npm run build`, upload `.next/` artifact, rsync to server,
`pm2 restart`. The server then *never* runs webpack again — the single spikiest workload is gone.

---

## Phase 5 — Medium-term improvements
1. **CI builds** (4.2) — removes the last big RAM/CPU spike from the box.
2. **Split remaining mega-routers** like `geo/` was: `diplomatic.ts` (6,006 lines), `thinkpages.ts` (5,004),
   `admin.ts` (3,710) — shrinks tsserver's inference graph for your *local* machine too.
3. **Prisma `queryCompiler` preview** (6.19 supports `previewFeatures = ["queryCompiler", "driverAdapters"]`)
   — drops the Rust engine sidecar, ~100–200MB less per Node process, faster cold starts.
4. **Decide IxStats prod (3550)** — with Phases 1–3 done there is finally headroom to run it properly.
5. **Revisit RAM upgrade later** — with dev moved off, 8GB is genuinely workable; 16GB becomes a
   nice-to-have instead of an emergency.

---

## Success criteria
- `sar -q`: no load-average excursion >8 for a week
- `sar -W`: pswpin/s + pswpout/s < 500 at all times
- `free -h`: swap used < 1GB steady state; MariaDB `VmSwap` near 0 (`awk '/VmSwap/' /proc/$(pidof mariadbd)/status`)
- Wiki Main_Page stays <100ms under dev workload (because there is no dev workload on the box)
- Zero earlyoom kills of production processes (`journalctl -u earlyoom`)

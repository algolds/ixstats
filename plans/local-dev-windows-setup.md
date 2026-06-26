# Local Dev on Windows — Setup Plan (Cursor / Claude Code / VS Code / PuTTY)

**Goal:** run the entire IxStats dev stack (code, tsserver, Next dev server, Cursor agent, local DB) on your
Windows machine; the VPS runs production only. Companion to
[vps-stabilization-and-local-dev.md](./vps-stabilization-and-local-dev.md) (Phase 3, Windows-specific).

**The one architectural decision: use WSL2, not native Windows.** The repo is Linux-shaped —
`npm run dev` calls `./start-development.sh` (bash), builds call `scripts/with-base-path.sh`, and the
toolchain matches the server (Ubuntu, Node 20, bun). WSL2 gives you a real Ubuntu userland, Docker
integration, fast file watching, and zero CRLF/line-ending pain. Cursor and VS Code both have first-class
WSL support: the editor UI runs on Windows, tsserver and terminals run inside Linux — using your local
machine's RAM, which is the whole point.

**Golden rule:** the repo must live in the WSL filesystem (`~/projects/ixstats`), **never** on
`/mnt/c/...`. Cross-OS file IO is 10–20× slower and would make webpack dev + file watching crawl.

---

## Step 1 — Install WSL2 + Ubuntu (10 min, one reboot)

PowerShell **as Administrator**:
```powershell
wsl --install -d Ubuntu-24.04
```
Reboot if prompted, launch "Ubuntu" from the Start menu, create your Linux username.
If WSL is already installed: `wsl --update` and confirm `wsl -l -v` shows VERSION 2.

## Step 2 — Cap WSL2 memory (2 min)

WSL2 will happily balloon to ~50% of RAM. Create `C:\Users\<you>\.wslconfig`:
```ini
[wsl2]
# Set to (your RAM - 6GB): 16GB machine -> 10GB, 32GB machine -> 24GB
memory=10GB
processors=6
swap=4GB
# Reclaim cached memory automatically
autoMemoryReclaim=gradual
```
Apply with `wsl --shutdown` (then reopen Ubuntu). Dev stack needs ~6–8GB inside WSL to be comfortable.

## Step 3 — Docker Desktop with WSL2 backend (10 min)

1. Install Docker Desktop for Windows.
2. Settings → General → "Use the WSL 2 based engine" (default).
3. Settings → Resources → WSL Integration → enable for **Ubuntu-24.04**.
4. Verify inside Ubuntu: `docker version` (both Client and Server respond).

## Step 4 — Toolchain inside Ubuntu (10 min)

```bash
sudo apt update && sudo apt install -y build-essential git unzip
# Node 20 (matches server v20.19.x) via nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
# Bun (server runs 1.3.x):
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
node --version && bun --version
```

## Step 5 — SSH access: one config for shell + tunnels (10 min)

You can keep PuTTY for ad-hoc shells, but set up OpenSSH inside WSL as the primary path —
it powers `scp`, the DB-refresh script, git deploys, and the tunnels:

```bash
ssh-keygen -t ed25519 -C "windows-wsl"          # if you don't have a key yet
ssh-copy-id root@<server-ip>                     # or paste the .pub into ~/.ssh/authorized_keys on the server
```

`~/.ssh/config` inside WSL:
```
Host ixwiki
    HostName <server-ip>
    User root
    # IxTime Discord-bot API (live time sync during local dev)
    LocalForward 13001 localhost:3001
    # Production Postgres, read-only inspection (psql -h localhost -p 15433)
    LocalForward 15433 localhost:5433
    # Production MediaWiki MySQL (direct database wiki-bridge queries on port 13306)
    LocalForward 13306 localhost:3306
    ServerAliveInterval 30
```
Now `ssh ixwiki` = ops shell + tunnels in one. Tunneled ports are reachable from Windows apps too.

**PuTTY equivalents (optional):**
- Tunnels: Connection → SSH → Tunnels → Source port `13001`, Destination `localhost:3001`, Add (same for `15433`/`localhost:5433`), then save the session.
- If your key is a `.ppk`: PuTTYgen → Conversions → Export OpenSSH key → save as `~/.ssh/id_ed25519` in WSL (`chmod 600` it).

## Step 6 — GitHub auth + clone (5 min)

Make sure the server has pushed `v2` first (Phase 0 of the main plan — 261 uncommitted files!). Then in WSL:
```bash
# Easiest auth: GitHub CLI
sudo apt install -y gh && gh auth login
mkdir -p ~/projects && cd ~/projects
git clone https://github.com/algolds/ixstats.git
cd ixstats && git checkout v2
git config core.autocrlf input        # belt-and-braces; WSL-side clones are LF-native anyway
```

## Step 7 — Env & Config files from the server (5 min)

Since `.env`, `.env.local.dev`, `docker-compose.yml`, and the `docker/` directory are gitignored, you need to copy them from the VPS:

```bash
cd ~/projects/ixstats
# Copy env files
scp ixwiki:"/ixwiki/public/projects/ixstats/.env" .
scp ixwiki:"/ixwiki/public/projects/ixstats/.env.local" .
scp ixwiki:"/ixwiki/public/projects/ixstats/.env.local.dev" .

# Copy docker compose and config files
scp ixwiki:"/ixwiki/public/projects/ixstats/docker-compose.yml" .
scp -r ixwiki:"/ixwiki/public/projects/ixstats/docker" .

# Copy other gitignored toolchain config files
scp ixwiki:"/ixwiki/public/projects/ixstats/{prisma.config.ts,c15t-backend.config.ts,next.config.js,eslint.config.js,postcss.config.js,prettier.config.js,components.json,bunfig.toml,opencode.json}" .

# Copy gitignored assets and tests directories
scp -r ixwiki:"/ixwiki/public/projects/ixstats/public" .
scp -r ixwiki:"/ixwiki/public/projects/ixstats/tests" .

# Copy agent configurations and custom rules
scp ixwiki:"/ixwiki/public/projects/ixstats/CLAUDE.md" .
scp -r ixwiki:"/ixwiki/public/projects/ixstats/.claude" .
scp -r ixwiki:"/ixwiki/public/projects/ixstats/.agents/skills/c15t" .agents/skills/
```
Local edits:
- `DATABASE_URL` — By default, `.env.local.dev` connects as `ixstats_readonly` (read-only mode).
  * **Option A: Enable Read-Write Mode (Recommended for dev testing):** Edit `.env.local.dev` (or create `.env.local` to override) and change:
    ```ini
    DATABASE_URL="postgresql://postgres:kxslIz4cICVDon%2FqwP2yrUzOKjtsryQDt9d28hmMjlk%3D@localhost:5433/ixstats?connection_limit=5"
    DATABASE_READONLY="false"
    ```
  * **Option B: Maintain Read-Only Mode (Locks writes locally):** Keep the `.env` settings but create the `ixstats_readonly` user in your local docker container:
    ```bash
    docker exec -it ixstats-postgres psql -U postgres -d ixstats -c "CREATE ROLE ixstats_readonly WITH LOGIN PASSWORD 'Q9ul7FneYGI4vT/s1/jkIokTH97nuZ8Xk9qnmIVMgVs=';"
    ```
- `IXTIME_BOT_URL` / `NEXT_PUBLIC_IXTIME_BOT_URL` → `http://localhost:13001` (works while `ssh ixwiki` is
  open; IxTime falls back to local calculation when the tunnel is down, so dev still works offline).
- `IXWIKI_DB_HOST` / `IXWIKI_DB_PORT` → Set `IXWIKI_DB_HOST="localhost"` and `IXWIKI_DB_PORT="13306"` locally to route MediaWiki database calls over the SSH tunnel. This allows your local dev to fetch live Wiki pages directly and bypasses Cloudflare 403 API blocking. Copy the actual `IXWIKI_DB_PASSWORD` value from your `.env` file on the VPS.
- Clerk dev keys work on `localhost` as-is. IxWiki API calls hit `https://ixwiki.com` publicly — no change.

## Step 8 — Local database (15 min)

Create the external docker volume required by the compose file:
```bash
docker volume create ixstats_pgdata
```

Start the containers:
```bash
cd ~/projects/ixstats
docker compose up -d            # ixstats-postgres on 127.0.0.1:5433
bun install
bun run db:generate
```
Seed from production — save as `scripts/refresh-local-db.sh`:
```bash
#!/bin/bash
set -euo pipefail
ssh ixwiki "docker exec ixstats-postgres pg_dump -U postgres -Fc ixstats" > /tmp/ixstats-prod.dump
docker exec -i ixstats-postgres pg_restore -U postgres -d ixstats --clean --if-exists --no-owner < /tmp/ixstats-prod.dump
echo "Local DB refreshed ($(du -h /tmp/ixstats-prod.dump | cut -f1))"

echo "🖼️  Syncing gitignored static assets (images, flags, textures, sounds)..."
rsync -avz --exclude="images/uploads/" --exclude="images/downloaded/" --exclude="images/uploads_backup/" ixwiki:/ixwiki/public/projects/ixstats/public/ public/
echo "✓ Static assets synced."

# Ensure local database schema is aligned with the codebase (Prisma 6 CLI doesn't autoload env with config files)
echo "🚀 Syncing database schema with codebase..."
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi
bun run db:push:force
```
```bash
chmod +x scripts/refresh-local-db.sh && ./scripts/refresh-local-db.sh
```
(Prod DB is 275MB — the dump is small; rerun any time you want fresh data. It will automatically run a schema push to align the imported data with the codebase's Prisma definitions.)

## Step 9 — First run (5 min)

```bash
bun run dev
```
Open `http://localhost:3000` **in your Windows browser** — WSL2 forwards localhost automatically.
Verify: pages render, Clerk sign-in works, country data loads (local DB), IxTime widget syncs when the
tunnel is up.

## Step 10 — Point your editors at WSL

- **Cursor:** Command palette → "WSL: Connect to WSL" (installs the WSL extension on first use) → Open
  Folder → `~/projects/ixstats`. The window badge should say **WSL: Ubuntu-24.04**. tsserver, terminals,
  and the Cursor agent now run in Linux on *your* machine. The existing `.vscode/settings.json`
  (tsserver memory cap, watcher excludes) comes along for free.
- **VS Code:** identical — "Remote-WSL" extension, same flow.
- **Claude Code:** run `claude` inside the WSL terminal in the repo (`bun install -g @anthropic-ai/claude-code` or the native installer, inside Ubuntu).
- **Uninstall nothing on Windows** — PuTTY stays useful for quick ops shells.

## Daily workflow (the new normal)

| Task | Where | How |
|---|---|---|
| Write code, run dev server, agents | Windows machine (WSL) | Cursor → WSL folder, `bun run dev` |
| Fresh prod data | Windows machine | `./scripts/refresh-local-db.sh` |
| Deploy | local → GitHub → server | `git push master v2`, then `ssh ixwiki` → pull → `./scripts/build-prod.sh` → `pm2 restart` |
| Schema change to prod | via `ssh ixwiki` | existing **`db push` runbook** (never `migrate dev`) |
| Server ops (logs, pm2, db) | `ssh ixwiki` or PuTTY | plain terminal — costs ~10MB on the box |

**The rules that keep the VPS healthy:**
1. Never open `/ixwiki/...` as a Cursor/VS Code **remote-SSH workspace** again — that's what drags
   tsserver (≤4GB) + extension host (~600MB) onto the box.
2. Never run `bun run dev` / typechecks on the server.
3. Server-side builds only through the constrained wrapper (`scripts/build-prod.sh`, Phase 2.2 of the main plan).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Dev server extremely slow, watching misses changes | Repo is on `/mnt/c/...` — move it into `~/` inside WSL |
| `docker: command not found` in Ubuntu | Docker Desktop → Settings → Resources → WSL Integration → enable Ubuntu |
| Windows RAM exhausted by `vmmem` | Lower `memory=` in `.wslconfig`, `wsl --shutdown`, reopen |
| `localhost:3000` unreachable from Windows browser | `wsl --shutdown` and restart (localhost forwarding occasionally wedges after sleep) |
| Permission denied (publickey) with converted PuTTY key | `chmod 600 ~/.ssh/id_ed25519` inside WSL |
| Port 5433 conflict | Another local Postgres — stop it, or change the host port in `docker-compose.yml` *and* `DATABASE_URL` |
| Time-related features look frozen | Tunnel down — open `ssh ixwiki`, or ignore (IxTime local fallback is fine for dev) |

**Total setup time: roughly 1–1.5 hours**, most of it waiting on installers and `bun install`.

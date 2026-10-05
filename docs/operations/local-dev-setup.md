# Comprehensive WSL2 Local Development Setup Guide

**Last updated:** 2026-10-05

Welcome to the IxStates local development guide. This document details how to set up, configure, and run the entire development stack on your local Windows machine using Windows Subsystem for Linux (WSL2), Docker, and SSH port forwarding.

> **Two paths.** Contributors start from an **empty local database** built from the repository alone
> ([Part 4](#part-4--create-the-local-database)); no production access is needed. The SSH tunnels, the
> configuration copied from the VPS and the production dump (Parts 2, 3 Step 2b and 6) are for maintainers with
> access to the production server. On macOS or Linux, skip the WSL steps of Part 1 and install Docker, Node and Bun
> directly.

---

## Architecture Overview

Local development is structured around **WSL2** (Ubuntu-24.04) as the native runtime environment. 

```mermaid
graph TD
    subgraph Windows Host
        Browser["Windows Browser (localhost:3000)"]
        IDE["Cursor / VS Code (Windows Client)"]
    end

    subgraph WSL2 (Ubuntu-24.04 Environment)
        NextJS["Next.js Dev Server (Turbopack, port 3000)"]
        TSServer["TS Server & Extensions (Linux Node)"]
        DockerPG["Docker Postgres DB (port 5433)"]
        DockerRedis["Docker Redis Cache (port 6379)"]
        LocalGit["Git Client (shared credential helper)"]
    end

    subgraph Production VPS (ixwiki)
        ProdPG["Production Postgres DB (port 5432)"]
        ProdBot["Discord IxTime Bot (port 3001)"]
        ProdWiki["MediaWiki Database (port 3306)"]
    end

    Browser --> NextJS
    IDE --> TSServer
    NextJS --> DockerPG
    NextJS --> DockerRedis
    
    %% SSH Tunnels %%
    NextJS -- "SSH Tunnel (13001)" --> ProdBot
    NextJS -- "SSH Tunnel (13306)" --> ProdWiki
    LocalGit -- "Git SSH / Push" --> GitHub[(GitHub Repository)]
```

> [!IMPORTANT]
> **Golden Rule:** The project repository must live in the native WSL filesystem (e.g. `~/projects/ixstats`), **never** on a Windows-mounted partition like `/mnt/c/`. Cross-OS file IO is 10–20× slower and will degrade file-watching, HMR (Turbopack), and compiler speed.

---

## Part 1 — Initial Environment Setup

### Step 1 — Install WSL2 + Ubuntu
1. Open PowerShell **as Administrator** and execute:
   ```powershell
   wsl --install -d Ubuntu-24.04
   ```
2. Reboot your PC if prompted.
3. Launch **Ubuntu** from the Windows Start menu, and create your Linux username and password.
4. Verify your WSL version from PowerShell: `wsl -l -v` (confirm Version is `2`).

### Step 2 — Cap WSL2 Memory Limits
To prevent WSL2 from ballooning and consuming all Windows host memory, create or edit `C:\Users\<YourUsername>\.wslconfig` on Windows:
```ini
[wsl2]
# Set to (your total RAM - 6GB) -> e.g. 10GB for a 16GB RAM machine
memory=10GB
processors=6
swap=4GB
# Reclaim cached memory automatically
autoMemoryReclaim=gradual
```
Run `wsl --shutdown` in PowerShell to apply the config, then reopen your Ubuntu terminal.

### Step 3 — Install Docker Desktop with WSL2 Integration
1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
2. In Settings → General, ensure **"Use the WSL 2 based engine"** is checked (enabled by default).
3. In Settings → Resources → WSL Integration, check the box to enable integration for **Ubuntu-24.04**.
4. In your Ubuntu terminal, verify you can access the engine:
   ```bash
   docker version
   ```

### Step 4 — Set Up Toolchains inside WSL2
In your Ubuntu terminal, run the following commands to install build tools, Node.js (via NVM), and Bun:
```bash
sudo apt update && sudo apt install -y build-essential git unzip

# Install Node Version Manager (NVM) and Node 20
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Verify installation
node --version && bun --version
```

---

## Part 2 — SSH and Tunnels Configuration (maintainers)

You need this only with access to the production VPS. OpenSSH inside WSL is the primary utility to establish tunnels, transfer files via `scp`, and pull production DB backups.

### Step 1 — Key Generation
Generate your SSH keys locally in WSL (if not already done) and upload the public key to the production VPS:
```bash
ssh-keygen -t ed25519 -C "windows-wsl"
ssh-copy-id root@<your-vps-ip>
```

### Step 2 — SSH Config File
Configure host shortcuts and port forwards inside `~/.ssh/config` in WSL:
```text
Host ixwiki
    HostName <your-vps-ip>
    User root
    # IxTime Discord-bot API (live time sync during local dev)
    LocalForward 13001 localhost:3001
    # Production Postgres, read-only inspection (psql -h localhost -p 15433)
    LocalForward 15433 localhost:5433
    # Production MediaWiki MySQL (direct wiki-bridge queries on port 13306)
    LocalForward 13306 localhost:3306
    ServerAliveInterval 30
```
This config allows you to run `ssh ixwiki` to open a shell and automatically spin up the entire suite of tunnels.

---

## Part 3 — Cloning & Configuration Sync

### Step 1 — Clone the Repository
Inside WSL, clone the repository into your home directory and switch to your working branch: `development` (junior
devs; stable but experimental) or `rose-garden` (the maintainer's nightly branch). See
[contributing.md](../processes/contributing.md#branches).
```bash
mkdir -p ~/projects && cd ~/projects
git clone https://github.com/algolds/ixstats.git
cd ixstats && git checkout development
git config core.autocrlf input
```

### Step 2 — Environment file
Copy the template and fill in your own Clerk development keys (from a Clerk dev instance):
```bash
cp .env.example .env.local
```
`.env.example` lists every variable `src/env.ts` declares (a test keeps it complete), and its `DATABASE_URL` and
`REDIS_URL` already match `docker-compose.dev.yml`.

### Step 2b — Fetch Gitignored Configuration Files (maintainers)
Environment files, editor settings, Docker specs and several tooling configs are gitignored (see `.gitignore`), so copy them over SSH from the VPS. The `tsconfig*.json` files, `prisma.config.ts`, `.oxlintrc.json` and `bun.lock` are tracked in git, so do not overwrite them from the server:
```bash
cd ~/projects/ixstats

# Copy environment configuration templates
scp ixwiki:"/ixwiki/public/projects/ixstats/.env" .
scp ixwiki:"/ixwiki/public/projects/ixstats/.env.local" .
scp ixwiki:"/ixwiki/public/projects/ixstats/.env.local.dev" .

# Copy docker compose specifications
scp ixwiki:"/ixwiki/public/projects/ixstats/docker-compose.yml" .
scp -r ixwiki:"/ixwiki/public/projects/ixstats/docker" .

# Copy gitignored JS/TS toolchain configs (skip any the server does not have)
scp ixwiki:"/ixwiki/public/projects/ixstats/{next.config.js,eslint.config.js,postcss.config.js,prettier.config.js,components.json,bunfig.toml}" .

# Copy editor workspace settings
scp -r ixwiki:"/ixwiki/public/projects/ixstats/.vscode" .
```

---

## Part 4 — Create the local database

The supported way to get a working database without production access:

```bash
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL 16 + PostGIS on 5433, Redis on 6379
bun run db:setup                                 # db:generate, then db:bootstrap
bun run dev                                      # http://localhost:3000
```

`bun run db:bootstrap` (`scripts/setup/bootstrap-dev-db.ts`) enables PostGIS (`CREATE EXTENSION postgis`), pushes the
Prisma schema and runs the reference-catalog seeds. It refuses to run when `NODE_ENV` is `production`, when
`DATABASE_URL` points at a non-local host (unless `--allow-remote`), or when the database already holds countries or
users. `bun run dev:db` (setup, then dev) and `bun run fresh` (clean reinstall, then setup) use the same path.

Then:

1. Sign in, and create a nation in the app at `/builder`. The bootstrap seeds no countries.
2. To become an admin, add your Clerk user id to `SYSTEM_OWNER_IDS` in `.env.local` and run
   `bun run set-admin-role`.

## Part 5 — Database Modes & Local Edits

The local Next.js dev server supports two distinct database connection modes depending on how you edit your environment files:

### Mode A: Read-Write Mode (Recommended for testing and active development)
To create countries, manage sports clubs, trade cards, or save stashes, configure local write access:
1. Create or edit `.env.local` (or modify `.env.local.dev`) in the repository root:
   ```ini
   DATABASE_READONLY="false"
   DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5433/ixstats?connection_limit=5"
   ```
   *(Note: The password is URL-encoded and connects as the `postgres` superuser on your local Docker container).*
2. Under this mode, `bun run dev` (`start-development.sh`) runs `bun run db:push:force` on boot whenever a `prisma/schema/*.prisma` file is newer than `.prisma/.schema-push-stamp`, so pulling a schema change updates your local database (set `SKIP_DB_PUSH=1` to skip it).

### Mode B: Read-Only Mode (Production Replica Inspection)
To inspect production data securely without making modifications:
1. Ensure `.env.local.dev` is configured with:
   ```ini
   DATABASE_READONLY="true"
   DATABASE_URL="postgresql://ixstats_readonly:PASSWORD@localhost:5433/ixstats"
   ```
2. Create the `ixstats_readonly` login role inside your local docker container (`./scripts/refresh-local-db.sh` also creates it if it is missing — with login only when `IXSTATS_READONLY_PASSWORD` is set, e.g. `IXSTATS_READONLY_PASSWORD='…' ./scripts/refresh-local-db.sh`). Use the password from your `.env.local.dev`; never paste it into docs:
   ```bash
   docker exec -it ixstats-postgres psql -U postgres -d ixstats -c "CREATE ROLE ixstats_readonly WITH LOGIN PASSWORD '<password from .env.local.dev>';"
   ```
3. Under this mode (`DATABASE_READONLY="true"`), the Prisma client blocks writes and `start-development.sh` skips its `db push`.

---

## Part 6 — Automated Workflow Scripts (maintainers)

Three automation scripts simplify daily WSL development. The first two need SSH access to the production server.

### 1. Unified Development Bootstrapper (`bun run dev:local`)
Instead of running Docker, SSH, and Next.js separately, run:
```bash
bun run dev:local
```
This runs the internal [dev-local.sh](../../scripts/dev-local.sh) script, which:
- Opens a background OpenSSH master connection to `ixwiki` (which brings up the `LocalForward` tunnels).
- Runs `docker compose up -d` for the local Postgres (`5433`) container; `start-development.sh` then starts the `ixstats-redis-cache` Redis container (`6379`) via `scripts/setup-redis.sh`.
- Pulls and restores a production database dump **only** when you pass `--sync-db` (or `-s`) or the local `ixstats` database does not exist yet; otherwise it keeps your existing local data.
- **Rsyncs Gitignored Static Assets:** Automatically runs `rsync` to sync flags, fonts, textures, sounds, and public images from the VPS, excluding uploads to save bandwidth.
- **Runs Schema Reconciler:** Hands off to `start-development.sh`, which runs `db:push:force` (Write Mode only) when the schema changed or the dump was just restored.
- Launches the Next.js dev server on `http://localhost:3000` (Turbopack) via `start-development.sh`.
- Cleans up and kills background OpenSSH tunnel processes gracefully on exit (`Ctrl+C`).

### 2. Manual Data Refresh (`./scripts/refresh-local-db.sh`)
To fetch a fresh production database dump, sync static assets, run `db:push:force` and the WikiOS integrity check without restarting the dev server:
```bash
./scripts/refresh-local-db.sh
```

### 3. Automated Local Deployment (`bun run deploy:local`)
Run code quality checks and push local work to staging/production in one line:
```bash
bun run deploy:local
```
This script runs the [deploy-local.sh](../../scripts/deploy-local.sh) wrapper, which:
- Verifies code formatting with Prettier (`bun run format:check`).
- Runs Oxlint (`bun run lint`).
- Runs the Jest suite (`bun run test`).
- Pushes the active branch to GitHub (`origin`).
- Logs into the VPS and runs `./scripts/deploy-production.sh`, which deploys the **server** checkout's branch (not necessarily the branch you just pushed) and refuses anything but `master` unless `ALLOW_NON_MASTER_DEPLOY=1` is set (for rollbacks only).

---

## Troubleshooting & FAQ

#### 1. Why are my sports/club pages returning 404 for silhouettes or images?
Because `public/` files are gitignored. Run `bun run dev:local` or `./scripts/refresh-local-db.sh` while connected to the VPN/VPS to automatically download them via `rsync`.

#### 2. Stunnel/SSH Error: `bind [127.0.0.1]:13001: Address already in use`
This means another shell or a Windows app (like PuTTY or WSL session) is already forwarding these ports. You can ignore this warning; the dev server will successfully route traffic over the existing tunnels.

#### 3. Error: `DATABASE_URL is not configured` during prisma commands
Prisma 6 does not autoload `.env` files when a config file is present, so `prisma.config.ts` loads them itself: when `DATABASE_URL` is unset it reads `.env.local.dev`, then `.env.local`, then `.env`, stopping at the first that sets it. If you still see this error, none of those files sets `DATABASE_URL`; add it to `.env.local` (see Part 3 Step 2).

#### 4. The `vmmem` process is consuming too much Windows RAM
WSL's virtualization process can grow large. You can restrict it by adjusting the `memory=` cap inside `C:\Users\<YourUsername>\.wslconfig` and executing `wsl --shutdown` in PowerShell to clear the cache.

# Comprehensive WSL2 Local Development Setup Guide

Welcome to the IxStates local development guide. This document details how to set up, configure, and run the entire development stack on your local Windows machine using Windows Subsystem for Linux (WSL2), Docker, and SSH port forwarding.

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

## Part 2 — SSH and Tunnels Configuration

OpenSSH inside WSL is the primary utility to establish tunnels, transfer files via `scp`, and pull production DB backups.

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
Inside WSL, clone the repository into your home directory and switch to the active integration branch, `rose-garden`:
```bash
mkdir -p ~/projects && cd ~/projects
git clone https://github.com/algolds/ixstats.git
cd ixstats && git checkout rose-garden
git config core.autocrlf input
```

### Step 2 — Fetch Gitignored Configuration Files
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

## Part 4 — Database Modes & Local Edits

The local Next.js dev server supports two distinct database connection modes depending on how you edit your environment files:

### Mode A: Read-Write Mode (Recommended for testing and active development)
To create countries, manage sports clubs, trade cards, or save stashes, configure local write access:
1. Create or edit `.env.local` (or modify `.env.local.dev`) in the repository root:
   ```ini
   DATABASE_READONLY="false"
   DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5433/ixstats?connection_limit=5"
   ```
   *(Note: The password is URL-encoded and connects as the `postgres` superuser on your local Docker container).*
2. Under this mode, `start-development.sh` runs `bun run db:push:force` on boot whenever a `prisma/schema/*.prisma` file is newer than `.prisma/.schema-push-stamp` (set `SKIP_DB_PUSH=1` to skip it).

### Mode B: Read-Only Mode (Production Replica Inspection)
To inspect production data securely without making modifications:
1. Ensure `.env.local.dev` is configured with:
   ```ini
   DATABASE_READONLY="true"
   DATABASE_URL="postgresql://ixstats_readonly:PASSWORD@localhost:5433/ixstats"
   ```
2. Create the `ixstats_readonly` login role inside your local docker container (`./scripts/refresh-local-db.sh` also creates it if it is missing). Use the password from your `.env.local.dev`; never paste it into docs:
   ```bash
   docker exec -it ixstats-postgres psql -U postgres -d ixstats -c "CREATE ROLE ixstats_readonly WITH LOGIN PASSWORD '<password from .env.local.dev>';"
   ```
3. Under this mode (`DATABASE_READONLY="true"`), the Prisma client blocks writes and `start-development.sh` skips its `db push`.

---

## Part 5 — Automated Workflow Scripts

Three automation scripts simplify daily WSL development:

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
- Logs into the VPS and runs `./scripts/deploy-production.sh`, which deploys whatever branch the **server** checkout is on (not necessarily the branch you just pushed).

---

## Troubleshooting & FAQ

#### 1. Why are my sports/club pages returning 404 for silhouettes or images?
Because `public/` files are gitignored. Run `bun run dev:local` or `./scripts/refresh-local-db.sh` while connected to the VPN/VPS to automatically download them via `rsync`.

#### 2. Stunnel/SSH Error: `bind [127.0.0.1]:13001: Address already in use`
This means another shell or a Windows app (like PuTTY or WSL session) is already forwarding these ports. You can ignore this warning; the dev server will successfully route traffic over the existing tunnels.

#### 3. Error: `DATABASE_URL is not configured` during prisma commands
Prisma 6 does not autoload `.env` variables if a config file (`prisma.config.ts`) is present. Sourcing environment variables via `set -a && source .env && set +a` exports the variables to the terminal environment first. Our automation scripts handle this internally.

#### 4. The `vmmem` process is consuming too much Windows RAM
WSL's virtualization process can grow large. You can restrict it by adjusting the `memory=` cap inside `C:\Users\<YourUsername>\.wslconfig` and executing `wsl --shutdown` in PowerShell to clear the cache.

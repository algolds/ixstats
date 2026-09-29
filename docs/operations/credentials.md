# Credential Management & Security Guide

## Table of Contents
1. [Security Overview](#security-overview)
2. [Required Credentials](#required-credentials)
3. [Environment Setup](#environment-setup)
4. [Credential Rotation](#credential-rotation)
5. [Security Best Practices](#security-best-practices)
6. [Emergency Response](#emergency-response)

---

## Security Overview

`src/env.ts` is the authoritative list of environment variables and says which are required in production. The app refuses to start in production without `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CRON_SECRET` (≥32 chars), `IXTIME_BOT_SECRET` and `WIKI_SYNC_WEBHOOK_SECRET` (≥32 chars).

## Files That Are Safe to Commit

`.gitignore` ignores `.env` and every `.env.*` file except `.env.example`.

✅ **Safe to commit (contain no secrets):**
- `.env.example` - Template with placeholder values (the only tracked env file)

❌ **NEVER commit (gitignored; may contain real values):**
- `.env` - Shared defaults
- `.env.local.dev` / `.env.local` - Your local development settings and secrets
- `.env.production` - Production values (loaded by the production scripts)
- `.env.production.local` - Production secrets
- Any file containing actual API keys, tokens, or passwords

---

## Required Credentials

### 1. Clerk Authentication

**Purpose:** User authentication and authorization

**Development Keys:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Starts with `pk_test_`
- `CLERK_SECRET_KEY` - Starts with `sk_test_`

**Production Keys:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Starts with `pk_live_`
- `CLERK_SECRET_KEY` - Starts with `sk_live_`

**Where to get them:**
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to "API Keys"
4. Copy keys from "Development" or "Production" section

**Security Level:** CRITICAL - These keys provide full access to user authentication

### 2. Discord Bot Integration

**Purpose:** IxTime synchronization, Discord image proxy, IxTwitter sync and guild member sync

**Keys (see `src/env.ts`):**
- `DISCORD_BOT_TOKEN` - Bot authentication token (image proxy, IxTwitter sync)
- `DISCORD_CLIENT_ID` - Application (client) ID
- `DISCORD_GUILD_ID` - Guild used for member sync
- `IXTIME_BOT_SECRET` - Shared secret the bot sends to `/api/ixtime/sync-from-bot` (**required in production**)
- `BOT_API_KEY` - Key the bot sends to `/api/bot/lorewards/sync`

**Where to get them:**
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application (or create one)
3. Navigate to "Bot" section for `DISCORD_BOT_TOKEN`
4. Navigate to "General Information" for the application (client) ID
5. Generate `IXTIME_BOT_SECRET` and `BOT_API_KEY` yourself (`openssl rand -hex 32`) and give the bot the same values

**Security Level:** HIGH - Provides access to Discord bot functionality

### 3. Discord Webhooks (Optional but Recommended)

**Purpose:** Production monitoring, error logging, and alerts

**Required Keys:**
- `DISCORD_WEBHOOK_URL` - Webhook endpoint URL

**Where to get them:**
1. Go to your Discord server
2. Navigate to Channel Settings → Integrations → Webhooks
3. Create a new webhook or copy existing webhook URL

**Security Level:** MEDIUM - Can post messages to Discord channel

### 4. Cron Job Security

**Purpose:** Authenticates the HTTP cron triggers (`/api/cron/*`, `Authorization: Bearer <CRON_SECRET>`). Scheduled jobs themselves run inside `cron-runner.mjs` (PM2 `ixstats-cron`) and need no secret.

**Required Keys:**
- `CRON_SECRET` - Random secure token, at least 32 characters (**required in production**)

**How to generate:**
```bash
openssl rand -hex 32
```

**Security Level:** HIGH - Prevents unauthorized execution of scheduled jobs

### 4b. Wiki Webhook Secret

**Purpose:** Shared secret MediaWiki sends to `/api/wiki/sync-webhook` and `/api/wikios/inbound-sync` (header `x-wiki-webhook-secret` or `Authorization: Bearer`).

**Required Keys:**
- `WIKI_SYNC_WEBHOOK_SECRET` - at least 32 characters (**required in production**); generate with `openssl rand -hex 32`

**Security Level:** HIGH - Lets the caller trigger wiki syncs

### 5. Database Credentials

> **Migration Note (October 2025)**: IxStats has migrated from SQLite to PostgreSQL for all environments.

**Development:**
- `DATABASE_URL="postgresql://ixstats:PASSWORD@localhost:5433/ixstats?schema=public"`

**Production:**
- `DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"`

**Where to get them:**
- From your PostgreSQL hosting provider (Railway, Supabase, etc.)
- Or from your infrastructure team if self-hosted

**Security Level:** CRITICAL - Provides full database access

### 6. Redis (Optional - Production Recommended)

**Purpose:** Rate limiting, caching, and the ThinkPages cross-process broadcast bridge (web app → `ixstats-ws`)

**Required Keys:**
- `REDIS_ENABLED="true"` - Redis is ignored unless this is set
- `REDIS_URL` - Redis connection string

**Format:**
```
redis://[username:password@]host:port/database
```

**Security Level:** MEDIUM - Used for non-critical caching and rate limiting

---

## Environment Setup

### Development Environment

**Option 1: Using `.env.local` (Recommended)**

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your development credentials:
   ```bash
   # Clerk Development Keys
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your_actual_key_here"
   CLERK_SECRET_KEY="sk_test_your_actual_secret_here"

   # Discord Bot (if needed for local development)
   DISCORD_BOT_TOKEN="your_actual_token_here"
   DISCORD_CLIENT_ID="your_app_id_here"
   IXTIME_BOT_SECRET="your_generated_secret_here"

   # Cron Secret
   CRON_SECRET="your_generated_secret_here"
   ```

3. Verify `.env.local` is in `.gitignore`:
   ```bash
   grep "\.env\.local" .gitignore
   ```

**Option 2: Using Environment Variables**

Set environment variables in your shell:
```bash
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your_key"
export CLERK_SECRET_KEY="sk_test_your_secret"
# ... etc
```

### Production Environment

**For Platform Deployments (Vercel, Railway, etc.):**

1. Go to your deployment platform dashboard
2. Navigate to Environment Variables or Settings
3. Add all required production variables:
   - Use `pk_live_*` and `sk_live_*` for Clerk
   - Use production database URL
   - Add `CRON_SECRET`, `IXTIME_BOT_SECRET` and `WIKI_SYNC_WEBHOOK_SECRET`
   - Add Discord webhook URL (optional but recommended)

**For Self-Hosted Deployments:**

1. Create `.env.production.local` on your server:
   ```bash
   # DO NOT commit this file! Use .env.example as the reference for variable names.
   touch .env.production.local
   ```

2. Edit `.env.production.local` with actual production values

3. Ensure `.env.production.local` is NOT committed:
   ```bash
   git check-ignore .env.production.local
   # Should output: .env.production.local
   ```

4. Set appropriate file permissions:
   ```bash
   chmod 600 .env.production.local
   ```

---

## Credential Rotation

### When to Rotate Credentials

**Immediately rotate if:**
- Credentials were committed to version control
- Credentials were shared in unsecured channels (Slack, email, etc.)
- A team member with access leaves the organization
- You suspect credential compromise

**Regularly rotate (recommended schedule):**
- Clerk keys: Every 90 days
- Discord bot token: Every 180 days
- CRON_SECRET: Every 90 days
- Database passwords: Every 90 days

### How to Rotate Clerk Keys

**CRITICAL: This will break authentication until updated everywhere!**

1. **Generate new keys in Clerk Dashboard:**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com)
   - Navigate to "API Keys" → "Production"
   - Click "Create new key pair"
   - Copy the new keys immediately (secret key shown only once)

2. **Update production environment:**
   - Update environment variables in your deployment platform
   - OR update `.env.production.local` on your server

3. **Deploy the changes:**
   - Platform deployments: Deploy new environment variables
   - Self-hosted: Restart the application

4. **Verify authentication works:**
   - Test login functionality
   - Check error logs for authentication issues

5. **Revoke old keys in Clerk Dashboard:**
   - Only after confirming new keys work
   - Go to "API Keys" → Click "Revoke" on old keys

### How to Rotate Discord Bot Token

1. **Generate new token:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Select your application → "Bot" section
   - Click "Reset Token"
   - Copy the new token immediately

2. **Update environment variables:**
   - Update `DISCORD_BOT_TOKEN` in production environment

3. **Restart bot and application:**
   - Restart Discord bot service
   - Restart IxStats application

### How to Rotate CRON_SECRET

1. **Generate new secret:**
   ```bash
   openssl rand -hex 32
   ```

2. **Update environment variables:**
   - Update `CRON_SECRET` in production environment

3. **Update cron job configuration:**
   - Update the `Authorization: Bearer` header of anything that calls `/api/cron/*` (external cron service or manual `curl`)
   - `cron-runner.mjs` jobs call no HTTP endpoint and need no change

4. **Restart application**

---

## Security Best Practices

### General Principles

1. **Never commit secrets to version control**
   - Always use `.env.*.local` files or environment variables
   - Review commits before pushing
   - Use pre-commit hooks to scan for secrets

2. **Use different credentials for different environments**
   - Development: Test keys (pk_test_*, sk_test_*)
   - Production: Live keys (pk_live_*, sk_live_*)
   - Never use production credentials in development

3. **Limit credential access**
   - Only share credentials with team members who need them
   - Use role-based access control in services like Clerk
   - Use secrets management services for team access

4. **Monitor credential usage**
   - Enable audit logging in Clerk Dashboard
   - Monitor Discord bot activity
   - Set up alerts for unusual authentication patterns

5. **Use secure transmission methods**
   - Share credentials via encrypted channels (1Password, Bitwarden, etc.)
   - Never share credentials via email, Slack, or SMS
   - Use temporary secure sharing links when possible

### Development Workflow

1. **Onboarding new developers:**
   ```bash
   # 1. Clone repository
   git clone <repo-url>
   cd ixstats

   # 2. Copy example environment file
   cp .env.example .env.local

   # 3. Request development credentials from team lead
   # (via secure channel - 1Password, Bitwarden, etc.)

   # 4. Add credentials to .env.local

   # 5. Verify .env.local is gitignored
   git check-ignore .env.local

   # 6. Install dependencies and start development
   bun install
   bun run dev
   ```

2. **Before committing:**
   ```bash
   # Check for accidentally staged environment files
   git status

   # Verify no secrets in staged files
   git diff --cached

   # If .env files are staged, unstage them
   git reset .env.local .env.production.local
   ```

### Production Deployment

1. **Use platform environment variables:**
   - Vercel: Project Settings → Environment Variables
   - Railway: Project → Variables
   - Heroku: Settings → Config Vars

2. **For self-hosted deployments:**
   ```bash
   # Create secure environment file
   nano .env.production.local

   # Set restrictive permissions
   chmod 600 .env.production.local
   chown www-data:www-data .env.production.local  # or your app user

   # Verify permissions
   ls -la .env.production.local
   # Should show: -rw------- 1 www-data www-data
   ```

3. **Use secrets management services (recommended for teams):**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Google Cloud Secret Manager
   - Azure Key Vault

---

## Emergency Response

### If Credentials Are Compromised

**Immediate Actions (within 1 hour):**

1. **Rotate all compromised credentials immediately**
   - Follow rotation procedures above
   - Don't wait for scheduled rotation

2. **Revoke old credentials**
   - Clerk: Revoke keys in dashboard
   - Discord: Reset bot token
   - Database: Change passwords

3. **Notify team members**
   - Alert all developers
   - Update documentation
   - Schedule post-mortem

4. **Review access logs**
   - Clerk: Check authentication logs
   - Discord: Review bot activity
   - Database: Check query logs
   - Application: Review audit logs

5. **Monitor for suspicious activity**
   - Watch for unusual login attempts
   - Monitor API usage
   - Check for data exfiltration

**Follow-up Actions (within 24 hours):**

1. **Identify root cause**
   - How were credentials exposed?
   - Who had access?
   - What systems were affected?

2. **Implement preventive measures**
   - Update security policies
   - Add pre-commit hooks
   - Improve secrets management
   - Additional team training

3. **Document incident**
   - Create incident report
   - Update runbooks
   - Share lessons learned

### If Credentials Were Committed to Git

**CRITICAL: Git history retains committed secrets forever unless actively removed!**

1. **Immediately rotate credentials** (don't wait)

2. **Remove secrets from git history:**
   ```bash
   # Option 1: Using git-filter-repo (recommended)
   # Install: pip install git-filter-repo
   git filter-repo --path .env.production --invert-paths

   # Option 2: Using BFG Repo Cleaner
   # Download from: https://rtyley.github.io/bfg-repo-cleaner/
   java -jar bfg.jar --delete-files .env.production

   # After cleaning, force push (coordinate with team!)
   git push origin --force --all
   git push origin --force --tags
   ```

3. **Notify team members to re-clone:**
   ```bash
   # Team members should delete and re-clone
   cd ..
   rm -rf ixstats
   git clone <repo-url>
   ```

4. **If repository is public, assume credentials are compromised**
   - Rotate immediately
   - Consider deleting and recreating repository
   - Update all dependent services

---

## Quick Reference

### Generate Random Secrets

```bash
# Strong random secret (64 characters hex)
openssl rand -hex 32

# Alternative: base64 encoded (stronger)
openssl rand -base64 32

# Alternative: using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Verify Environment Setup

```bash
# Check which .env files exist
ls -la .env*

# Verify .env.local is gitignored
git check-ignore .env.local

# Check for secrets in staged files
git diff --cached | grep -E "(CLERK_SECRET|DISCORD.*TOKEN|PASSWORD)"

# Validate environment variables
bun run verify:environment   # scripts/deployment/verify-environment.ts
bun run auth:check           # Clerk key sanity check
```

### Emergency Contacts

- **Security Issues:** security@ixwiki.com (if applicable)
- **Clerk Support:** https://clerk.com/support
- **Discord Support:** https://discord.com/safety

---

## Additional Resources

- [Clerk Security Best Practices](https://clerk.com/docs/security)
- [Discord Bot Security](https://discord.com/developers/docs/topics/oauth2#bot-security)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Git Secret Management](https://gitleaks.io/)

---

**Last Updated:** September 2026
**Maintained By:** IxStats Development Team
**Review Schedule:** Quarterly

# Deploy runbook: beta feedback (2026-10)

The deploy notes for the beta tester feedback batch (branch `feat/beta-feedback`): the bug fixes and the fifteen
features. Its schema is one hand-written, idempotent file, `prisma/migrations/20261106120000_beta_feedback/migration.sql`,
and the deploy script runs it. Nothing in this runbook is run by hand.

| Step | When | What |
| --- | --- | --- |
| 1 | Before the deploy | Backup, disk room |
| 2 | The deploy | `./scripts/deploy-production.sh` (the SQL runs inside it, before the build) |
| 3 | Between the SQL and the PM2 reload | The window: some saves error on the old server |
| 4 | After the reload | Checks |
| – | If needed | Rollback |

## 1. Before the deploy

1. `df -h /` must show room for a dump and a build (a full root disk puts Postgres into recovery mode).
2. `bun run db:backup`. Keep the dump's path: it is the rollback point.

## 2. The deploy

Run the deploy script: `./scripts/deploy-production.sh` ([release guide A4](../../operations/release-guide.md#a4-build-and-deploy)).
It applies `20261106120000_beta_feedback` right after `20261105120001_wikios_sync_dead_letters`, before its `db push`
and the build. The file is one transaction and a no-op once applied, so a re-run changes nothing. It:

- adds `lore_stash_items.source` (default `ixwiki`, which every existing item is) and swaps the stash key
  `(stashId, contentType, pageTitle)` for `(stashId, contentType, source, pageTitle)`, so one stash can hold the same
  title once per wiki. The new key is strictly weaker, so no existing row can violate it;
- adds `ThinkpagesAccount.sortOrder` (null until an owner reorders their accounts) and its index;
- creates `realm_founders` (founding members credited in the realm header; a credit only, never read for permissions);
- adds `wiki_links.targetTitle`, the canonical title a link names. Links stored before it keep it null.

No data script runs. One cron change goes with this release (owner ruling, 2026-10-30): add `exchange-market` and
`exchange-contract-expiry` to `CRON_ENABLED_JOBS` in the PM2 `ixstats-cron` app's environment, then
`pm2 restart ixstats-cron --update-env`. The market tick moves the sector indices every 6 hours; the expiry job
refunds the escrow of contracts left unawarded 3 days after bidding closes ([exchange.md](../../systems/exchange.md)).

## 3. The window

Between the deploy SQL and the PM2 reload, saving to a stash, watching a page, Margin notes, forum thread stash and
Onoma name stash error on the old server; nothing is lost; retry after the reload. The old build writes stash items by
the key the SQL replaced. Everything else keeps working on the old build: it ignores the new columns and table.

## 4. After the reload

1. **Schema.** Expect `t|t|t|t|t|t`:

   ```bash
   docker exec ixstats-postgres psql -U postgres -d ixstats -tAc "SELECT
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lore_stash_items' AND column_name = 'source'),
     to_regclass('public.\"lore_stash_items_stashId_contentType_source_pageTitle_key\"') IS NOT NULL,
     to_regclass('public.\"lore_stash_items_stashId_contentType_pageTitle_key\"') IS NULL,
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ThinkpagesAccount' AND column_name = 'sortOrder'),
     to_regclass('public.realm_founders') IS NOT NULL,
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wiki_links' AND column_name = 'targetTitle');"
   ```

2. **The admin rule changed.** `/admin` now follows the one admin rule (`isAdminRole`, the rule `adminProcedure`
   applies) on the user's database role: a role named owner, admin or staff, or any role at staff level (20) or less.
   It no longer reads the Clerk `publicMetadata.role`. Staff at level 20 or less now reach `/admin`; someone who was let
   in only by the Clerk metadata and has no such database role is now sent home with `error=access_denied`. A database
   error while reading the role denies too (the same redirect, never a 503); the system owner is let in before any read.
   List who passes:

   ```bash
   docker exec ixstats-postgres psql -U postgres -d ixstats -c "SELECT u.\"clerkUserId\", r.name, r.level
     FROM \"User\" u JOIN \"Role\" r ON r.id = u.\"roleId\"
     WHERE r.name IN ('owner', 'admin', 'staff') OR r.level <= 20 ORDER BY r.level;"
   ```

   Then open `/admin` as one of them, and as a signed-in user who is not listed (expect the home page with the access
   denied notice).
3. **Stashes.** Stash an IxWiki page and a sister-wiki page with the same title into one stash: both stay, and only
   the IxWiki item shows a thumbnail. Stash a forum thread and an Onoma name. Watch a page and write a Margin note.
4. **Wanted pages.** WikiOS utilities, Wanted pages: titles read as written for links whose source page rendered after
   the deploy; older links read as their slug with a capital first letter until their source renders again.

## Rollback

The SQL is additive apart from the stash key, so the previous build runs on the new schema except for stash writes,
which need the old key. Roll back with the step 1 dump (it holds the old key) and the previous build
([release guide](../../operations/release-guide.md#rollback)). Never recreate the old key by re-running
`prisma/manual-migrations/2026-09-30-wikios-stash-key.sql`: it is superseded by this migration, it fails once a stash
holds one title from two wikis, and on the new build it would refuse those saves.

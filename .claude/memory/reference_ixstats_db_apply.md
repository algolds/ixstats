---
name: reference-ixstats-db-apply
description: "How to safely apply Prisma schema changes to the ixstats DB (db push, NOT migrate)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 27047d24-f1ef-4183-87b7-a52d19c2ccb4
---

The ixstats dev DB (`localhost:5433`, dockerized `ixstats-postgres`, db name `ixstats`) holds
**production data (~82 nations)** and is **`db push`-managed** — the `prisma/migrations/` history is
heavily DRIFTED from the live schema. **NEVER run `prisma migrate dev`** here: it detects the drift and
wants to RESET the schema ("All data will be lost"). package.json guards `db:migrate`, `db:push`,
`db:reset` (require `:force`) and permanently blocks `db:reset` for exactly this reason.

**Safe apply of an ADDITIVE schema change:**
1. Prisma CLI does NOT auto-load env (see `prisma.config.ts`). Source it first:
   `set -a; source .env 2>/dev/null; set +a`  (`.env` = dev DB; `.env.production.local` = prod).
2. Preview the exact SQL, read-only (no apply):
   `bunx prisma migrate diff --from-schema-datasource prisma/schema --to-schema-datamodel prisma/schema --script`
   Confirm it's additive only (ADD COLUMN/CONSTRAINT, no DROP / no data loss).
3. Apply: `bunx prisma db push` (additive → no data-loss prompt; in non-TTY it errors rather than
   dropping). Then `bunx prisma generate`.
4. Data backfills: write a `--dry-run`-default script under `scripts/`, preview, then `--apply`.

Used for [[project-maps-mycountry-integration]] Phase A (worked cleanly, additive-only diff).

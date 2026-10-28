# Manual migrations

Hand-written SQL (and one procedure) that an operator applies by hand, with `psql`, never through `prisma db push` or
`prisma migrate`. They are mostly WikiOS's: tables, columns, sequences, triggers and backfills that Prisma's push
cannot express or must not own (partial and expression indexes, `BEFORE INSERT` triggers, data backfills).

## Who runs what

- **`scripts/deploy-production.sh` runs nothing from this directory.** The SQL the deploy runs itself lives in
  `prisma/migrations/<timestamp>_<name>/migration.sql` and `scripts/migrations/` (the list is in
  [release guide A4](../../docs/operations/release-guide.md#a4-build-and-deploy)); `scripts/refresh-local-db.sh` and
  `start-development.sh` run the same deploy list, not these files.
- **Everything here is hand-run**, by the steps of the runbook that introduced it. For WikiOS that is
  [cutover step 1](../../docs/history/operations/wikios-v1-cutover.md#1-apply-the-wikios-sql-migrations): back up
  (`bun run db:backup`), then follow `2026-09-30-wikios-canonical-titles.md` (a procedure, not SQL, run first), then
  apply every `*wikios*.sql` in filename order, except `2026-09-30-wikios-lead-image-canonical-path.sql`, which runs
  once after the code is deployed (cutover step 5b, optional):

  ```bash
  for f in $(ls prisma/manual-migrations/*wikios*.sql | grep -v lead-image-canonical-path | sort); do
    echo "== $f"
    docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 < "$f" || break
  done
  ```

## Status on production

The WikiOS files were applied for the WikiOS v1 launch on 2026-10-26/27, before the release's deploy
(`2026-09-30-wikios-api.sql` had to run before the push: the deploy's `20261105120000_wikios_conflicts` labels
revisions from the `revId` it fills). After the corpus was imported with `scripts/wikios-import-xml.ts`, the same
step-1 loop was run again so the backfills (redirects, rights, revision parents, ids) covered the imported rows.
Live operations: [WikiOS operations](../../docs/systems/wikios/operations.md).

## Rules

- **Idempotent.** Every file is safe to run twice: `IF NOT EXISTS`, guarded `DO` blocks and backfills that only touch
  rows still missing their value. Re-running the loop after an import or a restore is the intended use.
- **Read before applying.** Each file's header says what it does, when to run it and what must come first.
- **Never edit a file that has been applied.** Production (and every developer database restored from it) already
  ran it; a change would not run there, and the next reader would trust a file that no longer matches the database.
  Fix forward with a new, dated file (`YYYY-MM-DD-<area>-<what>.sql`) that is itself idempotent.
- **Take a backup first** (`bun run db:backup`); rollback is restoring that dump into a scratch database and checking
  it before touching production.

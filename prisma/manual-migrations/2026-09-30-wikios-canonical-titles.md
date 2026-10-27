# WikiOS canonical titles (plan 403): operator steps

No hand-written SQL: the fix is generated from `canonicalizeTitle` itself
(`src/lib/wiki-os/core/title.ts`), so it can never disagree with what the app writes. The schema is
unchanged.

1. Back up the table: `pg_dump -t wiki_articles <database> > wiki_articles.sql`.
2. Preview: `bun scripts/audit/wikios-title-duplicates.ts` (read-only; sections a-d).
3. Generate: `bun scripts/audit/wikios-title-duplicates.ts --emit-sql > fix.sql`. stdout is the SQL
   only (logs go to stderr). The script reads `DATABASE_URL` and refuses anything but `localhost:5433`.
4. Review `fix.sql`, then apply it: `psql <database> -f fix.sql`.
   - Each `UPDATE` sets title, slug, namespace and "namespacePrefix" for one row, guarded by the
     row's id and current title (a rename is also guarded by the target title still being free), so
     the file is safe to re-run.
   - A row in a namespace the canonical table does not know (MediaWiki's `Portal:`, say) keeps the
     namespace id it has; another wiki's rows (`source` other than `ixwiki`) get no IxWiki namespace.
5. The end of `fix.sql` lists, as comments, what it did **not** change: collision groups (several
   rows that are one page once canonicalized, such as "foo bar" and "Foo bar": keep one, move its
   revisions to it, delete the rest) and titles MediaWiki would refuse. Handle those by hand, then
   re-run steps 3-4 until the collision and invalid lists are empty.

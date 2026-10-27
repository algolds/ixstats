/** @jest-environment node */
// WikiOS data safety: the conflict-log migration also records where each existing revision was saved
// (`wiki_revisions.origin`). MediaWiki ids order only classic revisions, so a WikiOS save the mirror stamped must never be
// backfilled as classic: the backfill keys on api.php's revId (a MediaWiki row's revId is its mwRevId, a WikiOS save keeps
// its own sequence number after stamping), never on the author (imported classic rows are tagged with an account too).
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SQL = readFileSync(
  join(process.cwd(), "prisma/migrations/20261105120000_wikios_conflicts/migration.sql"),
  "utf8"
)
  .replace(/--.*$/gm, "")
  .replace(/\s+/g, " ");

/** The `origin` block: from its column check to the end of its DO body. */
const originBlock =
  /DO \$\$ BEGIN IF NOT EXISTS .*?column_name = 'origin'.*?END \$\$/.exec(SQL)?.[0] ?? "";
/** Each backfill statement of the block. */
const backfills =
  originBlock.match(/UPDATE "wiki_revisions" r SET "origin" = 'classic' WHERE [^;]*/g) ?? [];

describe("20261105120000_wikios_conflicts/migration.sql: the origin backfill", () => {
  it("adds the column, and backfills, only when the column is missing from this schema", () => {
    expect(originBlock).toContain("table_schema = current_schema()");
    expect(originBlock).toContain(
      `ALTER TABLE "wiki_revisions" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'wikios'`
    );
  });

  it("marks classic only a stamped row whose api.php revId is its MediaWiki id, when revId exists", () => {
    expect(originBlock).toContain("column_name = 'revId'");
    const byRevId = backfills.find((statement) => statement.includes(`"revId"`)) ?? "";
    expect(byRevId).toContain(`r."mwRevId" IS NOT NULL`);
    expect(byRevId).toContain(`r."revId" = r."mwRevId"`);
    expect(byRevId).not.toContain("IS NULL OR");
  });

  it("keeps every row a WikiOS save queued for the mirror as wikios, and never reads the author", () => {
    expect(backfills).toHaveLength(2);
    for (const statement of backfills) {
      expect(statement).toContain(`r."mwRevId" IS NOT NULL`);
      expect(statement).toContain(`j."kind" = 'revision' AND j."revisionId" = r."id"`);
      expect(statement).not.toContain("author");
    }
  });
});

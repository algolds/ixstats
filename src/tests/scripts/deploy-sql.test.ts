/** @jest-environment node */
/**
 * The deploy re-runs every hand-written SQL file it names on each release. Each must be a no-op the second time, stop
 * the deploy when it fails, and run after the backup. SQL that drops a table or converts a column type runs before
 * db push, which would otherwise refuse the drop or drop and re-add the column. The dev scripts (start-development.sh,
 * scripts/refresh-local-db.sh) run the same before-push steps in the deploy's order and stop before their push when one
 * fails, and deploy-ixworld.sh copies data/ without the tile cache (the disk-fill incident).
 *
 * Folds dev-scripts-studio-sql and deploy-ixworld-data.
 */
import { existsSync, readFileSync } from "node:fs";

const script = readFileSync("scripts/deploy-production.sh", "utf8");
const runs = [
  ...script.matchAll(/prisma db execute --schema prisma\/schema --file (\S+\.sql)(.*)/g),
].map((m) => ({
  file: m[1]!,
  rest: m[2]!,
  at: m.index,
}));
const backup = script.indexOf("bun run db:backup");
const push = script.indexOf("bun run db:push:force");
const build = script.indexOf("bun run build");

const sql = (file: string) =>
  readFileSync(file, "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ");
/** What a re-run executes unguarded: DO blocks (which check before they act) and function bodies stripped. */
const unguarded = (file: string) =>
  sql(file)
    .replace(/DO \$\$.*?\$\$;/g, "")
    .replace(/\$\$.*?\$\$/g, "");

const UNSAFE = [
  /CREATE TABLE (?!IF NOT EXISTS)/i,
  /ADD COLUMN (?!IF NOT EXISTS)/i,
  /CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/i,
  /DROP (TABLE|COLUMN|INDEX|TYPE|TRIGGER|CONSTRAINT|FUNCTION) (?!IF EXISTS)/i,
  /CREATE (FUNCTION|TYPE)/i,
  /ADD CONSTRAINT/i,
  /RENAME (COLUMN|TO)/i,
];

describe("the SQL the deploy runs", () => {
  it.each(runs)(
    "$file runs after the backup and before the build, and a failure stops the deploy",
    (run) => {
      expect(existsSync(run.file)).toBe(true);
      expect(run.rest.trim()).toBe("|| exit 1");
      expect(run.at).toBeGreaterThan(backup);
      expect(run.at).toBeLessThan(build);
    }
  );

  it.each(runs)("$file is a no-op when the deploy runs it again", ({ file }) => {
    const body = unguarded(file);
    for (const pattern of UNSAFE) expect(body).not.toMatch(pattern);
    for (const [, name] of body.matchAll(/CREATE TRIGGER (\S+)/gi)) {
      expect(body.indexOf(`DROP TRIGGER IF EXISTS ${name}`)).toBeGreaterThanOrEqual(0);
      expect(body.indexOf(`DROP TRIGGER IF EXISTS ${name}`)).toBeLessThan(
        body.indexOf(`CREATE TRIGGER ${name}`)
      );
    }
  });

  it("runs SQL that drops a table or converts a column type before db push", () => {
    const destructive = runs.filter(({ file }) =>
      /DROP TABLE|ALTER COLUMN \S+ (SET DATA )?TYPE/i.test(sql(file))
    );
    expect(destructive.length).toBeGreaterThan(0);
    for (const run of destructive) expect(run.at).toBeLessThan(push);
  });

  it("backfills the cards between their additive SQL and the constraints that need the backfill", () => {
    const at = (needle: string) => script.indexOf(needle);
    const backfill = at("bun scripts/cards/backfill-cards-refresh.ts --apply || exit 1");
    expect(backfill).toBeGreaterThan(at("20261027120000_cards_foundations/migration.sql"));
    expect(backfill).toBeLessThan(at("20261027120001_cards_foundations_constraints/migration.sql"));
  });

  it("runs the card categories SQL after the economy SQL and before the push", () => {
    const at = (needle: string) => script.indexOf(needle);
    const categories = at("20261102120000_cards_categories/migration.sql");
    expect(categories).toBeGreaterThan(at("20261101120000_cards_economy/migration.sql"));
    expect(categories).toBeLessThan(push);
  });

  it("runs the IxnayID claims SQL after the card categories SQL and before the push", () => {
    const at = (needle: string) => script.indexOf(needle);
    const claims = at("20261103120000_ixnayid_claims/migration.sql");
    expect(claims).toBeGreaterThan(at("20261102120000_cards_categories/migration.sql"));
    expect(claims).toBeLessThan(push);
  });

  it("converts the IxWiki links after the claims SQL and before the push", () => {
    const at = (needle: string) => script.indexOf(needle);
    const convert = at("bun scripts/identity/convert-wiki-name-claims.ts --apply || exit 1");
    expect(convert).toBeGreaterThan(at("20261103120000_ixnayid_claims/migration.sql"));
    expect(convert).toBeLessThan(push);
  });

  it("deletes the IxWiki links after the conversion and before the push", () => {
    const at = (needle: string) => script.indexOf(needle);
    const drop = at("20261103120001_ixnayid_drop_legacy/migration.sql");
    expect(drop).toBeGreaterThan(at("bun scripts/identity/convert-wiki-name-claims.ts --apply"));
    expect(drop).toBeLessThan(push);
  });

  it("keeps one approved owner per wiki name in SQL, where Prisma cannot say it", () => {
    const body = sql("prisma/migrations/20261103120000_ixnayid_claims/migration.sql");
    expect(body).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "wiki_name_claims_one_approved_key"[\s\S]*WHERE "status" = 'APPROVED'/
    );
    expect(body).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "wiki_name_claims_one_pending_key"[\s\S]*WHERE "status" = 'PENDING'/
    );
  });
});

/** Each step that must run before db push: a hand-written SQL file, the cards backfill or the IxWiki link conversion. */
const STEP =
  /bunx prisma db execute --schema prisma\/schema --file (\S+\.sql)|bun (scripts\/(?:cards\/backfill-cards-refresh|identity\/convert-wiki-name-claims)\.ts --apply)/g;
const beforePush = (text: string) => {
  const pushAt = text.indexOf("bun run db:push:force");
  return [...text.matchAll(STEP)].filter((m) => m.index < pushAt).map((m) => (m[1] ?? m[2])!);
};

describe.each(["start-development.sh", "scripts/refresh-local-db.sh"])("%s", (file) => {
  const text = readFileSync(file, "utf8");

  it("runs the deploy's before-push steps, in the deploy's order, before its own db push", () => {
    expect(beforePush(text)).toEqual(beforePush(script));
  });

  it("does not go on to the push if a step fails", () => {
    const stepLines = text.split("\n").filter((line) => new RegExp(STEP.source).test(line));
    const stops = (line: string) =>
      // one && chain ending in the push, or a plain top-level command under set -e
      (line.includes("&& bun run db:push:force") && !/\|\||;\s*bun/.test(line)) ||
      (/^set -e/m.test(text) && /^(bunx|bun) /.test(line.trim()) && !line.includes("||"));
    expect(stepLines.length).toBeGreaterThan(0);
    expect(stepLines.filter((line) => !stops(line))).toEqual([]);
  });
});

describe("deploy-ixworld.sh, which the deploy runs", () => {
  it("excludes the default tile folder from the data/ rsync, which has no --delete", () => {
    expect(script).toContain("./scripts/deploy-ixworld.sh");
    const line = readFileSync("scripts/deploy-ixworld.sh", "utf8")
      .split("\n")
      .find((l) => /rsync .* data\/ "\$IXWORLD_DIR\/data\/"/.test(l));
    expect(line).toBeDefined();
    expect(line).toContain("--exclude '/cache/map-tiles'");
    expect(line).not.toContain("--delete");
  });
});

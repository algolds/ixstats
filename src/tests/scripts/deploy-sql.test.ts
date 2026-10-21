/** @jest-environment node */
/**
 * The deploy re-runs every hand-written SQL file it names on each release. Each must be a no-op the second time, stop
 * the deploy when it fails, and run after the backup. SQL that drops a table or converts a column type runs before
 * db push, which would otherwise refuse the drop or drop and re-add the column.
 */
import { existsSync, readFileSync } from "node:fs";

const script = readFileSync("scripts/deploy-production.sh", "utf8");
const runs = [...script.matchAll(/prisma db execute --schema prisma\/schema --file (\S+\.sql)(.*)/g)].map((m) => ({
  file: m[1]!,
  rest: m[2]!,
  at: m.index,
}));
const backup = script.indexOf("bun run db:backup");
const push = script.indexOf("bun run db:push:force");
const build = script.indexOf("bun run build");

const sql = (file: string) => readFileSync(file, "utf8").replace(/--[^\n]*/g, "").replace(/\s+/g, " ");
/** What a re-run executes unguarded: DO blocks (which check before they act) and function bodies stripped. */
const unguarded = (file: string) => sql(file).replace(/DO \$\$.*?\$\$;/g, "").replace(/\$\$.*?\$\$/g, "");

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
  it.each(runs)("$file runs after the backup and before the build, and a failure stops the deploy", (run) => {
    expect(existsSync(run.file)).toBe(true);
    expect(run.rest.trim()).toBe("|| exit 1");
    expect(run.at).toBeGreaterThan(backup);
    expect(run.at).toBeLessThan(build);
  });

  it.each(runs)("$file is a no-op when the deploy runs it again", ({ file }) => {
    const body = unguarded(file);
    for (const pattern of UNSAFE) expect(body).not.toMatch(pattern);
    for (const [, name] of body.matchAll(/CREATE TRIGGER (\S+)/gi)) {
      expect(body.indexOf(`DROP TRIGGER IF EXISTS ${name}`)).toBeGreaterThanOrEqual(0);
      expect(body.indexOf(`DROP TRIGGER IF EXISTS ${name}`)).toBeLessThan(body.indexOf(`CREATE TRIGGER ${name}`));
    }
  });

  it("runs SQL that drops a table or converts a column type before db push", () => {
    const destructive = runs.filter(({ file }) => /DROP TABLE|ALTER COLUMN \S+ (SET DATA )?TYPE/i.test(sql(file)));
    expect(destructive.length).toBeGreaterThan(0);
    for (const run of destructive) expect(run.at).toBeLessThan(push);
  });

  it("backfills the cards between their additive SQL and the constraints that need the backfill", () => {
    const at = (needle: string) => script.indexOf(needle);
    const backfill = at("bun scripts/cards/backfill-cards-refresh.ts --apply || exit 1");
    expect(backfill).toBeGreaterThan(at("20261027120000_cards_foundations/migration.sql"));
    expect(backfill).toBeLessThan(at("20261027120001_cards_foundations_constraints/migration.sql"));
  });
});

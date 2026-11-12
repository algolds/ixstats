/** @jest-environment node */
/**
 * The integer-cents conversion (plan 446) multiplies every Exchange ₷ amount by 100 as it retypes the column. db push
 * would retype the same columns with a plain cast and no ×100, so the SQL must be guarded (a re-run converts nothing)
 * and must run before the push in both the dev startup and the production deploy.
 */
import { readFileSync } from "node:fs";

const CENTS_FILE = "prisma/migrations/20261109120000_exchange_integer_cents/migration.sql";
const GUARD =
  "IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'exchange_wallets' AND column_name = 'sovereigns') = 'double precision' THEN";

const sql = readFileSync(CENTS_FILE, "utf8")
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim();

describe("the integer-cents migration", () => {
  it("is one DO block that converts only while the columns are still floats", () => {
    expect(sql.startsWith(`DO $$ BEGIN ${GUARD} `)).toBe(true);
    expect(sql.endsWith("END IF; END $$;")).toBe(true);
    expect(sql).not.toMatch(/\bCOMMIT;/);
  });

  it("keeps every ALTER TABLE inside the guard", () => {
    const guardAt = sql.indexOf(GUARD);
    const endIfAt = sql.lastIndexOf("END IF;");
    const alters = [...sql.matchAll(/ALTER TABLE "(\w+)"/g)];
    expect(alters).toHaveLength(19);
    for (const alter of alters) {
      expect(alter.index).toBeGreaterThan(guardAt);
      expect(alter.index).toBeLessThan(endIfAt);
    }
  });

  it.each(["start-development.sh", "scripts/deploy-production.sh"])(
    "runs in %s before the first db push",
    (path) => {
      const script = readFileSync(path, "utf8");
      const centsAt = script.indexOf(`prisma db execute --schema prisma/schema --file ${CENTS_FILE}`);
      const pushAt = script.indexOf("bun run db:push:force");
      expect(centsAt).toBeGreaterThan(-1);
      expect(pushAt).toBeGreaterThan(-1);
      expect(centsAt).toBeLessThan(pushAt);
    }
  );

  it("stops web, cron and websockets in the deploy while it is pending, and starts them at the reload", () => {
    const script = readFileSync("scripts/deploy-production.sh", "utf8");
    const detectAt = script.indexOf('if [ "$CENTS_COLUMN_TYPE" = "double precision" ]; then');
    const stopAt = script.indexOf("for app in ixstats-web ixstats-cron ixstats-ws; do");
    const centsAt = script.indexOf(`--file ${CENTS_FILE}`);
    const reloadAt = script.indexOf("pm2 startOrReload ecosystem.config.cjs");
    const restartAt = script.indexOf("for app in ${CENTS_STOPPED_APPS:-}; do");
    expect(detectAt).toBeGreaterThan(-1);
    expect(detectAt).toBeLessThan(stopAt);
    expect(stopAt).toBeLessThan(centsAt);
    expect(reloadAt).toBeGreaterThan(centsAt);
    expect(restartAt).toBeGreaterThan(reloadAt);
    expect(script.slice(restartAt, restartAt + 400)).toContain('pm2 start "$app" --update-env');
  });

  it("multiplies by 100 on every retype", () => {
    const retypes = [...sql.matchAll(/ALTER COLUMN "(\w+)" TYPE bigint USING ([^,;]+)/g)];
    expect(retypes.length).toBeGreaterThan(0);
    for (const [, column, using] of retypes) {
      expect(using!.trim()).toBe(`round("${column}" * 100)::bigint`);
    }
  });
});

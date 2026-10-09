/** @jest-environment node */
import fs from "fs";
import path from "path";
import { logModAction } from "~/server/modules/thinkpages-forum/mod-log";

/**
 * M16: the moderation log is append-only. Nothing in application code updates or deletes a ForumModLog row, through
 * Prisma or raw SQL (follow-up M12: all of src but the tests, scripts and the custom server); the follow-ups
 * migration's triggers that raise are the second line of defence.
 */
const ROOT = path.resolve(__dirname, "../../..");
const SCAN_ROOTS = [
  path.join(ROOT, "src"),
  path.join(ROOT, "scripts"),
  path.join(ROOT, "server.mjs"),
];
const SKIPPED = [path.join(ROOT, "scripts/archive"), path.join(ROOT, "src/tests")];
const FORBIDDEN_CALL = /forumModLog\s*\.\s*(update|updateMany|upsert|delete|deleteMany)\b/;
const FORBIDDEN_SQL =
  /\b(UPDATE|DELETE\s+FROM|TRUNCATE(\s+TABLE)?)\s+(ONLY\s+)?(public\.)?"?forum_mod_log\b/i;
const FORBIDDEN = { test: (text: string) => FORBIDDEN_CALL.test(text) || FORBIDDEN_SQL.test(text) };

function walk(dir: string): string[] {
  if (SKIPPED.includes(dir) || !fs.existsSync(dir)) return [];
  if (fs.statSync(dir).isFile()) return [dir];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
    return /\.(ts|tsx|mjs|cjs|js)$/.test(entry.name) ? [full] : [];
  });
}

describe("forum moderation log is append-only", () => {
  it("no app, server or script code updates or deletes a forumModLog row", () => {
    const offenders = SCAN_ROOTS.flatMap(walk).filter((file) =>
      FORBIDDEN.test(fs.readFileSync(file, "utf8"))
    );
    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
  });

  it("the guard recognises every forbidden call", () => {
    for (const call of ["update", "updateMany", "upsert", "delete", "deleteMany"]) {
      expect(FORBIDDEN.test(`tx.forumModLog.${call}({})`)).toBe(true);
    }
    expect(FORBIDDEN.test("tx.forumModLog.create({})")).toBe(false);
    expect(FORBIDDEN.test("db.forumModLog.findMany({})")).toBe(false);
  });

  it("the guard recognises raw SQL that changes the log, and leaves reads and inserts alone (M12)", () => {
    for (const sql of [
      'UPDATE "forum_mod_log" SET detail = NULL',
      "update forum_mod_log set action = 'x'",
      'DELETE FROM "forum_mod_log" WHERE id = $1',
      "TRUNCATE forum_mod_log",
      'TRUNCATE TABLE public."forum_mod_log"',
    ]) {
      expect(FORBIDDEN.test(sql)).toBe(true);
    }
    expect(FORBIDDEN.test('INSERT INTO "forum_mod_log" (id) VALUES ($1)')).toBe(false);
    expect(FORBIDDEN.test('SELECT * FROM "forum_mod_log"')).toBe(false);
  });

  it("scans the app code beyond src/server, and skips the tests (M12)", () => {
    const files = SCAN_ROOTS.flatMap(walk).map((file) => path.relative(ROOT, file));
    expect(files).toEqual(
      expect.arrayContaining([
        "src/lib/thinkpages-forum/moderation-policy.ts",
        "src/app/thinkpages/page.tsx",
        "server.mjs",
      ])
    );
    expect(files.some((file) => file.startsWith("src/tests/"))).toBe(false);
  });

  it("src/server/modules/thinkpages-forum/mod-log.ts exports logModAction, which only creates rows", async () => {
    const source = fs.readFileSync(
      path.join(ROOT, "src/server/modules/thinkpages-forum/mod-log.ts"),
      "utf8"
    );
    expect(source).toMatch(/export async function logModAction\(/);
    const tx = { forumModLog: { create: jest.fn(async () => ({ id: "log1" })) } };
    await logModAction(tx as never, {
      actorId: "u_a",
      action: "ban.issue",
      targetType: "user",
      targetId: "u_p",
      scope: { kind: "realm", realmId: "r1" },
    });
    expect(tx.forumModLog.create).toHaveBeenCalledTimes(1);
  });
});

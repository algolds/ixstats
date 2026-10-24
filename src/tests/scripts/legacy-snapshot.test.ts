/** @jest-environment node */
/**
 * The conversion's legacy snapshot reads `"User"."wikiUsername"` only while the column exists: the deploy re-runs the
 * conversion on every release, after the removal SQL has dropped it, and that run must read no legacy names rather
 * than fail.
 */
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { loadLegacySnapshot } from "../../../scripts/identity/legacy-snapshot";

/** A database whose raw SQL answers the column check, the legacy name read and the claims table check. */
function rawDb(columnExists: boolean) {
  const statements: string[] = [];
  const $queryRaw = jest.fn((strings: TemplateStringsArray) => {
    const text = strings.join("?");
    statements.push(text);
    if (text.includes("information_schema.columns"))
      return Promise.resolve([{ n: columnExists ? 1 : 0 }]);
    if (text.includes("to_regclass")) return Promise.resolve([{ present: false }]);
    return Promise.resolve([{ userId: "u1", clerkUserId: "user_1", wikiUsername: "Kir" }]);
  });
  return { db: createMockPrisma({ $queryRaw }), statements };
}

describe("loadLegacySnapshot", () => {
  it("treats a missing wikiUsername column as no legacy names, without reading it", async () => {
    const { db, statements } = rawDb(false);
    const snapshot = await loadLegacySnapshot(db as never);
    expect(snapshot.users).toEqual([]);
    expect(statements.filter((s) => s.includes('FROM "User"'))).toEqual([]);
  });

  it("reads the legacy names while the column exists", async () => {
    const { db } = rawDb(true);
    const snapshot = await loadLegacySnapshot(db as never);
    expect(snapshot.users).toEqual([{ userId: "u1", clerkUserId: "user_1", wikiUsername: "Kir" }]);
  });
});

/** @jest-environment node */
import {
  buildResetSql,
  isLocalDatabaseUrl,
  sqlString,
  toLegacyRows,
} from "../../../scripts/audit/wikios-legacy-wikiusername";

const user = (overrides: Partial<Parameters<typeof toLegacyRows>[0][number]> = {}) => ({
  id: "u1",
  clerkUserId: "user_1",
  wikiUsername: "Caphiria",
  lastWikiSync: new Date("2026-09-01T00:00:00Z"),
  country: { name: "Caphiria" },
  wikiAccountLinks: [],
  ...overrides,
});

describe("wikios-legacy-wikiusername audit script", () => {
  describe("isLocalDatabaseUrl", () => {
    it.each([
      ["postgresql://u:p@localhost:5433/ixstats", true],
      ["postgresql://u:p@127.0.0.1:5432/ixstats?connection_limit=20", true],
      ["postgresql://u:p@[::1]:5432/ixstats", true],
      ["postgresql://u:p@db.internal:5432/ixstats", false],
      ["postgresql://u:p@localhost.evil.example:5432/ixstats", false],
      ["not a url", false],
      ["", false],
      [undefined, false],
    ])("%s -> %s", (url, expected) => {
      expect(isLocalDatabaseUrl(url)).toBe(expected);
    });
  });

  describe("toLegacyRows", () => {
    it("flags a name equal to the country name (the old auto-write), ignoring underscores and case", () => {
      const rows = toLegacyRows([
        user(),
        user({ id: "u2", wikiUsername: "New_Brunswick", country: { name: "new brunswick" } }),
        user({ id: "u3", wikiUsername: "SomeoneElse", country: { name: "Caphiria" } }),
        user({ id: "u4", wikiUsername: "NoCountry", country: null }),
      ]);

      expect(rows.map((r) => [r.id, r.matchesCountryName])).toEqual([
        ["u1", true],
        ["u2", true],
        ["u3", false],
        ["u4", false],
      ]);
    });

    it("skips blank wikiUsername values, which the server treats as unset", () => {
      expect(toLegacyRows([user({ wikiUsername: null }), user({ wikiUsername: "   " })])).toEqual([]);
    });

    it("reports a pending unverified link and the last sync", () => {
      const [row] = toLegacyRows([user({ wikiAccountLinks: [{ username: "Pending Name" }] })]);

      expect(row).toMatchObject({
        pendingLinkUsername: "Pending Name",
        lastWikiSync: "2026-09-01T00:00:00.000Z",
      });
    });
  });

  describe("SQL emission", () => {
    it("quotes string literals, doubling single quotes", () => {
      expect(sqlString("O'Brien")).toBe("'O''Brien'");
      expect(sqlString("a'; DROP TABLE \"User\"; --")).toBe("'a''; DROP TABLE \"User\"; --'");
    });

    it("prints one value-guarded UPDATE per row and nothing else", () => {
      const rows = toLegacyRows([user(), user({ id: "u2", wikiUsername: "O'Brien" })]);

      expect(buildResetSql(rows)).toEqual([
        `UPDATE "User" SET "wikiUsername" = NULL WHERE id = 'u1' AND "wikiUsername" = 'Caphiria';`,
        `UPDATE "User" SET "wikiUsername" = NULL WHERE id = 'u2' AND "wikiUsername" = 'O''Brien';`,
      ]);
    });
  });
});

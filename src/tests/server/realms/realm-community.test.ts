/** @jest-environment node */
/**
 * Realm community links, rules and the in-world date (docs/specs/2026-10-05-realm-regions-design.md): link
 * validation, the in-world date's formatting and storage in `Realm.settings`, the Manage actions' `appearance`
 * gate (archived realms read-only), and what the region overview hands the page.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { realmsRouter } from "~/server/api/routers/realms";
import {
  formatInWorldDate,
  isRealmLinkUrl,
  MAX_REALM_LINKS,
  parseInWorldDate,
  parseRealmLinks,
} from "~/lib/realms/realm-community";
import { realmInWorldDate, withInWorldDate } from "~/server/modules/realms";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

type Db = ReturnType<typeof createMockPrisma>;

const FOUNDER = "clerk_founder";
const OFFICER = "clerk_officer";

function realmRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "eurth",
    slug: "eurth",
    name: "Eurth",
    ownerId: FOUNDER,
    status: "active",
    officers: [{ userId: OFFICER, powers: ["board"] }],
    ...overrides,
  };
}

function makeDb(realm: Record<string, unknown> = realmRow()): Db {
  const db = createMockPrisma();
  db.realm.findUnique.mockImplementation(async ({ where }: any) =>
    where.slug === realm.slug || where.id === realm.id ? realm : null
  );
  return db;
}

function callerAs(clerkUserId: string, db: Db) {
  return realmsRouter.createCaller(
    createMockRouterContext({
      db,
      auth: { userId: clerkUserId },
      user: { id: `db_${clerkUserId}`, clerkUserId, role: null },
      rateLimitIdentifier: `${clerkUserId}_${Math.random()}`,
    }) as never
  );
}

const forum = { label: "Forum", url: "https://forum.eurth.example/", kind: "forum" as const };
const discord = { label: "Discord", url: "https://discord.gg/eurth", kind: "discord" as const };

describe("community link addresses", () => {
  it("takes full https addresses, Discord invites included", () => {
    expect(isRealmLinkUrl("https://forum.eurth.example/index.php?board=1")).toBe(true);
    expect(isRealmLinkUrl("https://discord.gg/AbC123")).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://forum.eurth.example",
    "//forum.eurth.example",
    "/r/eurth",
    "https://localhost",
    "https://user:pass@forum.eurth.example",
    "https://forum.eurth.example/a b",
    `https://forum.eurth.example/${"a".repeat(500)}`,
    "",
  ])("refuses %s", (url) => {
    expect(isRealmLinkUrl(url)).toBe(false);
  });

  it("drops stored entries that are no longer valid", () => {
    expect(
      parseRealmLinks([forum, { label: "Bad", url: "javascript:alert(1)", kind: "other" }, "junk"])
    ).toEqual([forum]);
    expect(parseRealmLinks(null)).toEqual([]);
    expect(parseRealmLinks({ not: "an array" })).toEqual([]);
  });
});

describe("in-world date", () => {
  const now = new Date("2026-10-07T12:00:00Z");

  it("reads a fixed label as written, with its as-of date", () => {
    expect(
      formatInWorldDate({ mode: "fixed", label: "14 Harvest 1203 AE", asOf: "2026-10-01" }, now)
    ).toEqual({ label: "14 Harvest 1203 AE", asOf: "2026-10-01" });
  });

  it("follows the real year with an offset and an era", () => {
    expect(formatInWorldDate({ mode: "offset", offset: 15, era: "AE" }, now)).toEqual({
      label: "2041 AE",
      asOf: null,
    });
    expect(formatInWorldDate({ mode: "offset", offset: -823 }, now)).toEqual({
      label: "Year 1203",
      asOf: null,
    });
    expect(formatInWorldDate(null, now)).toBeNull();
  });

  it("ignores a malformed setting", () => {
    expect(parseInWorldDate({ mode: "offset", offset: 1.5 })).toBeNull();
    expect(parseInWorldDate({ mode: "fixed", label: "" })).toBeNull();
    expect(realmInWorldDate("junk")).toBeNull();
  });

  it("is stored in Realm.settings beside the other keys, and cleared without touching them", () => {
    const stored = withInWorldDate({ maxNationsPerUser: 3 }, { mode: "offset", offset: 15 });
    expect(stored).toEqual({ maxNationsPerUser: 3, inWorldDate: { mode: "offset", offset: 15 } });
    expect(realmInWorldDate(stored)).toEqual({ mode: "offset", offset: 15 });
    expect(withInWorldDate(stored, null)).toEqual({ maxNationsPerUser: 3 });
  });
});

describe("Manage: links, rules and the in-world date", () => {
  it("needs the appearance power", async () => {
    const db = makeDb();
    const officer = callerAs(OFFICER, db).region;
    await expect(officer.updateLinks({ slug: "eurth", links: [forum] })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(officer.updateRules({ slug: "eurth", wikitext: "Be civil." })).rejects.toMatchObject(
      { code: "FORBIDDEN" }
    );
    await expect(
      officer.updateInWorldDate({ slug: "eurth", inWorldDate: { mode: "fixed", label: "Year 1" } })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.realm.update).not.toHaveBeenCalled();
  });

  it("lets an appearance officer save the links, in order", async () => {
    const db = makeDb(realmRow({ officers: [{ userId: OFFICER, powers: ["appearance"] }] }));
    await callerAs(OFFICER, db).region.updateLinks({
      slug: "eurth",
      links: [discord, { ...forum, label: "  Forum  " }],
    });
    expect(db.realm.update).toHaveBeenCalledWith({
      where: { id: "eurth" },
      data: { communityLinks: [discord, forum] },
    });
  });

  it("refuses unsafe addresses and too many links", async () => {
    const db = makeDb();
    const founder = callerAs(FOUNDER, db).region;
    for (const url of ["javascript:alert(1)", "http://forum.eurth.example", "data:text/html,x"]) {
      await expect(
        founder.updateLinks({ slug: "eurth", links: [{ ...forum, url }] })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    await expect(
      founder.updateLinks({
        slug: "eurth",
        links: Array.from({ length: MAX_REALM_LINKS + 1 }, () => forum),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      founder.updateLinks({ slug: "eurth", links: [{ ...forum, kind: "telegram" as never }] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.realm.update).not.toHaveBeenCalled();
  });

  it("renders the rules from wikitext, strips scripts, and removes them when emptied", async () => {
    const db = makeDb();
    await callerAs(FOUNDER, db).region.updateRules({
      slug: "eurth",
      wikitext: "== Conduct ==\n'''Be civil.'''<script>alert(1)</script>",
    });
    const data = db.realm.update.mock.calls[0][0].data;
    expect(data.rulesWikitext).toContain("'''Be civil.'''");
    expect(data.rulesHtml).toMatch(/<strong[^>]*>Be civil\.<\/strong>/);
    expect(data.rulesHtml).not.toContain("<script");
    expect(data.rulesUpdatedBy).toBe(FOUNDER);

    await callerAs(FOUNDER, db).region.updateRules({ slug: "eurth", wikitext: "   " });
    expect(db.realm.update.mock.calls[1][0].data).toMatchObject({
      rulesWikitext: null,
      rulesHtml: null,
    });
  });

  it("stores the in-world date in settings, keeping the nation cap", async () => {
    const db = makeDb(realmRow({ settings: { maxNationsPerUser: 2 } }));
    await callerAs(FOUNDER, db).region.updateInWorldDate({
      slug: "eurth",
      inWorldDate: { mode: "offset", offset: 15, era: "AE" },
    });
    expect(db.realm.update).toHaveBeenLastCalledWith({
      where: { id: "eurth" },
      data: {
        settings: { maxNationsPerUser: 2, inWorldDate: { mode: "offset", offset: 15, era: "AE" } },
      },
    });
    await expect(
      callerAs(FOUNDER, db).region.updateInWorldDate({
        slug: "eurth",
        inWorldDate: { mode: "fixed", label: "x".repeat(61) },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("keeps an archived realm read-only", async () => {
    const db = makeDb(realmRow({ status: "archived" }));
    await expect(
      callerAs(FOUNDER, db).region.updateLinks({ slug: "eurth", links: [forum] })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringMatching(/archived/) });
    await expect(
      callerAs(FOUNDER, db).region.updateRules({ slug: "eurth", wikitext: "Be civil." })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      callerAs(FOUNDER, db).region.updateInWorldDate({ slug: "eurth", inWorldDate: null })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("region overview", () => {
  it("hands the page the rules, valid links and the in-world date", async () => {
    const db = makeDb(
      realmRow({
        ownerId: "system",
        officers: [],
        description: null,
        thumbnail: null,
        bannerUrl: null,
        tags: [],
        foundedAt: null,
        createdAt: new Date("2025-01-01"),
        factbookHtml: null,
        factbookUpdatedAt: null,
        rulesHtml: "<p>Be civil &amp; kind.</p>",
        rulesUpdatedAt: new Date("2026-10-01"),
        communityLinks: [forum, { label: "Bad", url: "javascript:alert(1)", kind: "other" }],
        settings: { inWorldDate: { mode: "fixed", label: "14 Harvest 1203 AE" } },
      })
    );
    db.country.aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { currentPopulation: 0 } });
    db.country.count.mockResolvedValue(0);
    db.realmEmbassy.findMany.mockResolvedValue([]);
    db.realmBoard.findUnique.mockResolvedValue(null);
    db.poll.findFirst.mockResolvedValue(null);

    const overview = await realmsRouter
      .createCaller(createMockRouterContext({ db, auth: null, user: null }) as never)
      .region.overview({ slug: "eurth" });
    expect(overview?.rules).toMatchObject({
      html: "<p>Be civil &amp; kind.</p>",
      summary: "Be civil & kind.",
    });
    expect(overview?.links).toEqual([forum]);
    expect(overview?.inWorldDate).toEqual({ label: "14 Harvest 1203 AE", asOf: null });
  });
});

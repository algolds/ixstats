/** @jest-environment node */
/**
 * Realm region pages (docs/specs/2026-10-05-realm-regions-design.md): officer powers, the Manage actions'
 * permission checks, embassies, the realm poll, the retired board restrictions and leaving a realm (handing a realm over:
 * realm-ownership-transfer.test.ts).
 */
jest.mock("~/server/db", () => ({ db: {} }));

jest.mock("~/lib/ixtime", () => ({
  IxTime: {
    getCurrentIxTime: () => Date.UTC(2041, 5, 2, 9, 30),
    getTimeMultiplier: () => 2,
    setBotTimeOverride: jest.fn(async () => ({ success: true, message: "ok" })),
    setTimeOverride: jest.fn(),
    getClockState: () => ({
      timeOverride: null,
      timeOverrideSetAt: null,
      multiplierOverride: null,
    }),
  },
}));

jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/server/modules/realms/realms.flags", () => ({ deleteLocalFlagImages: jest.fn() }));

jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));

import { realmsRouter } from "~/server/api/routers/realms";
import { IxTime } from "~/lib/ixtime";
import { formatRealmDate, parseRealmClock, realmClockNow } from "~/lib/realms/realm-clock";
import { realmPowers } from "~/server/modules/realms";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { MAX_REALM_LINKS } from "~/lib/realms/realm-community";
import { runRealmInactivity } from "~/server/modules/realms/realms.inactivity";
import {
  IXSTATS_NATION_GROWTH_DEFAULTS,
  type NationGrowthTable,
} from "~/lib/realms/nation-growth-defaults";
import {
  applyNationDefaults,
  NATION_DEFAULTS_APPLIED_ACTION,
  UNCLAIMED_NATION_WHERE,
} from "~/server/modules/realms/realms.nation-defaults";
import { isRealmImageUrl } from "~/lib/realms/realm-region";

type Db = ReturnType<typeof createMockPrisma>;

const FOUNDER = "clerk_founder";
const OFFICER = "clerk_officer";
const PLAYER = "clerk_player";
const ADMIN = "clerk_admin";

function realmRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "eurth",
    slug: "eurth",
    name: "Eurth",
    ownerId: FOUNDER,
    status: "active",
    officers: [{ userId: OFFICER, powers: ["diplomacy"] }],
    ...overrides,
  };
}

/** A mock Prisma whose transactions run on the same mock (so their writes can be asserted). */
function mockDb(): Db {
  // $executeRaw: the forum's member lock that the board-power check takes inside the grant's transaction (M9).
  const db = createMockPrisma({ $executeRaw: jest.fn(async () => 0) });
  db.$transaction.mockImplementation((cb: (tx: Db) => unknown) => cb(db));
  return db;
}

function makeDb(realm = realmRow()): Db {
  const db = mockDb();
  db.realm.findUnique.mockImplementation(async ({ where }: any) =>
    where.slug === realm.slug || where.id === realm.id ? realm : null
  );
  return db;
}

function callerAs(
  clerkUserId: string,
  db: Db,
  role: { name: string; level: number } | null = null
) {
  return realmsRouter.createCaller(
    createMockRouterContext({
      db,
      auth: { userId: clerkUserId },
      user: { id: `db_${clerkUserId}`, clerkUserId, role },
      rateLimitIdentifier: `${clerkUserId}_${Math.random()}`,
    }) as never
  );
}

const admin = { name: "admin", level: 10 };

describe("officer powers", () => {
  const realm = { ownerId: FOUNDER };
  const officers = [{ userId: OFFICER, powers: ["board", "bogus"] }];
  const actor = (clerkUserId: string) => ({ id: "u", clerkUserId, role: null });

  it("gives the founder every power and an officer only what was granted", () => {
    expect(realmPowers(actor(FOUNDER), realm, officers)).toEqual([
      "appearance",
      "board",
      "diplomacy",
      "claims",
      "map",
    ]);
    expect(realmPowers(actor(OFFICER), realm, officers)).toEqual(["board"]);
    expect(realmPowers(actor(PLAYER), realm, officers)).toEqual([]);
    expect(realmPowers(null, realm, officers)).toEqual([]);
  });
});

describe("Manage permissions", () => {
  it("lets an officer use a granted power and refuses the others", async () => {
    const db = makeDb();
    db.poll.create.mockResolvedValue({ id: "p1" });
    await expect(
      callerAs(OFFICER, db).region.updateAppearance({ slug: "eurth", tags: ["Fantasy"] })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.realm.update).not.toHaveBeenCalled();

    await callerAs(OFFICER, db).region.createPoll({
      slug: "eurth",
      question: "Capital?",
      options: ["North", "South"],
    });
    expect(db.poll.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ realmId: "eurth" }) })
    );
  });
  describe("the board power and forum bans (M9)", () => {
    const BANNED = {
      code: "BAD_REQUEST",
      message:
        "They have an active forum ban here or sitewide. Lift it before giving them moderator powers.",
    };
    /** The player has an IxStats account and a live forum ban in the realm or sitewide. */
    function bannedDb(realm = realmRow()): Db {
      const db = makeDb(realm);
      db.country.findFirst.mockResolvedValue({ id: "c1" });
      db.user.findUnique.mockResolvedValue({ id: "u_player" });
      db.forumBan.findFirst.mockResolvedValue({ id: "b1" });
      return db;
    }
    const appoint = (powers: Array<"board" | "diplomacy">) => ({
      slug: "eurth",
      userId: PLAYER,
      title: "Envoy",
      powers,
    });

    it("refuses appointing a banned player with the board power, but not without it", async () => {
      const db = bannedDb();
      await expect(
        callerAs(FOUNDER, db).region.appointOfficer(appoint(["board"]))
      ).rejects.toMatchObject(BANNED);
      expect(db.realmOfficer.create).not.toHaveBeenCalled();
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { clerkUserId: PLAYER },
        select: { id: true },
      });
      await callerAs(FOUNDER, db).region.appointOfficer(appoint(["diplomacy"]));
      expect(db.realmOfficer.create).toHaveBeenCalledTimes(1);
    });
    it("checks the bans inside the officer write's transaction, under the player's lock (M9)", async () => {
      const db = bannedDb();
      db.forumBan.findFirst.mockResolvedValue(null);
      await callerAs(FOUNDER, db).region.appointOfficer(appoint(["board"]));
      expect(db.$transaction).toHaveBeenCalledTimes(1);
      const [, key] = db.$executeRaw.mock.calls[0]!;
      expect(key).toBe("forum-member:u_player");
      expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        db.forumBan.findFirst.mock.invocationCallOrder[0]!
      );
      expect(db.forumBan.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
        db.realmOfficer.create.mock.invocationCallOrder[0]!
      );
    });
  });
  it("makes an archived realm read-only, even for its founder", async () => {
    const db = makeDb(realmRow({ status: "archived" }));
    await expect(
      callerAs(FOUNDER, db).region.updateFactbook({ slug: "eurth", wikitext: "Hello" })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringMatching(/archived/) });
  });

  it("hides a draft realm from everyone but its staff", async () => {
    const db = makeDb(realmRow({ status: "draft" }));
    await expect(callerAs(PLAYER, db).region.manage({ slug: "eurth" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("saves factbook and rules HTML without style, class or id, so it can't overlay the page", async () => {
    const db = makeDb();
    const overlay = `<div class='fixed inset-0 z-50' style="position:fixed;inset:0;z-index:99999"><a href="https://evil.example">Session expired, sign in</a></div>`;
    await callerAs(FOUNDER, db).region.updateFactbook({ slug: "eurth", wikitext: overlay });
    await callerAs(FOUNDER, db).region.updateRules({ slug: "eurth", wikitext: overlay });
    const [factbook, rules] = db.realm.update.mock.calls.map((call: any) => call[0].data);
    for (const html of [factbook.factbookHtml, rules.rulesHtml]) {
      expect(html).toContain("Session expired, sign in");
      expect(html).not.toMatch(/\s(style|class|id)=/);
      expect(html).not.toContain("z-index");
    }
  });
});

describe("embassies", () => {
  function twoRealms() {
    const db = mockDb();
    const realms: Record<string, any> = {
      eurth: realmRow(),
      terra: realmRow({ id: "terra", slug: "terra", name: "Terra", ownerId: "clerk_terra" }),
    };
    db.realm.findUnique.mockImplementation(
      async ({ where }: any) =>
        Object.values(realms).find((r) => r.slug === where.slug || r.id === where.id) ?? null
    );
    return db;
  }

  it("opens the embassy when the other realm had already proposed one", async () => {
    const db = twoRealms();
    db.realmEmbassy.findUnique.mockResolvedValue({
      id: "e1",
      status: "proposed",
      fromRealmId: "terra",
    });
    const result = await callerAs(OFFICER, db).region.proposeEmbassy({
      slug: "eurth",
      targetSlug: "terra",
    });
    expect(result).toEqual({ status: "active" });
    expect(db.realmEmbassy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e1" },
        data: expect.objectContaining({ status: "active" }),
      })
    );
  });

  it("lets only the receiving realm answer a proposal", async () => {
    const db = twoRealms();
    db.realmEmbassy.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      callerAs(OFFICER, db).region.respondEmbassy({ slug: "eurth", embassyId: "e1", accept: true })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.realmEmbassy.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "e1", toRealmId: "eurth", status: "proposed" } })
    );
  });
});
describe("leaving a realm", () => {
  it("releases the nation, keeps its board restriction and drops the officer post", async () => {
    const db = makeDb();
    db.country.findUnique.mockResolvedValue({
      id: "c5",
      name: "Aurelia",
      realmId: "eurth",
      ownerUserId: `db_${OFFICER}`,
    });
    db.country.count.mockResolvedValue(0);
    await callerAs(OFFICER, db).region.abandonNation({ countryId: "c5", confirmName: " aurelia " });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "c5" },
      data: { ownerUserId: null, ownedSince: null },
    });
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { countryId: "c5" },
      data: { countryId: null },
    });
    // The restriction stays: it follows the player who held the nation (see realm-board.ts).
    expect(db.realmBoardBan.deleteMany).not.toHaveBeenCalled();
    expect(db.realmOfficer.deleteMany).toHaveBeenCalledWith({
      where: { realmId: "eurth", userId: OFFICER },
    });
  });

  it("holds the nation's flag and arms for 30 days, restorable by the player (ToS §2.7)", async () => {
    const db = makeDb();
    db.country.findUnique.mockResolvedValue({
      id: "c5",
      name: "Aurelia",
      realmId: "eurth",
      ownerUserId: `db_${OFFICER}`,
      flag: "/flags/eurth--aurelia.png",
      coatOfArms: null,
    });
    await callerAs(OFFICER, db).region.abandonNation({ countryId: "c5", confirmName: "Aurelia" });
    expect(db.nationMaterialHold.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          countryId: "c5",
          formerOwnerUserId: `db_${OFFICER}`,
          reason: "released",
          flag: "/flags/eurth--aurelia.png",
        }),
      })
    );
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "c5" },
      data: { flag: null, coatOfArms: null, inactivityNoticeAt: null },
    });
  });

  it("needs the nation's name typed and the caller to own it", async () => {
    const db = makeDb();
    db.country.findUnique.mockResolvedValue({
      id: "c5",
      name: "Aurelia",
      realmId: "eurth",
      ownerUserId: `db_${PLAYER}`,
    });
    await expect(
      callerAs(PLAYER, db).region.abandonNation({ countryId: "c5", confirmName: "Aurel" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      callerAs(OFFICER, db).region.abandonNation({ countryId: "c5", confirmName: "Aurelia" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.country.update).not.toHaveBeenCalled();
  });
});

describe("overview and happenings", () => {
  function overviewDb(status = "active", ownerId = "system") {
    const db = mockDb();
    db.realm.findUnique.mockResolvedValue({
      ...realmRow({ status, ownerId }),
      description: "A world",
      thumbnail: null,
      bannerUrl: "https://img.example/banner.png",
      tags: ["Fantasy"],
      foundedAt: null,
      createdAt: new Date("2026-01-01"),
      factbookHtml: "<p>Hi</p>",
      factbookUpdatedAt: new Date("2026-02-01"),
      officers: [],
    });
    db.country.aggregate.mockResolvedValue({
      _count: { _all: 3 },
      _sum: { currentPopulation: 1_500_000 },
    });
    db.country.count.mockResolvedValue(2);
    return db;
  }

  it.each(["draft"])(
    "leaks no emblem of a %s realm to a viewer who cannot moderate it",
    async (status) => {
      const db = overviewDb(status, FOUNDER);
      const row = await db.realm.findUnique({ where: { slug: "eurth" } });
      db.realm.findUnique.mockResolvedValue({
        ...row,
        emblemUrl: "https://img.example/emblem.png",
      });
      expect(await callerAs(PLAYER, db).region.overview({ slug: "eurth" })).toBeNull();
      const staff = await callerAs(FOUNDER, db).region.overview({ slug: "eurth" });
      expect(staff?.realm.emblemUrl).toBe("https://img.example/emblem.png");
    }
  );
  it("re-sanitizes factbook and rules HTML stored before the stricter sanitizer", async () => {
    const db = overviewDb();
    const stored = `<p>Hi</p><div class='fixed inset-0 z-50' style="position:fixed;inset:0;z-index:99999" id="x"><a href="https://evil.example">Session expired</a></div>`;
    db.realm.findUnique.mockResolvedValue({
      ...(await db.realm.findUnique()),
      factbookHtml: stored,
      rulesHtml: stored,
    });
    const overview = await callerAs(PLAYER, db).region.overview({ slug: "eurth" });
    for (const html of [overview?.factbook?.html, overview?.rules?.html]) {
      expect(html).toContain("Session expired");
      expect(html).not.toMatch(/\s(style|class|id)=/);
    }
  });
  it("leaves draft partner realms out of the embassies panel (AT-6)", async () => {
    const db = overviewDb();
    db.realmEmbassy.findMany.mockResolvedValue([
      {
        fromRealmId: "eurth",
        fromRealm: { id: "eurth", name: "Eurth", slug: "eurth" },
        toRealm: { id: "terra", name: "Terra", slug: "terra" },
      },
    ]);
    db.realm.findMany.mockResolvedValue([]);
    await callerAs(PLAYER, db).region.overview({ slug: "eurth" });
    expect(db.realm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["terra"] }, status: { notIn: ["draft", "generating"] } },
      })
    );
  });
});

describe("deleting a realm (AT-8)", () => {
  function deletableDb(countries = 0, regions = 0) {
    const db = mockDb();
    db.realm.findUnique.mockResolvedValue({
      id: "eurth",
      slug: "eurth",
      name: "Eurth",
      _count: { countries },
    });
    db.mapLayer.count.mockResolvedValue(regions);
    db.realmBoard.findUnique.mockResolvedValue({ groupId: "board1" });
    return db;
  }

  it("refuses a realm that still has nations or map regions, and moves nothing", async () => {
    const withNations = deletableDb(3);
    await expect(
      callerAs(ADMIN, withNations, admin).region.deleteRealm({
        realmId: "eurth",
        confirmSlug: "eurth",
      })
    ).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("3 nations") });
    expect(withNations.realm.delete).not.toHaveBeenCalled();
    expect(withNations.country.updateMany).not.toHaveBeenCalled();

    const withMap = deletableDb(0, 12);
    await expect(
      callerAs(ADMIN, withMap, admin).region.deleteRealm({ realmId: "eurth", confirmSlug: "eurth" })
    ).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("map regions") });
    expect(withMap.realm.delete).not.toHaveBeenCalled();
  });
  it("hides the realm's advert thread before the realm goes, so it does not outlive it as an ordinary thread", async () => {
    const db = deletableDb();
    await callerAs(ADMIN, db, admin).region.deleteRealm({ realmId: "eurth", confirmSlug: "eurth" });
    expect(db.forumThread.updateMany).toHaveBeenCalledWith({
      where: { advertRealmId: "eurth" },
      data: { hidden: true },
    });
    expect(db.forumThread.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      db.realm.delete.mock.invocationCallOrder[0]!
    );
  });
  it("deletes the realm's forum categories before the realm (D16)", async () => {
    const db = deletableDb();
    await callerAs(ADMIN, db, admin).region.deleteRealm({ realmId: "eurth", confirmSlug: "eurth" });
    expect(db.forumCategory.deleteMany).toHaveBeenCalledWith({
      where: { scope: "realm", realmId: "eurth" },
    });
    expect(db.forumCategory.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      db.realm.delete.mock.invocationCallOrder[0]!
    );
  });
});
/**
 * Realm community links, rules and the in-world date (docs/specs/2026-10-05-realm-regions-design.md): link
 * validation, the in-world date's formatting and storage in `Realm.settings`, the Manage actions' `appearance`
 * gate (archived realms read-only), and what the region overview hands the page.
 */
describe("community links and rules", () => {
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
  describe("Manage: links, rules and the in-world date", () => {
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
  });
});

/** Realm clock actions: founder and staff only, continuous switch-on, the speed cooldown, Ixnay and archive rules. */
describe("the realm clock", () => {
  type Db = ReturnType<typeof createMockPrisma>;
  const FOUNDER = "clerk_founder";
  const OFFICER = "clerk_officer";
  const ADMIN = "clerk_admin";
  function makeDb(overrides: Record<string, unknown> = {}): {
    db: Db;
    row: Record<string, unknown>;
  } {
    const row: Record<string, unknown> = {
      id: "eurth",
      slug: "eurth",
      name: "Eurth",
      ownerId: FOUNDER,
      status: "active",
      officers: [{ userId: OFFICER, powers: ["appearance"] }],
      settings: { inWorldDate: { mode: "offset", offset: -823, era: "AE" } },
      ...overrides,
    };
    const db = createMockPrisma();
    db.realm.findUnique.mockImplementation(
      async ({ where }: { where: { slug?: string; id?: string } }) =>
        where.slug === row.slug || where.id === row.id ? row : null
    );
    // Writes land on the row, so a second call sees the first one's clock.
    db.realm.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      Object.assign(row, data)
    );
    return { db, row };
  }
  function caller(clerkUserId: string, db: Db) {
    const role = clerkUserId === ADMIN ? { name: "admin", level: 10 } : null;
    return realmsRouter.createCaller(
      createMockRouterContext({
        db,
        auth: { userId: clerkUserId },
        user: { id: `db_${clerkUserId}`, clerkUserId, role, countryId: null },
        rateLimitIdentifier: `${clerkUserId}_${Math.random()}`,
      }) as never
    ).region;
  }
  const START = { slug: "eurth", startDate: "1203-03-14", era: "AE", multiplier: 3 };
  describe("realm clock actions", () => {
    const DAY = 24 * 60 * 60 * 1000;
    const clockOf = (row: Record<string, unknown>) =>
      (row.settings as { clock: Record<string, number> }).clock;

    it("sets a clock only for the founder or staff, once, dropping the old in-world date", async () => {
      const { db, row } = makeDb();
      await expect(caller(OFFICER, db).startClock(START)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await caller(FOUNDER, db).startClock(START);
      expect(row.settings).not.toHaveProperty("inWorldDate");
      expect(clockOf(row).anchorClockMs).toBe(Date.UTC(2041, 5, 2, 9, 30));
      await expect(caller(ADMIN, db).startClock(START)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("changes the speed once a week for the founder, any time for staff", async () => {
      const { db, row } = makeDb();
      await caller(FOUNDER, db).startClock(START);
      // A clock set a week ago, so the founder may change its speed now.
      clockOf(row).changedAt -= 8 * DAY;
      await caller(FOUNDER, db).updateClock({ slug: "eurth", multiplier: 6 });
      await expect(
        caller(FOUNDER, db).updateClock({ slug: "eurth", multiplier: 0 })
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(/again on/) });
      await caller(ADMIN, db).updateClock({ slug: "eurth", multiplier: 0 });
      expect(clockOf(row).multiplier).toBe(0);
    });

    it("saves the founder's months, keeping today's year and refusing a bad calendar", async () => {
      const { db, row } = makeDb();
      await caller(FOUNDER, db).startClock(START);
      const months = [
        { name: "Thaw", days: 30 },
        { name: "Frostfall", days: 40 },
      ];
      await caller(FOUNDER, db).updateClock({ slug: "eurth", months });
      expect(clockOf(row)).toMatchObject({ months, era: "AE" });
      const clock = parseRealmClock(clockOf(row))!;
      expect(formatRealmDate(realmClockNow(clock, Date.now()), clock)).toMatch(
        /Frostfall 1203 AE$/
      );
      for (const bad of [[], [{ name: "Thaw", days: 101 }], [months[0], months[0]]]) {
        await expect(
          caller(FOUNDER, db).updateClock({ slug: "eurth", months: bad })
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      }
      await caller(FOUNDER, db).updateClock({ slug: "eurth", months: null });
      expect(clockOf(row)).not.toHaveProperty("months");
    });

    it("jumps forward for the founder once a week, really moving the clock", async () => {
      const { db, row } = makeDb();
      await caller(FOUNDER, db).startClock(START);
      const before = clockOf(row).anchorClockMs;
      await caller(FOUNDER, db).jumpClock({ slug: "eurth", days: 30 });
      expect(clockOf(row).anchorClockMs).toBe(before + 30 * DAY);
      expect(clockOf(row).jumpedAt).toBeGreaterThan(0);
      await expect(caller(FOUNDER, db).jumpClock({ slug: "eurth", days: 1 })).rejects.toMatchObject(
        { code: "BAD_REQUEST", message: expect.stringMatching(/jump again on/) }
      );
      // Site staff are exempt from the cooldown.
      await caller(ADMIN, db).jumpClock({ slug: "eurth", days: 1 });
      expect(clockOf(row).anchorClockMs).toBe(before + 31 * DAY);
    });

    it("refuses a jump past 5 of the realm's years, backwards, or by an officer", async () => {
      const { db, row } = makeDb();
      await caller(FOUNDER, db).startClock(START);
      await caller(FOUNDER, db).updateClock({
        slug: "eurth",
        months: [{ name: "Moon", days: 10 }],
      });
      await expect(caller(ADMIN, db).jumpClock({ slug: "eurth", days: 51 })).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringMatching(/5 years/),
      });
      await expect(caller(FOUNDER, db).jumpClock({ slug: "eurth", days: 0 })).rejects.toMatchObject(
        { code: "BAD_REQUEST" }
      );
      await expect(caller(OFFICER, db).jumpClock({ slug: "eurth", days: 1 })).rejects.toMatchObject(
        { code: "FORBIDDEN" }
      );
      await caller(FOUNDER, db).jumpClock({ slug: "eurth", days: 50 });
      expect(clockOf(row).jumpedAt).toBeDefined();
    });

    it("lets only staff jump Ixnay, by moving the bot's IxTime", async () => {
      const { db } = makeDb({ id: "default", slug: "ixnay", ownerId: "system" });
      await expect(caller(FOUNDER, db).jumpClock({ slug: "ixnay", days: 3 })).rejects.toMatchObject(
        { code: "FORBIDDEN" }
      );
      await expect(caller(ADMIN, db).jumpClock({ slug: "ixnay", days: 3 })).resolves.toMatchObject({
        clock: null,
        botSynced: true,
      });
      expect(IxTime.setBotTimeOverride).toHaveBeenCalledWith(Date.UTC(2041, 5, 5, 9, 30));
      expect(IxTime.setTimeOverride).toHaveBeenCalledWith(Date.UTC(2041, 5, 5, 9, 30));
      expect(db.systemConfig.upsert).toHaveBeenCalled();
      expect(db.realm.update).not.toHaveBeenCalled();
    });

    it("answers the context clock by realm id, and Ixnay's for a realm missing its clock", async () => {
      const { db } = makeDb();
      const errors = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const anyone = realmsRouter.createCaller(
        createMockRouterContext({ db, auth: null, user: null }) as never
      ).region;
      expect(await anyone.contextClock({ realmId: "eurth" })).toEqual({
        realmId: "eurth",
        clock: null,
      });
      expect(errors).toHaveBeenCalledWith(expect.stringContaining("eurth has no clock"));
      errors.mockRestore();
      await caller(FOUNDER, db).startClock(START);
      expect((await anyone.contextClock({ realmId: "eurth" })).clock).toMatchObject({ era: "AE" });
    });

    it("keeps an unpublished realm's clock private", async () => {
      const { db, row } = makeDb();
      await caller(FOUNDER, db).startClock(START);
      row.status = "draft";
      const anyone = realmsRouter.createCaller(
        createMockRouterContext({ db, auth: null, user: null }) as never
      ).region;
      expect((await anyone.contextClock({ realm: "eurth" })).clock).toBeNull();
    });

    it("gives an unpublished realm's clock to its founder, staff and its own nations, not to others", async () => {
      const { db, row } = makeDb();
      await caller(FOUNDER, db).startClock(START);
      row.status = "draft";
      db.country.findUnique.mockImplementation(async ({ where }: any) =>
        where.id === "own-nation" ? { realmId: "eurth" } : { realmId: "default" }
      );
      const viewer = (clerkUserId: string, countryId: string | null) =>
        realmsRouter.createCaller(
          createMockRouterContext({
            db,
            auth: { userId: clerkUserId },
            user: { id: `db_${clerkUserId}`, clerkUserId, role: null, countryId },
          }) as never
        ).region;
      const clockFor = async (region: ReturnType<typeof viewer>) =>
        (await region.contextClock({ realmId: "eurth" })).clock;
      expect(await clockFor(viewer(PLAYER, "own-nation"))).toMatchObject({ era: "AE" });
      expect(await clockFor(viewer(FOUNDER, null))).toMatchObject({ era: "AE" });
      expect(await clockFor(caller(ADMIN, db))).toMatchObject({ era: "AE" });
      expect(await clockFor(viewer(PLAYER, "ixnay-nation"))).toBeNull();
      expect(await clockFor(viewer(OFFICER, null))).toBeNull();
      expect((await viewer(PLAYER, "ixnay-nation").contextClock({ realmId: "eurth" })).realmId).toBe(
        "default"
      );
    });
  });
});

/**
 * The daily realm-inactivity job (ToS §2.8): warn, wait, release with the material held, un-warn, skip Ixnay, and
 * purge due holds (§2.7).
 */
describe("inactivity runs", () => {
  const DAY = 86_400_000;
  const now = new Date("2026-10-11T00:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);
  function nation(id: string, lastSeen: number, notice: number | null) {
    return {
      id,
      name: id,
      inactivityNoticeAt: notice === null ? null : daysAgo(notice),
      owner: { id: `u-${id}`, clerkUserId: `clerk-${id}`, lastSeenAt: daysAgo(lastSeen) },
    };
  }
  function setup() {
    const nations = [
      nation("active", 10, null),
      nation("quiet", 100, null),
      nation("warned", 100, 5),
      nation("gone", 120, 15),
      nation("back", 1, 3),
    ];
    const db: any = {
      $transaction: jest.fn((cb: any) => cb(db)),
      realm: {
        findMany: jest.fn().mockResolvedValue([
          { id: "eurth", name: "Eurth", slug: "eurth", settings: null },
          { id: "default", name: "Ixnay", slug: "ixnay", settings: null },
        ]),
      },
      country: {
        findMany: jest.fn().mockResolvedValue(nations),
        findUnique: jest.fn().mockResolvedValue({
          ownerUserId: "u-gone",
          flag: "/flags/eurth--gone.png",
          coatOfArms: null,
        }),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      realmOfficer: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      nationMaterialHold: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { countryId: "old", flag: "/flags/eurth--old.png", coatOfArms: null },
          ]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const deps = {
      now: () => now,
      notify: jest.fn().mockResolvedValue(undefined),
      deleteImages: jest.fn().mockResolvedValue(1),
    };
    return { db, deps };
  }
  describe("runRealmInactivity", () => {
    it("warns, releases after the notice, un-warns a returning owner and purges due holds", async () => {
      const { db, deps } = setup();
      await expect(runRealmInactivity(db, deps)).resolves.toEqual({
        warned: 1,
        released: 1,
        reset: 1,
        purged: 1,
        files: 1,
      });
      expect(db.country.update).toHaveBeenCalledWith({
        where: { id: "quiet" },
        data: { inactivityNoticeAt: now },
      });
      expect(db.country.update).toHaveBeenCalledWith({
        where: { id: "back" },
        data: { inactivityNoticeAt: null },
      });
      expect(db.nationMaterialHold.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            countryId: "gone",
            formerOwnerUserId: "u-gone",
            reason: "inactive",
            flag: "/flags/eurth--gone.png",
          }),
        })
      );
      expect(db.country.update).toHaveBeenCalledWith({
        where: { id: "gone" },
        data: { ownerUserId: null, ownedSince: null },
      });
      expect(deps.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "warning",
          clerkUserId: "clerk-quiet",
          date: new Date("2026-10-25T00:00:00Z"),
        })
      );
      expect(deps.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "released",
          clerkUserId: "clerk-gone",
          date: new Date("2027-04-09T00:00:00Z"),
        })
      );
      expect(deps.notify).toHaveBeenCalledTimes(2);
      expect(deps.deleteImages).toHaveBeenCalledWith(["/flags/eurth--old.png", null]);
    });
    it("does not release a nation that changed hands since the read", async () => {
      const { db, deps } = setup();
      db.country.findUnique.mockResolvedValue({ ownerUserId: "someone-else" });
      const result = await runRealmInactivity(db, deps);
      expect(result.released).toBe(0);
      expect(db.nationMaterialHold.upsert).not.toHaveBeenCalled();
    });
  });
});

describe("nation growth defaults", () => {
  const admin = { id: "a1", clerkUserId: "clerk_a1", role: { name: "admin", level: 10 } };
  const table: NationGrowthTable = {
    ...IXSTATS_NATION_GROWTH_DEFAULTS,
    Developing: { populationGrowthRate: 0.02, adjustedGdpGrowth: 0.004 },
  };
  const nation = (id: string, gdp: number, pop = 0.01, adj = 0.03, max = 0.05) => ({
    id,
    name: `Nation ${id}`,
    baselineGdpPerCapita: gdp,
    populationGrowthRate: pop,
    adjustedGdpGrowth: adj,
    maxGdpGrowthRate: max,
  });
  function setup(settings: object | null = { maxNationsPerUser: 2, nationDefaults: table }) {
    const realm = {
      id: "eurth-id",
      slug: "eurth",
      name: "Eurth",
      ownerId: "clerk_founder",
      settings,
    };
    const nations = [
      nation("a", 15_000),
      nation("b", 15_000, 0.02, 0.004, 0.075),
      nation("c", 70_000),
    ];
    const db: any = {
      $transaction: jest.fn((cb: any) => cb(db)),
      realm: {
        findUnique: jest.fn().mockResolvedValue(realm),
        update: jest.fn().mockResolvedValue({}),
      },
      country: {
        count: jest.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(3),
        findMany: jest.fn().mockResolvedValue(nations),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    return { db, realm };
  }
  describe("realm nation defaults service", () => {
    it("applies to unclaimed nations, guarded against a claim since, and audits every change", async () => {
      const { db } = setup();
      const result = await applyNationDefaults(db, admin, "eurth-id");
      expect(result).toEqual({ unclaimed: 3, updated: 2 });
      expect(db.country.updateMany).toHaveBeenCalledTimes(2);
      expect(db.country.updateMany).toHaveBeenCalledWith({
        where: { id: "a", realmId: "eurth-id", ...UNCLAIMED_NATION_WHERE },
        data: { populationGrowthRate: 0.02, adjustedGdpGrowth: 0.004, maxGdpGrowthRate: 0.075 },
      });
      const audit = db.adminAuditLog.create.mock.calls[0][0].data;
      expect(audit).toMatchObject({ action: NATION_DEFAULTS_APPLIED_ACTION, targetId: "eurth-id" });
      const changes = JSON.parse(audit.changes);
      expect(changes).toMatchObject({ unclaimed: 3, updated: 2, table });
      expect(changes.nations.map((n: { id: string }) => n.id)).toEqual(["a", "c"]);
    });
  });
});

/** Realm banners and thumbnails: an https:// address, an upload, or an image picked from the repository. */
describe("isRealmImageUrl", () => {
  it("refuses other schemes, other local paths and traversal", () => {
    for (const bad of [
      "http://img.example/banner.png",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "//img.example/banner.png",
      "/images/uploads/banner.png",
      "/images/flags/aurelia.png",
      "/images/uploads/uploaded_../../secret",
      "/images/uploads/uploaded_a b.png",
      "/images/downloaded/banner.png",
      "/api/upload/image",
      "/api/mediawiki/ixwiki/../../admin",
      "/api/mediawiki/ixwiki/a.png?x=1",
      "/projects/ixstats/images/uploads/uploaded_1_ab12cd34_banner.png",
    ]) {
      expect(isRealmImageUrl(bad)).toBe(false);
    }
  });
});

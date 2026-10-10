/** @jest-environment node */
/**
 * Realm region pages (docs/specs/2026-10-05-realm-regions-design.md): officer powers, the Manage actions'
 * permission checks, embassies, the realm poll, the retired board restrictions and leaving a realm (handing a realm over:
 * realm-ownership-transfer.test.ts).
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { realmsRouter } from "~/server/api/routers/realms";
import { hasRealmPower, realmPowers } from "~/server/modules/realms";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

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

  it("treats site admins as founders", () => {
    expect(
      hasRealmPower({ id: "a", clerkUserId: ADMIN, role: admin }, realm, [], "appearance")
    ).toBe(true);
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

  it("keeps appointing officers to the founder", async () => {
    const db = makeDb();
    await expect(
      callerAs(OFFICER, db).region.appointOfficer({
        slug: "eurth",
        userId: PLAYER,
        title: "Envoy",
        powers: ["board"],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    db.country.findFirst.mockResolvedValue({ id: "c1" });
    await callerAs(FOUNDER, db).region.appointOfficer({
      slug: "eurth",
      userId: PLAYER,
      title: "Envoy",
      powers: ["board", "board"],
    });
    expect(db.realmOfficer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: PLAYER, powers: ["board"], appointedBy: FOUNDER }),
    });
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

    it("refuses adding the board power to a banned officer, but leaves one who already holds it", async () => {
      const db = bannedDb(realmRow({ officers: [{ userId: PLAYER, powers: ["diplomacy"] }] }));
      await expect(
        callerAs(FOUNDER, db).region.updateOfficer(appoint(["board"]))
      ).rejects.toMatchObject(BANNED);
      expect(db.realmOfficer.updateMany).not.toHaveBeenCalled();

      const holder = bannedDb(realmRow({ officers: [{ userId: PLAYER, powers: ["board"] }] }));
      holder.realmOfficer.updateMany.mockResolvedValue({ count: 1 });
      await callerAs(FOUNDER, holder).region.updateOfficer(appoint(["board"]));
      expect(holder.forumBan.findFirst).not.toHaveBeenCalled();
      expect(holder.realmOfficer.updateMany).toHaveBeenCalledTimes(1);
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

    it("checks the founder's permission before the player's bans", async () => {
      const db = bannedDb();
      await expect(
        callerAs(OFFICER, db).region.appointOfficer(appoint(["board"]))
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.forumBan.findFirst).not.toHaveBeenCalled();
    });
  });

  it("only appoints players who own a nation in the realm", async () => {
    const db = makeDb();
    db.country.findFirst.mockResolvedValue(null);
    await expect(
      callerAs(FOUNDER, db).region.appointOfficer({
        slug: "eurth",
        userId: PLAYER,
        title: "Envoy",
        powers: [],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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

  it("renders the factbook from wikitext and strips scripts", async () => {
    const db = makeDb();
    await callerAs(FOUNDER, db).region.updateFactbook({
      slug: "eurth",
      wikitext: "'''Eurth''' is a world.<script>alert(1)</script>",
    });
    const data = db.realm.update.mock.calls[0][0].data;
    expect(data.factbookWikitext).toContain("'''Eurth'''");
    expect(data.factbookHtml).toMatch(/<strong[^>]*>Eurth<\/strong>/);
    expect(data.factbookHtml).not.toContain("<script");
    expect(data.factbookHtml).not.toContain("class=");
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

  it("refuses a non-https banner", async () => {
    const db = makeDb();
    await expect(
      callerAs(FOUNDER, db).region.updateAppearance({
        slug: "eurth",
        bannerUrl: "javascript:alert(1)",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lets appearance officers change the thumbnail, https only (AT-8)", async () => {
    const db = makeDb(realmRow({ officers: [{ userId: OFFICER, powers: ["appearance"] }] }));
    await callerAs(OFFICER, db).region.updateAppearance({
      slug: "eurth",
      thumbnail: "https://img.example/thumb.png",
    });
    expect(db.realm.update).toHaveBeenLastCalledWith({
      where: { id: "eurth" },
      data: { thumbnail: "https://img.example/thumb.png" },
    });
    await callerAs(OFFICER, db).region.updateAppearance({ slug: "eurth", thumbnail: null });
    expect(db.realm.update).toHaveBeenLastCalledWith({
      where: { id: "eurth" },
      data: { thumbnail: null },
    });
    await expect(
      callerAs(OFFICER, db).region.updateAppearance({
        slug: "eurth",
        thumbnail: "http://img.example/thumb.png",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lets appearance officers set and clear the emblem, validated like the thumbnail", async () => {
    const db = makeDb(realmRow({ officers: [{ userId: OFFICER, powers: ["appearance"] }] }));
    await callerAs(OFFICER, db).region.updateAppearance({
      slug: "eurth",
      emblemUrl: "https://img.example/emblem.png",
    });
    expect(db.realm.update).toHaveBeenLastCalledWith({
      where: { id: "eurth" },
      data: { emblemUrl: "https://img.example/emblem.png" },
    });
    const uploaded = "/images/uploads/uploaded_1759600000000_ab12cd34_emblem.png";
    await callerAs(OFFICER, db).region.updateAppearance({ slug: "eurth", emblemUrl: uploaded });
    expect(db.realm.update).toHaveBeenLastCalledWith({
      where: { id: "eurth" },
      data: { emblemUrl: uploaded },
    });
    await callerAs(OFFICER, db).region.updateAppearance({ slug: "eurth", emblemUrl: null });
    expect(db.realm.update).toHaveBeenLastCalledWith({
      where: { id: "eurth" },
      data: { emblemUrl: null },
    });
    for (const bad of ["http://img.example/e.png", "javascript:alert(1)", "/images/uploads/../x"]) {
      await expect(
        callerAs(OFFICER, db).region.updateAppearance({ slug: "eurth", emblemUrl: bad })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });

  it("lets the founder set the emblem and leaves it alone when not sent", async () => {
    const db = makeDb();
    await callerAs(FOUNDER, db).region.updateAppearance({
      slug: "eurth",
      emblemUrl: "https://img.example/emblem.png",
    });
    expect(db.realm.update).toHaveBeenLastCalledWith({
      where: { id: "eurth" },
      data: { emblemUrl: "https://img.example/emblem.png" },
    });
    await callerAs(FOUNDER, db).region.updateAppearance({ slug: "eurth", tags: ["Fantasy"] });
    expect(db.realm.update).toHaveBeenLastCalledWith({
      where: { id: "eurth" },
      data: { tags: ["Fantasy"] },
    });
  });

  it("refuses an emblem change from an officer without the appearance power", async () => {
    const db = makeDb();
    await expect(
      callerAs(OFFICER, db).region.updateAppearance({
        slug: "eurth",
        emblemUrl: "https://img.example/emblem.png",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.realm.update).not.toHaveBeenCalled();
  });

  it("accepts a banner uploaded through the image upload route", async () => {
    const db = makeDb();
    const uploaded = "/images/uploads/uploaded_1759600000000_ab12cd34_banner.png";
    await callerAs(FOUNDER, db).region.updateAppearance({ slug: "eurth", bannerUrl: uploaded });
    expect(db.realm.update).toHaveBeenLastCalledWith({
      where: { id: "eurth" },
      data: { bannerUrl: uploaded },
    });
    await expect(
      callerAs(FOUNDER, db).region.updateAppearance({
        slug: "eurth",
        bannerUrl: "/images/uploads/../../etc/passwd",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses a thumbnail change from an officer without the appearance power", async () => {
    const db = makeDb();
    await expect(
      callerAs(OFFICER, db).region.updateAppearance({
        slug: "eurth",
        thumbnail: "https://img.example/thumb.png",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.realm.update).not.toHaveBeenCalled();
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

  it("proposes an embassy, keyed by the realm pair", async () => {
    const db = twoRealms();
    const result = await callerAs(OFFICER, db).region.proposeEmbassy({
      slug: "eurth",
      targetSlug: "terra",
    });
    expect(result).toEqual({ status: "proposed" });
    expect(db.realmEmbassy.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pairKey: "eurth:terra" },
        create: expect.objectContaining({ fromRealmId: "eurth", toRealmId: "terra" }),
      })
    );
  });

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

  it("refuses an embassy with itself", async () => {
    const db = twoRealms();
    await expect(
      callerAs(FOUNDER, db).region.proposeEmbassy({ slug: "eurth", targetSlug: "eurth" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("realm poll", () => {
  it("runs one poll at a time", async () => {
    const db = makeDb();
    db.poll.findFirst.mockResolvedValue({ id: "p0" });
    await expect(
      callerAs(FOUNDER, db).region.createPoll({
        slug: "eurth",
        question: "Again?",
        options: ["Yes", "No"],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("needs two different options", async () => {
    const db = makeDb();
    await expect(
      callerAs(FOUNDER, db).region.createPoll({
        slug: "eurth",
        question: "Q",
        options: ["Same", " Same "],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("realm board mutes and bans are retired (phase 3)", () => {
  it("has no procedure to restrict or lift a board nation any more", () => {
    const names = Object.keys(realmsRouter._def.procedures);
    expect(names).toContain("region.abandonNation");
    expect(names).not.toContain("region.restrictBoardNation");
    expect(names).not.toContain("region.liftBoardRestriction");
  });

  it("leaves boardRestrictions out of Manage and never reads the board bans", async () => {
    const db = makeDb(realmRow({ officers: [{ userId: OFFICER, powers: ["board"] }] }));
    const manage = await callerAs(OFFICER, db).region.manage({ slug: "eurth" });
    expect(manage.powers).toEqual(["board"]);
    expect(manage).not.toHaveProperty("boardRestrictions");
    expect(db.realmBoardBan.findMany).not.toHaveBeenCalled();
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
      data: { ownerUserId: null },
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

  it("shows a staff-administered realm's header, stats and factbook", async () => {
    const db = overviewDb();
    const overview = await callerAs(PLAYER, db).region.overview({ slug: "eurth" });
    expect(overview).toMatchObject({
      founder: null,
      stats: { nations: 3, claimedNations: 2, population: 1_500_000 },
      factbook: { html: "<p>Hi</p>" },
      realm: { bannerUrl: "https://img.example/banner.png", tags: ["Fantasy"] },
      viewer: { canManage: false, powers: [] },
      poll: null,
    });
    expect(overview?.realm.foundedAt).toEqual(new Date("2026-01-01"));
  });

  it("gives the viewer no board restriction and never reads the board bans", async () => {
    const db = overviewDb();
    const overview = await callerAs(PLAYER, db).region.overview({ slug: "eurth" });
    expect(overview?.viewer).not.toHaveProperty("boardRestriction");
    expect(db.realmBoardBan.findMany).not.toHaveBeenCalled();
  });

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

  it("gives the founder and officers their passport handle, null until claimed", async () => {
    const db = overviewDb("active", FOUNDER);
    const realm = await db.realm.findUnique();
    db.realm.findUnique.mockResolvedValue({
      ...realm,
      officers: [{ userId: OFFICER, title: "Archivist", powers: [] }],
    });
    db.user.findMany.mockImplementation(async ({ select }: { select: { handle?: boolean } }) =>
      select.handle
        ? [
            { clerkUserId: FOUNDER, handle: "bora" },
            { clerkUserId: OFFICER, handle: null },
          ]
        : []
    );
    const overview = await callerAs(PLAYER, db).region.overview({ slug: "eurth" });
    expect(overview?.founder).toMatchObject({ handle: "bora" });
    expect(overview?.officers).toEqual([expect.objectContaining({ handle: null })]);
  });

  describe("forum preview (D4)", () => {
    const lastPostAt = new Date("2026-10-01T10:00:00Z");

    it("lists the realm's latest Hub threads, visible and unarchived ones only (U12), newest first", async () => {
      const db = overviewDb();
      db.forumCategory.findFirst.mockResolvedValue({ id: "hub1" });
      db.forumThread.findMany.mockResolvedValue([
        { id: "t1", title: "Welcome", postCount: 4, lastPostAt },
      ]);
      const overview = await callerAs(PLAYER, db).region.overview({ slug: "eurth" });

      expect(db.forumCategory.findFirst.mock.calls[0]![0].where).toEqual({
        scope: "realm",
        realmId: "eurth",
        key: "hub",
        visibility: { in: ["public", "reporter_staff"] },
      });
      expect(db.forumThread.findMany).toHaveBeenCalledWith({
        where: { categoryId: "hub1", hidden: false, archived: false },
        orderBy: { lastPostAt: "desc" },
        take: 5,
        select: { id: true, title: true, postCount: true, lastPostAt: true },
      });
      expect(overview?.forum).toEqual({
        threads: [{ id: "t1", title: "Welcome", replies: 3, lastPostAt }],
      });
      expect(overview).not.toHaveProperty("board");
    });

    it("counts replies without the opening post and never goes below zero", async () => {
      const db = overviewDb();
      db.forumCategory.findFirst.mockResolvedValue({ id: "hub1" });
      db.forumThread.findMany.mockResolvedValue([
        { id: "t1", title: "Empty", postCount: 0, lastPostAt },
        { id: "t2", title: "Alone", postCount: 1, lastPostAt },
      ]);
      const overview = await callerAs(PLAYER, db).region.overview({ slug: "eurth" });
      expect(overview?.forum.threads.map((t) => t.replies)).toEqual([0, 0]);
    });

    it("is empty when the realm has no Hub, or the Hub is not visible to the viewer", async () => {
      const db = overviewDb();
      db.forumCategory.findFirst.mockResolvedValue(null);
      const overview = await callerAs(PLAYER, db).region.overview({ slug: "eurth" });
      expect(overview?.forum).toEqual({ threads: [] });
      expect(db.forumThread.findMany).not.toHaveBeenCalled();
    });

    it("lets site admins see a non-public Hub, nobody else", async () => {
      const db = overviewDb();
      db.forumCategory.findFirst.mockResolvedValue(null);
      await callerAs(ADMIN, db, admin).region.overview({ slug: "eurth" });
      expect(db.forumCategory.findFirst.mock.calls[0]![0].where).toEqual({
        scope: "realm",
        realmId: "eurth",
        key: "hub",
        visibility: { in: ["public", "reporter_staff", "staff"] },
      });
    });

    it("shows nothing of a draft realm to players (the overview itself is null)", async () => {
      const db = overviewDb("draft", FOUNDER);
      expect(await callerAs(PLAYER, db).region.overview({ slug: "eurth" })).toBeNull();
      expect(db.forumCategory.findFirst).not.toHaveBeenCalled();
      expect(db.forumThread.findMany).not.toHaveBeenCalled();
    });
  });

  it("hides a draft realm's overview from players", async () => {
    const db = overviewDb("draft", FOUNDER);
    expect(await callerAs(PLAYER, db).region.overview({ slug: "eurth" })).toBeNull();
    expect(await callerAs(FOUNDER, db).region.overview({ slug: "eurth" })).not.toBeNull();
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

  it("lists happenings newest first", async () => {
    const db = makeDb();
    db.country.findMany.mockImplementation(async ({ take }: any) =>
      take
        ? [{ id: "c1", name: "Aurelia", slug: "aurelia", createdAt: new Date("2026-03-01") }]
        : [{ id: "c1" }]
    );
    db.realmEmbassy.findMany.mockResolvedValue([
      {
        id: "e1",
        openedAt: new Date("2026-04-01"),
        fromRealmId: "eurth",
        fromRealm: { name: "Eurth", slug: "eurth" },
        toRealm: { name: "Terra", slug: "terra" },
      },
    ]);
    const { items, nextCursor } = await callerAs(PLAYER, db).region.happenings({ slug: "eurth" });
    expect(items.map((i) => i.text)).toEqual([
      "An embassy with Terra opened",
      "Aurelia was founded",
    ]);
    expect(items[0]?.href).toBe("/r/terra");
    expect(nextCursor).toBeNull();
  });

  it("leaves embassies with draft or generating partners out of the happenings (AT-6)", async () => {
    const db = makeDb();
    await callerAs(PLAYER, db).region.happenings({ slug: "eurth", kinds: ["embassy"] });
    const hidden = { status: { notIn: ["draft", "generating"] } };
    expect(db.realmEmbassy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { fromRealmId: "eurth", toRealm: hidden },
            { toRealmId: "eurth", fromRealm: hidden },
          ],
        }),
      })
    );
  });

  it("pages through the history with a cursor", async () => {
    const db = makeDb();
    const day = (d: number) => new Date(Date.UTC(2026, 0, d));
    const nations = [5, 4, 3, 2, 1].map((d) => ({
      id: `c${d}`,
      name: `Nation ${d}`,
      slug: null,
      createdAt: day(d),
    }));
    db.country.findMany.mockImplementation(async ({ where, take }: any) => {
      if (!take) return [];
      const before: Date | undefined = where.createdAt?.lt;
      return nations.filter((n) => !before || n.createdAt < before).slice(0, take);
    });
    const caller = callerAs(PLAYER, db).region;
    const first = await caller.happenings({ slug: "eurth", limit: 2 });
    expect(first.items.map((i) => i.text)).toEqual([
      "Nation 5 was founded",
      "Nation 4 was founded",
    ]);
    expect(first.nextCursor).toBe(day(4).toISOString());
    // Every source reads one more than the page to know whether more remain.
    expect(db.country.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));

    const second = await caller.happenings({ slug: "eurth", limit: 2, cursor: first.nextCursor });
    expect(second.items.map((i) => i.text)).toEqual([
      "Nation 3 was founded",
      "Nation 2 was founded",
    ]);
    expect(db.realmClaim.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ reviewedAt: { lt: day(4) } }),
      })
    );
    const last = await caller.happenings({ slug: "eurth", limit: 2, cursor: second.nextCursor });
    expect(last.items.map((i) => i.text)).toEqual(["Nation 1 was founded"]);
    expect(last.nextCursor).toBeNull();
  });

  it("filters by kind, reading only the chosen sources", async () => {
    const db = makeDb();
    await callerAs(PLAYER, db).region.happenings({ slug: "eurth", kinds: ["embassy"] });
    expect(db.realmEmbassy.findMany).toHaveBeenCalled();
    expect(db.realmClaim.findMany).not.toHaveBeenCalled();
    expect(db.realmOfficer.findMany).not.toHaveBeenCalled();
    expect(db.country.findMany).not.toHaveBeenCalled();
    expect(db.activityFeed.findMany).not.toHaveBeenCalled();
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

  it("is for site admins only", async () => {
    const db = deletableDb();
    await expect(
      callerAs(FOUNDER, db).region.deleteRealm({ realmId: "eurth", confirmSlug: "eurth" })
    ).rejects.toThrow();
    expect(db.realm.delete).not.toHaveBeenCalled();
  });

  it("never deletes IxWorld", async () => {
    const db = deletableDb();
    await expect(
      callerAs(ADMIN, db, admin).region.deleteRealm({ realmId: "default", confirmSlug: "ixworld" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.realm.delete).not.toHaveBeenCalled();
  });

  it("needs the realm's slug typed", async () => {
    const db = deletableDb();
    await expect(
      callerAs(ADMIN, db, admin).region.deleteRealm({ realmId: "eurth", confirmSlug: "Eurth!" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.realm.delete).not.toHaveBeenCalled();
  });

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

  it("deletes an empty realm and retires its board", async () => {
    const db = deletableDb();
    await expect(
      callerAs(ADMIN, db, admin).region.deleteRealm({ realmId: "eurth", confirmSlug: " eurth " })
    ).resolves.toEqual({ success: true, slug: "eurth" });
    expect(db.thinktankGroup.updateMany).toHaveBeenCalledWith({
      where: { id: "board1" },
      data: { isActive: false },
    });
    expect(db.realmBoard.delete).toHaveBeenCalledWith({ where: { realmId: "eurth" } });
    expect(db.realm.delete).toHaveBeenCalledWith({ where: { id: "eurth" } });
  });

  it("deletes the action links of the realm's native posts before its categories", async () => {
    const db = deletableDb();
    db.forumPost.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    await callerAs(ADMIN, db, admin).region.deleteRealm({ realmId: "eurth", confirmSlug: "eurth" });
    expect(db.forumPost.findMany).toHaveBeenCalledWith({
      where: { thread: { category: { scope: "realm", realmId: "eurth" } } },
      select: { id: true },
    });
    expect(db.postActionLink.deleteMany).toHaveBeenCalledWith({
      where: { postSource: "native", postRef: { in: ["p1", "p2"] } },
    });
    expect(db.postActionLink.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      db.forumCategory.deleteMany.mock.invocationCallOrder[0]!
    );
  });

  it("skips the link cleanup when the realm has no posts", async () => {
    const db = deletableDb();
    db.forumPost.findMany.mockResolvedValue([]);
    await callerAs(ADMIN, db, admin).region.deleteRealm({ realmId: "eurth", confirmSlug: "eurth" });
    expect(db.postActionLink.deleteMany).not.toHaveBeenCalled();
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

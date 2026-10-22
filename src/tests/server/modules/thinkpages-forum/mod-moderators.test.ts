/** @jest-environment node */
import { Prisma } from "@prisma/client";
import {
  listCategoryModerators,
  resolveMember,
  setCategoryModerator,
} from "~/server/modules/thinkpages-forum";
import {
  admin,
  at,
  categories,
  eurthMod,
  generalMod,
  member,
  realms,
  USER_ROLE,
} from "~/tests/helpers/forum-mod-fixtures";
import { detailOf, forumStore, type Row } from "~/tests/helpers/forum-store-fake";
import { wikiAttributionOff } from "~/tests/helpers/privacy-config-fake";
import { assertBoardGrantable } from "~/server/modules/thinkpages-forum";
import { ban, NOW } from "~/tests/helpers/forum-appeal-fixtures";
import {
  canActInScope,
  canModerateCategory,
  canSeeThread,
  moderatorContext,
  scopeCategoryIds,
} from "~/server/modules/thinkpages-forum";
import { banScopeOf, scopeFromColumns } from "~/server/modules/thinkpages-forum/mod-scope";
import { listModLog } from "~/server/modules/thinkpages-forum";

const people: Row[] = [
  { id: "u_a", clerkUserId: "admin", role: { name: "admin", level: 10 }, handle: "boss" },
  {
    id: "u_m",
    clerkUserId: "member",
    role: USER_ROLE,
    handle: "alice",
    wikiUsername: "Alice of Eurth",
    email: "alice@example.com",
  },
  { id: "u_w", clerkUserId: "wiki", role: USER_ROLE, handle: null, wikiUsername: "Bob_Smith" },
  { id: "u_d1", clerkUserId: "d1", role: USER_ROLE, handle: null, wikiUsername: "Twin" },
  { id: "u_d2", clerkUserId: "d2", role: USER_ROLE, handle: null, wikiUsername: "Twin" },
];
const categoryModerators: Row[] = [
  { id: "cm1", categoryId: "cat_general", userId: "u_gen", grantedBy: "u_a", createdAt: at(1) },
  { id: "cm2", categoryId: "cat_general", userId: "u_m", grantedBy: "u_a", createdAt: at(2) },
  { id: "cm3", categoryId: "r_eurth_hub", userId: "u_w", grantedBy: "u_a", createdAt: at(3) },
];
const storeWith = (userConnections: Row[] = []) =>
  forumStore({ categories, realms, users: people, categoryModerators, userConnections });
describe("resolveMember", () => {
  it("returns only the id and a public name, never a Clerk id or email", async () => {
    const store = storeWith();
    const found = await resolveMember(store.db as never, admin, { handle: "Alice of Eurth" });
    expect(found).toEqual({ id: "u_m", name: "Alice of Eurth" });
    expect(Object.keys(found!).sort()).toEqual(["id", "name"]);
    for (const call of [
      ...store.db.user.findUnique.mock.calls,
      ...store.db.user.findMany.mock.calls,
    ]) {
      expect(call[0]).toMatchObject({ select: { id: true } });
      expect(call[0]!.select).not.toHaveProperty("email");
    }
    // Only the wiki lookup reads the Clerk id, to check wiki attribution; it never reaches the result.
    for (const call of store.db.user.findUnique.mock.calls) {
      expect(call[0]!.select).not.toHaveProperty("clerkUserId");
    }
  });
  it("neither matches nor shows the wiki username of a member with wiki attribution off", async () => {
    const store = storeWith(wikiAttributionOff("wiki", "member"));
    expect(await resolveMember(store.db as never, generalMod, { handle: "Bob_Smith" })).toBeNull();
    expect(
      await resolveMember(store.db as never, generalMod, { handle: "Alice of Eurth" })
    ).toBeNull();
    expect(await resolveMember(store.db as never, generalMod, { handle: "alice" })).toEqual({
      id: "u_m",
      name: "alice",
    });
  });

  it("fails closed: a switch it cannot read matches no wiki username, while a handle still resolves", async () => {
    const store = storeWith();
    store.db.userConnection.findMany.mockRejectedValue(new Error("db down"));
    expect(await resolveMember(store.db as never, generalMod, { handle: "Bob_Smith" })).toBeNull();
    expect(await resolveMember(store.db as never, generalMod, { handle: "alice" })).toEqual({
      id: "u_m",
      name: "alice",
    });
  });

  it.each([["a wiki username two accounts share", "Twin"]])(
    "returns null for %s",
    async (_case, handle) => {
      const store = storeWith();
      expect(await resolveMember(store.db as never, generalMod, { handle })).toBeNull();
    }
  );

  it.each([["a member", member]] as const)("refuses %s (FORBIDDEN)", async (_case, viewer) => {
    const store = storeWith();
    await expect(
      resolveMember(store.db as never, viewer, { handle: "alice" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(store.db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("listCategoryModerators", () => {
  it("names a moderator with wiki attribution off without their wiki name", async () => {
    const store = storeWith(wikiAttributionOff("wiki"));
    expect(
      await listCategoryModerators(store.db as never, eurthMod, { key: "hub", realm: "eurth" })
    ).toEqual([{ userId: "u_w", name: "Member", grantedBy: "u_a", createdAt: at(3) }]);
  });
});

describe("setCategoryModerator", () => {
  it("grants: creates the row with its granter and logs moderator.grant in the same transaction", async () => {
    const store = storeWith();
    await setCategoryModerator(store.db as never, admin, {
      locator: { key: "side-games" },
      userId: "u_w",
      grant: true,
    });
    expect(store.state.categoryModerators).toContainEqual(
      expect.objectContaining({ categoryId: "cat_side", userId: "u_w", grantedBy: "u_a" })
    );
    expect(store.tx.forumCategoryModerator.create).toHaveBeenCalledTimes(1);
    expect(store.logs).toEqual([
      expect.objectContaining({
        actorId: "u_a",
        action: "moderator.grant",
        targetType: "user",
        targetId: "u_w",
        scope: "category",
        scopeId: "cat_side",
      }),
    ]);
    expect(detailOf(store.logs[0])).toEqual({ categoryId: "cat_side" });
    expect(store.db.forumModLog.create).not.toHaveBeenCalled();
  });
  it("maps a racing duplicate grant (unique violation) to CONFLICT", async () => {
    const store = storeWith();
    store.tx.forumCategoryModerator.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    await expect(
      setCategoryModerator(store.db as never, admin, {
        locator: { key: "side-games" },
        userId: "u_w",
        grant: true,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(store.logs).toEqual([]);
  });
  it.each([
    ["a realm founder, in their own realm", eurthMod, { key: "hub", realm: "eurth" }],
  ] as const)("refuses %s (FORBIDDEN, M19)", async (_case, viewer, locator) => {
    const store = storeWith();
    await expect(
      setCategoryModerator(store.db as never, viewer, { locator, userId: "u_w", grant: true })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only site admins appoint category moderators.",
    });
    expect(store.db.$transaction).not.toHaveBeenCalled();
  });
});

/**
 * M9 (owner ruling): no moderator powers for a member with an active forum ban where they would apply or sitewide;
 * active warnings alone do not block.
 */
describe("promotion and bans (M9)", () => {
  const users: Row[] = [
    { id: "u_a", clerkUserId: "admin", role: { name: "admin", level: 10 } },
    { id: "u_m", clerkUserId: "member", role: USER_ROLE },
  ];
  const storeWith = (seed: { bans?: Row[]; warnings?: Row[] } = {}) =>
    forumStore({ categories, realms, users, categoryModerators: [], ...seed });
  const REFUSED = {
    code: "BAD_REQUEST",
    message:
      "They have an active forum ban here or sitewide. Lift it before giving them moderator powers.",
  };
  const site = (extra: Row = {}) => ban("b1", { scope: "site", scopeId: null, ...extra });
  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());
  describe("setCategoryModerator refuses a member banned there or sitewide (M9)", () => {
    const grant = (store: ReturnType<typeof storeWith>, key: string, realm?: string) =>
      setCategoryModerator(store.db as never, admin, {
        locator: { key, realm },
        userId: "u_m",
        grant: true,
      });

    it.each([["a site ban", site(), "general", undefined]])(
      "refuses with %s, writing nothing",
      async (_name, row, key, realm) => {
        const store = storeWith({ bans: [row] });
        await expect(grant(store, key, realm)).rejects.toMatchObject(REFUSED);
        expect(store.state.categoryModerators).toEqual([]);
        expect(store.logs).toEqual([]);
      }
    );

    it("checks the bans inside the grant's transaction, under the member's lock (M9)", async () => {
      const store = storeWith();
      await grant(store, "general");
      const [strings, key] = store.tx.$executeRaw.mock.calls[0]!;
      expect(strings.join("?")).toBe("SELECT pg_advisory_xact_lock(hashtext(?))");
      expect(key).toBe("forum-member:u_m");
      expect(store.db.$transaction).toHaveBeenCalledTimes(1);
      expect(store.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        store.tx.forumBan.findMany.mock.invocationCallOrder[0]!
      );
      expect(store.tx.forumBan.findMany.mock.invocationCallOrder[0]).toBeLessThan(
        store.tx.forumCategoryModerator.create.mock.invocationCallOrder[0]!
      );
    });
    it("still lets a site admin remove a banned member's role", async () => {
      const store = forumStore({
        categories,
        realms,
        users,
        bans: [site()],
        categoryModerators: [
          { id: "cm1", categoryId: "cat_general", userId: "u_m", grantedBy: "u_a" },
        ],
      });
      await setCategoryModerator(store.db as never, admin, {
        locator: { key: "general" },
        userId: "u_m",
        grant: false,
      });
      expect(store.state.categoryModerators).toEqual([]);
    });
  });
  describe("assertBoardGrantable (M9, a realm's board power)", () => {
    it.each([["a site ban", site()]])(
      "refuses a member with %s, found by Clerk id",
      async (_name, row) => {
        const store = storeWith({ bans: [row] });
        await expect(
          assertBoardGrantable(store.db as never, "r_eurth", "member")
        ).rejects.toMatchObject(REFUSED);
      }
    );
  });
});

describe("moderator scope", () => {
  const USER_ROLE = { name: "user", level: 100 };
  const admin = {
    id: "u_a",
    clerkUserId: "admin",
    countryId: null,
    role: { name: "admin", level: 10 },
  };
  const member = { id: "u_p", clerkUserId: "plain", countryId: "c1", role: USER_ROLE };
  const noMod = { siteAdmin: false, realmIds: [], categoryIds: [] };
  const realmMod = {
    id: "u_f",
    clerkUserId: "founder",
    countryId: null,
    role: USER_ROLE,
    mod: { siteAdmin: false, realmIds: ["r_eurth"], categoryIds: [] },
  };
  const categoryMod = {
    id: "u_c",
    clerkUserId: "catmod",
    countryId: null,
    role: USER_ROLE,
    mod: { siteAdmin: false, realmIds: [], categoryIds: ["cat_general"] },
  };
  const general = { id: "cat_general", scope: "site", realmId: null, visibility: "public" };
  const reports = { id: "cat_reports", scope: "site", realmId: null, visibility: "reporter_staff" };
  const staff = { id: "cat_staff", scope: "site", realmId: null, visibility: "staff" };
  const eurthHub = {
    id: "cat_eurth_hub",
    scope: "realm",
    realmId: "r_eurth",
    visibility: "public",
  };
  const beeHub = { id: "cat_bee_hub", scope: "realm", realmId: "r_bee", visibility: "public" };
  interface OfficerRow {
    realmId: string;
    userId: string;
    powers: string[];
  }
  function scopeDb(officers: OfficerRow[] = []) {
    return {
      realm: { findMany: jest.fn(async () => [{ id: "r_eurth" }]) },
      realmOfficer: {
        findMany: jest.fn(
          async ({ where }: { where: { userId: string; powers: { has: string } } }) =>
            officers
              .filter((o) => o.userId === where.userId && o.powers.includes(where.powers.has))
              .map((o) => ({ realmId: o.realmId }))
        ),
      },
      forumCategoryModerator: { findMany: jest.fn(async () => [{ categoryId: "cat_general" }]) },
    };
  }
  describe("moderatorContext (M10, T0-10)", () => {
    it("matches founders and officers by Clerk id and category moderators by User id", async () => {
      const db = scopeDb([{ realmId: "r_bee", userId: "plain", powers: ["board", "claims"] }]);
      const context = await moderatorContext(db as never, member);
      expect(context).toEqual({
        siteAdmin: false,
        realmIds: ["r_eurth", "r_bee"],
        categoryIds: ["cat_general"],
      });
      expect(db.realm.findMany).toHaveBeenCalledWith({
        where: { ownerId: "plain" },
        select: { id: true },
      });
      expect(db.realmOfficer.findMany).toHaveBeenCalledWith({
        where: { userId: "plain", powers: { has: "board" } },
        select: { realmId: true },
      });
      expect(db.forumCategoryModerator.findMany).toHaveBeenCalledWith({
        where: { userId: "u_p" },
        select: { categoryId: true },
      });
    });

    it("gives an officer without the board power no realm", async () => {
      const db = scopeDb([{ realmId: "r_bee", userId: "plain", powers: ["diplomacy"] }]);
      db.realm.findMany.mockResolvedValue([]);
      db.forumCategoryModerator.findMany.mockResolvedValue([]);
      expect(await moderatorContext(db as never, member)).toEqual(noMod);
    });
  });
  describe("scope checks", () => {
    it("keeps realm moderators to their realm's categories", () => {
      expect(canModerateCategory(realmMod, eurthHub)).toBe(true);
      expect(canModerateCategory(realmMod, beeHub)).toBe(false);
      expect(canModerateCategory(realmMod, general)).toBe(false);
      expect(canModerateCategory(realmMod, { ...general, realmId: "r_eurth" })).toBe(false);
    });

    it("keeps category moderators to their category", () => {
      expect(canModerateCategory(categoryMod, general)).toBe(true);
      expect(canModerateCategory(categoryMod, reports)).toBe(false);
      expect(canModerateCategory(categoryMod, eurthHub)).toBe(false);
      expect(canModerateCategory(member, general)).toBe(false);
      expect(canModerateCategory(null, general)).toBe(false);
    });

    it("keeps the site scope to site admins (site bans are admin-only)", () => {
      expect(canActInScope(admin, { kind: "site" }, null)).toBe(true);
      expect(canActInScope(realmMod, { kind: "site" }, null)).toBe(false);
      expect(canActInScope(categoryMod, { kind: "site" }, null)).toBe(false);
      expect(canActInScope(null, { kind: "site" }, null)).toBe(false);
    });
  });
  describe("scopeCategoryIds", () => {
    const categoryDb = () => ({
      forumCategory: {
        findMany: jest.fn(async () => [
          { id: "cat_eurth_hub" },
          { id: "cat_eurth_ct" },
          { id: "cat_general" },
        ]),
      },
    });
    it("gives realm moderators their realms' categories plus the ones they moderate, once each", async () => {
      const db = categoryDb();
      const viewer = {
        ...realmMod,
        mod: { ...realmMod.mod, categoryIds: ["cat_general", "cat_reports"] },
      };
      expect(await scopeCategoryIds(db as never, viewer)).toEqual([
        "cat_eurth_hub",
        "cat_eurth_ct",
        "cat_general",
        "cat_reports",
      ]);
      expect(db.forumCategory.findMany).toHaveBeenCalledWith({
        where: { scope: "realm", realmId: { in: ["r_eurth"] } },
        select: { id: true },
      });
    });
  });
  describe("canSeeThread (M8, M9)", () => {
    const own = { authorUserId: "u_p", hidden: false };
    const theirs = { authorUserId: "u_x", hidden: false };
    const hidden = { authorUserId: "u_p", hidden: true };

    it("shows public threads to everyone and hidden ones to the category's moderators only", () => {
      expect(canSeeThread(null, theirs, general)).toBe(true);
      expect(canSeeThread(member, theirs, general)).toBe(true);
      expect(canSeeThread(member, hidden, general)).toBe(false);
      expect(canSeeThread(categoryMod, hidden, general)).toBe(true);
      expect(canSeeThread(realmMod, hidden, general)).toBe(false);
      expect(canSeeThread(realmMod, hidden, eurthHub)).toBe(true);
      expect(canSeeThread(admin, hidden, beeHub)).toBe(true);
    });

    it("shows a Reports thread to its author and to moderators, nobody else", () => {
      expect(canSeeThread(member, own, reports)).toBe(true);
      expect(canSeeThread(member, theirs, reports)).toBe(false);
      expect(canSeeThread(null, theirs, reports)).toBe(false);
      expect(canSeeThread(admin, theirs, reports)).toBe(true);
      expect(
        canSeeThread(
          { ...categoryMod, mod: { ...noMod, categoryIds: ["cat_reports"] } },
          theirs,
          reports
        )
      ).toBe(true);
    });

    it("keeps staff threads to site admins", () => {
      expect(canSeeThread(member, own, staff)).toBe(false);
      expect(canSeeThread(admin, theirs, staff)).toBe(true);
    });
  });
  describe("stored scopes and paging", () => {
    it("reads a malformed stored scope as site, which only site admins act on", () => {
      expect(scopeFromColumns("realm", null)).toEqual({ kind: "site" });
      expect(scopeFromColumns("category", null)).toEqual({ kind: "site" });
      expect(scopeFromColumns("planet", "x")).toEqual({ kind: "site" });
      expect(banScopeOf("category")).toBe("category");
      expect(banScopeOf("planet")).toBe("site");
    });
  });
});

describe("the moderation log", () => {
  const USER_ROLE = { name: "user", level: 100 };
  const member = { id: "u_p", clerkUserId: "plain", countryId: "c1", role: USER_ROLE };
  const realmMod = {
    id: "u_f",
    clerkUserId: "founder",
    countryId: null,
    role: USER_ROLE,
    mod: { siteAdmin: false, realmIds: ["r_eurth", "r_bee"], categoryIds: ["cat_general"] },
  };
  const createdAt = new Date("2026-10-09T12:00:00Z");
  /** Content written by the realm moderator u_f; anything else is someone else's. */
  const ownContent = [
    { id: "t_own", authorUserId: "u_f" },
    { id: "p_own", authorUserId: "u_f" },
    { id: "p_other", authorUserId: "u_m" },
  ];
  const authored = jest.fn(
    async ({ where }: { where: { id: { in: string[] }; authorUserId: string } }) =>
      ownContent
        .filter((c) => where.id.in.includes(c.id) && c.authorUserId === where.authorUserId)
        .map((c) => ({ id: c.id }))
  );
  function logDb(rows: object[] = []) {
    return {
      forumThread: { findMany: authored },
      forumPost: { findMany: authored },
      forumModLog: {
        create: jest.fn(async () => ({ id: "log1" })),
        findMany: jest.fn(async () => rows),
        count: jest.fn(async () => rows.length),
      },
      forumCategory: {
        findMany: jest.fn(async ({ where }: { where: { realmId: string | { in: string[] } } }) =>
          typeof where.realmId === "string"
            ? [{ id: `cat_${where.realmId}_hub` }]
            : where.realmId.in.map((id) => ({ id: `cat_${id}_hub` }))
        ),
      },
    };
  }
  const row = (detail: string | null) => ({
    id: "log1",
    actorId: "u_a",
    action: "ban.issue",
    targetType: "user",
    targetId: "u_p",
    scope: "realm",
    scopeId: "r_eurth",
    detail,
    createdAt,
  });
  describe("listModLog", () => {
    const reportRow = (action: string, targetType: string, targetId: string) => ({
      ...row(JSON.stringify({ note: "Flagged by the usual suspect", targetType, targetId })),
      id: `log_${targetId}`,
      action,
      targetType: "report",
      targetId: `rep_${targetId}`,
      scope: "category",
      scopeId: "cat_general",
    });
    const reportRows = () => [
      reportRow("report.resolve", "post", "p_own"),
      reportRow("report.dismiss", "thread", "t_own"),
      reportRow("report.resolve", "post", "p_other"),
    ];
    const notes = (result: Awaited<ReturnType<typeof listModLog>>) =>
      result.rows.map((r) => r.detail?.note ?? null);

    it("withholds the handler's note from a moderator on report rows about their own content", async () => {
      authored.mockClear();
      const result = await listModLog(logDb(reportRows()) as never, realmMod, {}, 1);
      expect(notes(result)).toEqual([null, null, "Flagged by the usual suspect"]);
      expect(result.rows[0]!.detail).toEqual({ note: null, targetType: "post", targetId: "p_own" });
      expect(authored).toHaveBeenCalledTimes(2);
    });
    it("refuses members", async () => {
      await expect(listModLog(logDb() as never, member, {}, 1)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(listModLog(logDb() as never, null, {}, 1)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });
    it("shows other moderators their realms' rows and their categories' rows only", async () => {
      const db = logDb();
      await listModLog(db as never, realmMod, {}, 1);
      expect(db.forumModLog.findMany.mock.calls[0]).toEqual([
        expect.objectContaining({
          where: {
            OR: [
              { scope: "realm", scopeId: { in: ["r_eurth", "r_bee"] } },
              {
                scope: "category",
                scopeId: { in: ["cat_r_eurth_hub", "cat_r_bee_hub", "cat_general"] },
              },
            ],
          },
        }),
      ]);
    });
  });
});

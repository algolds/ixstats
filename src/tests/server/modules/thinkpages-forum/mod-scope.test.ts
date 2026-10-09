/** @jest-environment node */
import {
  assertModeratesCategory,
  assertScope,
  canActInScope,
  canModerateCategory,
  canSeeThread,
  isModerator,
  moderatorContext,
  scopeCategoryIds,
  scopeOfCategory,
} from "~/server/modules/thinkpages-forum";
import {
  banScopeOf,
  pageWindow,
  scopeColumns,
  scopeFromColumns,
} from "~/server/modules/thinkpages-forum/mod-scope";

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
const eurthHub = { id: "cat_eurth_hub", scope: "realm", realmId: "r_eurth", visibility: "public" };
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
      findMany: jest.fn(async ({ where }: { where: { userId: string; powers: { has: string } } }) =>
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

  it("flags site admins and spends no query on them", async () => {
    const db = scopeDb();
    expect(await moderatorContext(db as never, admin)).toEqual({
      siteAdmin: true,
      realmIds: [],
      categoryIds: [],
    });
    expect(db.realm.findMany).not.toHaveBeenCalled();
    expect(db.realmOfficer.findMany).not.toHaveBeenCalled();
    expect(db.forumCategoryModerator.findMany).not.toHaveBeenCalled();
  });
});

describe("scope checks", () => {
  it("knows who moderates anything", () => {
    expect(isModerator(null)).toBe(false);
    expect(isModerator(member)).toBe(false);
    expect(isModerator({ ...member, mod: noMod })).toBe(false);
    expect(isModerator(admin)).toBe(true);
    expect(isModerator(realmMod)).toBe(true);
    expect(isModerator(categoryMod)).toBe(true);
  });

  it("lets site admins moderate every category, even without a moderator context", () => {
    for (const category of [general, reports, staff, eurthHub, beeHub]) {
      expect(canModerateCategory(admin, category)).toBe(true);
    }
  });

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

  it("allows a realm scope to its moderators and a category scope to its own or its realm's", () => {
    expect(canActInScope(realmMod, { kind: "realm", realmId: "r_eurth" }, null)).toBe(true);
    expect(canActInScope(realmMod, { kind: "realm", realmId: "r_bee" }, null)).toBe(false);
    expect(canActInScope(categoryMod, { kind: "realm", realmId: "r_eurth" }, null)).toBe(false);
    const hubScope = { kind: "category", categoryId: "cat_eurth_hub" } as const;
    expect(canActInScope(realmMod, hubScope, "r_eurth")).toBe(true);
    expect(canActInScope(realmMod, hubScope, null)).toBe(false);
    expect(canActInScope(categoryMod, { kind: "category", categoryId: "cat_general" }, null)).toBe(
      true
    );
    expect(canActInScope(categoryMod, { kind: "category", categoryId: "cat_reports" }, null)).toBe(
      false
    );
    expect(canActInScope(admin, { kind: "category", categoryId: "cat_staff" }, null)).toBe(true);
  });

  it("refuses out-of-scope actions with FORBIDDEN", () => {
    expect(() => assertScope(realmMod, { kind: "site" }, null)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", message: "You can't act at this scope." })
    );
    expect(() => assertScope(null, { kind: "realm", realmId: "r_eurth" }, null)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" })
    );
    expect(() => assertScope(realmMod, { kind: "realm", realmId: "r_eurth" }, null)).not.toThrow();
    expect(() => assertModeratesCategory(realmMod, general)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", message: "You don't moderate this category." })
    );
    expect(() => assertModeratesCategory(null, general)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" })
    );
    expect(() => assertModeratesCategory(realmMod, eurthHub)).not.toThrow();
  });

  it("names a category's scope: its realm, or the category itself sitewide", () => {
    expect(scopeOfCategory(eurthHub)).toEqual({ kind: "realm", realmId: "r_eurth" });
    expect(scopeOfCategory(general)).toEqual({ kind: "category", categoryId: "cat_general" });
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

  it("puts no filter on site admins, without a query", async () => {
    const db = categoryDb();
    expect(await scopeCategoryIds(db as never, admin)).toBeNull();
    expect(db.forumCategory.findMany).not.toHaveBeenCalled();
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

  it("gives category moderators their categories without a query, and members nothing", async () => {
    const db = categoryDb();
    expect(await scopeCategoryIds(db as never, categoryMod)).toEqual(["cat_general"]);
    expect(await scopeCategoryIds(db as never, member)).toEqual([]);
    expect(await scopeCategoryIds(db as never, null)).toEqual([]);
    expect(db.forumCategory.findMany).not.toHaveBeenCalled();
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
  it("round-trips a scope through its columns", () => {
    for (const scope of [
      { kind: "site" },
      { kind: "realm", realmId: "r_eurth" },
      { kind: "category", categoryId: "cat_general" },
    ] as const) {
      const columns = scopeColumns(scope);
      expect(scopeFromColumns(columns.scope, columns.scopeId)).toEqual(scope);
    }
    expect(scopeColumns({ kind: "realm", realmId: "r_eurth" })).toEqual({
      scope: "realm",
      scopeId: "r_eurth",
    });
  });

  it("reads a malformed stored scope as site, which only site admins act on", () => {
    expect(scopeFromColumns("realm", null)).toEqual({ kind: "site" });
    expect(scopeFromColumns("category", null)).toEqual({ kind: "site" });
    expect(scopeFromColumns("planet", "x")).toEqual({ kind: "site" });
    expect(banScopeOf("category")).toBe("category");
    expect(banScopeOf("planet")).toBe("site");
  });

  it("pages from 1, treating nonsense as the first page", () => {
    expect(pageWindow(1, 25)).toEqual({ skip: 0, take: 25 });
    expect(pageWindow(3.7, 25)).toEqual({ skip: 50, take: 25 });
    expect(pageWindow(0, 25)).toEqual({ skip: 0, take: 25 });
    expect(pageWindow(Number.NaN, 25)).toEqual({ skip: 0, take: 25 });
  });
});

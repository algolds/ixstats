/** @jest-environment node */
import { REALM_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import { SITE_CATEGORIES } from "~/tests/helpers/forum-site-categories";
import {
  authorsOf,
  canSeeCategory,
  canStartThread,
  getCategoryThreads,
  getThreadPosts,
  resolvePostLocation,
} from "~/server/modules/thinkpages-forum";
import { advertGate, ADVERT_REALM_SELECT } from "~/server/modules/thinkpages-forum/advert-access";
import { summarizeCategories } from "~/server/modules/thinkpages-forum/reads";
import {
  privacyConfigRow,
  privacyConnections,
  wikiAttributionOff,
} from "~/tests/helpers/privacy-config-fake";
import {
  boardTopPosters,
  latestPerCategory,
  trendingThreads,
} from "~/server/modules/thinkpages-forum/board-reads";
import { latestActivity, listBoards } from "~/server/modules/thinkpages-forum/board-list";
import { latestPublicThreadPreviews } from "~/server/modules/thinkpages-forum/thread-preview";
import { describe, expect, it, jest } from "@jest/globals";
import { latestPublicThreads } from "~/server/modules/thinkpages-forum/public-threads";
import {
  roleOf,
  threadLastPosters,
  threadParticipants,
  type RoleContext,
} from "~/server/modules/thinkpages-forum/thread-extras";
import {
  forumActivityOf,
  importedAuthorByName,
} from "~/server/modules/thinkpages-forum/member-activity";

const admin = {
  id: "u_a",
  clerkUserId: "admin",
  countryId: null,
  role: { name: "admin", level: 10 },
};
const user = {
  id: "u_p",
  clerkUserId: "plain",
  countryId: "c1",
  role: { name: "user", level: 100 },
};

const categories = SITE_CATEGORIES.map((c, i) => ({
  id: `cat_${c.key}`,
  scope: "site",
  realmId: null,
  ...c,
  order: i,
}));
const general = categories.find((c) => c.key === "general")!;
const staff = categories.find((c) => c.key === "staff")!;

const realms = [
  { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" },
  { id: "r_b", slug: "b", name: "Bee", status: "active", ownerId: "founder" },
  { id: "r_draft", slug: "draft-land", name: "Draft Land", status: "draft", ownerId: "founder" },
];
const realmCategories = realms.flatMap((r) =>
  REALM_CATEGORIES.map((c) => ({
    id: `cat_${r.slug}_${c.key}`,
    scope: "realm",
    realmId: r.id,
    ...c,
    visibility: "public",
    postRole: "any",
  }))
);
const allCategories = [...categories, ...realmCategories];
const eurthHub = realmCategories.find((c) => c.id === "cat_eurth_hub")!;
const draftHub = realmCategories.find((c) => c.id === "cat_draft-land_hub")!;
const founder = {
  id: "u_f",
  clerkUserId: "founder",
  countryId: null,
  role: { name: "user", level: 100 },
};

interface CategoryWhere {
  scope: string;
  realmId: string | null;
  key: string;
}

/** The query args the specs read back out of `mock.calls`. */
interface WhereArgs {
  where: Record<string, string | boolean | object>;
}
interface UserFindArgs extends WhereArgs {
  select: Record<string, boolean | { select: Record<string, boolean> }>;
}
interface ThreadSelectArgs {
  select: { thread: { select: object } };
}
interface AuthorUserRow {
  id: string;
  handle: string | null;
  wikiUsername: string | null;
  clerkUserId?: string;
  country: { name: string; flag?: string | null } | null;
}
interface AuthorAccountRow {
  id?: string;
  clerkUserId?: string;
  displayName?: string;
  username?: string;
  profileImageUrl?: string | null;
  accountType?: string;
}

function readDb(opts: { thread?: object | null; post?: object | null } = {}) {
  return {
    forumCategory: {
      findMany: jest.fn(async () => categories),
      findFirst: jest.fn(
        async ({ where }: { where: CategoryWhere }) =>
          allCategories.find(
            (c) => c.scope === where.scope && c.realmId === where.realmId && c.key === where.key
          ) ?? null
      ),
    },
    realm: {
      findUnique: jest.fn(
        async ({ where }: { where: { slug?: string; id?: string } }) =>
          realms.find((r) =>
            where.slug !== undefined ? r.slug === where.slug : r.id === where.id
          ) ?? null
      ),
    },
    forumThread: {
      groupBy: jest.fn(async (_args: WhereArgs) => [
        {
          categoryId: "cat_general",
          _count: { _all: 4 },
          _max: { lastPostAt: new Date("2026-10-01") },
        },
      ]),
      findMany: jest.fn(async (_args: WhereArgs) => [{ id: "t1", title: "Hello" }]),
      count: jest.fn(async (_args: WhereArgs) => 1),
      findUnique: jest.fn(async () => opts.thread ?? null),
    },
    forumPost: {
      findMany: jest.fn(async (_args: WhereArgs) => [{ id: "p1" }]),
      count: jest.fn(async (_args: WhereArgs) => 1),
      findUnique: jest.fn(async (_args: ThreadSelectArgs) => opts.post ?? null),
    },
    user: { findMany: jest.fn(async (_args: UserFindArgs): Promise<AuthorUserRow[]> => []) },
    thinkpagesAccount: {
      findMany: jest.fn(async (_args?: object): Promise<AuthorAccountRow[]> => []),
    },
    userConnection: privacyConnections(),
  };
}

const threadIn = (category: typeof general | typeof eurthHub, extra: object = {}) => ({
  id: "t1",
  title: "Hello",
  categoryId: category.id,
  hidden: false,
  category,
  ...extra,
});

describe("access rules", () => {
  it("shows public categories to everyone, reports to members and staff categories to admins only (M8)", () => {
    expect(canSeeCategory(null, general)).toBe(true);
    expect(canSeeCategory(user, staff)).toBe(false);
    expect(canSeeCategory(null, { visibility: "reporter_staff" })).toBe(false);
    expect(canSeeCategory(user, { visibility: "reporter_staff" })).toBe(true);
    expect(canSeeCategory(admin, staff)).toBe(true);
    expect(canSeeCategory(admin, { visibility: "reporter_staff" })).toBe(true);
  });
  it("limits staff-role categories to admins and hidden categories to those who can see them", () => {
    const rules = categories.find((c) => c.key === "rules")!;
    expect(canStartThread(user, rules)).toBe(false);
    expect(canStartThread(admin, rules)).toBe(true);
    expect(canStartThread(user, staff)).toBe(false);
    expect(canStartThread(admin, staff)).toBe(true);
  });
});

describe("summarizeCategories (the sitewide boards)", () => {
  it("counts only the member's own threads in Reports, and all of them for an admin (M8)", async () => {
    const db = readDb();
    await summarizeCategories(db as never, user, categories as never);
    const where = db.forumThread.groupBy.mock.calls[0][0].where;
    const reportsId = categories.find((c) => c.key === "reports")!.id;
    expect(where.OR).toEqual([
      {
        categoryId: {
          in: categories.filter((c) => !["staff", "reports"].includes(c.key)).map((c) => c.id),
        },
      },
      { categoryId: { in: [reportsId] }, authorUserId: "u_p" },
    ]);
    const adminDb = readDb();
    await summarizeCategories(adminDb as never, admin, categories as never);
    expect(adminDb.forumThread.groupBy.mock.calls[0][0].where.OR).toEqual([
      { categoryId: { in: categories.map((c) => c.id) } },
    ]);
  });
});
describe("getCategoryThreads in a realm", () => {
  it("looks the category up by realm, scope and key, never by key alone", async () => {
    const db = readDb();
    const out = await getCategoryThreads(db as never, user, { key: "hub", realm: "eurth" }, 1);
    expect(db.forumCategory.findFirst).toHaveBeenCalledTimes(1);
    expect(db.forumCategory.findFirst).toHaveBeenCalledWith({
      where: { scope: "realm", realmId: "r_eurth", key: "hub" },
    });
    expect(db.forumThread.findMany.mock.calls[0][0].where).toEqual({
      categoryId: "cat_eurth_hub",
      hidden: false,
      ...advertGate(user),
    });
    expect(out.category).toMatchObject({
      key: "hub",
      scope: "realm",
      realmId: "r_eurth",
      realm: { slug: "eurth", name: "Eurth" },
    });
  });
  it("gives NOT_FOUND for a draft realm's category to a plain user and anonymous, and finds it for its founder", async () => {
    for (const viewer of [user, null]) {
      const db = readDb();
      await expect(
        getCategoryThreads(db as never, viewer, { key: "hub", realm: "draft-land" }, 1)
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(db.forumCategory.findFirst).not.toHaveBeenCalled();
    }
    await expect(
      getCategoryThreads(readDb() as never, founder, { key: "hub", realm: "draft-land" }, 1)
    ).resolves.toMatchObject({
      category: { key: "hub", realm: { slug: "draft-land", name: "Draft Land" } },
    });
    await expect(
      getCategoryThreads(readDb() as never, admin, { key: "hub", realm: "draft-land" }, 1)
    ).resolves.toBeDefined();
  });
});
describe("getThreadPosts", () => {
  it("gives NOT_FOUND for a hidden thread to a plain user and shows it to an admin", async () => {
    const hidden = threadIn(general, { hidden: true });
    await expect(
      getThreadPosts(readDb({ thread: hidden }) as never, user, "t1", 1)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      getThreadPosts(readDb({ thread: hidden }) as never, null, "t1", 1)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const db = readDb({ thread: hidden });
    await getThreadPosts(db as never, admin, "t1", 1);
    expect(db.forumPost.findMany.mock.calls[0][0].where).toEqual({ threadId: "t1" });
  });
});

describe("resolvePostLocation", () => {
  const createdAt = new Date("2026-10-02");
  const post = (extra: object = {}) => ({
    id: "p9",
    threadId: "t1",
    createdAt,
    hidden: false,
    thread: threadIn(general),
    ...extra,
  });
  it("returns null for a post in a draft realm's thread unless the viewer is its founder", async () => {
    const inDraft = () => readDb({ post: post({ thread: threadIn(draftHub) }) });
    const db = inDraft();
    await expect(resolvePostLocation(db as never, user, "p9")).resolves.toBeNull();
    expect(db.forumPost.findUnique.mock.calls[0][0].select.thread.select).toEqual({
      authorUserId: true,
      hidden: true,
      advertRealm: { select: ADVERT_REALM_SELECT },
      category: {
        select: { id: true, key: true, style: true, visibility: true, scope: true, realmId: true },
      },
    });
    expect(db.forumPost.count).not.toHaveBeenCalled();
    await expect(resolvePostLocation(inDraft() as never, null, "p9")).resolves.toBeNull();
    await expect(resolvePostLocation(inDraft() as never, founder, "p9")).resolves.toEqual({
      threadId: "t1",
      page: 1,
    });
    await expect(
      resolvePostLocation(
        readDb({ post: post({ thread: threadIn(eurthHub) }) }) as never,
        user,
        "p9"
      )
    ).resolves.toEqual({ threadId: "t1", page: 1 });
  });

  it("returns null for an unknown post, a hidden post or thread (non-admin), and an invisible category", async () => {
    await expect(resolvePostLocation(readDb() as never, user, "x")).resolves.toBeNull();
    await expect(
      resolvePostLocation(readDb({ post: post({ hidden: true }) }) as never, user, "p9")
    ).resolves.toBeNull();
    await expect(
      resolvePostLocation(
        readDb({ post: post({ thread: threadIn(general, { hidden: true }) }) }) as never,
        user,
        "p9"
      )
    ).resolves.toBeNull();
    await expect(
      resolvePostLocation(readDb({ post: post({ thread: threadIn(staff) }) }) as never, user, "p9")
    ).resolves.toBeNull();
    await expect(
      resolvePostLocation(readDb({ post: post({ hidden: true }) }) as never, admin, "p9")
    ).resolves.toEqual({
      threadId: "t1",
      page: 1,
    });
  });
});

describe("authorsOf", () => {
  it("names users handle, then wiki name, then country name, then Member, never the discord or forum name or clerk id", async () => {
    const db = readDb();
    db.user.findMany.mockResolvedValue([
      { id: "u1", handle: "heku", wikiUsername: "Heku", country: { name: "Caphiria" } },
      { id: "u2", handle: null, wikiUsername: "WikiName", country: { name: "Caphiria" } },
      { id: "u3", handle: null, wikiUsername: null, country: { name: "Aurelia" } },
      { id: "u4", handle: null, wikiUsername: null, country: null },
    ]);
    db.thinkpagesAccount.findMany.mockResolvedValue([
      {
        id: "a1",
        displayName: "The Voice",
        username: "voice",
        profileImageUrl: null,
        accountType: "citizen",
      },
    ]);
    const out = await authorsOf(db as never, ["u1", "u2", "u3", "u4", "u1"], ["a1"]);
    expect(out.users.get("u1")).toEqual({
      name: "heku",
      handle: "heku",
      avatarUrl: null,
      flagUrl: null,
    });
    expect(out.users.get("u2")).toEqual({
      name: "WikiName",
      handle: null,
      avatarUrl: null,
      flagUrl: null,
    });
    expect(out.users.get("u3")).toEqual({
      name: "Aurelia",
      handle: null,
      avatarUrl: null,
      flagUrl: null,
    });
    expect(out.users.get("u4")).toEqual({
      name: "Member",
      handle: null,
      avatarUrl: null,
      flagUrl: null,
    });
    expect(out.personas.get("a1")).toEqual({
      displayName: "The Voice",
      username: "voice",
      avatarUrl: null,
      personaType: "citizen",
    });
    expect(db.user.findMany).toHaveBeenCalledTimes(1);
    expect(db.user.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ["u1", "u2", "u3", "u4"] },
    });
    expect(JSON.stringify([...out.users.values()])).not.toContain("clerk");
    expect(db.user.findMany.mock.calls[0][0].select).not.toHaveProperty("name");
    expect(db.user.findMany.mock.calls[0][0].select).not.toHaveProperty("discordUsername");
    expect(db.user.findMany.mock.calls[0][0].select.country).toEqual({
      select: { name: true, flag: true },
    });
  });

  it("gives a member their personal persona's avatar and their country's flag, and a persona its own avatar", async () => {
    const db = readDb();
    db.user.findMany.mockResolvedValue([
      {
        id: "u1",
        clerkUserId: "c1",
        handle: "heku",
        wikiUsername: null,
        country: { name: "Caphiria", flag: "/flags/caph.png" },
      },
      { id: "u2", clerkUserId: "c2", handle: "bee", wikiUsername: null, country: null },
    ]);
    db.thinkpagesAccount.findMany.mockImplementation(async (args?: object) =>
      (args as { where: { id?: unknown } }).where.id
        ? [
            {
              id: "a1",
              displayName: "The Voice",
              username: "voice",
              profileImageUrl: "/p/voice.png",
              accountType: "government",
            },
          ]
        : [{ clerkUserId: "c1", profileImageUrl: "/p/heku.png" }]
    );
    const out = await authorsOf(db as never, ["u1", "u2"], ["a1"]);
    expect(out.users.get("u1")).toEqual({
      name: "heku",
      handle: "heku",
      avatarUrl: "/p/heku.png",
      flagUrl: "/flags/caph.png",
    });
    expect(out.users.get("u2")).toMatchObject({ avatarUrl: null, flagUrl: null });
    expect(out.personas.get("a1")).toEqual({
      displayName: "The Voice",
      username: "voice",
      avatarUrl: "/p/voice.png",
      personaType: "government",
    });
    const personal = db.thinkpagesAccount.findMany.mock.calls.find(
      ([a]) => !(a as { where: { id?: unknown } }).where.id
    )![0] as unknown as { where: object };
    expect(personal.where).toEqual({
      clerkUserId: { in: ["c1", "c2"] },
      accountType: "personal",
      isActive: true,
    });
  });

  it("skips the wiki name of a member with wiki attribution off, the same for every viewer", async () => {
    const db = readDb();
    db.user.findMany.mockResolvedValue([
      { id: "u1", clerkUserId: "c1", handle: "heku", wikiUsername: "Heku", country: null },
      {
        id: "u2",
        clerkUserId: "c2",
        handle: null,
        wikiUsername: "WikiName",
        country: { name: "Caphiria" },
      },
      { id: "u3", clerkUserId: "c3", handle: null, wikiUsername: "Plain", country: null },
      { id: "u4", clerkUserId: "c4", handle: null, wikiUsername: "Shown", country: null },
    ]);
    db.userConnection.findMany.mockResolvedValue([
      ...wikiAttributionOff("c1", "c2", "c3"),
      privacyConfigRow("c4", { showWikiAttribution: true }),
    ]);
    const out = await authorsOf(db as never, ["u1", "u2", "u3", "u4"], []);
    expect([...out.users.values()].map((u) => u.name)).toEqual([
      "heku",
      "Caphiria",
      "Member",
      "Shown",
    ]);
    expect(db.userConnection.findMany).toHaveBeenCalledTimes(1);
  });

  it("fails closed: a switch it cannot read hides every wiki name", async () => {
    const db = readDb();
    db.user.findMany.mockResolvedValue([
      {
        id: "u1",
        clerkUserId: "c1",
        handle: null,
        wikiUsername: "WikiName",
        country: { name: "Caphiria" },
      },
      { id: "u2", clerkUserId: "c2", handle: null, wikiUsername: "Other", country: null },
      { id: "u3", clerkUserId: "c3", handle: "heku", wikiUsername: "Heku", country: null },
    ]);
    db.userConnection.findMany.mockRejectedValue(new Error("db down"));
    const out = await authorsOf(db as never, ["u1", "u2", "u3"], []);
    expect([...out.users.values()].map((u) => u.name)).toEqual(["Caphiria", "Member", "heku"]);
  });
});

describe("moderator-aware reads (M9) and Reports (M8)", () => {
  const realmMod = {
    id: "u_rm",
    clerkUserId: "realm-mod",
    countryId: null,
    role: { name: "user", level: 100 },
    mod: { siteAdmin: false, realmIds: ["r_eurth"], categoryIds: [] },
  };
  const categoryMod = {
    ...user,
    mod: { siteAdmin: false, realmIds: [], categoryIds: ["cat_reports"] },
  };
  const reports = categories.find((c) => c.key === "reports")!;

  it("shows a realm moderator hidden threads in their realm's Hub, not in General, with canModerate and category.id", async () => {
    const hubDb = readDb();
    const hub = await getCategoryThreads(
      hubDb as never,
      realmMod,
      { key: "hub", realm: "eurth" },
      1
    );
    const hubWhere = { categoryId: "cat_eurth_hub", ...advertGate(realmMod) };
    expect(hubDb.forumThread.findMany.mock.calls[0][0].where).toEqual(hubWhere);
    expect(hubDb.forumThread.count.mock.calls[0][0].where).toEqual(hubWhere);
    expect(hub).toMatchObject({ canModerate: true, category: { id: "cat_eurth_hub" } });
    const generalDb = readDb();
    const site = await getCategoryThreads(generalDb as never, realmMod, { key: "general" }, 1);
    expect(generalDb.forumThread.findMany.mock.calls[0][0].where).toEqual({
      categoryId: "cat_general",
      hidden: false,
      ...advertGate(realmMod),
    });
    expect(site).toMatchObject({ canModerate: false, category: { id: "cat_general" } });
    const member = await getCategoryThreads(
      readDb() as never,
      user,
      { key: "hub", realm: "eurth" },
      1
    );
    expect(member.canModerate).toBe(false);
  });

  it("lists only the member's own Reports threads, and all of them for an admin or the category's moderator", async () => {
    const db = readDb();
    await getCategoryThreads(db as never, user, { key: "reports" }, 1);
    const own = {
      categoryId: "cat_reports",
      hidden: false,
      authorUserId: "u_p",
      ...advertGate(user),
    };
    expect(db.forumThread.findMany.mock.calls[0][0].where).toEqual(own);
    expect(db.forumThread.count.mock.calls[0][0].where).toEqual(own);
    const adminDb = readDb();
    await getCategoryThreads(adminDb as never, admin, { key: "reports" }, 1);
    expect(adminDb.forumThread.findMany.mock.calls[0][0].where).toEqual({
      categoryId: "cat_reports",
    });
    const modDb = readDb();
    await getCategoryThreads(modDb as never, categoryMod, { key: "reports" }, 1);
    expect(modDb.forumThread.findMany.mock.calls[0][0].where).toEqual({
      categoryId: "cat_reports",
      ...advertGate(categoryMod),
    });
  });

  it("gives a member NOT_FOUND for another member's Reports thread, and reads their own", async () => {
    const theirs = readDb({ thread: threadIn(reports, { authorUserId: "u_other" }) });
    await expect(getThreadPosts(theirs as never, user, "t1", 1)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(theirs.forumPost.findMany).not.toHaveBeenCalled();
    await expect(
      getThreadPosts(
        readDb({ thread: threadIn(reports, { authorUserId: "u_p" }) }) as never,
        user,
        "t1",
        1
      )
    ).resolves.toMatchObject({ canModerate: false, category: { id: "cat_reports" } });
    await expect(
      getThreadPosts(
        readDb({ thread: threadIn(reports, { authorUserId: "u_other" }) }) as never,
        admin,
        "t1",
        1
      )
    ).resolves.toMatchObject({ canModerate: true });
  });
  it("resolves a Reports post's permalink for its thread's author and moderators only", async () => {
    const createdAt = new Date("2026-10-02");
    const reportPost = (authorUserId: string) => ({
      id: "p9",
      threadId: "t1",
      createdAt,
      hidden: false,
      thread: threadIn(reports, { authorUserId }),
    });
    await expect(
      resolvePostLocation(readDb({ post: reportPost("u_other") }) as never, user, "p9")
    ).resolves.toBeNull();
    await expect(
      resolvePostLocation(readDb({ post: reportPost("u_other") }) as never, null, "p9")
    ).resolves.toBeNull();
    await expect(
      resolvePostLocation(readDb({ post: reportPost("u_p") }) as never, user, "p9")
    ).resolves.toEqual({
      threadId: "t1",
      page: 1,
    });
    await expect(
      resolvePostLocation(readDb({ post: reportPost("u_other") }) as never, admin, "p9")
    ).resolves.toEqual({
      threadId: "t1",
      page: 1,
    });
  });
});

describe("board lists, latest activity and Trending", () => {
  const member = {
    id: "u_m",
    clerkUserId: "member",
    countryId: "c1",
    role: { name: "user", level: 100 },
  };
  const categories = SITE_CATEGORIES.map((c, i) => ({
    id: `cat_${c.key}`,
    scope: "site",
    realmId: null,
    style: "ooc",
    ...c,
    order: i,
  }));
  const byKey = (key: string) => categories.find((c) => c.key === key)!;
  const general = byKey("general");
  const staff = byKey("staff");
  const reports = byKey("reports");
  const T1 = new Date("2026-10-08T10:00:00Z");
  const T2 = new Date("2026-10-09T08:00:00Z");
  interface Args {
    where: { OR?: Array<Record<string, unknown>> } & Record<string, unknown>;
    [key: string]: unknown;
  }
  const argsOf = (fn: jest.Mock, call = 0) => fn.mock.calls[call]![0] as Args;
  function latestDb() {
    return {
      forumThread: {
        findMany: jest.fn(async (_args: object) => [
          { id: "t_g", title: "General chat", categoryId: general.id, lastPostAt: T2 },
          { id: "t_r", title: "Find me", categoryId: byKey("find-a-realm").id, lastPostAt: T1 },
        ]),
      },
      forumPost: {
        findMany: jest.fn(async (_args: object) => [
          {
            threadId: "t_g",
            authorUserId: "u_x",
            authorPersonaId: "pa_1",
            importedAuthorName: null,
            createdAt: T2,
          },
          {
            threadId: "t_r",
            authorUserId: null,
            authorPersonaId: null,
            importedAuthorName: "OldName",
            createdAt: T1,
          },
        ]),
      },
    };
  }
  describe("latestPerCategory", () => {
    it("shows a member only their own threads in Reports", async () => {
      const db = latestDb();
      await latestPerCategory(db as never, member, [reports]);
      expect(argsOf(db.forumThread.findMany).where.OR).toEqual([
        { categoryId: reports.id, hidden: false, authorUserId: member.id, ...advertGate(member) },
      ]);
    });
  });
  describe("trendingThreads", () => {
    const NOW = new Date("2026-10-09T12:00:00Z");
    const row = (id: string, category: object, authorUserId: string | null = "u_x") => ({
      id,
      title: `Thread ${id}`,
      authorUserId,
      hidden: false,
      category,
    });
    function trendingDb(threads: object[]) {
      return {
        realm: {
          findMany: jest.fn(async () => [
            { id: "r1", status: "active" },
            { id: "r_draft", status: "draft" },
          ]),
        },
        forumPost: {
          groupBy: jest.fn(async (_args: object) => [
            { threadId: "t_staff", _count: { threadId: 9 } },
            { threadId: "t_gen", _count: { threadId: 6 } },
            { threadId: "t_rep", _count: { threadId: 4 } },
          ]),
        },
        forumThread: { findMany: jest.fn(async (_args: object) => threads) },
      };
    }
    const threads = [
      row("t_gen", general),
      row("t_staff", staff),
      row("t_rep", reports, "someone_else"),
    ];

    it("ranks by posts in the last 24 hours and drops threads the member cannot see", async () => {
      const db = trendingDb(threads);
      const out = await trendingThreads(db as never, member, 5, NOW);
      expect(out).toEqual([
        { threadId: "t_gen", title: "Thread t_gen", categoryName: "General", repliesToday: 6 },
      ]);
      const args = argsOf(db.forumPost.groupBy);
      expect(args).toMatchObject({
        by: ["threadId"],
        orderBy: { _count: { threadId: "desc" } },
      });
      expect(args.where.createdAt).toEqual({ gte: new Date("2026-10-08T12:00:00Z") });
      expect(args.where.hidden).toBe(false);
    });
    it("leaves out threads of categories in unpublished realms", async () => {
      const db = trendingDb(threads);
      await trendingThreads(db as never, member, 5, NOW);
      const category = (argsOf(db.forumPost.groupBy).where.thread as { category: object }).category;
      expect(category).toEqual({
        style: { not: "board" },
        NOT: { scope: "realm", key: "board" },
        OR: [
          { scope: "site" },
          { scope: "realm", realmId: { in: expect.arrayContaining(["r1"]) } },
        ],
      });
      const realmIds = (category as { OR: Array<{ realmId?: { in: string[] } }> }).OR[1]!.realmId!
        .in;
      expect(realmIds).not.toContain("r_draft");
    });
  });
  describe("boardTopPosters", () => {
    const NOW = new Date("2026-10-17T12:00:00Z");
    const postsDb = () => ({
      forumPost: {
        groupBy: jest.fn(async (_args: object) => [
          { authorUserId: "u_1", _count: { authorUserId: 7 } },
          { authorUserId: "u_2", _count: { authorUserId: 3 } },
        ]),
      },
    });
    it("does not count persona posts for the player behind the persona", async () => {
      const db = postsDb();
      await boardTopPosters(db as never, null, general, 5, NOW);
      expect(argsOf(db.forumPost.groupBy).where).toMatchObject({
        authorUserId: { not: null },
        authorPersonaId: null,
      });
    });
  });
  describe("listBoards", () => {
    it("hides the player's user id behind a persona's latest post and names the persona", async () => {
      const db = {
        forumCategory: { findMany: jest.fn(async (_args: object) => [general]) },
        forumThread: {
          groupBy: jest.fn(async () => []),
          findMany: jest.fn(async (_args: object) => [
            { id: "t_g", title: "General chat", categoryId: general.id, lastPostAt: T2 },
          ]),
        },
        forumPost: {
          findMany: jest.fn(async (_args: object) => [
            {
              threadId: "t_g",
              authorUserId: "u_x",
              authorPersonaId: "pa_1",
              importedAuthorName: null,
              createdAt: T2,
            },
          ]),
        },
        user: {
          findMany: jest.fn(async (_args: object) => [
            { id: "u_x", handle: "heku", wikiUsername: null, country: null },
          ]),
        },
        thinkpagesAccount: {
          findMany: jest.fn(async (_args: object) => [
            {
              id: "pa_1",
              displayName: "Caphiria News",
              username: "caphnews",
              profileImageUrl: "/p/news.png",
              accountType: "media",
            },
          ]),
        },
      };
      const [row] = await listBoards(db as never, null);
      expect(row!.latest).toMatchObject({
        authorUserId: null,
        authorPersonaId: "pa_1",
        author: {
          name: "Caphiria News",
          handle: "caphnews",
          avatarUrl: "/p/news.png",
          personaType: "media",
        },
      });
      expect(JSON.stringify(row)).not.toContain("u_x");
    });

    it("names an orphaned persona post as a bare persona and never queries or shows the player", async () => {
      const asked: string[][] = [];
      const db = {
        forumCategory: { findMany: jest.fn(async (_args: object) => [general]) },
        forumThread: {
          groupBy: jest.fn(async () => []),
          findMany: jest.fn(async (_args: object) => [
            { id: "t_g", title: "General chat", categoryId: general.id, lastPostAt: T2 },
          ]),
        },
        forumPost: {
          findMany: jest.fn(async (_args: object) => [
            {
              threadId: "t_g",
              authorUserId: "u_x",
              authorPersonaId: "pa_gone",
              importedAuthorName: null,
              createdAt: T2,
            },
          ]),
        },
        user: {
          findMany: jest.fn(async (args: { where: { id: { in: string[] } } }) => {
            asked.push(args.where.id.in);
            return [
              {
                id: "u_x",
                clerkUserId: "c_x",
                handle: "realplayer",
                wikiUsername: null,
                country: { name: "Caphiria", flag: "/flags/caph.png" },
              },
            ];
          }),
        },
        thinkpagesAccount: { findMany: jest.fn(async (_args: object) => []) },
      };
      const [row] = await listBoards(db as never, null);
      expect(row!.latest!.author).toEqual({
        name: "Persona",
        handle: null,
        avatarUrl: null,
        flagUrl: null,
        personaType: null,
      });
      expect(JSON.stringify(row)).not.toMatch(/realplayer|caph\.png|Caphiria|u_x/);
      expect(asked.flat()).not.toContain("u_x");
    });
  });
  describe("latestActivity", () => {
    const T0 = new Date("2026-10-09T07:00:00Z");
    const post = (
      id: string,
      threadId: string,
      category: object,
      at: Date,
      extra: object = {}
    ) => ({
      id,
      threadId,
      authorUserId: "u_x",
      authorPersonaId: null,
      importedAuthorName: null,
      createdAt: at,
      thread: { title: `Thread ${threadId}`, authorUserId: "u_starter", hidden: false, category },
      ...extra,
    });
    function activityDb(posts: object[], firstIds: string[]) {
      const findMany = jest.fn(async (args: { distinct?: string[] }) =>
        args.distinct ? firstIds.map((id) => ({ id })) : posts
      );
      return {
        realm: { findMany: jest.fn(async () => [{ id: "r1", status: "active" }]) },
        forumPost: { findMany },
        user: {
          findMany: jest.fn(async (_args: object) => [
            { id: "u_x", handle: "heku", wikiUsername: null, country: null },
          ]),
        },
        thinkpagesAccount: {
          findMany: jest.fn(async (_args: object) => [
            {
              id: "pa_1",
              displayName: "Caphiria News",
              username: "caphnews",
              profileImageUrl: null,
            },
          ]),
        },
      };
    }

    it("only reads sitewide boards and published realms, never a realm board", async () => {
      const db = activityDb([], []);
      await latestActivity(db as never, null, 6);
      expect((argsOf(db.forumPost.findMany).where.thread as { category: object }).category).toEqual(
        {
          style: { not: "board" },
          NOT: { scope: "realm", key: "board" },
          OR: [
            { scope: "site" },
            { scope: "realm", realmId: { in: expect.arrayContaining(["r1"]) } },
          ],
        }
      );
    });

    it("drops staff boards and other members' reports, then applies the limit", async () => {
      const db = activityDb(
        [
          post("p_s", "t_s", staff, T2),
          post("p_r", "t_r", reports, T2),
          post("p_a", "t_a", general, T1),
          post("p_b", "t_b", general, T0),
        ],
        []
      );
      const out = await latestActivity(db as never, member, 1);
      expect(out.map((i) => i.postId)).toEqual(["p_a"]);
    });

    it("names the persona and never carries the player's id behind it", async () => {
      const db = activityDb([post("p_p", "t_g", general, T2, { authorPersonaId: "pa_1" })], []);
      const [item] = await latestActivity(db as never, null, 6);
      expect(item).toMatchObject({
        authorUserId: null,
        author: { name: "Caphiria News", handle: "caphnews", flagUrl: null },
      });
      expect(JSON.stringify(item)).not.toContain("u_x");
    });
  });
});

describe("thread previews", () => {
  const AT = new Date("2026-10-09T10:00:00Z");
  const NOT_BOARD = { style: { not: "board" }, NOT: { scope: "realm", key: "board" } };
  interface Placement {
    key: string;
    name: string;
    scope: string;
    realmId: string | null;
    style: string;
  }
  interface ListedRow {
    id: string;
    title: string;
    authorUserId: string | null;
    authorPersonaId: string | null;
    importedAuthorName: string | null;
    postCount: number;
    createdAt: Date;
    lastPostAt: Date;
    category: Placement;
  }
  interface FakePost {
    id: string;
    threadId: string;
    authorUserId: string | null;
    authorPersonaId: string | null;
    importedAuthorName: string | null;
    plainText: string;
    reactionCounts: object | string;
    createdAt: Date;
    hidden: boolean;
  }
  interface ListingWhere {
    hidden: boolean;
    category: object;
  }
  interface PostArgs {
    where: PostWhere;
    distinct?: string[];
  }
  interface PostWhere {
    threadId?: string | { in: string[] };
    hidden?: boolean;
    OR?: Array<{ threadId: string; createdAt: Date }>;
  }
  const site = (key = "general", name = "General", style = "ooc"): Placement => ({
    key,
    name,
    scope: "site",
    realmId: null,
    style,
  });
  const inRealm = (realmId: string, key: string, name: string, style: string): Placement => ({
    key,
    name,
    scope: "realm",
    realmId,
    style,
  });
  const listed = (id: string, postCount: number, category = site(), extra = {}): ListedRow => ({
    id,
    title: `Thread ${id}`,
    authorUserId: "u1",
    authorPersonaId: null,
    importedAuthorName: null,
    postCount,
    createdAt: AT,
    lastPostAt: AT,
    category,
    ...extra,
  });
  const post = (id: string, threadId: string, extra: Partial<FakePost> = {}): FakePost => ({
    id,
    threadId,
    authorUserId: "u1",
    authorPersonaId: null,
    importedAuthorName: null,
    plainText: `Text of ${id}`,
    reactionCounts: {},
    createdAt: AT,
    hidden: false,
    ...extra,
  });
  const USERS = [
    {
      id: "u1",
      handle: "jane",
      wikiUsername: null,
      clerkUserId: "clerk_u1",
      country: { name: "Eurth", flag: "https://flags.example/eurth.png" },
    },
    {
      id: "u2",
      handle: "bob",
      wikiUsername: null,
      clerkUserId: "clerk_u2",
      country: null,
    },
    {
      id: "u_secret",
      handle: "secretplayer",
      wikiUsername: null,
      clerkUserId: "clerk_secret",
      country: { name: "Hidden", flag: "https://flags.example/secret.png" },
    },
  ];
  const PERSONA = {
    id: "pa1",
    displayName: "Herald",
    username: "herald",
    profileImageUrl: "https://img.example/herald.png",
    accountType: "government",
  };
  const EURTH = {
    id: "r_eurth",
    slug: "eurth",
    name: "Eurth",
    emblemUrl: "https://img.example/e.png",
    thumbnail: "https://img.example/e-thumb.png",
    status: "active",
  };
  function fakeDb(opts: { listing: ListedRow[]; posts?: FakePost[]; realms?: object[] }) {
    const posts = opts.posts ?? [];
    const visible = (p: FakePost) => !p.hidden;
    const newestFirst = (a: FakePost, b: FakePost) =>
      b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id);
    const oldestFirst = (a: FakePost, b: FakePost) => newestFirst(b, a);
    const threadFindMany = jest.fn(async (_args: { where: ListingWhere }) => opts.listing);
    const postFindMany = jest.fn(async (args: PostArgs) => {
      const { threadId, OR } = args.where;
      if (typeof threadId === "object") {
        const rows = posts
          .filter((p) => threadId.in.includes(p.threadId) && visible(p))
          .sort((a, b) => a.threadId.localeCompare(b.threadId) || oldestFirst(a, b));
        // Like Prisma's `distinct: ["threadId"]`: the first row of each thread in the ordering.
        return args.distinct?.includes("threadId")
          ? rows.filter((p, i) => rows.findIndex((q) => q.threadId === p.threadId) === i)
          : rows;
      }
      return posts
        .filter(
          (p) =>
            visible(p) &&
            (OR ?? []).some(
              (o) => o.threadId === p.threadId && o.createdAt.getTime() === p.createdAt.getTime()
            )
        )
        .sort(newestFirst);
    });
    const postFindFirst = jest.fn(async (args: { where: PostWhere }) => {
      return (
        posts
          .filter((p) => p.threadId === args.where.threadId && visible(p))
          .sort(newestFirst)[0] ?? null
      );
    });
    const userFindMany = jest.fn(async (args: { where: { id: { in: string[] } } }) =>
      USERS.filter((u) => args.where.id.in.includes(u.id))
    );
    const realmFindMany = jest.fn(async (_args: { select: object }) => {
      return opts.realms ?? [EURTH];
    });
    const db = {
      forumThread: { findMany: threadFindMany },
      forumPost: { findMany: postFindMany, findFirst: postFindFirst },
      realm: { findMany: realmFindMany },
      user: { findMany: userFindMany },
      thinkpagesAccount: {
        findMany: jest.fn(async (args: { where: { id?: object } }) =>
          args.where.id ? [PERSONA] : []
        ),
      },
    };
    return {
      db: db as never,
      threadFindMany,
      postFindMany,
      postFindFirst,
      userFindMany,
      realmFindMany,
      accountFindMany: db.thinkpagesAccount.findMany,
    };
  }
  describe("latestPublicThreadPreviews", () => {
    it("shows a persona by name and picture only, never its player", async () => {
      const fake = fakeDb({
        listing: [
          listed("t2", 3, inRealm("r_eurth", "character-threads", "Character Threads", "ic"), {
            authorUserId: "u_secret",
            authorPersonaId: "pa1",
          }),
        ],
        posts: [
          post("p9", "t2", {
            authorUserId: "u_secret",
            authorPersonaId: "pa1",
            plainText: "In character reply",
            reactionCounts: "garbage",
          }),
        ],
      });
      const [out] = await latestPublicThreadPreviews(fake.db, 20);
      expect(out!.preview.author).toEqual({
        name: "Herald",
        avatarUrl: "https://img.example/herald.png",
        flagUrl: null,
        persona: true,
        personaType: "government",
      });
      const text = JSON.stringify(out);
      for (const secret of ["u_secret", "secretplayer", "secret.png", "clerk_secret", "Hidden"]) {
        expect(text).not.toContain(secret);
      }
      expect(out!.preview).toMatchObject({
        style: "ic",
        realm: {
          slug: "eurth",
          name: "Eurth",
          emblemUrl: "https://img.example/e.png",
          thumbnail: "https://img.example/e-thumb.png",
        },
        board: { name: "Character Threads", href: "/thinkpages/r/eurth/character-threads" },
        reactionTotal: 0,
      });
    });
    it("reports a persona thread with no visible post as a persona, by name only, never its player", async () => {
      const fake = fakeDb({
        listing: [listed("t6", 3, site(), { authorUserId: "u_secret", authorPersonaId: "pa1" })],
        posts: [post("p1", "t6", { hidden: true })],
      });
      const [out] = await latestPublicThreadPreviews(fake.db, 20);
      expect(out!.preview.author).toEqual({
        name: "Herald",
        avatarUrl: null,
        flagUrl: null,
        persona: true,
        personaType: "government",
      });
      expect(out!.author).toBe("Herald");
      const text = JSON.stringify(out);
      for (const secret of ["u_secret", "secretplayer", "secret.png", "clerk_secret"]) {
        expect(text).not.toContain(secret);
      }
      // The listing never looks the player up either.
      const asked = fake.userFindMany.mock.calls.flatMap(([args]) => args.where.id.in);
      expect(asked).not.toContain("u_secret");
    });
  });
  describe("what the preview listing reads", () => {
    it("lists only public threads: the advert gate and the board exclusion stay in the query", async () => {
      const fake = fakeDb({ listing: [] });
      await latestPublicThreadPreviews(fake.db, 20);
      const { where } = fake.threadFindMany.mock.calls[0]![0];
      expect(where).toMatchObject({ hidden: false, ...advertGate(null) });
      expect(where.category).toMatchObject(NOT_BOARD);
    });
  });
});

/**
 * Phase 4b (Q10): the activity feed and Trending read native threads instead of XenForo.
 * Only what an anonymous visitor may read is listed: not hidden, in a public category, in the site section or a
 * published realm (Ixnay, active and archived realms; never a draft or generating one).
 */
describe("public threads", () => {
  const NOW = new Date("2026-10-09T12:00:00Z");
  const THREAD = {
    id: "t1",
    title: "Hello",
    authorUserId: "u1",
    authorPersonaId: null,
    importedAuthorName: null,
    postCount: 3,
    createdAt: NOW,
    lastPostAt: NOW,
    category: { name: "General" },
  };
  function fakeDb(threads: object[]) {
    const findMany = jest.fn<(args: object) => Promise<object[]>>().mockResolvedValue(threads);
    const db = {
      forumThread: { findMany },
      realm: {
        findMany: jest.fn<(args: object) => Promise<object[]>>().mockResolvedValue([
          { id: "r_active", status: "active" },
          { id: "r_old", status: "archived" },
          { id: "r_draft", status: "draft" },
          { id: "r_gen", status: "generating" },
        ]),
      },
      user: {
        findMany: jest
          .fn<(args: object) => Promise<object[]>>()
          .mockResolvedValue([{ id: "u1", handle: "jane", wikiUsername: null, country: null }]),
      },
      thinkpagesAccount: {
        findMany: jest
          .fn<(args: object) => Promise<object[]>>()
          .mockResolvedValue([{ id: "pa1", displayName: "Herald", username: "herald" }]),
      },
    };
    return { db: db as never, findMany };
  }
  describe("latestPublicThreads", () => {
    it("names a persona thread by the persona, an imported one by its XenForo name, else Member", async () => {
      const { db } = fakeDb([
        { ...THREAD, id: "t2", authorPersonaId: "pa1" },
        { ...THREAD, id: "t3", authorUserId: null, importedAuthorName: "OldTimer" },
        { ...THREAD, id: "t4", authorUserId: null, importedAuthorName: null, postCount: 0 },
      ]);
      const { threads } = await latestPublicThreads(db, 5);
      expect(threads.map((t) => t.author)).toEqual(["Herald", "OldTimer", "Member"]);
      expect(threads[2]!.replyCount).toBe(0);
    });
  });
});

describe("thread roles, participants and last posters", () => {
  const ctx = (over: Partial<RoleContext> = {}): RoleContext => ({
    staffUserIds: new Set(),
    officerUserIds: new Set(),
    starterUserId: null,
    starterPersonaId: null,
    ...over,
  });
  describe("roleOf", () => {
    it("never gives a player's staff, officer or starter pill to a persona post", () => {
      const c = ctx({
        staffUserIds: new Set(["u1"]),
        officerUserIds: new Set(["u1"]),
        starterUserId: "u1",
        starterPersonaId: null,
      });
      expect(roleOf({ authorUserId: "u1", authorPersonaId: "pa1" }, c)).toBeNull();
    });
  });
  describe("threadParticipants", () => {
    const general = { id: "cat_g", scope: "site", realmId: null, visibility: "public" };
    const member = {
      id: "u_m",
      clerkUserId: "m",
      countryId: null,
      role: { name: "user", level: 100 },
    };
    const rows = [
      { authorUserId: "u1", authorPersonaId: null, importedAuthorName: null, _count: { _all: 5 } },
      { authorUserId: "u2", authorPersonaId: "pa1", importedAuthorName: null, _count: { _all: 7 } },
      { authorUserId: "u2", authorPersonaId: null, importedAuthorName: null, _count: { _all: 2 } },
      {
        authorUserId: null,
        authorPersonaId: null,
        importedAuthorName: "OldName",
        _count: { _all: 3 },
      },
    ];
    const fakeDb = () => ({
      forumPost: { groupBy: jest.fn(async (_args: object) => rows) },
    });

    it("groups persona posts under the persona and never under the player", async () => {
      const out = await threadParticipants(fakeDb() as never, member, general, "t1");
      expect(out.top).toEqual([
        { authorUserId: null, authorPersonaId: "pa1", importedAuthorName: null, posts: 7 },
        { authorUserId: "u1", authorPersonaId: null, importedAuthorName: null, posts: 5 },
        { authorUserId: null, authorPersonaId: null, importedAuthorName: "OldName", posts: 3 },
        { authorUserId: "u2", authorPersonaId: null, importedAuthorName: null, posts: 2 },
      ]);
      expect(out.total).toBe(4);
    });
  });
  describe("threadLastPosters", () => {
    const general = { id: "cat_g", scope: "site", realmId: null, visibility: "public" };
    const member = {
      id: "u_m",
      clerkUserId: "m",
      countryId: null,
      role: { name: "user", level: 100 },
    };
    const admin = {
      id: "u_a",
      clerkUserId: "a",
      countryId: null,
      role: { name: "admin", level: 10 },
    };
    const posts = [
      { threadId: "t1", authorUserId: "u1", authorPersonaId: "pa1", importedAuthorName: "Old" },
      { threadId: "t2", authorUserId: "u2", authorPersonaId: null, importedAuthorName: null },
      { threadId: "t3", authorUserId: null, authorPersonaId: null, importedAuthorName: "OldName" },
    ];
    const fakeDb = () => ({ forumPost: { findMany: jest.fn(async (_args: object) => posts) } });
    it("names a persona post by the persona alone, for a member and a moderator alike", async () => {
      for (const viewer of [member, admin]) {
        const out = await threadLastPosters(fakeDb() as never, viewer, general, ["t1", "t2", "t3"]);
        expect(out.get("t1")).toEqual({
          authorUserId: null,
          authorPersonaId: "pa1",
          importedAuthorName: null,
        });
        expect(out.get("t2")).toEqual({
          authorUserId: "u2",
          authorPersonaId: null,
          importedAuthorName: null,
        });
        expect(out.get("t3")).toEqual({
          authorUserId: null,
          authorPersonaId: null,
          importedAuthorName: "OldName",
        });
      }
    });
  });
});

/**
 * Phase 4b (Q11): the passport's forum footprint comes from the native forum, and only from what anyone may read:
 * not hidden, in a public category, in the site section or a published realm. Staff-only categories and draft
 * realms neither count nor confirm an old forum name.
 */
describe("a member's forum footprint", () => {
  type Value = string | number | boolean | null | Value[] | { [key: string]: Value };
  type Rec = { [key: string]: Value };
  /** A Prisma `where` over plain rows: equality, `in`, `not`, insensitive `equals`, `OR`, nested relations. */
  function matches(row: Rec, where: Rec): boolean {
    return Object.entries(where).every(([key, cond]) => {
      if (key === "OR") return (cond as Rec[]).some((alt) => matches(row, alt));
      if (key === "NOT") return !matches(row, cond as Rec);
      if (key === "AND") return (cond as Rec[]).every((part) => matches(row, part));
      const value = row[key];
      // A fixture without the column reads as null: these rows are no adverts.
      if (cond === null || typeof cond !== "object" || Array.isArray(cond))
        return (value ?? null) === cond;
      const c = cond as Rec;
      if ("in" in c) return (c.in as Value[]).includes(value as Value);
      if ("not" in c) return value !== c.not;
      if ("equals" in c) return String(value).toLowerCase() === String(c.equals).toLowerCase();
      return value !== null && typeof value === "object" && matches(value as Rec, c);
    });
  }
  const PUBLIC_SITE = { visibility: "public", scope: "site", realmId: null };
  const STAFF_SITE = { visibility: "staff", scope: "site", realmId: null };
  const DRAFT_REALM = { visibility: "public", scope: "realm", realmId: "r_draft" };
  const LIVE_REALM = { visibility: "public", scope: "realm", realmId: "r_live" };
  function thread(id: string, category: Rec, extra: Rec = {}): Rec {
    return { id, authorUserId: "u1", authorPersonaId: null, hidden: false, category, ...extra };
  }
  const THREADS = [
    thread("t_public", PUBLIC_SITE),
    thread("t_live", LIVE_REALM),
    thread("t_staff", STAFF_SITE),
    thread("t_draft", DRAFT_REALM),
    thread("t_hidden", PUBLIC_SITE, { hidden: true }),
    thread("t_persona", PUBLIC_SITE, { authorPersonaId: "pa1" }),
    thread("t_board", { ...LIVE_REALM, key: "board", style: "board" }),
  ];
  function post(id: string, threadRow: Rec, extra: Rec = {}): Rec {
    return {
      id,
      authorUserId: "u1",
      authorPersonaId: null,
      hidden: false,
      xenforoUserId: null,
      importedAuthorName: null,
      thread: threadRow,
      ...extra,
    };
  }
  const POSTS = [
    post("p_public", THREADS[0]!),
    post("p_live", THREADS[1]!),
    post("p_staff", THREADS[2]!),
    post("p_draft", THREADS[3]!),
    post("p_in_hidden_thread", THREADS[4]!),
    post("p_hidden", THREADS[0]!, { hidden: true }),
    post("p_staff_import", THREADS[2]!, {
      authorUserId: null,
      xenforoUserId: 66,
      importedAuthorName: "Secretive",
    }),
    post("p_draft_import", THREADS[3]!, {
      authorUserId: null,
      xenforoUserId: 55,
      importedAuthorName: "Drafted",
    }),
    post("p_board", THREADS[6]!),
    post("p_board_import", THREADS[6]!, {
      authorUserId: null,
      xenforoUserId: 88,
      importedAuthorName: "BoardTimer",
    }),
    post("p_public_import", THREADS[0]!, {
      authorUserId: null,
      xenforoUserId: 77,
      importedAuthorName: "OldTimer",
    }),
  ];
  function fakeDb() {
    const filter = (rows: Rec[]) => (args: { where: Rec }) =>
      rows.filter((r) => matches(r, args.where));
    return {
      forumPost: {
        count: jest.fn(async (args: { where: Rec }) => filter(POSTS)(args).length),
        findFirst: jest.fn(async (args: { where: Rec }) => filter(POSTS)(args)[0] ?? null),
      },
      forumThread: { count: jest.fn(async (args: { where: Rec }) => filter(THREADS)(args).length) },
      realm: {
        findMany: jest.fn(async () => [
          { id: "r_live", status: "active" },
          { id: "r_draft", status: "draft" },
        ]),
      },
    };
  }
  describe("forumActivityOf", () => {
    it("counts only own, visible, public content: no staff category, draft realm, hidden or persona rows", async () => {
      await expect(forumActivityOf(fakeDb() as never, "u1")).resolves.toEqual({
        posts: 2, // p_public, p_live
        threads: 2, // t_public, t_live
      });
    });
  });
  describe("importedAuthorByName", () => {
    it("never confirms a name that only staff-only or draft-realm content carries", async () => {
      await expect(importedAuthorByName(fakeDb() as never, "Secretive")).resolves.toBeNull();
      await expect(importedAuthorByName(fakeDb() as never, "Drafted")).resolves.toBeNull();
    });
  });
});

/** @jest-environment node */
import { REALM_CATEGORIES, SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import {
  authorsOf,
  canSeeCategory,
  canStartThread,
  ForumError,
  getCategoryThreads,
  getThreadPosts,
  listSiteCategories,
  loadCategory,
  POSTS_PER_PAGE,
  resolvePostLocation,
  THREADS_PER_PAGE,
} from "~/server/modules/thinkpages-forum";

const admin = { id: "u_a", clerkUserId: "admin", countryId: null, role: { name: "admin", level: 10 } };
const user = { id: "u_p", clerkUserId: "plain", countryId: "c1", role: { name: "user", level: 100 } };

const categories = SITE_CATEGORIES.map((c, i) => ({ id: `cat_${c.key}`, scope: "site", realmId: null, ...c, order: i }));
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
const founder = { id: "u_f", clerkUserId: "founder", countryId: null, role: { name: "user", level: 100 } };

interface CategoryWhere {
  scope: string;
  realmId: string | null;
  key: string;
}

function readDb(opts: { thread?: object | null; post?: object | null } = {}) {
  return {
    forumCategory: {
      findMany: jest.fn(async () => categories),
      findFirst: jest.fn(
        async ({ where }: { where: CategoryWhere }) =>
          allCategories.find((c) => c.scope === where.scope && c.realmId === where.realmId && c.key === where.key) ?? null
      ),
    },
    realm: {
      findUnique: jest.fn(
        async ({ where }: { where: { slug?: string; id?: string } }) =>
          realms.find((r) => (where.slug !== undefined ? r.slug === where.slug : r.id === where.id)) ?? null
      ),
    },
    forumThread: {
      groupBy: jest.fn(async () => [
        { categoryId: "cat_general", _count: { _all: 4 }, _max: { lastPostAt: new Date("2026-10-01") } },
      ]),
      findMany: jest.fn(async () => [{ id: "t1", title: "Hello" }]),
      count: jest.fn(async () => 1),
      findUnique: jest.fn(async () => opts.thread ?? null),
    },
    forumPost: {
      findMany: jest.fn(async () => [{ id: "p1" }]),
      count: jest.fn(async () => 1),
      findUnique: jest.fn(async () => opts.post ?? null),
    },
    user: { findMany: jest.fn(async () => []) },
    thinkpagesAccount: { findMany: jest.fn(async () => []) },
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

  it("needs a signed-in viewer to start a thread", () => {
    expect(canStartThread(null, general)).toBe(false);
    expect(canStartThread(user, general)).toBe(true);
  });

  it("limits staff-role categories to admins and hidden categories to those who can see them", () => {
    const rules = categories.find((c) => c.key === "rules")!;
    expect(canStartThread(user, rules)).toBe(false);
    expect(canStartThread(admin, rules)).toBe(true);
    expect(canStartThread(user, staff)).toBe(false);
    expect(canStartThread(admin, staff)).toBe(true);
  });
});

describe("listSiteCategories", () => {
  it("lists all 7 for an admin, in order, with thread counts and last activity", async () => {
    const db = readDb();
    const list = await listSiteCategories(db as never, admin);
    expect(list.map((c) => c.key)).toEqual(categories.map((c) => c.key));
    expect(list).toHaveLength(7);
    expect(list.find((c) => c.key === "general")).toMatchObject({ threadCount: 4, lastPostAt: new Date("2026-10-01") });
    expect(list.find((c) => c.key === "rules")).toMatchObject({ threadCount: 0, lastPostAt: null });
    expect(db.forumCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scope: "site", realmId: null }, orderBy: { order: "asc" } })
    );
  });

  it("omits staff for a plain user, and staff and reports for anonymous (M8)", async () => {
    const member = (await listSiteCategories(readDb() as never, user)).map((c) => c.key);
    expect(member).not.toContain("staff");
    expect(member).toContain("reports");
    expect(member).toHaveLength(6);
    const anonymous = (await listSiteCategories(readDb() as never, null)).map((c) => c.key);
    expect(anonymous).not.toContain("staff");
    expect(anonymous).not.toContain("reports");
    expect(anonymous).toHaveLength(5);
  });

  it("counts only visible threads for non-admins, in one grouped query", async () => {
    const db = readDb();
    await listSiteCategories(db as never, user);
    expect(db.forumThread.groupBy).toHaveBeenCalledTimes(1);
    expect(db.forumThread.groupBy.mock.calls[0]![0]).toMatchObject({ where: { hidden: false } });
    const adminDb = readDb();
    await listSiteCategories(adminDb as never, admin);
    expect(adminDb.forumThread.groupBy.mock.calls[0]![0].where).not.toHaveProperty("hidden");
  });
});

describe("getCategoryThreads", () => {
  it("returns pinned-first threads with a total and omits hidden threads for non-admins", async () => {
    const db = readDb();
    const out = await getCategoryThreads(db as never, user, { key: "general" }, 1);
    expect(out.category).toMatchObject({ key: "general", name: "General" });
    expect(out.total).toBe(1);
    expect(out.threads).toEqual([{ id: "t1", title: "Hello" }]);
    expect(db.forumThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { categoryId: "cat_general", hidden: false },
        orderBy: [{ pinned: "desc" }, { lastPostAt: "desc" }],
        skip: 0,
        take: THREADS_PER_PAGE,
      })
    );
  });

  it("includes hidden threads for an admin", async () => {
    const db = readDb();
    await getCategoryThreads(db as never, admin, { key: "general" }, 1);
    expect(db.forumThread.findMany.mock.calls[0]![0].where).toEqual({ categoryId: "cat_general" });
  });

  it("asks for skip 25 on page 2", async () => {
    const db = readDb();
    await getCategoryThreads(db as never, user, { key: "general" }, 2);
    expect(db.forumThread.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 25, take: 25 }));
  });

  it("treats a page below 1 as page 1", async () => {
    const db = readDb();
    await getCategoryThreads(db as never, user, { key: "general" }, 0);
    expect(db.forumThread.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
  });

  it("gives NOT_FOUND for an unknown category and for one the viewer cannot see", async () => {
    await expect(getCategoryThreads(readDb() as never, user, { key: "nope" }, 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getCategoryThreads(readDb() as never, user, { key: "staff" }, 1)).rejects.toBeInstanceOf(ForumError);
    await expect(getCategoryThreads(readDb() as never, null, { key: "reports" }, 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const db = readDb();
    await expect(getCategoryThreads(db as never, user, { key: "staff" }, 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.forumThread.findMany).not.toHaveBeenCalled();
  });
});

describe("getCategoryThreads in a realm", () => {
  it("looks the category up by realm, scope and key, never by key alone", async () => {
    const db = readDb();
    const out = await getCategoryThreads(db as never, user, { key: "hub", realm: "eurth" }, 1);
    expect(db.forumCategory.findFirst).toHaveBeenCalledTimes(1);
    expect(db.forumCategory.findFirst).toHaveBeenCalledWith({ where: { scope: "realm", realmId: "r_eurth", key: "hub" } });
    expect(db.forumThread.findMany.mock.calls[0]![0].where).toEqual({ categoryId: "cat_eurth_hub", hidden: false });
    expect(out.category).toMatchObject({
      key: "hub",
      scope: "realm",
      realmId: "r_eurth",
      realm: { slug: "eurth", name: "Eurth" },
    });
  });

  it("reads the same key in another realm as a different category", async () => {
    const db = readDb();
    await getCategoryThreads(db as never, user, { key: "hub", realm: "b" }, 1);
    expect(db.forumCategory.findFirst).toHaveBeenCalledWith({ where: { scope: "realm", realmId: "r_b", key: "hub" } });
    expect(db.forumThread.findMany.mock.calls[0]![0].where).toEqual({ categoryId: "cat_b_hub", hidden: false });
  });

  it("gives site scope a null realm and never reads a realm row for it", async () => {
    const db = readDb();
    const out = await getCategoryThreads(db as never, user, { key: "general", realm: null }, 1);
    expect(out.category).toMatchObject({ scope: "site", realmId: null, realm: null });
    expect(db.forumCategory.findFirst).toHaveBeenCalledWith({ where: { scope: "site", realmId: null, key: "general" } });
    expect(db.realm.findUnique).not.toHaveBeenCalled();
  });

  it("gives NOT_FOUND for a draft realm's category to a plain user and anonymous, and finds it for its founder", async () => {
    for (const viewer of [user, null]) {
      const db = readDb();
      await expect(getCategoryThreads(db as never, viewer, { key: "hub", realm: "draft-land" }, 1)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(db.forumCategory.findFirst).not.toHaveBeenCalled();
    }
    await expect(
      getCategoryThreads(readDb() as never, founder, { key: "hub", realm: "draft-land" }, 1)
    ).resolves.toMatchObject({ category: { key: "hub", realm: { slug: "draft-land", name: "Draft Land" } } });
    await expect(
      getCategoryThreads(readDb() as never, admin, { key: "hub", realm: "draft-land" }, 1)
    ).resolves.toBeDefined();
  });

  it("gives NOT_FOUND for an unknown realm and an unknown key in a known realm", async () => {
    await expect(getCategoryThreads(readDb() as never, user, { key: "hub", realm: "nowhere" }, 1)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(getCategoryThreads(readDb() as never, user, { key: "general", realm: "eurth" }, 1)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("loadCategory", () => {
  it("returns the realm with a realm category and null with a sitewide one", async () => {
    await expect(loadCategory(readDb() as never, user, { key: "hub", realm: "eurth" })).resolves.toMatchObject({
      category: { id: "cat_eurth_hub" },
      realm: { id: "r_eurth", slug: "eurth", name: "Eurth" },
    });
    await expect(loadCategory(readDb() as never, user, { key: "general" })).resolves.toMatchObject({
      category: { id: "cat_general" },
      realm: null,
    });
  });
});

describe("getThreadPosts", () => {
  it("gives a realm thread its realm, and NOT_FOUND to a plain user when the realm is a draft", async () => {
    const out = await getThreadPosts(readDb({ thread: threadIn(eurthHub) }) as never, user, "t1", 1);
    expect(out.category).toMatchObject({ scope: "realm", realmId: "r_eurth", realm: { slug: "eurth", name: "Eurth" } });
    for (const viewer of [user, null]) {
      const db = readDb({ thread: threadIn(draftHub) });
      await expect(getThreadPosts(db as never, viewer, "t1", 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(db.forumPost.findMany).not.toHaveBeenCalled();
    }
    await expect(getThreadPosts(readDb({ thread: threadIn(draftHub) }) as never, founder, "t1", 1)).resolves.toBeDefined();
  });

  it("gives NOT_FOUND when a realm category's realm is gone", async () => {
    const orphan = { ...eurthHub, realmId: "r_gone" };
    await expect(getThreadPosts(readDb({ thread: threadIn(orphan) }) as never, admin, "t1", 1)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns posts in createdAt order with the category summary and total", async () => {
    const db = readDb({ thread: threadIn(general) });
    const out = await getThreadPosts(db as never, user, "t1", 1);
    expect(out.category).toEqual({
      key: "general",
      name: "General",
      icAllowed: false,
      visibility: general.visibility,
      postRole: general.postRole,
      scope: "site",
      realmId: null,
      realm: null,
    });
    expect(out.thread).toMatchObject({ id: "t1", title: "Hello" });
    expect(out.posts).toEqual([{ id: "p1" }]);
    expect(out.total).toBe(1);
    expect(db.forumPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { threadId: "t1", hidden: false },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: 0,
        take: POSTS_PER_PAGE,
      })
    );
  });

  it("asks for skip 20 on page 2", async () => {
    const db = readDb({ thread: threadIn(general) });
    await getThreadPosts(db as never, user, "t1", 2);
    expect(db.forumPost.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }));
  });

  it("gives NOT_FOUND for a hidden thread to a plain user and shows it to an admin", async () => {
    const hidden = threadIn(general, { hidden: true });
    await expect(getThreadPosts(readDb({ thread: hidden }) as never, user, "t1", 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getThreadPosts(readDb({ thread: hidden }) as never, null, "t1", 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const db = readDb({ thread: hidden });
    await getThreadPosts(db as never, admin, "t1", 1);
    expect(db.forumPost.findMany.mock.calls[0]![0].where).toEqual({ threadId: "t1" });
  });

  it("gives NOT_FOUND for a thread in the staff category to a plain user", async () => {
    const db = readDb({ thread: threadIn(staff) });
    await expect(getThreadPosts(db as never, user, "t1", 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.forumPost.findMany).not.toHaveBeenCalled();
    await expect(getThreadPosts(readDb({ thread: threadIn(staff) }) as never, admin, "t1", 1)).resolves.toBeDefined();
  });

  it("gives NOT_FOUND for an unknown thread", async () => {
    await expect(getThreadPosts(readDb() as never, user, "missing", 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("resolvePostLocation", () => {
  const createdAt = new Date("2026-10-02");
  const post = (extra: object = {}) => ({ id: "p9", threadId: "t1", createdAt, hidden: false, thread: threadIn(general), ...extra });

  it("computes the page from the count of earlier visible posts", async () => {
    const cases: Array<[number, number]> = [[0, 1], [19, 1], [20, 2], [45, 3]];
    for (const [before, page] of cases) {
      const db = readDb({ post: post() });
      db.forumPost.count.mockResolvedValue(before);
      await expect(resolvePostLocation(db as never, user, "p9")).resolves.toEqual({ threadId: "t1", page });
      expect(db.forumPost.count).toHaveBeenCalledWith({
        where: { threadId: "t1", hidden: false, OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: "p9" } }] },
      });
    }
  });

  it("counts hidden posts too for an admin", async () => {
    const db = readDb({ post: post() });
    await resolvePostLocation(db as never, admin, "p9");
    expect(db.forumPost.count.mock.calls[0]![0].where).not.toHaveProperty("hidden");
  });

  it("returns null for a post in a draft realm's thread unless the viewer is its founder", async () => {
    const inDraft = () => readDb({ post: post({ thread: threadIn(draftHub) }) });
    const db = inDraft();
    await expect(resolvePostLocation(db as never, user, "p9")).resolves.toBeNull();
    expect(db.forumPost.findUnique.mock.calls[0]![0].select.thread.select.category.select).toEqual({
      visibility: true,
      scope: true,
      realmId: true,
    });
    expect(db.forumPost.count).not.toHaveBeenCalled();
    await expect(resolvePostLocation(inDraft() as never, null, "p9")).resolves.toBeNull();
    await expect(resolvePostLocation(inDraft() as never, founder, "p9")).resolves.toEqual({ threadId: "t1", page: 1 });
    await expect(
      resolvePostLocation(readDb({ post: post({ thread: threadIn(eurthHub) }) }) as never, user, "p9")
    ).resolves.toEqual({ threadId: "t1", page: 1 });
  });

  it("returns null for an unknown post, a hidden post or thread (non-admin), and an invisible category", async () => {
    await expect(resolvePostLocation(readDb() as never, user, "x")).resolves.toBeNull();
    await expect(resolvePostLocation(readDb({ post: post({ hidden: true }) }) as never, user, "p9")).resolves.toBeNull();
    await expect(
      resolvePostLocation(readDb({ post: post({ thread: threadIn(general, { hidden: true }) }) }) as never, user, "p9")
    ).resolves.toBeNull();
    await expect(resolvePostLocation(readDb({ post: post({ thread: threadIn(staff) }) }) as never, user, "p9")).resolves.toBeNull();
    await expect(resolvePostLocation(readDb({ post: post({ hidden: true }) }) as never, admin, "p9")).resolves.toEqual({
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
    db.thinkpagesAccount.findMany.mockResolvedValue([{ id: "a1", displayName: "The Voice", username: "voice" }]);
    const out = await authorsOf(db as never, ["u1", "u2", "u3", "u4", "u1"], ["a1"]);
    expect(out.users.get("u1")).toEqual({ name: "heku", handle: "heku" });
    expect(out.users.get("u2")).toEqual({ name: "WikiName", handle: null });
    expect(out.users.get("u3")).toEqual({ name: "Aurelia", handle: null });
    expect(out.users.get("u4")).toEqual({ name: "Member", handle: null });
    expect(out.personas.get("a1")).toEqual({ displayName: "The Voice", username: "voice" });
    expect(db.user.findMany).toHaveBeenCalledTimes(1);
    expect(db.user.findMany.mock.calls[0]![0].where).toEqual({ id: { in: ["u1", "u2", "u3", "u4"] } });
    expect(db.user.findMany.mock.calls[0]![0].select).not.toHaveProperty("clerkUserId");
    expect(db.user.findMany.mock.calls[0]![0].select).not.toHaveProperty("name");
    expect(db.user.findMany.mock.calls[0]![0].select).not.toHaveProperty("discordUsername");
    expect(db.user.findMany.mock.calls[0]![0].select.country).toEqual({ select: { name: true } });
  });

  it("skips queries for empty id lists and ignores null persona ids", async () => {
    const db = readDb();
    const out = await authorsOf(db as never, [], [null, undefined]);
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.thinkpagesAccount.findMany).not.toHaveBeenCalled();
    expect(out.users.size + out.personas.size).toBe(0);
  });
});

/** @jest-environment node */
import { REALM_CATEGORIES, SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import {
  createThread,
  editPost,
  ForumError,
  replyToThread,
} from "~/server/modules/thinkpages-forum";

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
const byKey = (key: string) => categories.find((c) => c.key === key)!;
const realmCategories = REALM_CATEGORIES.map((c) => ({
  id: `rcat_${c.key}`,
  scope: "realm",
  realmId: "r_eurth",
  visibility: "public",
  postRole: "any",
  ...c,
}));
const realmCategory = (key: string) => realmCategories.find((c) => c.key === key)!;
const allCategories = [...categories, ...realmCategories];

const realmRows = [
  { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" },
  { id: "r_draft", slug: "draft-land", name: "Draft Land", status: "draft", ownerId: "founder" },
];

interface RealmBan {
  countryId: string;
  kind: string;
  until: Date | null;
  reason: string | null;
  createdAt: Date;
}

interface PostUpdate {
  contentHtml: string;
  plainText: string;
  editedAt: Date;
}

interface Opts {
  thread?: object | null;
  post?: object | null;
  persona?: object | null;
  activities?: Array<{ id: string; countryId: string; visibility: string }>;
  chainedLinks?: number;
  /** Nations each user id owns (any realm the fake is asked about). */
  owned?: Record<string, string[]>;
  bans?: RealmBan[];
}

function writeDb(opts: Opts = {}) {
  const tx = {
    forumThread: {
      create: jest.fn(async ({ data }: { data: object }) => ({ id: "t_new", ...data })),
      update: jest.fn(async () => ({ id: "t1" })),
    },
    forumPost: {
      create: jest.fn(async ({ data }: { data: object }) => ({ id: "p_new", ...data })),
    },
    postActionLink: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
  };
  const db = {
    forumCategory: {
      findFirst: jest.fn(
        async ({ where }: { where: { scope: string; realmId: string | null; key: string } }) =>
          allCategories.find(
            (c) => c.scope === where.scope && c.realmId === where.realmId && c.key === where.key
          ) ?? null
      ),
    },
    realm: {
      findUnique: jest.fn(
        async ({ where }: { where: { slug?: string; id?: string } }) =>
          realmRows.find((r) => (where.slug ? r.slug === where.slug : r.id === where.id)) ?? null
      ),
    },
    country: {
      findMany: jest.fn(async ({ where }: { where: { ownerUserId: string } }) =>
        (opts.owned?.[where.ownerUserId] ?? []).map((id) => ({ id }))
      ),
    },
    realmOfficer: {
      findMany: jest.fn(async ({ where }: { where: { userId: string } }) =>
        where.userId === "officer" ? [{ userId: "officer", powers: ["board"] }] : []
      ),
    },
    realmBoardBan: { findMany: jest.fn(async () => opts.bans ?? []) },
    realmClaim: { findMany: jest.fn(async () => []) },
    forumThread: { findUnique: jest.fn(async () => opts.thread ?? null) },
    forumPost: {
      findUnique: jest.fn(async () => opts.post ?? null),
      update: jest.fn(async (_args: { where: { id: string }; data: PostUpdate }) => ({ id: "p1" })),
    },
    thinkpagesAccount: { findFirst: jest.fn(async () => opts.persona ?? null) },
    activityFeed: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] }; countryId: string } }) =>
        (opts.activities ?? [])
          .filter(
            (a) =>
              where.id.in.includes(a.id) &&
              a.countryId === where.countryId &&
              a.visibility === "public"
          )
          .map((a) => ({ id: a.id }))
      ),
    },
    postActionLink: { count: jest.fn(async () => opts.chainedLinks ?? 0) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<object>) => fn(tx)),
  };
  return { db, tx };
}

const threadIn = (key: string, extra: object = {}) => ({
  id: "t1",
  categoryId: `cat_${key}`,
  hidden: false,
  locked: false,
  archived: false,
  category: byKey(key),
  ...extra,
});

const postBy = (authorUserId: string, extra: object = {}) => ({
  id: "p1",
  authorUserId,
  hidden: false,
  thread: { hidden: false, locked: false, archived: false, category: { visibility: "public" } },
  ...extra,
});

const NEW_THREAD = { categoryKey: "general", title: "  Hello there  ", html: "<p>First post</p>" };

describe("createThread", () => {
  it("writes the thread and its first post in one transaction with postCount 1", async () => {
    const { db, tx } = writeDb();
    await expect(createThread(db as never, user, NEW_THREAD)).resolves.toEqual({
      threadId: "t_new",
      postId: "p_new",
    });
    // The first transaction writes the thread and post; the second is the link sync.
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    const linkSyncStarted = db.$transaction.mock.invocationCallOrder[1]!;
    expect(tx.forumThread.create.mock.invocationCallOrder[0]).toBeLessThan(linkSyncStarted);
    expect(tx.forumPost.create.mock.invocationCallOrder[0]).toBeLessThan(linkSyncStarted);
    const threadData = tx.forumThread.create.mock.calls[0]![0].data as { lastPostAt: Date };
    expect(threadData).toMatchObject({
      categoryId: "cat_general",
      title: "Hello there",
      authorUserId: "u_p",
      authorPersonaId: null,
      postCount: 1,
    });
    expect(threadData.lastPostAt).toBeInstanceOf(Date);
    expect(tx.forumPost.create.mock.calls[0]![0].data).toMatchObject({
      threadId: "t_new",
      authorUserId: "u_p",
      authorPersonaId: null,
      contentHtml: "<p>First post</p>",
      plainText: "First post",
    });
  });

  it.each(["ab", "   ab   ", "x".repeat(201)])("refuses the title %p", async (title) => {
    const { db } = writeDb();
    await expect(createThread(db as never, user, { ...NEW_THREAD, title })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a body with no text after sanitizing", async () => {
    const { db } = writeDb();
    await expect(
      createThread(db as never, user, { ...NEW_THREAD, html: "<p>  </p><script>alert(1)</script>" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("accepts a raw body of exactly 50 000 characters and refuses 50 001", async () => {
    const bodyOf = (length: number) => `<p>${"a".repeat(length - "<p></p>".length)}</p>`;
    expect(bodyOf(50_000)).toHaveLength(50_000);
    const { db } = writeDb();
    await expect(
      createThread(db as never, user, { ...NEW_THREAD, html: bodyOf(50_000) })
    ).resolves.toEqual({
      threadId: "t_new",
      postId: "p_new",
    });
    const refused = writeDb();
    await expect(
      createThread(refused.db as never, user, { ...NEW_THREAD, html: bodyOf(50_001) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(refused.db.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["title", '<p>hi <span title="[ixaction=abc] ><img src=x onerror=alert(1)>">x</span></p>'],
    ["alt", '<p>hi <img src="https://e.com/a.png" alt="[ixaction=abc] <b>x</b>"></p>'],
    ["href", '<p><a href="https://e.com/?q=[ixaction=abc] <img src=x onerror=alert(1)>">l</a></p>'],
    ["data-title", '<p><span data-title="[ixaction=abc] <i>">x</span></p>'],
    ["split by a tag", "<p>[ixaction=<b>abc</b>]</p>"],
  ])("refuses an action token inside a %s", async (_, html) => {
    const { db } = writeDb();
    await expect(createThread(db as never, user, { ...NEW_THREAD, html })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Action links must be plain text in the post body",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("strips scripts and event handlers before storing", async () => {
    const { db, tx } = writeDb();
    const html = '<p>Hi<script>alert(1)</script><img src="x.png" onerror="alert(2)"></p>';
    await createThread(db as never, user, { ...NEW_THREAD, html });
    const { contentHtml } = tx.forumPost.create.mock.calls[0]![0].data as { contentHtml: string };
    expect(contentHtml).not.toMatch(/<script/i);
    expect(contentHtml).not.toMatch(/onerror/i);
    expect(contentHtml).toContain("Hi");
  });

  it("refuses a category the actor cannot start threads in", async () => {
    const { db } = writeDb();
    await expect(
      createThread(db as never, user, { ...NEW_THREAD, categoryKey: "announcements" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createThread(db as never, admin, { ...NEW_THREAD, categoryKey: "announcements" })
    ).resolves.toEqual({
      threadId: "t_new",
      postId: "p_new",
    });
  });

  it("reads a hidden or unknown category as not found", async () => {
    const { db } = writeDb();
    await expect(
      createThread(db as never, user, { ...NEW_THREAD, categoryKey: "staff" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      createThread(db as never, user, { ...NEW_THREAD, categoryKey: "nope" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("posts as the actor's own active persona in an in-character category", async () => {
    const { db, tx } = writeDb({ persona: { id: "pa1" } });
    await createThread(db as never, user, {
      ...NEW_THREAD,
      categoryKey: "side-games",
      personaId: "pa1",
    });
    expect(db.thinkpagesAccount.findFirst).toHaveBeenCalledWith({
      where: { id: "pa1", clerkUserId: "plain", isActive: true },
      select: { id: true },
    });
    expect(tx.forumThread.create.mock.calls[0]![0].data).toMatchObject({ authorPersonaId: "pa1" });
    expect(tx.forumPost.create.mock.calls[0]![0].data).toMatchObject({ authorPersonaId: "pa1" });
  });

  it("forbids someone else's or an inactive persona", async () => {
    const { db } = writeDb({ persona: null });
    await expect(
      createThread(db as never, user, {
        ...NEW_THREAD,
        categoryKey: "side-games",
        personaId: "pa9",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("forbids a persona in an out-of-character category", async () => {
    const { db } = writeDb({ persona: { id: "pa1" } });
    await expect(
      createThread(db as never, user, { ...NEW_THREAD, personaId: "pa1" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.thinkpagesAccount.findFirst).not.toHaveBeenCalled();
  });

  it("syncs the new post's action links", async () => {
    const { db, tx } = writeDb({
      activities: [{ id: "a1", countryId: "c1", visibility: "public" }],
    });
    await createThread(db as never, user, { ...NEW_THREAD, html: "<p>We act [ixaction=a1]</p>" });
    expect(tx.postActionLink.createMany).toHaveBeenCalledWith({
      data: [{ postSource: "native", postRef: "p_new", activityId: "a1", countryId: "c1" }],
      skipDuplicates: true,
    });
  });

  it("writes nothing when an action token is not the actor's, and maps the error", async () => {
    const { db, tx } = writeDb({
      activities: [{ id: "a2", countryId: "c2", visibility: "public" }],
    });
    const attempt = createThread(db as never, user, {
      ...NEW_THREAD,
      html: "<p>Theirs [ixaction=a2]</p>",
    });
    await expect(attempt).rejects.toBeInstanceOf(ForumError);
    await expect(attempt).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "A linked action is not one of your nation's public actions",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.forumThread.create).not.toHaveBeenCalled();
    expect(tx.forumPost.create).not.toHaveBeenCalled();
  });

  it("forbids action tokens from an actor with no country", async () => {
    const { db } = writeDb();
    await expect(
      createThread(db as never, admin, { ...NEW_THREAD, html: "<p>[ixaction=a1]</p>" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("replyToThread", () => {
  it("creates the post, bumps postCount and lastPostAt in one transaction, then syncs links", async () => {
    const { db, tx } = writeDb({ thread: threadIn("general") });
    await expect(
      replyToThread(db as never, user, { threadId: "t1", html: "<p>Agreed</p>" })
    ).resolves.toEqual({
      postId: "p_new",
    });
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.forumPost.create.mock.calls[0]![0].data).toMatchObject({
      threadId: "t1",
      authorUserId: "u_p",
      contentHtml: "<p>Agreed</p>",
      plainText: "Agreed",
    });
    expect(tx.forumThread.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { postCount: { increment: 1 }, lastPostAt: expect.any(Date) },
    });
    expect(tx.postActionLink.deleteMany).toHaveBeenCalledWith({
      where: { postSource: "native", postRef: "p_new", activityId: { notIn: [] } },
    });
  });

  it.each([{ locked: true }, { archived: true }])("refuses a %p thread", async (flag) => {
    const { db } = writeDb({ thread: threadIn("general", flag) });
    await expect(
      replyToThread(db as never, user, { threadId: "t1", html: "<p>Hi</p>" })
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("reads a hidden, missing or invisible thread as not found", async () => {
    for (const thread of [threadIn("general", { hidden: true }), null, threadIn("staff")]) {
      const { db } = writeDb({ thread });
      await expect(
        replyToThread(db as never, user, { threadId: "t1", html: "<p>Hi</p>" })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
  });

  it("refuses a non-admin reply in a staff-only category", async () => {
    const { db } = writeDb({ thread: threadIn("announcements") });
    await expect(
      replyToThread(db as never, user, { threadId: "t1", html: "<p>Hi</p>" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("lets a site admin reply in a staff-only category", async () => {
    const { db, tx } = writeDb({ thread: threadIn("announcements") });
    await expect(
      replyToThread(db as never, admin, { threadId: "t1", html: "<p>Noted</p>" })
    ).resolves.toEqual({
      postId: "p_new",
    });
    expect(tx.forumPost.create.mock.calls[0]![0].data).toMatchObject({ authorUserId: "u_a" });
  });

  it("replies as the actor's own persona in an in-character thread", async () => {
    const { db, tx } = writeDb({ thread: threadIn("side-games"), persona: { id: "pa1" } });
    await expect(
      replyToThread(db as never, user, {
        threadId: "t1",
        html: "<p>In character</p>",
        personaId: "pa1",
      })
    ).resolves.toEqual({ postId: "p_new" });
    expect(db.thinkpagesAccount.findFirst).toHaveBeenCalledWith({
      where: { id: "pa1", clerkUserId: "plain", isActive: true },
      select: { id: true },
    });
    expect(tx.forumPost.create.mock.calls[0]![0].data).toMatchObject({
      authorUserId: "u_p",
      authorPersonaId: "pa1",
    });
  });

  it("forbids a persona in an out-of-character thread", async () => {
    const { db } = writeDb({ thread: threadIn("general"), persona: { id: "pa1" } });
    await expect(
      replyToThread(db as never, user, { threadId: "t1", html: "<p>Hi</p>", personaId: "pa1" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("writes no reply when an action token is invalid", async () => {
    const { db, tx } = writeDb({ thread: threadIn("general") });
    await expect(
      replyToThread(db as never, user, { threadId: "t1", html: "<p>[ixaction=zz]</p>" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(tx.forumPost.create).not.toHaveBeenCalled();
    expect(tx.forumThread.update).not.toHaveBeenCalled();
  });
});

describe("attribute tokens on reply and edit", () => {
  const html = '<p>hi <span title="[ixaction=abc] ><img src=x onerror=alert(1)>">x</span></p>';

  it("refuses them on a reply and an edit before anything is written", async () => {
    const reply = writeDb({ thread: threadIn("general") });
    await expect(
      replyToThread(reply.db as never, user, { threadId: "t1", html })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(reply.db.$transaction).not.toHaveBeenCalled();
    const edit = writeDb({ post: postBy("u_p") });
    await expect(editPost(edit.db as never, user, { postId: "p1", html })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(edit.db.forumPost.update).not.toHaveBeenCalled();
  });
});

describe("editPost", () => {
  it("re-sanitizes, sets editedAt and re-syncs links", async () => {
    const { db, tx } = writeDb({
      post: postBy("u_p"),
      activities: [{ id: "a1", countryId: "c1", visibility: "public" }],
    });
    await editPost(db as never, user, {
      postId: "p1",
      html: '<p onclick="x()">Now [ixaction=a1]</p><script>1</script>',
    });
    const update = db.forumPost.update.mock.calls[0]![0];
    expect(update.where).toEqual({ id: "p1" });
    expect(update.data.contentHtml).toBe("<p>Now [ixaction=a1]</p>");
    expect(update.data.plainText).toBe("Now [ixaction=a1]");
    expect(update.data.editedAt).toBeInstanceOf(Date);
    expect(tx.postActionLink.createMany).toHaveBeenCalledWith({
      data: [{ postSource: "native", postRef: "p1", activityId: "a1", countryId: "c1" }],
      skipDuplicates: true,
    });
  });

  it("forbids anyone but the author", async () => {
    const { db } = writeDb({ post: postBy("u_other") });
    await expect(
      editPost(db as never, user, { postId: "p1", html: "<p>Mine now</p>" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.forumPost.update).not.toHaveBeenCalled();
  });

  it("reads a missing, hidden or invisible post as not found", async () => {
    const hiddenThread = { hidden: true, category: { visibility: "public" } };
    const staffThread = { hidden: false, category: { visibility: "staff" } };
    for (const post of [
      null,
      postBy("u_p", { hidden: true }),
      postBy("u_p", { thread: hiddenThread }),
      postBy("u_p", { thread: staffThread }),
    ]) {
      const { db } = writeDb({ post });
      await expect(
        editPost(db as never, user, { postId: "p1", html: "<p>Hi</p>" })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
  });

  it.each([{ locked: true }, { archived: true }])(
    "refuses an edit in a %p thread",
    async (flag) => {
      const thread = {
        hidden: false,
        locked: false,
        archived: false,
        category: { visibility: "public" },
        ...flag,
      };
      const { db } = writeDb({ post: postBy("u_p", { thread }) });
      await expect(
        editPost(db as never, user, { postId: "p1", html: "<p>Changed</p>" })
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: "This thread is closed to edits.",
      });
      expect(db.forumPost.update).not.toHaveBeenCalled();
    }
  );

  it("refuses to edit a post in a submitted or approved story chain", async () => {
    const { db } = writeDb({ post: postBy("u_p"), chainedLinks: 1 });
    await expect(
      editPost(db as never, user, { postId: "p1", html: "<p>Changed</p>" })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This post is part of a submitted story chain",
    });
    expect(db.postActionLink.count).toHaveBeenCalledWith({
      where: {
        postSource: "native",
        postRef: "p1",
        storyline: { status: { in: ["submitted", "approved"] } },
      },
    });
    expect(db.forumPost.update).not.toHaveBeenCalled();
  });

  it("writes no edit when an action token is invalid", async () => {
    const { db } = writeDb({ post: postBy("u_p") });
    await expect(
      editPost(db as never, user, { postId: "p1", html: "<p>[ixaction=zz]</p>" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.forumPost.update).not.toHaveBeenCalled();
  });

  it("refuses an empty edit", async () => {
    const { db } = writeDb({ post: postBy("u_p") });
    await expect(
      editPost(db as never, user, { postId: "p1", html: "<p></p>" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("realm sections", () => {
  const owner = {
    id: "u_owner",
    clerkUserId: "owner",
    countryId: "c_eurth",
    role: { name: "user", level: 100 },
  };
  const officer = {
    id: "u_officer",
    clerkUserId: "officer",
    countryId: null,
    role: { name: "user", level: 100 },
  };
  const OWNS = { u_owner: ["c_eurth"] };
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
  const mute = {
    countryId: "c_eurth",
    kind: "mute",
    until: day("2026-10-20"),
    reason: "Cool off",
    createdAt: day("2026-10-01"),
  };
  const ban = { ...mute, kind: "ban", until: null, reason: null };
  const BANNED = "Your nation is banned from this board until a moderator lifts it";
  const IN_HUB = { ...NEW_THREAD, categoryKey: "hub", realm: "eurth" };

  const realmThread = (key: string, extra: object = {}) => ({
    ...threadIn("general"),
    categoryId: `rcat_${key}`,
    category: realmCategory(key),
    ...extra,
  });
  const realmPost = (authorUserId: string, realmId = "r_eurth") =>
    postBy(authorUserId, {
      thread: {
        hidden: false,
        locked: false,
        archived: false,
        category: { visibility: "public", postRole: "any", scope: "realm", realmId },
      },
    });

  describe("createThread", () => {
    it("writes into the realm's category for the owner of a nation there", async () => {
      const { db, tx } = writeDb({ owned: OWNS });
      await expect(createThread(db as never, owner, IN_HUB)).resolves.toEqual({
        threadId: "t_new",
        postId: "p_new",
      });
      expect(db.forumCategory.findFirst).toHaveBeenCalledWith({
        where: { scope: "realm", realmId: "r_eurth", key: "hub" },
      });
      expect(tx.forumThread.create.mock.calls[0]![0].data).toMatchObject({
        categoryId: "rcat_hub",
      });
    });

    it("refuses a user with no nation in the realm, with the realm's notice", async () => {
      const { db } = writeDb({ owned: OWNS });
      await expect(createThread(db as never, user, IN_HUB)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Only owners of a nation in Eurth can post here.",
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("refuses a muted owner with the mute message", async () => {
      const { db } = writeDb({ owned: OWNS, bans: [mute] });
      await expect(createThread(db as never, owner, IN_HUB)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Your nation is muted on this board until 2026-10-20: Cool off",
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("lets an officer with the board power and a site admin start threads without a nation", async () => {
      for (const actor of [officer, admin]) {
        const { db } = writeDb({ owned: OWNS });
        await expect(createThread(db as never, actor, IN_HUB)).resolves.toEqual({
          threadId: "t_new",
          postId: "p_new",
        });
      }
    });

    it("reads a draft realm's category as not found for a plain user", async () => {
      const { db } = writeDb({ owned: { u_p: ["c_d"] } });
      await expect(
        createThread(db as never, user, { ...IN_HUB, realm: "draft-land" })
      ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Category not found." });
      expect(db.forumCategory.findFirst).not.toHaveBeenCalled();
    });

    it("accepts the actor's persona in Character Threads (P9) and refuses it in the Hub", async () => {
      const ic = writeDb({ owned: OWNS, persona: { id: "pa1" } });
      await createThread(ic.db as never, owner, {
        ...IN_HUB,
        categoryKey: "character-threads",
        personaId: "pa1",
      });
      expect(ic.tx.forumThread.create.mock.calls[0]![0].data).toMatchObject({
        categoryId: "rcat_character-threads",
        authorPersonaId: "pa1",
      });
      const hub = writeDb({ owned: OWNS, persona: { id: "pa1" } });
      await expect(
        createThread(hub.db as never, owner, { ...IN_HUB, personaId: "pa1" })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "This category does not allow in-character posts.",
      });
    });

    it("never reads a realm for a sitewide category", async () => {
      const { db } = writeDb();
      await createThread(db as never, user, NEW_THREAD);
      expect(db.realm.findUnique).not.toHaveBeenCalled();
      expect(db.country.findMany).not.toHaveBeenCalled();
    });
  });

  describe("replyToThread", () => {
    const reply = { threadId: "t1", html: "<p>Hi</p>" };

    it("refuses a banned owner", async () => {
      const { db } = writeDb({ thread: realmThread("hub"), owned: OWNS, bans: [ban] });
      await expect(replyToThread(db as never, owner, reply)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: BANNED,
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("lets a moderator reply, whatever the bans", async () => {
      const { db } = writeDb({ thread: realmThread("hub"), bans: [ban] });
      await expect(replyToThread(db as never, officer, reply)).resolves.toEqual({
        postId: "p_new",
      });
      expect(db.realmBoardBan.findMany).not.toHaveBeenCalled();
    });

    it("reads a thread in a draft realm as not found", async () => {
      const thread = realmThread("hub", {
        category: { ...realmCategory("hub"), realmId: "r_draft" },
      });
      const { db } = writeDb({ thread, owned: { u_owner: ["c_d"] } });
      await expect(replyToThread(db as never, owner, reply)).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Thread not found.",
      });
    });
  });

  describe("editPost", () => {
    const edit = { postId: "p1", html: "<p>Changed</p>" };

    it("refuses a banned owner editing their own post", async () => {
      const { db } = writeDb({ post: realmPost("u_owner"), owned: OWNS, bans: [ban] });
      await expect(editPost(db as never, owner, edit)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: BANNED,
      });
      expect(db.forumPost.update).not.toHaveBeenCalled();
    });

    it("lets a moderator edit their own post", async () => {
      const { db } = writeDb({ post: realmPost("u_officer"), bans: [ban] });
      await editPost(db as never, officer, edit);
      expect(db.forumPost.update).toHaveBeenCalled();
    });

    it("reads a post in a draft realm as not found", async () => {
      const { db } = writeDb({ post: realmPost("u_owner", "r_draft"), owned: OWNS });
      await expect(editPost(db as never, owner, edit)).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Post not found.",
      });
    });
  });
});

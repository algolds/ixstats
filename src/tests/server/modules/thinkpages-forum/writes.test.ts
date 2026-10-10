/** @jest-environment node */
jest.mock("~/server/modules/thinkpages-forum/render", () => ({
  renderPostWikitext: jest.fn(),
}));
import { REALM_CATEGORIES, SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import {
  createThread,
  editPost,
  ForumError,
  replyToThread,
} from "~/server/modules/thinkpages-forum";
import { renderPostWikitext } from "~/server/modules/thinkpages-forum/render";
import { banNotice, DAY_MS } from "~/lib/thinkpages-forum/moderation-policy";
import { banRow, forumBanFake, type BanRow } from "~/tests/helpers/forum-ban-fake";

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

interface PostUpdate {
  contentHtml: string;
  plainText: string;
  contentWikitext: string | null;
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
  bans?: BanRow[];
  /** The post's editedAt no longer matches the one the author loaded. */
  editedMeanwhile?: boolean;
}

function writeDb(opts: Opts = {}) {
  const updateMany = jest.fn(
    async (_args: { where: { id: string; editedAt: Date | null }; data: PostUpdate }) => ({
      count: opts.editedMeanwhile ? 0 : 1,
    })
  );
  const tx = {
    forumThread: {
      create: jest.fn(async ({ data }: { data: object }) => ({ id: "t_new", ...data })),
      update: jest.fn(async () => ({ id: "t1" })),
    },
    forumPost: {
      create: jest.fn(async ({ data }: { data: object }) => ({ id: "p_new", ...data })),
      updateMany,
    },
    forumPostTemplate: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      createMany: jest.fn(async () => ({ count: 0 })),
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
    forumBan: forumBanFake(opts.bans),
    forumThread: { findUnique: jest.fn(async () => opts.thread ?? null) },
    forumPost: {
      findUnique: jest.fn(async () => opts.post ?? null),
      updateMany,
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
  threadId: "t1",
  authorUserId,
  contentWikitext: null,
  hidden: false,
  thread: {
    authorUserId: "u_p",
    hidden: false,
    locked: false,
    archived: false,
    category: {
      id: "cat_general",
      scope: "site",
      realmId: null,
      visibility: "public",
      postRole: "any",
    },
  },
  ...extra,
});

const NEW_THREAD = { categoryKey: "general", title: "  Hello there  ", html: "<p>First post</p>" };

describe("createThread", () => {
  it("writes the thread and its first post in one transaction with postCount 1", async () => {
    const { db, tx } = writeDb();
    await expect(createThread(db as never, user, NEW_THREAD)).resolves.toEqual({
      threadId: "t_new",
      postId: "p_new",
      formatting: "done",
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
      formatting: "done",
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
      formatting: "done",
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
      formatting: "done",
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
      formatting: "done",
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
    ).resolves.toEqual({ postId: "p_new", formatting: "done" });
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
    await expect(
      editPost(edit.db as never, user, { postId: "p1", editedAt: null, html })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(edit.db.forumPost.updateMany).not.toHaveBeenCalled();
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
      editedAt: null,
      html: '<p onclick="x()">Now [ixaction=a1]</p><script>1</script>',
    });
    const update = db.forumPost.updateMany.mock.calls[0]![0];
    expect(update.where).toEqual({ id: "p1", editedAt: null });
    expect(update.data.contentHtml).toBe("<p>Now [ixaction=a1]</p>");
    expect(update.data.plainText).toBe("Now [ixaction=a1]");
    expect(update.data.editedAt).toBeInstanceOf(Date);
    expect(tx.postActionLink.createMany).toHaveBeenCalledWith({
      data: [{ postSource: "native", postRef: "p1", activityId: "a1", countryId: "c1" }],
      skipDuplicates: true,
    });
  });

  it("writes only if the post is unchanged since the author loaded it (M1)", async () => {
    const { db } = writeDb({ post: postBy("u_p") });
    const loaded = new Date("2026-10-01T10:00:00Z");
    await editPost(db as never, user, { postId: "p1", editedAt: loaded, html: "<p>Again</p>" });
    expect(db.forumPost.updateMany.mock.calls[0]![0].where).toEqual({ id: "p1", editedAt: loaded });
  });

  it("refuses with CONFLICT when a moderator edited the post meanwhile, and syncs no links (M1)", async () => {
    const { db, tx } = writeDb({
      post: postBy("u_p"),
      editedMeanwhile: true,
      activities: [{ id: "a1", countryId: "c1", visibility: "public" }],
    });
    await expect(
      editPost(db as never, user, { postId: "p1", editedAt: null, html: "<p>[ixaction=a1]</p>" })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "This post changed since you opened it (a moderator's edit or another tab). Reload to see the latest version.",
    });
    expect(tx.postActionLink.createMany).not.toHaveBeenCalled();
    expect(tx.postActionLink.deleteMany).not.toHaveBeenCalled();
  });

  it("forbids anyone but the author", async () => {
    const { db } = writeDb({ post: postBy("u_other") });
    await expect(
      editPost(db as never, user, { postId: "p1", editedAt: null, html: "<p>Mine now</p>" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.forumPost.updateMany).not.toHaveBeenCalled();
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
        editPost(db as never, user, { postId: "p1", editedAt: null, html: "<p>Hi</p>" })
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
        editPost(db as never, user, { postId: "p1", editedAt: null, html: "<p>Changed</p>" })
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: "This thread is closed to edits.",
      });
      expect(db.forumPost.updateMany).not.toHaveBeenCalled();
    }
  );

  it("refuses to edit a post in a submitted or approved story chain", async () => {
    const { db } = writeDb({ post: postBy("u_p"), chainedLinks: 1 });
    await expect(
      editPost(db as never, user, { postId: "p1", editedAt: null, html: "<p>Changed</p>" })
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
    expect(db.forumPost.updateMany).not.toHaveBeenCalled();
  });

  it("writes no edit when an action token is invalid", async () => {
    const { db } = writeDb({ post: postBy("u_p") });
    await expect(
      editPost(db as never, user, { postId: "p1", editedAt: null, html: "<p>[ixaction=zz]</p>" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.forumPost.updateMany).not.toHaveBeenCalled();
  });

  it("refuses an empty edit", async () => {
    const { db } = writeDb({ post: postBy("u_p") });
    await expect(
      editPost(db as never, user, { postId: "p1", editedAt: null, html: "<p></p>" })
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
  const later = new Date(Date.now() + 7 * DAY_MS);
  const ban = banRow({
    userId: "u_owner",
    scope: "realm",
    scopeId: "r_eurth",
    reason: "Spam",
    expiresAt: later,
  });
  const BANNED = banNotice({ scope: "realm", expiresAt: later, reason: "Spam" });
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
        authorUserId: authorUserId,
        hidden: false,
        locked: false,
        archived: false,
        category: {
          id: "rcat_hub",
          visibility: "public",
          postRole: "any",
          scope: "realm",
          realmId,
        },
      },
    });

  describe("createThread", () => {
    it("writes into the realm's category for the owner of a nation there", async () => {
      const { db, tx } = writeDb({ owned: OWNS });
      await expect(createThread(db as never, owner, IN_HUB)).resolves.toEqual({
        threadId: "t_new",
        postId: "p_new",
        formatting: "done",
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

    it("refuses a realm-banned owner in the realm's Hub and lets them post in General", async () => {
      const { db } = writeDb({ owned: OWNS, bans: [ban] });
      await expect(createThread(db as never, owner, IN_HUB)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: BANNED,
      });
      expect(db.$transaction).not.toHaveBeenCalled();
      await expect(createThread(db as never, owner, NEW_THREAD)).resolves.toEqual({
        threadId: "t_new",
        postId: "p_new",
        formatting: "done",
      });
    });

    it("lets an officer with the board power and a site admin start threads without a nation", async () => {
      for (const actor of [officer, admin]) {
        const { db } = writeDb({ owned: OWNS });
        await expect(createThread(db as never, actor, IN_HUB)).resolves.toEqual({
          threadId: "t_new",
          postId: "p_new",
          formatting: "done",
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

    it("lets a moderator reply without a nation, and refuses one under a realm ban (M5)", async () => {
      const free = writeDb({ thread: realmThread("hub"), bans: [ban] });
      await expect(replyToThread(free.db as never, officer, reply)).resolves.toEqual({
        postId: "p_new",
        formatting: "done",
      });
      const banned = writeDb({
        thread: realmThread("hub"),
        bans: [{ ...ban, userId: "u_officer" }],
      });
      await expect(replyToThread(banned.db as never, officer, reply)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: BANNED,
      });
      expect(banned.db.$transaction).not.toHaveBeenCalled();
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
    const edit = { postId: "p1", editedAt: null, html: "<p>Changed</p>" };

    it("refuses a banned owner editing their own post", async () => {
      const { db } = writeDb({ post: realmPost("u_owner"), owned: OWNS, bans: [ban] });
      await expect(editPost(db as never, owner, edit)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: BANNED,
      });
      expect(db.forumPost.updateMany).not.toHaveBeenCalled();
    });

    it("lets a moderator edit their own post when another member is banned", async () => {
      const { db } = writeDb({ post: realmPost("u_officer"), bans: [ban] });
      await editPost(db as never, officer, edit);
      expect(db.forumPost.updateMany).toHaveBeenCalled();
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

describe("forum bans on every write", () => {
  const later = new Date(Date.now() + 7 * DAY_MS);
  const siteBan = banRow({ userId: "u_p", reason: "Abuse", expiresAt: later });
  const SITE_BANNED = banNotice({ scope: "site", expiresAt: later, reason: "Abuse" });
  const reply = { threadId: "t1", html: "<p>Hi</p>" };
  const edit = { postId: "p1", editedAt: null, html: "<p>Changed</p>" };

  it("refuses a site-banned member starting a thread in General, replying and editing sitewide", async () => {
    const start = writeDb({ bans: [siteBan] });
    await expect(createThread(start.db as never, user, NEW_THREAD)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: SITE_BANNED,
    });
    expect(start.db.$transaction).not.toHaveBeenCalled();
    expect(start.db.forumBan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "u_p", liftedAt: null }) })
    );

    const answer = writeDb({ thread: threadIn("general"), bans: [siteBan] });
    await expect(replyToThread(answer.db as never, user, reply)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: SITE_BANNED,
    });
    expect(answer.db.$transaction).not.toHaveBeenCalled();

    const change = writeDb({ post: postBy("u_p"), bans: [siteBan] });
    await expect(editPost(change.db as never, user, edit)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: SITE_BANNED,
    });
    expect(change.db.forumPost.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a category-banned member in that category only", async () => {
    const ban = banRow({
      userId: "u_p",
      scope: "category",
      scopeId: "cat_general",
      expiresAt: later,
    });
    const { db } = writeDb({ bans: [ban] });
    await expect(createThread(db as never, user, NEW_THREAD)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: banNotice(ban as never),
    });
    await expect(
      createThread(db as never, user, { ...NEW_THREAD, categoryKey: "find-a-realm" })
    ).resolves.toEqual({ threadId: "t_new", postId: "p_new", formatting: "done" });
    const change = writeDb({ post: postBy("u_p"), bans: [ban] });
    await expect(editPost(change.db as never, user, edit)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lets a member post and edit when their ban has expired or was lifted", async () => {
    const bans = [
      { ...siteBan, id: "b_expired", expiresAt: new Date(Date.now() - DAY_MS) },
      { ...siteBan, id: "b_lifted", liftedAt: new Date() },
    ];
    await expect(createThread(writeDb({ bans }).db as never, user, NEW_THREAD)).resolves.toEqual({
      threadId: "t_new",
      postId: "p_new",
      formatting: "done",
    });
    await expect(
      replyToThread(writeDb({ thread: threadIn("general"), bans }).db as never, user, reply)
    ).resolves.toEqual({ postId: "p_new", formatting: "done" });
    const change = writeDb({ post: postBy("u_p"), bans });
    await editPost(change.db as never, user, edit);
    expect(change.db.forumPost.updateMany).toHaveBeenCalled();
  });

  it("lets a site admin post whatever ban rows exist (M5)", async () => {
    const bans = [{ ...siteBan, userId: "u_a" }];
    const { db } = writeDb({ bans });
    await expect(createThread(db as never, admin, NEW_THREAD)).resolves.toEqual({
      threadId: "t_new",
      postId: "p_new",
      formatting: "done",
    });
    expect(db.forumBan.findMany).not.toHaveBeenCalled();
    const change = writeDb({ post: postBy("u_a"), bans });
    await editPost(change.db as never, admin, edit);
    expect(change.db.forumPost.updateMany).toHaveBeenCalled();
  });
});

describe("the Reports category (M8)", () => {
  const reports = byKey("reports");
  const reply = { threadId: "t1", html: "<p>More detail</p>" };
  const reportThread = (authorUserId: string) => threadIn("reports", { authorUserId });
  const reportPost = (authorUserId: string, threadAuthor: string) =>
    postBy(authorUserId, {
      thread: {
        authorUserId: threadAuthor,
        hidden: false,
        locked: false,
        archived: false,
        category: reports,
      },
    });

  it("reads another member's report thread as not found to a member, on reply and on edit", async () => {
    const { db } = writeDb({ thread: reportThread("u_other") });
    await expect(replyToThread(db as never, user, reply)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Thread not found.",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    const change = writeDb({ post: reportPost("u_p", "u_other") });
    await expect(
      editPost(change.db as never, user, { postId: "p1", editedAt: null, html: "<p>x</p>" })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Post not found." });
    expect(change.db.forumPost.updateMany).not.toHaveBeenCalled();
  });

  it("lets a member reply in and edit within their own report thread", async () => {
    await expect(
      replyToThread(writeDb({ thread: reportThread("u_p") }).db as never, user, reply)
    ).resolves.toEqual({ postId: "p_new", formatting: "done" });
    const change = writeDb({ post: reportPost("u_p", "u_p") });
    await editPost(change.db as never, user, { postId: "p1", editedAt: null, html: "<p>x</p>" });
    expect(change.db.forumPost.updateMany).toHaveBeenCalled();
  });

  it("lets a site admin reply in any report thread", async () => {
    for (const author of ["u_p", "u_other"]) {
      await expect(
        replyToThread(writeDb({ thread: reportThread(author) }).db as never, admin, reply)
      ).resolves.toEqual({ postId: "p_new", formatting: "done" });
    }
  });
});

describe("Canvas wikitext writes", () => {
  const renderMock = jest.mocked(renderPostWikitext);
  const RENDERED_AT = new Date("2026-10-09T10:00:00Z");
  const rendered = (over: Partial<Awaited<ReturnType<typeof renderPostWikitext>>> = {}) => ({
    contentHtml: '<div class="mw-parser-output"><p>Hi</p></div>',
    plainText: "Hi",
    rendererVersion: "forum-1:v",
    renderedAt: RENDERED_AT,
    templates: ["Template:Flag"],
    ...over,
  });
  const WIKI = { threadId: "t1", wikitext: "'''Hi''' {{Flag}}" };

  beforeEach(() => {
    renderMock.mockReset();
    renderMock.mockResolvedValue(rendered());
  });

  it("stores the wikitext, the rendered html, renderedAt and the templates on a reply", async () => {
    const { db, tx } = writeDb({ thread: threadIn("general") });
    await expect(replyToThread(db as never, user, WIKI)).resolves.toEqual({
      postId: "p_new",
      formatting: "done",
    });
    expect(renderMock).toHaveBeenCalledWith("'''Hi''' {{Flag}}", "t1", "u_p");
    expect(tx.forumPost.create.mock.calls[0]![0].data).toEqual({
      threadId: "t1",
      authorUserId: "u_p",
      authorPersonaId: null,
      contentHtml: '<div class="mw-parser-output"><p>Hi</p></div>',
      plainText: "Hi",
      contentWikitext: "'''Hi''' {{Flag}}",
      rendererVersion: "forum-1:v",
      renderedAt: RENDERED_AT,
      createdAt: expect.any(Date),
    });
    expect(tx.forumPostTemplate.createMany).toHaveBeenCalledWith({
      data: [{ postId: "p_new", title: "Template:Flag" }],
      skipDuplicates: true,
    });
  });

  it("stores the guarded text, not the raw input, so the stale cron never renders what was stripped", async () => {
    const { db, tx } = writeDb({ thread: threadIn("general") });
    await replyToThread(db as never, user, { threadId: "t1", wikitext: "Hi [[Category:X]]" });
    expect(tx.forumPost.create.mock.calls[0]![0].data).toMatchObject({ contentWikitext: "Hi " });
  });

  it("stores a fallback render with renderedAt null and reports formatting pending", async () => {
    renderMock.mockResolvedValue(rendered({ renderedAt: null, templates: [] }));
    const { db, tx } = writeDb({ thread: threadIn("general") });
    await expect(replyToThread(db as never, user, WIKI)).resolves.toEqual({
      postId: "p_new",
      formatting: "pending",
    });
    expect(tx.forumPost.create.mock.calls[0]![0].data).toMatchObject({
      contentWikitext: "'''Hi''' {{Flag}}",
      renderedAt: null,
    });
    expect(tx.forumPostTemplate.createMany).not.toHaveBeenCalled();
  });

  it("renders a new thread's first post under the id 'new'", async () => {
    const { db, tx } = writeDb();
    await expect(
      createThread(db as never, user, {
        categoryKey: "general",
        title: "Hello there",
        wikitext: "x",
      })
    ).resolves.toEqual({ threadId: "t_new", postId: "p_new", formatting: "done" });
    expect(renderMock).toHaveBeenCalledWith("x", "new", "u_p");
    expect(tx.forumPostTemplate.createMany).toHaveBeenCalled();
  });

  it("refuses a create or reply with neither html nor wikitext, rendering nothing", async () => {
    const create = writeDb();
    await expect(
      createThread(create.db as never, user, { categoryKey: "general", title: "Hello there" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "A post needs some text." });
    const reply = writeDb({ thread: threadIn("general") });
    await expect(replyToThread(reply.db as never, user, { threadId: "t1" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "A post needs some text.",
    });
    expect(create.db.$transaction).not.toHaveBeenCalled();
    expect(reply.db.$transaction).not.toHaveBeenCalled();
    expect(renderMock).not.toHaveBeenCalled();
  });

  it("writes nothing when the render refuses the wikitext", async () => {
    renderMock.mockRejectedValue(new ForumError("BAD_REQUEST", "Signatures are not used."));
    const create = writeDb();
    await expect(
      createThread(create.db as never, user, {
        categoryKey: "general",
        title: "Hello there",
        wikitext: "~~~~",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(create.tx.forumPost.create).not.toHaveBeenCalled();
    expect(create.tx.forumThread.create).not.toHaveBeenCalled();
    const reply = writeDb({ thread: threadIn("general") });
    await expect(
      replyToThread(reply.db as never, user, { threadId: "t1", wikitext: "~~~~" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(reply.tx.forumPost.create).not.toHaveBeenCalled();
  });

  it("refuses rendered text whose action token is not plain text", async () => {
    renderMock.mockResolvedValue(
      rendered({ contentHtml: '<p title="[ixaction=a1]">x</p>', plainText: "x" })
    );
    const { db } = writeDb({ thread: threadIn("general") });
    await expect(replyToThread(db as never, user, WIKI)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Action links must be plain text in the post body",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  describe("renders only after every access check (P-1)", () => {
    const wikitext = "x";

    it("never renders for a thread closed to replies, a hidden thread or a member who cannot post", async () => {
      const locked = writeDb({ thread: threadIn("general", { locked: true }) });
      await expect(
        replyToThread(locked.db as never, user, { threadId: "t1", wikitext })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const hidden = writeDb({ thread: threadIn("general", { hidden: true }) });
      await expect(
        replyToThread(hidden.db as never, user, { threadId: "t1", wikitext })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const staffOnly = writeDb({ thread: threadIn("announcements") });
      await expect(
        replyToThread(staffOnly.db as never, user, { threadId: "t1", wikitext })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const start = writeDb();
      await expect(
        createThread(start.db as never, user, {
          categoryKey: "announcements",
          title: "Hello there",
          wikitext,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(renderMock).not.toHaveBeenCalled();
    });

    it("never renders for a banned member or a persona they do not own", async () => {
      const banned = writeDb({
        thread: threadIn("general"),
        bans: [banRow({ userId: "u_p", scope: "site", expiresAt: null })],
      });
      await expect(
        replyToThread(banned.db as never, user, { threadId: "t1", wikitext })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const persona = writeDb({ thread: threadIn("side-games"), persona: null });
      await expect(
        replyToThread(persona.db as never, user, { threadId: "t1", wikitext, personaId: "pa9" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(renderMock).not.toHaveBeenCalled();
    });

    it("never renders an edit by a non-author, in a closed thread, in a locked chain or with the wrong editor", async () => {
      const edit = { postId: "p1", editedAt: null, wikitext };
      const post = (extra: object = {}) => postBy("u_p", { contentWikitext: "old", ...extra });
      const closed = {
        authorUserId: "u_p",
        hidden: false,
        locked: true,
        archived: false,
        category: { id: "cat_general", scope: "site", realmId: null, visibility: "public" },
      };
      await expect(
        editPost(writeDb({ post: postBy("u_other") }).db as never, user, edit)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        editPost(writeDb({ post: post({ thread: closed }) }).db as never, user, edit)
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        editPost(writeDb({ post: post(), chainedLinks: 1 }).db as never, user, edit)
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        editPost(writeDb({ post: postBy("u_p") }).db as never, user, edit)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(renderMock).not.toHaveBeenCalled();
    });
  });

  describe("editPost", () => {
    const wikiPost = () => postBy("u_p", { contentWikitext: "old" });

    it("refuses wikitext on an HTML post and html on a wikitext post", async () => {
      const html = writeDb({ post: postBy("u_p") });
      await expect(
        editPost(html.db as never, user, { postId: "p1", editedAt: null, wikitext: "x" })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "This post is edited with the standard editor.",
      });
      const wiki = writeDb({ post: wikiPost() });
      await expect(
        editPost(wiki.db as never, user, { postId: "p1", editedAt: null, html: "<p>x</p>" })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Edit this post in the wiki editor.",
      });
      expect(html.db.forumPost.updateMany).not.toHaveBeenCalled();
      expect(wiki.db.forumPost.updateMany).not.toHaveBeenCalled();
    });

    it("re-renders, conditions the write on editedAt and replaces the templates", async () => {
      const { db, tx } = writeDb({ post: wikiPost() });
      await expect(
        editPost(db as never, user, { postId: "p1", editedAt: null, wikitext: "new" })
      ).resolves.toEqual({ formatting: "done" });
      expect(renderMock).toHaveBeenCalledWith("new", "t1", "u_p");
      const update = db.forumPost.updateMany.mock.calls[0]![0];
      expect(update.where).toEqual({ id: "p1", editedAt: null });
      expect(update.data).toMatchObject({
        contentWikitext: "new",
        renderedAt: RENDERED_AT,
        editedAt: expect.any(Date),
      });
      expect(tx.forumPostTemplate.deleteMany).toHaveBeenCalledWith({ where: { postId: "p1" } });
      expect(tx.forumPostTemplate.createMany).toHaveBeenCalledWith({
        data: [{ postId: "p1", title: "Template:Flag" }],
        skipDuplicates: true,
      });
    });

    it("leaves the templates alone when the edit lost the race", async () => {
      const { db, tx } = writeDb({ post: wikiPost(), editedMeanwhile: true });
      await expect(
        editPost(db as never, user, { postId: "p1", editedAt: null, wikitext: "new" })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(tx.forumPostTemplate.deleteMany).not.toHaveBeenCalled();
      expect(tx.forumPostTemplate.createMany).not.toHaveBeenCalled();
    });
  });
});

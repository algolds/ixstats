/** @jest-environment node */
import { SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
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
        async ({ where }: { where: { key: string } }) =>
          categories.find((c) => c.key === where.key) ?? null
      ),
    },
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
  thread: { hidden: false, category: { visibility: "public" } },
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

  it("refuses a raw body over 50 000 characters", async () => {
    const { db } = writeDb();
    const html = `<p>${"a".repeat(50_000)}</p>`;
    await expect(createThread(db as never, user, { ...NEW_THREAD, html })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
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

/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/thinkpages-forum/render", () => ({
  FORUM_RENDERER_VERSION: "forum-1:v",
  renderPostWikitext: jest.fn(),
  renderViaWiki: jest.fn(),
}));
jest.mock("~/server/modules/thinkpages-forum/mention-links", () => ({
  withMentionLinks: jest.fn(async (_db: object, body: object) => body),
}));
import { REALM_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import { SITE_CATEGORIES } from "~/tests/helpers/forum-site-categories";
import {
  createThread,
  editPost,
  ForumError,
  replyToThread,
} from "~/server/modules/thinkpages-forum";
import { withMentionLinks } from "~/server/modules/thinkpages-forum/mention-links";
import { renderPostWikitext } from "~/server/modules/thinkpages-forum/render";
import { banNotice, DAY_MS } from "~/lib/thinkpages-forum/moderation-policy";
import { banRow, forumBanFake, type BanRow } from "~/tests/helpers/forum-ban-fake";
import { validateEditLinks } from "~/server/modules/thinkpages-forum/writes-links";
import type { ForumActor, WritesDb } from "~/server/modules/thinkpages-forum/writes";
import { prepareBody } from "~/server/modules/thinkpages-forum/writes";
import { assertTokensArePlainText } from "~/server/modules/thinkpages-forum/writes-body";
import { renderViaWiki } from "~/server/modules/thinkpages-forum/render";
import {
  nextStaleBatch,
  rerenderPosts,
  resetRenderFailuresForTests,
} from "~/server/modules/thinkpages-forum/render-stale";
import {
  linkOldForumAccount,
  unlinkOldForumAccount,
} from "~/server/modules/thinkpages-forum/old-forum-accounts";

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
    postActionLink: {
      count: jest.fn(async () => opts.chainedLinks ?? 0),
      deleteMany: jest.fn(async (_args?: object) => ({ count: 0 })),
    },
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
  plainText: "",
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
  it.each(["   ab   ", "x".repeat(201)])("refuses the title %p", async (title) => {
    const { db } = writeDb();
    await expect(createThread(db as never, user, { ...NEW_THREAD, title })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each([
    ["title", '<p>hi <span title="[ixaction=abc] ><img src=x onerror=alert(1)>">x</span></p>'],
    ["href", '<p><a href="https://e.com/?q=[ixaction=abc] <img src=x onerror=alert(1)>">l</a></p>'],
    ["split by a tag", "<p>[ixaction=<b>abc</b>]</p>"],
  ])("refuses an action token inside a %s", async (_, html) => {
    const { db } = writeDb();
    await expect(createThread(db as never, user, { ...NEW_THREAD, html })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Action links must be plain text in the post body",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
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
});

describe("replyToThread", () => {
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
  it("stores the guarded text, not the raw input, so the stale cron never renders what was stripped", async () => {
    const { db, tx } = writeDb({ thread: threadIn("general") });
    await replyToThread(db as never, user, { threadId: "t1", wikitext: "Hi [[Category:X]]" });
    expect(tx.forumPost.create.mock.calls[0]![0].data).toMatchObject({ contentWikitext: "Hi " });
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
describe("mention links at save", () => {
  it("links the sanitized body, so the links are the last thing added to it", async () => {
    const { db } = writeDb();
    await createThread(db as never, user, {
      ...NEW_THREAD,
      html: '<p onclick="x()">@kir</p><script>1</script>',
    });
    expect(withMentionLinks).toHaveBeenLastCalledWith(
      db,
      expect.objectContaining({ contentHtml: "<p>@kir</p>" })
    );
  });
});

describe("Find a Realm adverts", () => {
  const look = { thumbnail: null, emblemUrl: null };
  const EURTH = {
    id: "r_eurth",
    slug: "eurth",
    name: "Eurth",
    status: "active",
    ownerId: "founder",
    ...look,
  };
  const adOfficer = {
    id: "u_off",
    clerkUserId: "officer",
    countryId: "c1",
    role: { name: "user", level: 100 },
  };
  const FIND = {
    id: "cat_find-a-realm",
    key: "find-a-realm",
    style: "ooc",
    scope: "site",
    realmId: null,
    visibility: "public",
    postRole: "any",
  };
  const advertPost = (advertRealm: object, authorUserId = "u_founder", thread: object = {}) =>
    postBy(authorUserId, {
      plainText: "Join us",
      thread: {
        authorUserId: "u_founder",
        hidden: false,
        locked: false,
        archived: false,
        category: FIND,
        advertRealm,
        ...thread,
      },
    });
  const edit = { postId: "p1", html: "<p>Updated advert</p>", editedAt: null };

  /** The fake's officer table grants `powers` to the officer actor, and the first post of the thread is `first`. */
  function asOfficer(db: ReturnType<typeof writeDb>["db"], first: string, powers = ["appearance"]) {
    db.realmOfficer.findMany.mockImplementation(async ({ where }: { where: { userId: string } }) =>
      where.userId === "officer" ? [{ userId: "officer", powers }] : []
    );
    Object.assign(db.forumPost, { findFirst: jest.fn(async () => ({ id: first })) });
  }
  const advertEdit = (
    post: object,
    actor: object,
    opts: { first?: string; powers?: string[]; activities?: Opts["activities"] } = {}
  ) => {
    const made = writeDb({ post, activities: opts.activities });
    asOfficer(made.db, opts.first ?? "p1", opts.powers);
    return {
      ...made,
      run: (input: object = edit) => editPost(made.db as never, actor as never, input as never),
    };
  };

  it("refuses a new thread in Find a Realm that is not an advert, for members and admins alike", async () => {
    const { db, tx } = writeDb();
    const input = { ...NEW_THREAD, categoryKey: "find-a-realm" };
    await expect(createThread(db as never, user, input)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/adverts only/i),
    });
    await expect(createThread(db as never, admin, input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(tx.forumThread.create).not.toHaveBeenCalled();
  });
  it("lets an officer with the appearance power edit the advert's first post, though they did not write it", async () => {
    const { run, db } = advertEdit(advertPost(EURTH), adOfficer);
    await expect(run()).resolves.toEqual({ formatting: "done" });
    expect(db.forumPost.updateMany).toHaveBeenCalled();
  });
  describe("a manager editing another member's advert post (action links)", () => {
    const linked = { ...advertPost(EURTH), plainText: "Join us [ixaction=a1] [ixaction=a2]" };
    it("may not add one, even one of their own nation's actions", async () => {
      const added = advertEdit(linked, adOfficer, {
        activities: [{ id: "a3", countryId: "c1", visibility: "public" }],
      });
      await expect(
        added.run({ ...edit, html: "<p>Join [ixaction=a1] [ixaction=a3]</p>" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(added.db.forumPost.updateMany).not.toHaveBeenCalled();
    });
  });
});

describe("an author's edit of a post that already links an action", () => {
  type Activity = { id: string; countryId: string; visibility: string };
  function fakeDb(activities: Activity[]) {
    const tx = {
      postActionLink: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
        createMany: jest.fn(async () => ({ count: 0 })),
      },
    };
    const db = {
      activityFeed: {
        findMany: jest.fn(
          async ({
            where,
          }: {
            where: { id: { in: string[] }; countryId: string; visibility: string };
          }) =>
            activities
              .filter(
                (a) =>
                  where.id.in.includes(a.id) &&
                  a.countryId === where.countryId &&
                  a.visibility === where.visibility
              )
              .map((a) => ({ id: a.id }))
        ),
      },
      $transaction: jest.fn(async <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx)),
    };
    return { db: db as never as WritesDb, tx };
  }
  const AUTHOR = { id: "u1", countryId: "c1" } as never as ForumActor;
  const POST = { id: "p1", authorUserId: "u1", plainText: "first draft [ixaction=dir-1]" };
  const WITHDRAWN: Activity = { id: "dir-1", countryId: "c1", visibility: "private" };
  describe("an author's edit of a post that already links an action", () => {
    it("accepts a token the post already had even when the action has gone private", async () => {
      const { db } = fakeDb([WITHDRAWN]);
      await expect(
        validateEditLinks(db, AUTHOR, POST, "fixed typo [ixaction=dir-1]")
      ).resolves.toBeUndefined();
    });

    it("still refuses a new token that is not one of the nation's public actions", async () => {
      const { db } = fakeDb([WITHDRAWN]);
      await expect(
        validateEditLinks(db, AUTHOR, POST, "fixed typo [ixaction=dir-1] [ixaction=dir-2]")
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });
});

describe("prepareBody: an image counts as content", () => {
  it.each([
    ["an image whose src the sanitizer removed", '<p><img src="javascript:alert(1)"></p>'],
    ["a protocol-relative src", '<p><img src="//e.com/a.png"></p>'],
    ["a data: src", '<p><img src="data:image/png;base64,AAAA"></p>'],
  ])("still refuses %s", (_, html) => {
    expect(() => prepareBody(html)).toThrow("A post needs some text.");
  });
  describe("the media picker's URL forms, through the real sanitizer", () => {
    const saved = process.env.NEXT_PUBLIC_BASE_PATH;
    beforeEach(() => {
      process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    });
    afterEach(() => {
      if (saved === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
      else process.env.NEXT_PUBLIC_BASE_PATH = saved;
    });

    it.each([
      ["an upload", "/images/uploads/1700000000-abc.png"],
      [
        "a Commons file through the MediaWiki proxy",
        "/api/mediawiki/commons/Special:Filepath/Flag%20of%20Caphiria%20%28alt%29.svg",
      ],
      [
        "a wiki file through the proxy under the base path",
        "/projects/ixstates/api/mediawiki/ixwiki/images/a/ab/Map.png",
      ],
    ])("keeps an image-only post with %s", (_, src) => {
      const html = `<p><img src="${src}" alt=""></p>`;
      expect(prepareBody(html)).toEqual({ contentHtml: html, plainText: "" });
    });
  });
});

// Directives are attached by their `dir-<intentId>` token, and Canvas posts go through the MediaWiki render: the token must
// reach the card splitter as plain text whichever renderer ran.
describe("a Canvas post's action tokens", () => {
  it("are refused when the render shows other ids than the text holds, even at the same count", () => {
    // <includeonly> and {{{x|default}}} make the source text and the rendered page differ.
    expect(() => assertTokensArePlainText("<p>[ixaction=theirs]</p>", "[ixaction=mine]")).toThrow(
      /plain text/
    );
    expect(() =>
      assertTokensArePlainText("<p>[ixaction=a] [ixaction=b]</p>", "[ixaction=a] [ixaction=c]")
    ).toThrow(/plain text/);
    expect(() =>
      assertTokensArePlainText("<p>[ixaction=a] [ixaction=b]</p>", "[ixaction=a] [ixaction=b]")
    ).not.toThrow();
  });
});

describe("the stale-render cron's writes", () => {
  const rerender = jest.mocked(renderViaWiki);
  type Row = { id: string; threadId: string; contentWikitext: string };
  /** `editedTo`: the wikitext an author saves between the cron's read and its write. */
  function fakeDb(posts: Row[], editedTo?: string) {
    const updates: Array<{ id: string; renderedAt: Date | null; contentHtml: string }> = [];
    const templateWrites: string[][] = [];
    const parts = {
      forumPost: {
        findMany: jest.fn(async () => posts),
        updateMany: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string; contentWikitext: string };
            data: { renderedAt: Date | null; contentHtml: string };
          }) => {
            const current = editedTo ?? posts.find((p) => p.id === where.id)?.contentWikitext;
            if (current !== where.contentWikitext) return { count: 0 };
            updates.push({
              id: where.id,
              renderedAt: data.renderedAt,
              contentHtml: data.contentHtml,
            });
            return { count: 1 };
          }
        ),
      },
      forumPostTemplate: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
        createMany: jest.fn(async ({ data }: { data: Array<{ title: string }> }) => {
          templateWrites.push(data.map((d) => d.title));
          return { count: data.length };
        }),
      },
    };
    const db = {
      ...parts,
      $transaction: jest.fn(async (fn: (tx: typeof parts) => Promise<boolean>) => fn(parts)),
    };
    return { db, updates, templateWrites };
  }
  // The cron links mentions itself: the real linker here, not the identity stand-in the write tests use.
  const realLinks = jest.requireActual<
    typeof import("~/server/modules/thinkpages-forum/mention-links")
  >("~/server/modules/thinkpages-forum/mention-links");
  beforeEach(() => {
    rerender.mockReset();
    resetRenderFailuresForTests();
    jest.mocked(withMentionLinks).mockImplementation(realLinks.withMentionLinks);
  });
  afterEach(() => {
    jest.mocked(withMentionLinks).mockImplementation(async (_db, body) => body);
  });
  it("writes only the text it rendered: an edit between the read and the write is left untouched", async () => {
    rerender.mockResolvedValue({
      contentHtml: "<p>stale</p>",
      plainText: "stale",
      rendererVersion: "forum-1:v",
      renderedAt: new Date(),
      templates: ["Template:Flag"],
    });
    const { db, updates, templateWrites } = fakeDb(
      [{ id: "p1", threadId: "t1", contentWikitext: "x" }],
      "edited"
    );
    expect(await rerenderPosts(db as never, ["p1"])).toEqual({ rendered: 0, failed: 0 });
    expect(db.forumPost.updateMany.mock.calls[0]![0].where).toEqual({
      id: "p1",
      contentWikitext: "x",
    });
    expect(updates).toHaveLength(0);
    expect(db.forumPostTemplate.deleteMany).not.toHaveBeenCalled();
    expect(templateWrites).toEqual([]);
  });
  const RENDERED = {
    plainText: "Hi @kir",
    rendererVersion: "forum-1:v",
    renderedAt: new Date(),
    templates: [],
  };
  function withNames(db: ReturnType<typeof fakeDb>["db"]) {
    return {
      ...db,
      user: { findMany: jest.fn(async (_args: object) => [{ id: "u_kir", handle: "kir" }]) },
      thinkpagesAccount: { findMany: jest.fn(async (_args: object) => []) },
    };
  }
  it("does not keep a mention link the render carried: only the ones it makes itself", async () => {
    rerender.mockResolvedValue({
      ...RENDERED,
      contentHtml: '<p><a class="forum-mention" href="/id/victim">@victim</a> @kir</p>',
    });
    const { db, updates } = fakeDb([{ id: "p1", threadId: "t1", contentWikitext: "x" }]);
    await rerenderPosts(withNames(db) as never, ["p1"]);
    expect(updates[0]?.contentHtml).toBe(
      '<p>@victim <a class="forum-mention" href="/id/kir">@kir</a></p>'
    );
  });
  describe("a post whose render keeps failing", () => {
    const BROKEN = Array.from({ length: 12 }, (_, i) => `broken${i}`);
    const posts: Row[] = [...BROKEN, "fine"].map((id) => ({
      id,
      threadId: "t1",
      contentWikitext: id,
    }));
    /** The stale query's order: posts that never rendered come first, and LIMIT cuts the list there. */
    const queue = (rows: Row[]) => ({
      $queryRaw: jest.fn(async (_s: TemplateStringsArray, ...values: Array<string | number>) =>
        rows.slice(0, Number(values[values.length - 1])).map(({ id }) => ({ id }))
      ),
    });
    const run = async (rows: Row[]) => {
      const { db, updates } = fakeDb(rows);
      const ids = await nextStaleBatch(queue(rows) as never);
      db.forumPost.findMany.mockImplementation(async () => rows.filter((p) => ids.includes(p.id)));
      const result = await rerenderPosts(db as never, ids);
      return { ids, result, updates };
    };
    const mediaWiki = (broken: boolean) =>
      rerender.mockImplementation(async (source: string) =>
        broken && source.startsWith("broken")
          ? null
          : {
              contentHtml: "<p>ok</p>",
              plainText: "ok",
              rendererVersion: "forum-1:v",
              renderedAt: new Date(),
              templates: [],
            }
      );

    it("goes to the back of the queue, so a renderable post behind it is reached on the next run", async () => {
      mediaWiki(true);
      const first = await run(posts);
      expect(first.ids).toEqual(BROKEN.slice(0, 10));
      expect(first.result).toEqual({ rendered: 0, failed: 10 });
      const second = await run(posts);
      expect(second.ids).toEqual([...BROKEN.slice(10), "fine"]);
      expect(second.updates.map((u) => u.id)).toEqual(["fine"]);
      expect(second.result).toEqual({ rendered: 1, failed: 2 });
    });
  });
});

/**
 * Phase 4b: staff link an old XenForo account in the admin users panel. The link attributes that XenForo user's
 * unattributed imported threads and posts at once (no import rerun); unlinking hands them back to the old name.
 */
describe("attributing imported content to a linked account", () => {
  type Row = {
    id: string;
    authorUserId: string | null;
    xenforoUserId: number | null;
    importedAuthorName: string | null;
  };
  type Where = {
    authorUserId?: string | null;
    xenforoUserId?: number;
    importedAuthorName?: object;
  };
  function store(
    opts: { users?: Array<{ id: string; forumUserId: number | null; createdAt: Date }> } = {}
  ) {
    const users = opts.users ?? [{ id: "u1", forumUserId: null, createdAt: new Date(0) }];
    const threads: Row[] = [
      { id: "t1", authorUserId: null, xenforoUserId: 77, importedAuthorName: "OldTimer" },
      { id: "t2", authorUserId: null, xenforoUserId: 88, importedAuthorName: "Other" },
      { id: "t3", authorUserId: "u1", xenforoUserId: null, importedAuthorName: null },
    ];
    const posts: Row[] = [
      { id: "p1", authorUserId: null, xenforoUserId: 77, importedAuthorName: "OldTimer" },
      { id: "p2", authorUserId: null, xenforoUserId: 77, importedAuthorName: "OldTimer" },
      { id: "p3", authorUserId: "u1", xenforoUserId: null, importedAuthorName: null },
      { id: "p4", authorUserId: null, xenforoUserId: 88, importedAuthorName: "Other" },
    ];
    const matches = (r: Row, w: Where) =>
      (w.xenforoUserId === undefined || r.xenforoUserId === w.xenforoUserId) &&
      (!("authorUserId" in w) || r.authorUserId === w.authorUserId) &&
      (w.importedAuthorName === undefined || r.importedAuthorName !== null);
    const table = (rows: Row[]) => ({
      findFirst: jest.fn(
        async ({ where }: { where: Where }) => rows.find((r) => matches(r, where)) ?? null
      ),
      updateMany: jest.fn(
        async ({ where, data }: { where: Where; data: { authorUserId: string | null } }) => {
          const hit = rows.filter((r) => matches(r, where));
          for (const r of hit) r.authorUserId = data.authorUserId;
          return { count: hit.length };
        }
      ),
    });
    const user = {
      findFirst: jest.fn(
        async ({ where }: { where: { forumUserId: number; id: { not: string } } }) =>
          users.find((u) => u.forumUserId === where.forumUserId && u.id !== where.id.not) ?? null
      ),
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id) ?? null
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: {
            forumUserId: number | null;
            forumUsername: string | null;
            lastForumSync: Date | null;
          };
        }) => {
          const u = users.find((x) => x.id === where.id)!;
          u.forumUserId = data.forumUserId;
          return u;
        }
      ),
    };
    // Report re-attribution (M8) runs as raw SQL after a relink; the fake has no reports table.
    const $executeRaw = jest.fn(async (_sql: TemplateStringsArray, ..._values: string[]) => 0);
    const tables = { user, forumThread: table(threads), forumPost: table(posts), $executeRaw };
    const $transaction = jest.fn(async (run: (tx: typeof tables) => Promise<object>) =>
      run(tables)
    );
    return {
      db: { ...tables, $transaction } as never,
      threads,
      posts,
      user,
    };
  }
  describe("linkOldForumAccount", () => {
    it("re-linking to another id hands the previous id's posts back before attributing the new one's", async () => {
      const s = store();
      await linkOldForumAccount(s.db, { userId: "u1", xenforoUserId: 77 });
      await expect(linkOldForumAccount(s.db, { userId: "u1", xenforoUserId: 88 })).resolves.toEqual(
        {
          username: "Other",
          previousXenforoUserId: 77,
          released: { threads: 1, posts: 2 },
          relinked: { threads: 1, posts: 1 },
        }
      );
      // 77's imported rows are back on the old name; 88's are u1's; native content is untouched.
      expect(s.threads.map((t) => t.authorUserId)).toEqual([null, "u1", "u1"]);
      expect(s.posts.map((p) => p.authorUserId)).toEqual([null, null, "u1", "u1"]);
    });
    it("refuses an unknown id without a typed name, and an id another account holds", async () => {
      await expect(
        linkOldForumAccount(store().db, { userId: "u1", xenforoUserId: 99 })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const taken = store({
        users: [
          { id: "u1", forumUserId: null, createdAt: new Date(0) },
          { id: "u2", forumUserId: 77, createdAt: new Date(0) },
        ],
      });
      await expect(
        linkOldForumAccount(taken.db, { userId: "u1", xenforoUserId: 77 })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(taken.user.update).not.toHaveBeenCalled();
    });
  });
  describe("unlinkOldForumAccount", () => {
    it("hands the imported content back to the old name and leaves native content alone", async () => {
      const s = store();
      await linkOldForumAccount(s.db, { userId: "u1", xenforoUserId: 77 });
      await expect(unlinkOldForumAccount(s.db, "u1")).resolves.toEqual({
        released: { threads: 1, posts: 2 },
      });
      expect(s.threads.map((t) => t.authorUserId)).toEqual([null, null, "u1"]);
      expect(s.posts.map((p) => p.authorUserId)).toEqual([null, null, "u1", null]);
      expect(s.user.update).toHaveBeenLastCalledWith({
        where: { id: "u1" },
        data: { forumUserId: null, forumUsername: null, lastForumSync: null },
      });
    });
  });
});

/** @jest-environment node */
jest.mock("~/server/modules/thinkpages-forum/forum-notices", () => ({
  sendForumNotices: jest.fn(async () => true),
}));
jest.mock("~/server/modules/thinkpages-forum/watch-notify", () => ({
  notifyWatchers: jest.fn(async () => 0),
}));
jest.mock("~/server/shared/user-blocks", () => ({
  recipientsBlockingSender: jest.fn(async (): Promise<string[]> => []),
}));
jest.mock("~/server/shared/privacy-permissions", () => ({
  recipientsRefusing: jest.fn(async (): Promise<string[]> => []),
}));

import { MENTION_MAX_PER_POST } from "~/lib/thinkpages-forum/mentions";
import { sendForumNotices } from "~/server/modules/thinkpages-forum/forum-notices";
import { notifyForumPost } from "~/server/modules/thinkpages-forum/post-notify";
import { notifyWatchers } from "~/server/modules/thinkpages-forum/watch-notify";
import { recipientsRefusing } from "~/server/shared/privacy-permissions";
import { recipientsBlockingSender } from "~/server/shared/user-blocks";

const sent = jest.mocked(sendForumNotices);
const watchers = jest.mocked(notifyWatchers);
const blocking = jest.mocked(recipientsBlockingSender);
const refusing = jest.mocked(recipientsRefusing);

const actor = { id: "u_actor", clerkUserId: "clerk_actor" };
const role = { name: "user", level: 100 };
const person = (id: string, handle: string) => ({
  id,
  handle,
  clerkUserId: `clerk_${handle}`,
  countryId: null,
  role,
});
const PEOPLE = [
  person("u_actor", "actorhandle"),
  person("u_kir", "kir"),
  person("u_bob", "bob"),
  person("u_owner", "owner"),
];
const link = (name: string) => `<a class="forum-mention" href="/id/${name}">@${name}</a>`;
const general = {
  id: "cat_general",
  key: "general",
  style: "ooc",
  scope: "site",
  realmId: null,
  visibility: "public",
};
const staff = { ...general, id: "cat_staff", key: "staff", visibility: "staff" };
const boardCategory = {
  id: "cat_board",
  key: "board",
  style: "board",
  scope: "realm",
  realmId: "r_eurth",
  visibility: "public",
};
const EURTH = { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" };

interface Where {
  handle?: { in: string[] };
  OR?: [{ id: { in: string[] } }, { clerkUserId: { in: string[] } }];
  id?: { in: string[] };
}
interface StoredPost {
  id: string;
  threadId: string;
  hidden: boolean;
  authorUserId: string | null;
  authorPersonaId?: string | null;
}
interface QuoteWhere {
  id: { in: string[] };
  threadId: string;
  hidden: boolean;
  authorUserId: { not: null };
}

interface Setup {
  html?: string;
  category?: object;
  hidden?: boolean;
  threadHidden?: boolean;
  persona?: string | null;
  authorUserId?: string | null;
  sourceRef?: string | null;
  replyToPostId?: string | null;
  quoted?: object[];
  /** Stored posts a quote can point at: the fake honours the lookup's `where` over these. */
  store?: StoredPost[];
  replyTarget?: object | null;
  existing?: string[];
  personaOwners?: Array<{ username: string; clerkUserId: string }>;
}

function build(setup: Setup = {}) {
  const post = {
    id: "p1",
    threadId: "t1",
    authorUserId: setup.authorUserId === undefined ? "u_actor" : setup.authorUserId,
    sourceRef: setup.sourceRef ?? null,
    authorPersonaId: setup.persona ?? null,
    hidden: setup.hidden ?? false,
    contentHtml: setup.html ?? "<p>hello</p>",
    plainText: "hello there",
    replyToPostId: setup.replyToPostId ?? null,
    thread: {
      id: "t1",
      title: "Trade talks",
      hidden: setup.threadHidden ?? false,
      authorUserId: "u_other",
      category: setup.category ?? general,
    },
  };
  const db = {
    forumPost: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "p1" ? post : (setup.replyTarget ?? null)
      ),
      findMany: jest.fn(async ({ where }: { where: QuoteWhere }) =>
        setup.store
          ? setup.store
              .filter(
                (row) =>
                  where.id.in.includes(row.id) &&
                  row.threadId === where.threadId &&
                  row.hidden === where.hidden &&
                  row.authorUserId !== null
              )
              .map((row) => ({ authorUserId: row.authorUserId }))
          : (setup.quoted ?? [])
      ),
    },
    forumPostMention: {
      findMany: jest.fn(async () => (setup.existing ?? []).map((userId) => ({ userId }))),
      createMany: jest.fn(async (_args: object) => ({ count: 1 })),
    },
    user: {
      findMany: jest.fn(async ({ where }: { where: Where }) => {
        if (where.handle) return PEOPLE.filter((p) => where.handle!.in.includes(p.handle));
        if (where.OR) {
          const [byId, byClerk] = where.OR;
          return PEOPLE.filter(
            (p) => byId.id.in.includes(p.id) || byClerk.clerkUserId.in.includes(p.clerkUserId)
          );
        }
        return PEOPLE.filter((p) => where.id!.in.includes(p.id));
      }),
      findUnique: jest.fn(async () => ({ handle: "actorhandle", wikiUsername: null })),
    },
    thinkpagesAccount: {
      findMany: jest.fn(async () => setup.personaOwners ?? []),
      findUnique: jest.fn(async () => ({ displayName: "Aria Vance" })),
    },
    realm: { findUnique: jest.fn(async () => EURTH), findMany: jest.fn(async () => []) },
    realmOfficer: { findMany: jest.fn(async () => []) },
    forumCategoryModerator: { findMany: jest.fn(async () => []) },
  };
  return { db, post };
}

async function run(setup?: Setup, edited = false) {
  const built = build(setup);
  await notifyForumPost(built.db as never, actor, { postId: "p1", edited });
  return built;
}
const notices = () => sent.mock.calls.flatMap(([batch]) => [...batch]);

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  sent.mockClear();
  watchers.mockClear();
  blocking.mockReset();
  blocking.mockResolvedValue([]);
  refusing.mockReset();
  refusing.mockResolvedValue([]);
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

describe("mentions", () => {
  it("tells a mentioned member, naming the author and the thread, and records the mention", async () => {
    const { db } = await run({ html: `<p>${link("kir")} look</p>` });
    expect(notices()).toEqual([
      {
        clerkUserId: "clerk_kir",
        title: "actorhandle mentioned you in Trade talks",
        message: "hello there",
        href: "/thinkpages/post/p1",
        priority: "medium",
        metadata: { kind: "mention", postId: "p1", threadId: "t1" },
      },
    ]);
    expect(db.forumPostMention.createMany).toHaveBeenCalledWith({
      data: [{ postId: "p1", userId: "u_kir" }],
      skipDuplicates: true,
    });
  });

  it("names a persona post by the persona only, and never reads the player", async () => {
    const { db } = await run({ persona: "pa1", html: `<p>${link("kir")}</p>` });
    const [only] = notices();
    expect(only!.title).toBe("Aria Vance mentioned you in Trade talks");
    expect(JSON.stringify(notices())).not.toContain("actorhandle");
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("tells the owner of a mentioned persona, without naming the owner", async () => {
    await run({
      html: `<p>${link("caphnews")}</p>`,
      personaOwners: [{ username: "caphnews", clerkUserId: "clerk_owner" }],
    });
    const [only] = notices();
    expect(only).toMatchObject({
      clerkUserId: "clerk_owner",
      title: "actorhandle mentioned you in Trade talks",
    });
    expect(only!.title).not.toContain("owner");
  });

  it("does not tell the author about a mention of themselves", async () => {
    await run({ html: `<p>${link("actorhandle")}</p>` });
    expect(notices()).toEqual([]);
  });

  it("skips members who block the author or whose privacy refuses mentions", async () => {
    blocking.mockResolvedValue(["clerk_kir"]);
    refusing.mockResolvedValue(["clerk_bob"]);
    await run({ html: `<p>${link("kir")} ${link("bob")} ${link("owner")}</p>` });
    expect(notices().map((n) => n.clerkUserId)).toEqual(["clerk_owner"]);
    expect(refusing).toHaveBeenCalledWith(
      expect.anything(),
      "clerk_actor",
      expect.any(Array),
      "mentions"
    );
  });

  it("skips a member who cannot read the thread", async () => {
    await run({ category: staff, html: `<p>${link("kir")}</p>` });
    expect(notices()).toEqual([]);
  });

  it("tells nobody about a hidden post or a post in a hidden thread, and ignores another author's post", async () => {
    await run({ hidden: true, html: `<p>${link("kir")}</p>` });
    await run({ threadHidden: true, html: `<p>${link("kir")}</p>` });
    expect(notices()).toEqual([]);
    const built = build({ html: `<p>${link("kir")}</p>` });
    await notifyForumPost(
      built.db as never,
      { id: "u_other", clerkUserId: "clerk_other" },
      { postId: "p1", edited: false }
    );
    expect(notices()).toEqual([]);
  });

  it("trusts only the links the server made: a forged or mistyped mention link, or a bare @name, tells nobody", async () => {
    const forged = [
      `<a class="forum-mention" href="/id/bob">@kir</a>`,
      `<a class="forum-mention" href="https://evil.example/id/kir">@kir</a>`,
      `<a class="forum-mention" href="/id/kir">kir</a>`,
      `<a class="Forum-Mention" href="/id/kir">@kir</a>`,
      `<a href="/id/kir">@kir</a>`,
      `<span class="forum-mention">@kir</span>`,
      `@kir and @bob`,
    ].join(" ");
    const { db } = await run({ html: `<p>${forged}</p>` });
    expect(notices()).toEqual([]);
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.forumPostMention.createMany).not.toHaveBeenCalled();
  });

  it("tells nobody about an imported post, whether it has no author or an archive source", async () => {
    await run({ authorUserId: null, html: `<p>${link("kir")}</p>` });
    await run({ sourceRef: "thinkpages_post:abc", html: `<p>${link("kir")}</p>` });
    expect(notices()).toEqual([]);
    expect(watchers).not.toHaveBeenCalled();
  });

  it("looks up at most 50 names", async () => {
    const many = Array.from({ length: 60 }, (_, i) => link(`name${i + 100}`)).join(" ");
    const { db } = await run({ html: `<p>${many}</p>` });
    const handleLookup = db.user.findMany.mock.calls.find(([args]) => args.where.handle)![0];
    expect(handleLookup.where.handle!.in).toHaveLength(MENTION_MAX_PER_POST);
  });

  it("on an edit tells only the mentions it adds, and sends no quote or reply notice", async () => {
    const { db } = await run(
      { html: `<p>${link("kir")} ${link("bob")}</p>`, existing: ["u_kir"] },
      true
    );
    expect(notices().map((n) => n.clerkUserId)).toEqual(["clerk_bob"]);
    expect(db.forumPostMention.createMany).toHaveBeenCalledWith({
      data: [{ postId: "p1", userId: "u_bob" }],
      skipDuplicates: true,
    });
    expect(db.forumPost.findMany).not.toHaveBeenCalled();
    expect(watchers).not.toHaveBeenCalled();
  });
});

describe("quotes and board replies", () => {
  const quoting = (id: string) =>
    `<blockquote class="forum-quote" data-post="${id}"><div>x</div></blockquote><p>agreed</p>`;

  it("tells the author of a quoted post in the same thread, never the quoter themself", async () => {
    const { db } = await run({
      html: quoting("p0"),
      quoted: [{ authorUserId: "u_kir" }, { authorUserId: "u_actor" }],
    });
    expect(notices()).toEqual([
      expect.objectContaining({
        clerkUserId: "clerk_kir",
        title: "actorhandle quoted your post in Trade talks",
        metadata: { kind: "quote", postId: "p1", threadId: "t1" },
      }),
    ]);
    expect(db.forumPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["p0"] }, threadId: "t1", hidden: false, authorUserId: { not: null } },
      })
    );
  });

  it("sends one notice per recipient, the mention outranking the quote", async () => {
    await run({
      html: `${quoting("p0")}<p>${link("kir")}</p>`,
      quoted: [{ authorUserId: "u_kir" }],
    });
    expect(notices()).toHaveLength(1);
    expect(notices()[0]!.title).toContain("mentioned you");
    const handled = watchers.mock.calls[0]![1].handled;
    expect([...handled]).toEqual(["u_kir"]);
  });

  it("hands the watcher step only the members actually told, so a mention refuser still gets the watch notice", async () => {
    blocking.mockResolvedValue(["clerk_bob"]);
    refusing.mockResolvedValue(["clerk_owner"]);
    await run({ html: `<p>${link("kir")} ${link("bob")} ${link("owner")}</p>` });
    expect(notices().map((n) => n.clerkUserId)).toEqual(["clerk_kir"]);
    expect([...watchers.mock.calls[0]![1].handled]).toEqual(["u_kir"]);
  });

  it("hands the watcher step nobody when the notices could not be written", async () => {
    sent.mockResolvedValueOnce(false);
    await run({ html: `<p>${link("kir")}</p>` });
    expect([...watchers.mock.calls[0]![1].handled]).toEqual([]);
  });

  it("lets a member who refuses mentions keep the quote notice they were owed", async () => {
    refusing.mockResolvedValue(["clerk_kir"]);
    await run({
      html: `${quoting("p0")}<p>${link("kir")}</p>`,
      quoted: [{ authorUserId: "u_kir" }],
    });
    expect(notices()).toEqual([
      expect.objectContaining({
        clerkUserId: "clerk_kir",
        title: "actorhandle quoted your post in Trade talks",
        metadata: { kind: "quote", postId: "p1", threadId: "t1" },
      }),
    ]);
    expect([...watchers.mock.calls[0]![1].handled]).toEqual(["u_kir"]);
  });

  it("lets a member who refuses mentions keep the board reply they were owed", async () => {
    refusing.mockResolvedValue(["clerk_kir"]);
    await run({
      category: boardCategory,
      html: `<p>${link("kir")}</p>`,
      replyToPostId: "p0",
      replyTarget: { authorUserId: "u_kir", hidden: false },
    });
    expect(notices()).toEqual([
      expect.objectContaining({
        clerkUserId: "clerk_kir",
        title: "actorhandle replied to you on the Eurth board",
        metadata: { kind: "reply", postId: "p1", threadId: "t1" },
      }),
    ]);
  });

  it("tells a member who refuses mentions nothing when the mention was all they were owed", async () => {
    refusing.mockResolvedValue(["clerk_kir"]);
    await run({ html: `<p>${link("kir")}</p>` });
    expect(notices()).toEqual([]);
    expect([...watchers.mock.calls[0]![1].handled]).toEqual([]);
  });

  it("skips a member who blocks the author for a quote and for a board reply", async () => {
    blocking.mockResolvedValue(["clerk_kir"]);
    await run({ html: quoting("p0"), quoted: [{ authorUserId: "u_kir" }] });
    await run({
      category: boardCategory,
      replyToPostId: "p0",
      replyTarget: { authorUserId: "u_kir", hidden: false },
    });
    expect(notices()).toEqual([]);
  });

  it("tells the owner of a persona-authored post that was quoted or replied to", async () => {
    await run({
      html: quoting("p0"),
      store: [
        {
          id: "p0",
          threadId: "t1",
          hidden: false,
          authorUserId: "u_owner",
          authorPersonaId: "pa9",
        },
      ],
    });
    await run({
      category: boardCategory,
      replyToPostId: "p0",
      replyTarget: { authorUserId: "u_owner", authorPersonaId: "pa9", hidden: false },
    });
    expect(notices().map((n) => [n.clerkUserId, n.metadata.kind])).toEqual([
      ["clerk_owner", "quote"],
      ["clerk_owner", "reply"],
    ]);
    expect(notices().every((n) => n.title.startsWith("actorhandle "))).toBe(true);
  });

  it("ignores a forged quote of a hidden post, of a post in another thread, or of an imported post", async () => {
    const { db } = await run({
      html: [quoting("p_hidden"), quoting("p_other"), quoting("p_imported")].join(""),
      store: [
        { id: "p_hidden", threadId: "t1", hidden: true, authorUserId: "u_kir" },
        { id: "p_other", threadId: "t2", hidden: false, authorUserId: "u_bob" },
        { id: "p_imported", threadId: "t1", hidden: false, authorUserId: null },
      ],
    });
    expect(db.forumPost.findMany).toHaveBeenCalledTimes(1);
    expect(notices()).toEqual([]);
  });

  it("looks up at most 5 quoted posts", async () => {
    const ids = ["p1a", "p2a", "p3a", "p4a", "p5a", "p6a", "p7a"];
    const { db } = await run({ html: ids.map(quoting).join("") });
    const [[lookup]] = db.forumPost.findMany.mock.calls;
    expect(lookup.where.id.in).toEqual(ids.slice(0, 5));
  });

  it("tells the author of the message a board message replies to, on the realm's board", async () => {
    await run({
      category: boardCategory,
      replyToPostId: "p0",
      replyTarget: { authorUserId: "u_kir", hidden: false },
    });
    expect(notices()).toEqual([
      expect.objectContaining({
        clerkUserId: "clerk_kir",
        title: "actorhandle replied to you on the Eurth board",
        metadata: { kind: "reply", postId: "p1", threadId: "t1" },
      }),
    ]);
    expect(watchers).not.toHaveBeenCalled();
  });

  it("does not tell a board author about a reply to their own message, or to a hidden one", async () => {
    await run({
      category: boardCategory,
      replyToPostId: "p0",
      replyTarget: { authorUserId: "u_actor", hidden: false },
    });
    await run({
      category: boardCategory,
      replyToPostId: "p0",
      replyTarget: { authorUserId: "u_kir", hidden: true },
    });
    expect(notices()).toEqual([]);
  });

  it("names the realm board in a board mention", async () => {
    await run({ category: boardCategory, html: `<p>${link("kir")}</p>` });
    expect(notices()[0]!.title).toBe("actorhandle mentioned you in the Eurth board");
  });
});

describe("watchers and failures", () => {
  it("hands a new thread post to the watcher step with everyone already told", async () => {
    await run({ html: `<p>${link("kir")}</p>` });
    expect(watchers).toHaveBeenCalledTimes(1);
    expect(watchers.mock.calls[0]![1]).toMatchObject({
      actorId: "u_actor",
      actorClerkUserId: "clerk_actor",
      postId: "p1",
      threadId: "t1",
      threadTitle: "Trade talks",
      name: "actorhandle",
      excerpt: "hello there",
    });
  });

  it("never throws: a failing lookup is logged", async () => {
    const built = build();
    built.db.forumPost.findUnique.mockRejectedValue(new Error("db down"));
    await expect(
      notifyForumPost(built.db as never, actor, { postId: "p1", edited: false })
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});

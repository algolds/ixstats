/** @jest-environment node */
import { advertGate } from "~/server/modules/thinkpages-forum/advert-access";
import {
  latestPublicThreadPreviews,
  withThreadPreviews,
} from "~/server/modules/thinkpages-forum/thread-preview";

const AT = new Date("2026-10-09T10:00:00Z");
const EARLIER = new Date("2026-10-09T09:00:00Z");
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
};
const EURTH = {
  id: "r_eurth",
  slug: "eurth",
  name: "Eurth",
  emblemUrl: "https://img.example/e.png",
  status: "active",
};

function fakeDb(opts: { listing: ListedRow[]; posts?: FakePost[]; realms?: object[] }) {
  const posts = opts.posts ?? [];
  const visible = (p: FakePost) => !p.hidden;
  const newestFirst = (a: FakePost, b: FakePost) =>
    b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id);
  const oldestFirst = (a: FakePost, b: FakePost) => newestFirst(b, a);
  const threadFindMany = jest.fn(async (_args: { where: Record<string, unknown> }) => opts.listing);
  const postFindMany = jest.fn(async (args: { where: PostWhere }) => {
    const { threadId, OR } = args.where;
    if (typeof threadId === "object") {
      return posts.filter((p) => threadId.in.includes(p.threadId) && visible(p)).sort(oldestFirst);
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
      posts.filter((p) => p.threadId === args.where.threadId && visible(p)).sort(newestFirst)[0] ??
      null
    );
  });
  const userFindMany = jest.fn(async (args: { where: { id: { in: string[] } } }) =>
    USERS.filter((u) => args.where.id.in.includes(u.id))
  );
  const realmFindMany = jest.fn(async (args: { where?: { id: { in: string[] } } }) => {
    const rows = opts.realms ?? [EURTH];
    const ids = args.where?.id.in;
    return ids ? rows.filter((r) => ids.includes((r as { id: string }).id)) : rows;
  });
  const db = {
    forumThread: { findMany: threadFindMany },
    forumPost: { findMany: postFindMany, findFirst: postFindFirst },
    realm: { findMany: realmFindMany },
    user: { findMany: userFindMany },
    thinkpagesAccount: {
      findMany: jest.fn(async (args: { where: { id?: unknown } }) =>
        args.where.id ? [PERSONA] : []
      ),
    },
  };
  return { db: db as never, threadFindMany, postFindMany, postFindFirst, userFindMany };
}

const previewsOf = async (fake: ReturnType<typeof fakeDb>) =>
  (await latestPublicThreadPreviews(fake.db, 20)).map((t) => t.preview);

describe("withThreadPreviews", () => {
  it("answers nothing without a query for no threads", async () => {
    const fake = fakeDb({ listing: [] });
    await expect(withThreadPreviews(fake.db, [])).resolves.toEqual([]);
    expect(fake.postFindMany).not.toHaveBeenCalled();
    expect(fake.postFindFirst).not.toHaveBeenCalled();
  });
});

describe("latestPublicThreadPreviews", () => {
  it("previews an unanswered thread with its first visible post", async () => {
    const fake = fakeDb({
      listing: [listed("t1", 1)],
      posts: [
        post("p1", "t1", {
          plainText: "Hello [ixaction=a1]   world",
          reactionCounts: { like: 2, fire: 1 },
        }),
        post("p1b", "t1", { hidden: true, plainText: "Hidden one" }),
      ],
    });
    const [out] = await latestPublicThreadPreviews(fake.db, 20);
    expect(out!.preview).toEqual({
      threadId: "t1",
      title: "Thread t1",
      threadHref: "/thinkpages/t/t1",
      postHref: "/thinkpages/post/p1",
      kind: "thread",
      excerpt: "Hello world",
      author: {
        name: "jane",
        avatarUrl: null,
        flagUrl: "https://flags.example/eurth.png",
        persona: false,
      },
      board: { name: "General", href: "/thinkpages/c/general" },
      realm: null,
      style: "ooc",
      replyCount: 0,
      reactionTotal: 3,
    });
    expect(out!.postedAt).toEqual(AT);
    expect(fake.postFindMany.mock.calls[0]![0]).toMatchObject({
      where: { threadId: { in: ["t1"] }, hidden: false },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });

  it("previews an answered thread with its newest visible post, asking only for visible posts", async () => {
    const fake = fakeDb({
      listing: [listed("t2", 4)],
      posts: [
        post("p8", "t2", { createdAt: EARLIER }),
        post("p9", "t2", { plainText: "Latest reply" }),
      ],
    });
    const [out] = await latestPublicThreadPreviews(fake.db, 20);
    expect(out!.preview).toMatchObject({
      kind: "reply",
      excerpt: "Latest reply",
      postHref: "/thinkpages/post/p9",
      replyCount: 3,
    });
    expect(fake.postFindMany.mock.calls[0]![0]).toMatchObject({
      where: { hidden: false, OR: [{ threadId: "t2", createdAt: AT }] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    expect(fake.postFindFirst).not.toHaveBeenCalled();
  });

  it("previews the newest visible post with its own time when the newest post is hidden", async () => {
    const fake = fakeDb({
      listing: [listed("t2", 4)],
      posts: [
        post("p7", "t2", { createdAt: EARLIER, plainText: "Older visible reply" }),
        post("p9", "t2", { hidden: true, plainText: "Hidden newest reply" }),
      ],
    });
    const [out] = await latestPublicThreadPreviews(fake.db, 20);
    expect(out!.preview).toMatchObject({
      excerpt: "Older visible reply",
      postHref: "/thinkpages/post/p7",
    });
    expect(out!.postedAt).toEqual(EARLIER);
    expect(out!.lastPostAt).toEqual(AT);
    expect(JSON.stringify(out)).not.toContain("Hidden newest reply");
    expect(fake.postFindFirst).toHaveBeenCalledTimes(1);
    expect(fake.postFindFirst.mock.calls[0]![0]).toMatchObject({
      where: { threadId: "t2", hidden: false },
    });
  });

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
    });
    const text = JSON.stringify(out);
    for (const secret of ["u_secret", "secretplayer", "secret.png", "clerk_secret", "Hidden"]) {
      expect(text).not.toContain(secret);
    }
    expect(out!.preview).toMatchObject({
      style: "ic",
      realm: { slug: "eurth", name: "Eurth", emblemUrl: "https://img.example/e.png" },
      board: { name: "Character Threads", href: "/thinkpages/r/eurth/character-threads" },
      reactionTotal: 0,
    });
  });

  it("never looks up the player of a persona's post", async () => {
    const fake = fakeDb({
      listing: [listed("t2", 3, site(), { authorUserId: null, authorPersonaId: "pa1" })],
      posts: [post("p9", "t2", { authorUserId: "u_secret", authorPersonaId: "pa1" })],
    });
    await latestPublicThreadPreviews(fake.db, 20);
    const asked = fake.userFindMany.mock.calls.flatMap(([args]) => args.where.id.in);
    expect(asked).not.toContain("u_secret");
  });

  it("falls back to the thread's own author and href when no post is visible", async () => {
    const fake = fakeDb({
      listing: [listed("t3", 3)],
      posts: [post("p1", "t3", { hidden: true })],
    });
    const [out] = await latestPublicThreadPreviews(fake.db, 20);
    expect(out!.preview).toMatchObject({
      excerpt: "",
      postHref: "/thinkpages/t/t3",
      author: { name: "jane", avatarUrl: null, flagUrl: null, persona: false },
      reactionTotal: 0,
    });
    expect(out!.postedAt).toBeNull();
  });

  it("names IxWorld when it has no realm row, and links the board by the canonical slug", async () => {
    const fake = fakeDb({
      listing: [listed("t4", 1, inRealm("default", "hub", "Hub", "ooc"))],
      realms: [],
    });
    const [preview] = await previewsOf(fake);
    expect(preview!.realm).toEqual({ slug: "ixworld", name: "IxWorld", emblemUrl: null });
    expect(preview!.board.href).toBe("/thinkpages/r/ixworld/hub");
  });

  it("links the thread when a realm board's realm cannot be resolved", async () => {
    const fake = fakeDb({
      listing: [listed("t5", 1, inRealm("r_gone", "hub", "Hub", "ooc"))],
      realms: [],
    });
    const [preview] = await previewsOf(fake);
    expect(preview!.realm).toBeNull();
    expect(preview!.board).toEqual({ name: "Hub", href: "/thinkpages/t/t5" });
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

  it("reads posts of the listed threads only", async () => {
    const fake = fakeDb({
      listing: [listed("t1", 1), listed("t2", 2)],
      posts: [post("p1", "t1"), post("p2", "t2"), post("pboard", "t_board")],
    });
    const out = await latestPublicThreadPreviews(fake.db, 20);
    expect(out.map((t) => t.preview.postHref)).toEqual([
      "/thinkpages/post/p1",
      "/thinkpages/post/p2",
    ]);
    const [[unanswered], [answered]] = fake.postFindMany.mock.calls;
    expect(unanswered!.where.threadId).toEqual({ in: ["t1"] });
    expect(answered!.where.OR).toEqual([{ threadId: "t2", createdAt: AT }]);
  });

  it("runs a fixed number of post queries however many threads are listed", async () => {
    const listing = Array.from({ length: 20 }, (_, i) => listed(`t${i}`, i % 2 === 0 ? 1 : 3));
    const posts = listing.map((t) => post(`p_${t.id}`, t.id));
    const fake = fakeDb({ listing, posts });
    const out = await latestPublicThreadPreviews(fake.db, 20);
    expect(out).toHaveLength(20);
    expect(fake.threadFindMany).toHaveBeenCalledTimes(1);
    expect(fake.postFindMany).toHaveBeenCalledTimes(2);
    expect(fake.postFindFirst).not.toHaveBeenCalled();
  });

  it("skips the query for a kind of thread that is not listed", async () => {
    const fake = fakeDb({ listing: [listed("t1", 1)], posts: [post("p1", "t1")] });
    await latestPublicThreadPreviews(fake.db, 20);
    expect(fake.postFindMany).toHaveBeenCalledTimes(1);
  });
});

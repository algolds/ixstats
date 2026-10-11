/** @jest-environment node */
import {
  discussionCountsOf,
  discussionsOf,
} from "~/server/modules/thinkpages-forum/action-discussions";

interface Cat {
  id: string;
  key: string;
  name: string;
  style: string;
  visibility: string;
  scope: string;
  realmId: string | null;
}
const cat = (id: string, extra: Partial<Cat>): Cat => ({
  id,
  key: id,
  name: id,
  style: "ooc",
  visibility: "public",
  scope: "site",
  realmId: null,
  ...extra,
});
const general = cat("general", { name: "General" });
const hub = cat("hub", { name: "Hub", scope: "realm", realmId: "r_eurth" });
const board = cat("board", { name: "Board", style: "board", scope: "realm", realmId: "r_eurth" });
const oldHub = cat("old-hub", { name: "Old Hub", scope: "realm", realmId: "r_old" });
const draftHub = cat("draft-hub", { name: "Draft Hub", scope: "realm", realmId: "r_draft" });
const draftBoard = cat("draft-board", {
  name: "Draft Board",
  style: "board",
  scope: "realm",
  realmId: "r_draft",
});
const reports = cat("reports", { name: "Reports", visibility: "reporter_staff" });
const staffOnly = cat("staff-only", { name: "Staff", visibility: "staff" });

const realms = [
  { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" },
  { id: "r_old", slug: "old", name: "Old Land", status: "archived", ownerId: "founder" },
  { id: "r_draft", slug: "draft", name: "Draft Land", status: "draft", ownerId: "founder" },
];
const users = [
  {
    id: "u_ann",
    handle: "ann",
    wikiUsername: null,
    clerkUserId: "clerk_ann",
    country: { name: "Annland", flag: null },
  },
];

const USER = { name: "user", level: 100 };
const guest = null;
const member = { id: "u_m", clerkUserId: "clerk_m", countryId: "c1", role: USER };
const author = { id: "u_ann", clerkUserId: "clerk_ann", countryId: "c2", role: USER };
const admin = {
  id: "u_a",
  clerkUserId: "clerk_a",
  countryId: null,
  role: { name: "admin", level: 10 },
};
const realmMod = {
  ...member,
  mod: { siteAdmin: false, realmIds: ["r_eurth"], categoryIds: [] },
};

interface PostRow {
  id: string;
  hidden: boolean;
  createdAt: Date;
  authorUserId: string | null;
  authorPersonaId: string | null;
  importedAuthorName: string | null;
  thread: {
    id: string;
    title: string;
    hidden: boolean;
    authorUserId: string | null;
    category: Cat;
  };
}
const post = (
  id: string,
  category: Cat,
  extra: Partial<PostRow> = {},
  thread: Partial<PostRow["thread"]> = {}
): PostRow => ({
  id,
  hidden: false,
  createdAt: new Date("2026-10-01T10:00:00Z"),
  authorUserId: "u_ann",
  authorPersonaId: null,
  importedAuthorName: null,
  thread: {
    id: `t_${id}`,
    title: `Thread of ${id}`,
    hidden: false,
    authorUserId: "u_ann",
    category,
    ...thread,
  },
  ...extra,
});

interface LinkRow {
  id: string;
  activityId: string;
  postSource: string;
  postRef: string;
  createdAt: Date;
}
/** Newer links have a smaller `n`. */
const link = (n: number, postRef: string, extra: Partial<LinkRow> = {}): LinkRow => ({
  id: `l${String(n).padStart(3, "0")}`,
  activityId: "a1",
  postSource: "native",
  postRef,
  createdAt: new Date(Date.UTC(2026, 9, 10) - n * 60_000),
  ...extra,
});

interface LinkWhere {
  activityId: string | { in: string[] };
  postSource: string;
  activity?: { visibility: string };
}
/** `privateActivities` are the ids of activities whose row is not `visibility: "public"`. */
function world(links: LinkRow[], posts: PostRow[], privateActivities: string[] = []) {
  const db = {
    postActionLink: {
      findMany: jest.fn(
        async (args: {
          where: LinkWhere;
          take: number;
          cursor?: { id: string };
          skip?: number;
        }) => {
          const { activityId, activity } = args.where;
          let rows = links.filter(
            (l) =>
              l.postSource === args.where.postSource &&
              (typeof activityId === "string"
                ? l.activityId === activityId
                : activityId.in.includes(l.activityId)) &&
              (activity === undefined ||
                (activity.visibility === "public") === !privateActivities.includes(l.activityId))
          );
          rows = [...rows].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1)
          );
          if (args.cursor) {
            const at = rows.findIndex((r) => r.id === args.cursor!.id);
            rows = at < 0 ? [] : rows.slice(at + (args.skip ?? 0));
          }
          return rows.slice(0, args.take);
        }
      ),
    },
    forumPost: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        posts.filter((p) => where.id.in.includes(p.id))
      ),
    },
    realm: {
      findUnique: jest.fn(
        async ({ where }: { where: { id?: string; slug?: string } }) =>
          realms.find((r) => (where.id ? r.id === where.id : r.slug === where.slug)) ?? null
      ),
    },
    user: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        users.filter((u) => where.id.in.includes(u.id))
      ),
    },
    thinkpagesAccount: {
      findMany: jest.fn(async () => []),
    },
  };
  return db;
}

const page = (db: ReturnType<typeof world>, viewer: object | null, cursor?: string) =>
  discussionsOf(db as never, viewer as never, { activityId: "a1", cursor });
const ids = (out: { items: Array<{ postId: string }> }) => out.items.map((i) => i.postId);

describe("discussionsOf", () => {
  it("lists the posts that link the action, newest link first, with their place and permalink", async () => {
    const db = world(
      [link(2, "p_thread"), link(1, "p_board")],
      [post("p_thread", general), post("p_board", board)]
    );
    const out = await page(db, guest);
    expect(out.nextCursor).toBeNull();
    expect(out.items).toEqual([
      {
        postId: "p_board",
        href: "/thinkpages/post/p_board",
        title: "Eurth board",
        kind: "board",
        categoryName: null,
        realmName: "Eurth",
        author: { name: "ann", persona: false },
        createdAt: new Date("2026-10-01T10:00:00Z"),
      },
      {
        postId: "p_thread",
        href: "/thinkpages/post/p_thread",
        title: "Thread of p_thread",
        kind: "thread",
        categoryName: "General",
        realmName: null,
        author: { name: "ann", persona: false },
        createdAt: new Date("2026-10-01T10:00:00Z"),
      },
    ]);
  });

  it("reads only native links of public activities", async () => {
    const db = world(
      [link(1, "p1", { postSource: "xenforo" }), link(2, "p2")],
      [post("p2", general)]
    );
    const out = await page(db, guest);
    expect(ids(out)).toEqual(["p2"]);
    const [[call]] = db.postActionLink.findMany.mock.calls;
    expect(call.where).toEqual({
      activityId: "a1",
      postSource: "native",
      activity: { visibility: "public" },
    });
  });

  describe("an activity that is not public (R3)", () => {
    const posts = [post("p1", general)];

    it("lists nothing for an abandoned directive, for any viewer", async () => {
      const db = world([link(1, "p1")], posts, ["a1"]);
      for (const viewer of [guest, member, author, admin]) {
        expect(await page(db, viewer)).toEqual({ items: [], nextCursor: null });
      }
    });

    it("counts nothing for it, and still counts the public one beside it", async () => {
      const db = world([link(1, "p1"), link(2, "p1", { activityId: "a2" })], posts, ["a1"]);
      expect(await discussionCountsOf(db as never, admin as never, ["a1", "a2"])).toEqual({
        a1: { count: 0, postIds: [] },
        a2: { count: 1, postIds: ["p1"] },
      });
    });
  });

  // One test per rule that visiblePosts mirrors (R12).
  describe("visibility", () => {
    it("hidden post: left out for a member and a visitor, shown marked to a moderator", async () => {
      const posts = [post("p_vis", hub), post("p_hid", hub, { hidden: true })];
      const links = [link(1, "p_hid"), link(2, "p_vis")];
      expect(ids(await page(world(links, posts), member))).toEqual(["p_vis"]);
      expect(ids(await page(world(links, posts), guest))).toEqual(["p_vis"]);
      const modView = await page(world(links, posts), realmMod);
      expect(modView.items.map((i) => [i.postId, i.hidden])).toEqual([
        ["p_hid", true],
        ["p_vis", undefined],
      ]);
      expect((await page(world(links, posts), admin)).items).toHaveLength(2);
    });

    it("hidden thread: left out for a member, marked for a moderator", async () => {
      const posts = [post("p1", general, {}, { hidden: true })];
      expect((await page(world([link(1, "p1")], posts), member)).items).toEqual([]);
      const out = await page(world([link(1, "p1")], posts), admin);
      expect(out.items[0]).toMatchObject({ postId: "p1", hidden: true });
    });

    it("staff category: for site admins only", async () => {
      const posts = [post("p_staff", staffOnly)];
      const links = [link(1, "p_staff")];
      expect((await page(world(links, posts), guest)).items).toEqual([]);
      expect((await page(world(links, posts), member)).items).toEqual([]);
      expect((await page(world(links, posts), realmMod)).items).toEqual([]);
      expect(ids(await page(world(links, posts), admin))).toEqual(["p_staff"]);
    });

    it("Reports thread: its author and moderators only", async () => {
      const posts = [post("p_rep", reports, {}, { authorUserId: "u_ann" })];
      const links = [link(1, "p_rep")];
      expect((await page(world(links, posts), guest)).items).toEqual([]);
      expect((await page(world(links, posts), member)).items).toEqual([]);
      expect(ids(await page(world(links, posts), author))).toEqual(["p_rep"]);
      expect(ids(await page(world(links, posts), admin))).toEqual(["p_rep"]);
    });

    it("draft realm: for its staff only, while an archived realm stays readable", async () => {
      const posts = [post("p_draft", draftHub), post("p_old", oldHub)];
      const links = [link(1, "p_draft"), link(2, "p_old")];
      expect(ids(await page(world(links, posts), guest))).toEqual(["p_old"]);
      expect(ids(await page(world(links, posts), member))).toEqual(["p_old"]);
      expect(ids(await page(world(links, posts), admin))).toEqual(["p_draft", "p_old"]);
    });

    it("board path: a message in a draft realm is for its staff only, one in a live realm is public", async () => {
      const posts = [post("p_b", draftBoard), post("p_live", board)];
      const links = [link(1, "p_b"), link(2, "p_live")];
      expect(ids(await page(world(links, posts), guest))).toEqual(["p_live"]);
      expect(ids(await page(world(links, posts), member))).toEqual(["p_live"]);
      expect(ids(await page(world(links, posts), admin))).toEqual(["p_b", "p_live"]);
    });

    it("board path: a hidden board message is for the realm's moderators only", async () => {
      const posts = [post("p_b", board, { hidden: true })];
      const links = [link(1, "p_b")];
      expect((await page(world(links, posts), guest)).items).toEqual([]);
      expect((await page(world(links, posts), member)).items).toEqual([]);
      const out = await page(world(links, posts), realmMod);
      expect(out.items[0]).toMatchObject({ kind: "board", hidden: true });
    });

    it("drops a link whose post is gone", async () => {
      const out = await page(
        world([link(1, "p_gone"), link(2, "p1")], [post("p1", general)]),
        guest
      );
      expect(ids(out)).toEqual(["p1"]);
    });
  });

  describe("authors", () => {
    it("leaves a persona's post out for every viewer, moderators included, and never looks up its player", async () => {
      for (const viewer of [guest, member, author, realmMod, admin]) {
        const db = world(
          [link(1, "p_persona")],
          [post("p_persona", general, { authorPersonaId: "pa1", authorUserId: "u_ann" })]
        );
        const out = await page(db, viewer);
        expect(out).toEqual({ items: [], nextCursor: null });
        expect(db.user.findMany).not.toHaveBeenCalled();
        expect(db.thinkpagesAccount.findMany).not.toHaveBeenCalled();
      }
    });

    it("lists the user's own post beside a persona post, naming only the user's", async () => {
      const db = world(
        [link(1, "p_persona"), link(2, "p_user")],
        [
          post("p_persona", general, { authorPersonaId: "pa1", authorUserId: "u_ann" }),
          post("p_user", general),
        ]
      );
      expect(ids(await page(db, admin))).toEqual(["p_user"]);
    });

    it("falls back to the imported name, then to Member", async () => {
      const db = world(
        [link(1, "p1"), link(2, "p2")],
        [
          post("p1", general, { authorUserId: null, importedAuthorName: "Old Poster" }),
          post("p2", general, { authorUserId: null }),
        ]
      );
      const out = await page(db, guest);
      expect(out.items.map((i) => i.author.name)).toEqual(["Old Poster", "Member"]);
    });
  });

  describe("paging", () => {
    const many = (count: number, over: (n: number) => Partial<PostRow> = () => ({})) => {
      const nums = Array.from({ length: count }, (_, i) => i + 1);
      return world(
        nums.map((n) => link(n, `p${n}`)),
        nums.map((n) => post(`p${n}`, general, over(n)))
      );
    };

    it("returns 20 per page and a cursor that continues after the last one shown", async () => {
      const db = many(45);
      const first = await page(db, guest);
      expect(first.items).toHaveLength(20);
      expect(first.items[0]!.postId).toBe("p1");
      expect(first.nextCursor).toBe("l020");
      const second = await page(db, guest, first.nextCursor!);
      expect(ids(second)[0]).toBe("p21");
      expect(second.items).toHaveLength(20);
      const third = await page(db, guest, second.nextCursor!);
      expect(third.items).toHaveLength(5);
      expect(third.nextCursor).toBeNull();
    });

    it("does not let hidden posts take page slots", async () => {
      const db = many(30, (n) => ({ hidden: n <= 15 }));
      const out = await page(db, guest);
      expect(out.items).toHaveLength(15);
      expect(out.nextCursor).toBeNull();
    });

    it("scans 100 links per call and hands back a cursor when all of them were hidden", async () => {
      const db = many(150, () => ({ hidden: true }));
      const first = await page(db, guest);
      expect(first.items).toEqual([]);
      expect(first.nextCursor).toBe("l100");
      const second = await page(db, guest, first.nextCursor!);
      expect(second).toEqual({ items: [], nextCursor: null });
    });

    it("reads an unknown cursor as the end of the list", async () => {
      const out = await page(many(3), guest, "l999");
      expect(out).toEqual({ items: [], nextCursor: null });
    });
  });
});

describe("discussionCountsOf", () => {
  const counts = (db: ReturnType<typeof world>, viewer: object | null, wanted: string[]) =>
    discussionCountsOf(db as never, viewer as never, wanted);

  it("counts the visible posts per action in one links query and one posts query", async () => {
    const db = world(
      [
        link(1, "p1"),
        link(2, "p2"),
        link(3, "p3"),
        link(4, "p4", { activityId: "a2" }),
        link(5, "p_hid", { activityId: "a2" }),
      ],
      [
        post("p1", general),
        post("p2", general),
        post("p3", general),
        post("p4", general),
        post("p_hid", general, { hidden: true }),
      ]
    );
    const out = await counts(db, member, ["a1", "a2", "a3"]);
    expect(out).toEqual({
      a1: { count: 3, postIds: ["p1", "p2"] },
      a2: { count: 1, postIds: ["p4"] },
      a3: { count: 0, postIds: [] },
    });
    expect(db.postActionLink.findMany).toHaveBeenCalledTimes(1);
    expect(db.forumPost.findMany).toHaveBeenCalledTimes(1);
  });

  it("counts a moderator's hidden posts too", async () => {
    const db = world([link(1, "p_hid")], [post("p_hid", hub, { hidden: true })]);
    expect((await counts(db, realmMod, ["a1"])).a1).toEqual({ count: 1, postIds: ["p_hid"] });
    expect((await counts(db, guest, ["a1"])).a1).toEqual({ count: 0, postIds: [] });
  });

  it("never counts a persona's post, for any viewer", async () => {
    const posts = [
      post("p_persona", general, { authorPersonaId: "pa1", authorUserId: "u_ann" }),
      post("p_user", general),
    ];
    const links = [link(1, "p_persona"), link(2, "p_user")];
    for (const viewer of [guest, member, realmMod, admin]) {
      expect((await counts(world(links, posts), viewer, ["a1"])).a1).toEqual({
        count: 1,
        postIds: ["p_user"],
      });
    }
  });

  it("agrees with discussionsOf for the same viewer, post for post", async () => {
    const posts = [
      post("p1", general),
      post("p2", hub, { hidden: true }),
      post("p3", reports, {}, { authorUserId: "u_ann" }),
      post("p4", draftHub),
      post("p5", board),
      post("p6", general, { authorPersonaId: "pa1" }),
    ];
    const links = posts.map((p, i) => link(i + 1, p.id));
    for (const viewer of [guest, member, author, realmMod, admin]) {
      const listed = ids(await page(world(links, posts), viewer));
      const counted = (await counts(world(links, posts), viewer, ["a1"])).a1!;
      expect(counted.count).toBe(listed.length);
      expect(counted.postIds).toEqual(listed.slice(0, 2));
    }
  });

  it("asks for nothing when no ids are given, and counts a repeated id once", async () => {
    const empty = world([], []);
    expect(await counts(empty, guest, [])).toEqual({});
    expect(empty.postActionLink.findMany).not.toHaveBeenCalled();
    const db = world([link(1, "p1")], [post("p1", general)]);
    expect(await counts(db, guest, ["a1", "a1"])).toEqual({ a1: { count: 1, postIds: ["p1"] } });
  });

  it("is safe for an id that names a prototype key", async () => {
    const db = world([link(1, "p1", { activityId: "__proto__" })], [post("p1", general)]);
    const out = await counts(db, guest, ["__proto__", "a1"]);
    expect(Object.keys(out)).toEqual(["__proto__", "a1"]);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(({} as { count?: number }).count).toBeUndefined();
  });
});

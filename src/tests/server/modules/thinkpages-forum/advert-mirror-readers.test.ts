/** @jest-environment node */
/**
 * The readers that mirror the thread permalink rules (post-location.ts, reads.ts) also drop the advert of a realm the
 * viewer cannot see: "Discussed in" lists and counts, the reaction target, notice recipients and
 * report filing. One test per reader, each with a draft realm's advert, a published realm's advert and a plain thread.
 */
import {
  discussionCountsOf,
  discussionsOf,
} from "~/server/modules/thinkpages-forum/action-discussions";
import { fileReport } from "~/server/modules/thinkpages-forum/mod-reports";
import {
  readableUsers,
  type NoticePlace,
} from "~/server/modules/thinkpages-forum/notice-recipients";
import {
  loadReactablePost,
  loadReadablePost,
  threadReactable,
} from "~/server/modules/thinkpages-forum/reaction-target";

const USER = { name: "user", level: 100 };
const member = { id: "u_m", clerkUserId: "clerk_m", countryId: "c1", role: USER };
const founder = { id: "u_f", clerkUserId: "founder", countryId: "c2", role: USER };
const admin = {
  id: "u_a",
  clerkUserId: "admin",
  countryId: null,
  role: { name: "admin", level: 10 },
};

const ACTIVE = {
  id: "r_eurth",
  slug: "eurth",
  name: "Eurth",
  status: "active",
  ownerId: "founder",
};
const DRAFT = { id: "r_draft", slug: "draft", name: "Draft", status: "draft", ownerId: "founder" };
const ARCHIVED = { ...ACTIVE, id: "r_old", slug: "old", status: "archived" };
const realms = [ACTIVE, DRAFT, ARCHIVED];
const realmTable = () => ({
  findUnique: jest.fn(
    async ({ where }: { where: { id?: string; slug?: string } }) =>
      realms.find((r) => (where.id ? r.id === where.id : r.slug === where.slug)) ?? null
  ),
});

const SITE = {
  id: "cat_find",
  key: "find-a-realm",
  name: "Find a Realm",
  style: "ooc",
  visibility: "public",
  scope: "site",
  realmId: null,
};

describe("Discussed in (visiblePosts)", () => {
  const link = (postRef: string, n: number) => ({
    id: `l${n}`,
    activityId: "a1",
    postSource: "native",
    postRef,
    createdAt: new Date(Date.UTC(2026, 9, 10) - n * 60_000),
  });
  const post = (id: string, advertRealmId: string | null) => ({
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
      advertRealmId,
      category: SITE,
    },
  });
  const world = () => {
    const posts = [post("p_draft", "r_draft"), post("p_active", "r_eurth"), post("p_plain", null)];
    return {
      postActionLink: {
        findMany: jest.fn(async () => [
          link("p_draft", 1),
          link("p_active", 2),
          link("p_plain", 3),
        ]),
      },
      forumPost: {
        findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
          posts.filter((p) => where.id.in.includes(p.id))
        ),
      },
      realm: realmTable(),
      user: { findMany: jest.fn(async () => []) },
      thinkpagesAccount: { findMany: jest.fn(async () => []) },
    };
  };

  it("lists the posts of a draft realm's advert only to its founder and site admins", async () => {
    const ids = async (viewer: object | null) =>
      (await discussionsOf(world() as never, viewer as never, { activityId: "a1" })).items
        .map((i) => i.postId)
        .sort();
    expect(await ids(member)).toEqual(["p_active", "p_plain"]);
    expect(await ids(null)).toEqual(["p_active", "p_plain"]);
    expect(await ids(founder)).toEqual(["p_active", "p_draft", "p_plain"]);
    expect(await ids(admin)).toEqual(["p_active", "p_draft", "p_plain"]);
  });

  it("reads an advert's realm once however many of its posts are linked", async () => {
    const db = world();
    db.postActionLink.findMany.mockResolvedValue([link("p_draft", 1), link("p_draft2", 2)]);
    const posts = [post("p_draft", "r_draft"), post("p_draft2", "r_draft")];
    db.forumPost.findMany.mockResolvedValue(posts);
    await discussionsOf(db as never, member, { activityId: "a1" });
    expect(db.realm.findUnique).toHaveBeenCalledTimes(1);
    expect(db.realm.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r_draft" } })
    );
  });

  it("counts them the same way", async () => {
    const count = async (viewer: object | null) =>
      (await discussionCountsOf(world() as never, viewer as never, ["a1"])).a1!.count;
    expect(await count(member)).toBe(2);
    expect(await count(founder)).toBe(3);
  });
});

describe("the reaction target (loadReadablePost)", () => {
  const target = (advertRealmId: string | null) => ({
    id: "p1",
    threadId: "t_ad",
    authorUserId: "u_f",
    authorPersonaId: null,
    hidden: false,
    continuedThreadId: null,
    reactionCounts: {},
    thread: {
      title: "Join",
      authorUserId: "u_f",
      hidden: false,
      locked: false,
      archived: false,
      advertRealmId,
      category: SITE,
    },
  });
  const db = (advertRealmId: string | null) => ({
    forumPost: { findUnique: jest.fn(async () => target(advertRealmId)) },
    realm: realmTable(),
  });

  it("reads a draft realm's advert post as not found to a member and a signed-out reader", async () => {
    await expect(loadReadablePost(db("r_draft") as never, member, "p1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(loadReadablePost(db("r_draft") as never, null, "p1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("reads it for the founder and a site admin, and reads a published or ordinary thread for all", async () => {
    await expect(loadReadablePost(db("r_draft") as never, founder, "p1")).resolves.toMatchObject({
      post: { id: "p1" },
    });
    await expect(loadReadablePost(db("r_draft") as never, admin, "p1")).resolves.toMatchObject({
      post: { id: "p1" },
    });
    await expect(loadReadablePost(db("r_eurth") as never, null, "p1")).resolves.toMatchObject({
      post: { id: "p1" },
    });
    await expect(loadReadablePost(db(null) as never, member, "p1")).resolves.toMatchObject({
      post: { id: "p1" },
    });
  });
});

describe("reacting to an archived realm's advert", () => {
  const db = (advertRealmId: string | null) => ({
    forumPost: {
      findUnique: jest.fn(async () => ({
        id: "p1",
        threadId: "t_ad",
        authorUserId: "u_f",
        authorPersonaId: null,
        hidden: false,
        continuedThreadId: null,
        reactionCounts: {},
        thread: {
          title: "Join",
          authorUserId: "u_f",
          hidden: false,
          locked: false,
          archived: false,
          advertRealmId,
          category: SITE,
        },
      })),
    },
    realm: realmTable(),
    forumBan: { findMany: jest.fn(async () => []) },
  });

  it("takes no reaction, from a member or a site admin, while an open realm's advert does", async () => {
    for (const viewer of [member, admin]) {
      await expect(loadReactablePost(db("r_old") as never, viewer, "p1")).rejects.toMatchObject({
        code: "CONFLICT",
        message: expect.stringMatching(/archived/i),
      });
    }
    await expect(loadReactablePost(db("r_eurth") as never, member, "p1")).resolves.toMatchObject({
      post: { id: "p1" },
    });
    await expect(loadReactablePost(db(null) as never, member, "p1")).resolves.toMatchObject({
      post: { id: "p1" },
    });
  });

  it("offers no reaction on the thread read when the advert is closed", () => {
    const open = { locked: false, archived: false, hidden: false };
    expect(threadReactable(member, open, false, null, true)).toBe(false);
    expect(threadReactable(member, open, false, null, false)).toBe(true);
    expect(threadReactable(member, open, false, null)).toBe(true);
  });
});

describe("notice recipients (readableUsers)", () => {
  const person = (id: string, over: object = {}) => ({
    id,
    clerkUserId: `clerk_${id}`,
    countryId: null,
    role: USER,
    ...over,
  });
  const recipients = [
    person("u_admin", { role: { name: "admin", level: 10 } }),
    person("u_plain"),
    person("u_founder", { clerkUserId: "founder" }),
  ];
  const db = () => ({
    realm: realmTable(),
    realmOfficer: { findMany: jest.fn(async () => []) },
    forumCategoryModerator: { findMany: jest.fn(async () => []) },
  });
  const place = (advertRealmId: string | null): NoticePlace => ({
    thread: { authorUserId: "u_x", hidden: false, advertRealmId },
    category: SITE,
    realm: null,
  });
  const ids = async (advertRealmId: string | null) =>
    (await readableUsers(db() as never, place(advertRealmId), recipients)).map((u) => u.id);

  it("tells only the founder and site admins about a draft realm's advert", async () => {
    expect(await ids("r_draft")).toEqual(["u_admin", "u_founder"]);
  });

  it("reads the advert's realm once for the whole list, not once per recipient", async () => {
    const counting = db();
    await readableUsers(counting as never, place("r_draft"), recipients);
    expect(counting.realm.findUnique).toHaveBeenCalledTimes(1);
    const plain = db();
    await readableUsers(plain as never, place(null), recipients);
    expect(plain.realm.findUnique).not.toHaveBeenCalled();
  });

  it("tells everyone about a published realm's advert and an ordinary thread", async () => {
    expect(await ids("r_eurth")).toEqual(["u_admin", "u_plain", "u_founder"]);
    expect(await ids(null)).toEqual(["u_admin", "u_plain", "u_founder"]);
  });
});

describe("filing a report (fileReport)", () => {
  const db = (advertRealmId: string | null, authorUserId: string) => ({
    forumThread: {
      findUnique: jest.fn(async () => ({
        authorUserId,
        hidden: false,
        advertRealmId,
        category: SITE,
      })),
    },
    realm: realmTable(),
  });
  const input = { targetType: "thread" as const, targetId: "t_ad", reason: "Misleading advert" };

  it("answers a report of a draft realm's advert as not found to a member", async () => {
    await expect(fileReport(db("r_draft", "u_x") as never, member, input)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Thread not found.",
    });
  });

  it("lets the founder, who can read it, get as far as the own-content refusal", async () => {
    await expect(
      fileReport(db("r_draft", founder.id) as never, founder, input)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lets a member get that far on a published realm's advert", async () => {
    await expect(
      fileReport(db("r_eurth", member.id) as never, member, input)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

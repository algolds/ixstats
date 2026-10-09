/** @jest-environment node */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    systemConfig: { findUnique: jest.fn(), upsert: jest.fn() },
    forumThread: { findFirst: jest.fn() },
    forumPost: { findFirst: jest.fn() },
    forumCategory: { findFirst: jest.fn() },
    realm: { findUnique: jest.fn() },
    user: { findFirst: jest.fn() },
  },
}));

import {
  FORUM_IMPORT_NODE_MAP_KEY,
  LEGACY_FORUM_REDIRECT_KEY,
  legacyForumRedirectFor,
  setLegacyForumRedirect,
} from "~/server/modules/thinkpages-forum";
import { __resetLegacyForumRedirectForTests } from "~/server/modules/thinkpages-forum/legacy-redirect";
import { refreshLegacyForumRedirect } from "~/server/modules/thinkpages-forum/legacy-switch";
import { db } from "~/server/db";

const config = jest.mocked(db.systemConfig.findUnique);
const upsert = jest.mocked(db.systemConfig.upsert);
const thread = jest.mocked(db.forumThread.findFirst);
const post = jest.mocked(db.forumPost.findFirst);
const category = jest.mocked(db.forumCategory.findFirst);
const realm = jest.mocked(db.realm.findUnique);
const user = jest.mocked(db.user.findFirst);

interface Rows {
  switchValue?: string | null;
  nodeMap?: string | null;
}

/** Answers the two SystemConfig rows the redirect reads; only `value` matters. */
function configRows({ switchValue = "true", nodeMap = null }: Rows) {
  config.mockImplementation(((args: { where: { key: string } }) => {
    const value = args.where.key === LEGACY_FORUM_REDIRECT_KEY ? switchValue : nodeMap;
    return Promise.resolve(value === null ? null : { value });
  }) as never);
}

interface CategoryRow {
  id: string;
  scope: string;
  realmId: string | null;
  key: string;
  visibility: string;
}

const CATEGORIES: CategoryRow[] = [
  { id: "c_general", scope: "site", realmId: null, key: "general", visibility: "public" },
  { id: "c_xf14", scope: "site", realmId: null, key: "xf-14", visibility: "public" },
  { id: "c_xf16", scope: "site", realmId: null, key: "xf-16", visibility: "staff" },
  { id: "c_staff", scope: "site", realmId: null, key: "staff", visibility: "staff" },
  { id: "c_reports", scope: "site", realmId: null, key: "reports", visibility: "reporter_staff" },
  { id: "c_eurth_hub", scope: "realm", realmId: "r_eurth", key: "hub", visibility: "public" },
  { id: "c_ixw_hub", scope: "realm", realmId: "default", key: "hub", visibility: "public" },
  { id: "c_draft_hub", scope: "realm", realmId: "r_draft", key: "hub", visibility: "public" },
  { id: "c_old_hub", scope: "realm", realmId: "r_old", key: "hub", visibility: "public" },
];

const REALMS = [
  { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "u_founder" },
  { id: "default", slug: "default", name: "IxWorld", status: "active", ownerId: "staff" },
  { id: "r_draft", slug: "drafty", name: "Drafty", status: "draft", ownerId: "u_founder" },
  { id: "r_old", slug: "old", name: "Old", status: "archived", ownerId: "u_founder" },
];

const THREADS = [
  { xenforoThreadId: 123, id: "t_native", hidden: false, categoryId: "c_general" },
  { xenforoThreadId: 124, id: "t_hidden", hidden: true, categoryId: "c_general" },
  { xenforoThreadId: 125, id: "t_staff", hidden: false, categoryId: "c_staff" },
  { xenforoThreadId: 126, id: "t_draft", hidden: false, categoryId: "c_draft_hub" },
  { xenforoThreadId: 127, id: "t_eurth", hidden: false, categoryId: "c_eurth_hub" },
  { xenforoThreadId: 128, id: "t_report", hidden: false, categoryId: "c_reports" },
  { xenforoThreadId: 129, id: "t_old", hidden: false, categoryId: "c_old_hub" },
];

const POSTS = [
  { xenforoPostId: 456, id: "p_native", hidden: false, thread: 123 },
  { xenforoPostId: 457, id: "p_hidden", hidden: true, thread: 123 },
  { xenforoPostId: 458, id: "p_in_hidden_thread", hidden: false, thread: 124 },
  { xenforoPostId: 459, id: "p_staff", hidden: false, thread: 125 },
  { xenforoPostId: 460, id: "p_draft", hidden: false, thread: 126 },
];

interface CategoryWhere {
  visibility?: { in: string[] };
}
interface ThreadWhere {
  hidden?: boolean;
  category?: CategoryWhere;
}

const categoryOf = (id: string) => CATEGORIES.find((c) => c.id === id)!;
const visibleTo = (row: CategoryRow, where: CategoryWhere | undefined) =>
  !where?.visibility || where.visibility.in.includes(row.visibility);
const place = (row: CategoryRow) => ({ scope: row.scope, realmId: row.realmId });

/** A thread as the fake database filters it: every filter the caller passes is honoured, none is assumed. */
function threadMatches(row: (typeof THREADS)[number], where: ThreadWhere | undefined): boolean {
  if (where?.hidden !== undefined && row.hidden !== where.hidden) return false;
  return visibleTo(categoryOf(row.categoryId), where?.category);
}

beforeEach(() => {
  __resetLegacyForumRedirectForTests();
  jest.clearAllMocks();
  configRows({});
  thread.mockImplementation(((args: { where: ThreadWhere & { xenforoThreadId: number } }) => {
    const row = THREADS.find(
      (t) => t.xenforoThreadId === args.where.xenforoThreadId && threadMatches(t, args.where)
    );
    return Promise.resolve(
      row ? { id: row.id, category: place(categoryOf(row.categoryId)) } : null
    );
  }) as never);
  post.mockImplementation(((args: {
    where: { xenforoPostId: number; hidden?: boolean; thread?: ThreadWhere };
  }) => {
    const { xenforoPostId, hidden, thread: threadWhere } = args.where;
    const row = POSTS.find((p) => p.xenforoPostId === xenforoPostId);
    const parent = THREADS.find((t) => t.xenforoThreadId === row?.thread);
    if (!row || !parent || (hidden !== undefined && row.hidden !== hidden)) {
      return Promise.resolve(null);
    }
    if (!threadMatches(parent, threadWhere)) return Promise.resolve(null);
    return Promise.resolve({
      id: row.id,
      thread: { category: place(categoryOf(parent.categoryId)) },
    });
  }) as never);
  category.mockImplementation(((args: {
    where: CategoryWhere & { scope: string; realmId: string | null; key: string };
  }) => {
    const { scope, realmId, key } = args.where;
    const hit = CATEGORIES.find(
      (c) => c.scope === scope && c.realmId === realmId && c.key === key && visibleTo(c, args.where)
    );
    return Promise.resolve(hit ? { key: hit.key } : null);
  }) as never);
  realm.mockImplementation(((args: { where: { slug?: string; id?: string } }) => {
    const { slug, id } = args.where;
    return Promise.resolve(REALMS.find((r) => r.slug === slug || r.id === id) ?? null);
  }) as never);
  user.mockImplementation(((args: { where: { forumUserId: number } }) =>
    Promise.resolve(
      args.where.forumUserId === 7
        ? { handle: "jane" }
        : args.where.forumUserId === 8
          ? { handle: null }
          : null
    )) as never);
});

const lookups = () => [thread, post, category, realm, user].map((fn) => fn.mock.calls.length);

describe("legacy forum switch", () => {
  it("is off when no row exists", async () => {
    configRows({ switchValue: null });
    await expect(refreshLegacyForumRedirect()).resolves.toBe(false);
    expect(config).toHaveBeenCalledWith({
      where: { key: LEGACY_FORUM_REDIRECT_KEY },
      select: { value: true },
    });
  });

  it("follows the row, reading it at most once per TTL unless forced", async () => {
    configRows({ switchValue: "true" });
    await expect(refreshLegacyForumRedirect()).resolves.toBe(true);
    configRows({ switchValue: "false" });
    await expect(refreshLegacyForumRedirect()).resolves.toBe(true);
    expect(config).toHaveBeenCalledTimes(1);
    await expect(refreshLegacyForumRedirect(true)).resolves.toBe(false);
    expect(config).toHaveBeenCalledTimes(2);
  });

  it("re-reads the row once the TTL has passed", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    await refreshLegacyForumRedirect();
    configRows({ switchValue: "false" });
    now.mockReturnValue(1_000_000 + 15_001);
    await expect(refreshLegacyForumRedirect()).resolves.toBe(false);
    now.mockRestore();
  });

  it("keeps the last value when the row cannot be read", async () => {
    await refreshLegacyForumRedirect();
    config.mockRejectedValueOnce(new Error("db down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(refreshLegacyForumRedirect(true)).resolves.toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("writes the row and takes the new value at once, without a read", async () => {
    await setLegacyForumRedirect(true);
    expect(upsert).toHaveBeenCalledWith({
      where: { key: LEGACY_FORUM_REDIRECT_KEY },
      create: { key: LEGACY_FORUM_REDIRECT_KEY, value: "true" },
      update: { value: "true" },
    });
    configRows({ switchValue: "false" });
    await expect(refreshLegacyForumRedirect()).resolves.toBe(true);
    await setLegacyForumRedirect(false);
    expect(upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ update: { value: "false" } })
    );
    configRows({ switchValue: "true" });
    await expect(refreshLegacyForumRedirect()).resolves.toBe(false);
  });
});

describe("legacyForumRedirectFor", () => {
  it("is null without any lookup while the switch is off", async () => {
    configRows({ switchValue: "false" });
    await expect(legacyForumRedirectFor(db, { kind: "thread", threadId: 123 })).resolves.toBeNull();
    await expect(legacyForumRedirectFor(db, { kind: "home" })).resolves.toBeNull();
    expect(lookups()).toEqual([0, 0, 0, 0, 0]);
  });

  it("sends the home and the bridge's other pages to the forum home", async () => {
    await expect(legacyForumRedirectFor(db, { kind: "home" })).resolves.toBe("/thinkpages/forum");
    await expect(legacyForumRedirectFor(db, { kind: "other" })).resolves.toBe("/thinkpages/forum");
    expect(lookups()).toEqual([0, 0, 0, 0, 0]);
  });

  it("resolves a XenForo thread id to the imported thread", async () => {
    await expect(legacyForumRedirectFor(db, { kind: "thread", threadId: 123 })).resolves.toBe(
      "/thinkpages/t/t_native"
    );
    expect(thread).toHaveBeenCalledWith({
      where: { xenforoThreadId: 123, hidden: false, category: { visibility: { in: ["public"] } } },
      select: { id: true, category: { select: { scope: true, realmId: true } } },
    });
  });

  it("resolves a XenForo post id to the imported post", async () => {
    await expect(legacyForumRedirectFor(db, { kind: "post", postId: 456 })).resolves.toBe(
      "/thinkpages/post/p_native"
    );
    expect(post).toHaveBeenCalledWith({
      where: {
        xenforoPostId: 456,
        hidden: false,
        thread: { hidden: false, category: { visibility: { in: ["public"] } } },
      },
      select: {
        id: true,
        thread: { select: { category: { select: { scope: true, realmId: true } } } },
      },
    });
  });

  it("resolves threads and posts in a published realm's public category, archived realms included", async () => {
    await expect(legacyForumRedirectFor(db, { kind: "thread", threadId: 127 })).resolves.toBe(
      "/thinkpages/t/t_eurth"
    );
    await expect(legacyForumRedirectFor(db, { kind: "thread", threadId: 129 })).resolves.toBe(
      "/thinkpages/t/t_old"
    );
  });

  it("never resolves what an anonymous visitor may not read", async () => {
    for (const ref of [
      { kind: "thread", threadId: 124 }, // hidden thread
      { kind: "thread", threadId: 125 }, // staff category
      { kind: "thread", threadId: 128 }, // reporter_staff category
      { kind: "thread", threadId: 126 }, // draft realm
      { kind: "post", postId: 457 }, // hidden post
      { kind: "post", postId: 458 }, // post in a hidden thread
      { kind: "post", postId: 459 }, // post in a staff category
      { kind: "post", postId: 460 }, // post in a draft realm
    ] as const) {
      await expect(legacyForumRedirectFor(db, ref)).resolves.toBe("/thinkpages/forum");
    }
  });

  it("resolves a member to the earliest linked account's handle", async () => {
    await expect(legacyForumRedirectFor(db, { kind: "member", userId: 7 })).resolves.toBe("/@jane");
    expect(user).toHaveBeenCalledWith({
      where: { forumUserId: 7 },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { handle: true },
    });
  });

  it("sends unknown ids and a member without a handle to the forum home", async () => {
    for (const ref of [
      { kind: "thread", threadId: 999 },
      { kind: "post", postId: 999 },
      { kind: "member", userId: 999 },
      { kind: "member", userId: 8 },
      { kind: "forum", nodeId: 999 },
    ] as const) {
      await expect(legacyForumRedirectFor(db, ref)).resolves.toBe("/thinkpages/forum");
    }
  });

  it("resolves a mapped node to its sitewide category", async () => {
    configRows({ nodeMap: JSON.stringify({ "12": { scope: "site", key: "general" } }) });
    await expect(legacyForumRedirectFor(db, { kind: "forum", nodeId: 12 })).resolves.toBe(
      "/thinkpages/c/general"
    );
  });

  it("resolves a mapped node to its realm category under the realm's canonical slug", async () => {
    configRows({
      nodeMap: JSON.stringify({
        "13": { scope: "realm", realm: "eurth", key: "hub" },
        "20": { scope: "realm", realm: "default", key: "hub" },
      }),
    });
    await expect(legacyForumRedirectFor(db, { kind: "forum", nodeId: 13 })).resolves.toBe(
      "/thinkpages/r/eurth/hub"
    );
    await expect(legacyForumRedirectFor(db, { kind: "forum", nodeId: 20 })).resolves.toBe(
      "/thinkpages/r/ixworld/hub"
    );
  });

  it("falls back to the node's archive category without a node map, or for an archive entry", async () => {
    configRows({ nodeMap: null });
    await expect(legacyForumRedirectFor(db, { kind: "forum", nodeId: 14 })).resolves.toBe(
      "/thinkpages/c/xf-14"
    );
    __resetLegacyForumRedirectForTests();
    configRows({ nodeMap: JSON.stringify({ "14": { archive: true } }) });
    await expect(legacyForumRedirectFor(db, { kind: "forum", nodeId: 14 })).resolves.toBe(
      "/thinkpages/c/xf-14"
    );
  });

  it("never lands on a staff category or a draft realm's category", async () => {
    configRows({
      nodeMap: JSON.stringify({
        "16": { scope: "site", key: "staff" },
        "17": { scope: "realm", realm: "drafty", key: "hub" },
      }),
    });
    for (const nodeId of [16, 17]) {
      await expect(legacyForumRedirectFor(db, { kind: "forum", nodeId })).resolves.toBe(
        "/thinkpages/forum"
      );
    }
  });

  it("falls back to the archive key, then the home, when a mapped target is gone", async () => {
    configRows({
      nodeMap: JSON.stringify({
        "14": { scope: "site", key: "gone" },
        "15": { scope: "realm", realm: "nowhere", key: "hub" },
      }),
    });
    await expect(legacyForumRedirectFor(db, { kind: "forum", nodeId: 14 })).resolves.toBe(
      "/thinkpages/c/xf-14"
    );
    await expect(legacyForumRedirectFor(db, { kind: "forum", nodeId: 15 })).resolves.toBe(
      "/thinkpages/forum"
    );
  });

  it("sends the visitor to the forum home when a lookup fails", async () => {
    thread.mockRejectedValueOnce(new Error("db down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(legacyForumRedirectFor(db, { kind: "thread", threadId: 123 })).resolves.toBe(
      "/thinkpages/forum"
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("tolerates a malformed node map row", async () => {
    configRows({ nodeMap: "{not json" });
    await expect(legacyForumRedirectFor(db, { kind: "forum", nodeId: 14 })).resolves.toBe(
      "/thinkpages/c/xf-14"
    );
  });

  it("reads the node map row at most once per TTL", async () => {
    configRows({ nodeMap: JSON.stringify({ "12": { scope: "site", key: "general" } }) });
    await legacyForumRedirectFor(db, { kind: "forum", nodeId: 12 });
    await legacyForumRedirectFor(db, { kind: "forum", nodeId: 12 });
    const nodeMapReads = config.mock.calls.filter(
      ([args]) => args.where.key === FORUM_IMPORT_NODE_MAP_KEY
    );
    expect(nodeMapReads).toHaveLength(1);
  });
});

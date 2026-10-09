/** @jest-environment node */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    systemConfig: { findUnique: jest.fn(), upsert: jest.fn() },
    forumThread: { findUnique: jest.fn() },
    forumPost: { findUnique: jest.fn() },
    forumCategory: { findFirst: jest.fn() },
    realm: { findUnique: jest.fn() },
    user: { findFirst: jest.fn() },
  },
}));

import {
  __resetLegacyForumRedirectForTests,
  FORUM_IMPORT_NODE_MAP_KEY,
  isLegacyForumRedirectOn,
  LEGACY_FORUM_REDIRECT_KEY,
  legacyForumRedirectFor,
  refreshLegacyForumRedirect,
  setLegacyForumRedirect,
} from "~/server/modules/thinkpages-forum";
import { db } from "~/server/db";

const config = jest.mocked(db.systemConfig.findUnique);
const upsert = jest.mocked(db.systemConfig.upsert);
const thread = jest.mocked(db.forumThread.findUnique);
const post = jest.mocked(db.forumPost.findUnique);
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

const CATEGORIES = [
  { scope: "site", realmId: null, key: "general" },
  { scope: "site", realmId: null, key: "xf-14" },
  { scope: "realm", realmId: "r_eurth", key: "hub" },
  { scope: "realm", realmId: "default", key: "hub" },
];

const REALMS = [
  { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "u_founder" },
  { id: "default", slug: "default", name: "IxWorld", status: "active", ownerId: "staff" },
];

beforeEach(() => {
  __resetLegacyForumRedirectForTests();
  jest.clearAllMocks();
  configRows({});
  thread.mockImplementation(((args: { where: { xenforoThreadId: number } }) =>
    Promise.resolve(args.where.xenforoThreadId === 123 ? { id: "t_native" } : null)) as never);
  post.mockImplementation(((args: { where: { xenforoPostId: number } }) =>
    Promise.resolve(args.where.xenforoPostId === 456 ? { id: "p_native" } : null)) as never);
  category.mockImplementation(((args: {
    where: { scope: string; realmId: string | null; key: string };
  }) => {
    const { scope, realmId, key } = args.where;
    const hit = CATEGORIES.find((c) => c.scope === scope && c.realmId === realmId && c.key === key);
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
  it("is off before any load and when no row exists", async () => {
    configRows({ switchValue: null });
    expect(isLegacyForumRedirectOn()).toBe(false);
    await expect(refreshLegacyForumRedirect()).resolves.toBe(false);
    expect(config).toHaveBeenCalledWith({
      where: { key: LEGACY_FORUM_REDIRECT_KEY },
      select: { value: true },
    });
  });

  it("follows the row, reading it at most once per TTL unless forced", async () => {
    configRows({ switchValue: "true" });
    await expect(refreshLegacyForumRedirect()).resolves.toBe(true);
    expect(isLegacyForumRedirectOn()).toBe(true);
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

  it("writes the row and takes the new value at once", async () => {
    await setLegacyForumRedirect(true);
    expect(upsert).toHaveBeenCalledWith({
      where: { key: LEGACY_FORUM_REDIRECT_KEY },
      create: { key: LEGACY_FORUM_REDIRECT_KEY, value: "true" },
      update: { value: "true" },
    });
    expect(isLegacyForumRedirectOn()).toBe(true);
    await setLegacyForumRedirect(false);
    expect(upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ update: { value: "false" } })
    );
    expect(isLegacyForumRedirectOn()).toBe(false);
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
    expect(thread).toHaveBeenCalledWith({ where: { xenforoThreadId: 123 }, select: { id: true } });
  });

  it("resolves a XenForo post id to the imported post", async () => {
    await expect(legacyForumRedirectFor(db, { kind: "post", postId: 456 })).resolves.toBe(
      "/thinkpages/post/p_native"
    );
    expect(post).toHaveBeenCalledWith({ where: { xenforoPostId: 456 }, select: { id: true } });
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

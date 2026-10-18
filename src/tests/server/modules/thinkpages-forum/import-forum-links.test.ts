/** @jest-environment node */
import { nodeLandings } from "~/lib/thinkpages-forum/import/forum-links";
import type { NodeMapFile } from "~/lib/thinkpages-forum/import/node-map";
import {
  resolveForumRef,
  type ForumLinksDb,
} from "~/server/modules/thinkpages-forum/import-forum-links";

const thread = jest.fn();
const post = jest.fn();
const category = jest.fn();
const realm = jest.fn();
const user = jest.fn();
const db = {
  forumThread: { findFirst: thread },
  forumPost: { findFirst: post },
  forumCategory: { findFirst: category },
  realm: { findUnique: realm },
  user: { findFirst: user },
} as unknown as ForumLinksDb;

const NO_LANDINGS = nodeLandings({ nodes: {} });
const landingsOf = (nodes: NodeMapFile["nodes"]) => nodeLandings({ nodes });

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
  { id: "default", slug: "default", name: "Ixnay", status: "active", ownerId: "staff" },
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
  jest.clearAllMocks();
  thread.mockImplementation((args: { where: ThreadWhere & { xenforoThreadId: number } }) => {
    const row = THREADS.find(
      (t) => t.xenforoThreadId === args.where.xenforoThreadId && threadMatches(t, args.where)
    );
    return Promise.resolve(
      row ? { id: row.id, category: place(categoryOf(row.categoryId)) } : null
    );
  });
  post.mockImplementation(
    (args: { where: { xenforoPostId: number; hidden?: boolean; thread?: ThreadWhere } }) => {
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
    }
  );
  category.mockImplementation(
    (args: { where: CategoryWhere & { scope: string; realmId: string | null; key: string } }) => {
      const { scope, realmId, key } = args.where;
      const hit = CATEGORIES.find(
        (c) =>
          c.scope === scope && c.realmId === realmId && c.key === key && visibleTo(c, args.where)
      );
      return Promise.resolve(hit ? { key: hit.key } : null);
    }
  );
  realm.mockImplementation((args: { where: { slug?: string; id?: string } }) => {
    const { slug, id } = args.where;
    return Promise.resolve(REALMS.find((r) => r.slug === slug || r.id === id) ?? null);
  });
  user.mockImplementation((args: { where: { forumUserId: number } }) =>
    Promise.resolve(
      args.where.forumUserId === 7
        ? { handle: "jane" }
        : args.where.forumUserId === 8
          ? { handle: null }
          : null
    )
  );
});

describe("resolveForumRef", () => {
  it("resolves a XenForo thread id to the imported thread", async () => {
    await expect(resolveForumRef(db, { kind: "thread", threadId: 123 }, NO_LANDINGS)).resolves.toBe(
      "/thinkpages/t/t_native"
    );
    expect(thread).toHaveBeenCalledWith({
      where: { xenforoThreadId: 123, hidden: false, category: { visibility: { in: ["public"] } } },
      select: { id: true, category: { select: { scope: true, realmId: true } } },
    });
  });

  it("resolves a XenForo post id to the imported post", async () => {
    await expect(resolveForumRef(db, { kind: "post", postId: 456 }, NO_LANDINGS)).resolves.toBe(
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
    await expect(resolveForumRef(db, { kind: "thread", threadId: 127 }, NO_LANDINGS)).resolves.toBe(
      "/thinkpages/t/t_eurth"
    );
    await expect(resolveForumRef(db, { kind: "thread", threadId: 129 }, NO_LANDINGS)).resolves.toBe(
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
      await expect(resolveForumRef(db, ref, NO_LANDINGS)).resolves.toBeNull();
    }
  });

  it("resolves a member to the earliest linked account's handle", async () => {
    await expect(resolveForumRef(db, { kind: "member", userId: 7 }, NO_LANDINGS)).resolves.toBe(
      "/@jane"
    );
    expect(user).toHaveBeenCalledWith({
      where: { forumUserId: 7 },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { handle: true },
    });
  });

  it("is null for unknown ids and a member without a handle", async () => {
    for (const ref of [
      { kind: "thread", threadId: 999 },
      { kind: "post", postId: 999 },
      { kind: "member", userId: 999 },
      { kind: "member", userId: 8 },
      { kind: "forum", nodeId: 999 },
    ] as const) {
      await expect(resolveForumRef(db, ref, NO_LANDINGS)).resolves.toBeNull();
    }
  });

  it("resolves a mapped node to its sitewide category", async () => {
    const landings = landingsOf({ "12": { scope: "site", key: "general" } });
    await expect(resolveForumRef(db, { kind: "forum", nodeId: 12 }, landings)).resolves.toBe(
      "/thinkpages/c/general"
    );
  });

  it("resolves a mapped node to its realm category under the realm's canonical slug", async () => {
    const landings = landingsOf({
      "13": { scope: "realm", realm: "eurth", key: "hub" },
      "20": { scope: "realm", realm: "default", key: "hub" },
    });
    await expect(resolveForumRef(db, { kind: "forum", nodeId: 13 }, landings)).resolves.toBe(
      "/thinkpages/r/eurth/hub"
    );
    await expect(resolveForumRef(db, { kind: "forum", nodeId: 20 }, landings)).resolves.toBe(
      "/thinkpages/r/ixnay/hub"
    );
  });

  it("falls back to the node's archive category without a landing, or for an archive entry", async () => {
    await expect(resolveForumRef(db, { kind: "forum", nodeId: 14 }, NO_LANDINGS)).resolves.toBe(
      "/thinkpages/c/xf-14"
    );
    const archived = landingsOf({ "14": { archive: true } });
    await expect(resolveForumRef(db, { kind: "forum", nodeId: 14 }, archived)).resolves.toBe(
      "/thinkpages/c/xf-14"
    );
  });

  it("never lands on a staff category or a draft realm's category", async () => {
    const landings = landingsOf({
      "16": { scope: "site", key: "staff" },
      "17": { scope: "realm", realm: "drafty", key: "hub" },
    });
    for (const nodeId of [16, 17]) {
      await expect(resolveForumRef(db, { kind: "forum", nodeId }, landings)).resolves.toBeNull();
    }
  });

  it("falls back to the archive key, then null, when a mapped target is gone", async () => {
    const landings = landingsOf({
      "14": { scope: "site", key: "gone" },
      "15": { scope: "realm", realm: "nowhere", key: "hub" },
    });
    await expect(resolveForumRef(db, { kind: "forum", nodeId: 14 }, landings)).resolves.toBe(
      "/thinkpages/c/xf-14"
    );
    await expect(resolveForumRef(db, { kind: "forum", nodeId: 15 }, landings)).resolves.toBeNull();
  });

  it("lets a failed lookup throw instead of resolving to a fallback", async () => {
    thread.mockRejectedValueOnce(new Error("db down"));
    await expect(
      resolveForumRef(db, { kind: "thread", threadId: 123 }, NO_LANDINGS)
    ).rejects.toThrow("db down");
  });
});

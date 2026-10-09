/** @jest-environment node */
import fs from "node:fs/promises";
import path from "node:path";
import { countActionTokens, countTextActionTokens } from "~/lib/action-links";
import { SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import type { NodeMapFile } from "~/lib/thinkpages-forum/import/node-map";
import {
  planImport,
  UnknownTargetError,
  type ImportDbState,
} from "~/lib/thinkpages-forum/import/plan";
import { summarizeImport } from "~/lib/thinkpages-forum/import/report";
import {
  readSnapshot,
  type AttachmentEntry,
  type Snapshot,
  type SnapshotFs,
} from "~/lib/thinkpages-forum/import/snapshot";
import type { XfNode, XfPost, XfThread } from "~/lib/thinkpages-forum/import/xenforo-types";
import { sanitizeUserContent } from "~/lib/utils/sanitize-html";

const FIXTURE = path.join(process.cwd(), "src/tests/fixtures/xenforo/snapshot-small");

/** Reads the fixture from disk; the import lib only ever sees the injected fs. */
const diskFs: SnapshotFs = {
  readFile: (file) => fs.readFile(file, "utf8"),
  writeFile: () => Promise.reject(new Error("read-only")),
  appendFile: () => Promise.reject(new Error("read-only")),
  rename: () => Promise.reject(new Error("read-only")),
  mkdir: () => Promise.reject(new Error("read-only")),
  exists: (file) =>
    fs.access(file).then(
      () => true,
      () => false
    ),
  stat: (file) => fs.stat(file).then((s) => ({ size: s.size })),
};

const SITE = SITE_CATEGORIES.map((c) => ({
  id: `c-${c.key}`,
  key: c.key,
  visibility: c.visibility,
}));

const dbState = (overrides: Partial<ImportDbState> = {}): ImportDbState => ({
  users: [
    { id: "u-admin", forumUserId: 7, createdAt: new Date("2025-01-01") },
    { id: "u-member", forumUserId: 8, createdAt: new Date("2025-01-02") },
  ],
  siteCategories: SITE,
  realmIds: new Map([
    ["ixworld", "default"],
    ["default", "default"],
    ["urcea", "realm-urcea"],
  ]),
  realmCategories: [
    { id: "rc-default-hub", realmId: "default", key: "hub" },
    { id: "rc-urcea-current", realmId: "realm-urcea", key: "current-events" },
  ],
  existingThreads: new Map(),
  existingPosts: new Set(),
  attachmentFor: (id) =>
    id === 55
      ? { kind: "image", url: "/images/uploads/forum/55-abc-map.png", filename: "map.png" }
      : id === 56
        ? { kind: "link", url: "/images/uploads/forum/56-def-rules.pdf", filename: "rules.pdf" }
        : null,
  ...overrides,
});

const node = (node_id: number, title: string, node_type_id = "Forum"): XfNode => ({
  node_id,
  title,
  description: "",
  node_type_id,
  parent_node_id: 0,
  display_order: node_id,
});

const thread = (thread_id: number, node_id: number, extra: Partial<XfThread> = {}): XfThread => ({
  thread_id,
  node_id,
  title: `Thread ${thread_id}`,
  user_id: 7,
  username: "Admin",
  post_date: 1700000000,
  last_post_date: 1700009000,
  reply_count: 0,
  view_count: 0,
  first_post_id: thread_id * 10,
  discussion_open: true,
  sticky: false,
  discussion_state: "visible",
  prefix_id: 0,
  ...extra,
});

const post = (
  post_id: number,
  thread_id: number,
  position: number,
  extra: Partial<XfPost> = {}
): XfPost => ({
  post_id,
  thread_id,
  user_id: 7,
  username: "Admin",
  post_date: 1700000000 + position,
  message: `post ${post_id}`,
  message_state: "visible",
  position,
  attach_count: 0,
  is_first_post: position === 0,
  ...extra,
});

type MiniSnapshot = Pick<Snapshot, "nodes" | "threads" | "postsByThread" | "attachments">;

function snap(nodes: XfNode[], threads: XfThread[], posts: XfPost[]): MiniSnapshot {
  const postsByThread = new Map<number, XfPost[]>();
  for (const p of posts)
    postsByThread.set(p.thread_id, [...(postsByThread.get(p.thread_id) ?? []), p]);
  // Every attachment complete, unless a test says otherwise.
  const attachments = new Map<number, AttachmentEntry>(
    posts.flatMap((p) =>
      (p.Attachments ?? []).map((a): [number, AttachmentEntry] => [
        a.attachment_id,
        { ...a, post_id: p.post_id, stored: "ok" },
      ])
    )
  );
  return { nodes, threads, postsByThread, attachments };
}

const GENERAL = node(12, "General Discussion");

describe("planImport on the snapshot-small fixture", () => {
  let snapshot: Snapshot;
  beforeAll(async () => {
    snapshot = await readSnapshot(diskFs, FIXTURE);
  });

  it("reads a complete 3-node, 4-thread, 9-post, 2-attachment, 3-user snapshot", () => {
    expect(snapshot.nodes).toHaveLength(3);
    expect(snapshot.threads).toHaveLength(4);
    expect([...snapshot.postsByThread.values()].flat()).toHaveLength(9);
    expect(snapshot.attachments.size).toBe(2);
    expect(snapshot.users.size).toBe(3);
  });

  it("plans the archive category, three threads and their visible or hidden posts", () => {
    const plan = planImport(snapshot, dbState(), null);
    expect(plan.categories.map((c) => [c.key, c.name, c.visibility, c.postRole])).toEqual([
      ["xf-13", "Archive: Staff Room", "public", "staff"],
    ]);
    expect(
      plan.threads.map((t) => [
        t.xenforoThreadId,
        t.categoryRef,
        t.title,
        t.pinned,
        t.locked,
        t.hidden,
      ])
    ).toEqual([
      [100, { kind: "existing", id: "c-general" }, "Welcome", true, false, false],
      [101, { kind: "existing", id: "c-general" }, "Awaiting approval", false, false, true],
      [103, { kind: "archive", key: "xf-13" }, "Team notes", false, true, true],
    ]);
    const posts = plan.threads.flatMap((t) =>
      t.posts.map((p) => [p.xenforoPostId, p.hidden, p.authorUserId])
    );
    expect(posts).toEqual([
      [1000, false, "u-admin"],
      [1001, true, "u-member"],
      [1010, false, null],
      [1011, false, null],
      [1030, false, "u-admin"],
      [1031, false, "u-member"],
    ]);
    expect(plan.threads[0]!.skippedPosts).toEqual({ deleted: 1, alreadyImported: 0 });
  });

  it("reports the skipped thread, states, authors, attachments, tokens and the staff-like warning", () => {
    const { report } = planImport(snapshot, dbState(), null);
    expect(report.threads).toEqual({
      visible: 3,
      moderated: 1,
      deleted: 0,
      skippedByNode: 0,
      firstPostDeleted: 1,
      noPosts: 0,
      redirect: 0,
      gone: 0,
    });
    expect(report.posts).toEqual({ visible: 5, moderated: 2, deleted: 2 });
    expect(report.authors).toMatchObject({
      matchedPosts: 4,
      unmatchedPosts: 1,
      guestPosts: 1,
      unmatchedUsers: 1,
    });
    expect(report.authors.topUnmatched).toEqual([{ xenforoUserId: 9, name: "Writer", posts: 1 }]);
    expect(report.attachments.image).toEqual({ count: 1, bytes: 4 });
    expect(report.attachments.link).toEqual({ count: 1, bytes: 8 });
    expect(report.attachmentsStored).toEqual({ ok: { count: 2, bytes: 12 } });
    expect(report.tokens).toEqual({ kept: 1, stripped: 0, overLimit: 0, posts: 1 });
    expect(report.features).toMatchObject({ spoiler: 1, templateSyntax: 1 });
    expect(report.notCarried).toEqual({ prefixes: 1, polls: 1, views: 63 });
    expect(report.totals).toEqual({
      categories: 1,
      threadsNew: 3,
      threadsResumed: 0,
      posts: 6,
      hiddenThreads: 2,
      hiddenPosts: 1,
    });
    expect(report.warnings).toEqual([expect.stringContaining('13 "Staff Room"')]);
    expect(report.nodes.map((n) => [n.nodeId, n.target, n.source, n.threads, n.posts])).toEqual([
      [1, "skip", "default", 0, 0],
      [12, "site:general", "heuristic", 2, 4],
      [13, "archive:xf-13 (public)", "default", 1, 2],
    ]);
    expect(summarizeImport(report).join("\n")).toContain("Staff Room");
  });

  it("keeps every stored body sanitized, inert and token-consistent, with forum links absolute", () => {
    const plan = planImport(snapshot, dbState(), null);
    for (const p of plan.threads.flatMap((t) => t.posts)) {
      expect(sanitizeUserContent(p.contentHtml)).toBe(p.contentHtml);
      expect(countTextActionTokens(p.contentHtml)).toBe(countActionTokens(p.contentHtml));
      expect(p.contentHtml).not.toMatch(/<script|javascript:|onerror/i);
    }
    const byId = new Map(plan.threads.flatMap((t) => t.posts).map((p) => [p.xenforoPostId, p]));
    expect(byId.get(1001)!.contentHtml).toContain(
      'href="https://forum.ixwiki.com/threads/welcome.100/"'
    );
    expect(byId.get(1000)!.contentHtml).toContain(
      '<img src="/images/uploads/forum/55-abc-map.png"'
    );
    expect(byId.get(1031)!.contentHtml).toContain("<p>Attachments</p>");
    expect(byId.get(1030)!.plainText.replace(/\u200B/g, "")).toBe("{{Infobox country}}");
  });

  it("orders same-second posts by position (Q19) and dates edits", () => {
    const [welcome] = planImport(snapshot, dbState(), null).threads;
    expect(welcome!.posts.map((p) => p.createdAt.getTime())).toEqual([
      1700000000000, 1700000000001,
    ]);
    expect(welcome!.posts[0]!.editedAt).toEqual(new Date(1700000500000));
    expect(welcome!.posts[1]!.editedAt).toBeNull();
    expect(welcome!.createdAt).toEqual(new Date(1700000000000));
    // the moderated reply is hidden, so the last visible post sets lastPostAt
    expect(welcome!.lastPostAt).toEqual(new Date(1700000000000));
  });

  it("plans only the missing posts of an existing thread and reports a complete one", () => {
    const resumed = planImport(
      snapshot,
      dbState({ existingThreads: new Map([[100, "t100"]]), existingPosts: new Set([1000]) }),
      null
    );
    const welcome = resumed.threads.find((t) => t.xenforoThreadId === 100)!;
    expect(welcome.existingId).toBe("t100");
    expect(welcome.posts.map((p) => p.xenforoPostId)).toEqual([1001]);
    expect(welcome.skippedPosts).toEqual({ deleted: 1, alreadyImported: 1 });

    const done = planImport(
      snapshot,
      dbState({
        existingThreads: new Map([[100, "t100"]]),
        existingPosts: new Set([1000, 1001]),
        siteCategories: [...SITE, { id: "c-xf-13", key: "xf-13", visibility: "public" }],
      }),
      null
    );
    expect(done.threads.map((t) => t.xenforoThreadId)).toEqual([101, 103]);
    expect(done.categories).toEqual([]);
    expect(done.threads[1]!.categoryRef).toEqual({ kind: "existing", id: "c-xf-13" });
    expect(done.report.alreadyPresent).toEqual({ threads: 1, posts: 2 });
    expect(done.report.totals.threadsResumed).toBe(0);
  });

  it("lands a private forum in a staff archive with no warning when the map says so", () => {
    const map: NodeMapFile = { nodes: { "13": { archive: true, visibility: "staff" } } };
    const plan = planImport(snapshot, dbState(), map);
    expect(plan.categories[0]).toMatchObject({ key: "xf-13", visibility: "staff" });
    expect(plan.report.warnings).toEqual([]);
  });
});

describe("planImport rules", () => {
  it("drops and counts the threads of a skipped node", () => {
    const plan = planImport(
      snap([GENERAL], [thread(1, 12), thread(2, 12)], [post(10, 1, 0), post(20, 2, 0)]),
      dbState(),
      { nodes: { "12": { skip: true } } }
    );
    expect(plan.threads).toEqual([]);
    expect(plan.report.threads.skippedByNode).toBe(2);
  });

  it("skips and counts redirect stubs and threads gone during the export", () => {
    const plan = planImport(
      {
        ...snap(
          [GENERAL],
          [thread(1, 12, { discussion_type: "redirect" }), thread(2, 12), thread(3, 12)],
          [post(20, 2, 0), post(30, 3, 0)]
        ),
        state: { threadsGone: new Set([2]) },
      },
      dbState(),
      null
    );
    expect(plan.threads.map((t) => t.xenforoThreadId)).toEqual([3]);
    expect(plan.report.threads).toMatchObject({ redirect: 1, gone: 1, visible: 1 });
  });

  it("omits every attachment without complete bytes, whatever the policy says, and counts it by state", () => {
    const file = (attachment_id: number) => ({
      attachment_id,
      filename: `a${attachment_id}.png`,
      file_size: 5,
      content_type: "image/png",
    });
    const entry = (attachment_id: number, extra: Partial<AttachmentEntry>): AttachmentEntry => ({
      ...file(attachment_id),
      post_id: 10,
      stored: "ok",
      ...extra,
    });
    const files = [70, 71, 72, 73, 74, 75].map(file);
    const plan = planImport(
      {
        ...snap([GENERAL], [thread(1, 12)], [post(10, 1, 0, { Attachments: files })]),
        attachments: new Map([
          [70, entry(70, { stored: "forbidden" })],
          [71, entry(71, { stored: "size_mismatch", received_size: 3 })],
          [72, entry(72, { stored: "missing" })],
          [73, entry(73, { stored: "ok", received_size: 4 })],
          [75, entry(75, {})],
        ]),
      },
      dbState({
        attachmentFor: (id) => ({
          kind: "image",
          url: `/images/uploads/forum/${id}.png`,
          filename: `a${id}.png`,
        }),
      }),
      null
    );
    expect(plan.report.attachmentsStored).toEqual({
      forbidden: { count: 1, bytes: 5 },
      size_mismatch: { count: 1, bytes: 5 },
      missing: { count: 1, bytes: 5 },
      ok: { count: 2, bytes: 10 },
      absent: { count: 1, bytes: 5 },
    });
    expect(plan.report.attachments.omitted).toEqual({ count: 5, bytes: 25 });
    expect(plan.report.attachments.image).toEqual({ count: 1, bytes: 5 });
    const { contentHtml } = plan.threads[0]!.posts[0]!;
    for (const id of [70, 71, 72, 73, 74]) {
      expect(contentHtml).toContain(`[attachment omitted: a${id}.png]`);
      expect(contentHtml).not.toContain(`/forum/${id}.png`);
    }
    expect(contentHtml).toContain('src="/images/uploads/forum/75.png"');
  });

  it("blocks when an existing archive category's visibility differs from the node map", () => {
    const db = dbState({
      siteCategories: [...SITE, { id: "c-xf-12", key: "xf-12", visibility: "public" }],
    });
    const plan = planImport(snap([node(12, "Old board")], [], []), db, {
      nodes: { "12": { archive: true, visibility: "staff" } },
    });
    expect(plan.categories).toEqual([]);
    expect(plan.report.blocking).toEqual([
      expect.stringContaining('xf-12 is "public" but the node map says "staff"'),
    ]);
    expect(summarizeImport(plan.report).join("\n")).toContain("BLOCKING:");
    expect(planImport(snap([node(12, "Old board")], [], []), db, null).report.blocking).toEqual([]);
  });

  it("reads a mapped site category's visibility from the database for the staff-like warning", () => {
    const db = dbState({
      siteCategories: [...SITE, { id: "c-xf-9", key: "xf-9", visibility: "staff" }],
    });
    const plan = planImport(snap([node(9, "Staff stuff")], [], []), db, {
      nodes: { "9": { scope: "site", key: "xf-9" } },
    });
    expect(plan.report.warnings).toEqual([]);
  });

  it("counts a thread whose node is not in the snapshot as skipped", () => {
    const plan = planImport(snap([], [thread(1, 99)], [post(10, 1, 0)]), dbState(), null);
    expect(plan.threads).toEqual([]);
    expect(plan.report.threads.skippedByNode).toBe(1);
  });

  it("throws UnknownTargetError naming the node for a target that does not exist", () => {
    const run = (map: NodeMapFile) => () => planImport(snap([GENERAL], [], []), dbState(), map);
    expect(run({ nodes: { "12": { scope: "site", key: "nope" } } })).toThrow(UnknownTargetError);
    expect(run({ nodes: { "12": { scope: "site", key: "nope" } } })).toThrow(
      /12 "General Discussion"/
    );
    expect(run({ nodes: { "12": { scope: "realm", realm: "nowhere", key: "hub" } } })).toThrow(
      UnknownTargetError
    );
    expect(run({ nodes: { "12": { scope: "realm", realm: "urcea", key: "hub" } } })).toThrow(
      UnknownTargetError
    );
  });

  it("resolves realm targets through the resolved realm id (IxWorld by either slug)", () => {
    for (const realm of ["ixworld", "default"]) {
      const plan = planImport(snap([GENERAL], [thread(1, 12)], [post(10, 1, 0)]), dbState(), {
        nodes: { "12": { scope: "realm", realm, key: "hub" } },
      });
      expect(plan.threads[0]!.categoryRef).toEqual({ kind: "existing", id: "rc-default-hub" });
    }
  });

  it("creates one archive category per archived node, even with no threads", () => {
    const plan = planImport(
      snap(
        [node(20, "Old RP"), node(21, "Older RP")],
        [thread(1, 20), thread(2, 20)],
        [post(10, 1, 0), post(20, 2, 0)]
      ),
      dbState(),
      null
    );
    expect(plan.categories.map((c) => c.key)).toEqual(["xf-20", "xf-21"]);
    expect(plan.threads.map((t) => t.categoryRef)).toEqual([
      { kind: "archive", key: "xf-20" },
      { kind: "archive", key: "xf-20" },
    ]);
  });

  it("skips deleted threads and hides moderated ones", () => {
    const plan = planImport(
      snap(
        [GENERAL],
        [
          thread(1, 12, { discussion_state: "deleted" }),
          thread(2, 12, { discussion_state: "moderated" }),
        ],
        [post(10, 1, 0), post(20, 2, 0)]
      ),
      dbState(),
      null
    );
    expect(plan.threads.map((t) => [t.xenforoThreadId, t.hidden])).toEqual([[2, true]]);
    expect(plan.report.threads).toMatchObject({ deleted: 1, moderated: 1 });
  });

  it("hides a thread whose first post is moderated and keeps that post visible", () => {
    const plan = planImport(
      snap(
        [GENERAL],
        [thread(1, 12)],
        [
          post(10, 1, 0, { message_state: "moderated" }),
          post(11, 1, 1, { message_state: "moderated" }),
        ]
      ),
      dbState(),
      null
    );
    expect(plan.threads[0]!.hidden).toBe(true);
    expect(plan.threads[0]!.posts.map((p) => p.hidden)).toEqual([false, true]);
  });

  it("skips a thread whose first post is deleted, and one with no posts", () => {
    const plan = planImport(
      snap(
        [GENERAL],
        [thread(1, 12), thread(2, 12)],
        [post(10, 1, 0, { message_state: "deleted" }), post(11, 1, 1)]
      ),
      dbState(),
      null
    );
    expect(plan.threads).toEqual([]);
    expect(plan.report.threads).toMatchObject({ firstPostDeleted: 1, noPosts: 1 });
  });

  it("trims titles to 200 characters and names an empty one (untitled)", () => {
    const plan = planImport(
      snap(
        [GENERAL],
        [thread(1, 12, { title: `  ${"x".repeat(250)}  ` }), thread(2, 12, { title: "   " })],
        [post(10, 1, 0), post(20, 2, 0)]
      ),
      dbState(),
      null
    );
    expect(plan.threads.map((t) => t.title)).toEqual(["x".repeat(200), "(untitled)"]);
  });

  it("caps the position offset at 999 ms and falls back to last_post_date with no visible post", () => {
    const plan = planImport(
      snap(
        [GENERAL],
        [thread(1, 12)],
        [
          post(10, 1, 0, { message_state: "moderated", post_date: 1700000000 }),
          post(11, 1, 1500, { post_date: 1700000000 }),
        ]
      ),
      dbState({ existingThreads: new Map([[1, "t1"]]), existingPosts: new Set([10]) }),
      null
    );
    const [t] = plan.threads;
    expect(t!.posts[0]!.createdAt).toEqual(new Date(1700000000999));
    expect(t!.lastPostAt).toEqual(new Date(1700000000999));

    const hiddenOnly = planImport(
      snap(
        [GENERAL],
        [thread(1, 12)],
        [post(10, 1, 0), post(11, 1, 1, { message_state: "moderated" })]
      ),
      dbState({ existingThreads: new Map([[1, "t1"]]), existingPosts: new Set([10]) }),
      null
    );
    expect(hiddenOnly.threads[0]!.lastPostAt).toEqual(new Date(1700009000000));
  });

  it("attributes thread and posts through the database map only, guests unattributed", () => {
    const plan = planImport(
      snap(
        [GENERAL],
        [thread(1, 12, { user_id: 0, username: "" })],
        [
          post(10, 1, 0, { user_id: 0, username: "" }),
          post(11, 1, 1, { user_id: 9, username: "u-admin" }),
        ]
      ),
      dbState(),
      null
    );
    const [t] = plan.threads;
    expect(t).toMatchObject({
      authorUserId: null,
      importedAuthorName: "Guest",
      xenforoUserId: null,
    });
    expect(t!.posts.map((p) => [p.authorUserId, p.xenforoUserId])).toEqual([
      [null, null],
      [null, 9],
    ]);
  });

  it("reports duplicate forum links", () => {
    const plan = planImport(
      snap([], [], []),
      dbState({
        users: [
          { id: "b", forumUserId: 7, createdAt: new Date("2025-01-02") },
          { id: "a", forumUserId: 7, createdAt: new Date("2025-01-01") },
        ],
      }),
      null
    );
    expect(plan.report.authors.duplicates).toEqual([{ forumUserId: 7, userIds: ["a", "b"] }]);
  });

  it("keeps the 20 busiest unmatched authors", () => {
    const posts = Array.from({ length: 25 }, (_, i) =>
      post(100 + i, 1, i, { user_id: 1000 + i, username: `p${i}` })
    );
    const plan = planImport(snap([GENERAL], [thread(1, 12)], posts), dbState(), null);
    expect(plan.report.authors.topUnmatched).toHaveLength(20);
    expect(plan.report.authors.unmatchedUsers).toBe(25);
  });

  it("warns about staff-like titles left public, including heuristic and map targets", () => {
    const plan = planImport(
      snap([node(30, "Admin lounge"), node(31, "Internal"), node(32, "Mod chat")], [], []),
      dbState(),
      { nodes: { "31": { scope: "site", key: "general" }, "32": { scope: "site", key: "staff" } } }
    );
    expect(plan.report.warnings).toHaveLength(2);
    expect(plan.report.warnings.join("\n")).toMatch(/30 "Admin lounge"[\s\S]*31 "Internal"/);
  });
});

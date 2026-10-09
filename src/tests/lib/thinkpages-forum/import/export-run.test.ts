/** @jest-environment node */
import { runExport, type ExportRunOptions } from "~/lib/thinkpages-forum/import/export-run";
import {
  isComplete,
  openSnapshotWriter,
  readSnapshot,
} from "~/lib/thinkpages-forum/import/snapshot";
import {
  XenForoExportError,
  type XenForoClient,
} from "~/lib/thinkpages-forum/import/xenforo-client";
import type {
  XfNode,
  XfPost,
  XfThread,
  XfUserLite,
} from "~/lib/thinkpages-forum/import/xenforo-types";
import { createMemorySnapshotFs, type MemorySnapshotFs } from "../../../helpers/memory-snapshot-fs";

const DIR = "/snap/run";

const node = (node_id: number, node_type_id = "Forum"): XfNode => ({
  node_id,
  title: `Node ${node_id}`,
  description: "",
  node_type_id,
  parent_node_id: 0,
  display_order: node_id,
});

const thread = (thread_id: number, node_id: number, user_id: number): XfThread => ({
  thread_id,
  node_id,
  title: `T${thread_id}`,
  user_id,
  username: `u${user_id}`,
  post_date: thread_id,
  last_post_date: thread_id,
  reply_count: 0,
  view_count: 0,
  first_post_id: thread_id * 10,
  discussion_open: true,
  sticky: false,
  discussion_state: "visible",
  prefix_id: 0,
});

const post = (thread_id: number, user_id: number, attachmentIds: number[] = []): XfPost => ({
  post_id: thread_id * 10,
  thread_id,
  user_id,
  username: `u${user_id}`,
  post_date: thread_id,
  message: "hello",
  message_state: "visible",
  position: 0,
  attach_count: attachmentIds.length,
  is_first_post: true,
  ...(attachmentIds.length && {
    Attachments: attachmentIds.map((attachment_id) => ({
      attachment_id,
      filename: `${attachment_id}.png`,
      file_size: attachment_id === 57 ? 99_000_000 : 3,
      content_type: "image/png",
    })),
  }),
});

const NODES = [node(1, "Category"), node(12), node(13)];
const THREADS: Record<number, XfThread[]> = {
  12: [thread(100, 12, 7), thread(101, 12, 0)],
  13: [thread(102, 13, 8)],
};
const POSTS: Record<number, XfPost[]> = {
  100: [post(100, 7, [55, 56, 57])],
  101: [post(101, 0)],
  102: [post(102, 9)],
};

interface FakeClient extends XenForoClient {
  calls: string[];
}

function fakeClient(usersForbidden = false): FakeClient {
  const calls: string[] = [];
  async function* list<T>(items: T[]): AsyncGenerator<T> {
    for (const item of items) yield item;
  }
  return {
    calls,
    index: async () => ({ scopes: ["thread:read"], superUser: false }),
    nodes: async () => {
      calls.push("nodes");
      return NODES;
    },
    threadsOf: (nodeId) => {
      calls.push(`threads ${nodeId}`);
      return list(THREADS[nodeId] ?? []);
    },
    postsOf: (threadId) => {
      calls.push(`posts ${threadId}`);
      return list(POSTS[threadId] ?? []);
    },
    user: async (userId): Promise<XfUserLite | null> => {
      calls.push(`user ${userId}`);
      if (usersForbidden) throw new XenForoExportError("HTTP 403", 403, `/users/${userId}/`);
      if (userId === 9) return null;
      return {
        user_id: userId,
        username: `u${userId}`,
        register_date: 1,
        is_staff: false,
        message_count: 1,
      };
    },
    attachmentData: async (id) => {
      calls.push(`attachment ${id}`);
      return id === 56 ? null : { bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" };
    },
    stats: () => ({ requests: 0, retries: 0, waitedMs: 0 }),
  };
}

let fs: MemorySnapshotFs;

async function run(client: XenForoClient, overrides: Partial<ExportRunOptions> = {}) {
  const writer = await openSnapshotWriter(fs, DIR);
  return runExport({
    client,
    writer,
    readBack: () => readSnapshot(fs, DIR),
    apiUrl: "https://forum.example.test/api",
    nodeFilter: null,
    attachments: true,
    maxAttachmentBytes: 25 * 1024 * 1024,
    log: () => undefined,
    shouldStop: () => false,
    now: () => new Date("2026-10-09T00:00:00Z"),
    ...overrides,
  });
}

beforeEach(() => {
  fs = createMemorySnapshotFs();
});

describe("runExport", () => {
  it("exports every phase into a complete snapshot", async () => {
    const client = fakeClient();
    const totals = await run(client);

    expect(totals).toEqual({
      stopped: false,
      threads: 3,
      posts: 3,
      users: 3,
      usersForbidden: false,
      attachments: { ok: 1, missing: 1, oversize: 1, skipped: 0 },
    });
    expect(client.calls).not.toContain("user 0");
    expect(client.calls).not.toContain("attachment 57");
    const snapshot = await readSnapshot(fs, DIR);
    expect(isComplete(snapshot).complete).toBe(true);
    expect(snapshot.meta).toMatchObject({
      scopes: ["thread:read"],
      superUser: false,
      nodeFilter: null,
    });
    expect(JSON.stringify(snapshot.meta)).not.toMatch(/key/i);
    expect([...snapshot.users.keys()].sort()).toEqual([7, 8]);
    expect(fs.files.get(snapshot.attachmentPath(55))).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("resumes after a stop without fetching finished work again", async () => {
    const first = fakeClient();
    let postsFetched = 0;
    const totals = await run(first, {
      shouldStop: () => postsFetched >= 1,
      client: {
        ...first,
        postsOf: (threadId) => {
          postsFetched += 1;
          return first.postsOf(threadId);
        },
      },
    });
    expect(totals.stopped).toBe(true);
    expect(isComplete(await readSnapshot(fs, DIR))).toMatchObject({
      complete: false,
      threadsWithoutPosts: [101, 102],
    });

    const second = fakeClient();
    await run(second);
    expect(second.calls).not.toContain("nodes");
    expect(second.calls.filter((c) => c.startsWith("threads"))).toEqual([]);
    expect(second.calls.filter((c) => c.startsWith("posts"))).toEqual(["posts 101", "posts 102"]);
    expect(isComplete(await readSnapshot(fs, DIR)).complete).toBe(true);
  });

  it("limits threads to the node filter", async () => {
    const client = fakeClient();
    await run(client, { nodeFilter: [13] });
    expect(client.calls.filter((c) => c.startsWith("threads"))).toEqual(["threads 13"]);
    expect(isComplete(await readSnapshot(fs, DIR)).complete).toBe(true);
  });

  it("records attachments as skipped without downloading, and a later run fetches them", async () => {
    const first = fakeClient();
    const totals = await run(first, { attachments: false });
    expect(totals.attachments).toEqual({ ok: 0, missing: 0, oversize: 0, skipped: 3 });
    expect(first.calls.some((c) => c.startsWith("attachment"))).toBe(false);

    const second = fakeClient();
    await run(second);
    expect(second.calls.filter((c) => c.startsWith("attachment"))).toEqual([
      "attachment 55",
      "attachment 56",
    ]);
    expect((await readSnapshot(fs, DIR)).attachments.get(55)?.stored).toBe("ok");
  });

  it("skips the users phase when the key may not read users, and the snapshot says users are missing", async () => {
    const totals = await run(fakeClient(true));
    expect(totals.usersForbidden).toBe(true);
    expect(isComplete(await readSnapshot(fs, DIR))).toMatchObject({
      complete: false,
      usersMissing: [7, 8, 9],
    });
  });
});

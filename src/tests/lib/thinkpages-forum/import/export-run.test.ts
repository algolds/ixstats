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
  XfAttachment,
  XfNode,
  XfPost,
  XfThread,
  XfUserLite,
} from "~/lib/thinkpages-forum/import/xenforo-types";
import { createMemorySnapshotFs, type MemorySnapshotFs } from "../../../helpers/memory-snapshot-fs";

const DIR = "/snap/run";

const node = (node_id: number, node_type_id = "Forum", discussion_count?: number): XfNode => ({
  node_id,
  title: `Node ${node_id}`,
  description: "",
  node_type_id,
  parent_node_id: 0,
  display_order: node_id,
  ...(discussion_count !== undefined && { type_data: { discussion_count } }),
});

const thread = (
  thread_id: number,
  node_id: number,
  user_id: number,
  discussion_type?: string
): XfThread => ({
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
  ...(discussion_type && { discussion_type }),
  prefix_id: 0,
});

/** 57 is over the size limit by its metadata; the others are 3 bytes; content_type is XenForo's "post". */
const attachment = (attachment_id: number, filename = `${attachment_id}.png`): XfAttachment => ({
  attachment_id,
  filename,
  file_size: attachment_id === 57 ? 99_000_000 : 3,
  content_type: "post",
});

const post = (thread_id: number, user_id: number, attachments: XfAttachment[] = []): XfPost => ({
  post_id: thread_id * 10,
  thread_id,
  user_id,
  username: `u${user_id}`,
  post_date: thread_id,
  message: "hello",
  message_state: "visible",
  position: 0,
  attach_count: attachments.length,
  is_first_post: true,
  ...(attachments.length && { Attachments: attachments }),
});

const NODES = [node(1, "Category"), node(12, "Forum", 4), node(13)];
const THREADS: Record<number, XfThread[]> = {
  12: [thread(100, 12, 7), thread(101, 12, 0), thread(104, 12, 7, "redirect")],
  13: [thread(102, 13, 8), thread(103, 13, 8)],
};
const POST_100_ATTACHMENTS = [55, 56, 57, 58, 59].map((id) => attachment(id));
const POSTS: Record<number, XfPost[]> = {
  100: [post(100, 7, [...POST_100_ATTACHMENTS, attachment(60, "60.GIF")])],
  101: [post(101, 0)],
  102: [post(102, 9)],
};

type AttachmentAnswer = { bytes: Uint8Array; contentType: string } | null | "forbidden";

const ATTACHMENTS: Record<number, AttachmentAnswer> = {
  55: { bytes: new Uint8Array([1, 2, 3]), contentType: "Image/PNG; charset=binary" },
  56: null,
  58: "forbidden",
  59: { bytes: new Uint8Array([1, 2]), contentType: "image/png" },
  60: { bytes: new Uint8Array([1, 2, 3]), contentType: "" },
};

interface FakeClient extends XenForoClient {
  calls: string[];
}

async function* list<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

async function* gone(threadId: number): AsyncGenerator<XfPost> {
  yield* list<XfPost>([]);
  throw new XenForoExportError("HTTP 404", 404, `/threads/${threadId}/posts`);
}

function fakeClient(answers: Record<number, AttachmentAnswer> = ATTACHMENTS): FakeClient {
  const calls: string[] = [];
  return {
    calls,
    index: async () => ({ scopes: ["thread:read"], superUser: true, keyType: "super" }),
    context: () => ({ keyType: "super", bypassPermissions: true }),
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
      return threadId === 103 ? gone(threadId) : list(POSTS[threadId] ?? []);
    },
    user: async (userId): Promise<XfUserLite | null> => {
      calls.push(`user ${userId}`);
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
      const answer = answers[id] ?? null;
      if (answer === "forbidden") {
        throw new XenForoExportError("HTTP 403", 403, `/attachments/${id}/data`);
      }
      return answer;
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

const callsOf = (client: FakeClient, kind: string) =>
  client.calls.filter((c) => c.startsWith(kind));

beforeEach(() => {
  fs = createMemorySnapshotFs();
});

describe("runExport", () => {
  it("exports every phase into a complete snapshot, recording the request context", async () => {
    const client = fakeClient();
    const totals = await run(client);

    expect(totals).toEqual({
      stopped: false,
      threads: 5,
      posts: 3,
      users: 3,
      usersUnavailable: 1,
      threadsGone: 1,
      threadsRedirect: 1,
      attachments: { ok: 2, missing: 1, forbidden: 1, oversize: 1, skipped: 0, size_mismatch: 1 },
      failed: [],
    });
    expect(client.calls).not.toContain("user 0");
    expect(client.calls).not.toContain("posts 104");
    expect(client.calls).not.toContain("attachment 57");
    const snapshot = await readSnapshot(fs, DIR);
    expect(isComplete(snapshot)).toMatchObject({
      complete: true,
      threadsRedirect: [104],
      threadsGone: [103],
      usersMissing: [],
      attachmentsUnavailable: [56, 58],
      attachmentsSizeMismatch: [59],
    });
    expect(snapshot.meta).toMatchObject({
      scopes: ["thread:read"],
      superUser: true,
      keyType: "super",
      bypassPermissions: true,
      clientVersion: "1.0",
      nodeFilter: null,
    });
    expect([...snapshot.users.keys()].sort()).toEqual([7, 8]);
    expect(fs.files.get(snapshot.attachmentPath(55))).toEqual(new Uint8Array([1, 2, 3]));
    expect(snapshot.state.forumCounts?.get(12)).toEqual({ listed: 3, discussionCount: 4 });
    expect(snapshot.state.forumCounts?.get(13)).toEqual({ listed: 2, discussionCount: null });
  });

  it('stores MIME types: the download\'s without parameters, else the file extension, never "post"', async () => {
    await run(fakeClient());
    const { attachments } = await readSnapshot(fs, DIR);

    expect(attachments.get(55)?.content_type).toBe("image/png");
    expect(attachments.get(60)?.content_type).toBe("image/gif");
    expect(attachments.get(56)?.content_type).toBe("image/png");
    expect(attachments.get(57)).toMatchObject({ stored: "oversize", content_type: "image/png" });
    expect(attachments.get(59)).toMatchObject({
      stored: "size_mismatch",
      file_size: 3,
      received_size: 2,
    });
  });

  it("fetches a size-mismatched attachment again only when asked to (--retry-mismatch, I2)", async () => {
    await run(fakeClient());
    const fixed = { bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" };
    const plain = fakeClient({ ...ATTACHMENTS, 59: fixed });
    await run(plain);
    expect(callsOf(plain, "attachment")).toEqual([]);
    expect((await readSnapshot(fs, DIR)).attachments.get(59)?.stored).toBe("size_mismatch");

    const retry = fakeClient({ ...ATTACHMENTS, 59: fixed });
    await run(retry, { retryMismatch: true });
    expect(callsOf(retry, "attachment")).toEqual(["attachment 59"]);
    expect((await readSnapshot(fs, DIR)).attachments.get(59)?.stored).toBe("ok");
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
      threadsWithoutPosts: [101, 102, 103],
    });

    const second = fakeClient();
    await run(second);
    expect(second.calls).not.toContain("nodes");
    expect(callsOf(second, "threads")).toEqual([]);
    expect(callsOf(second, "posts")).toEqual(["posts 101", "posts 102", "posts 103"]);
    expect(isComplete(await readSnapshot(fs, DIR)).complete).toBe(true);
  });

  it("does not fetch a gone thread again", async () => {
    await run(fakeClient());
    const second = fakeClient();
    await run(second);
    expect(callsOf(second, "posts")).toEqual([]);
  });

  it("limits threads to the node filter", async () => {
    const client = fakeClient();
    await run(client, { nodeFilter: [13] });
    expect(callsOf(client, "threads")).toEqual(["threads 13"]);
    expect(isComplete(await readSnapshot(fs, DIR)).complete).toBe(true);
  });

  it("refuses a rerun with a different node filter unless told to reset it", async () => {
    await run(fakeClient(), { nodeFilter: [13] });

    const refused = fakeClient();
    await expect(run(refused, { nodeFilter: [12] })).rejects.toThrow(/--reset-filter/);
    await expect(run(fakeClient(), { nodeFilter: null })).rejects.toThrow(
      /started with --nodes 13/
    );
    expect(refused.calls).toEqual([]);
    expect((await readSnapshot(fs, DIR)).meta.nodeFilter).toEqual([13]);

    await run(fakeClient(), { nodeFilter: [13] });
    const reset = fakeClient();
    await run(reset, { nodeFilter: [12, 13], resetFilter: true });
    expect(callsOf(reset, "threads")).toEqual(["threads 12"]);
    expect((await readSnapshot(fs, DIR)).meta.nodeFilter).toEqual([12, 13]);
  });

  it("records attachments as skipped without downloading, and a later run fetches them", async () => {
    const first = fakeClient();
    const totals = await run(first, { attachments: false });
    expect(totals.attachments.skipped).toBe(6);
    expect(callsOf(first, "attachment")).toEqual([]);

    const second = fakeClient();
    await run(second);
    expect(callsOf(second, "attachment")).toEqual([
      "attachment 55",
      "attachment 56",
      "attachment 58",
      "attachment 59",
      "attachment 60",
    ]);
    expect((await readSnapshot(fs, DIR)).attachments.get(55)?.stored).toBe("ok");
  });

  it("counts unreadable users without blocking the snapshot", async () => {
    const unreadable: FakeClient = { ...fakeClient(), user: async () => null };
    const totals = await run(unreadable);

    expect(totals).toMatchObject({ users: 3, usersUnavailable: 3 });
    const snapshot = await readSnapshot(fs, DIR);
    expect(snapshot.users.size).toBe(0);
    expect(isComplete(snapshot).complete).toBe(true);
  });

  describe("an item that keeps failing (I3)", () => {
    const serverError = (endpoint: string) => new XenForoExportError("HTTP 503", 503, endpoint);
    async function* failing(endpoint: string): AsyncGenerator<never> {
      yield* list<never>([]);
      throw serverError(endpoint);
    }
    /** Thread 101's posts answer 503 after the client's retries. */
    const brokenThread = (): FakeClient => {
      const client = fakeClient();
      return {
        ...client,
        postsOf: (threadId) =>
          threadId === 101 ? failing(`/threads/${threadId}/posts`) : client.postsOf(threadId),
      };
    };

    it("never stops the export: it is listed and left for a rerun, which fetches it", async () => {
      const log = jest.fn();
      const totals = await run(brokenThread(), { log });
      expect(totals.failed).toEqual(["thread 101 posts"]);
      expect(totals.posts).toBe(2);
      expect(log).toHaveBeenCalledWith("thread 101 posts: HTTP 503; left for a rerun");
      expect(isComplete(await readSnapshot(fs, DIR))).toMatchObject({
        complete: false,
        threadsWithoutPosts: [101],
      });

      const healthy = fakeClient();
      await run(healthy);
      expect(callsOf(healthy, "posts")).toEqual(["posts 101"]);
      expect(isComplete(await readSnapshot(fs, DIR)).complete).toBe(true);
    });

    it("with skipFailing (--skip-failing) is recorded as unavailable, so the snapshot completes", async () => {
      const totals = await run(brokenThread(), { skipFailing: true });
      expect(totals.failed).toEqual(["thread 101 posts"]);
      const snapshot = await readSnapshot(fs, DIR);
      expect(isComplete(snapshot)).toMatchObject({ complete: true, threadsGone: [101, 103] });
    });

    it("a forum whose thread list fails, 403 and 404 included, does not stop the later forums", async () => {
      const client = fakeClient();
      const forbidden: FakeClient = {
        ...client,
        threadsOf: (nodeId) =>
          nodeId === 12
            ? (async function* () {
                yield* list<XfThread>([]);
                throw new XenForoExportError("HTTP 403", 403, "/forums/12/threads");
              })()
            : client.threadsOf(nodeId),
      };
      const totals = await run(forbidden);
      expect(totals.failed).toEqual(["forum 12 threads"]);
      expect(callsOf(client, "threads")).toEqual(["threads 13"]);
      expect(isComplete(await readSnapshot(fs, DIR))).toMatchObject({
        complete: false,
        forumsWithoutThreads: [12],
      });

      await run(forbidden, { skipFailing: true });
      expect(isComplete(await readSnapshot(fs, DIR)).forumsWithoutThreads).toEqual([]);
    });

    it("users and attachments are skipped the same way", async () => {
      const client = fakeClient();
      const broken: FakeClient = {
        ...client,
        user: async (userId) => {
          if (userId === 8) throw serverError(`/users/${userId}`);
          return client.user(userId);
        },
        attachmentData: async (id) => {
          if (id === 55) throw serverError(`/attachments/${id}/data`);
          return client.attachmentData(id);
        },
      };
      const totals = await run(broken, { skipFailing: true });
      expect(totals.failed).toEqual(["user 8", "attachment 55"]);
      const snapshot = await readSnapshot(fs, DIR);
      expect(snapshot.attachments.get(55)?.stored).toBe("missing");
      expect(isComplete(snapshot).complete).toBe(true);
    });

    it("still stops on what is not one item's failure: a refused key", async () => {
      const client = fakeClient();
      const refused: FakeClient = {
        ...client,
        user: async () => {
          throw new XenForoExportError("HTTP 401", 401, "/users/7");
        },
      };
      await expect(run(refused)).rejects.toThrow("HTTP 401");
    });

    it("stops after five failures in a row: the forum is likely down", async () => {
      const client = fakeClient();
      // Users 7, 8 and 9, then attachments 55 and 56: the fifth failure in a row stops the export.
      const down: FakeClient = {
        ...client,
        user: async (userId) => {
          throw serverError(`/users/${userId}`);
        },
        attachmentData: async (id) => {
          client.calls.push(`attachment ${id}`);
          throw serverError(`/attachments/${id}/data`);
        },
      };
      await expect(run(down)).rejects.toThrow("HTTP 503");
      expect(callsOf(client, "attachment")).toEqual(["attachment 55", "attachment 56"]);
    });
  });
});

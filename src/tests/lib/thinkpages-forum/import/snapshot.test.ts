/** @jest-environment node */
import {
  isComplete,
  MAX_JSONL_BYTES,
  openSnapshotWriter,
  readSnapshot,
  type AttachmentEntry,
  type SnapshotMeta,
} from "~/lib/thinkpages-forum/import/snapshot";
import type { XfNode, XfPost, XfThread } from "~/lib/thinkpages-forum/import/xenforo-types";
import { createMemorySnapshotFs, type MemorySnapshotFs } from "../../../helpers/memory-snapshot-fs";

const DIR = "/snap/run1";

const META: SnapshotMeta = {
  exportedAt: "2026-10-09T00:00:00.000Z",
  apiUrl: "https://forum.example.test/api",
  scopes: ["thread:read"],
  superUser: true,
  nodeFilter: null,
  version: 1,
};

const node = (node_id: number, node_type_id = "Forum"): XfNode => ({
  node_id,
  title: `Node ${node_id}`,
  description: "",
  node_type_id,
  parent_node_id: 0,
  display_order: node_id,
});

const thread = (thread_id: number, node_id = 12, user_id = 7): XfThread => ({
  thread_id,
  node_id,
  title: `Thread ${thread_id}`,
  user_id,
  username: `u${user_id}`,
  post_date: 1700000000 + thread_id,
  last_post_date: 1700000000 + thread_id,
  reply_count: 0,
  view_count: 0,
  first_post_id: thread_id * 10,
  discussion_open: true,
  sticky: false,
  discussion_state: "visible",
  prefix_id: 0,
});

const post = (post_id: number, thread_id: number, position: number, message = "hi"): XfPost => ({
  post_id,
  thread_id,
  user_id: 7,
  username: "u7",
  post_date: 1700000000 + post_id,
  message,
  message_state: "visible",
  position,
  attach_count: 0,
  is_first_post: position === 0,
});

const entry = (
  attachment_id: number,
  post_id: number,
  stored: AttachmentEntry["stored"]
): AttachmentEntry => ({
  attachment_id,
  post_id,
  filename: `${attachment_id}.png`,
  content_type: "image/png",
  file_size: 4,
  stored,
});

let fs: MemorySnapshotFs;

beforeEach(() => {
  fs = createMemorySnapshotFs();
});

describe("openSnapshotWriter", () => {
  it("appends lines and writes state.json only through a temp file and a rename", async () => {
    const writer = await openSnapshotWriter(fs, DIR);
    await writer.writeMeta(META);
    await writer.writeNodes([node(12)]);
    await writer.appendThreads([thread(100), thread(101)]);
    await writer.markThreadsDone(12);
    await writer.appendPosts([post(1000, 100, 0)]);
    await writer.markPostsDone(100);

    expect(fs.text(`${DIR}/threads.jsonl`).trim().split("\n")).toHaveLength(2);
    const stateOps = fs.ops.filter((op) => op.includes("state.json"));
    expect(stateOps.length).toBeGreaterThan(0);
    expect(stateOps.every((op) => !op.startsWith("writeFile") || op.endsWith(".tmp"))).toBe(true);
    expect(stateOps.at(-1)).toBe(`rename ${DIR}/state.json.tmp ${DIR}/state.json`);
    const lastPostAppend = fs.ops.lastIndexOf(`appendFile ${DIR}/posts.jsonl`);
    expect(
      fs.ops.indexOf(`rename ${DIR}/state.json.tmp ${DIR}/state.json`, lastPostAppend)
    ).toBeGreaterThan(lastPostAppend);
    expect(JSON.parse(fs.text(`${DIR}/state.json`))).toEqual({
      nodesDone: true,
      threadsDone: [12],
      postsDone: [100],
      usersDone: [],
      attachmentsDone: [],
      threadsGone: [],
      forumCounts: {},
    });
  });

  it("resumes on a second open: work already done is reported", async () => {
    const first = await openSnapshotWriter(fs, DIR);
    await first.writeMeta(META);
    await first.writeNodes([node(12), node(13)]);
    await first.appendThreads([thread(100)]);
    await first.markThreadsDone(12);
    await first.appendPosts([post(1000, 100, 0)]);
    await first.markPostsDone(100);
    await first.addUser(7, {
      user_id: 7,
      username: "u7",
      register_date: 1,
      is_staff: false,
      message_count: 2,
    });
    await first.addUser(9, null);
    await first.addAttachment(entry(55, 1000, "ok"), new Uint8Array([1, 2, 3, 4]));
    await first.checkpoint();

    const second = await openSnapshotWriter(fs, DIR);
    expect(second.meta).toEqual(META);
    expect(second.state.nodesDone).toBe(true);
    expect([...second.state.threadsDone]).toEqual([12]);
    expect([...second.state.postsDone]).toEqual([100]);
    expect([...second.state.usersDone].sort()).toEqual([7, 9]);
    expect([...second.state.attachmentsDone]).toEqual([55]);

    await second.addUser(8, {
      user_id: 8,
      username: "u8",
      register_date: 1,
      is_staff: false,
      message_count: 1,
    });
    await second.checkpoint();
    const snapshot = await readSnapshot(fs, DIR);
    expect([...snapshot.users.keys()].sort()).toEqual([7, 8]);
    expect(snapshot.attachments.get(55)?.stored).toBe("ok");
    expect(fs.files.get(snapshot.attachmentPath(55))).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("starts a fresh line after a torn last line, so the next append is not glued to it", async () => {
    const first = await openSnapshotWriter(fs, DIR);
    await first.writeMeta(META);
    await first.writeNodes([node(12)]);
    fs.files.set(`${DIR}/posts.jsonl`, `${JSON.stringify(post(1000, 100, 0))}\n{"post_id":10`);

    const second = await openSnapshotWriter(fs, DIR);
    await second.appendPosts([post(1001, 100, 1)]);

    const snapshot = await readSnapshot(fs, DIR);
    expect(snapshot.postsByThread.get(100)?.map((p) => p.post_id)).toEqual([1000, 1001]);
    expect(snapshot.skippedLines).toBe(1);
  });

  it("writes meta.json as given", async () => {
    const writer = await openSnapshotWriter(fs, DIR);
    await writer.writeMeta(META);
    expect(JSON.parse(fs.text(`${DIR}/meta.json`))).toEqual(META);
  });
});

describe("readSnapshot", () => {
  it("dedupes duplicate threads and posts (last wins) and groups posts by thread in position order", async () => {
    const writer = await openSnapshotWriter(fs, DIR);
    await writer.writeMeta(META);
    await writer.writeNodes([node(12)]);
    await writer.appendThreads([thread(100), thread(101), { ...thread(100), title: "Renamed" }]);
    await writer.appendPosts([post(1001, 100, 1, "old"), post(1000, 100, 0), post(1010, 101, 0)]);
    await writer.appendPosts([post(1001, 100, 1, "new")]);

    const snapshot = await readSnapshot(fs, DIR);
    expect(snapshot.threads.map((t) => [t.thread_id, t.title])).toEqual([
      [100, "Renamed"],
      [101, "Thread 101"],
    ]);
    expect(snapshot.postsByThread.get(100)?.map((p) => [p.post_id, p.message])).toEqual([
      [1000, "hi"],
      [1001, "new"],
    ]);
    expect(snapshot.postsByThread.get(101)?.map((p) => p.post_id)).toEqual([1010]);
    expect(snapshot.meta).toEqual(META);
    expect(snapshot.attachmentPath(55)).toBe(`${DIR}/attachments/55.bin`);
  });

  it("refuses a JSON-lines file above the whole-file read limit with a clear error", async () => {
    const writer = await openSnapshotWriter(fs, DIR);
    await writer.writeMeta(META);
    await writer.appendPosts([post(1000, 100, 0)]);
    const big: MemorySnapshotFs = { ...fs, stat: async () => ({ size: MAX_JSONL_BYTES + 1 }) };
    await expect(readSnapshot(big, DIR)).rejects.toThrow(/needs a line reader/);
  });

  it("refuses a directory that is not a snapshot", async () => {
    await expect(readSnapshot(fs, "/elsewhere")).rejects.toThrow(/meta\.json/);
  });
});

describe("isComplete", () => {
  it("lists what is still missing, and nothing once the export finished", async () => {
    const writer = await openSnapshotWriter(fs, DIR);
    await writer.writeMeta(META);
    await writer.writeNodes([node(1, "Category"), node(12), node(13)]);
    await writer.appendThreads([thread(100), thread(101, 12, 8)]);
    await writer.markThreadsDone(12);
    await writer.appendPosts([
      { ...post(1000, 100, 0), attach_count: 1, Attachments: [entryAsAttachment(55)] },
    ]);
    await writer.markPostsDone(100);
    await writer.checkpoint();

    const gaps = isComplete(await readSnapshot(fs, DIR));
    expect(gaps).toEqual({
      complete: false,
      nodesPending: false,
      forumsWithoutThreads: [13],
      threadsWithoutPosts: [101],
      usersMissing: [7, 8],
      attachmentsMissing: [55],
      threadsRedirect: [],
      threadsGone: [],
      threadsEmpty: [],
      attachmentsUnavailable: [],
      attachmentsSizeMismatch: [],
    });

    await writer.markThreadsDone(13);
    await writer.appendPosts([post(1010, 101, 0)]);
    await writer.markPostsDone(101);
    await writer.addAttachment(entry(55, 1000, "missing"));
    await writer.checkpoint();
    const done = isComplete(await readSnapshot(fs, DIR));
    expect(done.complete).toBe(true);
    expect(done.usersMissing).toEqual([7, 8]);
    expect(done.attachmentsUnavailable).toEqual([55]);
  });

  it("does not wait on redirect threads, gone threads or threads that came back empty", async () => {
    const writer = await openSnapshotWriter(fs, DIR);
    await writer.writeMeta(META);
    await writer.writeNodes([node(12)]);
    await writer.appendThreads([
      thread(100),
      { ...thread(101), discussion_type: "redirect" },
      thread(102),
      thread(103),
    ]);
    await writer.markThreadsDone(12, { listed: 4, discussionCount: 5 });
    await writer.appendPosts([post(1000, 100, 0)]);
    await writer.markPostsDone(100);
    await writer.markThreadGone(102);
    await writer.markPostsDone(103);

    const snapshot = await readSnapshot(fs, DIR);
    expect(isComplete(snapshot)).toMatchObject({
      complete: true,
      threadsWithoutPosts: [],
      threadsRedirect: [101],
      threadsGone: [102],
      threadsEmpty: [103],
    });
    expect(snapshot.state.forumCounts?.get(12)).toEqual({ listed: 4, discussionCount: 5 });
  });

  it("reports forbidden, missing and size-mismatched attachments without blocking", async () => {
    const writer = await openSnapshotWriter(fs, DIR);
    await writer.writeMeta(META);
    await writer.writeNodes([node(12)]);
    await writer.appendThreads([thread(100)]);
    await writer.markThreadsDone(12);
    const attachments = [55, 56, 57].map(entryAsAttachment);
    await writer.appendPosts([
      { ...post(1000, 100, 0), attach_count: 3, Attachments: attachments },
    ]);
    await writer.markPostsDone(100);
    await writer.addAttachment(entry(55, 1000, "forbidden"));
    await writer.addAttachment(entry(56, 1000, "missing"));
    await writer.addAttachment(
      { ...entry(57, 1000, "size_mismatch"), received_size: 3 },
      new Uint8Array(3)
    );

    expect(isComplete(await readSnapshot(fs, DIR))).toMatchObject({
      complete: true,
      attachmentsMissing: [],
      attachmentsUnavailable: [55, 56],
      attachmentsSizeMismatch: [57],
    });
  });

  it("reads a state.json written before threadsGone and forumCounts existed", async () => {
    const writer = await openSnapshotWriter(fs, DIR);
    await writer.writeMeta(META);
    fs.files.set(
      `${DIR}/state.json`,
      JSON.stringify({
        nodesDone: true,
        threadsDone: [],
        postsDone: [],
        usersDone: [],
        attachmentsDone: [],
      })
    );
    const snapshot = await readSnapshot(fs, DIR);
    expect(snapshot.state.threadsGone?.size).toBe(0);
    expect(isComplete(snapshot).threadsGone).toEqual([]);
  });

  it("only expects the forums named in the node filter", async () => {
    const writer = await openSnapshotWriter(fs, DIR);
    await writer.writeMeta({ ...META, nodeFilter: [12] });
    await writer.writeNodes([node(12), node(13)]);
    await writer.markThreadsDone(12);

    expect(isComplete(await readSnapshot(fs, DIR))).toMatchObject({
      complete: true,
      forumsWithoutThreads: [],
    });
  });

  it("reports pending nodes for a fresh snapshot", async () => {
    const writer = await openSnapshotWriter(fs, DIR);
    await writer.writeMeta(META);
    expect(isComplete(await readSnapshot(fs, DIR))).toMatchObject({
      complete: false,
      nodesPending: true,
    });
  });
});

function entryAsAttachment(attachment_id: number) {
  return {
    attachment_id,
    filename: `${attachment_id}.png`,
    file_size: 4,
    content_type: "image/png",
  };
}

/**
 * The on-disk XenForo export snapshot (phase 4). Pure over an injected `fs`: the export writes it, the importer
 * reads only it. Layout of `<dir>`:
 *   meta.json         { exportedAt, apiUrl, scopes, superUser, nodeFilter, version: 1 } (never the API key)
 *   nodes.json        XfNode[]
 *   threads.jsonl     one XfThread per line
 *   posts.jsonl       one XfPost per line (Attachments inline)
 *   users.json        Record<string, XfUserLite>
 *   attachments.json  AttachmentEntry[]
 *   attachments/<attachment_id>.bin
 *   state.json        { nodesDone, threadsDone (node ids), postsDone (thread ids), usersDone, attachmentsDone }
 * Data always lands before the state that claims it, and JSON documents (state, users, attachments) are written
 * to a temp file and renamed into place, so an interrupted export resumes from `state.json`. Lines appended for
 * work that was not yet marked done are fetched again on resume; readers dedupe them, last line wins.
 */
import type { XfNode, XfPost, XfThread, XfUserLite } from "./xenforo-types";

export interface SnapshotFs {
  readFile(file: string): Promise<string>;
  writeFile(file: string, data: string | Uint8Array): Promise<void>;
  appendFile(file: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  /** Creates the directory and its parents; no error when it exists. */
  mkdir(dir: string): Promise<void>;
  exists(file: string): Promise<boolean>;
  stat(file: string): Promise<{ size: number }>;
}

export const SNAPSHOT_VERSION = 1;

export interface SnapshotMeta {
  exportedAt: string;
  apiUrl: string;
  scopes: string[];
  superUser: boolean;
  /** The forum node ids the export was limited to (`--nodes`), or null for every forum. */
  nodeFilter: number[] | null;
  version: typeof SNAPSHOT_VERSION;
}

export type AttachmentStored = "ok" | "missing" | "oversize" | "skipped";

export interface AttachmentEntry {
  attachment_id: number;
  post_id: number;
  filename: string;
  content_type: string;
  file_size: number;
  stored: AttachmentStored;
}

export interface SnapshotStateFile {
  nodesDone: boolean;
  threadsDone: number[];
  postsDone: number[];
  usersDone: number[];
  attachmentsDone: number[];
}

export interface SnapshotProgress {
  nodesDone: boolean;
  /** Forum node ids whose thread list is complete. */
  threadsDone: Set<number>;
  /** Thread ids whose posts are complete. */
  postsDone: Set<number>;
  usersDone: Set<number>;
  attachmentsDone: Set<number>;
}

export interface Snapshot {
  meta: SnapshotMeta;
  state: SnapshotProgress;
  nodes: XfNode[];
  threads: XfThread[];
  postsByThread: Map<number, XfPost[]>;
  users: Map<number, XfUserLite>;
  attachments: Map<number, AttachmentEntry>;
  attachmentPath(id: number): string;
  /** Lines that did not parse (a line torn by an interrupted append). */
  skippedLines: number;
}

export interface SnapshotWriter {
  readonly dir: string;
  readonly state: SnapshotProgress;
  writeMeta(meta: SnapshotMeta): Promise<void>;
  writeNodes(nodes: XfNode[]): Promise<void>;
  appendThreads(threads: XfThread[]): Promise<void>;
  markThreadsDone(nodeId: number): Promise<void>;
  appendPosts(posts: XfPost[]): Promise<void>;
  markPostsDone(threadId: number): Promise<void>;
  /** Buffers the user (null: not found) until the next checkpoint. */
  addUser(userId: number, user: XfUserLite | null): Promise<void>;
  /** Writes the bytes now, buffers the entry until the next checkpoint. */
  addAttachment(entry: AttachmentEntry, bytes?: Uint8Array): Promise<void>;
  /** Writes users.json and attachments.json if they changed, then state.json. */
  checkpoint(): Promise<void>;
}

export interface SnapshotWriterOptions {
  /** Checkpoint after this many marks or additions (default 1: after every one). */
  checkpointEvery?: number;
}

export interface SnapshotGaps {
  complete: boolean;
  nodesPending: boolean;
  forumsWithoutThreads: number[];
  threadsWithoutPosts: number[];
  usersMissing: number[];
  attachmentsMissing: number[];
}

const FORUM_NODE_TYPE = "Forum";

const files = (dir: string) => ({
  meta: `${dir}/meta.json`,
  nodes: `${dir}/nodes.json`,
  threads: `${dir}/threads.jsonl`,
  posts: `${dir}/posts.jsonl`,
  users: `${dir}/users.json`,
  attachments: `${dir}/attachments.json`,
  attachmentDir: `${dir}/attachments`,
  state: `${dir}/state.json`,
});

export const attachmentFile = (dir: string, id: number) => `${files(dir).attachmentDir}/${id}.bin`;

const toLines = (rows: Array<XfThread | XfPost>) =>
  rows.map((row) => `${JSON.stringify(row)}\n`).join("");

async function readJson<T>(fs: SnapshotFs, file: string, fallback: T): Promise<T> {
  if (!(await fs.exists(file))) return fallback;
  const value: T = JSON.parse(await fs.readFile(file));
  return value;
}

async function writeAtomic(fs: SnapshotFs, file: string, value: object): Promise<void> {
  await fs.writeFile(`${file}.tmp`, JSON.stringify(value));
  await fs.rename(`${file}.tmp`, file);
}

const EMPTY_STATE: SnapshotStateFile = {
  nodesDone: false,
  threadsDone: [],
  postsDone: [],
  usersDone: [],
  attachmentsDone: [],
};

async function readProgress(fs: SnapshotFs, dir: string): Promise<SnapshotProgress> {
  const raw = await readJson<SnapshotStateFile>(fs, files(dir).state, EMPTY_STATE);
  return {
    nodesDone: raw.nodesDone,
    threadsDone: new Set(raw.threadsDone),
    postsDone: new Set(raw.postsDone),
    usersDone: new Set(raw.usersDone),
    attachmentsDone: new Set(raw.attachmentsDone),
  };
}

const progressFile = (state: SnapshotProgress): SnapshotStateFile => ({
  nodesDone: state.nodesDone,
  threadsDone: [...state.threadsDone],
  postsDone: [...state.postsDone],
  usersDone: [...state.usersDone],
  attachmentsDone: [...state.attachmentsDone],
});

async function readUsers(fs: SnapshotFs, dir: string): Promise<Map<number, XfUserLite>> {
  const record = await readJson<Record<string, XfUserLite>>(fs, files(dir).users, {});
  return new Map(Object.values(record).map((user) => [user.user_id, user]));
}

async function readAttachments(fs: SnapshotFs, dir: string): Promise<Map<number, AttachmentEntry>> {
  const list = await readJson<AttachmentEntry[]>(fs, files(dir).attachments, []);
  return new Map(list.map((entry) => [entry.attachment_id, entry]));
}

/** A torn last line (interrupted append) must not swallow the next append: start it on a fresh line. */
async function guardTornLine(fs: SnapshotFs, file: string): Promise<void> {
  if ((await fs.exists(file)) && (await fs.stat(file)).size > 0) await fs.appendFile(file, "\n");
}

export async function openSnapshotWriter(
  fs: SnapshotFs,
  dir: string,
  options: SnapshotWriterOptions = {}
): Promise<SnapshotWriter> {
  const paths = files(dir);
  const checkpointEvery = Math.max(1, options.checkpointEvery ?? 1);
  await fs.mkdir(paths.attachmentDir);
  await guardTornLine(fs, paths.threads);
  await guardTornLine(fs, paths.posts);
  const state = await readProgress(fs, dir);
  const users = await readUsers(fs, dir);
  const attachments = await readAttachments(fs, dir);
  let pending = 0;
  let usersDirty = false;
  let attachmentsDirty = false;

  async function checkpoint(): Promise<void> {
    if (usersDirty) await writeAtomic(fs, paths.users, Object.fromEntries(users));
    if (attachmentsDirty) await writeAtomic(fs, paths.attachments, [...attachments.values()]);
    await writeAtomic(fs, paths.state, progressFile(state));
    usersDirty = false;
    attachmentsDirty = false;
    pending = 0;
  }

  async function counted(): Promise<void> {
    pending += 1;
    if (pending >= checkpointEvery) await checkpoint();
  }

  return {
    dir,
    state,
    writeMeta: (meta) => writeAtomic(fs, paths.meta, meta),
    async writeNodes(nodes) {
      await writeAtomic(fs, paths.nodes, nodes);
      state.nodesDone = true;
      await checkpoint();
    },
    async appendThreads(threads) {
      if (threads.length) await fs.appendFile(paths.threads, toLines(threads));
    },
    async markThreadsDone(nodeId) {
      state.threadsDone.add(nodeId);
      await checkpoint();
    },
    async appendPosts(posts) {
      if (posts.length) await fs.appendFile(paths.posts, toLines(posts));
    },
    async markPostsDone(threadId) {
      state.postsDone.add(threadId);
      await counted();
    },
    async addUser(userId, user) {
      if (user) {
        users.set(userId, user);
        usersDirty = true;
      }
      state.usersDone.add(userId);
      await counted();
    },
    async addAttachment(entry, bytes) {
      if (bytes) await fs.writeFile(attachmentFile(dir, entry.attachment_id), bytes);
      attachments.set(entry.attachment_id, entry);
      attachmentsDirty = true;
      state.attachmentsDone.add(entry.attachment_id);
      await counted();
    },
    checkpoint,
  };
}

/** Parses JSON lines, last line per id wins (first-seen order kept); unparsable lines are counted. */
async function readLines<T>(
  fs: SnapshotFs,
  file: string,
  idOf: (row: T) => number
): Promise<{ rows: Map<number, T>; skipped: number }> {
  const rows = new Map<number, T>();
  let skipped = 0;
  if (!(await fs.exists(file))) return { rows, skipped };
  for (const line of (await fs.readFile(file)).split("\n")) {
    if (!line.trim()) continue;
    try {
      const row: T = JSON.parse(line);
      rows.set(idOf(row), row);
    } catch {
      skipped += 1;
    }
  }
  return { rows, skipped };
}

function groupPosts(posts: Iterable<XfPost>): Map<number, XfPost[]> {
  const byThread = new Map<number, XfPost[]>();
  for (const post of posts) {
    const list = byThread.get(post.thread_id) ?? [];
    list.push(post);
    byThread.set(post.thread_id, list);
  }
  for (const list of byThread.values())
    list.sort((a, b) => a.position - b.position || a.post_id - b.post_id);
  return byThread;
}

export async function readSnapshot(fs: SnapshotFs, dir: string): Promise<Snapshot> {
  const paths = files(dir);
  if (!(await fs.exists(paths.meta)))
    throw new Error(`${dir} is not a XenForo export snapshot (no meta.json)`);
  const meta: SnapshotMeta = JSON.parse(await fs.readFile(paths.meta));
  if (meta.version !== SNAPSHOT_VERSION)
    throw new Error(`${dir}: unsupported snapshot version ${meta.version}`);
  const threads = await readLines<XfThread>(fs, paths.threads, (t) => t.thread_id);
  const posts = await readLines<XfPost>(fs, paths.posts, (p) => p.post_id);
  return {
    meta,
    state: await readProgress(fs, dir),
    nodes: await readJson<XfNode[]>(fs, paths.nodes, []),
    threads: [...threads.rows.values()],
    postsByThread: groupPosts(posts.rows.values()),
    users: await readUsers(fs, dir),
    attachments: await readAttachments(fs, dir),
    attachmentPath: (id) => attachmentFile(dir, id),
    skippedLines: threads.skipped + posts.skipped,
  };
}

/** The forum nodes the export covers: every Forum node, or those in the meta's node filter. */
export function exportedForums(nodes: XfNode[], nodeFilter: number[] | null): XfNode[] {
  return nodes.filter(
    (node) =>
      node.node_type_id === FORUM_NODE_TYPE && (!nodeFilter || nodeFilter.includes(node.node_id))
  );
}

/** Distinct author ids (guests, user_id 0, excluded) of every thread and post, ascending. */
export function authorIds(snapshot: Pick<Snapshot, "threads" | "postsByThread">): number[] {
  const ids = new Set<number>(snapshot.threads.map((t) => t.user_id));
  for (const posts of snapshot.postsByThread.values())
    for (const post of posts) ids.add(post.user_id);
  ids.delete(0);
  return [...ids].sort((a, b) => a - b);
}

/** Every attachment of every post, with its post id, in thread and position order. */
export function postAttachments(
  snapshot: Pick<Snapshot, "postsByThread">
): Array<Omit<AttachmentEntry, "stored">> {
  const out: Array<Omit<AttachmentEntry, "stored">> = [];
  for (const posts of snapshot.postsByThread.values()) {
    for (const post of posts) {
      for (const a of post.Attachments ?? []) {
        out.push({
          attachment_id: a.attachment_id,
          post_id: post.post_id,
          filename: a.filename,
          content_type: a.content_type,
          file_size: a.file_size,
        });
      }
    }
  }
  return out;
}

/** What the export still has to fetch; `complete` when nothing. */
export function isComplete(snapshot: Snapshot): SnapshotGaps {
  const { state } = snapshot;
  const gaps = {
    nodesPending: !state.nodesDone,
    forumsWithoutThreads: exportedForums(snapshot.nodes, snapshot.meta.nodeFilter)
      .map((node) => node.node_id)
      .filter((id) => !state.threadsDone.has(id)),
    threadsWithoutPosts: snapshot.threads
      .map((t) => t.thread_id)
      .filter((id) => !state.postsDone.has(id) || !snapshot.postsByThread.has(id)),
    usersMissing: authorIds(snapshot).filter((id) => !state.usersDone.has(id)),
    attachmentsMissing: [...new Set(postAttachments(snapshot).map((a) => a.attachment_id))].filter(
      (id) => !snapshot.attachments.has(id)
    ),
  };
  const complete =
    !gaps.nodesPending &&
    [
      gaps.forumsWithoutThreads,
      gaps.threadsWithoutPosts,
      gaps.usersMissing,
      gaps.attachmentsMissing,
    ].every((list) => list.length === 0);
  return { complete, ...gaps };
}

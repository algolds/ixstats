/**
 * The XenForo export's phases, in order, over an injected client and snapshot writer (the runner,
 * scripts/migrations/export-xenforo-forum.ts, wires them to the API and the disk): index → nodes → threads per
 * Forum node → posts per thread → users per distinct author → attachments per post. Work already marked done in
 * `state.json` is skipped, so a rerun resumes. `shouldStop` is polled between items (SIGINT).
 * Live-forum events never stall the export: redirect threads are not fetched, a thread whose posts answer 403/404
 * is marked gone, an attachment answering 403 is recorded `forbidden`, and unreadable users are recorded as such.
 */
import { attachmentMime } from "./attachment-mime";
import {
  authorIds,
  exportedForums,
  isRedirectThread,
  postAttachments,
  SNAPSHOT_VERSION,
  type AttachmentEntry,
  type AttachmentStored,
  type Snapshot,
  type SnapshotWriter,
} from "./snapshot";
import {
  XENFORO_EXPORT_CLIENT_VERSION,
  XenForoExportError,
  type XenForoClient,
} from "./xenforo-client";
import type { XfNode, XfPost, XfThread } from "./xenforo-types";

export interface ExportRunOptions {
  client: XenForoClient;
  writer: SnapshotWriter;
  /** Reads the snapshot back from disk (deduped), between phases. */
  readBack: () => Promise<Snapshot>;
  apiUrl: string;
  nodeFilter: number[] | null;
  /** Accept a `nodeFilter` that differs from the one the snapshot was started with. */
  resetFilter?: boolean;
  attachments: boolean;
  maxAttachmentBytes: number;
  log: (line: string) => void;
  shouldStop: () => boolean;
  now: () => Date;
}

export interface ExportTotals {
  stopped: boolean;
  threads: number;
  posts: number;
  users: number;
  usersUnavailable: number;
  threadsGone: number;
  threadsRedirect: number;
  attachments: Record<AttachmentStored, number>;
}

const THREAD_APPEND_BATCH = 50;
const PROGRESS_EVERY = 50;
/** Statuses a later run fetches again (`skipped` too, when that run wants attachments). */
const REFETCH: AttachmentStored[] = ["size_mismatch"];

const sortedKey = (filter: number[] | null) =>
  JSON.stringify(filter ? [...filter].sort((x, y) => x - y) : null);

function checkFilter(o: ExportRunOptions): number[] | null {
  const previous = o.writer.meta;
  if (!previous || o.resetFilter || sortedKey(previous.nodeFilter) === sortedKey(o.nodeFilter)) {
    return o.nodeFilter;
  }
  const shown = (filter: number[] | null) => (filter ? filter.join(",") : "(every forum)");
  throw new Error(
    `this snapshot was started with --nodes ${shown(previous.nodeFilter)}, not ${shown(o.nodeFilter)}; ` +
      "rerun with the same --nodes, or pass --reset-filter to change it"
  );
}

async function writeMeta(o: ExportRunOptions): Promise<void> {
  const nodeFilter = checkFilter(o);
  const { scopes, superUser, keyType } = await o.client.index();
  const { bypassPermissions } = o.client.context();
  const bypass = bypassPermissions ? "on" : "off (reads see what the key user or a guest sees)";
  o.log(
    `key: ${keyType ?? "type unknown"}, scopes ${scopes.join(", ") || "(none)"}, ` +
      `api_bypass_permissions ${bypass}`
  );
  await o.writer.writeMeta({
    exportedAt: o.now().toISOString(),
    apiUrl: o.apiUrl,
    scopes,
    superUser,
    keyType,
    bypassPermissions,
    clientVersion: XENFORO_EXPORT_CLIENT_VERSION,
    nodeFilter,
    version: SNAPSHOT_VERSION,
  });
}

async function exportNodes(o: ExportRunOptions): Promise<void> {
  if (o.writer.state.nodesDone) return;
  const nodes = await o.client.nodes();
  await o.writer.writeNodes(nodes);
  o.log(`nodes: ${nodes.length}`);
}

/** Lists one forum's threads; false when stopped part way. */
async function exportForum(
  o: ExportRunOptions,
  forum: XfNode,
  totals: ExportTotals
): Promise<boolean> {
  let batch: XfThread[] = [];
  let listed = 0;
  for await (const thread of o.client.threadsOf(forum.node_id)) {
    batch.push(thread);
    listed += 1;
    if (batch.length >= THREAD_APPEND_BATCH) {
      await o.writer.appendThreads(batch);
      batch = [];
    }
    if (o.shouldStop()) break;
  }
  await o.writer.appendThreads(batch);
  if (o.shouldStop()) return false;
  const discussionCount = forum.type_data?.discussion_count ?? null;
  await o.writer.markThreadsDone(forum.node_id, { listed, discussionCount });
  totals.threads += listed;
  o.log(
    `forum ${forum.node_id} "${forum.title}": ${listed} threads listed, ` +
      `XenForo reports ${discussionCount ?? "?"}`
  );
  return true;
}

async function exportThreads(o: ExportRunOptions, totals: ExportTotals): Promise<void> {
  const { nodes, meta } = await o.readBack();
  for (const forum of exportedForums(nodes, meta.nodeFilter)) {
    if (o.writer.state.threadsDone.has(forum.node_id)) continue;
    if (!(await exportForum(o, forum, totals))) return;
  }
}

/** Fetches one thread's posts; a 403/404 (deleted or hidden meanwhile) marks it gone. */
async function exportThreadPosts(
  o: ExportRunOptions,
  threadId: number,
  totals: ExportTotals
): Promise<void> {
  const posts: XfPost[] = [];
  try {
    for await (const post of o.client.postsOf(threadId)) posts.push(post);
  } catch (error) {
    if (!(error instanceof XenForoExportError) || (error.status !== 403 && error.status !== 404)) {
      throw error;
    }
    await o.writer.markThreadGone(threadId);
    totals.threadsGone += 1;
    o.log(`thread ${threadId}: posts not readable (HTTP ${error.status}), marked gone`);
    return;
  }
  await o.writer.appendPosts(posts);
  await o.writer.markPostsDone(threadId);
  totals.posts += posts.length;
}

async function exportPosts(o: ExportRunOptions, totals: ExportTotals): Promise<void> {
  const { threads } = await o.readBack();
  totals.threadsRedirect = threads.filter(isRedirectThread).length;
  const todo = threads.filter(
    (t) => !isRedirectThread(t) && !o.writer.state.postsDone.has(t.thread_id)
  );
  for (const [index, thread] of todo.entries()) {
    if (o.shouldStop()) return;
    await exportThreadPosts(o, thread.thread_id, totals);
    if ((index + 1) % PROGRESS_EVERY === 0) {
      o.log(`threads ${index + 1}/${todo.length}, posts ${totals.posts}`);
    }
  }
}

async function exportUsers(
  o: ExportRunOptions,
  snapshot: Snapshot,
  totals: ExportTotals
): Promise<void> {
  for (const userId of authorIds(snapshot)) {
    if (o.shouldStop()) return;
    if (o.writer.state.usersDone.has(userId)) continue;
    const user = await o.client.user(userId);
    await o.writer.addUser(userId, user);
    totals.users += 1;
    if (!user) totals.usersUnavailable += 1;
  }
}

type AttachmentBase = Omit<AttachmentEntry, "stored">;

async function record(
  o: ExportRunOptions,
  entry: AttachmentEntry,
  bytes?: Uint8Array
): Promise<AttachmentStored> {
  await o.writer.addAttachment(entry, bytes);
  return entry.stored;
}

async function download(o: ExportRunOptions, base: AttachmentBase): Promise<AttachmentStored> {
  let data: Awaited<ReturnType<XenForoClient["attachmentData"]>>;
  try {
    data = await o.client.attachmentData(base.attachment_id);
  } catch (error) {
    if (!(error instanceof XenForoExportError && error.status === 403)) throw error;
    return record(o, { ...base, stored: "forbidden" });
  }
  if (!data) return record(o, { ...base, stored: "missing" });
  const size = data.bytes.byteLength;
  if (size > o.maxAttachmentBytes) return record(o, { ...base, stored: "oversize" });
  const content_type = attachmentMime([data.contentType, base.content_type], base.filename);
  if (size !== base.file_size) {
    o.log(`attachment ${base.attachment_id}: ${size} bytes received, ${base.file_size} expected`);
    const entry = { ...base, content_type, received_size: size };
    return record(o, { ...entry, stored: "size_mismatch" }, data.bytes);
  }
  return record(o, { ...base, content_type, stored: "ok" }, data.bytes);
}

/** Records one attachment within the size limit; returns how it was stored. */
async function storeAttachment(o: ExportRunOptions, raw: AttachmentBase) {
  const base = { ...raw, content_type: attachmentMime([raw.content_type], raw.filename) };
  if (!o.attachments) return record(o, { ...base, stored: "skipped" });
  if (base.file_size > o.maxAttachmentBytes) return record(o, { ...base, stored: "oversize" });
  return download(o, base);
}

function wanted(o: ExportRunOptions, snapshot: Snapshot, id: number): boolean {
  if (!o.writer.state.attachmentsDone.has(id)) return true;
  const stored = snapshot.attachments.get(id)?.stored;
  if (!stored) return false;
  return REFETCH.includes(stored) || (o.attachments && stored === "skipped");
}

async function exportAttachments(
  o: ExportRunOptions,
  snapshot: Snapshot,
  totals: ExportTotals
): Promise<void> {
  const seen = new Set<number>();
  for (const base of postAttachments(snapshot)) {
    if (o.shouldStop()) return;
    if (seen.has(base.attachment_id)) continue;
    seen.add(base.attachment_id);
    if (!wanted(o, snapshot, base.attachment_id)) continue;
    totals.attachments[await storeAttachment(o, base)] += 1;
  }
}

export async function runExport(o: ExportRunOptions): Promise<ExportTotals> {
  const totals: ExportTotals = {
    stopped: false,
    threads: 0,
    posts: 0,
    users: 0,
    usersUnavailable: 0,
    threadsGone: 0,
    threadsRedirect: 0,
    attachments: { ok: 0, missing: 0, forbidden: 0, oversize: 0, skipped: 0, size_mismatch: 0 },
  };
  await writeMeta(o);
  try {
    await exportNodes(o);
    await exportThreads(o, totals);
    if (!o.shouldStop()) await exportPosts(o, totals);
    if (!o.shouldStop()) {
      const snapshot = await o.readBack();
      await exportUsers(o, snapshot, totals);
      if (!o.shouldStop()) await exportAttachments(o, snapshot, totals);
    }
  } finally {
    await o.writer.checkpoint();
  }
  totals.stopped = o.shouldStop();
  return totals;
}

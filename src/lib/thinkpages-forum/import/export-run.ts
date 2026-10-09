/**
 * The XenForo export's phases, in order, over an injected client and snapshot writer (the runner,
 * scripts/migrations/export-xenforo-forum.ts, wires them to the API and the disk): index → nodes → threads per
 * Forum node → posts per thread → users per distinct author → attachments per post. Work already marked done in
 * `state.json` is skipped, so a rerun resumes. `shouldStop` is polled between items (SIGINT).
 */
import {
  authorIds,
  exportedForums,
  postAttachments,
  SNAPSHOT_VERSION,
  type AttachmentEntry,
  type AttachmentStored,
  type Snapshot,
  type SnapshotWriter,
} from "./snapshot";
import { XenForoExportError, type XenForoClient } from "./xenforo-client";
import type { XfPost, XfThread } from "./xenforo-types";

export interface ExportRunOptions {
  client: XenForoClient;
  writer: SnapshotWriter;
  /** Reads the snapshot back from disk (deduped), between phases. */
  readBack: () => Promise<Snapshot>;
  apiUrl: string;
  nodeFilter: number[] | null;
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
  usersForbidden: boolean;
  attachments: Record<AttachmentStored, number>;
}

const THREAD_APPEND_BATCH = 50;
const PROGRESS_EVERY = 50;

async function exportNodes(o: ExportRunOptions): Promise<void> {
  if (o.writer.state.nodesDone) return;
  const nodes = await o.client.nodes();
  await o.writer.writeNodes(nodes);
  o.log(`nodes: ${nodes.length}`);
}

async function exportThreads(o: ExportRunOptions, totals: ExportTotals): Promise<void> {
  const { nodes, meta } = await o.readBack();
  for (const forum of exportedForums(nodes, meta.nodeFilter)) {
    if (o.writer.state.threadsDone.has(forum.node_id)) continue;
    let batch: XfThread[] = [];
    let count = 0;
    for await (const thread of o.client.threadsOf(forum.node_id)) {
      batch.push(thread);
      count += 1;
      if (batch.length >= THREAD_APPEND_BATCH) {
        await o.writer.appendThreads(batch);
        batch = [];
      }
      if (o.shouldStop()) break;
    }
    await o.writer.appendThreads(batch);
    if (o.shouldStop()) return;
    await o.writer.markThreadsDone(forum.node_id);
    totals.threads += count;
    o.log(`forum ${forum.node_id} "${forum.title}": ${count} threads`);
  }
}

async function exportPosts(o: ExportRunOptions, totals: ExportTotals): Promise<void> {
  const { threads } = await o.readBack();
  const todo = threads.filter((t) => !o.writer.state.postsDone.has(t.thread_id));
  for (const [index, thread] of todo.entries()) {
    if (o.shouldStop()) return;
    const posts: XfPost[] = [];
    for await (const post of o.client.postsOf(thread.thread_id)) posts.push(post);
    await o.writer.appendPosts(posts);
    await o.writer.markPostsDone(thread.thread_id);
    totals.posts += posts.length;
    if ((index + 1) % PROGRESS_EVERY === 0)
      o.log(`threads ${index + 1}/${todo.length}, posts ${totals.posts}`);
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
    try {
      await o.writer.addUser(userId, await o.client.user(userId));
    } catch (error) {
      if (!(error instanceof XenForoExportError) || error.status !== 403) throw error;
      totals.usersForbidden = true;
      o.log("users: GET /users/{id}/ is forbidden for this key (needs user:read); users skipped");
      return;
    }
    totals.users += 1;
  }
}

/** Fetches one attachment within the size limit and records it; returns how it was stored. */
async function storeAttachment(
  o: ExportRunOptions,
  base: Omit<AttachmentEntry, "stored">
): Promise<AttachmentStored> {
  if (!o.attachments) return record(o, { ...base, stored: "skipped" });
  if (base.file_size > o.maxAttachmentBytes) return record(o, { ...base, stored: "oversize" });
  const data = await o.client.attachmentData(base.attachment_id);
  if (!data) return record(o, { ...base, stored: "missing" });
  if (data.bytes.byteLength > o.maxAttachmentBytes)
    return record(o, { ...base, stored: "oversize" });
  return record(
    o,
    { ...base, content_type: data.contentType || base.content_type, stored: "ok" },
    data.bytes
  );
}

async function record(
  o: ExportRunOptions,
  entry: AttachmentEntry,
  bytes?: Uint8Array
): Promise<AttachmentStored> {
  await o.writer.addAttachment(entry, bytes);
  return entry.stored;
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
    // An attachment skipped by --no-attachments is fetched by a later run that wants attachments.
    const retry =
      o.attachments && snapshot.attachments.get(base.attachment_id)?.stored === "skipped";
    if (o.writer.state.attachmentsDone.has(base.attachment_id) && !retry) continue;
    totals.attachments[await storeAttachment(o, base)] += 1;
  }
}

export async function runExport(o: ExportRunOptions): Promise<ExportTotals> {
  const totals: ExportTotals = {
    stopped: false,
    threads: 0,
    posts: 0,
    users: 0,
    usersForbidden: false,
    attachments: { ok: 0, missing: 0, oversize: 0, skipped: 0 },
  };
  const { scopes, superUser } = await o.client.index();
  o.log(`key scopes: ${scopes.join(", ") || "(none)"}${superUser ? " (super user key)" : ""}`);
  await o.writer.writeMeta({
    exportedAt: o.now().toISOString(),
    apiUrl: o.apiUrl,
    scopes,
    superUser,
    nodeFilter: o.nodeFilter,
    version: SNAPSHOT_VERSION,
  });
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

/**
 * The XenForo import plan (phase 4): a snapshot plus what the database already holds → the archive categories,
 * threads and posts to write, and the report. Pure; `loadImportDbState` (forum module) reads the database and the
 * runner writes the plan. `postCount` is not planned: the writer recounts from visible posts after each thread.
 *
 * Rules: Q4 node targets (unknown targets throw), Q5 moderated → hidden and deleted → skipped (a moderated first
 * post hides its thread instead; a deleted first post skips it), Q19 timestamps, Q3 authors, Q2 bodies, I7 already
 * imported content XenForo now has moderated or deleted → re-hidden (rehide.ts).
 */
import { isStoredComplete } from "./attachments";
import { authorOf, resolveAuthors, type LinkedForumUser } from "./authors";
import {
  archiveCategory,
  archiveKey,
  resolveNodeTargets,
  type ArchiveCategory,
  type NodeMapFile,
  type NodeTarget,
  type ResolvedNode,
} from "./node-map";
import { importedPostBody, type AttachmentOutcome, type PostHtmlInput } from "./post-html";
import { attachmentsByPost, emptyRehide, planRehide, type RehidePlan } from "./rehide";
import {
  countNotCarried,
  countPlannedPost,
  countState,
  emptyReport,
  finishAuthors,
  unknownStateLines,
  type ImportReport,
  type NodeReportRow,
  type UnmatchedAuthor,
} from "./report";
import {
  isRedirectThread,
  type AttachmentEntry,
  type Snapshot,
  type SnapshotProgress,
} from "./snapshot";
import { categoryVisibility, importedThread } from "./visibility";
import type { XfAttachment, XfNode, XfPost, XfThread } from "./xenforo-types";

export interface ImportDbState {
  users: LinkedForumUser[];
  /** Sitewide categories (seeds and earlier archive categories) with their current visibility. */
  siteCategories: Array<{ id: string; key: string; visibility: string }>;
  /** Realm slug as the node map names it → realm id, resolved by the module's loadForumRealm (IxWorld: "ixworld" or "default" → "default"). */
  realmIds: ReadonlyMap<string, string>;
  realmCategories: Array<{ id: string; realmId: string; key: string }>;
  /** xenforoThreadId → thread id */
  existingThreads: ReadonlyMap<number, string>;
  /** xenforoPostId */
  existingPosts: ReadonlySet<number>;
  /** xenforoThreadId of imported threads the database holds as hidden (I7 never re-hides those). */
  hiddenThreads: ReadonlySet<number>;
  /** xenforoPostId of imported posts the database holds as hidden. */
  hiddenPosts: ReadonlySet<number>;
  attachmentFor: PostHtmlInput["attachmentFor"];
}

export interface PlannedPost {
  xenforoPostId: number;
  xenforoUserId: number | null;
  authorUserId: string | null;
  importedAuthorName: string;
  contentHtml: string;
  plainText: string;
  hidden: boolean;
  createdAt: Date;
  editedAt: Date | null;
}

export type CategoryRef = { kind: "existing"; id: string } | { kind: "archive"; key: string };

export interface PlannedThread {
  xenforoThreadId: number;
  existingId: string | null;
  categoryRef: CategoryRef;
  title: string;
  authorUserId: string | null;
  importedAuthorName: string;
  xenforoUserId: number | null;
  pinned: boolean;
  locked: boolean;
  hidden: boolean;
  createdAt: Date;
  lastPostAt: Date;
  posts: PlannedPost[];
  skippedPosts: { deleted: number; alreadyImported: number };
}

export interface ImportPlan {
  categories: ArchiveCategory[];
  threads: PlannedThread[];
  /** I7: imported rows XenForo has since moderated or deleted. */
  rehide: RehidePlan;
  report: ImportReport;
}

export class UnknownTargetError extends Error {
  constructor(node: XfNode, target: string) {
    super(`Node ${node.node_id} "${node.title}" maps to ${target}, which does not exist`);
    this.name = "UnknownTargetError";
  }
}

const TITLE_MAX = 200;
const STAFF_LIKE = /staff|admin|mod|private|internal/i;

/** What the plan reads of a snapshot (a whole `Snapshot` fits). */
export type PlanSnapshot = Pick<Snapshot, "nodes" | "threads" | "postsByThread" | "attachments"> & {
  state?: Pick<SnapshotProgress, "threadsGone">;
};

interface PlanContext {
  db: ImportDbState;
  attachments: ReadonlyMap<number, AttachmentEntry>;
  byForumId: ReadonlyMap<number, string>;
  report: ImportReport;
  unmatched: Map<number, UnmatchedAuthor>;
  rehide: RehidePlan;
  attachmentsByPost: ReadonlyMap<number, readonly number[]>;
}

/** "site:general", "realm:ixworld/hub", "archive:xf-13 (staff)" or "skip". */
export function describeTarget(target: NodeTarget, nodeId: number): string {
  if ("skip" in target) return "skip";
  if ("archive" in target)
    return `archive:${archiveKey(nodeId)} (${target.visibility ?? "public"})`;
  return target.scope === "site" ? `site:${target.key}` : `realm:${target.realm}/${target.key}`;
}

type SeededTarget = Extract<NodeTarget, { scope: "site" | "realm" }>;

/** A site or realm target must already exist: the plan never creates seeds. */
function existingCategory(node: XfNode, db: ImportDbState, target: SeededTarget): CategoryRef {
  const found =
    target.scope === "realm"
      ? db.realmCategories.find(
          (c) => c.realmId === db.realmIds.get(target.realm) && c.key === target.key
        )
      : db.siteCategories.find((c) => c.key === target.key);
  if (!found) throw new UnknownTargetError(node, describeTarget(target, node.node_id));
  return { kind: "existing", id: found.id };
}

/**
 * The node's archive category: created when absent, else the existing one, whose visibility must match the map's
 * (a rerun after changing a node to "staff" must not leave it public): a mismatch blocks the apply.
 */
function archivePlace(
  node: XfNode,
  visibility: "public" | "staff",
  db: ImportDbState,
  report: ImportReport
): CategoryRef {
  const key = archiveKey(node.node_id);
  const existing = db.siteCategories.find((c) => c.key === key);
  if (!existing) return { kind: "archive", key };
  if (existing.visibility !== visibility) {
    report.blocking.push(
      `Node ${node.node_id} "${node.title}": the existing category ${key} is "${existing.visibility}" but the node map says "${visibility}"; change the category's visibility (or the map) before applying.`
    );
  }
  return { kind: "existing", id: existing.id };
}

/**
 * I1: a staff-like title (`STAFF_LIKE`) landing in a public category. Placed by its title or the default, it blocks
 * the apply (the export bypasses permissions, so a private board would turn public); placed by an explicit node map
 * entry, it is the owner's decision and only warns.
 */
function checkStaffLike(resolved: ResolvedNode, db: ImportDbState, report: ImportReport): void {
  const { node, target, source } = resolved;
  if (!STAFF_LIKE.test(node.title)) return;
  if (categoryVisibility(target, db.siteCategories) !== "public") return;
  const where = describeTarget(target, node.node_id);
  if (source === "map") {
    report.warnings.push(
      `Node ${node.node_id} "${node.title}" looks private but the node map puts it in a public category (${where}); map it to a staff archive if it was private.`
    );
  } else {
    report.blocking.push(
      `Node ${node.node_id} "${node.title}" looks private but its proposed target is public (${where}, ${source}): give it a node map entry (a staff archive if it was private).`
    );
  }
}

/** Each node's category (null: skipped), creating one archive category per archived node not already present. */
function placeNodes(resolved: ResolvedNode[], db: ImportDbState, report: ImportReport) {
  const places = new Map<number, CategoryRef | null>();
  const categories: ArchiveCategory[] = [];
  for (const entry of resolved) {
    const { node, target } = entry;
    if ("skip" in target) places.set(node.node_id, null);
    else if ("archive" in target) {
      const visibility = target.visibility ?? "public";
      const place = archivePlace(node, visibility, db, report);
      if (place.kind === "archive") categories.push(archiveCategory(node, visibility));
      places.set(node.node_id, place);
    } else places.set(node.node_id, existingCategory(node, db, target));
    checkStaffLike(entry, db, report);
  }
  return { places, categories };
}

/** Q19: XenForo orders same-second posts by position; keep that order under the native (createdAt, id) sort. */
const postCreatedAt = (post: XfPost) =>
  new Date(post.post_date * 1000 + Math.min(post.position, 999));

const editedAt = (post: XfPost) =>
  post.last_edit_date && post.last_edit_date > 0 ? new Date(post.last_edit_date * 1000) : null;

const threadTitle = (title: string) => title.trim().slice(0, TITLE_MAX).trim() || "(untitled)";

/** Only complete bytes render: anything not stored "ok" at its full size is omitted, whatever the policy says. */
function attachmentOutcome(attachment: XfAttachment, ctx: PlanContext): AttachmentOutcome {
  const entry = ctx.attachments.get(attachment.attachment_id);
  return entry && isStoredComplete(entry)
    ? ctx.db.attachmentFor(attachment.attachment_id)
    : "omitted";
}

function planPost(post: XfPost, isFirst: boolean, ctx: PlanContext): PlannedPost {
  const attachments = post.Attachments ?? [];
  const outcomes = new Map(attachments.map((a) => [a.attachment_id, attachmentOutcome(a, ctx)]));
  const outcomeOf = (id: number): AttachmentOutcome => outcomes.get(id) ?? null;
  const body = importedPostBody({ message: post.message, attachments, attachmentFor: outcomeOf });
  const author = authorOf(ctx.byForumId, post.user_id, post.username);
  countPlannedPost(ctx.report, ctx.unmatched, {
    author,
    body,
    attachments: attachments.map((attachment) => ({
      attachment,
      outcome: outcomeOf(attachment.attachment_id),
      stored: ctx.attachments.get(attachment.attachment_id)?.stored ?? "absent",
    })),
  });
  const edited = editedAt(post);
  if (edited) ctx.report.notCarried.editedPosts += 1;
  return {
    xenforoPostId: post.post_id,
    ...author,
    contentHtml: body.contentHtml,
    plainText: body.plainText,
    // Phase 3: a first post is never hidden alone; its thread is hidden instead.
    hidden: post.message_state === "moderated" && !isFirst,
    createdAt: postCreatedAt(post),
    editedAt: edited,
  };
}

function lastPostAt(thread: XfThread, posts: PlannedPost[]): Date {
  const visible = posts.filter((p) => !p.hidden).map((p) => p.createdAt.getTime());
  return new Date(visible.length ? Math.max(...visible) : thread.last_post_date * 1000);
}

/** The posts still to write, or null when the thread is skipped or already complete (counted either way). */
function planPosts(posts: XfPost[], first: XfPost, ctx: PlanContext) {
  const skippedPosts = { deleted: 0, alreadyImported: 0 };
  const planned: PlannedPost[] = [];
  for (const post of posts) {
    if (post.message_state === "deleted") skippedPosts.deleted += 1;
    else if (ctx.db.existingPosts.has(post.post_id)) skippedPosts.alreadyImported += 1;
    else planned.push(planPost(post, post === first, ctx));
  }
  ctx.report.alreadyPresent.posts += skippedPosts.alreadyImported;
  return { planned, skippedPosts };
}

function planThread(
  thread: XfThread,
  posts: XfPost[],
  categoryRef: CategoryRef,
  ctx: PlanContext
): PlannedThread | null {
  const { report } = ctx;
  if (!countState(report.threads, thread.discussion_state)) {
    report.unknownStates.threads.push({
      id: thread.thread_id,
      state: String(thread.discussion_state),
    });
  }
  for (const post of posts) {
    if (!countState(report.posts, post.message_state)) {
      report.unknownStates.posts.push({ id: post.post_id, state: String(post.message_state) });
    }
  }
  const existingId = ctx.db.existingThreads.get(thread.thread_id) ?? null;
  planRehide(ctx.rehide, {
    thread,
    posts,
    existingId,
    db: ctx.db,
    attachments: ctx.attachmentsByPost,
  });
  const imported = importedThread(thread, posts);
  if ("skip" in imported) {
    if (imported.skip !== "deleted") report.threads[imported.skip] += 1;
    return null;
  }
  const { first } = imported;
  const { planned, skippedPosts } = planPosts(posts, first, ctx);
  if (!planned.length) {
    if (existingId) report.alreadyPresent.threads += 1;
    else report.threads.noPosts += 1;
    return null;
  }
  return {
    xenforoThreadId: thread.thread_id,
    existingId,
    categoryRef,
    title: threadTitle(thread.title),
    ...authorOf(ctx.byForumId, thread.user_id, thread.username),
    pinned: thread.sticky === true,
    // Only an explicit `false` locks: a missing or renamed field must not lock every thread (the report counts locks).
    locked: thread.discussion_open === false,
    hidden: imported.hidden,
    createdAt: new Date(thread.post_date * 1000),
    lastPostAt: lastPostAt(thread, planned),
    posts: planned,
    skippedPosts,
  };
}

function countTotals(
  report: ImportReport,
  categories: ArchiveCategory[],
  threads: PlannedThread[]
): void {
  const posts = threads.flatMap((t) => t.posts);
  const fresh = threads.filter((t) => !t.existingId);
  report.totals = {
    categories: categories.length,
    threadsNew: threads.filter((t) => !t.existingId).length,
    threadsResumed: threads.filter((t) => t.existingId).length,
    posts: posts.length,
    hiddenThreads: threads.filter((t) => t.hidden && !t.existingId).length,
    hiddenPosts: posts.filter((p) => p.hidden).length,
    lockedThreads: fresh.filter((t) => t.locked).length,
    pinnedThreads: fresh.filter((t) => t.pinned).length,
  };
}

function nodeRows(
  resolved: ResolvedNode[],
  threads: PlannedThread[],
  snapshot: Pick<Snapshot, "threads">
): NodeReportRow[] {
  const nodeOf = new Map(snapshot.threads.map((t) => [t.thread_id, t.node_id]));
  return resolved.map(({ node, target, source }) => {
    const mine = threads.filter((t) => nodeOf.get(t.xenforoThreadId) === node.node_id);
    return {
      nodeId: node.node_id,
      title: node.title,
      type: node.node_type_id,
      target: describeTarget(target, node.node_id),
      source,
      threads: mine.length,
      posts: mine.reduce((n, t) => n + t.posts.length, 0),
    };
  });
}

/** Threads the export holds no posts for: a redirect stub, or one gone (403/404) while it ran. */
function postlessThread(thread: XfThread, gone: ReadonlySet<number>): "redirect" | "gone" | null {
  if (isRedirectThread(thread)) return "redirect";
  return gone.has(thread.thread_id) ? "gone" : null;
}

export function planImport(
  snapshot: PlanSnapshot,
  db: ImportDbState,
  nodeMap: NodeMapFile | null
): ImportPlan {
  const authors = resolveAuthors(db.users);
  const report = emptyReport(authors.duplicates);
  const ctx: PlanContext = {
    db,
    attachments: snapshot.attachments,
    byForumId: authors.byForumId,
    report,
    unmatched: new Map(),
    rehide: emptyRehide(),
    attachmentsByPost: attachmentsByPost(
      [...snapshot.postsByThread.values()].flat(),
      snapshot.attachments.values()
    ),
  };
  const resolved = resolveNodeTargets(snapshot.nodes, nodeMap);
  const { places, categories } = placeNodes(resolved, db, report);
  const gone = snapshot.state?.threadsGone ?? new Set<number>();
  const threads: PlannedThread[] = [];
  for (const thread of snapshot.threads) {
    const categoryRef = places.get(thread.node_id);
    if (!categoryRef) {
      report.threads.skippedByNode += 1;
      continue;
    }
    const postless = postlessThread(thread, gone);
    if (postless) {
      report.threads[postless] += 1;
      continue;
    }
    const planned = planThread(
      thread,
      snapshot.postsByThread.get(thread.thread_id) ?? [],
      categoryRef,
      ctx
    );
    if (planned) threads.push(planned);
  }
  countNotCarried(report, snapshot.threads);
  report.blocking.push(...unknownStateLines(report.unknownStates));
  finishAuthors(report, ctx.unmatched);
  countTotals(report, categories, threads);
  report.nodes = nodeRows(resolved, threads, snapshot);
  report.rehidden = {
    threads: ctx.rehide.threads.filter((t) => t.thread).length,
    posts: ctx.rehide.threads.reduce((n, t) => n + t.posts.length, 0),
    attachments: ctx.rehide.attachmentIds.length,
  };
  return { categories, threads, rehide: ctx.rehide, report };
}

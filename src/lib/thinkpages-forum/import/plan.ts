/**
 * The XenForo import plan (phase 4): a snapshot plus what the database already holds → the archive categories,
 * threads and posts to write, and the report. Pure; `loadImportDbState` (forum module) reads the database and the
 * runner writes the plan. `postCount` is not planned: the writer recounts from visible posts after each thread.
 *
 * Rules: Q4 node targets (unknown targets throw), Q5 moderated → hidden and deleted → skipped (a moderated first
 * post hides its thread instead; a deleted first post skips it), Q19 timestamps, Q3 authors, Q2 bodies.
 */
import { SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
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
import { importedPostBody, type PostHtmlInput } from "./post-html";
import {
  countNotCarried,
  countPlannedPost,
  countState,
  emptyReport,
  finishAuthors,
  type ImportReport,
  type StoredKey,
  type NodeReportRow,
  type UnmatchedAuthor,
} from "./report";
import { isRedirectThread, type Snapshot, type SnapshotProgress } from "./snapshot";
import type { XfNode, XfPost, XfThread } from "./xenforo-types";

export interface ImportDbState {
  users: LinkedForumUser[];
  siteCategories: Array<{ id: string; key: string }>;
  /** Realm slug as the node map names it → realm id, resolved by the module's loadForumRealm (IxWorld: "ixworld" or "default" → "default"). */
  realmIds: ReadonlyMap<string, string>;
  realmCategories: Array<{ id: string; realmId: string; key: string }>;
  /** xenforoThreadId → thread id */
  existingThreads: ReadonlyMap<number, string>;
  /** xenforoPostId */
  existingPosts: ReadonlySet<number>;
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
export type PlanSnapshot = Pick<Snapshot, "nodes" | "threads" | "postsByThread"> &
  Partial<Pick<Snapshot, "attachments">> & { state?: Pick<SnapshotProgress, "threadsGone"> };

interface PlanContext {
  db: ImportDbState;
  storedOf: (attachmentId: number) => StoredKey;
  byForumId: ReadonlyMap<number, string>;
  report: ImportReport;
  unmatched: Map<number, UnmatchedAuthor>;
}

function describeTarget(target: NodeTarget, nodeId: number): string {
  if ("skip" in target) return "skip";
  if ("archive" in target)
    return `archive:${archiveKey(nodeId)} (${target.visibility ?? "public"})`;
  return target.scope === "site" ? `site:${target.key}` : `realm:${target.realm}/${target.key}`;
}

function visibilityOf(target: NodeTarget): string | null {
  if ("skip" in target) return null;
  if ("archive" in target) return target.visibility ?? "public";
  if (target.scope === "realm") return "public";
  return SITE_CATEGORIES.find((c) => c.key === target.key)?.visibility ?? "public";
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

function archivePlace(node: XfNode, db: ImportDbState): CategoryRef {
  const key = archiveKey(node.node_id);
  const existing = db.siteCategories.find((c) => c.key === key);
  return existing ? { kind: "existing", id: existing.id } : { kind: "archive", key };
}

/** Each node's category (null: skipped), creating one archive category per archived node not already present. */
function placeNodes(resolved: ResolvedNode[], db: ImportDbState, report: ImportReport) {
  const places = new Map<number, CategoryRef | null>();
  const categories: ArchiveCategory[] = [];
  for (const { node, target } of resolved) {
    if ("skip" in target) places.set(node.node_id, null);
    else if ("archive" in target) {
      const place = archivePlace(node, db);
      if (place.kind === "archive")
        categories.push(archiveCategory(node, target.visibility ?? "public"));
      places.set(node.node_id, place);
    } else places.set(node.node_id, existingCategory(node, db, target));
    if (STAFF_LIKE.test(node.title) && visibilityOf(target) === "public") {
      report.warnings.push(
        `Node ${node.node_id} "${node.title}" looks private but lands in a public category (${describeTarget(target, node.node_id)}); map it to a staff archive or "staff" if it was private.`
      );
    }
  }
  return { places, categories };
}

/** Q19: XenForo orders same-second posts by position; keep that order under the native (createdAt, id) sort. */
const postCreatedAt = (post: XfPost) =>
  new Date(post.post_date * 1000 + Math.min(post.position, 999));

const editedAt = (post: XfPost) =>
  post.last_edit_date && post.last_edit_date > 0 ? new Date(post.last_edit_date * 1000) : null;

const threadTitle = (title: string) => title.trim().slice(0, TITLE_MAX).trim() || "(untitled)";

function planPost(post: XfPost, isFirst: boolean, ctx: PlanContext): PlannedPost {
  const attachments = post.Attachments ?? [];
  const body = importedPostBody({
    message: post.message,
    attachments,
    attachmentFor: ctx.db.attachmentFor,
  });
  const author = authorOf(ctx.byForumId, post.user_id, post.username);
  countPlannedPost(ctx.report, ctx.unmatched, {
    author,
    body,
    attachments: attachments.map((attachment) => ({
      attachment,
      outcome: ctx.db.attachmentFor(attachment.attachment_id),
      stored: ctx.storedOf(attachment.attachment_id),
    })),
  });
  return {
    xenforoPostId: post.post_id,
    ...author,
    contentHtml: body.contentHtml,
    plainText: body.plainText,
    // Phase 3: a first post is never hidden alone; its thread is hidden instead.
    hidden: post.message_state === "moderated" && !isFirst,
    createdAt: postCreatedAt(post),
    editedAt: editedAt(post),
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
  countState(report.threads, thread.discussion_state);
  for (const post of posts) countState(report.posts, post.message_state);
  if (thread.discussion_state === "deleted") return null;
  const first = posts.find((p) => p.is_first_post) ?? posts[0];
  if (!first) {
    report.threads.noPosts += 1;
    return null;
  }
  if (first.message_state === "deleted") {
    report.threads.firstPostDeleted += 1;
    return null;
  }
  const existingId = ctx.db.existingThreads.get(thread.thread_id) ?? null;
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
    pinned: thread.sticky,
    locked: !thread.discussion_open,
    hidden: thread.discussion_state === "moderated" || first.message_state === "moderated",
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
  report.totals = {
    categories: categories.length,
    threadsNew: threads.filter((t) => !t.existingId).length,
    threadsResumed: threads.filter((t) => t.existingId).length,
    posts: posts.length,
    hiddenThreads: threads.filter((t) => t.hidden && !t.existingId).length,
    hiddenPosts: posts.filter((p) => p.hidden).length,
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
    storedOf: (id) => snapshot.attachments?.get(id)?.stored ?? "absent",
    byForumId: authors.byForumId,
    report,
    unmatched: new Map(),
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
  finishAuthors(report, ctx.unmatched);
  countTotals(report, categories, threads);
  report.nodes = nodeRows(resolved, threads, snapshot);
  return { categories, threads, report };
}

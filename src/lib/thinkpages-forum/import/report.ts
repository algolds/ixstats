/**
 * The XenForo import report (phase 4): what the plan would write and what it leaves behind, for the owner's dry-run
 * review. Pure; `plan.ts` fills it, `summarizeImport` prints it.
 */
import type { ImportedAuthor } from "./authors";
import {
  POST_FEATURES,
  type AttachmentOutcome,
  type PostFeature,
  type PostHtmlResult,
} from "./post-html";
import type { TargetSource } from "./node-map";
import type { AttachmentStored } from "./snapshot";
import type { XfAttachment, XfThread } from "./xenforo-types";

export interface NodeReportRow {
  nodeId: number;
  title: string;
  type: string;
  /** "site:general", "realm:ixworld/hub", "archive:xf-13 (staff)" or "skip". */
  target: string;
  source: TargetSource;
  threads: number;
  posts: number;
}

export interface UnmatchedAuthor {
  xenforoUserId: number;
  name: string;
  posts: number;
}

export type AttachmentOutcomeKey = "image" | "link" | "omitted" | "none";
export type StoredKey = AttachmentStored | "absent";

export interface CountedAttachment {
  attachment: XfAttachment;
  outcome: AttachmentOutcome;
  stored: StoredKey;
}

export interface ImportReport {
  nodes: NodeReportRow[];
  authors: {
    matchedPosts: number;
    unmatchedPosts: number;
    guestPosts: number;
    unmatchedUsers: number;
    /** The 20 unmatched XenForo users with the most planned posts. */
    topUnmatched: UnmatchedAuthor[];
    duplicates: Array<{ forumUserId: number; userIds: string[] }>;
  };
  /** XenForo states of the threads in imported nodes, and why threads were not planned. */
  threads: {
    visible: number;
    moderated: number;
    deleted: number;
    skippedByNode: number;
    firstPostDeleted: number;
    noPosts: number;
    /** discussion_type "redirect": a moved thread's stub, never fetched. */
    redirect: number;
    /** Posts answered 403/404 during the export (`state.threadsGone`). */
    gone: number;
  };
  /** XenForo states of the posts of those threads. */
  posts: { visible: number; moderated: number; deleted: number };
  /** Threads whose every post is already imported, and posts already imported. */
  alreadyPresent: { threads: number; posts: number };
  /** Planned posts per feature. */
  features: Record<PostFeature, number>;
  /** Tokens in planned posts; `posts` keep at least one (they render as cards only with a link row). */
  tokens: { kept: number; stripped: number; overLimit: number; posts: number };
  attachments: Record<AttachmentOutcomeKey, { count: number; bytes: number }>;
  /** The same attachments by their snapshot state (`absent`: no attachments.json entry). */
  attachmentsStored: Partial<Record<StoredKey, { count: number; bytes: number }>>;
  /** Q16: XenForo data with no native home. */
  notCarried: { prefixes: number; polls: number; views: number };
  totals: {
    categories: number;
    threadsNew: number;
    threadsResumed: number;
    posts: number;
    hiddenThreads: number;
    hiddenPosts: number;
  };
  warnings: string[];
}

const TOP_UNMATCHED = 20;

const tally = () => ({ count: 0, bytes: 0 });

export function emptyReport(duplicates: ImportReport["authors"]["duplicates"]): ImportReport {
  return {
    nodes: [],
    authors: {
      matchedPosts: 0,
      unmatchedPosts: 0,
      guestPosts: 0,
      unmatchedUsers: 0,
      topUnmatched: [],
      duplicates,
    },
    threads: {
      visible: 0,
      moderated: 0,
      deleted: 0,
      skippedByNode: 0,
      firstPostDeleted: 0,
      noPosts: 0,
      redirect: 0,
      gone: 0,
    },
    posts: { visible: 0, moderated: 0, deleted: 0 },
    alreadyPresent: { threads: 0, posts: 0 },
    features: Object.fromEntries(POST_FEATURES.map((f) => [f, 0])) as Record<PostFeature, number>,
    tokens: { kept: 0, stripped: 0, overLimit: 0, posts: 0 },
    attachments: { image: tally(), link: tally(), omitted: tally(), none: tally() },
    attachmentsStored: {},
    notCarried: { prefixes: 0, polls: 0, views: 0 },
    totals: {
      categories: 0,
      threadsNew: 0,
      threadsResumed: 0,
      posts: 0,
      hiddenThreads: 0,
      hiddenPosts: 0,
    },
    warnings: [],
  };
}

type StateCounts = { visible: number; moderated: number; deleted: number };

/** XenForo's `discussion_state` / `message_state`: anything not moderated or deleted reads as visible. */
export function countState(counts: StateCounts, state: string): void {
  if (state === "moderated" || state === "deleted") counts[state] += 1;
  else counts.visible += 1;
}

export function countNotCarried(report: ImportReport, threads: readonly XfThread[]): void {
  for (const thread of threads) {
    if (thread.prefix_id > 0) report.notCarried.prefixes += 1;
    if (thread.discussion_type === "poll") report.notCarried.polls += 1;
    report.notCarried.views += thread.view_count;
  }
}

const outcomeKey = (outcome: AttachmentOutcome): AttachmentOutcomeKey =>
  outcome === null ? "none" : outcome === "omitted" ? "omitted" : outcome.kind;

/** Counts one planned post: its author, body features, tokens and attachments. */
export function countPlannedPost(
  report: ImportReport,
  unmatched: Map<number, UnmatchedAuthor>,
  post: {
    author: ImportedAuthor;
    body: PostHtmlResult;
    attachments: CountedAttachment[];
  }
): void {
  countAuthor(report, unmatched, post.author);
  for (const feature of POST_FEATURES)
    if (post.body.features[feature]) report.features[feature] += 1;
  const { tokens } = post.body;
  report.tokens.kept += tokens.kept;
  report.tokens.stripped += tokens.stripped;
  report.tokens.overLimit += tokens.overLimit;
  if (tokens.kept > 0) report.tokens.posts += 1;
  for (const { attachment, outcome, stored } of post.attachments) {
    const row = report.attachments[outcomeKey(outcome)];
    row.count += 1;
    row.bytes += attachment.file_size;
    const state = (report.attachmentsStored[stored] ??= tally());
    state.count += 1;
    state.bytes += attachment.file_size;
  }
}

function countAuthor(
  report: ImportReport,
  unmatched: Map<number, UnmatchedAuthor>,
  author: ImportedAuthor
): void {
  if (author.authorUserId) report.authors.matchedPosts += 1;
  else if (author.xenforoUserId === null) report.authors.guestPosts += 1;
  else {
    report.authors.unmatchedPosts += 1;
    const row = unmatched.get(author.xenforoUserId) ?? {
      xenforoUserId: author.xenforoUserId,
      name: author.importedAuthorName,
      posts: 0,
    };
    row.posts += 1;
    unmatched.set(author.xenforoUserId, row);
  }
}

export function finishAuthors(report: ImportReport, unmatched: Map<number, UnmatchedAuthor>): void {
  report.authors.unmatchedUsers = unmatched.size;
  report.authors.topUnmatched = [...unmatched.values()]
    .sort((a, b) => b.posts - a.posts || a.xenforoUserId - b.xenforoUserId)
    .slice(0, TOP_UNMATCHED);
}

const nonZero = (counts: Record<string, number>) =>
  Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([name, n]) => `${name} ${n}`)
    .join(", ") || "none";

/** The report as printable lines (the dry run prints these; `--report` writes the JSON). */
export function summarizeImport(report: ImportReport): string[] {
  const { totals, authors, tokens } = report;
  const tallies = (rows: Record<string, { count: number; bytes: number }>) =>
    Object.entries(rows)
      .map(([name, row]) => `${name} ${row.count} (${row.bytes} bytes)`)
      .join(", ") || "none";
  return [
    `Plan: ${totals.categories} archive categories, ${totals.threadsNew} new threads, ${totals.threadsResumed} resumed threads, ${totals.posts} posts (${totals.hiddenThreads} hidden threads, ${totals.hiddenPosts} hidden posts)`,
    "Nodes:",
    ...report.nodes.map(
      (n) =>
        `  ${n.nodeId} "${n.title}" (${n.type}) -> ${n.target} [${n.source}]: ${n.threads} threads, ${n.posts} posts`
    ),
    `Threads in imported nodes: ${nonZero(report.threads)}`,
    `Posts in those threads: ${nonZero(report.posts)}`,
    `Already imported: ${report.alreadyPresent.threads} complete threads, ${report.alreadyPresent.posts} posts`,
    `Authors: ${authors.matchedPosts} posts matched, ${authors.unmatchedPosts} posts by ${authors.unmatchedUsers} unmatched users, ${authors.guestPosts} guest posts`,
    ...authors.topUnmatched.map(
      (a) => `  unmatched: ${a.name} (#${a.xenforoUserId}) ${a.posts} posts`
    ),
    ...authors.duplicates.map(
      (d) =>
        `  forum id ${d.forumUserId} is linked to ${d.userIds.join(", ")}; using ${d.userIds[0]}`
    ),
    `Features: ${nonZero(report.features)}`,
    `Action tokens: ${tokens.kept} kept in ${tokens.posts} posts, ${tokens.stripped} stripped, ${tokens.overLimit} over the limit`,
    `Attachments: ${tallies(report.attachments)}`,
    `Attachments by snapshot state: ${tallies(report.attachmentsStored)}`,
    `Not carried over: ${nonZero(report.notCarried)}`,
    ...report.warnings.map((w) => `WARNING: ${w}`),
  ];
}

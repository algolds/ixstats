/**
 * The XenForo importer's preflight rules and printed lines (scripts/migrations/import-xenforo-forum.ts). Pure.
 */
import {
  attachmentPolicy,
  isStoredComplete,
  isValidAttachmentId,
} from "~/lib/thinkpages-forum/import/attachments";
import type { ResolvedNode } from "~/lib/thinkpages-forum/import/node-map";
import type { ImportReport } from "~/lib/thinkpages-forum/import/report";
import type { AttachmentEntry, SnapshotGaps } from "~/lib/thinkpages-forum/import/snapshot";
import type {
  AttachmentCopyPlan,
  AttachmentCopyResult,
} from "~/server/modules/thinkpages-forum/import-attachments";
import type { RollbackTotals } from "~/server/modules/thinkpages-forum/import-rollback";
import type { ApplyTotals } from "~/server/modules/thinkpages-forum/import-write";

const SHOW_IDS = 20;
/** Free space the copy needs, as a multiple of the bytes it writes (thumbnails and headroom). */
export const DISK_FACTOR = 2;

const ids = (list: readonly number[]) =>
  list.slice(0, SHOW_IDS).join(", ") +
  (list.length > SHOW_IDS ? ` (+${list.length - SHOW_IDS} more)` : "");

/** Why an incomplete snapshot cannot be imported: what the export still has to fetch. */
export function snapshotGapLines(gaps: SnapshotGaps): string[] {
  return [
    ...(gaps.nodesPending ? ["the node list"] : []),
    ...(gaps.forumsWithoutThreads.length
      ? [`forums without threads: ${ids(gaps.forumsWithoutThreads)}`]
      : []),
    ...(gaps.threadsWithoutPosts.length
      ? [`threads without posts: ${ids(gaps.threadsWithoutPosts)}`]
      : []),
    ...(gaps.attachmentsMissing.length ? [`attachments: ${ids(gaps.attachmentsMissing)}`] : []),
  ];
}

/** M6: Forum nodes with neither a map entry nor a heuristic, which fall back to a public archive. */
export const defaultTargetNodes = (resolved: readonly ResolvedNode[]) =>
  resolved.filter((r) => r.node.node_type_id === "Forum" && r.source === "default");

/**
 * Why --apply must refuse: the plan's blocking problems, and default-placed Forum nodes unless accepted (the
 * export bypasses permissions, so a private board with an ordinary title would land in a public archive).
 */
export function applyRefusals(input: {
  blocking: readonly string[];
  defaults: readonly ResolvedNode[];
  acceptDefaults: boolean;
}): string[] {
  const defaults = input.acceptDefaults
    ? []
    : input.defaults.map(
        ({ node }) =>
          `Node ${node.node_id} "${node.title}" has no node map entry and falls back to a public archive: map it, or pass --accept-defaults.`
      );
  return [...input.blocking, ...defaults];
}

/** Preflight on the uploads directory: writable, and at least DISK_FACTOR times the bytes to copy free. */
export function diskRefusal(input: {
  dir: string;
  writable: boolean;
  freeBytes: number | null;
  plannedBytes: number;
}): string | null {
  if (!input.writable) return `${input.dir} is not writable (UPLOAD_DIR).`;
  const needed = input.plannedBytes * DISK_FACTOR;
  if (input.plannedBytes > 0 && (input.freeBytes === null || input.freeBytes < needed)) {
    return `${input.dir} has ${input.freeBytes ?? "unknown"} bytes free; the copy needs ${needed} (${DISK_FACTOR}x ${input.plannedBytes}).`;
  }
  return null;
}

function omissionOf(
  entry: AttachmentEntry,
  plan: AttachmentCopyPlan,
  planned: ReadonlySet<number>
): string | null {
  const id = entry.attachment_id;
  if (!isValidAttachmentId(id)) return "invalid id";
  if (planned.has(id)) return null;
  const policy = attachmentPolicy(entry);
  if (policy.kind === "omit")
    return policy.reason === "type" ? "type not kept" : "over the size limit";
  if (!isStoredComplete(entry)) return `snapshot ${entry.stored}`;
  if (plan.missing.includes(id)) return "snapshot file missing or short";
  if (plan.signatureMismatch.includes(id)) return "bytes do not match the type";
  return "post not imported";
}

/** Snapshot attachments the copy leaves out, by reason. */
export function omittedByReason(
  attachments: Iterable<AttachmentEntry>,
  plan: AttachmentCopyPlan
): Map<string, number> {
  const planned = new Set(plan.attachments.map((a) => a.entry.attachment_id));
  const out = new Map<string, number>();
  for (const entry of attachments) {
    const reason = omissionOf(entry, plan, planned);
    if (reason) out.set(reason, (out.get(reason) ?? 0) + 1);
  }
  return out;
}

const listed = (counts: ReadonlyMap<string, number>) =>
  [...counts].map(([name, n]) => `${name} ${n}`).join(", ") || "none";

export function attachmentPlanLines(
  attachments: Iterable<AttachmentEntry>,
  plan: AttachmentCopyPlan
): string[] {
  const images = plan.attachments.filter((a) => a.kind === "image").length;
  const restricted = plan.attachments.filter((a) => a.visibility === "restricted").length;
  return [
    `Attachment copy: ${plan.attachments.length} kept (${images} images, ${plan.attachments.length - images} links; ${restricted} restricted), ${plan.attachments.length - plan.skipped} to copy (${plan.bytes} bytes on disk), ${plan.skipped} already on disk`,
    `  missing or short snapshot files ${plan.missing.length}, signature mismatches ${plan.signatureMismatch.length}, invalid ids ${plan.invalidIds}`,
    `  omitted by reason: ${listed(omittedByReason(attachments, plan))}`,
  ];
}

export function attachmentResultLines(result: AttachmentCopyResult): string[] {
  const failed = new Map<string, number>();
  for (const f of result.assetsFailed) failed.set(f.reason, (failed.get(f.reason) ?? 0) + 1);
  return [
    `Attachments: ${result.copied} copied (${result.bytes} bytes), ${result.skipped} already on disk, ${result.missing.length} missing`,
    `  media assets: ${result.registered} registered, ${result.assetsPending.length} pending (a rerun retries), failed: ${listed(failed)}`,
  ];
}

export function applyTotalLines(totals: ApplyTotals): string[] {
  return [
    `Applied: ${totals.categoriesCreated} archive categories created`,
    `  threads: ${totals.threadsCreated} created, ${totals.threadsResumed} resumed`,
    `  posts: ${totals.postsCreated} created, ${totals.postsPresent} already present`,
    `  action links remapped: ${totals.linksRemapped} with their posts, ${totals.bridgeLinks.remapped} made by the bridge since (${totals.bridgeLinks.twins} already on the native post)`,
    `  authors relinked: ${totals.relinked.threads} threads, ${totals.relinked.posts} posts`,
  ];
}

export function rollbackLines(totals: RollbackTotals): string[] {
  return [
    `Rolled back: ${totals.threads} threads, ${totals.posts} posts (${totals.nativeReplies} native replies on imported threads)`,
    `  action links: ${totals.linksRestored} returned to their XenForo post, ${totals.linksDeleted} deleted`,
    `  archive categories ${totals.categories}, node map rows ${totals.nodeMap}, media assets ${totals.assets}, files ${totals.files}`,
  ];
}

/** The `--report` file: the plan report, the copy plan's counts and each kept attachment's stored name. */
export function reportFile(report: ImportReport, plan: AttachmentCopyPlan): string {
  const { dir, bytes, skipped, missing, signatureMismatch, invalidIds } = plan;
  const kept = plan.attachments.map((a) => ({
    id: a.entry.attachment_id,
    file: a.fileName,
    visibility: a.visibility,
  }));
  const copy = { dir, bytes, skipped, missing, signatureMismatch, invalidIds };
  return JSON.stringify({ report, copy, kept }, null, 2);
}

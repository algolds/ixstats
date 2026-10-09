/**
 * Copies imported XenForo attachments into `<uploadsDir>/forum/` and registers the images as "Forum" media assets
 * (phase 4, Q7, R2, R3). Two steps, so the dry run can report the disk use and the planner can render bodies:
 *   planAttachmentCopies: hashes each usable snapshot file into its stored name and says which copies are needed
 *     (no writes); its `attachmentFor` feeds `ImportDbState.attachmentFor`.
 *   copyAttachments (--apply): writes the files that are absent or of another size, then registers every image
 *     (idempotent by the attachment id). PDFs are copied but not registered (R2). A registration failure never
 *     fails the import: retryable ones are pending (a rerun retries), the rest are failed with their reason.
 * `fs` is injected; the default is the real disk.
 */
import { promises as nodeFs } from "fs";
import path from "path";
import {
  attachmentFileName,
  attachmentPolicy,
  attachmentUrl,
  isStoredComplete,
  normalizedMime,
  postVisibilities,
  type AttachmentVisibility,
  type SiteCategoryVisibility,
  type VisibilitySnapshot,
} from "~/lib/thinkpages-forum/import/attachments";
import type { NodeMapFile } from "~/lib/thinkpages-forum/import/node-map";
import type { AttachmentOutcome } from "~/lib/thinkpages-forum/import/post-html";
import type { AttachmentEntry, Snapshot } from "~/lib/thinkpages-forum/import/snapshot";
import {
  registerUploadedAsset,
  type RegisterUploadedAssetFailure,
  type RegisterUploadedAssetResult,
} from "~/server/shared/uploaded-assets";

export interface AttachmentFs {
  readFile(file: string): Promise<Uint8Array>;
  /** The file's size in bytes, or null when it does not exist. */
  sizeOf(file: string): Promise<number | null>;
  /** Creates the directory and its parents; no error when it exists. */
  mkdir(dir: string): Promise<void>;
  writeFile(file: string, bytes: Uint8Array): Promise<void>;
}

const diskFs: AttachmentFs = {
  readFile: (file) => nodeFs.readFile(file),
  sizeOf: (file) =>
    nodeFs.stat(file).then(
      (s) => (s.isFile() ? s.size : null),
      () => null
    ),
  mkdir: async (dir) => {
    await nodeFs.mkdir(dir, { recursive: true });
  },
  writeFile: (file, bytes) => nodeFs.writeFile(file, bytes),
};

export type AttachmentSnapshot = VisibilitySnapshot &
  Pick<Snapshot, "attachments" | "attachmentPath">;

export interface PlannedAttachment {
  entry: AttachmentEntry;
  kind: "image" | "link";
  mimeType: string;
  fileName: string;
  url: string;
  /** The snapshot's `attachments/<id>.bin`. */
  source: string;
  /** Absolute path under `<uploadsDir>/forum/`. */
  target: string;
  visibility: AttachmentVisibility;
  /** False when the target already holds a file of this size (checked again when copying). */
  copy: boolean;
}

export interface AttachmentCopyPlan {
  /** The forum directory under uploadsDir. */
  dir: string;
  attachments: PlannedAttachment[];
  /** How each attachment renders: planned ones inline or as a link, every other one "omitted". */
  attachmentFor: (attachmentId: number) => AttachmentOutcome;
  /** Bytes the copy writes (image thumbnails come on top, each smaller than its image). */
  bytes: number;
  /** Already on disk at the right size. */
  skipped: number;
  /** Usable entries whose snapshot file is absent or not the recorded size; rendered as omitted. */
  missing: number[];
}

export interface AttachmentCopyOptions {
  uploadsDir: string;
  /** The database's sitewide categories, so a mapped key takes its current visibility (default: the seeds). */
  siteCategories?: readonly SiteCategoryVisibility[];
  fs?: AttachmentFs;
  log?: (line: string) => void;
}

export interface AttachmentCopyResult {
  copied: number;
  skipped: number;
  bytes: number;
  missing: number[];
  registered: number;
  assetsPending: number[];
  assetsFailed: Array<{ attachmentId: number; reason: RegisterUploadedAssetFailure }>;
}

async function planOne(
  entry: AttachmentEntry,
  visibility: AttachmentVisibility,
  snapshot: AttachmentSnapshot,
  dir: string,
  fs: AttachmentFs
): Promise<PlannedAttachment | "missing" | null> {
  const policy = attachmentPolicy(entry);
  if (policy.kind === "omit" || !isStoredComplete(entry)) return null;
  const source = snapshot.attachmentPath(entry.attachment_id);
  if ((await fs.sizeOf(source)) !== entry.file_size) return "missing";
  const fileName = attachmentFileName(entry, await fs.readFile(source), policy.extension);
  const target = path.join(dir, fileName);
  return {
    entry,
    kind: policy.kind,
    mimeType: normalizedMime(entry.content_type),
    fileName,
    url: attachmentUrl(fileName),
    source,
    target,
    visibility,
    copy: (await fs.sizeOf(target)) !== entry.file_size,
  };
}

/** The dry run: names, visibilities and the bytes to write for every attachment the import keeps. No writes. */
export async function planAttachmentCopies(
  snapshot: AttachmentSnapshot,
  nodeMap: NodeMapFile | null,
  opts: AttachmentCopyOptions
): Promise<AttachmentCopyPlan> {
  const fs = opts.fs ?? diskFs;
  const dir = path.join(path.resolve(opts.uploadsDir), "forum");
  const visibilities = postVisibilities(snapshot, nodeMap, opts.siteCategories);
  const attachments: PlannedAttachment[] = [];
  const missing: number[] = [];
  for (const entry of snapshot.attachments.values()) {
    const visibility = visibilities.get(entry.post_id);
    if (!visibility) continue;
    const planned = await planOne(entry, visibility, snapshot, dir, fs);
    if (planned === "missing") missing.push(entry.attachment_id);
    else if (planned) attachments.push(planned);
  }
  const byId = new Map(attachments.map((a) => [a.entry.attachment_id, a]));
  const toCopy = attachments.filter((a) => a.copy);
  return {
    dir,
    attachments,
    attachmentFor: (id) => {
      const a = byId.get(id);
      return a ? { kind: a.kind, url: a.url, filename: a.entry.filename } : "omitted";
    },
    bytes: toCopy.reduce((n, a) => n + a.entry.file_size, 0),
    skipped: attachments.length - toCopy.length,
    missing,
  };
}

/** Records a copied image as a "Forum" media asset (restricted for hidden posts and non-public categories). */
export function registerImportedImage(a: PlannedAttachment): Promise<RegisterUploadedAssetResult> {
  return registerUploadedAsset({
    filePath: a.target,
    url: a.url,
    mimeType: a.mimeType,
    source: "forum",
    uploaderClerkId: null,
    sourceRef: String(a.entry.attachment_id),
    title: a.entry.filename,
    visibility: a.visibility,
  });
}

/** Writes the file when the target is absent or of another size; "missing" when the snapshot file is gone. */
async function copyOne(
  a: PlannedAttachment,
  fs: AttachmentFs
): Promise<"copied" | "skipped" | "missing"> {
  if ((await fs.sizeOf(a.target)) === a.entry.file_size) return "skipped";
  if ((await fs.sizeOf(a.source)) !== a.entry.file_size) return "missing";
  await fs.writeFile(a.target, await fs.readFile(a.source));
  return "copied";
}

async function register(
  a: PlannedAttachment,
  result: AttachmentCopyResult,
  log: (line: string) => void
) {
  const outcome = await registerImportedImage(a);
  if (outcome.ok) {
    result.registered += 1;
    return;
  }
  const id = a.entry.attachment_id;
  if (outcome.retryable) result.assetsPending.push(id);
  else result.assetsFailed.push({ attachmentId: id, reason: outcome.reason });
  log(
    `Attachment ${id}: not registered (${outcome.reason}${outcome.retryable ? ", retried by a rerun" : ""})`
  );
}

/** --apply: copies the planned attachments and registers the images. Never fails on a registration. */
export async function copyAttachments(
  plan: AttachmentCopyPlan,
  opts: Pick<AttachmentCopyOptions, "fs" | "log"> = {}
): Promise<AttachmentCopyResult> {
  const fs = opts.fs ?? diskFs;
  const log = opts.log ?? (() => {});
  const result: AttachmentCopyResult = {
    copied: 0,
    skipped: 0,
    bytes: 0,
    missing: [...plan.missing],
    registered: 0,
    assetsPending: [],
    assetsFailed: [],
  };
  await fs.mkdir(plan.dir);
  for (const a of plan.attachments) {
    const copy = await copyOne(a, fs);
    if (copy === "missing") {
      result.missing.push(a.entry.attachment_id);
      log(`Attachment ${a.entry.attachment_id}: snapshot file gone, not copied`);
      continue;
    }
    result[copy] += 1;
    if (copy === "copied") result.bytes += a.entry.file_size;
    if (a.kind === "image") await register(a, result, log);
  }
  return result;
}

/**
 * Copies imported XenForo attachments into `<uploadsDir>/forum/` and registers the images as "Forum" media assets
 * (phase 4, Q7, R2, R3). Two steps, so the dry run can report the disk use and the planner can render bodies:
 *   planAttachmentCopies: hashes each usable snapshot file into its stored name and says which copies are needed
 *     (no writes); its `attachmentFor` feeds `ImportDbState.attachmentFor`.
 *   copyAttachments (--apply): writes the files that are absent or of another size (M9: the source read once, its
 *     bytes checked against the planned hash, type and size, written to a temp file in the same directory and
 *     renamed), then registers an image only when it was copied now, has no asset row yet, or its stored visibility
 *     differs (M10; registration re-makes the thumbnail and blurhash). PDFs are copied but not registered (R2). A
 *     registration failure never fails the import: retryable ones are pending (a rerun retries), the rest are failed
 *     with their reason, and the runner exits 2 on those (M14).
 * Visibility: the snapshot decides (hidden post or thread, non-public category), and `restrictedPosts` (posts the
 * database holds as hidden or in a non-public category, built by the runner) overrides it: restricted always wins,
 * so a rerun never re-registers as public an image whose post was hidden or moved after the first import.
 * The directory is always `uploadsDir()`: registerUploadedAsset refuses files outside it, so any other directory is
 * refused before anything is read or written. `fs` is injected; the default is the real disk.
 */
import { promises as nodeFs } from "fs";
import path from "path";
import {
  attachmentFileName,
  attachmentPolicy,
  attachmentUrl,
  hasSignature,
  isStoredComplete,
  isValidAttachmentId,
  normalizedMime,
  postVisibilities,
  type AttachmentVisibility,
  type VisibilitySnapshot,
} from "~/lib/thinkpages-forum/import/attachments";
import type { SiteCategoryVisibility } from "~/lib/thinkpages-forum/import/visibility";
import type { NodeMapFile } from "~/lib/thinkpages-forum/import/node-map";
import type { AttachmentOutcome } from "~/lib/thinkpages-forum/import/post-html";
import type { AttachmentEntry, Snapshot } from "~/lib/thinkpages-forum/import/snapshot";
import {
  registerUploadedAsset,
  type RegisterUploadedAssetFailure,
  type RegisterUploadedAssetResult,
} from "~/server/shared/uploaded-assets";
import { uploadsDir } from "~/server/shared/upload-storage";

export interface AttachmentFs {
  readFile(file: string): Promise<Uint8Array>;
  /** The file's size in bytes, or null when it does not exist. */
  sizeOf(file: string): Promise<number | null>;
  /** Creates the directory and its parents; no error when it exists. */
  mkdir(dir: string): Promise<void>;
  writeFile(file: string, bytes: Uint8Array): Promise<void>;
  /** Replaces `to` atomically (same directory). */
  rename(from: string, to: string): Promise<void>;
  /** Removes the file; no error when it does not exist. */
  remove(file: string): Promise<void>;
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
  rename: (from, to) => nodeFs.rename(from, to),
  remove: (file) => nodeFs.rm(file, { force: true }),
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
  /** Files that do not start with their type's signature; rendered as omitted. */
  signatureMismatch: number[];
  /** Snapshot entries whose id is not a positive integer; skipped. */
  invalidIds: number;
}

export interface AttachmentCopyOptions {
  /** Defaults to uploadsDir(); any other directory is refused (registration only accepts files inside it). */
  uploadsDir?: string;
  /** XenForo post ids the database holds as hidden or in a non-public category: restricted wins. */
  restrictedPosts?: ReadonlySet<number>;
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
  /** Images already registered with the same visibility: not registered again (M10). */
  alreadyRegistered: number;
  assetsPending: number[];
  assetsFailed: Array<{ attachmentId: number; reason: RegisterUploadedAssetFailure }>;
}

/** `<uploadsDir()>/forum`; throws when `explicit` names another directory. */
function forumDir(explicit?: string): string {
  const root = path.resolve(uploadsDir());
  if (explicit !== undefined && path.resolve(explicit) !== root) {
    throw new Error(
      `Attachments must be copied into uploadsDir() (${root}), not ${path.resolve(explicit)}: registerUploadedAsset refuses files outside it. Set UPLOAD_DIR instead.`
    );
  }
  return path.join(root, "forum");
}

async function planOne(
  entry: AttachmentEntry,
  visibility: AttachmentVisibility,
  snapshot: AttachmentSnapshot,
  dir: string,
  fs: AttachmentFs
): Promise<PlannedAttachment | "missing" | "signature" | null> {
  const policy = attachmentPolicy(entry);
  if (policy.kind === "omit" || !isStoredComplete(entry)) return null;
  const source = snapshot.attachmentPath(entry.attachment_id);
  if ((await fs.sizeOf(source)) !== entry.file_size) return "missing";
  const bytes = await fs.readFile(source);
  if (!hasSignature(policy, bytes)) return "signature";
  const fileName = attachmentFileName(entry, bytes, policy.extension);
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
  opts: AttachmentCopyOptions = {}
): Promise<AttachmentCopyPlan> {
  const fs = opts.fs ?? diskFs;
  const dir = forumDir(opts.uploadsDir);
  const visibilities = postVisibilities(snapshot, nodeMap, opts.siteCategories);
  const restricted = opts.restrictedPosts ?? new Set<number>();
  const attachments: PlannedAttachment[] = [];
  const refused = { missing: [] as number[], signature: [] as number[] };
  let invalidIds = 0;
  for (const entry of snapshot.attachments.values()) {
    if (!isValidAttachmentId(entry.attachment_id)) {
      invalidIds += 1;
      continue;
    }
    const fromSnapshot = visibilities.get(entry.post_id);
    if (!fromSnapshot) continue;
    const visibility = restricted.has(entry.post_id) ? "restricted" : fromSnapshot;
    const planned = await planOne(entry, visibility, snapshot, dir, fs);
    if (typeof planned === "string") refused[planned].push(entry.attachment_id);
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
    missing: refused.missing,
    signatureMismatch: refused.signature,
    invalidIds,
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

/** The snapshot file's bytes when they are still the ones the plan hashed (size, type signature, name hash). */
async function plannedBytes(a: PlannedAttachment, fs: AttachmentFs): Promise<Uint8Array | null> {
  if ((await fs.sizeOf(a.source)) !== a.entry.file_size) return null;
  const bytes = await fs.readFile(a.source);
  const policy = attachmentPolicy(a.entry);
  if (policy.kind === "omit" || bytes.length !== a.entry.file_size) return null;
  if (!hasSignature(policy, bytes)) return null;
  return attachmentFileName(a.entry, bytes, policy.extension) === a.fileName ? bytes : null;
}

/** `.<name>.partial` beside the target: never matches the import's file names (the rollback leaves it alone). */
const tempPath = (target: string) =>
  path.join(path.dirname(target), `.${path.basename(target)}.partial`);

/**
 * Writes the file when the target is absent or of another size (checked now, not only at planning): the bytes read
 * once and checked against the plan, then a temp file renamed over the target. "missing" when the snapshot file is
 * gone or no longer the planned bytes.
 */
async function copyOne(
  a: PlannedAttachment,
  fs: AttachmentFs
): Promise<"copied" | "skipped" | "missing"> {
  if ((await fs.sizeOf(a.target)) === a.entry.file_size) return "skipped";
  const bytes = await plannedBytes(a, fs);
  if (!bytes) return "missing";
  const temp = tempPath(a.target);
  try {
    await fs.writeFile(temp, bytes);
    await fs.rename(temp, a.target);
  } catch (error) {
    await fs.remove(temp);
    throw error;
  }
  return "copied";
}

/** M10: register when copied now, when no asset row exists, or when the stored visibility differs. */
export function needsRegistration(
  a: Pick<PlannedAttachment, "entry" | "visibility">,
  copied: boolean,
  stored: ReadonlyMap<string, string>
): boolean {
  return copied || stored.get(String(a.entry.attachment_id)) !== a.visibility;
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

/**
 * --apply: copies the planned attachments and registers the images that need it. `assets` is the "forum" asset rows
 * already stored, sourceRef → visibility (import-db's `forumAssetVisibilities`). Never fails on a registration.
 */
export async function copyAttachments(
  plan: AttachmentCopyPlan,
  opts: Pick<AttachmentCopyOptions, "fs" | "log"> & { assets?: ReadonlyMap<string, string> } = {}
): Promise<AttachmentCopyResult> {
  const fs = opts.fs ?? diskFs;
  const log = opts.log ?? (() => {});
  const stored = opts.assets ?? new Map<string, string>();
  forumDir(path.dirname(plan.dir));
  const result: AttachmentCopyResult = {
    copied: 0,
    skipped: 0,
    bytes: 0,
    missing: [...plan.missing],
    registered: 0,
    alreadyRegistered: 0,
    assetsPending: [],
    assetsFailed: [],
  };
  await fs.mkdir(plan.dir);
  for (const a of plan.attachments) {
    const copy = await copyOne(a, fs);
    if (copy === "missing") {
      result.missing.push(a.entry.attachment_id);
      log(
        `Attachment ${a.entry.attachment_id}: snapshot file gone or changed since the plan, not copied`
      );
      continue;
    }
    result[copy] += 1;
    if (copy === "copied") result.bytes += a.entry.file_size;
    if (a.kind !== "image") continue;
    if (needsRegistration(a, copy === "copied", stored)) await register(a, result, log);
    else result.alreadyRegistered += 1;
  }
  return result;
}

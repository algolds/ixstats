/**
 * XenForo attachments in the import (phase 4, Q7, R2, R3). Pure: which attachments are kept and how they render,
 * their content-hash file names, and whether each lands as a public or a restricted asset. The copy itself lives
 * in the forum module (import-attachments.ts).
 *
 * Images (png, jpeg, gif, webp) up to 20 MB render inline; PDFs up to 25 MB render as a plain link (the sanitizer
 * drops `download`); everything else, SVG included, is omitted. Uploads are served publicly without auth, so a
 * stored name carries a hash of the bytes and cannot be guessed from the sequential XenForo id. Bytes must start
 * with their type's signature (a "PNG" that is not one is omitted), and only positive integer ids name a file.
 */
import { createHash } from "crypto";
import { resolveNodeTargets, type NodeMapFile } from "./node-map";
import type { AttachmentEntry, Snapshot } from "./snapshot";
import { categoryVisibility, importedThread, type SiteCategoryVisibility } from "./visibility";

/** Served path of the copied files (UPLOADS_URL_PREFIX + "forum/"); stored HTML never carries a base path. */
export const ATTACHMENT_URL_PREFIX = "/images/uploads/forum/";

const MB = 1024 * 1024;
const NAME_MAX = 60;
const HASH_HEX = 12;

/** Bytes a file of the type starts with: [offset, ASCII or byte values] pairs, all of which must match. */
type Signature = ReadonlyArray<readonly [number, readonly number[]]>;

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));

export interface KeptAttachment {
  kind: "image" | "link";
  maxBytes: number;
  /** The stored file's extension, taken from the type and never from the uploaded name. */
  extension: string;
  signature: Signature;
}

const KEPT: Readonly<Record<string, KeptAttachment>> = {
  "image/png": {
    kind: "image",
    maxBytes: 20 * MB,
    extension: "png",
    signature: [[0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]]],
  },
  "image/jpeg": {
    kind: "image",
    maxBytes: 20 * MB,
    extension: "jpg",
    signature: [[0, [0xff, 0xd8, 0xff]]],
  },
  "image/gif": {
    kind: "image",
    maxBytes: 20 * MB,
    extension: "gif",
    signature: [[0, ascii("GIF8")]],
  },
  "image/webp": {
    kind: "image",
    maxBytes: 20 * MB,
    extension: "webp",
    signature: [
      [0, ascii("RIFF")],
      [8, ascii("WEBP")],
    ],
  },
  "application/pdf": {
    kind: "link",
    maxBytes: 25 * MB,
    extension: "pdf",
    signature: [[0, ascii("%PDF-")]],
  },
};

// Non-standard names older XenForo data (and browsers) still send.
const MIME_ALIASES: Readonly<Record<string, string>> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
};

export type AttachmentPolicy = KeptAttachment | { kind: "omit"; reason: "type" | "oversize" };

/** "Image/PNG; charset=binary" → "image/png"; aliases ("image/jpg", "image/x-png") → the standard type. */
export function normalizedMime(contentType: string): string {
  const mime = (contentType.split(";")[0] ?? "").trim().toLowerCase();
  return MIME_ALIASES[mime] ?? mime;
}

/** Whether `bytes` start with the kept type's signature. */
export const hasSignature = (policy: KeptAttachment, bytes: Uint8Array) =>
  policy.signature.every(([offset, expected]) =>
    expected.every((byte, i) => bytes[offset + i] === byte)
  );

/** Snapshot JSON is not validated: only a positive safe integer may name a file. */
export const isValidAttachmentId = (id: number) => Number.isSafeInteger(id) && id > 0;

export function attachmentPolicy(
  a: Pick<AttachmentEntry, "content_type" | "file_size">
): AttachmentPolicy {
  const kept = KEPT[normalizedMime(a.content_type)];
  if (!kept) return { kind: "omit", reason: "type" };
  return a.file_size > kept.maxBytes ? { kind: "omit", reason: "oversize" } : kept;
}

/** Only an entry stored "ok" whose downloaded bytes are the recorded size has a usable file. */
export const isStoredComplete = (e: AttachmentEntry) =>
  e.stored === "ok" && (e.received_size ?? e.file_size) === e.file_size;

/** The uploaded name's last path segment without its extension, reduced to [A-Za-z0-9_-]. */
function safeStem(filename: string, max: number): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const stem = (dot > 0 ? base.slice(0, dot) : base).replace(/[^A-Za-z0-9_-]+/g, "-");
  return stem.replace(/^-+/, "").slice(0, max).replace(/-+$/, "") || "file";
}

/**
 * `<attachment_id>-<sha256(bytes) first 12 hex>-<safe basename, at most 60>`: stable across reruns, not
 * enumerable. One dot only, before the type's extension, so a name never ends in `.thumb.webp` (the asset
 * thumbnails) and never smuggles a second extension.
 */
export function attachmentFileName(
  a: Pick<AttachmentEntry, "attachment_id" | "filename">,
  bytes: Uint8Array,
  extension: string
): string {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, HASH_HEX);
  const stem = safeStem(a.filename, NAME_MAX - extension.length - 1);
  return `${a.attachment_id}-${hash}-${stem}.${extension}`;
}

export const attachmentUrl = (fileName: string) => `${ATTACHMENT_URL_PREFIX}${fileName}`;

export type AttachmentVisibility = "public" | "restricted";

export type VisibilitySnapshot = Pick<Snapshot, "nodes" | "threads" | "postsByThread">;

/**
 * XenForo post id → the visibility its attachments are registered with: "restricted" when the post or its thread
 * is hidden (moderated, or a moderated first post) or the category is not public; never public by mistake. Posts
 * the import leaves out are absent.
 */
export function postVisibilities(
  snapshot: VisibilitySnapshot,
  nodeMap: NodeMapFile | null,
  siteCategories: readonly SiteCategoryVisibility[] = []
): Map<number, AttachmentVisibility> {
  const nodeVisibility = new Map(
    resolveNodeTargets(snapshot.nodes, nodeMap).map((r) => [
      r.node.node_id,
      categoryVisibility(r.target, siteCategories),
    ])
  );
  const out = new Map<number, AttachmentVisibility>();
  for (const thread of snapshot.threads) {
    const category = nodeVisibility.get(thread.node_id);
    if (!category) continue;
    const imported = importedThread(thread, snapshot.postsByThread.get(thread.thread_id) ?? []);
    if ("skip" in imported) continue;
    const threadHidden = category !== "public" || imported.hidden;
    for (const post of imported.posts) {
      const hidden = threadHidden || post.message_state === "moderated";
      out.set(post.post_id, hidden ? "restricted" : "public");
    }
  }
  return out;
}

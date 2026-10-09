/**
 * XenForo attachments in the import (phase 4, Q7, R2, R3). Pure: which attachments are kept and how they render,
 * their content-hash file names, and whether each lands as a public or a restricted asset. The copy itself lives
 * in the forum module (import-attachments.ts).
 *
 * Images (png, jpeg, gif, webp) up to 20 MB render inline; PDFs up to 25 MB render as a plain link (the sanitizer
 * drops `download`); everything else, SVG included, is omitted. Uploads are served publicly without auth, so a
 * stored name carries a hash of the bytes and cannot be guessed from the sequential XenForo id.
 */
import { createHash } from "crypto";
import { SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import { resolveNodeTargets, type NodeMapFile, type NodeTarget } from "./node-map";
import type { AttachmentEntry, Snapshot } from "./snapshot";
import type { XfPost } from "./xenforo-types";

/** Served path of the copied files (UPLOADS_URL_PREFIX + "forum/"); stored HTML never carries a base path. */
export const ATTACHMENT_URL_PREFIX = "/images/uploads/forum/";

const MB = 1024 * 1024;
const NAME_MAX = 60;
const HASH_HEX = 12;

interface Kept {
  kind: "image" | "link";
  maxBytes: number;
  /** The stored file's extension, taken from the type and never from the uploaded name. */
  extension: string;
}

const KEPT: Readonly<Record<string, Kept>> = {
  "image/png": { kind: "image", maxBytes: 20 * MB, extension: "png" },
  "image/jpeg": { kind: "image", maxBytes: 20 * MB, extension: "jpg" },
  "image/gif": { kind: "image", maxBytes: 20 * MB, extension: "gif" },
  "image/webp": { kind: "image", maxBytes: 20 * MB, extension: "webp" },
  "application/pdf": { kind: "link", maxBytes: 25 * MB, extension: "pdf" },
};

export type AttachmentPolicy = Kept | { kind: "omit"; reason: "type" | "oversize" };

/** "Image/PNG; charset=binary" → "image/png". */
export const normalizedMime = (contentType: string) =>
  (contentType.split(";")[0] ?? "").trim().toLowerCase();

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

/** A sitewide category's visibility as the database holds it (ImportDbState.siteCategories). */
export interface SiteCategoryVisibility {
  key: string;
  visibility: string;
}

/**
 * The category visibility a node target lands in (null: skipped). A sitewide key is looked up in the database's
 * categories, then the seeds; a key found in neither counts as not public, so its files are never public by mistake.
 */
function targetVisibility(
  target: NodeTarget,
  site: readonly SiteCategoryVisibility[]
): string | null {
  if ("skip" in target) return null;
  if ("archive" in target) return target.visibility ?? "public";
  if (target.scope === "realm") return "public";
  const known = [...site, ...SITE_CATEGORIES].find((c) => c.key === target.key);
  return known?.visibility ?? "unknown";
}

/** The posts the plan imports and the thread's first post; null when the thread is not imported. */
function importedPosts(posts: readonly XfPost[], threadState: string) {
  const first = posts.find((p) => p.is_first_post) ?? posts[0];
  if (!first || threadState === "deleted" || first.message_state === "deleted") return null;
  return { first, posts: posts.filter((p) => p.message_state !== "deleted") };
}

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
      targetVisibility(r.target, siteCategories),
    ])
  );
  const out = new Map<number, AttachmentVisibility>();
  for (const thread of snapshot.threads) {
    const category = nodeVisibility.get(thread.node_id);
    if (!category) continue;
    const imported = importedPosts(
      snapshot.postsByThread.get(thread.thread_id) ?? [],
      thread.discussion_state
    );
    if (!imported) continue;
    // A moderated first post hides its thread (phase 3 never hides a first post alone).
    const threadHidden =
      category !== "public" ||
      thread.discussion_state === "moderated" ||
      imported.first.message_state === "moderated";
    for (const post of imported.posts) {
      const hidden = threadHidden || post.message_state === "moderated";
      out.set(post.post_id, hidden ? "restricted" : "public");
    }
  }
  return out;
}

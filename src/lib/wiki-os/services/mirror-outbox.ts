/**
 * mirror-outbox.ts — the durable outbox of the outbound mirror (WikiOS -> classic MediaWiki).
 *
 * A WikiOS write that classic MediaWiki must receive (a saved revision, a move, a delete, an undelete, a
 * protection, an uploaded file) inserts its job in the SAME transaction as the change itself, so a committed edit always has
 * its job and a rolled-back one never does. The jobs are applied by services/mirror-worker.ts: on the
 * `wiki-mirror` cron job, and in-process shortly after a write (`scheduleMirrorKick`).
 *
 * Only the `ixwiki` realm has a classic MediaWiki to mirror to, and not its `MediaWiki:` namespace (see `isMirrored`):
 * a write to anything else enqueues nothing.
 * This module holds no MediaWiki code and imports no worker at load time, so the repositories can use it.
 */

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { canonicalizeTitle } from "../core/title";

/** The one realm that is mirrored. */
export const MIRROR_SOURCE = "ixwiki";
/** The `MediaWiki:` namespace: site messages, behind the `editinterface` right the mirror account must never hold. */
const INTERFACE_NAMESPACE = 8;
/** Name of the cron job and of its advisory lock: the cron runner and the in-process kick share it. */
export const MIRROR_LOCK_NAME = "wiki-mirror";

export type MirrorJobKind = "revision" | "move" | "delete" | "undelete" | "protect" | "upload";

/** `revision`: `restore` pushes the page's head again (a park's re-push): dated now, credited to the mirror. */
export const revisionPayloadSchema = z.object({
  restore: z.boolean().default(false),
  /** The edit summary a restore carries (the revision's own summary is not the reason for this push). */
  summary: z.string().optional(),
  /** Written when the job is done in a way worth knowing about (see mirror-revision.ts); never by the enqueuer. */
  note: z.string().optional(),
});
export type RevisionPayload = z.infer<typeof revisionPayloadSchema>;

export const movePayloadSchema = z.object({
  /** The canonical title the page moved to (the job's own `title` is where it moved from). */
  to: z.string(),
  reason: z.string(),
  leaveRedirect: z.boolean(),
});
export type MovePayload = z.infer<typeof movePayloadSchema>;

export const reasonPayloadSchema = z.object({ reason: z.string() });
export type ReasonPayload = z.infer<typeof reasonPayloadSchema>;

export const protectPayloadSchema = z.object({
  reason: z.string(),
  restrictions: z.array(
    z.object({
      action: z.enum(["edit", "move", "create", "upload"]),
      /** null removes the restriction. */
      level: z.enum(["autoconfirmed", "sysop"]).nullable(),
      /** ISO timestamp; null = never. */
      expiresAt: z.string().nullable(),
    })
  ),
});
export type ProtectPayload = z.infer<typeof protectPayloadSchema>;

/**
 * `upload`: put the file staged under `sha1` (a version of the job's `File:` title) in MediaWiki, with `comment` as the
 * version's comment. The bytes are in the staging directory (services/upload-staging.ts), never in the row.
 */
export const uploadPayloadSchema = z.object({
  /** `wiki_assets.sha1`: the staged file's name. */
  sha1: z.string(),
  comment: z.string(),
});
export type UploadPayload = z.infer<typeof uploadPayloadSchema>;

type Tx = Prisma.TransactionClient;

interface PageJobBase {
  /** The page the operation is about, canonical: where a move moves FROM. */
  title: string;
  articleId: string | null;
  /** The `WikiLog` row written in the same transaction. */
  logId: string;
  source?: string;
}

export interface RevisionJobInput {
  title: string;
  articleId: string;
  revisionId: string;
  source?: string;
  /** Push the page's head again: `summary` is the edit summary of that push. */
  restore?: { summary: string };
}

/**
 * Whether a write to `titles` of `source` is mirrored at all: only the ixwiki realm is, and never the `MediaWiki:`
 * namespace. MediaWiki refuses the mirror account every write there (an import silently skips it, an edit is
 * `protectednamespace-interface`), so such a job could only burn its attempts, go dead and block its title.
 *
 * A move is judged by BOTH of its titles: a move into or out of the `MediaWiki:` namespace enqueues nothing, not even
 * for its other side, so classic MediaWiki keeps the page under its OLD title while WikiOS has it under the new one
 * (revisions saved later under a mirrored new title are mirrored as usual, as revisions of that title). An
 * administrator who wants the two wikis to agree moves the page in MediaWiki as well.
 */
function isMirrored(source: string | undefined, titles: readonly string[]): boolean {
  return (
    (source ?? MIRROR_SOURCE) === MIRROR_SOURCE &&
    titles.every(
      (title) =>
        canonicalizeTitle(title, { source: MIRROR_SOURCE })?.namespaceId !== INTERFACE_NAMESPACE
    )
  );
}

/** Queue a `revision` job: push WikiOS revision `revisionId` of `title` to MediaWiki. */
export async function enqueueRevisionJob(tx: Tx, job: RevisionJobInput): Promise<void> {
  if (!isMirrored(job.source, [job.title])) return;
  const payload: RevisionPayload | undefined = job.restore
    ? { restore: true, summary: job.restore.summary }
    : undefined;
  await tx.wikiMirrorJob.create({
    data: {
      source: MIRROR_SOURCE,
      kind: "revision",
      title: job.title,
      articleId: job.articleId,
      revisionId: job.revisionId,
      ...(payload ? { payload } : {}),
    },
  });
}

async function insertPageJob(
  tx: Tx,
  kind: Exclude<MirrorJobKind, "revision">,
  job: PageJobBase,
  payload: MovePayload | ReasonPayload | ProtectPayload | UploadPayload
): Promise<void> {
  if (!isMirrored(job.source, "to" in payload ? [job.title, payload.to] : [job.title])) return;
  await tx.wikiMirrorJob.create({
    data: {
      source: MIRROR_SOURCE,
      kind,
      title: job.title,
      articleId: job.articleId,
      logId: job.logId,
      payload,
    },
  });
}

/** Queue a `move` of `job.title` to `to`. */
export function enqueueMoveJob(tx: Tx, job: PageJobBase & MovePayload): Promise<void> {
  const { to, reason, leaveRedirect } = job;
  return insertPageJob(tx, "move", job, { to, reason, leaveRedirect });
}

/** Queue a `delete` or an `undelete` of `job.title`. */
export function enqueueDeleteJob(
  tx: Tx,
  kind: "delete" | "undelete",
  job: PageJobBase & ReasonPayload
): Promise<void> {
  return insertPageJob(tx, kind, job, { reason: job.reason });
}

/** Queue a `protect` of `job.title` (a restriction with a null level removes it). */
export function enqueueProtectJob(tx: Tx, job: PageJobBase & ProtectPayload): Promise<void> {
  return insertPageJob(tx, "protect", job, {
    reason: job.reason,
    restrictions: job.restrictions,
  });
}

/** Queue an `upload`: the file `payload.sha1` is the new current version of `File:` page `job.title`. */
export function enqueueUploadJob(tx: Tx, job: PageJobBase & UploadPayload): Promise<void> {
  return insertPageJob(tx, "upload", job, { sha1: job.sha1, comment: job.comment });
}

// ---------------------------------------------------------------------------
// The in-process kick
// ---------------------------------------------------------------------------

const KICK_DELAY_MS = 2_000;
let kickTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Run the mirror worker in this process in a moment (debounced: any number of writes within the delay share
 * one run), so a save reaches MediaWiki in seconds instead of at the next cron minute. Fire and forget: a run
 * that finds the worker busy elsewhere (the lock) does nothing, and `SKIP_MEDIAWIKI_SYNC=true` never runs it
 * (jobs accumulate, nothing is lost). The worker is loaded on demand: it reaches the repositories that call this.
 */
export function scheduleMirrorKick(): void {
  if (process.env.SKIP_MEDIAWIKI_SYNC === "true" || kickTimer) return;
  kickTimer = setTimeout(() => {
    kickTimer = null;
    import("./mirror-worker")
      .then(({ runMirrorCycleLocked }) => runMirrorCycleLocked())
      .catch((error) => console.warn("[WikiMirror] The in-process run failed:", error));
  }, KICK_DELAY_MS);
  kickTimer.unref();
}

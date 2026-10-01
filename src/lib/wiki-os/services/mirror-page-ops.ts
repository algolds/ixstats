/**
 * mirror-page-ops.ts — the page-operation mirror jobs: move, delete, undelete and protect.
 *
 * Each is one Action API call as the mirror account. MediaWiki saying the work is already done (a retry of a
 * call that went through, a page someone deleted there first) is success, not a failure: that is checked
 * against what MediaWiki has, not assumed from the error code.
 */

import { z } from "zod";
import {
  getMediaWikiAction,
  MediaWikiApiError,
  postMediaWikiAction,
} from "../adapters/mediawiki/write-service";
import {
  movePayloadSchema,
  protectPayloadSchema,
  reasonPayloadSchema,
  type ProtectPayload,
} from "./mirror-outbox";
import type { MirrorJob } from "./mirror-queue";

/** A call's answer is not read: success is the absence of an API error. */
const ackSchema = z.looseObject({});

const pageInfoSchema = z.object({
  query: z.object({
    pages: z.array(z.looseObject({ title: z.string(), missing: z.boolean().optional() })),
  }),
});

/** Codes a move answers with when its work may already be done: the target is taken, or the source is gone. */
const MOVE_RACE_CODES: ReadonlySet<string> = new Set(["articleexists", "missingtitle"]);

/**
 * The page `title` is in MediaWiki and whether it exists; with `followRedirects`, a redirect stands for the page
 * it points to (so `title` is the target's, and `exists` says whether the target is there).
 */
async function lookUp(
  title: string,
  followRedirects: boolean
): Promise<{ title: string; exists: boolean }> {
  const data = await getMediaWikiAction(
    {
      action: "query",
      prop: "info",
      titles: title,
      ...(followRedirects ? { redirects: "1" } : {}),
    },
    pageInfoSchema
  );
  const page = data.query.pages[0];
  return { title: page?.title ?? title, exists: page?.missing !== true };
}

/** Whether `title` is a page in MediaWiki. */
async function pageExists(title: string): Promise<boolean> {
  return (await lookUp(title, false)).exists;
}

/**
 * Whether a refused move is a move that was already made: the destination is there, and the source is gone or
 * is the redirect the move leaves behind.
 */
async function moveAlreadyDone(
  error: MediaWikiApiError,
  from: string,
  to: string
): Promise<boolean> {
  if (error.code === "selfmove") return true;
  if (!MOVE_RACE_CODES.has(error.code)) return false;
  const [source, destination] = await Promise.all([lookUp(from, true), lookUp(to, true)]);
  return destination.exists && (!source.exists || source.title === destination.title);
}

async function runMove(job: MirrorJob): Promise<void> {
  const { to, reason, leaveRedirect } = movePayloadSchema.parse(job.payload);
  try {
    await postMediaWikiAction(
      {
        action: "move",
        from: job.title,
        to,
        reason,
        // MediaWiki reads a flag as set when the parameter is present, whatever its value: `movetalk` is left out
        // because each move WikiOS made has its own job (the talk page moves when WikiOS moved it).
        ...(leaveRedirect ? {} : { noredirect: "1" }),
      },
      ackSchema
    );
  } catch (error) {
    if (!(error instanceof MediaWikiApiError) || !(await moveAlreadyDone(error, job.title, to))) {
      throw error;
    }
  }
}

async function runDelete(job: MirrorJob): Promise<void> {
  const { reason } = reasonPayloadSchema.parse(job.payload);
  try {
    await postMediaWikiAction({ action: "delete", title: job.title, reason }, ackSchema);
  } catch (error) {
    // A page that is not there is as deleted as it gets.
    if (!(error instanceof MediaWikiApiError) || error.code !== "missingtitle") throw error;
  }
}

async function runUndelete(job: MirrorJob): Promise<void> {
  const { reason } = reasonPayloadSchema.parse(job.payload);
  try {
    await postMediaWikiAction({ action: "undelete", title: job.title, reason }, ackSchema);
  } catch (error) {
    // Nothing to undelete: fine when the page is there (restored already), a failure when it is not.
    const refused = error instanceof MediaWikiApiError && error.code === "cantundelete";
    if (!refused || !(await pageExists(job.title))) throw error;
  }
}

/** `edit=sysop|move=sysop` and its expiries: MediaWiki's `all` lifts a restriction, `infinite` never expires. */
function protectionParams({ restrictions }: ProtectPayload): {
  protections: string;
  expiry: string;
} {
  return {
    protections: restrictions.map((r) => `${r.action}=${r.level ?? "all"}`).join("|"),
    expiry: restrictions.map((r) => (r.level && r.expiresAt ? r.expiresAt : "infinite")).join("|"),
  };
}

async function runProtect(job: MirrorJob): Promise<void> {
  const payload = protectPayloadSchema.parse(job.payload);
  // MediaWiki answers a protection that is already in force with a success, so there is no race to excuse.
  await postMediaWikiAction(
    { action: "protect", title: job.title, reason: payload.reason, ...protectionParams(payload) },
    ackSchema
  );
}

/** Make the move, delete, undelete or protection the job records; throws on failure, for the retry. */
export async function runPageJob(job: MirrorJob): Promise<void> {
  switch (job.kind) {
    case "move":
      return runMove(job);
    case "delete":
      return runDelete(job);
    case "undelete":
      return runUndelete(job);
    case "protect":
      return runProtect(job);
    default:
      throw new Error(`Unknown mirror job kind "${job.kind}"`);
  }
}

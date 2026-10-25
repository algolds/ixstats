/**
 * mirror-page-ops.ts — the page-operation mirror jobs: move, delete, undelete and protect.
 *
 * Each is an Action API call (or two) as the mirror account. A move, delete or undelete first goes through the conflict
 * rule (mirror-page-rule.ts): one that lost to a later classic change sends nothing and completes with a note. MediaWiki
 * saying the work is already done (a retry of a call that went through, a page someone deleted there first) is success,
 * not a failure: that is checked against what MediaWiki has, not assumed from the error code.
 */

import { z } from "zod";
import { MediaWikiApiError, postMediaWikiAction } from "../adapters/mediawiki/write-service";
import { classicPage } from "./mirror-history";
import {
  movePayloadSchema,
  protectPayloadSchema,
  reasonPayloadSchema,
  type ProtectPayload,
} from "./mirror-outbox";
import { rulePageJob, type PageRuling } from "./mirror-page-rule";
import type { MirrorJob } from "./mirror-queue";

/** A call's answer is not read: success is the absence of an API error. */
const ackSchema = z.looseObject({});

/** Codes a move answers with when its work may already be done: the target is taken, or the source is gone. */
const MOVE_RACE_CODES: ReadonlySet<string> = new Set(["articleexists", "missingtitle"]);

/** What a page job leaves to know about once done: why it sent nothing. */
export interface PageJobResult {
  note?: string;
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
  const [source, destination] = await Promise.all([classicPage(from, true), classicPage(to, true)]);
  return destination.exists && (!source.exists || source.title === destination.title);
}

async function sendMove(from: string, to: string, reason: string, leaveRedirect: boolean) {
  try {
    await postMediaWikiAction(
      {
        action: "move",
        from,
        to,
        reason,
        // MediaWiki reads a flag as set when the parameter is present, whatever its value: `movetalk` is left out
        // because each move WikiOS made has its own job (the talk page moves when WikiOS moved it).
        ...(leaveRedirect ? {} : { noredirect: "1" }),
      },
      ackSchema
    );
  } catch (error) {
    if (!(error instanceof MediaWikiApiError) || !(await moveAlreadyDone(error, from, to))) {
      throw error;
    }
  }
}

/**
 * WikiOS's move of `old` to `to` won over an earlier classic move of the page: classic's page moves from where classic
 * has it, leaving nothing behind (WikiOS never had that title). Classic's old title then reads as WikiOS's does: a
 * redirect to `to` where WikiOS left one, and classic's redirect there (now pointing at a moved page) follows the page.
 * A page someone made at the old title since is left alone.
 */
async function moveFromElsewhere(
  old: string,
  elsewhere: string,
  to: string,
  reason: string,
  leaveRedirect: boolean
): Promise<void> {
  await sendMove(elsewhere, to, reason, false);
  const left = await classicPage(old, false);
  if (left.exists ? left.redirect : leaveRedirect) {
    await postMediaWikiAction(
      { action: "edit", title: old, text: `#REDIRECT [[${to}]]`, summary: reason },
      ackSchema
    );
  }
}

/** Bring back the deleted page `title`; nothing to undelete is fine when the page is there (restored already). */
async function sendUndelete(title: string, reason: string): Promise<void> {
  try {
    await postMediaWikiAction({ action: "undelete", title, reason }, ackSchema);
  } catch (error) {
    const refused = error instanceof MediaWikiApiError && error.code === "cantundelete";
    if (!refused || !(await classicPage(title, false)).exists) throw error;
  }
}

async function runMove(job: MirrorJob, ruling: PageRuling): Promise<void> {
  const { to, leaveRedirect } = movePayloadSchema.parse(job.payload);
  if (ruling.undeleteFirst) await sendUndelete(ruling.from, ruling.reason);
  if (ruling.from === job.title) return sendMove(job.title, to, ruling.reason, leaveRedirect);
  return moveFromElsewhere(job.title, ruling.from, to, ruling.reason, leaveRedirect);
}

async function runDelete(job: MirrorJob, ruling: PageRuling): Promise<void> {
  try {
    await postMediaWikiAction(
      { action: "delete", title: ruling.from, reason: ruling.reason },
      ackSchema
    );
  } catch (error) {
    // A page that is not there is as deleted as it gets.
    if (!(error instanceof MediaWikiApiError) || error.code !== "missingtitle") throw error;
  }
}

async function runUndelete(job: MirrorJob, ruling: PageRuling): Promise<void> {
  await sendUndelete(job.title, ruling.reason);
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

async function runProtect(job: MirrorJob): Promise<PageJobResult> {
  const payload = protectPayloadSchema.parse(job.payload);
  // MediaWiki answers a protection that is already in force with a success, so there is no race to excuse.
  await postMediaWikiAction(
    { action: "protect", title: job.title, reason: payload.reason, ...protectionParams(payload) },
    ackSchema
  );
  return {};
}

const OPERATIONS: Readonly<
  Partial<Record<string, (job: MirrorJob, ruling: PageRuling) => Promise<void>>>
> = {
  move: runMove,
  delete: runDelete,
  undelete: runUndelete,
};

/**
 * Make the move, delete, undelete or protection the job records; throws on failure, for the retry. A move, delete or
 * undelete the conflict rule ruled lost sends nothing and resolves to its note.
 */
export async function runPageJob(job: MirrorJob): Promise<PageJobResult> {
  if (job.kind === "protect") return runProtect(job);
  const operation = OPERATIONS[job.kind];
  if (!operation) throw new Error(`Unknown mirror job kind "${job.kind}"`);
  const { reason } = reasonPayloadSchema.parse(job.payload);
  const ruling = await rulePageJob(job, reason);
  if (ruling.lost) return { note: ruling.lost };
  await operation(job, ruling);
  return {};
}

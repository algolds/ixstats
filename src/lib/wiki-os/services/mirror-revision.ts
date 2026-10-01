/**
 * mirror-revision.ts — `revision` mirror jobs: WikiOS revisions become MediaWiki revisions, a batch at a time.
 *
 * Revisions go out as a one-page XML export through `action=import` with `assignknownusers=1`, so MediaWiki
 * credits each to the account that made it (the verified link of the author; any other author goes out as
 * `wikios>Label`, never as a bare name that could be a MediaWiki account) at the time it was made. The worker takes
 * every revision job of a title that waits next in line (see `pickBatch`: at most 50 revisions, and about 6 MB of
 * XML, a revision that would pass that waits for the next batch) and imports them in ONE request, oldest first, so a
 * backlog costs MediaWiki one null revision, not one per edit (below).
 *
 * What MediaWiki does with an import (seen against a real MediaWiki 1.45): an imported revision becomes the page's
 * current one only when it is newer than the current revision; either way MediaWiki then adds ONE null revision by
 * the importing account ("N revisions imported: <summary>") that copies the page's CURRENT text. Imported one by
 * one, the second revision of a quick pair is older than the first one's null revision and never becomes current
 * (it needs an edit to push its text); imported together, the newest revision does.
 *
 * The import answers with no revision ids, so the result is checked and read back:
 *   - the newest revision's text must be MediaWiki's current text. It is stamped on that WikiOS revision and on the
 *     article (a MediaWiki edit on top of it has it as its parent, and the inbound sync knows it as the bot's own).
 *     If it is not (someone edited in MediaWiki since), that text, and only that text, is pushed once more as an
 *     ordinary `action=edit` by the mirror account, and the edit is stamped; the earlier revisions of the batch
 *     still count as imported, with a note saying so;
 *   - every earlier revision of the batch is found in the page's history by its hash and timestamp, and stamped
 *     with that revision's id (one that cannot be found stays unstamped, with a note).
 *
 * Import errors (no import right, a bad prefix) are failures: the jobs are retried and end up dead for an
 * operator; there is no fallback for them.
 */

import { z } from "zod";
import { ConflictError } from "~/lib/app-error";
import { db } from "~/server/db";
import { canonicalizeTitle } from "../core/title";
import {
  executeMediaWikiWrite,
  getMediaWikiAction,
  postMediaWikiAction,
} from "../adapters/mediawiki/write-service";
import { mirrorBotName } from "../adapters/mediawiki/csrf-cache";
import { contentModelFor } from "../xml/content-model";
import { createExportWriter, escapeXmlText, toXmlTimestamp } from "../xml/export-writer";
import { mwSha1Base36, sha1HexToBase36 } from "../xml/sha1";
import type { XmlRevision } from "../xml/types";
import { MIRROR_SOURCE, revisionPayloadSchema, type RevisionPayload } from "./mirror-outbox";
import type { MirrorJob } from "./mirror-queue";

/** MediaWiki's prefix for the names of editors it has no account for: `wikios>Name`. */
const INTERWIKI_PREFIX = "wikios";
const UNKNOWN_AUTHOR = "Community Contributor";
const DEFAULT_SUMMARY = "WikiOS native edit";
const RESTORE_SUMMARY = "Restoring the current WikiOS revision";
const SUMMARY_LIMIT = 480;
/** A batch takes no revision that would grow its XML past this size (the first revision always goes in). */
export const MAX_BATCH_BYTES = 6 * 1024 * 1024;
/** What a revision's XML adds besides its text: its tags, timestamp, contributor and summary. */
const REVISION_XML_OVERHEAD = 2_000;
/** Pages of the page's history read to find the revisions of a batch. */
const MAX_HISTORY_PAGES = 4;

const EDIT_NOTE = "MediaWiki had a newer revision: this text was pushed as an edit instead";
const SUPERSEDED_NOTE =
  "Imported, but MediaWiki had a newer revision: only the batch's newest text was pushed, as an edit";
const UNMATCHED_NOTE =
  "Imported, but its revision was not found in MediaWiki's history, so it is unstamped";

const importResultSchema = z.looseObject({
  import: z.array(z.looseObject({ title: z.string(), revisions: z.number() })),
});

const revisionsPageSchema = z.object({
  query: z.object({
    pages: z.array(
      z.looseObject({
        revisions: z
          .array(
            z.looseObject({
              revid: z.number(),
              sha1: z.string().optional(),
              timestamp: z.string().optional(),
            })
          )
          .optional(),
      })
    ),
  }),
  continue: z.looseObject({ rvcontinue: z.string().optional() }).optional(),
});

export interface MirroredRevision {
  id: string;
  wikitext: string;
  author: string | null;
  authorId: string | null;
  summary: string | null;
  minor: boolean;
  createdAt: Date;
  mwRevId: number | null;
  sha1: string | null;
}

interface CurrentRevision {
  revid: number;
  /** `rev_sha1` in MediaWiki's base 36; null when MediaWiki hides it. */
  sha1: string | null;
}

/** One job of a batch: its revision goes into the import, or there is nothing to send for it. */
export type BatchMember =
  | { job: MirrorJob; send: true; revision: MirroredRevision }
  | {
      job: MirrorJob;
      send: false;
      /** The MediaWiki revision that already holds it (the inbound sync stamped it); null: nothing to mirror. */
      mwRevId: number | null;
    };

/** What `planRevisionBatch` decided, before anything is sent. */
export interface RevisionBatchPlan {
  title: string;
  /** A park's re-push of the head, which goes alone (see `RevisionPayload.restore`). */
  restore: boolean;
  /** The jobs this batch settles, oldest first: a prefix of the jobs it was given. */
  members: BatchMember[];
  /** The export-0.11 document of the revisions to send; null when there are none. */
  xml: string | null;
  /** The summary of the import log (and of the null revision). */
  importSummary: string;
}

/** What became of one job of a batch. */
export interface BatchOutcome {
  job: MirrorJob;
  /** The MediaWiki revision that holds its text; null when there is none to name. */
  mwRevId: number | null;
  /** Why the job is done in a way worth knowing about. */
  note?: string;
}

/** The summary the import log and an edit fallback carry. */
function summaryOf(revision: MirroredRevision, payload: RevisionPayload): string {
  const own = payload.restore ? payload.summary || RESTORE_SUMMARY : revision.summary;
  return (own?.trim() || DEFAULT_SUMMARY).slice(0, SUMMARY_LIMIT);
}

/** The size and stamp of each job's revision: all a batch needs to be decided before any text is read. */
interface RevisionHead {
  id: string;
  byteSize: number;
  mwRevId: number | null;
}

async function loadHeads(jobs: readonly MirrorJob[]): Promise<Map<string, RevisionHead>> {
  const ids = jobs.flatMap((job) => job.revisionId ?? []);
  if (ids.length === 0) return new Map();
  const rows = await db.wikiRevision.findMany({
    where: { id: { in: ids } },
    select: { id: true, byteSize: true, mwRevId: true },
  });
  return new Map(rows.map((row) => [row.id, row]));
}

/** Whether a job's revision goes into the import: it exists, and (but for a restore) MediaWiki does not have it yet. */
function isSent(head: RevisionHead | undefined, restore: boolean): head is RevisionHead {
  return head !== undefined && (restore || head.mwRevId === null);
}

/**
 * The jobs, from the oldest, that can make one batch by their sizes alone: the revisions to send add up (with their
 * tags) to at most `MAX_BATCH_BYTES`, the first one always counting. The text of the rest is never read.
 */
function withinBudget(
  jobs: readonly MirrorJob[],
  heads: ReadonlyMap<string, RevisionHead>,
  restore: boolean
): MirrorJob[] {
  const taken: MirrorJob[] = [];
  let sending = 0;
  let bytes = 0;
  for (const job of jobs) {
    const head = job.revisionId ? heads.get(job.revisionId) : undefined;
    if (isSent(head, restore)) {
      const size = head.byteSize + REVISION_XML_OVERHEAD;
      if (sending > 0 && bytes + size > MAX_BATCH_BYTES) break;
      bytes += size;
      sending++;
    }
    taken.push(job);
  }
  return taken;
}

/** The revisions of `jobs` that go into the import, with their text. */
async function loadRevisions(
  jobs: readonly MirrorJob[],
  heads: ReadonlyMap<string, RevisionHead>,
  restore: boolean
): Promise<Map<string, MirroredRevision>> {
  const ids = jobs.flatMap((job) => {
    const head = job.revisionId ? heads.get(job.revisionId) : undefined;
    return isSent(head, restore) ? head.id : [];
  });
  if (ids.length === 0) return new Map();
  const rows = await db.wikiRevision.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      wikitext: true,
      author: true,
      authorId: true,
      summary: true,
      minor: true,
      createdAt: true,
      mwRevId: true,
      sha1: true,
    },
  });
  return new Map(rows.map((row) => [row.id, row]));
}

/** The wiki account each revision's author verified, by WikiOS user id. */
async function verifiedUsernames(
  revisions: Iterable<MirroredRevision>
): Promise<Map<string, string>> {
  const ids = [...new Set([...revisions].flatMap((revision) => revision.authorId ?? []))];
  if (ids.length === 0) return new Map();
  const links = await db.wikiAccountLink.findMany({
    where: { userId: { in: ids }, source: MIRROR_SOURCE, verifiedAt: { not: null } },
    select: { userId: true, username: true },
  });
  return new Map(links.map((link) => [link.userId, link.username]));
}

/**
 * The name a revision is imported under. Only a VERIFIED wiki account goes out as itself, which MediaWiki credits to
 * the local account of that name (`assignknownusers`). Every other author is a free-text label (a country, `User_x`,
 * an old `wikiUsername`, anything) that must never be taken for a MediaWiki user or an IP address, so it goes out with
 * the import prefix, a form MediaWiki keeps as it is and never maps to an account.
 */
function contributorName(
  revision: MirroredRevision,
  verifiedUsernames: ReadonlyMap<string, string>
): string {
  const verified = revision.authorId ? verifiedUsernames.get(revision.authorId) : undefined;
  return verified ?? `${INTERWIKI_PREFIX}>${revision.author?.trim() || UNKNOWN_AUTHOR}`;
}

/** What `revision` would add to the XML: its text as escaped (an `&` takes five bytes) and its tags. */
function xmlSizeOf(revision: MirroredRevision): number {
  return Buffer.byteLength(escapeXmlText(revision.wikitext), "utf8") + REVISION_XML_OVERHEAD;
}

function requireMirrorBot(): string {
  const bot = mirrorBotName();
  if (!bot) throw new Error("WIKIOS_MEDIAWIKI_BOT_USER is not set: there is no mirror account");
  return bot;
}

/**
 * Decide the batch the `jobs` (revision jobs of one title, oldest first, as `pickBatch` hands them over) make, and
 * build its XML. A restore goes alone. A revision the inbound sync already stamped, or one that went with its page,
 * is settled without being sent; the batch takes no revision that would grow its XML past `MAX_BATCH_BYTES`, except
 * the first (decided from the revisions' sizes first, so the text of the jobs left for the next batch is never
 * read, then checked against the XML as escaped). Only reads: nothing is claimed or sent yet.
 */
export async function planRevisionBatch(jobs: readonly MirrorJob[]): Promise<RevisionBatchPlan> {
  const first = jobs[0];
  if (!first) throw new Error("A revision batch needs a job");
  const restore = revisionPayloadSchema.parse(first.payload ?? {}).restore;
  const heads = await loadHeads(restore ? [first] : jobs);
  const candidates = withinBudget(restore ? [first] : jobs, heads, restore);
  const revisions = await loadRevisions(candidates, heads, restore);
  const usernames = restore
    ? new Map<string, string>()
    : await verifiedUsernames(revisions.values());
  const bot = restore ? requireMirrorBot() : null;
  const { model, format } = contentModelFor(first.title);

  const members: BatchMember[] = [];
  const summaries: string[] = [];
  const chunks: string[] = [];
  let bytes = 0;

  function* revisionsToSend(): Generator<XmlRevision> {
    for (const job of candidates) {
      const head = job.revisionId ? heads.get(job.revisionId) : undefined;
      const revision = head ? revisions.get(head.id) : undefined;
      if (!head) {
        members.push({ job, send: false, mwRevId: null });
      } else if (!isSent(head, restore)) {
        members.push({ job, send: false, mwRevId: head.mwRevId });
      } else if (!revision) {
        members.push({ job, send: false, mwRevId: null }); // went with its page since
      } else if (summaries.length > 0 && bytes + xmlSizeOf(revision) > MAX_BATCH_BYTES) {
        return;
      } else {
        const payload = revisionPayloadSchema.parse(job.payload ?? {});
        const summary = summaryOf(revision, payload);
        members.push({ job, send: true, revision });
        summaries.push(summary);
        yield {
          id: null,
          parentId: null,
          timestamp: toXmlTimestamp(restore ? new Date() : revision.createdAt),
          contributor: {
            username: bot ?? contributorName(revision, usernames),
            id: null,
          },
          minor: restore ? false : revision.minor,
          comment: restore ? summary : revision.summary,
          commentDeleted: false,
          model,
          format,
          text: revision.wikitext,
          textDeleted: false,
        };
      }
    }
  }

  const writer = createExportWriter((chunk) => {
    chunks.push(chunk);
    bytes += Buffer.byteLength(chunk, "utf8");
  });
  await writer.start();
  await writer.page({
    title: first.title,
    ns: canonicalizeTitle(first.title, { source: first.source })?.namespaceId ?? 0,
    pageId: null,
    revisions: revisionsToSend(),
  });
  await writer.end();

  return {
    title: first.title,
    restore,
    members,
    xml: summaries.length > 0 ? chunks.join("") : null,
    importSummary: summaries.at(-1) ?? DEFAULT_SUMMARY,
  };
}

/** MediaWiki's current revision of `title`; null when the page does not exist there. */
async function currentRevision(title: string): Promise<CurrentRevision | null> {
  const data = await getMediaWikiAction(
    {
      action: "query",
      prop: "revisions",
      titles: title,
      rvprop: "ids|sha1|timestamp",
      rvlimit: "1",
    },
    revisionsPageSchema
  );
  const revision = data.query.pages[0]?.revisions?.[0];
  if (!revision) return null;
  return { revid: revision.revid, sha1: revision.sha1 ? sha1HexToBase36(revision.sha1) : null };
}

/**
 * The page's history, oldest revision first (a few pages of it: the batch's revisions are among the newest).
 */
async function recentHistory(
  title: string
): Promise<Array<{ revid: number; sha1: string; timestamp: string }>> {
  const history: Array<{ revid: number; sha1: string; timestamp: string }> = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
    const data = await getMediaWikiAction(
      {
        action: "query",
        prop: "revisions",
        titles: title,
        rvprop: "ids|sha1|timestamp",
        rvlimit: "max",
        ...(cursor ? { rvcontinue: cursor } : {}),
      },
      revisionsPageSchema
    );
    for (const { revid, sha1, timestamp } of data.query.pages[0]?.revisions ?? []) {
      if (sha1 && timestamp) history.push({ revid, sha1: sha1HexToBase36(sha1), timestamp });
    }
    cursor = data.continue?.rvcontinue;
    if (!cursor) break;
  }
  return history.sort((a, b) => a.revid - b.revid);
}

/**
 * The MediaWiki revision of each of `revisions` (oldest first), found by hash and timestamp in the page's history
 * (the first, in import order, that nobody claimed yet, so identical revisions of one second are told apart);
 * `except` is the current revision, which the import's null revision may share a hash and a second with.
 */
async function findImported(
  title: string,
  revisions: readonly MirroredRevision[],
  except: number | null
): Promise<Map<string, number>> {
  const pool = (await recentHistory(title)).filter((entry) => entry.revid !== except);
  const found = new Map<string, number>();
  for (const revision of revisions) {
    const sha1 = mwSha1Base36(revision.wikitext);
    const timestamp = toXmlTimestamp(revision.createdAt);
    const at = pool.findIndex((entry) => entry.sha1 === sha1 && entry.timestamp === timestamp);
    const [entry] = at === -1 ? [] : pool.splice(at, 1);
    if (entry) found.set(revision.id, entry.revid);
  }
  return found;
}

/** Push `text` as an ordinary edit on top of MediaWiki's current revision; resolves to the revision it made. */
async function pushAsEdit(
  title: string,
  revision: MirroredRevision,
  summary: string,
  current: CurrentRevision | null
): Promise<number> {
  const result = await executeMediaWikiWrite({
    action: "edit",
    title,
    text: revision.wikitext,
    summary: `${summary} (WikiOS)`,
    bot: 1,
    ...(revision.minor ? { minor: 1 } : {}),
    ...(current ? { baserevid: current.revid } : {}),
  });
  const edit = result.result.edit;
  if (!result.success) throw new Error(`MediaWiki did not save the edit of "${title}"`);
  // `nochange`: the page already had this text, and `oldrevid` is the revision that holds it.
  const revid = edit?.newrevid ?? edit?.oldrevid;
  if (revid === undefined) throw new Error(`MediaWiki saved "${title}" but gave no revision id`);
  return revid;
}

/** Give the WikiOS revision the id of the MediaWiki revision it is. */
async function stampRevision(revision: MirroredRevision, mwRevId: number): Promise<void> {
  try {
    await db.wikiRevision.updateMany({
      where: { id: revision.id, mwRevId: null },
      data: { mwRevId, ...(revision.sha1 ? {} : { sha1: mwSha1Base36(revision.wikitext) }) },
    });
  } catch (error) {
    // The inbound sync recorded this very MediaWiki revision as an echo row first: it is already known.
    // (`db` turns the database's unique-constraint error into a ConflictError, see ~/lib/prisma-error.)
    if (!(error instanceof ConflictError)) throw error;
  }
}

/** The article remembers the MediaWiki revision that holds its current text. */
async function stampArticle(job: MirrorJob, mwRevId: number): Promise<void> {
  if (!job.articleId) return;
  await db.wikiArticle.updateMany({
    where: { id: job.articleId },
    data: { mwLatestRevId: mwRevId, lastMwSyncAt: new Date() },
  });
}

async function postImport(plan: RevisionBatchPlan & { xml: string }): Promise<void> {
  await postMediaWikiAction(
    {
      action: "import",
      interwikiprefix: INTERWIKI_PREFIX,
      assignknownusers: "1",
      summary: plan.importSummary,
    },
    importResultSchema,
    { field: "xml", filename: "wikios.xml", contentType: "application/xml", content: plan.xml }
  );
}

/**
 * Import the batch, then make sure MediaWiki's current text is the text of `head` (the batch's newest revision): the
 * import is the current revision only when nothing newer is in MediaWiki's history, and otherwise `head`'s text is
 * pushed as an edit. Resolves to the revision that holds it.
 */
async function importAndVerify(
  plan: RevisionBatchPlan & { xml: string },
  head: Extract<BatchMember, { send: true }>
): Promise<{ revid: number; viaEdit: boolean }> {
  await postImport(plan);
  const current = await currentRevision(head.job.title);
  if (current !== null && current.sha1 === mwSha1Base36(head.revision.wikitext)) {
    return { revid: current.revid, viaEdit: false };
  }
  const summary = summaryOf(head.revision, revisionPayloadSchema.parse(head.job.payload ?? {}));
  return {
    revid: await pushAsEdit(head.job.title, head.revision, summary, current),
    viaEdit: true,
  };
}

/** A restore: nothing to do when MediaWiki already holds the head's text, else import it (dated now, by the bot). */
async function executeRestore(
  plan: RevisionBatchPlan & { xml: string },
  member: Extract<BatchMember, { send: true }>
): Promise<BatchOutcome[]> {
  const { job, revision } = member;
  // The conflicting edit may have been superseded since; an edit (the fallback) saves the text without its trailing
  // whitespace, which counts as the same text.
  const holder = await currentRevision(job.title);
  const sameText = (sha1: string | null) =>
    sha1 === mwSha1Base36(revision.wikitext) || sha1 === mwSha1Base36(revision.wikitext.trimEnd());
  const revid =
    holder && sameText(holder.sha1) ? holder.revid : (await importAndVerify(plan, member)).revid;
  await stampRevision(revision, revid);
  await stampArticle(job, revid);
  return [{ job, mwRevId: revid }];
}

/** An ordinary batch: import, verify the newest text, find and stamp the earlier revisions. */
async function executeBatch(
  plan: RevisionBatchPlan & { xml: string },
  sent: Array<Extract<BatchMember, { send: true }>>
): Promise<BatchOutcome[]> {
  // A batch whose last job had nothing to send (its text is already in MediaWiki) has no newest text to verify.
  const last = plan.members.at(-1);
  const head = last?.send ? last : null;
  let revid: number | null = null;
  let viaEdit = false;
  if (head) {
    ({ revid, viaEdit } = await importAndVerify(plan, head));
  } else {
    await postImport(plan);
  }

  const earlier = head ? sent.slice(0, -1) : sent;
  const imported =
    earlier.length > 0
      ? await findImported(
          plan.title,
          earlier.map((member) => member.revision),
          revid
        )
      : new Map<string, number>();
  for (const { revision } of earlier) {
    const id = imported.get(revision.id);
    if (id !== undefined) await stampRevision(revision, id);
  }
  if (head && revid !== null) {
    await stampRevision(head.revision, revid);
    await stampArticle(head.job, revid);
  }

  return plan.members.map((member): BatchOutcome => {
    if (!member.send) return { job: member.job, mwRevId: member.mwRevId };
    if (member === head) {
      return { job: member.job, mwRevId: revid, ...(viaEdit ? { note: EDIT_NOTE } : {}) };
    }
    const mwRevId = imported.get(member.revision.id) ?? null;
    const note = viaEdit ? SUPERSEDED_NOTE : mwRevId === null ? UNMATCHED_NOTE : undefined;
    return { job: member.job, mwRevId, ...(note ? { note } : {}) };
  });
}

/**
 * Send a planned batch to MediaWiki and settle its jobs. Resolves to one outcome per member, oldest first. Throws on
 * any failure (the caller fails every job of the batch, for the retry).
 */
export async function executeRevisionBatch(plan: RevisionBatchPlan): Promise<BatchOutcome[]> {
  const sent = plan.members.filter(
    (member): member is Extract<BatchMember, { send: true }> => member.send
  );
  const [firstSent] = sent;
  if (plan.xml === null || !firstSent) {
    return plan.members.map((member) => ({
      job: member.job,
      mwRevId: member.send ? null : member.mwRevId,
    }));
  }
  const sendable = { ...plan, xml: plan.xml };
  return plan.restore ? executeRestore(sendable, firstSent) : executeBatch(sendable, sent);
}

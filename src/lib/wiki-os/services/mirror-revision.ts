/**
 * mirror-revision.ts — `revision` mirror jobs: WikiOS revisions become MediaWiki revisions, a batch at a time.
 *
 * Revisions go out as a one-page XML export through `action=import` with `assignknownusers=1`, so MediaWiki
 * credits each to the account that made it (the author's first shown name claim; any other author goes out as
 * `wikios>Label`, never as a bare name that could be a MediaWiki account) at the time it was made. The worker takes
 * every revision job of a title that waits next in line (see `pickBatch`: at most 50 revisions, and about 6 MB of
 * XML, a revision that would pass that waits for the next batch) and imports them in ONE request, oldest first, so a
 * backlog costs MediaWiki one null revision, not one per edit (below).
 *
 * What MediaWiki does with an import (seen against a real MediaWiki 1.45): an imported revision becomes the page's
 * current one only when it is newer than the current revision; either way MediaWiki then adds ONE null revision by
 * the importing account ("N revisions imported: <summary>") that copies the page's CURRENT text. Imported one by
 * one, the second revision of a quick pair is older than the first one's null revision and never becomes current;
 * imported together, the newest revision does.
 *
 * Before anything is sent, `checkCollision` (mirror-collision.ts) asks the conflict rule about the batch against what
 * classic has, and records any collision: a WikiOS winner carries its trail in its summary; a batch that lost to a
 * later edit is imported as history only (never current: MediaWiki keeps the later save, and the null revision says
 * "Imported as history"), with nothing pushed for it. A parked (overwritten) revision is never sent at all: a classic
 * delete that won keeps the page gone.
 *
 * The import answers with no revision ids, so the result is checked and read back:
 *   - the newest revision's text must be MediaWiki's current text. It is stamped on that WikiOS revision and on the
 *     article (a MediaWiki edit on top of it has it as its parent, and the inbound sync knows it as the bot's own).
 *     If it is not, it is made current by one `action=edit` of the mirror account only when every revision dated after
 *     it is the mirror's own (null revisions of earlier imports: the order of two of the mirror's writes, not anyone's
 *     edit); a classic editor's later revision keeps it history only;
 *   - every other revision of the batch is found in the page's history by its hash and timestamp, and stamped with
 *     that revision's id (one that cannot be found stays unstamped, with a note).
 *
 * Import errors (no import right, a bad prefix) are failures: the jobs are retried and end up dead for an
 * operator; there is no fallback for them.
 */

import { z } from "zod";
import { ConflictError } from "~/lib/app-error";
import { namesOfUsers } from "~/lib/identity/wiki-names";
import { db } from "~/server/db";
import { canonicalizeTitle } from "../core/title";
import { classicTitleOf } from "./mirror-classic-location";
import { executeMediaWikiWrite, postMediaWikiAction } from "../adapters/mediawiki/write-service";
import { contentModelFor } from "../xml/content-model";
import { createExportWriter, escapeXmlText, toXmlTimestamp } from "../xml/export-writer";
import { mwSha1Base36 } from "../xml/sha1";
import type { XmlRevision } from "../xml/types";
import { importName, INTERWIKI_PREFIX } from "./import-label";
import { withoutTrail, type BatchCollision } from "./mirror-collision";
import {
  currentRevision,
  findImported,
  laterClassicRevision,
  recentHistory,
  type CurrentRevision,
  type HistoryEntry,
} from "./mirror-history";
import type { MirrorJob } from "./mirror-queue";

const DEFAULT_SUMMARY = "WikiOS native edit";
const SUMMARY_LIMIT = 480;
/** A batch takes no revision that would grow its XML past this size (the first revision always goes in). */
export const MAX_BATCH_BYTES = 6 * 1024 * 1024;
/** What a revision's XML adds besides its text: its tags, timestamp, contributor and summary. */
const REVISION_XML_OVERHEAD = 2_000;

/** The summary of a lost batch's import (and of its null revision, which becomes classic's current one). */
const LOST_IMPORT_SUMMARY = "Imported as history";
const PROMOTED_NOTE =
  "MediaWiki's newer revisions were the mirror's own (null revisions of earlier imports, dated after this revision): this text was made current by one edit";
const UNMATCHED_NOTE =
  "Imported, but its revision was not found in MediaWiki's history, so it is unstamped";
function lostNote(winnerRef: string): string {
  return `Lost to MediaWiki revision ${winnerRef} (saved later); imported as history`;
}
function laterNote(revid: number): string {
  return `MediaWiki has a later revision ${revid} by a classic editor; imported as history`;
}
function overwrittenNote(parkReason: string | null): string {
  return `Overwritten before it was sent (${parkReason ?? "overwritten"}): kept in WikiOS's history only`;
}

const importResultSchema = z.looseObject({
  import: z.array(z.looseObject({ title: z.string(), revisions: z.number() })),
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
  origin: string;
}

/** One job of a batch: its revision goes into the import, or there is nothing to send for it. */
export type BatchMember =
  | { job: MirrorJob; send: true; revision: MirroredRevision }
  | {
      job: MirrorJob;
      send: false;
      /** The MediaWiki revision that already holds it (the inbound sync stamped it); null: nothing to mirror. */
      mwRevId: number | null;
      /** Why nothing is sent, when that is worth knowing (an overwritten revision). */
      note?: string;
    };
type SentMember = Extract<BatchMember, { send: true }>;

/** What `planRevisionBatch` decided, before anything is sent. */
export interface RevisionBatchPlan {
  title: string;
  /** The jobs this batch settles, oldest first: a prefix of the jobs it was given. */
  members: BatchMember[];
  /** The export-0.11 document of the revisions to send; null when there are none. */
  xml: string | null;
  /** The summary of the import log (and of the null revision): the newest revision's own, without its trail. */
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

/** The summary an edit carries. */
function summaryOf(revision: MirroredRevision): string {
  return (revision.summary?.trim() || DEFAULT_SUMMARY).slice(0, SUMMARY_LIMIT);
}

/** The summary of the import: the revision's own, without a trail (the import revision carries that, once). */
function importSummaryOf(revision: MirroredRevision): string {
  const own = revision.summary && withoutTrail(revision.summary).trim();
  return (own || DEFAULT_SUMMARY).slice(0, SUMMARY_LIMIT);
}

/** The size, stamp and park of each job's revision: all a batch needs to be decided before any text is read. */
interface RevisionHead {
  id: string;
  byteSize: number;
  mwRevId: number | null;
  parked: boolean;
  parkReason: string | null;
}

async function loadHeads(jobs: readonly MirrorJob[]): Promise<Map<string, RevisionHead>> {
  const ids = jobs.flatMap((job) => job.revisionId ?? []);
  if (ids.length === 0) return new Map();
  const rows = await db.wikiRevision.findMany({
    where: { id: { in: ids } },
    select: { id: true, byteSize: true, mwRevId: true, parked: true, parkReason: true },
  });
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Whether a job's revision goes into the import: MediaWiki does not have it yet, and it was not overwritten (a parked
 * revision is history in WikiOS only: sent, it could bring back a page a classic delete removed).
 */
function isSent(head: RevisionHead): boolean {
  return head.mwRevId === null && !head.parked;
}

/**
 * The jobs, from the oldest, that can make one batch by their sizes alone: the revisions to send add up (with their
 * tags) to at most `MAX_BATCH_BYTES`, the first one always counting. The text of the rest is never read.
 */
function withinBudget(
  jobs: readonly MirrorJob[],
  heads: ReadonlyMap<string, RevisionHead>
): MirrorJob[] {
  const taken: MirrorJob[] = [];
  let sending = 0;
  let bytes = 0;
  for (const job of jobs) {
    const head = job.revisionId ? heads.get(job.revisionId) : undefined;
    if (head && isSent(head)) {
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
  heads: ReadonlyMap<string, RevisionHead>
): Promise<Map<string, MirroredRevision>> {
  const ids = jobs.flatMap((job) => {
    const head = job.revisionId ? heads.get(job.revisionId) : undefined;
    return head && isSent(head) ? head.id : [];
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
      origin: true,
    },
  });
  return new Map(rows.map((row) => [row.id, row]));
}

/** Each revision author's first shown claimed name (their primary name), by WikiOS user id. */
async function mirrorNames(revisions: Iterable<MirroredRevision>): Promise<Map<string, string>> {
  const ids = [...new Set([...revisions].flatMap((revision) => revision.authorId ?? []))];
  if (ids.length === 0) return new Map();
  const names = await namesOfUsers(db, ids, { shown: true });
  return new Map(
    [...names].flatMap(([userId, claimed]) =>
      claimed.slice(0, 1).map((first): [string, string] => [userId, first.name])
    )
  );
}

/**
 * The name a revision is imported under. The claimed name of the revision's author, when they show one, goes out as
 * itself (MediaWiki credits that account, `assignknownusers`); every other author goes out as `wikios>Label`. The
 * label (the handle, a country, anything) must never be taken for a MediaWiki user or an IP address, so it carries
 * the import prefix, a form MediaWiki keeps as it is and never maps to an account.
 */
function contributorName(
  revision: MirroredRevision,
  usernames: ReadonlyMap<string, string>
): string {
  const claimed = revision.authorId ? usernames.get(revision.authorId) : undefined;
  return claimed ?? importName(revision.author);
}

/** What `revision` would add to the XML: its text as escaped (an `&` takes five bytes) and its tags. */
function xmlSizeOf(revision: MirroredRevision): number {
  return Buffer.byteLength(escapeXmlText(revision.wikitext), "utf8") + REVISION_XML_OVERHEAD;
}

/** A member with nothing to send: the job's revision is gone, overwritten, or already in MediaWiki (its id). */
function unsentMember(job: MirrorJob, head: RevisionHead | undefined): BatchMember {
  if (!head) return { job, send: false, mwRevId: null };
  if (head.parked) {
    return { job, send: false, mwRevId: head.mwRevId, note: overwrittenNote(head.parkReason) };
  }
  return { job, send: false, mwRevId: head.mwRevId };
}

/**
 * Decide the batch the `jobs` (revision jobs of one title, oldest first, as `pickBatch` hands them over) make, and
 * build its XML. A revision the inbound sync already stamped, one that went with its page, and one that was overwritten
 * (parked) are settled without being sent; the batch takes no revision that would grow its XML past `MAX_BATCH_BYTES`,
 * except the first (decided from the revisions' sizes first, so the text of the jobs left for the next batch is never
 * read, then checked against the XML as escaped). Only reads: nothing is claimed or sent yet.
 */
export async function planRevisionBatch(jobs: readonly MirrorJob[]): Promise<RevisionBatchPlan> {
  const first = jobs[0];
  if (!first) throw new Error("A revision batch needs a job");
  // the jobs may be queued under a title the page no longer has in classic: they go where it is
  const title = await classicTitleOf(first.articleId, first.title);
  const heads = await loadHeads(jobs);
  const candidates = withinBudget(jobs, heads);
  const revisions = await loadRevisions(candidates, heads);
  const usernames = await mirrorNames(revisions.values());
  const { model, format } = contentModelFor(title);

  const members: BatchMember[] = [];
  const sending: MirroredRevision[] = [];
  const chunks: string[] = [];
  let bytes = 0;

  function* revisionsToSend(): Generator<XmlRevision> {
    for (const job of candidates) {
      const head = job.revisionId ? heads.get(job.revisionId) : undefined;
      // a revision to send that cannot be read went with its page since
      const revision = head && isSent(head) ? revisions.get(head.id) : undefined;
      if (!revision) {
        members.push(unsentMember(job, head));
      } else if (sending.length > 0 && bytes + xmlSizeOf(revision) > MAX_BATCH_BYTES) {
        return;
      } else {
        members.push({ job, send: true, revision });
        sending.push(revision);
        yield {
          id: null,
          parentId: null,
          timestamp: toXmlTimestamp(revision.createdAt),
          contributor: { username: contributorName(revision, usernames), id: null },
          minor: revision.minor,
          comment: revision.summary,
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
    title,
    ns: canonicalizeTitle(title, { source: first.source })?.namespaceId ?? 0,
    pageId: null,
    revisions: revisionsToSend(),
  });
  await writer.end();

  const newest = sending.at(-1);
  return {
    title,
    members,
    xml: newest ? chunks.join("") : null,
    importSummary: newest ? importSummaryOf(newest) : DEFAULT_SUMMARY,
  };
}

function sentOf(plan: RevisionBatchPlan): SentMember[] {
  return plan.members.filter((member): member is SentMember => member.send);
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/**
 * Make `revision` (a winner the import left under the mirror's own newer revisions) MediaWiki's current text with one
 * ordinary edit by the mirror account; resolves to the revision it made.
 */
async function promoteWinner(
  title: string,
  revision: MirroredRevision,
  current: CurrentRevision | null
): Promise<number> {
  const result = await executeMediaWikiWrite({
    action: "edit",
    title,
    text: revision.wikitext,
    summary: `${summaryOf(revision)} (WikiOS)`,
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

/** What became of the batch's newest revision once imported. */
type HeadFate =
  /** MediaWiki's current text is it (`promoted`: after one edit over the mirror's own newer revisions). */
  | {
      kind: "current" | "promoted";
      revid: number;
      history: HistoryEntry[] | null;
      except: number | null;
    }
  /** A classic editor's revision dated after it stands: it is history only. */
  | { kind: "history"; later: number; history: HistoryEntry[]; except: number | null };

/**
 * Whether the import made `head` (the batch's newest revision, not judged lost) MediaWiki's current text; if not, it
 * is promoted by one edit only when every revision dated after it is WikiOS's own, else it stays history.
 */
async function headFate(
  title: string,
  head: SentMember,
  sent: readonly SentMember[]
): Promise<HeadFate> {
  const current = await currentRevision(title);
  const except = current?.revid ?? null;
  if (current !== null && current.sha1 === mwSha1Base36(head.revision.wikitext)) {
    return { kind: "current", revid: current.revid, history: null, except };
  }
  const history = await recentHistory(title);
  const later = laterClassicRevision(
    history,
    head.revision,
    sent.map((member) => member.revision)
  );
  if (later !== null) return { kind: "history", later, history, except };
  return {
    kind: "promoted",
    revid: await promoteWinner(title, head.revision, current),
    history,
    except,
  };
}

/** The outcome of a member that sent nothing. */
function unsentOutcome(member: Extract<BatchMember, { send: false }>): BatchOutcome {
  return {
    job: member.job,
    mwRevId: member.mwRevId,
    ...(member.note ? { note: member.note } : {}),
  };
}

/** Find each of `revisions` in the page's history (read now unless given) and stamp the ones found. */
async function stampFromHistory(
  title: string,
  revisions: readonly MirroredRevision[],
  history: HistoryEntry[] | null,
  except: number | null
): Promise<Map<string, number>> {
  if (revisions.length === 0) return new Map();
  const imported = findImported(history ?? (await recentHistory(title)), revisions, except);
  for (const revision of revisions) {
    const id = imported.get(revision.id);
    if (id !== undefined) await stampRevision(revision, id);
  }
  return imported;
}

/** A batch the rule judged lost: every revision is history only, found and stamped, and nothing is pushed. */
async function settleLost(
  plan: RevisionBatchPlan,
  sent: readonly SentMember[],
  winnerRef: string
): Promise<BatchOutcome[]> {
  const imported = await stampFromHistory(
    plan.title,
    sent.map((member) => member.revision),
    null,
    null
  );
  const note = lostNote(winnerRef);
  return plan.members.map((member) =>
    member.send
      ? { job: member.job, mwRevId: imported.get(member.revision.id) ?? null, note }
      : unsentOutcome(member)
  );
}

/** The note of the newest revision, by its fate. */
function headNote(fate: HeadFate): string | undefined {
  if (fate.kind === "promoted") return PROMOTED_NOTE;
  return fate.kind === "history" ? laterNote(fate.later) : undefined;
}

/** An ordinary batch: verify the newest text (promote it, or keep it history), find and stamp the others. */
async function settleImported(
  plan: RevisionBatchPlan,
  sent: readonly SentMember[]
): Promise<BatchOutcome[]> {
  // A batch whose last job had nothing to send (its text is already in MediaWiki) has no newest text to verify.
  const last = plan.members.at(-1);
  const head = last?.send ? last : null;
  const fate = head ? await headFate(plan.title, head, sent) : null;
  const current = fate && fate.kind !== "history" ? fate : null;
  const historical = current ? sent.slice(0, -1) : sent;
  const imported = await stampFromHistory(
    plan.title,
    historical.map((member) => member.revision),
    fate?.history ?? null,
    fate?.except ?? null
  );
  if (head && current) {
    await stampRevision(head.revision, current.revid);
    await stampArticle(head.job, current.revid);
  }

  return plan.members.map((member): BatchOutcome => {
    if (!member.send) return unsentOutcome(member);
    const note = member === head && fate ? headNote(fate) : undefined;
    if (member === head && current) {
      return { job: member.job, mwRevId: current.revid, ...(note ? { note } : {}) };
    }
    const mwRevId = imported.get(member.revision.id) ?? null;
    const shown = note ?? (mwRevId === null ? UNMATCHED_NOTE : undefined);
    return { job: member.job, mwRevId, ...(shown ? { note: shown } : {}) };
  });
}

/**
 * Send a planned batch to MediaWiki and settle its jobs, with what `checkCollision` found: a batch that lost is imported
 * as history only. Resolves to one outcome per member, oldest first. Throws on any failure (the caller fails every job
 * of the batch, for the retry).
 */
export async function executeRevisionBatch(
  plan: RevisionBatchPlan,
  collision: BatchCollision | null = null
): Promise<BatchOutcome[]> {
  const sent = sentOf(plan);
  if (plan.xml === null || sent.length === 0) {
    return plan.members.map((member) =>
      member.send ? { job: member.job, mwRevId: null } : unsentOutcome(member)
    );
  }
  const lost = collision !== null && !collision.wikiosWon;
  // a lost batch's null revision becomes classic's current one: it must not read as the loser's edit
  await postImport({
    ...plan,
    xml: plan.xml,
    importSummary: lost ? LOST_IMPORT_SUMMARY : plan.importSummary,
  });
  return collision && lost
    ? settleLost(plan, sent, collision.verdict.winner.ref)
    : settleImported(plan, sent);
}

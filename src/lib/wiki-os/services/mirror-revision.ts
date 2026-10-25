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
 * Before anything is sent, `checkCollision` asks the conflict rule (conflict-rule.ts) about the batch's newest revision
 * against MediaWiki's current one, when that is a classic editor's revision WikiOS has not seen: the later save wins,
 * by the time each was saved on its own wiki (a tie goes to classic), however late the job runs. The collision goes in
 * the conflict log. A WikiOS winner carries the trail in its summary (written in the database first, so the XML has
 * it); a batch that lost is imported as history only (never current: MediaWiki keeps the later save) and nothing is
 * pushed for it. A parked (overwritten) revision is never sent at all: a classic delete that won keeps the page gone.
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
import {
  executeMediaWikiWrite,
  getMediaWikiAction,
  postMediaWikiAction,
} from "../adapters/mediawiki/write-service";
import { isMirrorAccount } from "../adapters/mediawiki/csrf-cache";
import { contentModelFor } from "../xml/content-model";
import { createExportWriter, escapeXmlText, toXmlTimestamp } from "../xml/export-writer";
import { mwSha1Base36, sha1HexToBase36 } from "../xml/sha1";
import type { XmlRevision } from "../xml/types";
import { decideCollision, trailSummary, type CollisionVerdict } from "./conflict-rule";
import {
  recordConflict,
  setTrailRevision,
  toConflictEntry,
  verdictOfEntry,
  type ConflictRow,
} from "./conflict-log";
import { classicChangeOfRevision, wikiosBranchSince, wikiosEditOf } from "./conflict-sides";
import { importName, INTERWIKI_PREFIX, labelOfImportName } from "./import-label";
import { MIRROR_SOURCE } from "./mirror-outbox";
import type { MirrorJob } from "./mirror-queue";

const DEFAULT_SUMMARY = "WikiOS native edit";
const SUMMARY_LIMIT = 480;
/** The most of an edit summary MediaWiki keeps, in characters (its comment store cuts the rest). */
const COMMENT_LIMIT = 500;
/** Between a summary and the trail appended to it. */
const TRAIL_SEPARATOR = "; ";
/** A trail as `trailSummary` writes it, at the end of a summary. */
const TRAIL_AT_END = /(?:^|; )Overwrote .+ \(conflict [A-Za-z0-9]+\)$/s;
/** A batch takes no revision that would grow its XML past this size (the first revision always goes in). */
export const MAX_BATCH_BYTES = 6 * 1024 * 1024;
/** What a revision's XML adds besides its text: its tags, timestamp, contributor and summary. */
const REVISION_XML_OVERHEAD = 2_000;
/** Pages of the page's history read to find the revisions of a batch. */
const MAX_HISTORY_PAGES = 4;

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
              user: z.string().optional(),
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
  origin: string;
}

export interface CurrentRevision {
  revid: number;
  /** `rev_sha1` in MediaWiki's base 36; null when MediaWiki hides it. */
  sha1: string | null;
  /** Who made it; null when MediaWiki hides that. */
  user: string | null;
  /** When it was saved (MediaWiki's `rev_timestamp`). */
  timestamp: Date;
}

/** One revision of the page's history as MediaWiki lists it. */
interface HistoryEntry {
  revid: number;
  /** In base 36; null when MediaWiki hides it. */
  sha1: string | null;
  /** As MediaWiki writes it, to the second ("2026-09-27T10:00:00Z"). */
  timestamp: string;
  user: string | null;
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

/** What the conflict rule made of a batch against MediaWiki's current revision (see `checkCollision`). */
export interface BatchCollision {
  verdict: CollisionVerdict;
  conflictId: string;
  /** The batch's newest revision won: it goes out with its trail. False: the batch lost and is history only. */
  wikiosWon: boolean;
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
  const own = revision.summary?.replace(TRAIL_AT_END, "").trim();
  return (own || DEFAULT_SUMMARY).slice(0, SUMMARY_LIMIT);
}

/** `summary` with `trail` at its end, the summary cut so MediaWiki keeps the whole trail. */
function withTrail(summary: string | null, trail: string): string {
  const own = summary?.trim();
  if (!own) return trail;
  const room = COMMENT_LIMIT - trail.length - TRAIL_SEPARATOR.length;
  return room > 0 ? `${own.slice(0, room)}${TRAIL_SEPARATOR}${trail}` : trail;
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
  const heads = await loadHeads(jobs);
  const candidates = withinBudget(jobs, heads);
  const revisions = await loadRevisions(candidates, heads);
  const usernames = await mirrorNames(revisions.values());
  const { model, format } = contentModelFor(first.title);

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
    title: first.title,
    ns: canonicalizeTitle(first.title, { source: first.source })?.namespaceId ?? 0,
    pageId: null,
    revisions: revisionsToSend(),
  });
  await writer.end();

  const newest = sending.at(-1);
  return {
    title: first.title,
    members,
    xml: newest ? chunks.join("") : null,
    importSummary: newest ? importSummaryOf(newest) : DEFAULT_SUMMARY,
  };
}

function sentOf(plan: RevisionBatchPlan): SentMember[] {
  return plan.members.filter((member): member is SentMember => member.send);
}

// ---------------------------------------------------------------------------
// MediaWiki's side of the page
// ---------------------------------------------------------------------------

/** MediaWiki's current revision of `title`; null when the page does not exist there. */
async function currentRevision(title: string): Promise<CurrentRevision | null> {
  const data = await getMediaWikiAction(
    {
      action: "query",
      prop: "revisions",
      titles: title,
      rvprop: "ids|sha1|timestamp|user",
      rvlimit: "1",
    },
    revisionsPageSchema
  );
  const revision = data.query.pages[0]?.revisions?.[0];
  if (!revision) return null;
  return {
    revid: revision.revid,
    sha1: revision.sha1 ? sha1HexToBase36(revision.sha1) : null,
    user: revision.user ?? null,
    // never missing in practice; if it were, the classic revision counts as saved now: it wins, nothing is lost
    timestamp: revision.timestamp ? new Date(revision.timestamp) : new Date(),
  };
}

/**
 * The page's history, oldest revision first (a few pages of it: the batch's revisions are among the newest).
 */
async function recentHistory(title: string): Promise<HistoryEntry[]> {
  const history: HistoryEntry[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
    const data = await getMediaWikiAction(
      {
        action: "query",
        prop: "revisions",
        titles: title,
        rvprop: "ids|sha1|timestamp|user",
        rvlimit: "max",
        ...(cursor ? { rvcontinue: cursor } : {}),
      },
      revisionsPageSchema
    );
    for (const { revid, sha1, timestamp, user } of data.query.pages[0]?.revisions ?? []) {
      if (timestamp) {
        history.push({
          revid,
          sha1: sha1 ? sha1HexToBase36(sha1) : null,
          timestamp,
          user: user ?? null,
        });
      }
    }
    cursor = data.continue?.rvcontinue;
    if (!cursor) break;
  }
  return history.sort((a, b) => a.revid - b.revid);
}

/** MediaWiki's history order: by time, then by id. */
function byTime(a: HistoryEntry, b: HistoryEntry): number {
  return a.timestamp === b.timestamp ? a.revid - b.revid : a.timestamp < b.timestamp ? -1 : 1;
}

/** A revision WikiOS wrote itself: by the mirror account, or imported under the `wikios>` prefix. */
function isWikiosOwn(entry: Pick<HistoryEntry, "user">): boolean {
  return (
    isMirrorAccount(entry.user) || (entry.user !== null && labelOfImportName(entry.user) !== null)
  );
}

/**
 * The MediaWiki revision of each of `revisions` (oldest first), found by hash and timestamp in `history` (the first,
 * in import order, that nobody claimed yet, so identical revisions of one second are told apart); `except` is the
 * current revision, which the import's null revision may share a hash and a second with.
 */
function findImported(
  history: readonly HistoryEntry[],
  revisions: readonly MirroredRevision[],
  except: number | null
): Map<string, number> {
  const pool = history.filter((entry) => entry.revid !== except && entry.sha1 !== null);
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

/**
 * The newest revision of `history` dated after `revision` (the same second counts: a tie goes to classic) that a
 * classic editor made; null when every one is WikiOS's own (the mirror's null revisions, its imports). The revision's
 * own import is not one.
 */
function laterClassicRevision(
  history: readonly HistoryEntry[],
  revision: MirroredRevision
): number | null {
  const second = toXmlTimestamp(revision.createdAt);
  const own = findImported(history, [revision], null).get(revision.id);
  const later = history.filter(
    (entry) => entry.timestamp >= second && entry.revid !== own && !isWikiosOwn(entry)
  );
  return later.at(-1)?.revid ?? null;
}

/** The MediaWiki ids among `revids` that a revision of the article carries (WikiOS has that revision). */
async function stampedIn(articleId: string, revids: readonly number[]): Promise<Set<number>> {
  if (revids.length === 0) return new Set();
  const rows = await db.wikiRevision.findMany({
    where: { articleId, mwRevId: { in: [...revids] } },
    select: { mwRevId: true },
  });
  return new Set(rows.flatMap((row) => row.mwRevId ?? []));
}

// ---------------------------------------------------------------------------
// The conflict rule, before anything is sent
// ---------------------------------------------------------------------------

/**
 * The classic side of a collision: the revisions classic editors made since the newest one WikiOS has (the base), and
 * that base. With no base in the history read, none (the rule still counts classic's current revision).
 */
async function classicSince(
  title: string,
  articleId: string
): Promise<{ base: HistoryEntry | null; branch: HistoryEntry[] }> {
  const history = [...(await recentHistory(title))].sort(byTime);
  const stamped = await stampedIn(
    articleId,
    history.map((entry) => entry.revid)
  );
  const baseAt = history.reduce((at, entry, index) => (stamped.has(entry.revid) ? index : at), -1);
  if (baseAt === -1) return { base: null, branch: [] };
  // nothing after the base is stamped: the base is the newest revision WikiOS has
  const branch = history.slice(baseAt + 1).filter((entry) => !isWikiosOwn(entry));
  return { base: history[baseAt] ?? null, branch };
}

/**
 * The rule's verdict on `revision` (the batch's newest) against MediaWiki's current revision, recorded in the conflict
 * log. Null when there is nothing to judge: the page is not in MediaWiki, its current revision is the mirror's own, or
 * WikiOS has it already (the inbound sync brought it over and judged it then).
 */
async function judgeAgainstClassic(
  title: string,
  articleId: string,
  revision: MirroredRevision
): Promise<BatchCollision | null> {
  const current = await currentRevision(title);
  if (!current || isMirrorAccount(current.user)) return null;
  if ((await stampedIn(articleId, [current.revid])).size > 0) return null;

  const { base, branch } = await classicSince(title, articleId);
  const incoming = await wikiosEditOf(revision);
  const wikiosBranch = await wikiosBranchSince(articleId, base?.revid ?? 0, base?.sha1 ?? null);
  const verdict = decideCollision(MIRROR_SOURCE, articleId, {
    incoming,
    standing: await classicChangeOfRevision(current),
    // what WikiOS changed since the base up to this revision; anything later is judged with its own batch
    incomingBranch: wikiosBranch.filter((change) => change.at <= incoming.at),
    standingBranch: await Promise.all(
      branch.map((entry) =>
        classicChangeOfRevision({
          revid: entry.revid,
          user: entry.user,
          timestamp: new Date(entry.timestamp),
        })
      )
    ),
  });
  const { id } = await recordConflict(db, {
    source: MIRROR_SOURCE,
    articleId,
    title,
    verdict,
    baseRef: base ? String(base.revid) : null,
  });
  return { verdict, conflictId: id, wikiosWon: verdict.incomingWins };
}

/** Puts the trail of `row` (a collision `revision` won) in the revision's summary, once: true for the one that does. */
async function writeTrail(row: ConflictRow, revision: MirroredRevision): Promise<boolean> {
  const trail = trailSummary(verdictOfEntry(toConflictEntry(row)), row.id);
  return db.$transaction(async (tx) => {
    if (!(await setTrailRevision(tx, row.id, revision.id))) return false;
    await tx.wikiRevision.update({
      where: { id: revision.id },
      data: { summary: withTrail(revision.summary, trail) },
    });
    return true;
  });
}

/**
 * The collisions a revision of the batch won that have no trail yet (judged here, or by the inbound cycle before the
 * job ran): each winner's summary gets its trail, exactly once. The last one written, or null for none.
 */
async function writeTrails(
  articleId: string,
  revisions: readonly MirroredRevision[]
): Promise<BatchCollision | null> {
  const byId = new Map(revisions.map((revision) => [revision.id, revision]));
  const rows = await db.wikiConflict.findMany({
    where: {
      articleId,
      winnerSide: "wikios",
      winnerRef: { in: [...byId.keys()] },
      trailRevisionId: null,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  let written: BatchCollision | null = null;
  for (const row of rows) {
    const revision = byId.get(row.winnerRef);
    if (revision && (await writeTrail(row, revision))) {
      written = {
        verdict: verdictOfEntry(toConflictEntry(row)),
        conflictId: row.id,
        wikiosWon: true,
      };
    }
  }
  return written;
}

/**
 * Ask the conflict rule about a planned batch before it is sent: its newest revision against MediaWiki's current one
 * (see `judgeAgainstClassic`), by the time each was saved on its own wiki, however late the job runs. A collision is
 * recorded in the conflict log (one row, whichever of the mirror and the inbound cycle sees it first): `wikiosWon`
 * false means the batch lost and is history only. Every collision a revision of the batch won, here or one the inbound
 * cycle judged before the job ran, has its trail written into that revision's summary in the database, once. The
 * caller plans the batch again whenever this resolves to a collision, so the XML carries the trails. Null when there
 * is nothing to judge and no trail to write.
 */
export async function checkCollision(plan: RevisionBatchPlan): Promise<BatchCollision | null> {
  const sent = sentOf(plan);
  const newest = sent.at(-1);
  const articleId = newest?.job.articleId;
  if (!newest || !articleId) return null;
  const judged = await judgeAgainstClassic(plan.title, articleId, newest.revision);
  // a revision of a batch that lost can have won an earlier collision: its history line names that one
  const trailed = await writeTrails(
    articleId,
    sent.map((member) => member.revision)
  );
  return judged ?? trailed;
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
async function headFate(title: string, head: SentMember): Promise<HeadFate> {
  const current = await currentRevision(title);
  const except = current?.revid ?? null;
  if (current !== null && current.sha1 === mwSha1Base36(head.revision.wikitext)) {
    return { kind: "current", revid: current.revid, history: null, except };
  }
  const history = await recentHistory(title);
  const later = laterClassicRevision(history, head.revision);
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
  const fate = head ? await headFate(plan.title, head) : null;
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
  await postImport({ ...plan, xml: plan.xml });
  return collision && !collision.wikiosWon
    ? settleLost(plan, sent, collision.verdict.winner.ref)
    : settleImported(plan, sent);
}

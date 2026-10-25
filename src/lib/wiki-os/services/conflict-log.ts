/**
 * The conflict log: one `wiki_conflicts` row per collision between WikiOS and classic MediaWiki, keyed by the rule's
 * `conflictKey` so the mirror and the inbound cycle, whichever notices it first, record the same row. A row holds what
 * the winner overwrote (a later loser of the same winner joins it), who has been told and where, and the page-history
 * entry that names the overwrite. Rows made from the old "parked" revisions are history only: nobody is told.
 *
 * `overwritten` and `notified` are JSON; this module is the only reader and writer of their shapes.
 */
import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import {
  noticeRecipients,
  type ChangeAction,
  type ChangeAuthor,
  type CollisionVerdict,
  type NoticeChannel,
  type NoticeRecipient,
  type PageChange,
  type WikiSide,
} from "./conflict-rule";

type Client = Prisma.TransactionClient | typeof db;
type JsonObject = { [key: string]: Prisma.JsonValue };

/** Why a channel could not reach its recipient, for good: the row settles, and the log says the notice never arrived. */
export type UndeliveredReason = "talk-page-deleted";

export interface NoticeMark {
  key: string;
  channel: NoticeChannel;
  at: string;
  /** Set when the notice was given up undelivered; absent for a notice that was delivered or had nothing to deliver. */
  undelivered?: UndeliveredReason;
}

export interface ConflictLogEntry {
  id: string;
  key: string;
  source: string;
  articleId: string | null;
  title: string;
  winner: { side: WikiSide; action: ChangeAction; ref: string; at: Date };
  baseRef: string | null;
  overwritten: PageChange[];
  notified: NoticeMark[];
  trailRevisionId: string | null;
  legacyPark: boolean;
  /** Everyone told and the trail written (or given up); null while the settling owes something. */
  settledAt: Date | null;
  createdAt: Date;
}

export type ConflictRow = Prisma.WikiConflictGetPayload<Record<string, never>>;

/** How many times a merge retries when another writer changed the row between its read and its write. */
const MERGE_ATTEMPTS = 5;

const SIDES: readonly WikiSide[] = ["wikios", "classic"];
const ACTIONS: readonly ChangeAction[] = ["edit", "delete", "move", "undelete"];
const CHANNELS: readonly NoticeChannel[] = ["in-app", "discord", "talk-page"];
const UNDELIVERED_REASONS: readonly UndeliveredReason[] = ["talk-page-deleted"];

// --- the JSON shapes ------------------------------------------------------------------------------------------------

function isObject(value: Prisma.JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function oneOf<T extends string>(options: readonly T[], value: string | null): T | null {
  return options.find((option) => option === value) ?? null;
}

function decodeAuthor(value: Prisma.JsonValue | undefined): ChangeAuthor {
  const raw = isObject(value) ? value : {};
  return {
    userId: text(raw.userId),
    classicName: text(raw.classicName),
    ip: text(raw.ip),
    label: text(raw.label),
  };
}

function decodeChange(value: Prisma.JsonValue): PageChange | null {
  if (!isObject(value)) return null;
  const side = oneOf(SIDES, text(value.side));
  const action = oneOf(ACTIONS, text(value.action));
  const ref = text(value.ref);
  const at = new Date(text(value.at) ?? Number.NaN);
  if (!side || !action || !ref || Number.isNaN(at.getTime())) return null;
  return { side, action, ref, at, author: decodeAuthor(value.author) };
}

function decodeChanges(value: Prisma.JsonValue): PageChange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => decodeChange(item) ?? []);
}

function decodeMarks(value: Prisma.JsonValue): NoticeMark[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isObject(item)) return [];
    const key = text(item.key);
    const channel = oneOf(CHANNELS, text(item.channel));
    const at = text(item.at);
    const undelivered = oneOf(UNDELIVERED_REASONS, text(item.undelivered));
    if (!key || !channel || !at) return [];
    return [undelivered ? { key, channel, at, undelivered } : { key, channel, at }];
  });
}

function encodeChange(change: PageChange): Prisma.InputJsonObject {
  return {
    side: change.side,
    action: change.action,
    ref: change.ref,
    at: change.at.toISOString(),
    author: { ...change.author },
  };
}

function encodeChanges(changes: readonly PageChange[]): Prisma.InputJsonArray {
  return changes.map(encodeChange);
}

/** The stored changes plus those of `added` whose ref is not already there; the stored ones are never rewritten. */
function unionByRef(stored: PageChange[], added: readonly PageChange[]): PageChange[] {
  const byRef = new Map(stored.map((change) => [change.ref, change]));
  for (const change of added) if (!byRef.has(change.ref)) byRef.set(change.ref, change);
  return [...byRef.values()];
}

// --- record ---------------------------------------------------------------------------------------------------------

export interface RecordConflictInput {
  source: string;
  articleId: string | null;
  title: string;
  verdict: CollisionVerdict;
  baseRef: string | null;
}

/**
 * Compare-and-swap on `updatedAt`: reads the row, lets `change` compute its new data, and writes it only if no one
 * else wrote in between. Returns false when the row is gone. Gives up (throws) after `MERGE_ATTEMPTS` lost races.
 */
async function updateRow(
  client: Client,
  conflictId: string,
  change: (row: ConflictRow) => Prisma.WikiConflictUpdateManyMutationInput | null
): Promise<boolean> {
  for (let attempt = 0; attempt < MERGE_ATTEMPTS; attempt += 1) {
    const row = await client.wikiConflict.findUnique({ where: { id: conflictId } });
    if (!row) return false;
    const data = change(row);
    if (!data) return true;
    const won = await client.wikiConflict.updateMany({
      where: { id: conflictId, updatedAt: row.updatedAt },
      data,
    });
    if (won.count === 1) return true;
  }
  throw new Error(`conflict ${conflictId} kept changing under this writer`);
}

/** Adds what `changes` lists and the row does not to its overwritten; the winner is never touched. */
async function mergeOverwritten(
  client: Client,
  conflictId: string,
  changes: readonly PageChange[]
): Promise<void> {
  await updateRow(client, conflictId, (current) => {
    const stored = decodeChanges(current.overwritten);
    const merged = unionByRef(stored, changes);
    // a new loser has to be told: a settled row is open again
    return merged.length === stored.length
      ? null
      : { overwritten: encodeChanges(merged), settledAt: null };
  });
}

/**
 * The row in which a WikiOS winner already overwrote one of the classic changes this verdict overwrites (settled or
 * not). The mirror and the inbound cycle can name different WikiOS winners for one classic loser (a save lands between
 * them): that loser lost once, in that row. Only a WikiOS winner overwrites classic changes, so only such rows match.
 */
async function rowOverwritingLoser(
  client: Client,
  input: RecordConflictInput
): Promise<ConflictRow | null> {
  const losers = new Set(
    input.verdict.overwritten
      .filter((change) => change.side === "classic")
      .map((change) => change.ref)
  );
  // a classic winner overwrote WikiOS's changes only: nothing to look for (and no query)
  if (losers.size === 0 || !input.articleId) return null;
  const rows = await client.wikiConflict.findMany({
    // an old park's row tells nobody: a loser merged there would never be told
    where: { articleId: input.articleId, legacyPark: false },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return (
    rows.find((row) => decodeChanges(row.overwritten).some((change) => losers.has(change.ref))) ??
    null
  );
}

/**
 * Records a collision once. The first caller creates the row; every later one (the other wiki's cycle, a second loser
 * of the same winner) merges what it overwrote into it by `ref` and leaves the winner as it was. A WikiOS-won verdict
 * whose classic loser another WikiOS winner already overwrote merges into that row (`rowOverwritingLoser`): one row,
 * one notice, one trail per lost classic change.
 */
export async function recordConflict(
  client: Client,
  input: RecordConflictInput
): Promise<{ id: string; created: boolean }> {
  const { verdict } = input;
  const earlier = await rowOverwritingLoser(client, input);
  if (earlier) {
    await mergeOverwritten(client, earlier.id, verdict.overwritten);
    return { id: earlier.id, created: false };
  }
  const made = await client.wikiConflict.createMany({
    data: [
      {
        key: verdict.key,
        source: input.source,
        articleId: input.articleId,
        title: input.title,
        winnerSide: verdict.winner.side,
        winnerAction: verdict.winner.action,
        winnerRef: verdict.winner.ref,
        winnerAt: verdict.winner.at,
        baseRef: input.baseRef,
        overwritten: encodeChanges(verdict.overwritten),
      },
    ],
    skipDuplicates: true,
  });
  const row = await client.wikiConflict.findUniqueOrThrow({ where: { key: verdict.key } });
  if (made.count === 1) return { id: row.id, created: true };
  await mergeOverwritten(client, row.id, verdict.overwritten);
  return { id: row.id, created: false };
}

/**
 * A change that won and leaves no page to show the losers on (a delete): the WikiOS revisions it overwrote become
 * history only, under its ref, never NULL, so a page that comes back has the text MediaWiki kept.
 */
export async function parkOverwritten(
  tx: Prisma.TransactionClient,
  articleId: string,
  verdict: CollisionVerdict
): Promise<void> {
  const revisions = verdict.overwritten.filter(
    (change) => change.side === "wikios" && change.action === "edit"
  );
  await parkRevisions(tx, articleId, revisions, verdict.winner.ref);
}

/** WikiOS revisions `changes` become history only (overwritten), under `winnerRef`. */
export async function parkRevisions(
  tx: Prisma.TransactionClient,
  articleId: string,
  changes: readonly PageChange[],
  winnerRef: string
): Promise<void> {
  if (changes.length === 0) return;
  await tx.wikiRevision.updateMany({
    where: { articleId, id: { in: changes.map((change) => change.ref) }, parked: false },
    data: { parked: true, parkReason: `overwritten:${winnerRef}` },
  });
}

// --- notices --------------------------------------------------------------------------------------------------------

/**
 * Who still has to be told, and on which channels: each overwritten author once, minus the channels already marked.
 * A legacy row (an old park) has nobody to tell.
 */
export function pendingRecipients(row: {
  overwritten: Prisma.JsonValue;
  notified: Prisma.JsonValue;
  legacyPark: boolean;
}): NoticeRecipient[] {
  if (row.legacyPark) return [];
  const done = new Set(decodeMarks(row.notified).map((mark) => `${mark.key}/${mark.channel}`));
  return noticeRecipients(decodeChanges(row.overwritten)).flatMap((recipient) => {
    const channels = recipient.channels.filter(
      (channel) => !done.has(`${recipient.key}/${channel}`)
    );
    return channels.length > 0 ? [{ ...recipient, channels }] : [];
  });
}

/** Marks one person told on one channel. Marking twice leaves one entry. */
export async function markNotified(
  conflictId: string,
  recipientKey: string,
  channel: NoticeChannel,
  undelivered?: UndeliveredReason
): Promise<void> {
  await updateRow(db, conflictId, (row) => {
    const marks = decodeMarks(row.notified);
    if (marks.some((mark) => mark.key === recipientKey && mark.channel === channel)) return null;
    const at = new Date().toISOString();
    const added: NoticeMark = undelivered
      ? { key: recipientKey, channel, at, undelivered }
      : { key: recipientKey, channel, at };
    return { notified: [...marks, added].map((mark) => ({ ...mark })) };
  });
}

/**
 * Closes the row once nobody is left to tell (the settler has dealt with the trail): settled rows are not read again
 * until a merge adds a loser. Judged on the row as it is when written, so a loser merged in meanwhile keeps it open.
 * True when the row is settled.
 */
export async function markSettled(conflictId: string): Promise<boolean> {
  let settled = false;
  await updateRow(db, conflictId, (row) => {
    settled = pendingRecipients(row).length === 0;
    return settled && !row.settledAt ? { settledAt: new Date() } : null;
  });
  return settled;
}

/** Claims the trail revision for the conflict: true for the one caller that gets there first, false after. */
export async function setTrailRevision(
  tx: Prisma.TransactionClient,
  conflictId: string,
  revisionId: string
): Promise<boolean> {
  const claimed = await tx.wikiConflict.updateMany({
    where: { id: conflictId, trailRevisionId: null },
    data: { trailRevisionId: revisionId },
  });
  return claimed.count === 1;
}

// --- read -----------------------------------------------------------------------------------------------------------

/** How many characters of an id name it to people (a restore's summary, the admin log). */
const SHORT_ID_LENGTH = 8;

/** An id (a conflict's, a revision's) as people read it: its last characters; a cuid's first ones are its time. */
export function shortConflictId(id: string): string {
  return id.slice(-SHORT_ID_LENGTH);
}

/** A stored row, its JSON decoded. */
export function toConflictEntry(row: ConflictRow): ConflictLogEntry {
  return {
    id: row.id,
    key: row.key,
    source: row.source,
    articleId: row.articleId,
    title: row.title,
    winner: {
      side: oneOf(SIDES, row.winnerSide) ?? "classic",
      action: oneOf(ACTIONS, row.winnerAction) ?? "edit",
      ref: row.winnerRef,
      at: row.winnerAt,
    },
    baseRef: row.baseRef,
    overwritten: decodeChanges(row.overwritten),
    notified: decodeMarks(row.notified),
    trailRevisionId: row.trailRevisionId,
    legacyPark: row.legacyPark,
    settledAt: row.settledAt,
    createdAt: row.createdAt,
  };
}

const NO_AUTHOR: ChangeAuthor = { userId: null, classicName: null, ip: null, label: null };

/** A stored row as the rule's verdict, for its trail: the winner (its author is not stored) and what it overwrote. */
export function verdictOfEntry(entry: ConflictLogEntry): CollisionVerdict {
  return {
    winner: { ...entry.winner, author: NO_AUTHOR },
    overwritten: entry.overwritten,
    incomingWins: true,
    key: entry.key,
  };
}

/** The rows of an article (old parks left out: they decide nothing), oldest first. */
export async function conflictsOfArticle(articleId: string): Promise<ConflictLogEntry[]> {
  const rows = await db.wikiConflict.findMany({
    where: { articleId, legacyPark: false },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toConflictEntry);
}

/** The row in which the change `winnerRef` won (old parks left out); null when it won none. */
export async function conflictWonBy(winnerRef: string): Promise<ConflictLogEntry | null> {
  const row = await db.wikiConflict.findFirst({
    where: { winnerRef, legacyPark: false },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return row ? toConflictEntry(row) : null;
}

/** Newest first. `cursor` is the `nextCursor` of the previous page. */
export async function listConflicts(input: {
  cursor?: string;
  limit: number;
  articleId?: string;
}): Promise<{ items: ConflictLogEntry[]; nextCursor: string | null }> {
  const rows = await db.wikiConflict.findMany({
    where: input.articleId ? { articleId: input.articleId } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 0 } : {}),
  });
  const page = rows.slice(0, input.limit);
  const next = rows[input.limit];
  return { items: page.map(toConflictEntry), nextCursor: next ? next.id : null };
}

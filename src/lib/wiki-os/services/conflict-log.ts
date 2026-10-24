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

export interface NoticeMark {
  key: string;
  channel: NoticeChannel;
  at: string;
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
  createdAt: Date;
}

type ConflictRow = Prisma.WikiConflictGetPayload<Record<string, never>>;

/** How many times a merge retries when another writer changed the row between its read and its write. */
const MERGE_ATTEMPTS = 5;

const SIDES: readonly WikiSide[] = ["wikios", "classic"];
const ACTIONS: readonly ChangeAction[] = ["edit", "delete", "move", "undelete"];
const CHANNELS: readonly NoticeChannel[] = ["in-app", "discord", "talk-page"];

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
    return key && channel && at ? [{ key, channel, at }] : [];
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

/**
 * Records a collision once. The first caller creates the row; every later one (the other wiki's cycle, a second loser
 * of the same winner) merges what it overwrote into it by `ref` and leaves the winner as it was.
 */
export async function recordConflict(
  client: Client,
  input: RecordConflictInput
): Promise<{ id: string; created: boolean }> {
  const { verdict } = input;
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
  await updateRow(client, row.id, (current) => {
    const stored = decodeChanges(current.overwritten);
    const merged = unionByRef(stored, verdict.overwritten);
    return merged.length === stored.length ? null : { overwritten: encodeChanges(merged) };
  });
  return { id: row.id, created: false };
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
  channel: NoticeChannel
): Promise<void> {
  await updateRow(db, conflictId, (row) => {
    const marks = decodeMarks(row.notified);
    if (marks.some((mark) => mark.key === recipientKey && mark.channel === channel)) return null;
    const added: NoticeMark = { key: recipientKey, channel, at: new Date().toISOString() };
    return { notified: [...marks, added].map((mark) => ({ ...mark })) };
  });
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

function toEntry(row: ConflictRow): ConflictLogEntry {
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
    createdAt: row.createdAt,
  };
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
  return { items: page.map(toEntry), nextCursor: next ? next.id : null };
}

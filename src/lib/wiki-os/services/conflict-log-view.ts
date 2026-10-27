/**
 * The conflict log as an administrator reads it: each row's page, the change that won, what it overwrote, who has been
 * told where, its trail and whether the settling is done, every change named as people read it. A WikiOS revision
 * MediaWiki has is "revision N" by its MediaWiki id (never its row id); a log entry (a delete, move or restore, on either
 * wiki) is named by its kind, and a `log:<id>` trail is a log entry, never looked up as a revision.
 */
import type { ChangeAction, NoticeChannel, PageChange, WikiSide } from "./conflict-rule";
import {
  listConflicts,
  shortConflictId,
  type ConflictLogEntry,
  type UndeliveredReason,
} from "./conflict-log";
import { shownRefs } from "./conflict-sides";

export interface ShownChange {
  side: WikiSide;
  action: ChangeAction;
  /** The ref as the row stores it. */
  ref: string;
  /** The change as people read it: "revision 1234", "deletion, log 56", "WikiOS move". */
  label: string;
  at: Date;
  /** Who made it, as the wikis name them; null when the row does not keep it (a winner). */
  author: string | null;
}

export interface ShownNotice {
  who: string;
  channel: NoticeChannel;
  at: string;
  /** Why the notice never arrived, as the log says it; null for one that was delivered. */
  undelivered: string | null;
}

/** legacy: an old park, history only (nobody is told); settled: everyone told; pending: the settling owes something. */
export type ConflictState = "legacy" | "settled" | "pending";

export interface ConflictLogRow {
  id: string;
  shortId: string;
  title: string;
  articleId: string | null;
  createdAt: Date;
  state: ConflictState;
  legacy: boolean;
  winner: ShownChange;
  overwritten: ShownChange[];
  notices: ShownNotice[];
  /** The page-history entry naming the overwrite, as people read it; null while there is none. */
  trail: string | null;
}

const NOUNS: Readonly<Record<ChangeAction, string>> = {
  edit: "edit",
  delete: "deletion",
  move: "move",
  undelete: "restore",
};

const UNDELIVERED: Readonly<Record<UndeliveredReason, string>> = {
  "talk-page-deleted": "Not delivered: talk page deleted",
  "talk-page-refused": "Not delivered: the talk page refused the note for a day",
  "dm-gave-up": "Not delivered: the Discord DM failed for a day",
};

const NO_AUTHOR = { userId: null, classicName: null, ip: null, label: null };
const CLASSIC_REVISION = /^\d+$/;
const CLASSIC_LOG = /^mwlog:(\d+)$/;

/** A ref, as `shownRefs` turned it, in words. */
function labelOf(action: ChangeAction, shown: string): string {
  if (CLASSIC_REVISION.test(shown)) return `revision ${shown}`;
  const classicLog = CLASSIC_LOG.exec(shown);
  if (classicLog) return `${NOUNS[action]}, log ${classicLog[1]}`;
  if (shown.startsWith("log:")) return `WikiOS ${NOUNS[action]}`;
  if (shown.startsWith("job:")) return `WikiOS ${NOUNS[action]}, not logged`;
  return `WikiOS revision ${shortConflictId(shown)}, not in MediaWiki yet`;
}

function authorName(change: PageChange): string | null {
  const { classicName, label, ip } = change.author;
  return classicName ?? label ?? ip;
}

/**
 * A notice's recipient (`user:<id>`, `name:<classic name>`, `ip:<address>`), as the row's authors name them: an account
 * by the name its change shows, anyone else by the name or address the key holds.
 */
function whoOf(key: string, overwritten: readonly PageChange[]): string {
  const value = key.slice(key.indexOf(":") + 1);
  const change = overwritten.find((candidate) => candidate.author.userId === value);
  return (change && authorName(change)) ?? value;
}

function stateOf(entry: ConflictLogEntry): ConflictState {
  if (entry.legacyPark) return "legacy";
  return entry.settledAt ? "settled" : "pending";
}

function trailOf(trailRevisionId: string | null, shown: Map<string, string>): string | null {
  if (!trailRevisionId) return null;
  if (trailRevisionId.startsWith("log:")) return "WikiOS log entry";
  return labelOf("edit", shown.get(trailRevisionId) ?? trailRevisionId);
}

function toRow(entry: ConflictLogEntry, shown: Map<string, string>): ConflictLogRow {
  const show = (change: PageChange, author: string | null): ShownChange => ({
    side: change.side,
    action: change.action,
    ref: change.ref,
    label: labelOf(change.action, shown.get(change.ref) ?? change.ref),
    at: change.at,
    author,
  });
  return {
    id: entry.id,
    shortId: shortConflictId(entry.id),
    title: entry.title,
    articleId: entry.articleId,
    createdAt: entry.createdAt,
    state: stateOf(entry),
    legacy: entry.legacyPark,
    winner: show({ ...entry.winner, author: NO_AUTHOR }, null),
    overwritten: entry.overwritten.map((change) => show(change, authorName(change))),
    notices: entry.notified.map((mark) => ({
      who: whoOf(mark.key, entry.overwritten),
      channel: mark.channel,
      at: mark.at,
      undelivered: mark.undelivered ? UNDELIVERED[mark.undelivered] : null,
    })),
    trail: trailOf(entry.trailRevisionId, shown),
  };
}

/** Every ref of the page's rows, with the form people read it in (one lookup for the page). */
async function shownForm(entries: readonly ConflictLogEntry[]): Promise<Map<string, string>> {
  const refs = [
    ...new Set(
      entries.flatMap((entry) => [
        entry.winner.ref,
        ...entry.overwritten.map((change) => change.ref),
        ...(entry.trailRevisionId ? [entry.trailRevisionId] : []),
      ])
    ),
  ];
  const shown = await shownRefs(refs);
  return new Map(refs.map((ref, at) => [ref, shown[at] ?? ref]));
}

/** A page of the conflict log, newest first (`cursor`: the previous page's `nextCursor`). */
export async function conflictLogPage(input: {
  cursor?: string;
  limit: number;
  articleId?: string;
}): Promise<{ items: ConflictLogRow[]; nextCursor: string | null }> {
  const page = await listConflicts(input);
  const shown = await shownForm(page.items);
  return { items: page.items.map((entry) => toRow(entry, shown)), nextCursor: page.nextCursor };
}

/**
 * The conflict rule, in one place. WikiOS and classic MediaWiki are both editable; when both change a page from the
 * same base, the later save wins on both wikis and every overwritten author is told. Every caller (the mirror's push,
 * the inbound cycle, imports, undeletes, restores) asks `decideCollision` and nothing else.
 *
 * "Later" is the commit time on a change's own wiki, compared in whole seconds; a tie goes to classic. The verdict is
 * the same whichever side the caller passes as `incoming`, so the mirror and the inbound cycle always agree.
 *
 * Pure: no imports from the switches or the database.
 */

export type WikiSide = "wikios" | "classic";
export type ChangeAction = "edit" | "delete" | "move" | "undelete";

export interface ChangeAuthor {
  userId: string | null;
  classicName: string | null;
  ip: string | null;
  /** Display label for a change with no account behind it (system, bot). */
  label: string | null;
}

export interface PageChange {
  side: WikiSide;
  action: ChangeAction;
  /** A toRevisionRef, or "log:<id>" / "mwlog:<id>" for a change with no revision. */
  ref: string;
  /** Effective time: the commit time on its own wiki, or the moment an import, undelete or restore happened. */
  at: Date;
  author: ChangeAuthor;
}

export interface CollisionInput {
  incoming: PageChange;
  standing: PageChange;
  /** Each branch is that side's changes since the common base, its incoming or standing change included. */
  incomingBranch: readonly PageChange[];
  standingBranch: readonly PageChange[];
}

export interface CollisionVerdict {
  winner: PageChange;
  overwritten: readonly PageChange[];
  incomingWins: boolean;
  key: string;
}

export type NoticeChannel = "in-app" | "discord" | "talk-page";

export interface NoticeRecipient {
  key: string;
  userId: string | null;
  classicName: string | null;
  ip: string | null;
  channels: readonly NoticeChannel[];
  refs: readonly string[];
}

/** The longest trail summary, in characters. */
const TRAIL_SUMMARY_MAX = 480;
/** How many changes and authors the trail summary names before it says "and N more". */
const SUMMARY_NAMED_MAX = 3;
const SUMMARY_NAME_MAX = 60;

function second(change: PageChange): number {
  return Math.floor(change.at.getTime() / 1000);
}

/** Orders two changes by time, then by ref, so the order never depends on argument order. */
function byTimeThenRef(a: PageChange, b: PageChange): number {
  const bySecond = second(a) - second(b);
  if (bySecond !== 0) return bySecond;
  if (a.ref === b.ref) return 0;
  return a.ref < b.ref ? -1 : 1;
}

/** The later of two changes by `at` in whole seconds; the same second goes to the classic one. */
export function laterChange(a: PageChange, b: PageChange): PageChange {
  const bySecond = second(a) - second(b);
  if (bySecond !== 0) return bySecond > 0 ? a : b;
  if (a.side !== b.side) return a.side === "classic" ? a : b;
  return byTimeThenRef(a, b) >= 0 ? a : b;
}

export function conflictKey(source: string, articleKey: string, winnerRef: string): string {
  return `${source}:${articleKey}:${winnerRef}`;
}

/** A branch without repeated refs, oldest first, so the overwritten list reads the same from either side. */
function orderedBranch(branch: readonly PageChange[]): PageChange[] {
  const byRef = new Map<string, PageChange>();
  for (const change of branch) if (!byRef.has(change.ref)) byRef.set(change.ref, change);
  return [...byRef.values()].sort(byTimeThenRef);
}

export function decideCollision(
  source: string,
  articleKey: string,
  input: CollisionInput
): CollisionVerdict {
  const winner = laterChange(input.incoming, input.standing);
  const incomingWins = winner === input.incoming;
  return {
    winner,
    overwritten: orderedBranch(incomingWins ? input.standingBranch : input.incomingBranch),
    incomingWins,
    key: conflictKey(source, articleKey, winner.ref),
  };
}

function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

interface Identity {
  userId: string | null;
  classicName: string | null;
  ip: string | null;
}

function identityOf(author: ChangeAuthor): Identity {
  return {
    userId: clean(author.userId),
    classicName: clean(author.classicName),
    ip: clean(author.ip),
  };
}

function keyOf(identity: Identity): string | null {
  if (identity.userId) return `user:${identity.userId}`;
  if (identity.classicName) return `name:${identity.classicName}`;
  if (identity.ip) return `ip:${identity.ip}`;
  return null;
}

function channelsOf(identity: Identity): NoticeChannel[] {
  const channels: NoticeChannel[] = [];
  if (identity.userId) channels.push("in-app", "discord");
  if (identity.classicName || (!identity.userId && identity.ip)) channels.push("talk-page");
  return channels;
}

/** Classic names that a change in the list ties to an IxStates user, so one person is one recipient. */
function claimedNames(overwritten: readonly PageChange[]): Map<string, string> {
  const claimed = new Map<string, string>();
  for (const change of overwritten) {
    const { userId, classicName } = identityOf(change.author);
    if (userId && classicName) claimed.set(classicName, userId);
  }
  return claimed;
}

/**
 * One recipient per distinct author, with every ref they were overwritten at. A WikiOS user who also has a claimed
 * classic name gets all three channels; an author with no account, name or address (system, bot) gets nobody.
 */
export function noticeRecipients(overwritten: readonly PageChange[]): NoticeRecipient[] {
  const claimed = claimedNames(overwritten);
  const recipients = new Map<string, NoticeRecipient>();
  for (const change of overwritten) {
    const identity = identityOf(change.author);
    const claimant = identity.userId ? null : claimed.get(identity.classicName ?? "");
    const merged: Identity = claimant ? { ...identity, userId: claimant } : identity;
    const key = keyOf(merged);
    if (!key) continue;
    const known = recipients.get(key);
    if (!known) {
      recipients.set(key, { key, ...merged, channels: channelsOf(merged), refs: [change.ref] });
    } else if (!known.refs.includes(change.ref)) {
      recipients.set(key, { ...known, refs: [...known.refs, change.ref] });
    }
  }
  return [...recipients.values()];
}

function describeRef(ref: string): string {
  if (/^\d+$/.test(ref)) return `revision ${ref}`;
  const log = /^(?:mw)?log:(.+)$/.exec(ref);
  return log?.[1] ? `log entry ${log[1]}` : `change ${ref}`;
}

function authorName(author: ChangeAuthor): string {
  const name = clean(author.label) ?? clean(author.classicName) ?? clean(author.ip);
  const text = (name ?? "an unknown author").replace(/\s+/g, " ").replaceAll("—", "-");
  return text.length > SUMMARY_NAME_MAX ? `${text.slice(0, SUMMARY_NAME_MAX - 3)}...` : text;
}

/** "a, b and c", or "a, b, c and 2 more" past the cap. */
function joinNamed(items: readonly string[]): string {
  const shown = items.slice(0, SUMMARY_NAMED_MAX);
  const rest = items.length - shown.length;
  const all = rest > 0 ? [...shown, `${rest} more`] : shown;
  if (all.length < 2) return all.join("");
  return `${all.slice(0, -1).join(", ")} and ${all[all.length - 1]}`;
}

function distinct(items: readonly string[]): string[] {
  return [...new Set(items)];
}

/** One sentence for the page's trail, e.g. "Overwrote revision 1234 by Foo, saved from the same version (conflict ab12cd)". */
export function trailSummary(verdict: CollisionVerdict, conflictId: string): string {
  const tail = `saved from the same version (conflict ${conflictId})`;
  if (verdict.overwritten.length === 0) return `Overwrote nothing, ${tail}`.slice(0, TRAIL_SUMMARY_MAX);
  const refs = distinct(verdict.overwritten.map((change) => describeRef(change.ref)));
  const names = distinct(verdict.overwritten.map((change) => authorName(change.author)));
  const text = `Overwrote ${joinNamed(refs)} by ${joinNamed(names)}, ${tail}`;
  return text.length > TRAIL_SUMMARY_MAX ? `${text.slice(0, TRAIL_SUMMARY_MAX - 3)}...` : text;
}

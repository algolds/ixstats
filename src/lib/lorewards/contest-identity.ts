/**
 * One contest can be stored twice: the state file keys a weekly `2026-W34` and a monthly `2026-07` (with their
 * ranges), while the OOL page keys the same contest by its first day. A contest's identity is its type and first
 * day (a daily's date), and its places pay, mint, grant and count once per identity: through the state-keyed
 * entry, and not at all while its entries name different holders for a place.
 */
import type { LorewardPlace } from "~/lib/vault/vault-bonus";

export interface ContestEntry {
  id: string;
  type: string;
  date: string;
  dateStart: string | null;
  winnerUser: string | null;
  runnerUpUser: string | null;
}

/** The entries of one contest, in id order: never empty. */
export type Contest<T> = [T, ...T[]];

/** A contest's identity: a weekly's or monthly's type and first day, a daily's type and date. */
export function contestIdentity(entry: Pick<ContestEntry, "type" | "date" | "dateStart">): string {
  const day = entry.type === "daily" ? entry.date : (entry.dateStart ?? entry.date);
  return `${entry.type}:${day}`;
}

/** The key of one place of one contest (`<type>:<first day>:<place>`): its advisory lock, and its log name. */
export const contestPlaceKey = (
  entry: Pick<ContestEntry, "type" | "date" | "dateStart">,
  place: LorewardPlace
): string => `${contestIdentity(entry)}:${place}`;

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const holderOf = (entry: ContestEntry, place: LorewardPlace) =>
  place === "winner" ? entry.winnerUser : entry.runnerUpUser;

/** The entries of each contest, each in id order; the contests in the order they first appear. */
export function groupByContest<T extends ContestEntry>(entries: readonly T[]): Array<Contest<T>> {
  const contests = new Map<string, Contest<T>>();
  for (const entry of entries) {
    const key = contestIdentity(entry);
    const contest = contests.get(key);
    if (contest) contest.push(entry);
    else contests.set(key, [entry]);
  }
  for (const contest of contests.values()) contest.sort(byId);
  return [...contests.values()];
}

/** The entry a place of a contest acts through, or the two entries that name different holders for it. */
export type ContestHolder<T> = { entry: T } | { conflict: [T, T] };

/**
 * The entry a place of a contest (as `groupByContest` gives it) acts through: when every entry names the same holder,
 * its state-keyed entry (the one with a recorded range), else the earliest by id; when two disagree, neither.
 */
export function contestHolder<T extends ContestEntry>(
  contest: Contest<T>,
  place: LorewardPlace
): ContestHolder<T> {
  const [first] = contest;
  const other = contest.find((entry) => holderOf(entry, place) !== holderOf(first, place));
  if (other) return { conflict: [first, other] };
  return { entry: contest.find((entry) => entry.dateStart !== null) ?? first };
}

/** One line naming both entries of a disagreement, for the log. */
export function describeConflict(
  [a, b]: [ContestEntry, ContestEntry],
  place: LorewardPlace
): string {
  return `${contestIdentity(a)} ${place}: ${a.id} (${a.date}) names ${holderOf(a, place)}, ${b.id} (${b.date}) names ${holderOf(b, place)}`;
}

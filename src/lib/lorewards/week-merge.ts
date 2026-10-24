/**
 * The weekly merge (design decision 18): every weekly row moves to its ISO week key (`contest-week.ts`), and a
 * contest stored twice (the state file's ISO row and the OOL page's date-keyed row) becomes one row. Nothing a payout
 * or a trophy card points at is lost: the paid row survives, the losers' cards move to it, and a week whose rows
 * disagree, or that was paid or carded under two rows, is left as it is for an admin override. Pure: the script
 * (`scripts/lorewards/merge-weekly-keys.ts`) reads the rows and applies the plan.
 */
import { isoWeekStart, weeklyKeyOfFirstDay, type WeeklyKey } from "./contest-week";

export interface WeeklyRow {
  id: string;
  date: string;
  dateStart: string | null;
  dateEnd: string | null;
  winnerUser: string | null;
  winnerPage: string | null;
  winnerScore: number | null;
  winnerBytes: number | null;
  runnerUpUser: string | null;
  runnerUpPage: string | null;
  runnerUpScore: number | null;
  runnerUpBytes: number | null;
  editCount: number;
  metadata: string | null;
}

export interface WeeklyRefs {
  /** Entry ids a Loreward bonus was paid under (either place's `lorewardBonusKey`). */
  paid: ReadonlySet<string>;
  /** Entry id → the editions of the trophy cards minted on it. */
  cards: ReadonlyMap<string, readonly string[]>;
}

export type WeeklySkipReason =
  "no first day" | "different first days" | "different holders" | "paid twice" | "carded twice";

export type WeeklyFill = Partial<Omit<WeeklyRow, "id" | "date" | "dateStart" | "dateEnd">>;

/** One contest's rows made one: the survivor takes the key and range, the losers' cards and any column it lacks. */
export interface WeeklyMerge {
  key: WeeklyKey;
  survivorId: string;
  loserIds: string[];
  fill: WeeklyFill;
}

export interface WeeklyPlan {
  merges: WeeklyMerge[];
  skipped: Array<{ key: string; ids: string[]; reason: WeeklySkipReason }>;
  unchanged: number;
}

/** The nullable columns a survivor takes from a loser when it holds none. */
const FILLED = [
  "winnerUser",
  "winnerPage",
  "winnerScore",
  "winnerBytes",
  "runnerUpUser",
  "runnerUpPage",
  "runnerUpScore",
  "runnerUpBytes",
  "metadata",
] as const satisfies ReadonlyArray<keyof WeeklyFill>;

const byId = (a: WeeklyRow, b: WeeklyRow) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byKey = (a: { key: string }, b: { key: string }) =>
  a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

/** A row's first day: its range start, else its date when that is a day, else the Monday of its ISO key. */
function firstDayOf(row: WeeklyRow): string | null {
  if (row.dateStart) return row.dateStart;
  return weeklyKeyOfFirstDay(row.date) ? row.date : isoWeekStart(row.date);
}

/** At most one recorded holder per place: a null is an unrecorded place, not a disagreement. */
function holdersAgree(rows: readonly WeeklyRow[]): boolean {
  const distinct = (holders: Array<string | null>) => new Set(holders.filter(Boolean)).size <= 1;
  return distinct(rows.map((r) => r.winnerUser)) && distinct(rows.map((r) => r.runnerUpUser));
}

/** Why a contest's rows cannot be one, or null when they can. */
function refusal(rows: readonly WeeklyRow[], refs: WeeklyRefs): WeeklySkipReason | null {
  if (!holdersAgree(rows)) return "different holders";
  if (rows.filter((r) => refs.paid.has(r.id)).length > 1) return "paid twice";
  const editions = rows.flatMap((r) => refs.cards.get(r.id) ?? []);
  return new Set(editions).size < editions.length ? "carded twice" : null;
}

/** The paid row, else a row with cards, else the row already under the ISO key, else the lowest id. */
function survivorOf(rows: readonly WeeklyRow[], key: WeeklyKey, refs: WeeklyRefs): WeeklyRow {
  const sorted = [...rows].sort(byId);
  return (
    sorted.find((r) => refs.paid.has(r.id)) ??
    sorted.find((r) => (refs.cards.get(r.id)?.length ?? 0) > 0) ??
    sorted.find((r) => r.date === key.date) ??
    sorted[0]!
  );
}

/** Each column the survivor holds as null, from the first loser (by id) holding it; a larger edit count. */
function fillOf(survivor: WeeklyRow, losers: readonly WeeklyRow[]): WeeklyFill {
  const fill: WeeklyFill = {};
  for (const column of FILLED) {
    if (survivor[column] !== null) continue;
    const value = losers.find((loser) => loser[column] !== null)?.[column];
    if (value !== undefined) Object.assign(fill, { [column]: value });
  }
  const most = Math.max(survivor.editCount, ...losers.map((loser) => loser.editCount));
  if (most > survivor.editCount) fill.editCount = most;
  return fill;
}

const isCanonical = (row: WeeklyRow, key: WeeklyKey) =>
  row.date === key.date && row.dateStart === key.dateStart && row.dateEnd === key.dateEnd;

/** The rows of each ISO week, by key; the rows with no first day apart. */
function groupByWeek(rows: readonly WeeklyRow[]) {
  const weeks = new Map<string, Array<{ row: WeeklyRow; key: WeeklyKey }>>();
  const orphans: WeeklyRow[] = [];
  for (const row of rows) {
    const firstDay = firstDayOf(row);
    const key = firstDay === null ? null : weeklyKeyOfFirstDay(firstDay);
    if (!key) orphans.push(row);
    else weeks.set(key.date, [...(weeks.get(key.date) ?? []), { row, key }]);
  }
  return { weeks, orphans };
}

/** Folds the weekly rows into one row per ISO week (rules in the plan, Task 2). */
export function planWeeklyMerge(rows: readonly WeeklyRow[], refs: WeeklyRefs): WeeklyPlan {
  const plan: WeeklyPlan = { merges: [], skipped: [], unchanged: 0 };
  const { weeks, orphans } = groupByWeek(rows);
  for (const row of orphans)
    plan.skipped.push({ key: row.date, ids: [row.id], reason: "no first day" });
  for (const [week, members] of weeks) {
    const group = members.map((m) => m.row).sort(byId);
    const ids = group.map((r) => r.id);
    const key = members[0]!.key;
    const reason = members.some((m) => m.key.dateStart !== key.dateStart)
      ? "different first days"
      : refusal(group, refs);
    if (reason) {
      plan.skipped.push({ key: week, ids, reason });
      continue;
    }
    if (group.length === 1 && isCanonical(group[0]!, key)) {
      plan.unchanged += 1;
      continue;
    }
    const survivor = survivorOf(group, key, refs);
    const losers = group.filter((r) => r !== survivor);
    plan.merges.push({
      key,
      survivorId: survivor.id,
      loserIds: losers.map((r) => r.id),
      fill: fillOf(survivor, losers),
    });
  }
  plan.merges.sort((a, b) => byKey({ key: a.key.date }, { key: b.key.date }));
  plan.skipped.sort(byKey);
  return plan;
}

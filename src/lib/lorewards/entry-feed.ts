/**
 * Loreward entries newest contest first, across the two keys they are stored under: a daily (and a weekly or monthly
 * stored by its first day) by `YYYY-MM-DD`, a weekly by its ISO key `YYYY-Www`.
 */
import type { LorewardEntry, Prisma, PrismaClient } from "@prisma/client";
import { contestDay } from "./contest-identity";
import { ISO_WEEK_KEY, isoWeekStart } from "./contest-week";

export interface FeedPage {
  take: number;
  skip?: number;
}

export type FeedEntry = Pick<LorewardEntry, "id" | "type" | "date" | "dateStart">;

/** The day an entry sorts by: its contest's first day, an ISO-keyed weekly with no dateStart by its Monday. */
function feedDay(entry: FeedEntry): string {
  if (entry.type === "weekly" && entry.dateStart === null && ISO_WEEK_KEY.test(entry.date)) {
    return isoWeekStart(entry.date) ?? entry.date;
  }
  return contestDay(entry);
}

const descending = (a: string, b: string): number => (a < b ? 1 : a > b ? -1 : 0);

/** Newer contest first: by `contestDay` (an ISO-keyed weekly with no dateStart by `isoWeekStart`), then by id. */
export function byContestDayDesc(a: FeedEntry, b: FeedEntry): number {
  return descending(feedDay(a), feedDay(b)) || descending(a.id, b.id);
}

/**
 * Entries `where` selects, newest contest first, `page` of them. Two reads (weeklies, then every other type), each
 * `orderBy: { date: "desc" }` and `take: skip + take`, merged by `byContestDayDesc` and sliced: a `YYYY-Www` key sorts
 * after every `YYYY-MM-DD` of its year as a string, so one `orderBy` over both would put weeks first.
 */
export async function findEntriesNewestFirst(
  db: Pick<PrismaClient, "lorewardEntry">,
  where: Prisma.LorewardEntryWhereInput,
  page: FeedPage
): Promise<LorewardEntry[]> {
  const skip = page.skip ?? 0;
  const read = (type: Prisma.LorewardEntryWhereInput["type"]) =>
    db.lorewardEntry.findMany({
      where: { AND: [where, { type }] },
      orderBy: { date: "desc" },
      take: skip + page.take,
    });
  const weeklies = await read("weekly");
  const others = await read({ not: "weekly" });
  return [...weeklies, ...others].sort(byContestDayDesc).slice(skip, skip + page.take);
}

/**
 * Year labels on a nation's realm calendar. Budget years and election names are stored as game years on the shared
 * timeline (`currentBudgetYear`, "General Election (Year 2041)"); these show them as the year the nation's own
 * calendar reads ("812 AE"), leaving the stored values as they are. Ixnay's calendar maps a year to itself.
 * Client-safe.
 */
import { currentBudgetYear } from "~/lib/government/budget-year";
import { realmYear } from "~/lib/realms/nation-time";
import type { RealmCalendar } from "~/lib/realms/realm-calendar";

/** Gregorian with no offset (Ixnay's calendar): its years are the game years. */
function isGameCalendar(calendar: RealmCalendar): boolean {
  return calendar.calendarOffsetMs === 0 && !calendar.months?.length;
}

/** "812 AE", or "2041" for a calendar without an era. */
export function formatRealmYear(year: number, calendar: RealmCalendar): string {
  return calendar.era ? `${year} ${calendar.era}` : String(year);
}

/**
 * The realm calendar year a stored game year (a budget year) is shown as: the current budget year reads as the
 * calendar year today, and others count from it one year per budget year (so consecutive budget years read as
 * consecutive calendar years, whatever the calendar's year length).
 */
export function realmYearOfGameYear(
  gameYear: number,
  clock: { now(): number; calendar: RealmCalendar }
): number {
  if (isGameCalendar(clock.calendar)) return gameYear;
  const now = clock.now();
  return realmYear(now, clock.calendar) + (gameYear - currentBudgetYear(now));
}

/** A stored budget year as the nation's calendar labels it ("812 AE", "2041"). */
export function formatBudgetYear(
  gameYear: number,
  clock: { now(): number; calendar: RealmCalendar }
): string {
  return formatRealmYear(realmYearOfGameYear(gameYear, clock), clock.calendar);
}

/** "(Year 2041)" in a stored election name. */
const STORED_ELECTION_YEAR = /\(Year -?\d+\)/;

/**
 * An election's name with its stored game year replaced by the year its date falls in on the nation's calendar:
 * "General Election (Year 2041)" held on 3 Frostfall 812 AE reads "General Election (812 AE)".
 */
export function electionDisplayName(
  name: string,
  scheduledIxTime: number | null | undefined,
  calendar: RealmCalendar | null | undefined
): string {
  if (!calendar || scheduledIxTime == null || !Number.isFinite(scheduledIxTime)) return name;
  return name.replace(
    STORED_ELECTION_YEAR,
    `(${formatRealmYear(realmYear(scheduledIxTime, calendar), calendar)})`
  );
}

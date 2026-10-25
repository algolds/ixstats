import { parseRealmDate, type RealmCalendar } from "~/lib/realms/realm-clock";
import type { IntentTemplate } from "./meeting-scheduler-types";

export type TimePreset = "immediately" | "tomorrow" | "custom";

export interface RosterOfficial {
  id: string;
  name: string;
  title: string;
  role?: string | null;
  countryLabel: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NINE_AM_MS = 9 * 60 * 60 * 1000;

/**
 * Meetings are scheduled on the host nation's realm clock: `now` is its time, and a picked day is a day of its
 * calendar, held at 09:00 of that day.
 */

/** 09:00 of the calendar day the clock time `ms` falls on. */
const nineAmOn = (ms: number, calendar: RealmCalendar) =>
  Math.floor((ms + calendar.calendarOffsetMs) / DAY_MS) * DAY_MS +
  NINE_AM_MS -
  calendar.calendarOffsetMs;

export function presetScheduledTime(
  preset: TimePreset,
  now: number,
  calendar: RealmCalendar
): number {
  if (preset === "immediately") return now;
  return preset === "tomorrow" ? now + DAY_MS : nineAmOn(now + DAY_MS, calendar);
}

/** `YYYY-MM-DD` of the (Gregorian) calendar day a clock time falls on, for a date input. */
export const toDateInputValue = (ms: number, calendar: RealmCalendar) =>
  new Date(ms + calendar.calendarOffsetMs).toISOString().slice(0, 10);

/** A picked `YYYY-MM-DD` calendar day, scheduled for 09:00, as clock time. */
export const fromDateInputValue = (value: string, calendar: RealmCalendar) =>
  Date.parse(`${value}T09:00:00Z`) - calendar.calendarOffsetMs;

/** A typed date of a custom calendar ("14 Frostfall 812"), at 09:00, or null when it is no date of it. */
export function fromRealmDateText(text: string, calendar: RealmCalendar): number | null {
  const start = parseRealmDate(text, calendar);
  return start === null ? null : start + NINE_AM_MS;
}

type RoleHolder = Pick<RosterOfficial, "title" | "role">;

export const matchesRoles = (official: RoleHolder, roles: string[]) =>
  roles.some(
    (role) =>
      official.title.toLowerCase().includes(role) || official.role?.toLowerCase().includes(role)
  );

/** Who a template invites by default: everyone for a routine review, otherwise the matching roles. */
export function officialIdsForTemplate(
  template: IntentTemplate,
  officials: (RoleHolder & { id: string })[]
) {
  const invited =
    template.recommendedRoles.length === 0
      ? officials
      : officials.filter((o) => matchesRoles(o, template.recommendedRoles));
  return invited.map((o) => o.id);
}

/** The first reason the form can't be submitted, or null. */
export function validateMeeting(form: {
  title: string;
  bilateralWithoutGuest: boolean;
  agendaCount: number;
  needsAttendees: boolean;
  signedIn: boolean;
}): string | null {
  if (!form.title.trim()) return "Meeting title is required";
  if (form.bilateralWithoutGuest) return "Please select a target country";
  if (form.agendaCount === 0) return "Please add at least one agenda item";
  if (form.needsAttendees) return "Please select at least one attendee";
  if (!form.signedIn) return "You must be signed in to schedule a meeting";
  return null;
}

/** Host and guest rosters merged into one list, each official labelled with their side. */
export function mergeRosters(
  host: Omit<RosterOfficial, "countryLabel">[] = [],
  guest: Omit<RosterOfficial, "countryLabel">[] = [],
  guestName?: string
): RosterOfficial[] {
  return [
    ...host.map((o) => ({ ...o, countryLabel: "Internal" })),
    ...guest.map((o) => ({ ...o, countryLabel: guestName || "Foreign" })),
  ];
}

import { IxTime } from "~/lib/ixtime";
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

/** 09:00 UTC on the same UTC day as `ms`. */
const nineAmUtc = (ms: number) =>
  Date.parse(`${new Date(ms).toISOString().slice(0, 10)}T09:00:00Z`);

export function presetScheduledTime(preset: TimePreset): number {
  const now = IxTime.getCurrentIxTime();
  if (preset === "immediately") return now;
  return preset === "tomorrow" ? now + DAY_MS : nineAmUtc(now + DAY_MS);
}

/** `YYYY-MM-DD` (UTC) for a date input. */
export const toDateInputValue = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A picked `YYYY-MM-DD` day, scheduled for 09:00 UTC. */
export const fromDateInputValue = (value: string) => Date.parse(`${value}T09:00:00Z`);

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

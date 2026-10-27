"use client";

import { useState } from "react";
import { Input } from "~/components/ui/input";
import { formatRealmDate, parseRealmDate, type RealmCalendar } from "~/lib/realms/realm-clock";

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` of the calendar day a clock time falls on (Gregorian calendars). */
const toGregorianValue = (clockMs: number, calendar: RealmCalendar) =>
  new Date(clockMs + calendar.calendarOffsetMs).toISOString().slice(0, 10);

/** The clock time a picked `YYYY-MM-DD` calendar day starts at. */
const fromGregorianValue = (value: string, calendar: RealmCalendar) =>
  Date.parse(`${value}T00:00:00Z`) - calendar.calendarOffsetMs;

/** The clock time the calendar day of `clockMs` starts at. */
export function realmDayStart(clockMs: number, calendar: RealmCalendar): number {
  const calendarMs = clockMs + calendar.calendarOffsetMs;
  return Math.floor(calendarMs / DAY_MS) * DAY_MS - calendar.calendarOffsetMs;
}

interface RealmDayInputProps {
  id: string;
  calendar: RealmCalendar;
  /** The picked day as clock time (null: none yet). */
  value: number | null;
  /** The start of the picked day, as clock time. */
  onChange: (dayStartClockMs: number) => void;
  /** The earliest day allowed, as clock time. */
  min?: number | null;
  className?: string;
}

/**
 * A day of a realm's calendar (realm time design §1): the browser's date picker for Gregorian months, typed text
 * ("14 Frostfall 812", era optional) for the founder's own months.
 */
export function RealmDayInput({
  id,
  calendar,
  value,
  onChange,
  min,
  className,
}: RealmDayInputProps) {
  const label = (ms: number | null) => (ms === null ? "" : formatRealmDate(ms, calendar));
  const dayOf = (ms: number | null) => (ms === null ? null : realmDayStart(ms, calendar));
  // The typed text and the day it last stood for: a new day from outside replaces the text.
  const [shown, setShown] = useState(() => ({ day: dayOf(value), text: label(value) }));
  if (shown.day !== dayOf(value)) setShown({ day: dayOf(value), text: label(value) });

  if (!calendar.months?.length) {
    return (
      <Input
        id={id}
        type="date"
        value={value === null ? "" : toGregorianValue(value, calendar)}
        min={min == null ? undefined : toGregorianValue(min, calendar)}
        onChange={(e) => e.target.value && onChange(fromGregorianValue(e.target.value, calendar))}
        required
        className={className}
      />
    );
  }
  const earliest = min == null ? null : realmDayStart(min, calendar);
  const accepts = (ms: number | null): ms is number =>
    ms !== null && !(earliest !== null && ms < earliest);
  return (
    <Input
      id={id}
      value={shown.text}
      placeholder={formatRealmDate(value ?? min ?? 0, { ...calendar, era: "" })}
      aria-invalid={shown.text !== "" && !accepts(parseRealmDate(shown.text, calendar))}
      onChange={(e) => {
        const ms = parseRealmDate(e.target.value, calendar);
        setShown({ day: accepts(ms) ? ms : shown.day, text: e.target.value });
        if (accepts(ms)) onChange(ms);
      }}
      required
      className={className}
    />
  );
}

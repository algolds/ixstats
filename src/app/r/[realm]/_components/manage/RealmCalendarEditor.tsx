"use client";

import { useState } from "react";
import { Plus, Trash } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  GREGORIAN_MONTH_NAMES,
  MAX_MONTH_DAYS,
  MAX_MONTH_NAME,
  MAX_REALM_MONTHS,
  realmMonthsError,
  yearDays,
} from "~/lib/realms/realm-calendar";
import {
  formatRealmDate,
  realmClockNow,
  withCalendar,
  type RealmClock,
  type RealmMonth,
} from "~/lib/realms/realm-clock";

/** Months a founder starts from: the Gregorian ones at their usual lengths (no leap day). */
const GREGORIAN_START: RealmMonth[] = GREGORIAN_MONTH_NAMES.map((name, month) => ({
  name,
  days: new Date(Date.UTC(2001, month + 1, 0)).getUTCDate(),
}));

interface MonthDraft {
  name: string;
  days: string;
}

const toDraft = (months: RealmMonth[]): MonthDraft[] =>
  months.map((m) => ({ name: m.name, days: String(m.days) }));
const fromDraft = (drafts: MonthDraft[]): RealmMonth[] =>
  drafts.map((d) => ({ name: d.name.trim(), days: Number(d.days) }));

function MonthRow({
  month,
  index,
  onChange,
  onRemove,
  removable,
}: {
  month: MonthDraft;
  index: number;
  onChange: (month: MonthDraft) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  return (
    <li className="flex items-center gap-2">
      <Input
        aria-label={`Month ${index + 1} name`}
        value={month.name}
        maxLength={MAX_MONTH_NAME}
        onChange={(e) => onChange({ ...month, name: e.target.value })}
        className="w-48"
      />
      <Input
        aria-label={`Month ${index + 1} days`}
        type="number"
        min={1}
        max={MAX_MONTH_DAYS}
        value={month.days}
        onChange={(e) => onChange({ ...month, days: e.target.value })}
        className="w-24"
      />
      <span className="text-label-secondary text-footnote">days</span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={`Remove month ${index + 1}`}
        disabled={!removable}
        onClick={onRemove}
      >
        <Trash className="size-4" aria-hidden="true" />
      </Button>
    </li>
  );
}

/** The months being edited, with their checks and the date today would read once saved. */
function CalendarPreview({ clock, months }: { clock: RealmClock; months: RealmMonth[] | null }) {
  const error = months ? realmMonthsError(months) : null;
  if (error) return <p className="text-destructive text-footnote">{error}</p>;
  const now = Date.now();
  const next = withCalendar(clock, months, now);
  const length = months ? `A year has ${yearDays(months)} days.` : "A Gregorian year.";
  return (
    <p className="text-label text-footnote">
      Today reads {formatRealmDate(realmClockNow(next, now), next)}. {length}
    </p>
  );
}

/**
 * Manage → Time → Calendar: Gregorian, or the founder's month names and lengths (1 to 24 months of 1 to 100 days).
 * Saving keeps today's year, and its month and day where the new calendar has them.
 */
export function RealmCalendarEditor({ slug, clock }: { slug: string; clock: RealmClock }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [drafts, setDrafts] = useState<MonthDraft[] | null>(
    clock.months ? toDraft(clock.months) : null
  );
  const save = api.realms.region.updateClock.useMutation({
    onSuccess: () => {
      notify.success("Calendar saved");
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not save the calendar", error.message),
  });
  const months = drafts ? fromDraft(drafts) : null;
  const unchanged = JSON.stringify(months) === JSON.stringify(clock.months ?? null);
  const invalid = months !== null && realmMonthsError(months) !== null;
  const update = (index: number, month: MonthDraft) =>
    setDrafts((all) => all && all.map((m, i) => (i === index ? month : m)));

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-label text-subhead font-medium">Calendar</h3>
      <p className="text-label-secondary text-footnote">
        Gregorian, or months of your own. A year is as long as its months together.
      </p>
      {drafts ? (
        <ol className="flex flex-col gap-2" aria-label="Months">
          {drafts.map((month, index) => (
            <MonthRow
              key={index}
              month={month}
              index={index}
              onChange={(next) => update(index, next)}
              onRemove={() => setDrafts(drafts.filter((_, i) => i !== index))}
              removable={drafts.length > 1}
            />
          ))}
        </ol>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {drafts ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={drafts.length >= MAX_REALM_MONTHS}
              onClick={() => setDrafts([...drafts, { name: "", days: "30" }])}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add a month
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setDrafts(null)}>
              Use Gregorian
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDrafts(toDraft(GREGORIAN_START))}
          >
            Use months of your own
          </Button>
        )}
      </div>
      {!unchanged && <CalendarPreview clock={clock} months={months} />}
      <div>
        <Button
          disabled={unchanged || invalid || save.isPending}
          onClick={() => save.mutate({ slug, months })}
        >
          Save calendar
        </Button>
      </div>
    </div>
  );
}

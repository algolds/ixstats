"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { calendarParts, DAY_MS, realmMonthNames } from "~/lib/realms/realm-calendar";
import {
  daysUntil,
  formatRealmDate,
  maxJumpDays,
  MAX_JUMP_YEARS,
  type RealmClockReader,
  type RealmDateParts,
} from "~/lib/realms/realm-clock";

/** The viewer's own calendar day ("21 October 2026"). */
const day = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

interface TargetDraft {
  day: string;
  month: number;
  year: string;
}

/** The jump to the target date: its length in days and the date it lands on, or why it can't be made. */
function planJump(reader: RealmClockReader, target: TargetDraft) {
  const calendarMs = reader.now() + reader.calendar.calendarOffsetMs;
  const parts: RealmDateParts = {
    year: Number(target.year),
    month: target.month,
    day: Number(target.day),
  };
  const days = daysUntil(calendarMs, parts, reader.calendar.months);
  if (days === null) return { error: "That date is not in the realm's calendar" } as const;
  if (days < 1) return { error: "Pick a date after today" } as const;
  const max = maxJumpDays(calendarMs, reader.calendar.months);
  if (days > max) return { error: `A jump moves at most ${MAX_JUMP_YEARS} years ahead` } as const;
  return { days, to: formatRealmDate(reader.now() + days * DAY_MS, reader.calendar) } as const;
}

function TargetFields({
  value,
  onChange,
  monthNames,
}: {
  value: TargetDraft;
  onChange: (value: TargetDraft) => void;
  monthNames: string[];
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="realm-jump-day">Day</Label>
        <Input
          id="realm-jump-day"
          type="number"
          min={1}
          value={value.day}
          onChange={(e) => onChange({ ...value, day: e.target.value })}
          className="w-20"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="realm-jump-month">Month</Label>
        <Select
          value={String(value.month)}
          onValueChange={(month) => onChange({ ...value, month: Number(month) })}
        >
          <SelectTrigger id="realm-jump-month" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthNames.map((name, index) => (
              <SelectItem key={name} value={String(index)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="realm-jump-year">Year</Label>
        <Input
          id="realm-jump-year"
          type="number"
          value={value.year}
          onChange={(e) => onChange({ ...value, year: e.target.value })}
          className="w-28"
        />
      </div>
    </div>
  );
}

/**
 * Manage → Time → Jump ahead: move the realm's date forward to a date in its calendar. Time really passes for its
 * nations. At most 5 of its years; the founder once a week (site staff any time), previewed and confirmed first.
 */
export function RealmJumpControl({
  slug,
  reader,
  nextJumpAt,
  skipsCooldown,
}: {
  slug: string;
  reader: RealmClockReader;
  /** When the founder may jump again (real ms; 0: now). */
  nextJumpAt: number;
  skipsCooldown: boolean;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const today = calendarParts(
    reader.now() + reader.calendar.calendarOffsetMs,
    reader.calendar.months
  );
  const [target, setTarget] = useState<TargetDraft>({
    day: String(today.day),
    month: today.month,
    year: String(today.year + 1),
  });
  const [confirming, setConfirming] = useState(false);
  const jump = api.realms.region.jumpClock.useMutation({
    onSuccess: () => {
      notify.success("The date moved ahead");
      setConfirming(false);
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not move the date", error.message),
  });
  const locked = !skipsCooldown && Date.now() < nextJumpAt;
  const plan = planJump(reader, target);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-label text-subhead font-medium">Jump ahead</h3>
      <p className="text-label-secondary text-footnote">
        Move the date forward. Time really passes: economies grow, budget years roll over, and
        elections and deadlines come due. At most {MAX_JUMP_YEARS} years at a time
        {skipsCooldown ? "." : ", once a week."} The date never goes back.
      </p>
      {locked ? (
        <p className="text-label-secondary text-footnote">
          The date can jump again on {day(nextJumpAt)}.
        </p>
      ) : (
        <>
          <TargetFields
            value={target}
            onChange={(next) => {
              setTarget(next);
              setConfirming(false);
            }}
            monthNames={realmMonthNames(reader.calendar.months)}
          />
          {"error" in plan ? (
            <p className="text-destructive text-footnote">{plan.error}</p>
          ) : (
            <p className="text-label text-footnote">
              Moves from {formatRealmDate(reader.now(), reader.calendar)} to {plan.to},{" "}
              {plan.days.toLocaleString()} days ahead.
            </p>
          )}
          {confirming && !("error" in plan) ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-label text-footnote">
                Jump to {plan.to}? This can&apos;t be undone.
              </p>
              <Button
                disabled={jump.isPending}
                onClick={() => jump.mutate({ slug, days: plan.days })}
              >
                Jump the date
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div>
              <Button
                variant="outline"
                disabled={"error" in plan}
                onClick={() => setConfirming(true)}
              >
                Review the jump
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

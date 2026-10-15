"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { IxTime } from "~/lib/ixtime";
import {
  createRealmClock,
  formatRealmDate,
  formatRealmSpeed,
  MAX_REALM_ERA,
  MAX_REALM_SPEED,
  nextSpeedChangeAt,
  type RealmClock,
} from "~/lib/realms/realm-clock";
import type { InWorldDate } from "~/lib/realms/realm-community";
import { ManageSection } from "./ManageSection";

interface RealmTime {
  clock: RealmClock | null;
  legacy: InWorldDate | null;
  isIxnay: boolean;
  skipsCooldown: boolean;
}

/** The viewer's own calendar day ("21 October 2026"). */
const day = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/** Today with the old yearly in-world offset applied (years 1 to 9999), the start date's default. */
function defaultStartDate(legacy: InWorldDate | null): string {
  const today = new Date();
  const offset = legacy?.mode === "offset" ? legacy.offset : 0;
  const year = Math.min(9999, Math.max(1, today.getUTCFullYear() + offset));
  return `${String(year).padStart(4, "0")}${today.toISOString().slice(4, 10)}`;
}

const parseSpeed = (text: string) => {
  const value = Number(text);
  return text.trim() !== "" && value >= 0 && value <= MAX_REALM_SPEED ? value : null;
};

function SpeedField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="realm-speed">Speed</Label>
      <Input
        id="realm-speed"
        type="number"
        min={0}
        max={MAX_REALM_SPEED}
        step={0.25}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={parseSpeed(value) === null}
        className="w-32"
      />
      <p className="text-label-secondary text-footnote">
        In-game days per real day, 0 to {MAX_REALM_SPEED}. 0 pauses the realm&apos;s date. Ixnay
        runs at ×2.
      </p>
    </div>
  );
}

function EraField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="realm-era">Era</Label>
      <Input
        id="realm-era"
        value={value}
        maxLength={MAX_REALM_ERA}
        onChange={(e) => onChange(e.target.value)}
        placeholder="AE"
        className="w-40"
      />
    </div>
  );
}

function StartClock({ slug, legacy }: { slug: string; legacy: InWorldDate | null }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [startDate, setStartDate] = useState(() => defaultStartDate(legacy));
  const [era, setEra] = useState(legacy?.mode === "offset" ? (legacy.era ?? "") : "");
  const [speed, setSpeed] = useState("2");
  const start = api.realms.region.startClock.useMutation({
    onSuccess: () => {
      notify.success("The realm's clock is running");
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not start the clock", error.message),
  });
  const multiplier = parseSpeed(speed);
  let preview: string | null = null;
  try {
    preview = formatRealmDate(
      createRealmClock({
        globalNowMs: IxTime.getCurrentIxTime(),
        realNowMs: Date.now(),
        startDate,
        era,
        multiplier: multiplier ?? 0,
      }),
      Date.now()
    );
  } catch {
    preview = null;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-label-secondary text-footnote">
        The realm runs on global IxTime until you start its own clock. Its date and speed then show
        in the realm header, and its nations will follow it once the simulation moves onto realm
        clocks. The start date can&apos;t change later; the speed and era can.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="realm-start-date">Start date</Label>
        <Input
          id="realm-start-date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          aria-invalid={preview === null}
          className="w-48"
        />
      </div>
      <EraField value={era} onChange={setEra} />
      <SpeedField value={speed} onChange={setSpeed} />
      {preview && multiplier !== null && (
        <p className="text-label text-footnote">
          Starts at {preview}, {formatRealmSpeed(multiplier)}.
        </p>
      )}
      <div>
        <Button
          disabled={preview === null || multiplier === null || start.isPending}
          onClick={() =>
            multiplier !== null && start.mutate({ slug, startDate, era: era.trim(), multiplier })
          }
        >
          Start the clock
        </Button>
      </div>
    </div>
  );
}

function RunningClock({
  slug,
  clock,
  skipsCooldown,
}: {
  slug: string;
  clock: RealmClock;
  skipsCooldown: boolean;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [era, setEra] = useState(clock.era);
  const [speed, setSpeed] = useState(String(clock.multiplier));
  const update = api.realms.region.updateClock.useMutation({
    onSuccess: () => {
      notify.success("Time saved");
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not save the time", error.message),
  });
  const next = nextSpeedChangeAt(clock);
  const locked = !skipsCooldown && Date.now() < next;
  const multiplier = parseSpeed(speed);
  const speedChanged = multiplier !== null && multiplier !== clock.multiplier;
  const eraChanged = era.trim() !== clock.era;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-label text-body">
        {formatRealmDate(clock, Date.now())}, {formatRealmSpeed(clock.multiplier)}
      </p>
      <EraField value={era} onChange={setEra} />
      <SpeedField value={speed} onChange={setSpeed} disabled={locked} />
      {locked && (
        <p className="text-label-secondary text-footnote">
          The speed can change again on {day(next)}.
        </p>
      )}
      {speedChanged && (
        <p className="text-label text-footnote">
          {multiplier === 0
            ? "Pauses once saved."
            : `Runs at ${formatRealmSpeed(multiplier)} once saved.`}
        </p>
      )}
      <div>
        <Button
          disabled={(!speedChanged && !eraChanged) || multiplier === null || update.isPending}
          onClick={() =>
            update.mutate({
              slug,
              ...(speedChanged && multiplier !== null && { multiplier }),
              ...(eraChanged && { era: era.trim() }),
            })
          }
        >
          Save time
        </Button>
      </div>
    </div>
  );
}

/** Manage → Time: the realm's own clock (founder and site staff). Ixnay runs on global IxTime. */
export function RealmTimeSection({ slug, time }: { slug: string; time: RealmTime }) {
  return (
    <ManageSection
      id="time"
      title="Time"
      description="The realm's own date and speed, shown in its header. Other realms keep their own."
    >
      {time.isIxnay ? (
        <p className="text-label-secondary text-footnote">
          Ixnay runs on global IxTime, which site staff set in Admin.
        </p>
      ) : time.clock ? (
        <RunningClock
          // A clock changed elsewhere (staff, another tab) starts the form over from it.
          key={`${time.clock.changedAt}:${time.clock.era}`}
          slug={slug}
          clock={time.clock}
          skipsCooldown={time.skipsCooldown}
        />
      ) : (
        <StartClock slug={slug} legacy={time.legacy} />
      )}
    </ManageSection>
  );
}

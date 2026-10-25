"use client";

import { useId } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  DEFAULT_REALM_SPEED,
  MAX_REALM_ERA,
  MAX_REALM_SPEED,
  parseRealmSpeed,
  RealmFoundingClockSchema,
  RealmStartDateSchema,
  type RealmFoundingClock,
} from "~/lib/realms/realm-clock";

export function SpeedField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Speed</Label>
      <Input
        id={id}
        type="number"
        min={0}
        max={MAX_REALM_SPEED}
        step={0.25}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={parseRealmSpeed(value) === null}
        className="w-32"
      />
      <p className="text-label-secondary text-footnote">
        In-world days per real day, 0 to {MAX_REALM_SPEED}. 0 pauses the realm&apos;s date. Ixnay
        runs at ×2.
      </p>
    </div>
  );
}

export function EraField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Era</Label>
      <Input
        id={id}
        value={value}
        maxLength={MAX_REALM_ERA}
        onChange={(e) => onChange(e.target.value)}
        placeholder="AE"
        className="w-40"
      />
    </div>
  );
}

/** What the founding fields hold while they are edited. */
export interface FoundingClockDraft {
  startDate: string;
  era: string;
  speed: string;
}

/** Today's date (UTC) as the start date, era empty, Ixnay's speed. */
export function emptyFoundingClock(): FoundingClockDraft {
  return {
    startDate: new Date().toISOString().slice(0, 10),
    era: "",
    speed: String(DEFAULT_REALM_SPEED),
  };
}

/** The draft as the founding clock the server takes, or null while it is not one. */
export function foundingClockInput(draft: FoundingClockDraft): RealmFoundingClock | null {
  const multiplier = parseRealmSpeed(draft.speed);
  if (multiplier === null) return null;
  const parsed = RealmFoundingClockSchema.safeParse({ ...draft, multiplier });
  return parsed.success ? parsed.data : null;
}

/** A new realm's clock: the in-world date it starts at, its era and its speed. */
export function FoundingClockFields({
  value,
  onChange,
}: {
  value: FoundingClockDraft;
  onChange: (value: FoundingClockDraft) => void;
}) {
  const id = useId();
  const dateValid = RealmStartDateSchema.safeParse(value.startDate).success;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>Start date</Label>
        <Input
          id={id}
          type="date"
          value={value.startDate}
          onChange={(e) => onChange({ ...value, startDate: e.target.value })}
          aria-invalid={!dateValid}
          className="w-48"
        />
        <p className="text-label-secondary text-footnote">
          The in-world date the realm starts at. The founder can rename its months later.
        </p>
      </div>
      <EraField value={value.era} onChange={(era) => onChange({ ...value, era })} />
      <SpeedField value={value.speed} onChange={(speed) => onChange({ ...value, speed })} />
    </div>
  );
}

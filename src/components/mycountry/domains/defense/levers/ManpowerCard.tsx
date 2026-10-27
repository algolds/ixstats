"use client";

import React, { useMemo, useState } from "react";
import { Group } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { Slider } from "~/components/ui/slider";
import { MAX_RESERVE_YEARS, SERVICE_MONTHS_MAX, SERVICE_MONTHS_MIN } from "~/lib/military/model";
import {
  MANPOWER_VOLUNTEER_SHARE,
  fundingPreview,
  manpowerModelOf,
  type ManpowerModel,
} from "~/lib/military/defense-console";
import type { OwnerDefense } from "~/hooks/useDefenseConsole";
import { MANPOWER_COPY } from "../defense-copy";
import { FundingPreview } from "./FundingPreview";

interface ManpowerDraft {
  volunteerShare: number;
  serviceMonths: number;
  reserveYears: number;
}

interface ManpowerCardProps {
  overview: OwnerDefense;
  canEdit: boolean;
  pending: boolean;
  onSave: (draft: ManpowerDraft) => void;
}

const MODELS = Object.keys(MANPOWER_COPY) as ManpowerModel[];
const clampInt = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

/** Who serves and for how long: the volunteer share, conscript service and the reserve obligation. */
export function ManpowerCard({ overview, canEdit, pending, onSave }: ManpowerCardProps) {
  const { policy } = overview;
  const saved: ManpowerDraft = {
    volunteerShare: policy.volunteerShare,
    serviceMonths: policy.serviceMonths,
    reserveYears: policy.reserveYears,
  };
  const [draft, setDraft] = useState<ManpowerDraft>(saved);
  const changed =
    draft.volunteerShare !== saved.volunteerShare ||
    draft.serviceMonths !== saved.serviceMonths ||
    draft.reserveYears !== saved.reserveYears;
  const model = manpowerModelOf(draft.volunteerShare);
  const preview = useMemo(
    () => (changed ? fundingPreview(overview, draft) : overview.funding),
    [changed, draft, overview]
  );

  return (
    <Card content="input">
      <CardHeader className="p-5 pb-3">
        <CardTitle icon={<Group />}>Manpower</CardTitle>
        <CardDescription>{MANPOWER_COPY[model].detail}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-5">
        {canEdit ? (
          <RadioCardGroup
            aria-label="Manpower model"
            columns={3}
            value={model}
            onValueChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                volunteerShare: MANPOWER_VOLUNTEER_SHARE[value as ManpowerModel],
              }))
            }
          >
            {MODELS.map((key) => (
              <RadioCard key={key} value={key} title={MANPOWER_COPY[key].label} />
            ))}
          </RadioCardGroup>
        ) : (
          <ReadOnlyFigure label="Manpower model" value={MANPOWER_COPY[model].label} />
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <ServiceField
            canEdit={canEdit}
            value={draft.serviceMonths}
            conscripts={model !== "volunteer"}
            onChange={(serviceMonths) => setDraft((prev) => ({ ...prev, serviceMonths }))}
          />
          {canEdit ? (
            <div className="space-y-2">
              <Label htmlFor="reserve-years">Years in the reserve after service</Label>
              <Input
                id="reserve-years"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_RESERVE_YEARS}
                value={draft.reserveYears}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    reserveYears: clampInt(Number(e.target.value) || 0, 0, MAX_RESERVE_YEARS),
                  }))
                }
                className="w-24 tabular-nums"
              />
              <p className="text-label-secondary text-footnote">
                Every conscript and half of volunteers join the reserve when they leave. 0 keeps no
                reserve.
              </p>
            </div>
          ) : (
            <ReadOnlyFigure label="Years in the reserve" value={`${draft.reserveYears} years`} />
          )}
        </div>
        <FundingPreview
          title={changed ? "What this model buys" : "What the model buys now"}
          funding={preview}
          current={changed ? overview.funding : null}
          active={overview.branches.reduce((sum, b) => sum + b.active, 0)}
        />
      </CardContent>
      {canEdit ? (
        <CardFooter className="justify-end gap-2 p-5">
          <Button variant="outline" size="sm" disabled={!changed} onClick={() => setDraft(saved)}>
            Reset
          </Button>
          <Button size="sm" disabled={!changed || pending} onClick={() => onSave(draft)}>
            {pending ? "Saving..." : "Save manpower"}
          </Button>
        </CardFooter>
      ) : (
        <div className="pb-5" />
      )}
    </Card>
  );
}

function ReadOnlyFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-label-secondary text-callout">{label}</span>
      <span className="text-label text-callout tabular-nums">{value}</span>
    </div>
  );
}

function ServiceField({
  canEdit,
  value,
  conscripts,
  onChange,
}: {
  canEdit: boolean;
  value: number;
  conscripts: boolean;
  onChange: (value: number) => void;
}) {
  if (!canEdit) return <ReadOnlyFigure label="Conscript service" value={`${value} months`} />;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label id="service-months-label">Conscript service</Label>
        <span className="text-callout text-label tabular-nums">{value} months</span>
      </div>
      <Slider
        min={SERVICE_MONTHS_MIN}
        max={SERVICE_MONTHS_MAX}
        step={1}
        value={[value]}
        disabled={!conscripts}
        aria-labelledby="service-months-label"
        onValueChange={([next]) => onChange(next ?? value)}
      />
      <p className="text-label-secondary text-footnote">
        {conscripts
          ? "Longer service keeps more conscripts under arms and trains them further."
          : "Applies once some of the force is conscripted."}
      </p>
    </div>
  );
}

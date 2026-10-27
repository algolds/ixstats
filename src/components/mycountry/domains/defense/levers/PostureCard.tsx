"use client";

import React, { useState } from "react";
import { Compass } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Switch } from "~/components/ui/switch";
import {
  ALERT_LEVELS,
  DAY_MS,
  DOCTRINES,
  O_M_PRIORITIES,
  SURGE_RAMP_MONTHS,
  type AlertLevel,
  type Doctrine,
  type OmPriority,
} from "~/lib/military/model";
import { alertChange, pendingAlert } from "~/lib/military/defense-console";
import type { RealmClockReader } from "~/lib/realms/realm-clock";
import { formatClockDate } from "~/lib/realms/nation-time";
import type { OwnerDefense } from "~/hooks/useDefenseConsole";
import { ALERT_COPY, DOCTRINE_COPY, OM_PRIORITY_COPY } from "../defense-copy";
import { formatWhen } from "../clock-text";

interface PostureCardProps {
  overview: OwnerDefense;
  reader: RealmClockReader | null;
  nowClockMs: number;
  canEdit: boolean;
  pending: boolean;
  onDoctrine: (doctrine: Doctrine) => void;
  onAlert: (level: AlertLevel) => void;
  onOmPriority: (priority: OmPriority) => void;
  onSurge: (surging: boolean) => void;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-subhead text-label font-medium">{label}</div>
      {children}
      {hint && <p className="text-label-secondary text-footnote">{hint}</p>}
    </div>
  );
}

function ReadOnly({ value }: { value: string }) {
  return <p className="text-callout text-label">{value}</p>;
}

/** Posture: doctrine, alert level, which upkeep comes first, and the industrial surge. */
export function PostureCard(props: PostureCardProps) {
  const { overview, canEdit, pending } = props;
  const { policy } = overview;
  return (
    <Card content="input">
      <CardHeader className="p-5 pb-3">
        <CardTitle icon={<Compass />}>Doctrine and posture</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 px-5 pb-5">
        <Field label="Doctrine" hint={DOCTRINE_COPY[policy.doctrine].detail}>
          {canEdit ? (
            <SegmentedControl<Doctrine>
              aria-label="Doctrine"
              size="sm"
              disabled={pending}
              value={policy.doctrine}
              onValueChange={props.onDoctrine}
              options={DOCTRINES.map((d) => ({ value: d, label: DOCTRINE_COPY[d].label }))}
            />
          ) : (
            <ReadOnly value={DOCTRINE_COPY[policy.doctrine].label} />
          )}
        </Field>
        <AlertField {...props} />
        <Field label="Upkeep priority" hint={OM_PRIORITY_COPY[policy.omPriority].detail}>
          {canEdit ? (
            <SegmentedControl<OmPriority>
              aria-label="Upkeep priority"
              size="sm"
              disabled={pending}
              value={policy.omPriority}
              onValueChange={props.onOmPriority}
              options={O_M_PRIORITIES.map((p) => ({ value: p, label: OM_PRIORITY_COPY[p].label }))}
            />
          ) : (
            <ReadOnly value={OM_PRIORITY_COPY[policy.omPriority].label} />
          )}
        </Field>
        <SurgeField {...props} />
      </CardContent>
    </Card>
  );
}

function AlertField({ overview, reader, nowClockMs, canEdit, pending, onAlert }: PostureCardProps) {
  const { policy } = overview;
  const [choice, setChoice] = useState<AlertLevel>(policy.alertLevel);
  const waiting = pendingAlert(policy);
  const change = alertChange(policy.alertInEffect, choice);
  const bitesAt = nowClockMs + change.biteDays * DAY_MS;

  const status = waiting
    ? `${ALERT_COPY[waiting.level].label} ordered. It takes effect on ${formatWhen(waiting.effectiveAtClockMs, nowClockMs, reader)}.`
    : `${ALERT_COPY[policy.alertInEffect].label} is in effect.`;

  if (!canEdit) {
    return (
      <Field label="Alert level" hint={status}>
        <ReadOnly value={ALERT_COPY[policy.alertInEffect].label} />
      </Field>
    );
  }
  return (
    <Field label="Alert level" hint={status}>
      <RadioCardGroup
        aria-label="Alert level"
        columns={2}
        value={choice}
        onValueChange={(value) => setChoice(value as AlertLevel)}
      >
        {ALERT_LEVELS.map((level) => (
          <RadioCard
            key={level}
            value={level}
            title={ALERT_COPY[level].label}
            description={ALERT_COPY[level].detail}
          />
        ))}
      </RadioCardGroup>
      {choice !== policy.alertLevel && (
        <div className="bg-fill-4 rounded-row flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-callout text-label min-w-0 flex-1" data-testid="alert-change">
            {change.raise
              ? `Raising to ${ALERT_COPY[choice].label} takes ${change.biteDays} days to bite, from ${formatWhen(bitesAt, nowClockMs, reader)}.`
              : `Lowering to ${ALERT_COPY[choice].label} takes effect at once.`}
          </p>
          <Button size="sm" disabled={pending} onClick={() => onAlert(choice)}>
            Order {ALERT_COPY[choice].label.toLowerCase()} alert
          </Button>
        </div>
      )}
    </Field>
  );
}

function SurgeField({ overview, reader, canEdit, pending, onSurge }: PostureCardProps) {
  const { policy } = overview;
  const hint = policy.surging
    ? `Surging since ${formatClockDate(policy.surgeStartedClockMs, reader)}. Domestic capacity climbs to double over ${SURGE_RAMP_MONTHS} months; domestic orders cost 30% more meanwhile.`
    : `Doubles domestic production capacity over ${SURGE_RAMP_MONTHS} months. Domestic orders cost 30% more while it runs.`;
  return (
    <Field label="Production surge" hint={hint}>
      {canEdit ? (
        <label className="flex items-center gap-3">
          <Switch
            checked={policy.surging}
            disabled={pending}
            onCheckedChange={onSurge}
            aria-label="Production surge"
          />
          <span className="text-callout text-label">{policy.surging ? "Surging" : "Off"}</span>
        </label>
      ) : (
        <ReadOnly value={policy.surging ? "Surging" : "Off"} />
      )}
    </Field>
  );
}

"use client";

import React from "react";
import { Lock, WarningCircle, WarningTriangle } from "iconoir-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { formatIxCountdown } from "~/lib/statecraft/calendar";
import { TONE_CLASSES } from "~/components/mycountry/directives/directive-model";
import { FollowUpChip } from "./FollowUpChip";

interface DeclarePanelProps {
  goal: string;
  approachLabel: string;
  civCapCost: number | null;
  civCap:
    { capacity: number; used: number; available: number; overCapacity: boolean } | null | undefined;
  slots:
    | { usedThisWeek: number; cap: number; canCommit: boolean; cooldownUntil: number | null }
    | undefined;
  nowIxTime: number;
  followUpOf: { id: string; goal: string } | null;
  onClearFollowUp?: () => void;
  readOnly?: boolean;
  isPending: boolean;
  error: string | null;
  disabled?: boolean;
  onDeclare: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-label-secondary text-body shrink-0">{label}</dt>
      <dd className="text-label text-body min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}

type Slots = NonNullable<DeclarePanelProps["slots"]>;

function SlotsUsed({ slots }: { slots: Slots }) {
  return (
    <span className="tabular-nums">
      {slots.usedThisWeek} of {slots.cap} used
      {slots.cap > slots.usedThisWeek && (
        <span className="text-label-secondary font-normal"> · this uses 1</span>
      )}
    </span>
  );
}

function blockedReasonOf(
  readOnly: boolean | undefined,
  slots: DeclarePanelProps["slots"],
  nowIxTime: number
): string | null {
  if (readOnly) return "You are viewing another nation. Directives are read-only.";
  if (!slots || slots.canCommit) return null;
  return slots.cooldownUntil
    ? `All ${slots.cap} weekly slots are used. Next slot opens in ${formatIxCountdown(slots.cooldownUntil, nowIxTime)} (IxTime).`
    : `All ${slots.cap} weekly slots are used.`;
}

/**
 * Step 4: the confirmation card — what it costs, what is left, and the Declare button (the
 * page's one gold primary action).
 */
export function DeclarePanel({
  goal,
  approachLabel,
  civCapCost,
  civCap,
  slots,
  nowIxTime,
  followUpOf,
  onClearFollowUp,
  readOnly,
  isPending,
  error,
  disabled,
  onDeclare,
}: DeclarePanelProps) {
  const cost = civCapCost ?? 0;
  const hasCivCap = !!civCap && Number.isFinite(civCap.capacity) && civCap.capacity > 0;
  const availableAfter = hasCivCap ? Math.round(civCap.available - cost) : null;
  const goesOver = availableAfter != null && availableAfter < 0;
  const blockedReason = blockedReasonOf(readOnly, slots, nowIxTime);

  return (
    <div className="space-y-4">
      <dl className="divide-separator divide-y">
        <Row label="Goal">
          <span className="line-clamp-3">{goal}</span>
        </Row>
        <Row label="Approach">{approachLabel}</Row>
        <Row label="CivCap">{civCapCost == null ? "—" : `${cost} held for one IxTime week`}</Row>
        <Row label="Available after">
          {civCap === undefined ? (
            <Skeleton className="ml-auto h-4 w-20" />
          ) : availableAfter == null ? (
            "—"
          ) : (
            <span className={cn("tabular-nums", goesOver && TONE_CLASSES.negative.text)}>
              {Math.round(civCap.available)} → {availableAfter}
            </span>
          )}
        </Row>
        <Row label="Weekly slots">
          {slots ? <SlotsUsed slots={slots} /> : <Skeleton className="ml-auto h-4 w-24" />}
        </Row>
      </dl>

      {followUpOf && <FollowUpChip goal={followUpOf.goal} onClear={onClearFollowUp} />}

      {goesOver && !blockedReason && (
        <Alert role="note" className="border-yellow/30 text-yellow">
          <WarningTriangle aria-hidden />
          <AlertDescription className="text-footnote">
            This puts you over civil-service capacity. You can still declare it, but recon and
            policy previews become less reliable until capacity frees up.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="border-destructive/30">
          <WarningCircle aria-hidden />
          <AlertDescription className="text-footnote">{error}</AlertDescription>
        </Alert>
      )}

      <Button
        size="lg"
        onClick={onDeclare}
        disabled={isPending || !!blockedReason || disabled}
        className="w-full px-4 max-sm:h-11"
      >
        {isPending ? "Declaring…" : "Declare Directive"}
      </Button>
      {blockedReason && (
        <p className="text-label-secondary text-footnote flex items-start gap-2">
          <Lock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{blockedReason}</span>
        </p>
      )}
    </div>
  );
}

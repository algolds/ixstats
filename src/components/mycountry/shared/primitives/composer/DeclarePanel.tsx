"use client";

import React from "react";
import { GitFork, Lock, WarningCircle, Xmark } from "iconoir-react";
import { KitButton } from "~/components/mycountry/directives/KitButton";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { formatIxCountdown } from "~/lib/statecraft/calendar";
import { TONE_CLASSES } from "~/components/mycountry/directives/directive-model";

export interface DeclarePanelProps {
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
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground shrink-0 text-sm">{label}</dt>
      <dd className="text-foreground min-w-0 text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

/** Step 4: the confirmation card — what it costs, what is left, and the Declare button. */
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
  const outOfSlots = slots ? !slots.canCommit : false;
  const slotsLeft = slots ? Math.max(0, slots.cap - slots.usedThisWeek) : null;

  let blockedReason: string | null = null;
  if (readOnly) blockedReason = "You are viewing another nation. Directives are read-only.";
  else if (outOfSlots)
    blockedReason = slots?.cooldownUntil
      ? `All ${slots.cap} weekly slots are used. Next slot opens in ${formatIxCountdown(slots.cooldownUntil, nowIxTime)} (IxTime).`
      : `All ${slots?.cap ?? 3} weekly slots are used.`;

  return (
    <div className="space-y-4">
      <dl className="divide-border divide-y">
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
              {Math.round(civCap!.available)} → {availableAfter}
            </span>
          )}
        </Row>
        <Row label="Weekly slots">
          {slots ? (
            <span className="tabular-nums">
              {slots.usedThisWeek} of {slots.cap} used
              {slotsLeft != null && slotsLeft > 0 && (
                <span className="text-muted-foreground font-normal"> · this uses 1</span>
              )}
            </span>
          ) : (
            <Skeleton className="ml-auto h-4 w-24" />
          )}
        </Row>
      </dl>

      {followUpOf && (
        <div className="border-border bg-muted/40 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
          <GitFork className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          <span className="text-muted-foreground min-w-0 flex-1 truncate">
            Follow-up to <span className="text-foreground font-medium">{followUpOf.goal}</span>
          </span>
          {onClearFollowUp && (
            <button
              type="button"
              onClick={onClearFollowUp}
              aria-label="Remove follow-up link"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md p-1 outline-none focus-visible:ring-2"
            >
              <Xmark className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {goesOver && !blockedReason && (
        <p className={cn("rounded-xl border px-3 py-2.5 text-xs", TONE_CLASSES.caution.chip)}>
          This puts you over civil-service capacity. You can still declare it, but recon and policy
          previews become less reliable until capacity frees up.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className={cn(
            "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs",
            TONE_CLASSES.negative.chip
          )}
        >
          <WarningCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      <KitButton
        variant="primary"
        onClick={onDeclare}
        disabled={isPending || !!blockedReason || disabled}
        data-cuelume-press="press"
        className="w-full sm:h-11"
      >
        {isPending ? "Declaring…" : "Declare directive"}
      </KitButton>
      {blockedReason && (
        <p className="text-muted-foreground flex items-start gap-2 text-xs">
          <Lock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{blockedReason}</span>
        </p>
      )}
    </div>
  );
}

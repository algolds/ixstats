"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { formatIxCountdown } from "~/lib/statecraft/calendar";
import { Stat } from "~/components/ui/stat";
import { Card } from "~/components/ui/card";

interface DirectiveStatusStripProps {
  countryId: string;
  nowIxTime: number;
  activeCount: number | null;
  executingCount: number | null;
  onShowActive?: () => void;
}

function Tile({
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  detail: React.ReactNode;
  tone?: "negative";
  onClick?: () => void;
}) {
  const body = (
    <Stat
      label={label}
      value={tone ? <span className="text-destructive">{value}</span> : value}
      hint={detail}
    />
  );
  const cls = "block w-full px-4 py-3 text-left sm:px-5 sm:py-4";
  return onClick ? (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(cls, "h-auto rounded-none whitespace-normal focus-visible:ring-inset")}
    >
      {body}
    </Button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * The three numbers that gate a new directive: weekly slots, CivCap, and what is in force.
 */
export function DirectiveStatusStrip({
  countryId,
  nowIxTime,
  activeCount,
  executingCount,
  onShowActive,
}: DirectiveStatusStripProps) {
  const status = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });
  const civCap = api.policies.getPolicyReconContext.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const slotsLeft = status.data ? Math.max(0, status.data.cap - status.data.usedThisWeek) : null;
  const cc = civCap.data;
  const civCapKnown = !!cc && Number.isFinite(cc.capacity) && cc.capacity > 0;

  return (
    <Card className="divide-separator grid grid-cols-1 divide-y overflow-hidden sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Tile
        label="Weekly slots"
        value={
          status.isLoading ? (
            <Skeleton className="my-1 h-6 w-16" />
          ) : status.data ? (
            `${slotsLeft} of ${status.data.cap}`
          ) : (
            "–"
          )
        }
        detail={
          !status.data
            ? status.error
              ? "Unavailable"
              : " "
            : status.data.canCommit
              ? "Left this IxTime week"
              : status.data.cooldownUntil
                ? `Next slot in ${formatIxCountdown(status.data.cooldownUntil, nowIxTime)}`
                : "All used this week"
        }
      />
      <Tile
        label="CivCap available"
        tone={cc?.overCapacity ? "negative" : undefined}
        value={
          civCap.isLoading ? (
            <Skeleton className="my-1 h-6 w-16" />
          ) : civCapKnown ? (
            Math.round(cc.available)
          ) : (
            "–"
          )
        }
        detail={
          civCapKnown
            ? `${Math.round(cc.used)} of ${Math.round(cc.capacity)} used${
                cc.breakdown ? ` · directives ${Math.round(cc.breakdown.directives)}` : ""
              }${cc.overCapacity ? " · over capacity" : ""}`
            : civCap.isLoading
              ? " "
              : "Capacity unavailable"
        }
      />
      <Tile
        label="In force"
        onClick={onShowActive}
        value={activeCount == null ? <Skeleton className="my-1 h-6 w-10" /> : activeCount}
        detail={
          activeCount == null
            ? " "
            : activeCount === 0
              ? "No directives running"
              : `${executingCount ?? 0} executing this week`
        }
      />
    </Card>
  );
}

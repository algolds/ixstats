"use client";

import React from "react";
import { NavArrowRight } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { cn } from "~/lib/utils";
import { formatIxCountdown } from "~/lib/statecraft/calendar";
import { BandwidthBar, BandwidthHelp, hasBandwidth } from "./BandwidthHelp";

interface DirectiveStatusStripProps {
  countryId: string;
  nowIxTime: number;
  activeCount: number | null;
  executingCount: number | null;
  onShowActive?: () => void;
}

function Tile({
  label,
  help,
  value,
  detail,
  children,
}: {
  label: string;
  help?: React.ReactNode;
  value: React.ReactNode;
  detail: React.ReactNode;
  /** A meter under the figure. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 px-4 py-3 sm:px-5 sm:py-4">
      <Stat
        label={
          <span className="inline-flex items-center gap-1">
            {label}
            {help}
          </span>
        }
        value={value}
        hint={detail}
      />
      {children}
    </div>
  );
}

const valueSkeleton = <Skeleton className="my-1 h-6 w-16" />;

/** One pip per weekly slot: gold while free, a track once used. */
function SlotPips({ left, cap }: { left: number; cap: number }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: cap }, (_, i) => (
        <span
          key={i}
          className={cn("h-1.5 flex-1 rounded-full", i < left ? "facet-gold" : "bg-fill-3")}
        />
      ))}
    </div>
  );
}

/**
 * The three things that gate a new directive: weekly slots, executive bandwidth, and what is
 * already in force.
 */
export function DirectiveStatusStrip({
  countryId,
  nowIxTime,
  activeCount,
  executingCount,
  onShowActive,
}: DirectiveStatusStripProps) {
  const status = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });
  const execBandwidth = api.policies.getPolicyReconContext.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const slots = status.data;
  const slotsLeft = slots ? Math.max(0, slots.cap - slots.usedThisWeek) : null;
  const bw = execBandwidth.data;
  const bwKnown = hasBandwidth(bw);

  const slotDetail = !slots
    ? status.error
      ? "Unavailable"
      : " "
    : slots.canCommit
      ? "Each reopens 7 IxTime days after use"
      : slots.cooldownUntil
        ? `Next opens in ${formatIxCountdown(slots.cooldownUntil, nowIxTime)}`
        : "All used this week";

  return (
    <Card className="divide-separator grid grid-cols-1 divide-y overflow-hidden sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Tile
        label="Weekly slots"
        value={status.isLoading ? valueSkeleton : slots ? `${slotsLeft} of ${slots.cap} left` : "–"}
        detail={slotDetail}
      >
        {slots && slotsLeft != null && <SlotPips left={slotsLeft} cap={slots.cap} />}
      </Tile>

      <Tile
        label="Executive bandwidth"
        help={<BandwidthHelp state={bw} />}
        value={
          execBandwidth.isLoading ? (
            valueSkeleton
          ) : bwKnown ? (
            <span className={cn(bw.overCapacity && "text-destructive")}>
              {Math.round(bw.available)} free
            </span>
          ) : (
            "–"
          )
        }
        detail={
          bwKnown
            ? `${Math.round(bw.used)} of ${Math.round(bw.capacity)} in use${bw.overCapacity ? " · over capacity" : ""}`
            : execBandwidth.isLoading
              ? " "
              : "Unavailable"
        }
      >
        {bwKnown && <BandwidthBar state={bw} />}
      </Tile>

      <Tile
        label="In force"
        value={activeCount == null ? valueSkeleton : activeCount}
        detail={
          activeCount == null ? (
            " "
          ) : activeCount === 0 ? (
            "No directives running"
          ) : (
            <Button
              variant="link"
              size="xs"
              onClick={onShowActive}
              disabled={!onShowActive}
              className="text-footnote text-label-secondary hover:text-label h-auto gap-1 px-0 max-sm:h-11"
            >
              {executingCount ?? 0} executing this week
              <NavArrowRight aria-hidden />
            </Button>
          )
        }
      />
    </Card>
  );
}

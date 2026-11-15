"use client";

import React from "react";
import { focusRing } from "~/components/ui/button";
import { RingGrid, type HeroRing } from "~/components/shared/country-hero/HeroSnapshotPanels";
import { BandwidthHelp } from "~/components/mycountry/directives/BandwidthHelp";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { useInternalStability } from "~/hooks/useInternalStability";
import { getQualitativeRating } from "~/lib/qualitative-rating";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import {
  deriveFigures,
  describeExecBandwidth,
  execBandwidthPercent,
  slotPips,
} from "./command-figures";

/** One reading of the cluster: its name, its value in words or a count, then its meter. */
const READING = "flex min-w-0 flex-col gap-1 text-left";

/** A slim meter. Spans, not the Progress primitive (a div): a reading can sit inside a button. */
function Meter({ share, over }: { share: number | null; over?: boolean }) {
  return (
    <span aria-hidden className="bg-fill-2 mt-1 block h-1 overflow-hidden rounded-full">
      <span
        className={cn(
          "duration-fast ease-out-facet block h-full w-full origin-left rounded-full transition-transform motion-reduce:transition-none",
          over ? "bg-destructive" : "bg-label-secondary"
        )}
        style={{ transform: `scaleX(${(share ?? 0) / 100})` }}
      />
    </span>
  );
}

/** One pip per slot, the used ones filled. */
function Pips({ pips }: { pips: readonly boolean[] }) {
  return (
    <span aria-hidden className="mt-1 flex gap-1">
      {pips.map((used, i) => (
        <span
          // Slots have no identity but their order.
          key={i}
          className={cn(
            "duration-fast h-1 flex-1 rounded-full transition-colors motion-reduce:transition-none",
            used ? "bg-label-secondary" : "bg-fill-2"
          )}
        />
      ))}
    </span>
  );
}

/** A reading's visible parts; its host (a button or a group) carries the accessible name. */
function ReadingParts({
  label,
  value,
  detail,
  valueClassName,
  children,
}: {
  label: string;
  /** The figure or rating word. */
  value: string;
  /** What the figure is out of, in a quieter voice. */
  detail?: string;
  valueClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <span aria-hidden className="text-caption text-label-secondary truncate">
        {label}
      </span>
      <span aria-hidden className="text-callout truncate tabular-nums">
        <span className={cn("font-semibold", valueClassName ?? "text-label")}>{value}</span>
        {detail && <span className="text-label-secondary"> {detail}</span>}
      </span>
      {children}
    </>
  );
}

/**
 * CommandBand — the command face's footer row, the private counterpart of the profile's Country
 * DNA: the shared vitality rings, then one cluster of the readings only the owner sees (executive
 * bandwidth as a meter with its count, this week's directive slots as pips, the internal stability
 * Defense computes as a rating word) and the issues waiting on them. Bandwidth opens its breakdown.
 */
export function CommandBand({
  countryId,
  rings,
  onOpenRings,
}: {
  countryId: string;
  rings: readonly HeroRing[];
  onOpenRings: () => void;
}) {
  const { country } = useCountryData();
  const { metrics: stability } = useInternalStability({ countryId });
  const { stabilityPct } = deriveFigures(country, stability?.stabilityScore);
  const live = { enabled: !!countryId, refetchInterval: 20_000 } as const;
  const { data: status } = api.intent.getStatus.useQuery({ countryId }, live);
  const { data: bandwidth } = api.policies.getPolicyReconContext.useQuery({ countryId }, live);
  const { data: pending } = api.nationalIssues.getPendingCount.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  const slots = status ? { used: status.usedThisWeek, cap: status.cap } : null;
  const pips = slotPips(slots);
  const reading = describeExecBandwidth(bandwidth, slots);
  const bandwidthShare = execBandwidthPercent(bandwidth);
  const rating = stabilityPct === null ? null : getQualitativeRating(stabilityPct);
  const openIssues = pending?.total ?? 0;
  const urgent = pending?.urgent ?? 0;

  return (
    <section
      aria-label="Command readings"
      className="border-separator flex flex-wrap items-start gap-x-7 gap-y-5 border-t px-1 pt-3.5"
    >
      {rings.length > 0 && (
        <RingGrid rings={rings} onOpen={onOpenRings} className="min-w-0 flex-[1_1_16rem]" />
      )}

      <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-3">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] items-start gap-x-5 gap-y-3">
          <BandwidthHelp
            state={bandwidth}
            trigger={
              <button
                type="button"
                title={reading.title}
                aria-label={`${reading.title} Show the breakdown.`}
                data-testid="exec-bandwidth-band"
                className={cn(
                  READING,
                  "facet-press-subtle hover:bg-fill-4 rounded-control-sm -m-1 cursor-pointer p-1 pointer-coarse:min-h-11",
                  focusRing
                )}
              >
                <ReadingParts
                  label="Bandwidth"
                  value={reading.value}
                  detail={reading.detail}
                  valueClassName={bandwidth?.overCapacity ? "text-destructive" : undefined}
                >
                  <Meter share={bandwidthShare} over={bandwidth?.overCapacity} />
                </ReadingParts>
              </button>
            }
          />
          <div
            role="group"
            aria-label={
              slots
                ? `Directive slots: ${slots.used} of ${slots.cap} used this week`
                : "Directive slots unavailable"
            }
            className={READING}
          >
            <ReadingParts
              label="Directive slots"
              value={slots ? `${slots.used}` : "–"}
              detail={slots ? `of ${slots.cap} used` : undefined}
            >
              {pips ? (
                <Pips pips={pips} />
              ) : (
                <Meter share={slots && slots.cap > 0 ? (slots.used / slots.cap) * 100 : null} />
              )}
            </ReadingParts>
          </div>
          <div
            role="group"
            aria-label={
              rating ? `Internal stability: ${rating.label}` : "Internal stability unavailable"
            }
            className={READING}
          >
            <ReadingParts
              label="Stability"
              value={rating?.label ?? "–"}
              valueClassName={rating?.color}
            >
              <Meter share={stabilityPct} />
            </ReadingParts>
          </div>
        </div>
        {openIssues > 0 && (
          <ul aria-label="Waiting on you" className="flex flex-wrap gap-1.5">
            <li className="bg-fill-3 text-footnote text-label rounded-full px-2.5 py-1 tabular-nums">
              <span className="font-semibold">{openIssues}</span>{" "}
              {openIssues === 1 ? "open issue" : "open issues"}
            </li>
            {urgent > 0 && (
              <li className="bg-fill-4 text-footnote text-destructive rounded-full px-2.5 py-1 font-medium tabular-nums">
                {urgent} urgent
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}

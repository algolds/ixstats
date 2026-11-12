"use client";

import React from "react";
import { focusRing } from "~/components/ui/button";
import { RingGrid, type HeroRing } from "~/components/shared/country-hero/HeroSnapshotPanels";
import { BandwidthHelp } from "~/components/mycountry/directives/BandwidthHelp";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { useInternalStability } from "~/hooks/useInternalStability";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import {
  deriveFigures,
  describeExecBandwidth,
  execBandwidthPercent,
  slotPercent,
} from "./command-figures";

/** One reading as the profile's Country DNA draws it: label, meter, value. */
const METER_ROW =
  "text-footnote grid w-full grid-cols-[7rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-left";

/** A reading's visible parts; its host (a button or a group) carries the accessible name. */
function MeterParts({
  label,
  value,
  pct,
  over,
}: {
  label: string;
  value: string;
  pct: number | null;
  over?: boolean;
}) {
  return (
    <>
      <span aria-hidden className="text-label-secondary">
        {label}
      </span>
      {/* Spans, not the Progress primitive (a div): this row can sit inside a button. */}
      <span aria-hidden className="bg-fill-2 block h-1.5 overflow-hidden rounded-full">
        <span
          className={cn(
            "duration-fast ease-out-facet block h-full w-full origin-left rounded-full transition-transform motion-reduce:transition-none",
            over ? "bg-destructive" : "bg-tint"
          )}
          style={{ transform: `scaleX(${(pct ?? 0) / 100})` }}
        />
      </span>
      <span
        aria-hidden
        className={cn(
          "text-right font-semibold tabular-nums",
          over ? "text-destructive" : "text-label"
        )}
      >
        {value}
      </span>
    </>
  );
}

/** A read-only reading, named as one phrase for assistive tech. */
function ReadingRow({
  label,
  name,
  value,
  pct,
}: {
  label: string;
  name: string;
  value: string;
  pct: number | null;
}) {
  return (
    <div role="group" aria-label={name} className={cn(METER_ROW, "py-0.5")}>
      <MeterParts label={label} value={value} pct={pct} />
    </div>
  );
}

/**
 * CommandBand — the command face's footer row, the private counterpart of the profile's Country
 * DNA: the shared vitality rings, then the readings only the owner sees (executive bandwidth,
 * this week's directive slots, the internal stability Defense computes) and the issues waiting on
 * them. Bandwidth opens its breakdown.
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
  const reading = describeExecBandwidth(bandwidth, slots);
  const openIssues = pending?.total ?? 0;
  const urgent = pending?.urgent ?? 0;

  return (
    <section
      aria-label="Command readings"
      className="facet-well rounded-row flex flex-wrap items-start gap-x-7 gap-y-5 p-4"
    >
      {rings.length > 0 && (
        <RingGrid rings={rings} onOpen={onOpenRings} className="min-w-0 flex-[1_1_16rem]" />
      )}

      <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-2">
        <BandwidthHelp
          state={bandwidth}
          trigger={
            <button
              type="button"
              title={reading.title}
              aria-label={`${reading.title} Show the breakdown.`}
              data-testid="exec-bandwidth-band"
              className={cn(
                METER_ROW,
                "facet-press-subtle hover:bg-fill-4 rounded-control-sm -mx-1 cursor-pointer px-1 py-0.5 pointer-coarse:min-h-11",
                focusRing
              )}
            >
              <MeterParts
                label="Bandwidth"
                value={reading.value}
                pct={execBandwidthPercent(bandwidth)}
                over={bandwidth?.overCapacity}
              />
            </button>
          }
        />
        <ReadingRow
          label="Directive slots"
          name={
            slots
              ? `Directive slots: ${slots.used} of ${slots.cap} used this week`
              : "Directive slots unavailable"
          }
          value={slots ? `${slots.used}/${slots.cap}` : "–"}
          pct={slotPercent(slots)}
        />
        <ReadingRow
          label="Stability"
          name={
            stabilityPct === null
              ? "Internal stability unavailable"
              : `Internal stability: ${stabilityPct} of 100`
          }
          value={stabilityPct === null ? "–" : `${stabilityPct}%`}
          pct={stabilityPct}
        />
        {openIssues > 0 && (
          <ul aria-label="Waiting on you" className="flex flex-wrap gap-1.5 pt-1">
            <li className="bg-tint-fill text-footnote text-label rounded-full px-2.5 py-1 tabular-nums">
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

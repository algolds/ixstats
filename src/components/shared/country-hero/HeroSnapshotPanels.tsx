"use client";

import { getQualitativeRating } from "~/lib/qualitative-rating";
import { memo } from "react";
import { Coins, Group as Users, Activity, Heart, ScaleFrameEnlarge as Scale } from "iconoir-react";
import { cn, formatCompactNumber } from "~/lib/utils";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import { api } from "~/trpc/react";
import { HealthRing } from "~/components/ui/health-ring";

/** Telemetry cells: subtle hover wash and tactile press, without nested borders or icon zoom. */
const SNAPSHOT_BUTTON =
  "group facet-press facet-press-sm hover:bg-fill-4 rounded-control focus-visible:outline-tint flex min-w-0 cursor-pointer items-center gap-2 px-2 py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2";

export type HeroModal = "vitality" | "gdp" | "population" | "government";

export interface HeroSnapshotData {
  stats: {
    gdpPerCapita: number;
    currentTotalGdp: number;
    population: number;
  };
  activityRingsData?: {
    economicVitality?: number;
    populationWellbeing?: number;
    /** null when the country has no diplomatic record yet. */
    diplomaticStanding?: number | null;
    /** null when the country has no government structure yet. */
    governmentalEfficiency?: number | null;
  };
}

const METRIC_COLORS = [
  { min: 80, color: "var(--color-green)" },
  { min: 60, color: "var(--color-yellow)" },
  { min: 35, color: "var(--color-orange)" },
];

const getMetricColor = (val: number) =>
  METRIC_COLORS.find((m) => val >= m.min)?.color ?? "var(--color-red)";

// Diplomatic / Efficiency are left out (not shown as 0) when there is no data.
const RING_FIELDS = [
  { label: "Economy", key: "economicVitality", always: true },
  { label: "Wellbeing", key: "populationWellbeing", always: true },
  { label: "Diplomatic", key: "diplomaticStanding", always: false },
  { label: "Efficiency", key: "governmentalEfficiency", always: false },
] as const;

export interface HeroRing {
  label: string;
  value: number;
  color: string;
}

/** The vitality rings the country has a record for (Diplomatic and Efficiency need one). */
export function heroRings(activity: HeroSnapshotData["activityRingsData"]): HeroRing[] {
  return RING_FIELDS.flatMap(({ label, key, always }) => {
    const value = activity?.[key];
    if (!activity || (!always && typeof value !== "number")) return [];
    return [{ label, value: value || 0, color: getMetricColor(value || 0) }];
  });
}

/** A country's overall standing: the rating of the mean of its recorded vitality rings. */
export function vitalityStanding(rings: readonly HeroRing[]) {
  if (rings.length === 0) return null;
  const score = rings.reduce((sum, ring) => sum + ring.value, 0) / rings.length;
  return { ...getQualitativeRating(score), score };
}

/** The vitality rings as pressable tiles, each opening the vitality breakdown. */
export function RingGrid({
  rings,
  onOpen,
  className,
}: {
  rings: readonly HeroRing[];
  onOpen: () => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-1.5", className)}>
      {rings.map((ring) => {
        const rating = getQualitativeRating(ring.value);
        return (
          <button
            type="button"
            key={ring.label}
            onClick={onOpen}
            className="hover:bg-fill-4 rounded-control facet-press focus-visible:outline-tint group flex cursor-pointer items-center gap-2.5 px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
            title="Vitality breakdown"
          >
            <HealthRing value={ring.value} size={30} color={ring.color} label={ring.label} />
            <span className="min-w-0 flex-1">
              <span className="text-label-secondary text-caption block truncate">{ring.label}</span>
              <span className={cn("text-caption block font-medium", rating.color)}>
                {rating.label}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function HeroSnapshotPanelsComponent({
  data,
  countryId,
  showRings = true,
  onOpenModal,
}: {
  data: HeroSnapshotData;
  countryId?: string;
  /** The rings sit in the panel unless the host shows them elsewhere. */
  showRings?: boolean;
  onOpenModal: (modal: HeroModal) => void;
}) {
  const { data: recorded } = api.mycountry.getCountryDashboard.useQuery(
    { countryId: countryId || "" },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const approval =
    typeof recorded?.publicApproval === "number" ? `${Math.round(recorded.publicApproval)}%` : "—";
  const stability = recorded?.politicalStability || "—";

  const { population, currentTotalGdp, gdpPerCapita } = data.stats;
  // Compact, like GDP beside it: the full count truncates in the floating Lens panel.
  const pop = population ? formatCompactNumber(population) : "—";
  const gdp = currentTotalGdp
    ? formatCompactCurrency(currentTotalGdp)
    : gdpPerCapita
      ? `$${Math.round(gdpPerCapita).toLocaleString()}`
      : "—";

  const rings = heroRings(data.activityRingsData);

  const standing = vitalityStanding(rings);

  const headline = [
    {
      modal: "population",
      title: "Population breakdown",
      icon: Users,
      label: "Population",
      value: pop,
      valueClass: "text-label tabular-nums",
    },
    {
      modal: "gdp",
      title: "GDP breakdown",
      icon: Coins,
      label: "GDP",
      value: gdp,
      valueClass: "text-label tabular-nums",
    },
    {
      modal: "vitality",
      title: "Vitality breakdown",
      icon: Activity,
      label: "Standing",
      value: standing?.label ?? "—",
      valueClass: standing?.color ?? "text-label-secondary",
    },
  ] as const;

  const executive = [
    [Heart, "Approval", approval],
    [Scale, "Stability", stability],
  ] as const;

  return (
    <div className="border-separator/60 flex h-full flex-col justify-between border-t pt-2">
      <div className="divide-separator/60 grid grid-cols-3 divide-x py-1">
        {headline.map(({ modal, title, icon: Icon, label, value, valueClass }) => (
          <button
            key={modal}
            type="button"
            onClick={() => onOpenModal(modal)}
            className={SNAPSHOT_BUTTON}
            title={title}
          >
            <Icon aria-hidden className="text-label-secondary size-4 shrink-0" />
            <span className="min-w-0">
              <span className="text-label-secondary text-caption block truncate">{label}</span>
              <span
                className={cn(
                  "text-caption sm:text-headline block truncate group-hover:underline group-focus-visible:underline",
                  valueClass
                )}
              >
                {value}
              </span>
            </span>
          </button>
        ))}
      </div>

      {showRings && rings.length > 0 && (
        <div className="border-separator/60 flex flex-1 flex-col justify-center border-t py-2">
          <RingGrid rings={rings} onOpen={() => onOpenModal("vitality")} />
        </div>
      )}

      <dl className="border-separator/60 divide-separator/60 grid grid-cols-2 divide-x border-t pt-2">
        {executive.map(([Icon, label, value]) => (
          <div key={label} className="flex min-w-0 items-center justify-center gap-1.5 px-1">
            <Icon aria-hidden className="text-label-secondary size-3.5 shrink-0" />
            <dt className="text-label-secondary text-footnote">{label}</dt>
            <dd className="text-label text-caption truncate font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export const HeroSnapshotPanels = memo(HeroSnapshotPanelsComponent);

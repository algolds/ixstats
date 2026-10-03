"use client";

import { memo } from "react";
import { Coins, Group as Users, Activity, Heart, ScaleFrameEnlarge as Scale } from "iconoir-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { HealthRing } from "~/components/ui/health-ring";

/** Telemetry cells: hover wash, the icon grows, and the cell presses. */
const SNAPSHOT_BUTTON =
  "group facet-press facet-press-sm hover:bg-fill-4 rounded-control focus-visible:outline-tint flex min-w-0 cursor-pointer items-center gap-2 px-2 py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2";

/** Icon nudge on hover and keyboard focus (Reduce Motion: still). */
const ICON_GROW =
  "ease-out-facet transition-[scale] duration-fast group-hover:scale-110 group-focus-visible:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:scale-100";

export interface HeroSnapshotData {
  stats: {
    gdpPerCapita: number;
    currentTotalGdp: number;
    population: number;
    populationDensity: number | null;
    landArea: number | null;
    areaSqMi: number | null;
    gdpGrowth: number;
    popGrowth: number;
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

const RATINGS = [
  { min: 80, label: "Optimal", color: "text-success" },
  { min: 65, label: "Strong", color: "text-success" },
  { min: 45, label: "Stable", color: "text-teal" },
  { min: 30, label: "Moderate", color: "text-caution" },
];
const VULNERABLE = { label: "Vulnerable", color: "text-destructive" };

const getQualitativeRating = (score: number) => RATINGS.find((r) => score >= r.min) ?? VULNERABLE;

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

function HeroSnapshotPanelsComponent({
  // oxlint-disable-next-line eslint/no-unused-vars
  isPremium,
  data,
  countryId,
  onOpenModal,
}: {
  isPremium: boolean;
  data: HeroSnapshotData;
  countryId?: string;
  onOpenModal: (modal: "vitality" | "gdp" | "population" | "government") => void;
}) {
  const { data: recorded } = api.mycountry.getCountryDashboard.useQuery(
    { countryId: countryId || "" },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const approval =
    typeof recorded?.publicApproval === "number" ? `${Math.round(recorded.publicApproval)}%` : "—";
  const stability = recorded?.politicalStability || "—";

  const { population, currentTotalGdp, gdpPerCapita } = data.stats;
  const pop = population ? Math.round(population).toLocaleString() : "—";
  const gdp = currentTotalGdp
    ? `$${(currentTotalGdp / 1e12).toFixed(2)}T`
    : gdpPerCapita
      ? `$${Math.round(gdpPerCapita).toLocaleString()}`
      : "—";

  const rings = RING_FIELDS.flatMap(({ label, key, always }) => {
    const value = data.activityRingsData?.[key];
    if (!data.activityRingsData || (!always && typeof value !== "number")) return [];
    return [{ label, value: value || 0, color: getMetricColor(value || 0) }];
  });

  // Overall standing is the mean of the recorded vitality rings.
  const standing =
    rings.length > 0
      ? getQualitativeRating(rings.reduce((sum, ring) => sum + ring.value, 0) / rings.length)
      : null;

  const headline = [
    {
      modal: "population",
      title: "Population breakdown",
      icon: Users,
      tone: "text-blue",
      label: "Pop",
      labelClass: "text-stat-label",
      value: pop,
      valueClass: "text-label tabular-nums",
    },
    {
      modal: "gdp",
      title: "GDP breakdown",
      icon: Coins,
      tone: "text-green",
      label: "GDP",
      labelClass: "text-stat-label",
      value: gdp,
      valueClass: "text-success tabular-nums",
    },
    {
      modal: "vitality",
      title: "Vitality breakdown",
      icon: Activity,
      tone: "text-yellow",
      label: "Standing",
      labelClass: "text-eyebrow",
      value: standing?.label ?? "—",
      valueClass: standing?.color ?? "text-label-secondary",
    },
  ] as const;

  const executive = [
    [Heart, "text-red", "Approval", approval],
    [Scale, "text-indigo", "Stability", stability],
  ] as const;

  return (
    <div className="bg-surface rounded-row border-separator flex h-full flex-col overflow-hidden border">
      <div className="divide-separator bg-surface-secondary grid grid-cols-3 divide-x p-2">
        {headline.map(
          ({ modal, title, icon: Icon, tone, label, labelClass, value, valueClass }) => (
            <button
              key={modal}
              type="button"
              onClick={() => onOpenModal(modal)}
              className={SNAPSHOT_BUTTON}
              title={title}
            >
              <Icon aria-hidden className={cn(tone, "size-4 shrink-0", ICON_GROW)} />
              <span className="min-w-0">
                <span className={cn("text-label-secondary block", labelClass)}>{label}</span>
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
          )
        )}
      </div>

      <div className="border-separator flex flex-1 flex-col justify-center border-t p-2">
        <div className="grid grid-cols-2 gap-2">
          {rings.map((ring) => {
            const rating = getQualitativeRating(ring.value);
            return (
              <button
                type="button"
                key={ring.label}
                onClick={() => onOpenModal("vitality")}
                className="bg-surface-secondary hover:bg-fill-3 rounded-control facet-press focus-visible:outline-tint group flex cursor-pointer items-center gap-2 p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                title="Vitality breakdown"
              >
                <HealthRing value={ring.value} size={32} color={ring.color} label={ring.label} />
                <span className="min-w-0 flex-1">
                  <span className="text-label-secondary text-eyebrow block truncate">
                    {ring.label}
                  </span>
                  <span className={cn("text-caption block", rating.color)}>{rating.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <dl className="border-separator divide-separator bg-surface-secondary grid grid-cols-2 divide-x border-t py-2">
        {executive.map(([Icon, tone, label, value]) => (
          <div key={label} className="flex min-w-0 items-center justify-center gap-1 px-1">
            <Icon aria-hidden className={cn(tone, "size-3.5 shrink-0")} />
            <dt className="text-label-secondary text-footnote">{label}</dt>
            <dd className="text-label text-caption truncate tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export const HeroSnapshotPanels = memo(HeroSnapshotPanelsComponent);

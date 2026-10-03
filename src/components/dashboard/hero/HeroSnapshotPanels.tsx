"use client";

import { useMemo, memo } from "react";
import {
  Coins,
  Group as Users,
  Activity,
  Heart,
  ScaleFrameEnlarge as Scale,
  Flash as Zap,
} from "iconoir-react";
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
  policies?: Array<{ id: string; name: string; category: string; status: string }>;
  meetings?: Array<{ actionItems: Array<{ status: string }> }>;
  embassies?: Array<{ status: string }>;
  relations?: Array<{ id: string; targetCountryName: string; strength?: number }>;
  defenseOverview?: { overallScore?: number };
  intelligenceOverview?: {
    alerts?: { critical?: number; items?: Array<{ id: string; severity: string; title: string }> };
  };
  securityData?: { overallSecurityScore?: number; activeThreatCount?: number };
  militaryBranches?: Array<{ id: string; name: string; readinessLevel?: number }>;
  civilServiceStatus?: {
    consumedStaff: number;
    capacity: number;
    utilizationPercent: number;
    overCapacity: boolean;
    activeCount: number;
  };
  pendingIssuesCount?: number;
}

function getQualitativeRating(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Optimal", color: "text-success" };
  if (score >= 65) return { label: "Strong", color: "text-success" };
  if (score >= 45) return { label: "Stable", color: "text-teal" };
  if (score >= 30) return { label: "Moderate", color: "text-caution" };
  return { label: "Vulnerable", color: "text-destructive" };
}

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
  const getMetricColor = (val: number) => {
    if (val < 35) return "var(--color-red)";
    if (val < 60) return "var(--color-orange)";
    if (val < 80) return "var(--color-yellow)";
    return "var(--color-green)";
  };

  const dashboardData = (api as any).mycountry?.getCountryDashboard?.useQuery?.(
    { countryId: countryId || "" },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const approvalPct = useMemo(() => {
    const raw =
      (dashboardData?.data as any)?.currentPublicApproval ??
      (dashboardData?.data as any)?.approvalRating ??
      0.65;
    return Math.round(raw > 1 ? raw : raw * 100);
  }, [dashboardData?.data]);

  const stabilityPct = useMemo(() => {
    const raw =
      (dashboardData?.data as any)?.currentStability ??
      (dashboardData?.data as any)?.stability ??
      0.4;
    return Math.round(raw > 1 ? raw : raw * 100);
  }, [dashboardData?.data]);

  const capacityPct = 100;

  const pop = data.stats.population ? Math.round(data.stats.population).toLocaleString() : "—";
  const gdp = data.stats.currentTotalGdp
    ? `$${(data.stats.currentTotalGdp / 1e12).toFixed(2)}T`
    : data.stats.gdpPerCapita
      ? `$${Math.round(data.stats.gdpPerCapita).toLocaleString()}`
      : "—";

  const rings = data.activityRingsData
    ? [
        {
          label: "Economy",
          value: data.activityRingsData.economicVitality || 0,
          color: getMetricColor(data.activityRingsData.economicVitality || 0),
          modal: "vitality" as const,
        },
        {
          label: "Wellbeing",
          value: data.activityRingsData.populationWellbeing || 0,
          color: getMetricColor(data.activityRingsData.populationWellbeing || 0),
          modal: "vitality" as const,
        },
        // Diplomatic / Efficiency are left out (not shown as 0) when there is no data.
        ...(typeof data.activityRingsData.diplomaticStanding === "number"
          ? [
              {
                label: "Diplomatic",
                value: data.activityRingsData.diplomaticStanding,
                color: getMetricColor(data.activityRingsData.diplomaticStanding),
                modal: "vitality" as const,
              },
            ]
          : []),
        ...(typeof data.activityRingsData.governmentalEfficiency === "number"
          ? [
              {
                label: "Efficiency",
                value: data.activityRingsData.governmentalEfficiency,
                color: getMetricColor(data.activityRingsData.governmentalEfficiency),
                modal: "vitality" as const,
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="bg-surface rounded-row border-separator flex h-full flex-col overflow-hidden border">
      {/* Section 1: headline figures */}
      <div className="divide-separator bg-surface-secondary grid grid-cols-3 divide-x p-2">
        <button
          type="button"
          onClick={() => onOpenModal("population")}
          className={SNAPSHOT_BUTTON}
          title="Population breakdown"
        >
          <Users aria-hidden className={cn("text-blue size-4 shrink-0", ICON_GROW)} />
          <span className="min-w-0">
            <span className="text-label-secondary text-stat-label block">Pop</span>
            <span className="text-label text-caption sm:text-headline block truncate tabular-nums group-hover:underline group-focus-visible:underline">
              {pop}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpenModal("gdp")}
          className={SNAPSHOT_BUTTON}
          title="GDP breakdown"
        >
          <Coins aria-hidden className={cn("text-green size-4 shrink-0", ICON_GROW)} />
          <span className="min-w-0">
            <span className="text-label-secondary text-stat-label block">GDP</span>
            <span className="text-success text-caption sm:text-headline block truncate tabular-nums group-hover:underline group-focus-visible:underline">
              {gdp}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpenModal("vitality")}
          className={SNAPSHOT_BUTTON}
          title="Vitality breakdown"
        >
          <Activity aria-hidden className={cn("text-yellow size-4 shrink-0", ICON_GROW)} />
          <span className="min-w-0">
            <span className="text-label-secondary text-eyebrow block">Standing</span>
            <span className="text-success text-caption sm:text-headline block truncate group-hover:underline group-focus-visible:underline">
              Optimal
            </span>
          </span>
        </button>
      </div>

      {/* Section 2: vitality rings */}
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

      {/* Section 3: executive telemetry */}
      <dl className="border-separator divide-separator bg-surface-secondary grid grid-cols-3 divide-x border-t py-2">
        <div className="flex min-w-0 items-center justify-center gap-1 px-1">
          <Heart aria-hidden className="text-red size-3.5 shrink-0" />
          <dt className="text-label-secondary text-footnote">Approval</dt>
          <dd className="text-label text-caption truncate tabular-nums">{approvalPct}%</dd>
        </div>

        <div className="flex min-w-0 items-center justify-center gap-1 px-1">
          <Scale aria-hidden className="text-indigo size-3.5 shrink-0" />
          <dt className="text-label-secondary text-footnote">Stability</dt>
          <dd className="text-label text-caption truncate tabular-nums">{stabilityPct}%</dd>
        </div>

        <div className="flex min-w-0 items-center justify-center gap-1 px-1">
          <Zap aria-hidden className="text-yellow size-3.5 shrink-0" />
          <dt className="text-label-secondary text-footnote">Capacity</dt>
          <dd className="text-label text-caption truncate tabular-nums">{capacityPct}%</dd>
        </div>
      </dl>
    </div>
  );
}

export const HeroSnapshotPanels = memo(HeroSnapshotPanelsComponent);

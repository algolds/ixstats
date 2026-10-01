"use client";

import React, { useState, useMemo } from "react";
import {
  Activity,
  Group as Users,
  Dollar as DollarSign,
  Heart,
  ScaleFrameEnlarge as Scale,
  Flash as Zap,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { Button, focusRing } from "~/components/ui/button";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { HealthRing } from "~/components/ui/health-ring";
import { VitalityBreakdownModal } from "~/components/mycountry/shared/modals/VitalityBreakdownModal";
import {
  useCountryData,
  createVitalityRingsFromCountry,
  type VitalityRing,
} from "~/components/mycountry/shared/primitives";
import { api } from "~/trpc/react";
import { formatCompact } from "~/lib/format/compact";
import { cn } from "~/lib/utils";
import { assetUrl } from "~/lib/base-path";
import { FlagWatermark } from "~/components/ui/facet/identity/FlagWatermark";

type RatingLabel = "Optimal" | "Strong" | "Moderate" | "Strained";

function getRatingLabel(score: number): RatingLabel {
  if (score >= 85) return "Optimal";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Moderate";
  return "Strained";
}

export interface StandingBandsProps {
  countryId: string;
}

/** CivCap state as served by `policies.getPolicyReconContext` (lib/government/civcap.ts). */
export interface CivCapBandInput {
  capacity: number;
  used: number;
  available: number;
  overCapacity: boolean;
  breakdown?: {
    governmentStaff: number;
    recon: number;
    policies: number;
    directives: number;
    delegatedIssues: number;
  };
}

/** The CivCap band: real CivCap used/capacity, with the weekly directive slots in the tooltip. */
export function describeCivCapBand(
  civCap: CivCapBandInput | null | undefined,
  slots: { used: number; cap: number } | null | undefined
): { value: string; title: string } {
  const slotLine = slots
    ? `Directives this week: ${slots.used}/${slots.cap} slots used.`
    : "Directive slots unavailable.";
  if (!civCap || !Number.isFinite(civCap.capacity) || !Number.isFinite(civCap.used)) {
    return { value: "—", title: `Civil Service Capacity unavailable. ${slotLine}` };
  }
  const b = civCap.breakdown;
  const breakdown = b
    ? ` Staff ${b.governmentStaff}, policies ${b.policies}, directives ${b.directives}, recon ${b.recon}, delegated issues ${b.delegatedIssues}.`
    : "";
  const status = civCap.overCapacity ? " Over capacity." : "";
  return {
    value: `${Math.round(civCap.used)}/${Math.round(civCap.capacity)}`,
    title:
      `CivCap: ${Math.round(civCap.used)} used of ${Math.round(civCap.capacity)} ` +
      `(${Math.round(civCap.available)} available).${status}${breakdown} ${slotLine}`,
  };
}

type RingKey =
  "economicVitality" | "populationWellbeing" | "diplomaticStanding" | "governmentalEfficiency";
const RING_KEYS: Record<string, RingKey> = {
  economic: "economicVitality",
  population: "populationWellbeing",
  diplomatic: "diplomaticStanding",
  government: "governmentalEfficiency",
};

function finiteScore(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : null;
}

/** National Standing rail card — population/GDP telemetry + governance strip + 4 vitality rings. */
function StandingBandsComponent({ countryId }: StandingBandsProps): React.JSX.Element {
  const { country, activityRingsData } = useCountryData();
  const flagUrl = assetUrl(country?.flagUrl || country?.flag);
  const [showExactPop, setShowExactPop] = useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  // Weekly directive slots (shown in the CivCap tooltip)
  const intentStatus = api.intent.getStatus.useQuery(
    { countryId },
    { enabled: !!countryId, refetchInterval: 20_000 }
  );
  // Civil Service Capacity: the shared used/available sum (lib/government/civcap.ts)
  const civCapQuery = api.policies.getPolicyReconContext.useQuery(
    { countryId },
    { enabled: !!countryId, refetchInterval: 20_000 }
  );

  // 1. Public Approval (Country.publicApproval, 0-100) — moved by issues and directives
  const approvalPct = useMemo(() => {
    const raw = country?.publicApproval;
    return typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : null;
  }, [country?.publicApproval]);

  // 2. Stability (InternalStabilityMetrics.stabilityScore, 0-100); null until it is computed
  const stabilityPct = useMemo(() => {
    const raw = country?.stabilityMetrics?.stabilityScore;
    return typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : null;
  }, [country?.stabilityMetrics?.stabilityScore]);

  // 3. Civil Service Capacity used/capacity; directive slots go in the tooltip
  const civCapBand = useMemo(
    () =>
      describeCivCapBand(
        civCapQuery.data,
        intentStatus.data
          ? { used: intentStatus.data.usedThisWeek, cap: intentStatus.data.cap }
          : null
      ),
    [civCapQuery.data, intentStatus.data]
  );

  // Server-computed vitality (countries.getActivityRingsData); a null score has no data yet
  const ringScores = useMemo(() => {
    const src = (activityRingsData ?? null) as Partial<Record<RingKey, unknown>> | null;
    return {
      economicVitality: finiteScore(src?.economicVitality),
      populationWellbeing: finiteScore(src?.populationWellbeing),
      diplomaticStanding: finiteScore(src?.diplomaticStanding),
      governmentalEfficiency: finiteScore(src?.governmentalEfficiency),
    };
  }, [activityRingsData]);

  const rings = useMemo<VitalityRing[]>(() => {
    if (!country || !activityRingsData) return [];
    return createVitalityRingsFromCountry(ringScores);
  }, [country, activityRingsData, ringScores]);

  const knownRings = useMemo(
    () => rings.filter((r) => ringScores[RING_KEYS[r.id]!] !== null),
    [rings, ringScores]
  );

  const compositeScore = useMemo(() => {
    return knownRings.length > 0
      ? Math.round(
          knownRings.reduce((sum: number, r: VitalityRing) => sum + r.value, 0) / knownRings.length
        )
      : 0;
  }, [knownRings]);

  const ratingLabelText = useMemo(() => getRatingLabel(compositeScore), [compositeScore]);

  const population = useMemo(() => {
    return country?.currentPopulation ?? country?.population ?? 0;
  }, [country?.currentPopulation, country?.population]);

  const totalGdp = useMemo(() => {
    return (
      country?.currentTotalGdp ??
      country?.gdp ??
      (population && country?.currentGdpPerCapita ? population * country.currentGdpPerCapita : 0)
    );
  }, [country?.currentTotalGdp, country?.gdp, country?.currentGdpPerCapita, population]);

  const formattedPop = useMemo(() => {
    return showExactPop ? Math.round(population).toLocaleString() : formatCompact(population);
  }, [showExactPop, population]);

  const civCapData = civCapQuery.data;
  const civCapPct =
    civCapData && Number.isFinite(civCapData.capacity) && civCapData.capacity > 0
      ? Math.min(100, Math.max(0, (civCapData.used / civCapData.capacity) * 100))
      : null;

  const handleOpenBreakdown = () => setIsBreakdownOpen(true);

  const handleTogglePop = () => setShowExactPop((prev) => !prev);

  return (
    <>
      {/* The v2 National Standing rail card (c5c6b382) on the Facet 3.1 glass hero: the flag
          watermark at v2 strength, the country chip and the vitality pill, one opaque telemetry
          panel (population/GDP, approval/stability/CivCap) and the 2×2 vitality rings. */}
      <FacetCard
        variant="glass"
        glow="shadow"
        rim="gold"
        className="group flex flex-col gap-3 p-4"
        aria-labelledby="national-standing-title"
        role="region"
      >
        <FlagWatermark src={flagUrl} className="-top-10 -right-10 size-56" />

        {/* Header: title + country chip, and the vitality pill */}
        <div className="relative flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <h2
              id="national-standing-title"
              className="text-label-secondary text-footnote font-semibold"
            >
              National standing
            </h2>
            {country?.name && (
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <span className="border-separator bg-surface rounded-control-sm shadow-card flex shrink-0 items-center justify-center overflow-hidden border p-0.5 transition-[scale] duration-200 motion-safe:group-hover:scale-105">
                  <UnifiedCountryFlag
                    countryName={country.name}
                    flagUrl={flagUrl}
                    size="sm"
                    showTooltip={false}
                  />
                </span>
                <p className="text-label text-headline truncate">{country.name}</p>
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenBreakdown}
            className="bg-surface h-9 gap-2 rounded-full sm:h-8"
            title="Open the vitality breakdown"
          >
            <Activity aria-hidden="true" className="text-tint" />
            <span>{knownRings.length > 0 ? ratingLabelText : "Vitality"}</span>
            {knownRings.length > 0 && (
              <span className="text-label-secondary font-data tabular-nums">{compositeScore}</span>
            )}
          </Button>
        </div>

        {/* One opaque telemetry panel (v2 "unified telemetry"): glass never nests */}
        {country && (
          <FacetCard variant="inset" padding="none" className="relative flex flex-col gap-2 p-3">
            <div className="border-separator flex items-center justify-between gap-2 border-b pb-2">
              <button
                type="button"
                onClick={handleTogglePop}
                aria-pressed={showExactPop}
                title={showExactPop ? "Show compact population" : "Show exact population"}
                className={cn(
                  "group/pop text-footnote rounded-control-sm facet-press facet-press-sm flex cursor-pointer items-center gap-2 pointer-coarse:min-h-11",
                  focusRing
                )}
              >
                <Users aria-hidden="true" className="text-label-secondary size-3.5" />
                <span className="text-label-secondary">Population</span>
                <strong className="text-label font-data font-semibold tabular-nums group-hover/pop:underline group-focus-visible/pop:underline">
                  {formattedPop}
                </strong>
              </button>
              <span className="text-footnote flex items-center gap-2">
                <DollarSign aria-hidden="true" className="text-label-secondary size-3.5" />
                <span className="text-label-secondary">GDP</span>
                <strong className="text-label font-data font-semibold tabular-nums">
                  ${formatCompact(totalGdp)}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1">
              <VitalCell
                icon={Heart}
                label="Approval"
                value={approvalPct === null ? "—" : `${approvalPct}%`}
              />
              <VitalCell
                icon={Scale}
                label="Stability"
                value={stabilityPct === null ? "—" : `${stabilityPct}%`}
                divided
              />
              <div
                className="border-separator flex min-w-0 flex-col gap-1 border-l pl-2"
                title={civCapBand.title}
                data-testid="civcap-band"
              >
                <VitalCell
                  icon={Zap}
                  label="CivCap"
                  value={civCapBand.value}
                  valueClassName={civCapData?.overCapacity ? "text-destructive" : undefined}
                  bare
                />
                {civCapPct !== null && (
                  <div
                    className="bg-fill-3 h-1 overflow-hidden rounded-full"
                    role="meter"
                    aria-label="Civil service capacity used"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(civCapPct)}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full",
                        civCapData?.overCapacity ? "bg-destructive" : "facet-gold"
                      )}
                      style={{ width: `${civCapPct}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </FacetCard>
        )}

        {/* The four vitality rings (2×2, v2) */}
        <div className="relative grid grid-cols-2 gap-2">
          {rings.map((ring) => {
            const known = ringScores[RING_KEYS[ring.id]!] !== null;
            return (
              // Native button: the Button primitive would force its icon size onto HealthRing's svg.
              <button
                key={ring.id}
                type="button"
                onClick={handleOpenBreakdown}
                aria-label={`${ring.label}: ${known ? `${ring.value} of 100` : "no data yet"}. Open vitality breakdown`}
                className={cn(
                  "group/ring border-separator bg-surface rounded-row facet-press facet-lift flex cursor-pointer items-center gap-2 border p-2 text-left select-none",
                  focusRing
                )}
              >
                <HealthRing
                  value={known ? ring.value : 0}
                  size={36}
                  color={known ? ring.color : "var(--color-label-secondary)"}
                  label={ring.label}
                />
                <div className="min-w-0 flex-1">
                  <span className="text-label-secondary group-hover/ring:text-label group-focus-visible/ring:text-label text-footnote block truncate transition-colors">
                    {ring.label}
                  </span>
                  {known ? (
                    // The ring's hue as text, pulled halfway to the label so it reads ≥ 4.5:1
                    // (a raw amber/cyan ring colour is < 3:1 on the light surface).
                    <span
                      className="text-headline font-data font-semibold tabular-nums"
                      style={{ color: `color-mix(in srgb, ${ring.color} 50%, var(--color-label))` }}
                    >
                      {ring.value}
                      <span className="text-label-secondary text-footnote font-normal">/100</span>
                    </span>
                  ) : (
                    <span
                      className="text-label-secondary text-headline tabular-nums"
                      title="No data yet"
                    >
                      —
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </FacetCard>

      <VitalityBreakdownModal
        isOpen={isBreakdownOpen}
        onClose={() => setIsBreakdownOpen(false)}
        rings={knownRings}
        countryName={country?.name}
      />
    </>
  );
}

/** One governance figure in the telemetry panel: glyph, sentence-case label, mono value. */
function VitalCell({
  icon: Icon,
  label,
  value,
  divided,
  bare,
  valueClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  divided?: boolean;
  bare?: boolean;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        !bare && "px-0.5",
        divided && "border-separator border-l pl-2"
      )}
    >
      <Icon aria-hidden="true" className="text-label-secondary size-3.5 shrink-0" />
      <div className="flex min-w-0 flex-col">
        <span className="text-label-secondary text-caption leading-tight">{label}</span>
        <span
          className={cn(
            "text-label text-footnote font-data truncate leading-tight font-semibold tabular-nums",
            valueClassName
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

export const StandingBands = React.memo(StandingBandsComponent);

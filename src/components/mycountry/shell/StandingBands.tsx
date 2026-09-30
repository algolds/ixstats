"use client";

import React, { useState, useMemo } from "react";
import {
  Activity,
  NavArrowRight,
  Group as Users,
  Dollar as DollarSign,
  Heart,
  ScaleFrameEnlarge as Scale,
  Flash as Zap,
} from "iconoir-react";
import {
  FacetCard,
  FacetCardContent,
  FacetCardHeader,
  FacetContainer,
} from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { HealthRing } from "~/components/ui/health-ring";
import { VitalityBreakdownModal } from "~/components/mycountry/shared/modals/VitalityBreakdownModal";
import {
  useCountryData,
  createVitalityRingsFromCountry,
  type VitalityRing,
} from "~/components/mycountry/shared/primitives";
import { api } from "~/trpc/react";
import { soundEffects } from "~/lib/sound/cuelume";
import { formatCompact } from "~/lib/format/compact";
import { cn } from "~/lib/utils";
import { assetUrl } from "~/lib/base-path";
import { FlagBackdrop } from "./FlagBackdrop";

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

/** National standing — the calm vitals summary under the title: five vitals + four vitality rings. */
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

  // Buttons carry the Cuelume bloom cue themselves (data-cuelume-press).
  const handleOpenBreakdown = () => setIsBreakdownOpen(true);

  const handleTogglePop = () => {
    soundEffects.toggle();
    setShowExactPop((prev) => !prev);
  };

  return (
    <>
      <FacetCard
        depth={2}
        interactive="none"
        className="relative overflow-hidden rounded-3xl"
        aria-labelledby="national-standing-title"
        role="region"
      >
        <FlagBackdrop src={flagUrl} intensity="subtle" side="left" tintGlow={false} />
        <FacetCardHeader className="flex-row flex-wrap items-start justify-between gap-x-4 gap-y-2 p-4 pb-0 sm:p-5 sm:pb-0">
          <div className="min-w-0">
            <h2
              id="national-standing-title"
              className="text-foreground text-base font-semibold tracking-tight"
            >
              National standing
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Your nation&apos;s vitals right now
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleOpenBreakdown}
            data-cuelume-press="bloom"
            className="h-9 gap-1.5 sm:h-8"
            title="Open the vitality breakdown"
          >
            <Activity aria-hidden="true" className="text-muted-foreground" />
            <span>{knownRings.length > 0 ? ratingLabelText : "Vitality"}</span>
            {knownRings.length > 0 && (
              <span className="text-muted-foreground tabular-nums">{compositeScore}</span>
            )}
            <NavArrowRight aria-hidden="true" className="text-muted-foreground size-3.5" />
          </Button>
        </FacetCardHeader>

        <FacetCardContent className="flex flex-col gap-4 p-4 sm:p-5">
          {/* Vitals: opaque depth-3 tiles (no stacked blur) with tabular figures */}
          {country && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <FacetContainer depth={3} surface="solid" className="rounded-xl p-0">
                <button
                  type="button"
                  onClick={handleTogglePop}
                  aria-pressed={showExactPop}
                  className="hover:bg-accent focus-visible:ring-ring flex h-full w-full cursor-pointer flex-col items-start gap-1 rounded-xl p-3 text-left transition-[color,background-color,transform] duration-150 outline-none select-none focus-visible:ring-2 active:scale-[0.98]"
                  title={showExactPop ? "Show compact population" : "Show exact population"}
                >
                  <Eyebrow className="flex items-center gap-1.5">
                    <Users aria-hidden="true" className="size-3.5" />
                    Population
                  </Eyebrow>
                  <span className="text-foreground text-xl font-semibold tracking-tight tabular-nums">
                    {formattedPop}
                  </span>
                </button>
              </FacetContainer>

              <VitalTile icon={DollarSign} label="GDP" value={`$${formatCompact(totalGdp)}`} />
              <VitalTile
                icon={Heart}
                label="Approval"
                value={approvalPct === null ? "—" : `${approvalPct}%`}
              />
              <VitalTile
                icon={Scale}
                label="Stability"
                value={stabilityPct === null ? "—" : `${stabilityPct}%`}
              />

              <FacetContainer
                depth={3}
                surface="solid"
                className="col-span-2 flex flex-col gap-1 rounded-xl p-3 sm:col-span-1"
                title={civCapBand.title}
                data-testid="civcap-band"
              >
                <Eyebrow className="flex items-center gap-1.5">
                  <Zap aria-hidden="true" className="size-3.5" />
                  CivCap
                </Eyebrow>
                <p
                  className={cn(
                    "text-xl font-semibold tracking-tight tabular-nums",
                    civCapData?.overCapacity ? "text-destructive" : "text-foreground"
                  )}
                >
                  {civCapBand.value}
                </p>
                {civCapPct !== null && (
                  <div
                    className="bg-muted h-1 overflow-hidden rounded-full"
                    role="meter"
                    aria-label="Civil service capacity used"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(civCapPct)}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full",
                        civCapData?.overCapacity ? "bg-destructive" : "bg-(--facet-mycountry)"
                      )}
                      style={{ width: `${civCapPct}%` }}
                    />
                  </div>
                )}
              </FacetContainer>
            </div>
          )}

          {/* Vitality rings */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {rings.map((ring) => {
              const known = ringScores[RING_KEYS[ring.id]!] !== null;
              return (
                // Native button: the Button primitive would force its icon size onto HealthRing's svg.
                <button
                  key={ring.id}
                  type="button"
                  onClick={handleOpenBreakdown}
                  data-cuelume-press="bloom"
                  aria-label={`${ring.label}: ${known ? `${ring.value} of 100` : "no data yet"}. Open vitality breakdown`}
                  className="group/ring hover:bg-accent focus-visible:ring-ring flex cursor-pointer items-center gap-3 rounded-xl p-2 text-left transition-[color,background-color,transform] duration-150 outline-none select-none focus-visible:ring-1 active:scale-[0.98]"
                >
                  <HealthRing
                    value={known ? ring.value : 0}
                    size={40}
                    color={known ? ring.color : "var(--muted-foreground)"}
                    label={ring.label}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-muted-foreground group-hover/ring:text-foreground block truncate text-xs transition-colors">
                      {ring.label}
                    </span>
                    {known ? (
                      <span className="text-foreground text-sm font-semibold tabular-nums">
                        {ring.value}
                        <span className="text-muted-foreground text-xs font-normal">/100</span>
                      </span>
                    ) : (
                      <span
                        className="text-muted-foreground text-sm font-semibold tabular-nums"
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
        </FacetCardContent>
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

/** One static vital: an Eyebrow caption with glyph over a large tabular figure, on an opaque depth-3 tile. */
function VitalTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <FacetContainer depth={3} surface="solid" className="flex flex-col gap-1 rounded-xl p-3">
      <Eyebrow className="flex items-center gap-1.5">
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </Eyebrow>
      <p className="text-foreground truncate text-xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </FacetContainer>
  );
}

export const StandingBands = React.memo(StandingBandsComponent);

"use client";

import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  Activity,
  Group as Users,
  Dollar as DollarSign,
  Heart,
  ScaleFrameEnlarge as Scale,
  Flash as Zap,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { HealthRing } from "~/components/ui/health-ring";
import { VitalityBreakdownModal } from "~/components/mycountry/shared/modals/VitalityBreakdownModal";
import {
  useCountryData,
  createVitalityRingsFromCountry,
  type VitalityRing,
} from "~/components/mycountry/shared/primitives";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { api } from "~/trpc/react";
import { soundEffects } from "~/lib/sound/cuelume";
import { formatCompact } from "~/lib/format/compact";
import { assetUrl } from "~/lib/base-path";

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
  | "economicVitality"
  | "populationWellbeing"
  | "diplomaticStanding"
  | "governmentalEfficiency";
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
    return (
      country?.currentPopulation ?? country?.population ?? 0
    );
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

  const flagUrl = assetUrl(country?.flagUrl || country?.flag);

  const handleOpenBreakdown = () => {
    soundEffects.bloom();
    setIsBreakdownOpen(true);
  };

  const handleTogglePop = () => {
    soundEffects.toggle();
    setShowExactPop((prev) => !prev);
  };

  return (
    <>
      <FacetCard
        depth={1}
        interactive="none"
        className="group/card border-border/60 bg-card/60 relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-3.5 shadow-sm backdrop-blur-md transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300"
      >
        {/* Cinematic Background Flag Watermark Scrim */}
        {flagUrl && (
          <div className="pointer-events-none absolute -top-10 -right-10 h-56 w-56 overflow-hidden opacity-[0.12] transition-opacity duration-300 select-none dark:opacity-[0.16]">
            <img
              src={flagUrl}
              alt=""
              className="h-full w-full rounded-full object-cover object-center mix-blend-luminosity blur-[1px] filter dark:mix-blend-normal"
            />
            <div className="via-card/75 to-card absolute inset-0 bg-gradient-to-l from-transparent" />
          </div>
        )}

        <div className="relative z-10 flex flex-col gap-3">
          {/* Header Row: Title & Vitality Pill */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">
                National Standing
              </span>
              {country?.name && (
                <div className="mt-0.5 flex min-w-0 items-center gap-2">
                  <div className="border-border/60 bg-muted/40 relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border p-0.5 shadow-2xs backdrop-blur-md transition-transform group-hover/card:scale-105">
                    <UnifiedCountryFlag
                      countryName={country.name}
                      flagUrl={flagUrl}
                      size="sm"
                      className="rounded-sm object-cover"
                    />
                  </div>
                  <h3 className="text-foreground truncate text-sm font-bold tracking-tight">
                    {country.name}
                  </h3>
                </div>
              )}
            </div>

            <motion.button
              type="button"
              whileHover={{
                scale: 1.03,
                transition: { type: "spring", stiffness: 400, damping: 25 },
              }}
              whileTap={{ scale: 0.96 }}
              onClick={handleOpenBreakdown}
              className="border-border/80 bg-muted/50 hover:bg-muted text-foreground group flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-2xs backdrop-blur-md transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95"
              title="Click for full Vitality Breakdown"
            >
              <Activity className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 transition-colors" />
              <span className="font-semibold">
                {knownRings.length > 0 ? ratingLabelText : "—"}
              </span>
              {knownRings.length > 0 && (
                <span className="text-muted-foreground font-mono text-xs">
                  ({compositeScore})
                </span>
              )}
            </motion.button>
          </div>

          {/* Single Unified Telemetry Glass Container (Pop, GDP, Approval, Stability, Capacity) */}
          {country && (
            <div className="border-border/50 bg-muted/20 flex flex-col gap-2 rounded-xl border p-2.5 shadow-2xs backdrop-blur-md">
              {/* Row 1: Population & GDP */}
              <div className="border-border/40 flex items-center justify-between gap-2 border-b pb-1.5">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleTogglePop}
                  className="group flex cursor-pointer items-center gap-1.5 text-xs transition-colors"
                  title="Click to toggle exact population count"
                >
                  <Users className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 transition-colors" />
                  <span className="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">
                    Pop:
                  </span>
                  <strong className="text-foreground text-xs font-bold tracking-tight tabular-nums group-hover:underline">
                    {formattedPop}
                  </strong>
                </motion.button>

                <div className="flex items-center gap-1.5 text-xs">
                  <DollarSign className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">
                    GDP:
                  </span>
                  <strong className="text-foreground text-xs font-bold tracking-tight tabular-nums">
                    ${formatCompact(totalGdp)}
                  </strong>
                </div>
              </div>

              {/* Row 2: Executive Governance Telemetry (Approval, Stability, Capacity) */}
              <div className="grid grid-cols-3 gap-1 pt-0.5">
                <div className="flex min-w-0 items-center gap-1.5 px-0.5 text-xs">
                  <Heart className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-muted-foreground/70 text-xs leading-none font-bold tracking-wider uppercase">
                      Approval
                    </span>
                    <span className="text-foreground truncate text-xs leading-tight font-bold tabular-nums">
                      {approvalPct === null ? "—" : `${approvalPct}%`}
                    </span>
                  </div>
                </div>

                <div className="border-border/40 flex min-w-0 items-center gap-1.5 border-l px-1 text-xs">
                  <Scale className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-muted-foreground/70 text-xs leading-none font-bold tracking-wider uppercase">
                      Stability
                    </span>
                    <span className="text-foreground truncate text-xs leading-tight font-bold tabular-nums">
                      {stabilityPct === null ? "—" : `${stabilityPct}%`}
                    </span>
                  </div>
                </div>

                <div
                  className="border-border/40 flex min-w-0 items-center gap-1.5 border-l px-1 text-xs"
                  title={civCapBand.title}
                  data-testid="civcap-band"
                >
                  <Zap className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-muted-foreground/70 text-xs leading-none font-bold tracking-wider uppercase">
                      CivCap
                    </span>
                    <span
                      className={`truncate font-mono text-xs leading-tight font-bold tabular-nums ${
                        civCapQuery.data?.overCapacity ? "text-rose-500" : "text-foreground"
                      }`}
                    >
                      {civCapBand.value}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4 Vitality Rings Grid */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            {rings.map((ring) => {
              const known = ringScores[RING_KEYS[ring.id]!] !== null;
              return (
                <motion.button
                  key={ring.id}
                  type="button"
                  whileHover={{
                    scale: 1.02,
                    transition: { type: "spring", stiffness: 400, damping: 25 },
                  }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleOpenBreakdown}
                  className="group/ring border-border/50 bg-card/40 hover:border-border/80 hover:bg-card/70 flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-left backdrop-blur-md transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.97]"
                >
                  <HealthRing
                    value={known ? ring.value : 0}
                    size={34}
                    color={known ? ring.color : "#94a3b8"}
                    label={ring.label}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-muted-foreground/70 group-hover/ring:text-foreground block truncate text-xs font-bold tracking-wider uppercase transition-colors">
                      {ring.label}
                    </span>
                    {known ? (
                      <span
                        className="text-foreground text-xs font-bold tabular-nums"
                        style={{ color: ring.color }}
                      >
                        {ring.value}
                        <span className="text-muted-foreground/60 text-xs font-normal">/100</span>
                      </span>
                    ) : (
                      <span
                        className="text-muted-foreground text-xs font-bold tabular-nums"
                        title="No data yet"
                      >
                        —
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
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

export const StandingBands = React.memo(StandingBandsComponent);

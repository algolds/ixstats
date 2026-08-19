"use client";

import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Activity, Users, DollarSign, Heart, Scale, Zap } from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { HealthRing } from "~/components/ui/health-ring";
import { VitalityBreakdownModal } from "~/components/ui/modals/VitalityBreakdownModal";
import { CountryDataContext, createVitalityRingsFromCountry } from "~/components/mycountry/shared/primitives";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { api } from "~/trpc/react";

function formatCompact(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return (num ?? 0).toLocaleString();
}

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

/** National Standing rail card — population/GDP telemetry + governance strip + 4 vitality rings. */
function StandingBandsComponent({ countryId }: StandingBandsProps): React.JSX.Element {
  const countryContext = React.useContext(CountryDataContext);
  const [showExactPop, setShowExactPop] = useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  api.mycountry.getCountryDashboard.useQuery(
    { countryId },
    { enabled: !!countryId, refetchInterval: 15_000 }
  );

  // Live Backend Telemetry Queries
  const intentStatus = api.intent.getStatus.useQuery(
    { countryId },
    { enabled: !!countryId, refetchInterval: 15_000 }
  );

  const countryDetails = api.countries.getByIdAtTime.useQuery(
    { id: countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const govStructure = api.government.getByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const country = (countryContext as any)?.country || countryDetails.data;

  // 1. Live Public Approval Rating
  const approvalPct = useMemo(() => {
    const raw =
      countryDetails.data?.publicApproval ??
      country?.currentPublicApproval ??
      country?.approvalRating ??
      68;
    return Math.round(raw > 1 ? raw : raw * 100);
  }, [
    countryDetails.data?.publicApproval,
    country?.currentPublicApproval,
    country?.approvalRating,
  ]);

  // 2. Live Political Stability
  const stabilityPct = useMemo(() => {
    const raw =
      govStructure.data?.politicalStability ??
      country?.currentStability ??
      country?.stability ??
      0.78;
    return Math.round(raw > 1 ? raw : raw * 100);
  }, [govStructure.data?.politicalStability, country?.currentStability, country?.stability]);

  // 3. Live Statecraft Civil Capacity Throughput
  const capacityPct = useMemo(() => {
    const usedSlots = intentStatus.data?.usedThisWeek ?? 0;
    const slotCap = intentStatus.data?.cap ?? 3;
    return Math.round(Math.max(10, Math.min(100, ((slotCap - usedSlots) / slotCap) * 100)));
  }, [intentStatus.data?.usedThisWeek, intentStatus.data?.cap]);

  const rings = useMemo(() => {
    if (!country) return [];
    return createVitalityRingsFromCountry(country);
  }, [country]);

  const compositeScore = useMemo(() => {
    return rings.length > 0
      ? Math.round(rings.reduce((sum: number, r: any) => sum + r.value, 0) / rings.length)
      : 0;
  }, [rings]);

  const ratingLabelText = useMemo(() => getRatingLabel(compositeScore), [compositeScore]);

  const population = useMemo(() => {
    return (
      country?.currentPopulation ?? country?.population ?? (country as any)?.populationTotal ?? 0
    );
  }, [country?.currentPopulation, country?.population, (country as any)?.populationTotal]);

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

  const flagUrl = (country as any)?.flagUrl || country?.flag;

  return (
    <>
      <FacetCard
        depth={1}
        className="group/card relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] p-3.5 shadow-xl backdrop-blur-2xl transition-all duration-300 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent dark:border-white/10 dark:bg-black/35 dark:shadow-2xl"
      >
        {/* Cinematic Background Flag Watermark Scrim */}
        {flagUrl && (
          <div className="pointer-events-none absolute -top-10 -right-10 h-56 w-56 overflow-hidden opacity-[0.14] transition-all duration-700 select-none group-hover/card:scale-105 group-hover/card:opacity-[0.25] dark:opacity-[0.18]">
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
              <span className="text-muted-foreground/70 text-[8px] font-bold tracking-wider uppercase">
                National Standing
              </span>
              {country?.name && (
                <div className="mt-0.5 flex min-w-0 items-center gap-2">
                  <div className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/20 bg-white/10 p-0.5 shadow-xs backdrop-blur-md transition-transform group-hover/card:scale-105">
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
              onClick={() => setIsBreakdownOpen(true)}
              className="group flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-300 shadow-xs backdrop-blur-md transition-all hover:bg-cyan-500/20 active:scale-95"
              title="Click for full Vitality Breakdown"
            >
              <Activity className="h-3.5 w-3.5 text-cyan-400 transition-transform group-hover:scale-110" />
              <span className="font-bold">{ratingLabelText}</span>
              <span className="font-mono text-[9px] font-semibold text-cyan-300/80">
                ({compositeScore})
              </span>
            </motion.button>
          </div>

          {/* Single Unified Telemetry Glass Container (Pop, GDP, Approval, Stability, Capacity) */}
          {country && (
            <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 shadow-xs backdrop-blur-md dark:border-white/10 dark:bg-white/[0.03]">
              {/* Row 1: Population & GDP */}
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowExactPop((prev) => !prev)}
                  className="group flex cursor-pointer items-center gap-1.5 text-xs transition-colors"
                  title="Click to toggle exact population count"
                >
                  <Users className="group-hover:text-foreground h-3.5 w-3.5 text-blue-400 transition-colors" />
                  <span className="text-muted-foreground/70 text-[8px] font-bold tracking-wider uppercase">
                    Pop:
                  </span>
                  <strong className="text-foreground text-xs font-bold tracking-tight group-hover:underline">
                    {formattedPop}
                  </strong>
                </motion.button>

                <div className="flex items-center gap-1.5 text-xs">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-muted-foreground/70 text-[8px] font-bold tracking-wider uppercase">
                    GDP:
                  </span>
                  <strong className="text-xs font-bold tracking-tight text-emerald-400">
                    ${formatCompact(totalGdp)}
                  </strong>
                </div>
              </div>

              {/* Row 2: Executive Governance Telemetry (Approval, Stability, Capacity) */}
              <div className="grid grid-cols-3 gap-1 pt-0.5">
                <div className="flex min-w-0 items-center gap-1.5 px-0.5 text-xs">
                  <Heart className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-muted-foreground/70 text-[8px] leading-none font-bold tracking-wider uppercase">
                      Approval
                    </span>
                    <span className="text-foreground truncate text-xs leading-tight font-bold">
                      {approvalPct}%
                    </span>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-1.5 border-l border-white/10 px-1 text-xs">
                  <Scale className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-muted-foreground/70 text-[8px] leading-none font-bold tracking-wider uppercase">
                      Stability
                    </span>
                    <span className="text-foreground truncate text-xs leading-tight font-bold">
                      {stabilityPct}%
                    </span>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-1.5 border-l border-white/10 px-1 text-xs">
                  <Zap className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-muted-foreground/70 text-[8px] leading-none font-bold tracking-wider uppercase">
                      Capacity
                    </span>
                    <span className="text-foreground truncate text-xs leading-tight font-bold">
                      {capacityPct}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4 Vitality Rings Grid */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            {rings.map((ring: any) => (
              <motion.button
                key={ring.id}
                type="button"
                whileHover={{
                  scale: 1.02,
                  transition: { type: "spring", stiffness: 400, damping: 25 },
                }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsBreakdownOpen(true)}
                className="group/ring flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left backdrop-blur-md transition-all duration-150 hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.97]"
              >
                <HealthRing value={ring.value} size={34} color={ring.color} label={ring.label} />
                <div className="min-w-0 flex-1">
                  <span className="text-muted-foreground/70 group-hover/ring:text-foreground block truncate text-[8px] font-bold tracking-wider uppercase transition-colors">
                    {ring.label}
                  </span>
                  <span className="text-foreground text-xs font-bold" style={{ color: ring.color }}>
                    {ring.value}
                    <span className="text-muted-foreground/60 text-[8px] font-normal">/100</span>
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </FacetCard>

      <VitalityBreakdownModal
        isOpen={isBreakdownOpen}
        onClose={() => setIsBreakdownOpen(false)}
        rings={rings}
        countryName={country?.name}
      />
    </>
  );
}

export const StandingBands = React.memo(StandingBandsComponent);

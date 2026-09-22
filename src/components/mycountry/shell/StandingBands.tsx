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
import { VitalityBreakdownModal } from "~/components/ui/modals/VitalityBreakdownModal";
import {
  useCountryData,
  createVitalityRingsFromCountry,
  type VitalityRing,
} from "~/components/mycountry/shared/primitives";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { api } from "~/trpc/react";
import { soundEffects } from "~/lib/sound/cuelume";
import { formatCompact } from "~/lib/format/compact";

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
  const { country } = useCountryData();
  const [showExactPop, setShowExactPop] = useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  // Live Intent Capacity Query for CivCap throughput
  const intentStatus = api.intent.getStatus.useQuery(
    { countryId },
    { enabled: !!countryId, refetchInterval: 20_000 }
  );

  // 1. Live Public Approval Rating
  const approvalPct = useMemo(() => {
    const raw =
      country?.currentPublicApproval ??
      country?.approvalRating ??
      68;
    return Math.round(raw > 1 ? raw : raw * 100);
  }, [country?.currentPublicApproval, country?.approvalRating]);

  // 2. Live Political Stability
  const stabilityPct = useMemo(() => {
    const raw = country?.currentStability ?? country?.stability ?? 0.78;
    return Math.round(raw > 1 ? raw : raw * 100);
  }, [country?.currentStability, country?.stability]);

  // 3. Live Statecraft Civil Capacity Throughput
  const usedSlots = intentStatus.data?.usedThisWeek ?? 0;
  const slotCap = intentStatus.data?.cap ?? 3;
  const capacityPct = useMemo(() => {
    return Math.round(Math.max(10, Math.min(100, ((slotCap - usedSlots) / slotCap) * 100)));
  }, [usedSlots, slotCap]);

  const rings = useMemo<VitalityRing[]>(() => {
    if (!country) return [];
    return createVitalityRingsFromCountry(country);
  }, [country]);

  const compositeScore = useMemo(() => {
    return rings.length > 0
      ? Math.round(rings.reduce((sum: number, r: VitalityRing) => sum + r.value, 0) / rings.length)
      : 0;
  }, [rings]);

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

  const flagUrl = country?.flagUrl || country?.flag;

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
        className="group/card border-border/60 bg-card/60 relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-3.5 shadow-sm backdrop-blur-md transition-all duration-300"
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
              <span className="text-muted-foreground/70 text-[8px] font-bold tracking-wider uppercase">
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
              className="border-border/80 bg-muted/50 hover:bg-muted text-foreground group flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-2xs backdrop-blur-md transition-all active:scale-95"
              title="Click for full Vitality Breakdown"
            >
              <Activity className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 transition-colors" />
              <span className="font-semibold">{ratingLabelText}</span>
              <span className="text-muted-foreground font-mono text-[9px]">
                ({compositeScore})
              </span>
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
                  <span className="text-muted-foreground/70 text-[8px] font-bold tracking-wider uppercase">
                    Pop:
                  </span>
                  <strong className="text-foreground text-xs font-bold tracking-tight tabular-nums group-hover:underline">
                    {formattedPop}
                  </strong>
                </motion.button>

                <div className="flex items-center gap-1.5 text-xs">
                  <DollarSign className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-muted-foreground/70 text-[8px] font-bold tracking-wider uppercase">
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
                    <span className="text-muted-foreground/70 text-[8px] leading-none font-bold tracking-wider uppercase">
                      Approval
                    </span>
                    <span className="text-foreground truncate text-xs leading-tight font-bold tabular-nums">
                      {approvalPct}%
                    </span>
                  </div>
                </div>

                <div className="border-border/40 flex min-w-0 items-center gap-1.5 border-l px-1 text-xs">
                  <Scale className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-muted-foreground/70 text-[8px] leading-none font-bold tracking-wider uppercase">
                      Stability
                    </span>
                    <span className="text-foreground truncate text-xs leading-tight font-bold tabular-nums">
                      {stabilityPct}%
                    </span>
                  </div>
                </div>

                <div
                  className="border-border/40 flex min-w-0 items-center gap-1.5 border-l px-1 text-xs"
                  title={`${usedSlots} of ${slotCap} weekly Directive slots utilized (${capacityPct}% throughput remaining)`}
                >
                  <Zap className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-muted-foreground/70 text-[8px] leading-none font-bold tracking-wider uppercase">
                      Directives
                    </span>
                    <span className="text-foreground truncate font-mono text-xs leading-tight font-bold tabular-nums">
                      {usedSlots}/{slotCap}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4 Vitality Rings Grid */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            {rings.map((ring) => (
              <motion.button
                key={ring.id}
                type="button"
                whileHover={{
                  scale: 1.02,
                  transition: { type: "spring", stiffness: 400, damping: 25 },
                }}
                whileTap={{ scale: 0.96 }}
                onClick={handleOpenBreakdown}
                className="group/ring border-border/50 bg-card/40 hover:border-border/80 hover:bg-card/70 flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-left backdrop-blur-md transition-all duration-150 active:scale-[0.97]"
              >
                <HealthRing value={ring.value} size={34} color={ring.color} label={ring.label} />
                <div className="min-w-0 flex-1">
                  <span className="text-muted-foreground/70 group-hover/ring:text-foreground block truncate text-[8px] font-bold tracking-wider uppercase transition-colors">
                    {ring.label}
                  </span>
                  <span
                    className="text-foreground text-xs font-bold tabular-nums"
                    style={{ color: ring.color }}
                  >
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

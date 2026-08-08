"use client";

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Activity, Users, DollarSign } from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { HealthRing } from "~/components/ui/health-ring";
import { VitalityBreakdownModal } from "~/components/modals/VitalityBreakdownModal";
import { useCountryData, createVitalityRingsFromCountry } from "../primitives";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

function formatCompact(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return (num ?? 0).toLocaleString();
}

/** National Standing rail card — population/GDP telemetry + 4 vitality rings. */
export function StandingBands({ countryId }: { countryId: string }) {
  const { country } = useCountryData();
  const [showExactPop, setShowExactPop] = useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  const { data: _data } = api.mycountry.getCountryDashboard.useQuery(
    { countryId },
    { enabled: !!countryId, refetchInterval: 15_000 }
  );

  const rings = useMemo(() => {
    if (!country) return [];
    return createVitalityRingsFromCountry(country);
  }, [country]);

  const compositeScore = rings.length > 0
    ? Math.round(rings.reduce((sum, r) => sum + r.value, 0) / rings.length)
    : 0;

  const ratingLabel = (score: number) => {
    if (score >= 85) return "Optimal";
    if (score >= 70) return "Strong";
    if (score >= 50) return "Moderate";
    return "Strained";
  };

  const population = country?.currentPopulation ?? country?.population ?? (country as any)?.populationTotal ?? 0;
  const totalGdp =
    country?.currentTotalGdp ??
    country?.gdp ??
    (population && country?.currentGdpPerCapita
      ? population * country.currentGdpPerCapita
      : 0);

  const formattedPop = showExactPop
    ? Math.round(population).toLocaleString()
    : formatCompact(population);

  const flagUrl = (country as any)?.flagUrl || country?.flag;

  return (
    <>
      <FacetCard
        depth={1}
        className="group/card relative flex flex-col gap-3.5 p-4 backdrop-blur-xl bg-card/40 dark:bg-card/30 border border-border/70 dark:border-white/10 shadow-lg dark:shadow-2xl overflow-hidden transition-all duration-300"
      >
        {/* Cinematic Background Flag Watermark Scrim */}
        {flagUrl && (
          <div className="pointer-events-none absolute -top-10 -right-10 h-56 w-56 overflow-hidden select-none opacity-[0.14] dark:opacity-[0.20] transition-all duration-700 group-hover/card:opacity-[0.28] group-hover/card:scale-105">
            <img
              src={flagUrl}
              alt=""
              className="h-full w-full object-cover object-center filter blur-[1px] rounded-full mix-blend-luminosity dark:mix-blend-normal"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-card/75 to-card" />
          </div>
        )}

        <div className="relative z-10 flex flex-col gap-3.5">
          {/* Header Row: Title & Vitality Pill */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-extrabold tracking-widest text-muted-foreground/70 uppercase">
                National Standing
              </span>
              {country?.name && (
                <div className="flex items-center gap-2 mt-1 min-w-0">
                  <div className="relative flex shrink-0 items-center justify-center rounded-lg border border-white/30 dark:border-white/15 bg-card/80 p-0.5 shadow-xs overflow-hidden transition-transform group-hover/card:scale-105">
                    <UnifiedCountryFlag
                      countryName={country.name}
                      flagUrl={flagUrl}
                      size="md"
                      className="rounded-md object-cover"
                    />
                  </div>
                  <h3 className="text-base font-black tracking-tight text-foreground truncate">
                    {country.name}
                  </h3>
                </div>
              )}
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.03, transition: { type: "spring", stiffness: 450, damping: 25 } }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsBreakdownOpen(true)}
              className="group flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 dark:bg-cyan-500/15 px-3 py-1 text-xs font-extrabold text-cyan-900 dark:text-cyan-300 transition-all hover:bg-cyan-500/20 active:scale-95 cursor-pointer shadow-xs shrink-0"
              title="Click for full Vitality Breakdown"
            >
              <Activity className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>{compositeScore}/100</span>
              <span className="text-[10px] font-mono font-semibold text-cyan-700/80 dark:text-cyan-300/80 uppercase">
                ({ratingLabel(compositeScore)})
              </span>
            </motion.button>
          </div>

          {/* Telemetry Strip: Population & GDP */}
          {country && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 dark:border-white/10 bg-card/60 dark:bg-white/[0.03] p-2.5 backdrop-blur-md shadow-2xs">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowExactPop((prev) => !prev)}
                className="group flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                title="Click to toggle exact population count"
              >
                <Users className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-muted-foreground text-[10px] font-extrabold uppercase tracking-wider">Pop:</span>
                <strong className="text-foreground text-xs sm:text-sm font-black group-hover:underline">
                  {formattedPop}
                </strong>
              </motion.button>

              <div className="flex items-center gap-1.5 text-xs">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                <span className="text-muted-foreground text-[10px] font-extrabold uppercase tracking-wider">GDP:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-black">${formatCompact(totalGdp)}</strong>
              </div>
            </div>
          )}

          {/* 4 Vitality Rings Grid */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {rings.map((ring) => (
              <motion.button
                key={ring.id}
                type="button"
                whileHover={{ scale: 1.025, transition: { type: "spring", stiffness: 450, damping: 25 } }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsBreakdownOpen(true)}
                className="group/ring flex items-center gap-2.5 rounded-2xl border border-border/60 dark:border-white/10 bg-card/60 dark:bg-white/[0.03] hover:bg-card/90 dark:hover:bg-white/[0.08] p-2.5 text-left transition-all hover:border-amber-500/40 hover:shadow-md cursor-pointer"
              >
                <HealthRing
                  value={ring.value}
                  size={38}
                  color={ring.color}
                  label={ring.label}
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[9px] font-extrabold tracking-wider text-muted-foreground/70 uppercase group-hover/ring:text-foreground transition-colors">
                    {ring.label}
                  </span>
                  <span className="text-xs font-black text-foreground" style={{ color: ring.color }}>
                    {ring.value}<span className="text-[9px] text-muted-foreground/60 font-normal">/100</span>
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

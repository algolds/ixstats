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

  const compositeScore =
    rings.length > 0 ? Math.round(rings.reduce((sum, r) => sum + r.value, 0) / rings.length) : 0;

  const ratingLabel = (score: number) => {
    if (score >= 85) return "Optimal";
    if (score >= 70) return "Strong";
    if (score >= 50) return "Moderate";
    return "Strained";
  };

  const population =
    country?.currentPopulation ?? country?.population ?? (country as any)?.populationTotal ?? 0;
  const totalGdp =
    country?.currentTotalGdp ??
    country?.gdp ??
    (population && country?.currentGdpPerCapita ? population * country.currentGdpPerCapita : 0);

  const formattedPop = showExactPop
    ? Math.round(population).toLocaleString()
    : formatCompact(population);

  const flagUrl = (country as any)?.flagUrl || country?.flag;

  return (
    <>
      <FacetCard
        depth={1}
        className="group/card bg-card/40 dark:bg-card/30 border-border/70 relative flex flex-col gap-3.5 overflow-hidden border p-4 shadow-lg backdrop-blur-xl transition-all duration-300 dark:border-white/10 dark:shadow-2xl"
      >
        {/* Cinematic Background Flag Watermark Scrim */}
        {flagUrl && (
          <div className="pointer-events-none absolute -top-10 -right-10 h-56 w-56 overflow-hidden opacity-[0.14] transition-all duration-700 select-none group-hover/card:scale-105 group-hover/card:opacity-[0.28] dark:opacity-[0.20]">
            <img
              src={flagUrl}
              alt=""
              className="h-full w-full rounded-full object-cover object-center mix-blend-luminosity blur-[1px] filter dark:mix-blend-normal"
            />
            <div className="via-card/75 to-card absolute inset-0 bg-gradient-to-l from-transparent" />
          </div>
        )}

        <div className="relative z-10 flex flex-col gap-3.5">
          {/* Header Row: Title & Vitality Pill */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className="text-muted-foreground/70 text-[9px] font-extrabold tracking-widest uppercase">
                National Standing
              </span>
              {country?.name && (
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <div className="bg-card/80 relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/30 p-0.5 shadow-xs transition-transform group-hover/card:scale-105 dark:border-white/15">
                    <UnifiedCountryFlag
                      countryName={country.name}
                      flagUrl={flagUrl}
                      size="md"
                      className="rounded-md object-cover"
                    />
                  </div>
                  <h3 className="text-foreground truncate text-base font-black tracking-tight">
                    {country.name}
                  </h3>
                </div>
              )}
            </div>

            <motion.button
              type="button"
              whileHover={{
                scale: 1.03,
                transition: { type: "spring", stiffness: 450, damping: 25 },
              }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsBreakdownOpen(true)}
              className="group flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-extrabold text-cyan-900 shadow-xs transition-all hover:bg-cyan-500/20 active:scale-95 dark:bg-cyan-500/15 dark:text-cyan-300"
              title="Click for full Vitality Breakdown"
            >
              <Activity className="h-3.5 w-3.5 text-cyan-600 transition-transform group-hover:scale-110 dark:text-cyan-400" />
              <span>{compositeScore}/100</span>
              <span className="font-mono text-[10px] font-semibold text-cyan-700/80 uppercase dark:text-cyan-300/80">
                ({ratingLabel(compositeScore)})
              </span>
            </motion.button>
          </div>

          {/* Telemetry Strip: Population & GDP */}
          {country && (
            <div className="border-border/60 bg-card/60 flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-2.5 shadow-2xs backdrop-blur-md dark:border-white/10 dark:bg-white/[0.03]">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowExactPop((prev) => !prev)}
                className="group flex cursor-pointer items-center gap-1.5 text-xs transition-colors"
                title="Click to toggle exact population count"
              >
                <Users className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 transition-colors" />
                <span className="text-muted-foreground text-[10px] font-extrabold tracking-wider uppercase">
                  Pop:
                </span>
                <strong className="text-foreground text-xs font-black group-hover:underline sm:text-sm">
                  {formattedPop}
                </strong>
              </motion.button>

              <div className="flex items-center gap-1.5 text-xs">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                <span className="text-muted-foreground text-[10px] font-extrabold tracking-wider uppercase">
                  GDP:
                </span>
                <strong className="text-xs font-black text-emerald-600 sm:text-sm dark:text-emerald-400">
                  ${formatCompact(totalGdp)}
                </strong>
              </div>
            </div>
          )}

          {/* 4 Vitality Rings Grid */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {rings.map((ring) => (
              <motion.button
                key={ring.id}
                type="button"
                whileHover={{
                  scale: 1.025,
                  transition: { type: "spring", stiffness: 450, damping: 25 },
                }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsBreakdownOpen(true)}
                className="group/ring border-border/60 bg-card/60 hover:bg-card/90 flex cursor-pointer items-center gap-2.5 rounded-2xl border p-2.5 text-left transition-all hover:border-amber-500/40 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.08]"
              >
                <HealthRing value={ring.value} size={38} color={ring.color} label={ring.label} />
                <div className="min-w-0 flex-1">
                  <span className="text-muted-foreground/70 group-hover/ring:text-foreground block truncate text-[9px] font-extrabold tracking-wider uppercase transition-colors">
                    {ring.label}
                  </span>
                  <span
                    className="text-foreground text-xs font-black"
                    style={{ color: ring.color }}
                  >
                    {ring.value}
                    <span className="text-muted-foreground/60 text-[9px] font-normal">/100</span>
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

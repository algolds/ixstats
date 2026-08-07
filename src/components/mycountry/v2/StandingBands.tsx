"use client";

import { useState, useMemo } from "react";
import { Activity } from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { HealthRing } from "~/components/ui/health-ring";
import { VitalityBreakdownModal } from "~/components/modals/VitalityBreakdownModal";
import { useCountryData, createVitalityRingsFromCountry } from "../primitives";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { api } from "~/trpc/react";

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

  return (
    <>
      <FacetCard depth={1} className="group/card bg-card/30 relative flex flex-col gap-3 p-4 backdrop-blur-md overflow-hidden">
        {/* Country Flag Background Watermark Overlay */}
        {country?.flag && (
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.08] filter blur-[2px] transition-all duration-500 group-hover/card:opacity-[0.14] group-hover/card:scale-105"
            style={{ backgroundImage: `url(${country.flag})` }}
          />
        )}

        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-extrabold tracking-widest text-muted-foreground/70 uppercase">
                National Standing
              </span>
              {country?.name && (
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  <UnifiedCountryFlag
                    countryName={country.name}
                    flagUrl={(country as any)?.flagUrl || country.flag}
                    size="md"
                    className="shrink-0 shadow-2xs border border-border/40"
                  />
                  <h3 className="text-sm sm:text-base font-black tracking-tight text-foreground truncate">
                    {country.name}
                  </h3>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsBreakdownOpen(true)}
              className="group flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-bold text-primary transition-all hover:bg-primary/20 hover:scale-105 active:scale-95 cursor-pointer shadow-sm shrink-0"
              title="Click for full Vitality Breakdown"
            >
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span>{compositeScore}/100</span>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                ({ratingLabel(compositeScore)})
              </span>
            </button>
          </div>

          {country && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-xs sm:text-sm font-extrabold tracking-wide">
              <button
                type="button"
                onClick={() => setShowExactPop((prev) => !prev)}
                className="hover:text-foreground group flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Click to toggle exact population count"
              >
                <span className="text-muted-foreground text-xs font-bold uppercase">Population:</span>
                <strong className="text-foreground text-sm sm:text-base font-black group-hover:underline">
                  {formattedPop}
                </strong>
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-xs font-bold uppercase">GDP:</span>
                <strong className="text-emerald-400 text-sm sm:text-base font-black">${formatCompact(totalGdp)}</strong>
              </div>
            </div>
          )}

          {/* 4 Vitality Rings Grid */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {rings.map((ring) => (
              <button
                key={ring.id}
                type="button"
                onClick={() => setIsBreakdownOpen(true)}
                className="group/ring flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2 text-left transition-all hover:border-white/20 hover:bg-white/[0.06] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <HealthRing
                  value={ring.value}
                  size={38}
                  color={ring.color}
                  label={ring.label}
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[9px] font-bold tracking-wider text-muted-foreground/70 uppercase group-hover/ring:text-foreground">
                    {ring.label}
                  </span>
                  <span className="text-xs font-extrabold text-foreground" style={{ color: ring.color }}>
                    {ring.value}<span className="text-[9px] text-muted-foreground/60 font-normal">/100</span>
                  </span>
                </div>
              </button>
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

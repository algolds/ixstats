"use client";

import { NavArrowDown, Check, Globe, Group, MapPin, StatsReport, Trophy } from "iconoir-react";

import React, { useMemo } from "react";
import { motion } from "motion/react";
import { type CountryCardData } from "~/components/mycountry/dossier/CountryFocusCard";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Eyebrow } from "~/components/ui/eyebrow";
import { cn } from "~/lib/utils";

interface CountriesStatsProps {
  countries: CountryCardData[];
  allCountries: CountryCardData[];
  searchQuery: string;
  filterBy: string;
  continentFilter: string | null;
  onContinentFilter: (continent: string | null) => void;
  onCountryClick: (countryId: string, countryName: string) => void;
}

export const CountriesStats: React.FC<CountriesStatsProps> = ({
  countries,
  allCountries,
  searchQuery,
  filterBy,
  continentFilter,
  onContinentFilter,
  onCountryClick,
}) => {
  const { totalCountries, totalPopulation, totalGDP, avgGDPPerCapita } = useMemo(() => {
    const totalCount = countries.length;
    const pop = countries.reduce((sum, c) => sum + c.currentPopulation, 0);
    const gdp = countries.reduce((sum, c) => sum + c.currentTotalGdp, 0);
    const avgCapita =
      totalCount > 0
        ? countries.reduce((sum, c) => sum + c.currentGdpPerCapita, 0) / totalCount
        : 0;
    return {
      totalCountries: totalCount,
      totalPopulation: pop,
      totalGDP: gdp,
      avgGDPPerCapita: avgCapita,
    };
  }, [countries]);

  // Continent counts from the full (unfiltered) list
  const continentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of allCountries) {
      const continent = c.continent || "Unknown";
      counts.set(continent, (counts.get(continent) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [allCountries]);

  // Top 5 by population
  const topByPopulation = useMemo(
    () => [...countries].sort((a, b) => b.currentPopulation - a.currentPopulation).slice(0, 5),
    [countries]
  );

  // Top 5 by GDP
  const topByGDP = useMemo(
    () => [...countries].sort((a, b) => b.currentTotalGdp - a.currentTotalGdp).slice(0, 5),
    [countries]
  );

  // Top 5 by GDP per capita
  const topByGDPPerCapita = useMemo(
    () => [...countries].sort((a, b) => b.currentGdpPerCapita - a.currentGdpPerCapita).slice(0, 5),
    [countries]
  );

  const formatShort = (n: number) => {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(1)} trillion`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)} billion`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)} million`;
    return `$${n.toLocaleString()}`;
  };

  const formatPop = (n: number) => {
    if (n >= 1e12) return `${(n / 1e12).toFixed(1)} trillion`;
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)} billion`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)} million`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)} thousand`;
    return n.toLocaleString();
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Countries — continent filter */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0, duration: 0.2 }}
      >
        <Popover>
          <PopoverTrigger
            data-cuelume-press="tick"
            className={cn(
              "border-border bg-card hover:bg-accent focus-visible:ring-ring w-full cursor-pointer rounded-xl border p-4 text-left transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]",
              continentFilter && "border-blue-500/50"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe aria-hidden="true" className="text-muted-foreground h-5 w-5 shrink-0" />
                <div>
                  <Eyebrow className="block">{continentFilter || "Countries"}</Eyebrow>
                  <p className="text-foreground text-lg font-semibold tabular-nums">
                    {totalCountries.toLocaleString()}
                  </p>
                </div>
              </div>
              <NavArrowDown className="text-muted-foreground h-4 w-4" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0">
            <div className="p-3">
              <Eyebrow className="mb-2 block">Filter by Continent</Eyebrow>
              <button
                onClick={() => onContinentFilter(null)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  !continentFilter
                    ? "bg-accent text-foreground font-medium"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span>All Continents</span>
                {!continentFilter && <Check className="h-3.5 w-3.5" />}
              </button>
              <div className="border-border my-1.5 border-t" />
              <div className="max-h-48 space-y-0.5 overflow-y-auto">
                {continentCounts.map(([continent, count]) => (
                  <button
                    key={continent}
                    onClick={() =>
                      onContinentFilter(continentFilter === continent ? null : continent)
                    }
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      continentFilter === continent
                        ? "bg-accent text-foreground font-medium"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin aria-hidden="true" className="text-muted-foreground h-3 w-3" />
                      <span>{continent}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </motion.div>

      {/* Total Population — top 5 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.2 }}
      >
        <Popover>
          <PopoverTrigger
            data-cuelume-press="tick"
            className="border-border bg-card hover:bg-accent focus-visible:ring-ring w-full cursor-pointer rounded-xl border p-4 text-left transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Group aria-hidden="true" className="text-muted-foreground h-5 w-5 shrink-0" />
                <div>
                  <Eyebrow className="block">Total Population</Eyebrow>
                  <p className="text-foreground text-lg font-semibold tabular-nums">
                    {formatPop(totalPopulation)}
                  </p>
                </div>
              </div>
              <NavArrowDown className="text-muted-foreground h-4 w-4" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0">
            <div className="p-3">
              <p className="text-foreground mb-0.5 text-sm font-semibold">Total Population</p>
              <p className="text-muted-foreground mb-3 text-lg font-semibold tabular-nums">
                {Math.round(totalPopulation).toLocaleString()}
              </p>
              <Eyebrow className="mb-2 block">Top 5 by Population</Eyebrow>
              <div className="space-y-1">
                {topByPopulation.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => onCountryClick(c.id, c.name)}
                    data-cuelume-press="tick"
                    className="text-foreground hover:bg-muted flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors active:scale-[0.99]"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground w-4 text-xs">{i + 1}.</span>
                      <span className="font-medium">{c.name}</span>
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {Math.round(c.currentPopulation).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </motion.div>

      {/* Combined GDP — top 5 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.2 }}
      >
        <Popover>
          <PopoverTrigger
            data-cuelume-press="tick"
            className="border-border bg-card hover:bg-accent focus-visible:ring-ring w-full cursor-pointer rounded-xl border p-4 text-left transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatsReport
                  aria-hidden="true"
                  className="text-muted-foreground h-5 w-5 shrink-0"
                />
                <div>
                  <Eyebrow className="block">Combined GDP</Eyebrow>
                  <p className="text-foreground text-lg font-semibold tabular-nums">
                    {formatShort(totalGDP)}
                  </p>
                </div>
              </div>
              <NavArrowDown className="text-muted-foreground h-4 w-4" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0">
            <div className="p-3">
              <p className="text-foreground mb-0.5 text-sm font-semibold">Combined GDP</p>
              <p className="text-muted-foreground mb-3 text-lg font-semibold tabular-nums">
                ${Math.round(totalGDP).toLocaleString()}
              </p>
              <Eyebrow className="mb-2 block">Top 5 by Total GDP</Eyebrow>
              <div className="space-y-1">
                {topByGDP.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => onCountryClick(c.id, c.name)}
                    data-cuelume-press="tick"
                    className="text-foreground hover:bg-muted flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors active:scale-[0.99]"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground w-4 text-xs">{i + 1}.</span>
                      <span className="font-medium">{c.name}</span>
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      ${Math.round(c.currentTotalGdp).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </motion.div>

      {/* Avg GDP per Capita — top 5 highest */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.2 }}
      >
        <Popover>
          <PopoverTrigger
            data-cuelume-press="tick"
            className="border-border bg-card hover:bg-accent focus-visible:ring-ring w-full cursor-pointer rounded-xl border p-4 text-left transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy aria-hidden="true" className="text-muted-foreground h-5 w-5 shrink-0" />
                <div>
                  <Eyebrow className="block">Avg GDP/Capita</Eyebrow>
                  <p className="text-foreground text-lg font-semibold tabular-nums">
                    {formatShort(avgGDPPerCapita)}
                  </p>
                </div>
              </div>
              <NavArrowDown className="text-muted-foreground h-4 w-4" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0">
            <div className="p-3">
              <p className="text-foreground mb-0.5 text-sm font-semibold">Avg GDP per Capita</p>
              <p className="text-muted-foreground mb-3 text-lg font-semibold tabular-nums">
                ${Math.round(avgGDPPerCapita).toLocaleString()}
              </p>
              <Eyebrow className="mb-2 block">Top 5 Highest</Eyebrow>
              <div className="space-y-1">
                {topByGDPPerCapita.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => onCountryClick(c.id, c.name)}
                    className="text-foreground hover:bg-muted flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground w-4 text-xs">{i + 1}.</span>
                      <span className="font-medium">{c.name}</span>
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      ${Math.round(c.currentGdpPerCapita).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </motion.div>
    </div>
  );
};

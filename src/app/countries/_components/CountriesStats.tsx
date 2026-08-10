"use client";

import React, { useMemo } from "react";
import { motion } from "motion/react";
import { type CountryCardData } from "~/components/countries/CountryFocusCard";
import {
  RiGlobalLine,
  RiGroupLine,
  RiBarChartLine,
  RiTrophyLine,
  RiArrowDownSLine,
  RiCheckLine,
  RiMapPinLine,
} from "react-icons/ri";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
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
    if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    return `$${n.toLocaleString()}`;
  };

  const formatPop = (n: number) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Countries — continent filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0, duration: 0.4 }}
      >
        <Popover>
          <PopoverTrigger
            className={cn(
              "glass-surface glass-interactive w-full cursor-pointer rounded-lg p-4 text-left transition-all",
              continentFilter && "ring-1 ring-blue-400/40"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <RiGlobalLine className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">{continentFilter || "Countries"}</p>
                  <p className="text-foreground text-lg font-semibold">
                    {totalCountries.toLocaleString()}
                  </p>
                </div>
              </div>
              <RiArrowDownSLine className="text-muted-foreground h-4 w-4" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="!glass-none bg-popover border-border w-64 rounded-xl border p-0 shadow-xl">
            <div className="p-3">
              <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
                Filter by Continent
              </p>
              <button
                onClick={() => onContinentFilter(null)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  !continentFilter
                    ? "bg-blue-500/15 font-medium text-blue-400"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span>All Continents</span>
                {!continentFilter && <RiCheckLine className="h-3.5 w-3.5" />}
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
                        ? "bg-blue-500/15 font-medium text-blue-400"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <RiMapPinLine className="h-3 w-3 text-blue-400/60" />
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <Popover>
          <PopoverTrigger className="glass-surface glass-interactive w-full cursor-pointer rounded-lg p-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <RiGroupLine className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Total Population</p>
                  <p className="text-foreground text-lg font-semibold">
                    {formatPop(totalPopulation)}
                  </p>
                </div>
              </div>
              <RiArrowDownSLine className="text-muted-foreground h-4 w-4" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="!glass-none bg-popover border-border w-72 rounded-xl border p-0 shadow-xl">
            <div className="p-3">
              <p className="text-foreground mb-0.5 text-sm font-semibold">Total Population</p>
              <p className="text-muted-foreground mb-3 text-lg font-bold tabular-nums">
                {Math.round(totalPopulation).toLocaleString()}
              </p>
              <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
                Top 5 by Population
              </p>
              <div className="space-y-1">
                {topByPopulation.map((c, i) => (
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <Popover>
          <PopoverTrigger className="glass-surface glass-interactive w-full cursor-pointer rounded-lg p-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-500/10 p-2">
                  <RiBarChartLine className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Combined GDP</p>
                  <p className="text-foreground text-lg font-semibold">{formatShort(totalGDP)}</p>
                </div>
              </div>
              <RiArrowDownSLine className="text-muted-foreground h-4 w-4" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="!glass-none bg-popover border-border w-72 rounded-xl border p-0 shadow-xl">
            <div className="p-3">
              <p className="text-foreground mb-0.5 text-sm font-semibold">Combined GDP</p>
              <p className="text-muted-foreground mb-3 text-lg font-bold tabular-nums">
                ${Math.round(totalGDP).toLocaleString()}
              </p>
              <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
                Top 5 by Total GDP
              </p>
              <div className="space-y-1">
                {topByGDP.map((c, i) => (
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Popover>
          <PopoverTrigger className="glass-surface glass-interactive w-full cursor-pointer rounded-lg p-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-orange-500/10 p-2">
                  <RiTrophyLine className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Avg GDP/Capita</p>
                  <p className="text-foreground text-lg font-semibold">
                    {formatShort(avgGDPPerCapita)}
                  </p>
                </div>
              </div>
              <RiArrowDownSLine className="text-muted-foreground h-4 w-4" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="!glass-none bg-popover border-border w-72 rounded-xl border p-0 shadow-xl">
            <div className="p-3">
              <p className="text-foreground mb-0.5 text-sm font-semibold">Avg GDP per Capita</p>
              <p className="text-muted-foreground mb-3 text-lg font-bold tabular-nums">
                ${Math.round(avgGDPPerCapita).toLocaleString()}
              </p>
              <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
                Top 5 Highest
              </p>
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

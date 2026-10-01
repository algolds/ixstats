"use client";

import { NavArrowDown, Globe, Group, MapPin, StatsReport, Trophy } from "iconoir-react";

import React, { useMemo } from "react";
import { motion } from "motion/react";
import { type CountryCardData } from "~/components/mycountry/dossier/CountryFocusCard";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Eyebrow } from "~/components/ui/eyebrow";
import { cn } from "~/lib/utils";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { tweenFast } from "~/lib/design/motion";

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
        transition={{ ...tweenFast, delay: 0 }}
      >
        <Popover>
          <PopoverTrigger
            className={cn(
              "border-separator bg-surface hover:bg-fill-3 focus-visible:ring-tint rounded-row w-full cursor-pointer border p-4 text-left transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]",
              continentFilter && "border-tint/50"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe aria-hidden="true" className="text-label-secondary h-5 w-5 shrink-0" />
                <div>
                  <Eyebrow className="block">{continentFilter || "Countries"}</Eyebrow>
                  <p className="text-label text-title-3 tabular-nums">
                    {totalCountries.toLocaleString()}
                  </p>
                </div>
              </div>
              <NavArrowDown className="text-label-secondary h-4 w-4" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0">
            <div className="p-3">
              <Eyebrow className="mb-2 block">Filter by Continent</Eyebrow>
              <FacetList variant="plain">
                <FacetListSection aria-label="Continents">
                  <FacetRow
                    title="All Continents"
                    accessory="check"
                    selected={!continentFilter}
                    onClick={() => onContinentFilter(null)}
                  />
                </FacetListSection>
                <FacetListSection
                  aria-label="Filter by continent"
                  groupClassName="max-h-48 overflow-y-auto"
                >
                  {continentCounts.map(([continent, count]) => (
                    <FacetRow
                      key={continent}
                      leading={<MapPin aria-hidden="true" className="size-3.5" />}
                      title={continent}
                      trailing={count}
                      accessory="check"
                      selected={continentFilter === continent}
                      onClick={() =>
                        onContinentFilter(continentFilter === continent ? null : continent)
                      }
                    />
                  ))}
                </FacetListSection>
              </FacetList>
            </div>
          </PopoverContent>
        </Popover>
      </motion.div>

      {/* Total Population — top 5 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...tweenFast, delay: 0.05 }}
      >
        <Popover>
          <PopoverTrigger className="border-separator bg-surface hover:bg-fill-3 focus-visible:ring-tint rounded-row w-full cursor-pointer border p-4 text-left transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Group aria-hidden="true" className="text-label-secondary h-5 w-5 shrink-0" />
                <div>
                  <Eyebrow className="block">Total Population</Eyebrow>
                  <p className="text-label text-title-3 tabular-nums">
                    {formatPop(totalPopulation)}
                  </p>
                </div>
              </div>
              <NavArrowDown className="text-label-secondary h-4 w-4" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0">
            <div className="p-3">
              <p className="text-label text-headline mb-0.5">Total Population</p>
              <p className="text-label-secondary text-title-3 mb-3 tabular-nums">
                {Math.round(totalPopulation).toLocaleString()}
              </p>
              <Eyebrow className="mb-2 block">Top 5 by Population</Eyebrow>
              <FacetList variant="plain">
                <FacetListSection aria-label="Top five">
                  {topByPopulation.map((c, i) => (
                    <FacetRow
                      key={c.id}
                      onClick={() => onCountryClick(c.id, c.name)}
                      leading={
                        <span className="text-label-secondary text-footnote w-4 tabular-nums">
                          {i + 1}.
                        </span>
                      }
                      title={c.name}
                      trailing={
                        <span className="text-label-secondary text-footnote tabular-nums">
                          {Math.round(c.currentPopulation).toLocaleString()}
                        </span>
                      }
                    />
                  ))}
                </FacetListSection>
              </FacetList>
            </div>
          </PopoverContent>
        </Popover>
      </motion.div>

      {/* Combined GDP — top 5 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...tweenFast, delay: 0.1 }}
      >
        <Popover>
          <PopoverTrigger className="border-separator bg-surface hover:bg-fill-3 focus-visible:ring-tint rounded-row w-full cursor-pointer border p-4 text-left transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatsReport aria-hidden="true" className="text-label-secondary h-5 w-5 shrink-0" />
                <div>
                  <Eyebrow className="block">Combined GDP</Eyebrow>
                  <p className="text-label text-title-3 tabular-nums">{formatShort(totalGDP)}</p>
                </div>
              </div>
              <NavArrowDown className="text-label-secondary h-4 w-4" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0">
            <div className="p-3">
              <p className="text-label text-headline mb-0.5">Combined GDP</p>
              <p className="text-label-secondary text-title-3 mb-3 tabular-nums">
                ${Math.round(totalGDP).toLocaleString()}
              </p>
              <Eyebrow className="mb-2 block">Top 5 by Total GDP</Eyebrow>
              <FacetList variant="plain">
                <FacetListSection aria-label="Top five">
                  {topByGDP.map((c, i) => (
                    <FacetRow
                      key={c.id}
                      onClick={() => onCountryClick(c.id, c.name)}
                      leading={
                        <span className="text-label-secondary text-footnote w-4 tabular-nums">
                          {i + 1}.
                        </span>
                      }
                      title={c.name}
                      trailing={
                        <span className="text-label-secondary text-footnote tabular-nums">
                          ${Math.round(c.currentTotalGdp).toLocaleString()}
                        </span>
                      }
                    />
                  ))}
                </FacetListSection>
              </FacetList>
            </div>
          </PopoverContent>
        </Popover>
      </motion.div>

      {/* Avg GDP per Capita — top 5 highest */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...tweenFast, delay: 0.15 }}
      >
        <Popover>
          <PopoverTrigger className="border-separator bg-surface hover:bg-fill-3 focus-visible:ring-tint rounded-row w-full cursor-pointer border p-4 text-left transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy aria-hidden="true" className="text-label-secondary h-5 w-5 shrink-0" />
                <div>
                  <Eyebrow className="block">Avg GDP/Capita</Eyebrow>
                  <p className="text-label text-title-3 tabular-nums">
                    {formatShort(avgGDPPerCapita)}
                  </p>
                </div>
              </div>
              <NavArrowDown className="text-label-secondary h-4 w-4" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0">
            <div className="p-3">
              <p className="text-label text-headline mb-0.5">Avg GDP per Capita</p>
              <p className="text-label-secondary text-title-3 mb-3 tabular-nums">
                ${Math.round(avgGDPPerCapita).toLocaleString()}
              </p>
              <Eyebrow className="mb-2 block">Top 5 Highest</Eyebrow>
              <FacetList variant="plain">
                <FacetListSection aria-label="Top five">
                  {topByGDPPerCapita.map((c, i) => (
                    <FacetRow
                      key={c.id}
                      onClick={() => onCountryClick(c.id, c.name)}
                      leading={
                        <span className="text-label-secondary text-footnote w-4 tabular-nums">
                          {i + 1}.
                        </span>
                      }
                      title={c.name}
                      trailing={
                        <span className="text-label-secondary text-footnote tabular-nums">
                          ${Math.round(c.currentGdpPerCapita).toLocaleString()}
                        </span>
                      }
                    />
                  ))}
                </FacetListSection>
              </FacetList>
            </div>
          </PopoverContent>
        </Popover>
      </motion.div>
    </div>
  );
};

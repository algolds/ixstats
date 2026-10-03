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
  continentFilter: string | null;
  onContinentFilter: (continent: string | null) => void;
  onCountryClick: (countryId: string, countryName: string) => void;
}

const WORD_UNITS = [
  [1e12, "trillion"],
  [1e9, "billion"],
  [1e6, "million"],
  [1e3, "thousand"],
] as const;

/** "1.2 billion", or the plain number below the smallest unit used. */
function formatWords(n: number, prefix = "", smallestUnit = 1e6): string {
  const unit = WORD_UNITS.find(([size]) => n >= size && size >= smallestUnit);
  return unit
    ? `${prefix}${(n / unit[0]).toFixed(1)} ${unit[1]}`
    : `${prefix}${n.toLocaleString()}`;
}

const TILE_TRIGGER =
  "border-separator bg-surface hover:bg-fill-3 focus-visible:ring-tint rounded-row w-full cursor-pointer border p-4 text-left transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]";

function StatTile({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof Globe;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <PopoverTrigger className={cn(TILE_TRIGGER, className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon aria-hidden="true" className="text-label-secondary h-5 w-5 shrink-0" />
          <div>
            <span className="text-stat-label text-label-secondary block">{label}</span>
            <p className="text-label text-title-3 tabular-nums">{value}</p>
          </div>
        </div>
        <NavArrowDown className="text-label-secondary h-4 w-4" />
      </div>
    </PopoverTrigger>
  );
}

/** One tile (animated in with `delay`) whose popover is `children`. */
function TileWithPopover({
  delay,
  width,
  tile,
  children,
}: {
  delay: number;
  width: string;
  tile: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...tweenFast, delay }}
    >
      <Popover>
        {tile}
        <PopoverContent className={cn(width, "p-0")}>
          <div className="p-3">{children}</div>
        </PopoverContent>
      </Popover>
    </motion.div>
  );
}

type MetricKey = "currentPopulation" | "currentTotalGdp" | "currentGdpPerCapita";

/** The three headline figures: each lists its top five countries in a popover. */
const METRIC_TILES: {
  icon: typeof Globe;
  label: string;
  topLabel: string;
  field: MetricKey;
  /** The headline value, from the figure over the filtered countries. */
  short: (n: number) => string;
  /** The exact figure, as shown in the popover. */
  exact: (n: number) => string;
}[] = [
  {
    icon: Group,
    label: "Total population",
    topLabel: "Top 5 by population",
    field: "currentPopulation",
    short: (n) => formatWords(n, "", 1e3),
    exact: (n) => Math.round(n).toLocaleString(),
  },
  {
    icon: StatsReport,
    label: "Combined GDP",
    topLabel: "Top 5 by total GDP",
    field: "currentTotalGdp",
    short: (n) => formatWords(n, "$"),
    exact: (n) => `$${Math.round(n).toLocaleString()}`,
  },
  {
    icon: Trophy,
    label: "Avg GDP per capita",
    topLabel: "Top 5 highest",
    field: "currentGdpPerCapita",
    short: (n) => formatWords(n, "$"),
    exact: (n) => `$${Math.round(n).toLocaleString()}`,
  },
];

export const CountriesStats: React.FC<CountriesStatsProps> = ({
  countries,
  allCountries,
  continentFilter,
  onContinentFilter,
  onCountryClick,
}) => {
  const totals = useMemo(() => {
    const sum = (field: MetricKey) => countries.reduce((acc, c) => acc + c[field], 0);
    return {
      currentPopulation: sum("currentPopulation"),
      currentTotalGdp: sum("currentTotalGdp"),
      currentGdpPerCapita: countries.length > 0 ? sum("currentGdpPerCapita") / countries.length : 0,
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

  const topFive = (field: MetricKey) =>
    [...countries].sort((a, b) => b[field] - a[field]).slice(0, 5);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <TileWithPopover
        delay={0}
        width="w-64"
        tile={
          <StatTile
            icon={Globe}
            label={continentFilter || "Countries"}
            value={countries.length.toLocaleString()}
            className={continentFilter ? "border-tint/50" : undefined}
          />
        }
      >
        <Eyebrow className="mb-2 block">Filter by continent</Eyebrow>
        <FacetList variant="plain">
          <FacetListSection aria-label="Continents">
            <FacetRow
              title="All continents"
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
                onClick={() => onContinentFilter(continentFilter === continent ? null : continent)}
              />
            ))}
          </FacetListSection>
        </FacetList>
      </TileWithPopover>

      {METRIC_TILES.map(({ icon, label, topLabel, field, short, exact }, i) => (
        <TileWithPopover
          key={field}
          delay={0.05 * (i + 1)}
          width="w-72"
          tile={<StatTile icon={icon} label={label} value={short(totals[field])} />}
        >
          <p className="text-label text-headline mb-0.5">{label}</p>
          <p className="text-label-secondary text-title-3 mb-3 tabular-nums">
            {exact(totals[field])}
          </p>
          <Eyebrow className="mb-2 block">{topLabel}</Eyebrow>
          <FacetList variant="plain">
            <FacetListSection aria-label="Top five">
              {topFive(field).map((c, rank) => (
                <FacetRow
                  key={c.id}
                  onClick={() => onCountryClick(c.id, c.name)}
                  leading={
                    <span className="text-label-secondary text-footnote w-4 tabular-nums">
                      {rank + 1}.
                    </span>
                  }
                  title={c.name}
                  trailing={
                    <span className="text-label-secondary text-footnote tabular-nums">
                      {exact(c[field])}
                    </span>
                  }
                />
              ))}
            </FacetListSection>
          </FacetList>
        </TileWithPopover>
      ))}
    </div>
  );
};

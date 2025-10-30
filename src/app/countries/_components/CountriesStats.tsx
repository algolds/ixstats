"use client";

import React from "react";
import { motion } from "framer-motion";
import { type CountryCardData } from "~/components/countries/CountryFocusCard";
import { RiGlobalLine, RiGroupLine, RiBarChartLine, RiTrophyLine } from "react-icons/ri";

interface CountriesStatsProps {
  countries: CountryCardData[];
  searchQuery: string;
  filterBy: string;
}

export const CountriesStats: React.FC<CountriesStatsProps> = ({
  countries,
  searchQuery,
  filterBy,
}) => {
  // Calculate statistics
  const totalCountries = countries.length;
  const totalPopulation = countries.reduce((sum, country) => sum + country.currentPopulation, 0);
  const totalGDP = countries.reduce((sum, country) => sum + country.currentTotalGdp, 0);
  const avgGDPPerCapita =
    totalCountries > 0
      ? countries.reduce((sum, country) => sum + country.currentGdpPerCapita, 0) / totalCountries
      : 0;

  const formatPopulation = (pop: number) => {
    if (pop >= 1e9) return `${(pop / 1e9).toFixed(1)}B`;
    if (pop >= 1e6) return `${(pop / 1e6).toFixed(1)}M`;
    if (pop >= 1e3) return `${(pop / 1e3).toFixed(1)}K`;
    return pop.toString();
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1e12) return `$${(amount / 1e12).toFixed(1)}T`;
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(1)}K`;
    return `$${amount.toFixed(0)}`;
  };

  const stats = [
    {
      icon: RiGlobalLine,
      label: "Countries",
      value: totalCountries.toLocaleString(),
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: RiGroupLine,
      label: "Total Population",
      value: formatPopulation(totalPopulation),
      color: "text-green-400",
      bgColor: "bg-green-500/10",
    },
    {
      icon: RiBarChartLine,
      label: "Combined GDP",
      value: formatCurrency(totalGDP),
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: RiTrophyLine,
      label: "Avg GDP/Capita",
      value: formatCurrency(avgGDPPerCapita),
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.4 }}
          className="glass-surface glass-interactive rounded-lg p-4"
        >
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${stat.bgColor}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">{stat.label}</p>
              <p className="text-foreground text-lg font-semibold">{stat.value}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

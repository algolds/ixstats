// src/app/economy/components/CountrySelector.tsx
"use client";

import { useState, useMemo } from "react";
import { Search, Globe, DollarSign, Users, TrendingUp, Filter as FilterIcon } from "lucide-react";
import type { RealCountryData } from "../lib/economy-data-service";
import { getEconomicTier } from "../lib/economy-data-service";
import { getTierStyle } from "~/lib/theme-utils"; // Assuming you have this

export function CountrySelector({ countries, onCountrySelect, selectedCountry }: CountrySelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>("all");

  const filteredCountries = useMemo(() => {
    let filtered = countries.filter(country => country.name !== "World"); // Exclude "World" entry

    if (searchTerm) {
      filtered = filtered.filter(country =>
        country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        country.countryCode.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedTierFilter !== "all") {
      filtered = filtered.filter(country =>
        getEconomicTier(country.gdpPerCapita).toLowerCase() === selectedTierFilter.toLowerCase()
      );
    }
    return filtered;
  }, [countries, searchTerm, selectedTierFilter]);

  const formatNumber = (num: number, isCurrency = true, precision = 1): string => {
    const prefix = isCurrency ? '$' : '';
    if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(precision)}B`;
    if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(isCurrency ? precision : 0)}`;
  };
  
  const formatPopulation = (pop: number): string => formatNumber(pop, false, 1);

  const tierStats = useMemo(() => {
    const stats = { Advanced: 0, Developed: 0, Emerging: 0, Developing: 0 };
    countries.filter(c => c.name !== "World").forEach(country => {
      const tier = getEconomicTier(country.gdpPerCapita);
      stats[tier]++;
    });
    return stats;
  }, [countries]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2 flex items-center">
          <Globe className="h-5 w-5 mr-2 text-[var(--color-brand-primary)]" />
          Choose a Foundation Country
        </h2>
        <p className="text-[var(--color-text-muted)]">
          Select a real-world country to use as the economic foundation for your custom nation. All parameters can be customized in the next step.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(tierStats).map(([tier, count]) => {
          const tierStyle = getTierStyle(tier);
          return (
            <div key={tier} className={`p-3 rounded-lg border ${tierStyle.className.replace('tier-badge ', '')} bg-opacity-10`}>
              <div className="text-lg font-semibold" style={{color: tierStyle.color}}>{count}</div>
              <div className="text-sm" style={{color: tierStyle.color}}>{tier}</div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text-muted)] h-4 w-4" />
            <input
              type="text"
              placeholder="Search countries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10"
            />
          </div>
        </div>
        <div className="sm:w-48">
          <div className="relative">
            <FilterIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text-muted)] h-4 w-4" />
            <select
              value={selectedTierFilter}
              onChange={(e) => setSelectedTierFilter(e.target.value)}
              className="form-select pl-10"
            >
              <option value="all">All Tiers</option>
              <option value="Advanced">Advanced</option>
              <option value="Developed">Developed</option>
              <option value="Emerging">Emerging</option>
              <option value="Developing">Developing</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-h-[50vh] overflow-y-auto border border-[var(--color-border-primary)] rounded-lg scrollbar-thin">
        {filteredCountries.length === 0 ? (
          <div className="p-8 text-center text-[var(--color-text-muted)]">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No countries match your search criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-primary)]">
            {filteredCountries.map((country) => {
              const tier = getEconomicTier(country.gdpPerCapita);
              const isSelected = selectedCountry?.name === country.name;
              const tierStyle = getTierStyle(tier);

              return (
                <div
                  key={country.countryCode}
                  onClick={() => onCountrySelect(country)}
                  className={`p-4 cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)] ${
                    isSelected ? 'bg-[var(--color-brand-primary)] bg-opacity-10 border-l-4 border-[var(--color-brand-primary)]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-[var(--color-text-primary)]">{country.name}</h3>
                    <span className={`tier-badge ${tierStyle.className}`}>{tier}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                    {[
                      { icon: Users, label: "Pop", value: formatPopulation(country.population) },
                      { icon: DollarSign, label: "GDP p.c.", value: formatNumber(country.gdpPerCapita) },
                      { icon: TrendingUp, label: "Tax %", value: `${country.taxRevenuePercent.toFixed(1)}%` },
                      { icon: Users, label: "Unemp %", value: `${country.unemploymentRate.toFixed(1)}%` }
                    ].map(stat => {
                      const Icon = stat.icon;
                      return (
                        <div key={stat.label} className="flex items-center text-[var(--color-text-muted)]">
                          <Icon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                          <span className="truncate" title={`${stat.label}: ${stat.value}`}>{stat.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {filteredCountries.length > 0 && (
        <p className="mt-4 text-sm text-[var(--color-text-muted)] text-center">
          Showing {filteredCountries.length} of {countries.filter(c=>c.name !== "World").length} countries
        </p>
      )}
    </div>
  );
}

interface CountrySelectorProps {
  countries: RealCountryData[];
  onCountrySelect: (country: RealCountryData) => void;
  selectedCountry: RealCountryData | null;
}
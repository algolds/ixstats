// src/app/economy/components/CountrySelector.tsx
"use client";

import { useState, useMemo } from "react";
import { Search, Globe, DollarSign, Users, TrendingUp } from "lucide-react";
import type { RealCountryData } from "../lib/economy-data-service";
import { getEconomicTier } from "../lib/economy-data-service";

interface CountrySelectorProps {
  countries: RealCountryData[];
  onCountrySelect: (country: RealCountryData) => void;
  selectedCountry: RealCountryData | null;
}

export function CountrySelector({ countries, onCountrySelect, selectedCountry }: CountrySelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");

  const filteredCountries = useMemo(() => {
    let filtered = countries;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(country =>
        country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        country.countryCode.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by economic tier
    if (selectedTier !== "all") {
      filtered = filtered.filter(country => 
        getEconomicTier(country.gdpPerCapita).toLowerCase() === selectedTier.toLowerCase()
      );
    }

    return filtered;
  }, [countries, searchTerm, selectedTier]);

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  const formatPopulation = (pop: number): string => {
    if (pop >= 1e9) return `${(pop / 1e9).toFixed(1)}B`;
    if (pop >= 1e6) return `${(pop / 1e6).toFixed(1)}M`;
    if (pop >= 1e3) return `${(pop / 1e3).toFixed(0)}K`;
    return pop.toString();
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "Advanced": return "bg-purple-100 text-purple-800 dark:bg-purple-700 dark:text-purple-100";
      case "Developed": return "bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100";
      case "Emerging": return "bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100";
      default: return "bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100";
    }
  };

  // Get tier distribution for stats
  const tierStats = useMemo(() => {
    const stats = { Advanced: 0, Developed: 0, Emerging: 0, Developing: 0 };
    countries.forEach(country => {
      const tier = getEconomicTier(country.gdpPerCapita);
      stats[tier]++;
    });
    return stats;
  }, [countries]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
          <Globe className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
          Select Reference Country
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Choose a real-world country to use as a baseline for your nation's economy. 
          You'll be able to customize all parameters in the next step.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(tierStats).map(([tier, count]) => (
          <div key={tier} className="bg-gray-50 dark:bg-gray-750 rounded-lg p-3 text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">{count}</div>
            <div className={`text-sm px-2 py-1 rounded-full inline-block ${getTierColor(tier)}`}>
              {tier}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search countries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="sm:w-48">
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Tiers</option>
            <option value="advanced">Advanced</option>
            <option value="developed">Developed</option>
            <option value="emerging">Emerging</option>
            <option value="developing">Developing</option>
          </select>
        </div>
      </div>

      {/* Country List */}
      <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg scrollbar-hide">
        {filteredCountries.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No countries match your search criteria</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredCountries.map((country) => {
              const tier = getEconomicTier(country.gdpPerCapita);
              const isSelected = selectedCountry?.name === country.name;
              
              return (
                <div
                  key={country.countryCode}
                  onClick={() => onCountrySelect(country)}
                  className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-750 ${
                    isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-600' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {country.name}
                        </h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTierColor(tier)}`}>
                          {tier}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          <Users className="h-4 w-4 mr-1" />
                          <span>{formatPopulation(country.population)}</span>
                        </div>
                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          <DollarSign className="h-4 w-4 mr-1" />
                          <span>{formatNumber(country.gdpPerCapita)}/capita</span>
                        </div>
                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          <TrendingUp className="h-4 w-4 mr-1" />
                          <span>{country.taxRevenuePercent.toFixed(1)}% tax</span>
                        </div>
                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          <Globe className="h-4 w-4 mr-1" />
                          <span>{country.unemploymentRate.toFixed(1)}% unemp</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {filteredCountries.length > 0 && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
          Showing {filteredCountries.length} of {countries.length} countries
        </p>
      )}
    </div>
  );
}
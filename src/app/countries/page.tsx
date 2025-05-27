// src/app/countries/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { Search, Globe, TrendingUp, Users, ArrowRight } from "lucide-react";

export default function CountriesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: countries, isLoading, error } = api.countries.getAll.useQuery();

  const filteredCountries = countries?.filter((country) =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatNumber = (num: number | null | undefined): string => {
    if (num == null) return '$0.00';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPopulation = (num: number | null | undefined): string => {
    if (num == null) return '0';
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(0);
  };

  const getTierColor = (tier: string | null | undefined) => {
    switch (tier) {
      case "Advanced": return "bg-purple-100 text-purple-800 dark:bg-purple-700 dark:text-purple-100";
      case "Developed": return "bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100";
      case "Emerging": return "bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100";
      default: return "bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">Loading countries, please wait...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-6 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
          <Globe className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-xl font-medium text-red-700 dark:text-red-300">Error Loading Countries</h3>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error.message}</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Explore countries</h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Browse detailed economic statistics for all countries in the World.
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="text-gray-400 dark:text-gray-500 h-5 w-5" />
            </div>
            <input
              type="text"
              placeholder="Search by country name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm placeholder-gray-400 dark:placeholder-gray-500 text-sm"
            />
          </div>
        </div>

        {/* Countries Grid */}
        {filteredCountries && filteredCountries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCountries.map((country) => (
              <Link
                key={country.id}
                href={`/countries/${country.id}`}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 group flex flex-col"
              >
                <div className="p-6 flex-grow">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {country.name}
                    </h3>
                    <ArrowRight className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-transform group-hover:translate-x-1" />
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center">
                        <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                        Population
                      </span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {formatPopulation(country.currentPopulation)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-2 flex-shrink-0" />
                        GDP p.c.
                      </span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {formatNumber(country.currentGdpPerCapita)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center">
                        <Globe className="h-4 w-4 mr-2 flex-shrink-0" />
                        Total GDP
                      </span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {formatNumber(country.currentTotalGdp)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-850 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
                    <div className="flex justify-between items-center">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getTierColor(
                          country.economicTier
                        )}`}
                      >
                        {country.economicTier || 'N/A'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {country.populationTier || 'N/A'}
                      </span>
                    </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Globe className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-white">
              {searchTerm ? "No countries match your search" : "No countries available"}
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm ? "Try adjusting your search terms or ensure data has been imported." : "Upload an Excel roster file via the IxStats Dashboard to get started."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// The CountryDetailPage component has been moved to src/app/countries/[id]/page.tsx
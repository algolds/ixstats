// src/app/_components/ixstats-dashboard.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  RefreshCw, 
  ExternalLink, 
  Flag, 
  BarChart3, 
  Users, 
  Globe, 
  TrendingUp,
  Search,
  Settings,
  Upload,
  Database,
  Clock,
  Activity,
  Zap
} from "lucide-react";
import { api } from "~/trpc/react";
import { ixnayWiki } from "~/lib/mediawiki-service";
import { IxTime } from "~/lib/ixtime";
import { useTheme } from "~/context/theme-context";

interface CountryListItemProps {
  country: {
    id: string;
    name: string;
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    economicTier: string;
    populationTier: string;
    landArea?: number | null;
    populationDensity?: number | null;
  };
  onRefresh: (countryId: string) => void;
  isRefreshing: boolean;
}

function CountryListItem({ country, onRefresh, isRefreshing }: CountryListItemProps) {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [flagLoading, setFlagLoading] = useState(true);

  // Load flag
  useEffect(() => {
    const loadFlag = async () => {
      try {
        setFlagLoading(true);
        const url = await ixnayWiki.getFlagUrl(country.name);
        setFlagUrl(url);
      } catch (error) {
        console.warn(`Failed to load flag for ${country.name}:`, error);
      } finally {
        setFlagLoading(false);
      }
    };

    loadFlag();
  }, [country.name]);

  const formatNumber = (num: number | null | undefined, isCurrency = true): string => {
    if (num == null) return isCurrency ? '$0.00' : '0';
    if (num >= 1e12) return `${isCurrency ? '$' : ''}${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${isCurrency ? '$' : ''}${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${isCurrency ? '$' : ''}${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${isCurrency ? '$' : ''}${(num / 1e3).toFixed(2)}K`;
    return `${isCurrency ? '$' : ''}${num.toFixed(isCurrency ? 2 : 0)}`;
  };

  const getWikiUrl = () => ixnayWiki.getCountryWikiUrl(country.name);

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-all">
      <div className="flex items-center space-x-4 flex-1 min-w-0">
        {/* Flag */}
        <div className="flex-shrink-0 w-8 h-6 relative">
          {flagLoading && (
            <div className="w-8 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse flex items-center justify-center">
              <Flag className="h-3 w-3 text-gray-400" />
            </div>
          )}
          {flagUrl && !flagLoading && (
            <img
              src={flagUrl}
              alt={`Flag of ${country.name}`}
              className="w-8 h-6 object-cover rounded shadow-sm border border-gray-300 dark:border-gray-600"
              onError={() => setFlagUrl(null)}
            />
          )}
          {!flagUrl && !flagLoading && (
            <div className="w-8 h-6 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
              <Flag className="h-3 w-3 text-gray-400" />
            </div>
          )}
        </div>

        {/* Country Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <Link
              href={`/countries/${country.id}`}
              className="text-lg font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate"
            >
              {country.name}
            </Link>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              country.economicTier === 'Advanced' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
              country.economicTier === 'Developed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
              country.economicTier === 'Emerging' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            }`}>
              {country.economicTier}
            </span>
          </div>
          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center">
              <Users className="h-3 w-3 mr-1" />
              {formatNumber(country.currentPopulation, false)}
            </span>
            <span className="flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              {formatNumber(country.currentGdpPerCapita)}
            </span>
            {country.landArea && (
              <span className="flex items-center">
                <Globe className="h-3 w-3 mr-1" />
                {formatNumber(country.landArea, false)} km²
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-2 flex-shrink-0">
        <a
          href={getWikiUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          title={`View ${country.name} on wiki`}
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <button
          onClick={() => onRefresh(country.id)}
          disabled={isRefreshing}
          className="p-2 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title={`Refresh ${country.name} data`}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}

export default function IxStatsDashboard() {
  const { theme } = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshingCountries, setRefreshingCountries] = useState<Set<string>>(new Set());

  // Fetch countries data
  const { data: countries, isLoading, refetch } = api.countries.getAll.useQuery();

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!countries) return [];
    if (!searchTerm) return countries;
    
    return countries.filter(country =>
      country.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [countries, searchTerm]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!countries) return null;

    const totalPopulation = countries.reduce((sum, c) => sum + c.currentPopulation, 0);
    const totalGdp = countries.reduce((sum, c) => sum + c.currentTotalGdp, 0);
    const avgGdpPerCapita = totalGdp / totalPopulation;
    const tierCounts = countries.reduce((acc, c) => {
      acc[c.economicTier] = (acc[c.economicTier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalCountries: countries.length,
      totalPopulation,
      totalGdp,
      avgGdpPerCapita,
      tierCounts,
    };
  }, [countries]);

  const handleRefreshCountry = async (countryId: string) => {
    setRefreshingCountries(prev => new Set(prev).add(countryId));
    
    try {
      // Here you would implement the refresh logic for a specific country
      // For now, we'll just simulate a delay and refetch all data
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refetch();
    } catch (error) {
      console.error('Failed to refresh country data:', error);
    } finally {
      setRefreshingCountries(prev => {
        const next = new Set(prev);
        next.delete(countryId);
        return next;
      });
    }
  };

  const handleRefreshAll = async () => {
    try {
      await refetch();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

  const formatNumber = (num: number | null | undefined, isCurrency = true): string => {
    if (num == null) return isCurrency ? '$0.00' : '0';
    if (num >= 1e12) return `${isCurrency ? '$' : ''}${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${isCurrency ? '$' : ''}${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${isCurrency ? '$' : ''}${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${isCurrency ? '$' : ''}${(num / 1e3).toFixed(2)}K`;
    return `${isCurrency ? '$' : ''}${num.toFixed(isCurrency ? 2 : 0)}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 dark:border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading IxStats Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                <BarChart3 className="h-8 w-8 mr-3 text-indigo-600 dark:text-indigo-500" />
                IxStats Dashboard
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Real-time economic statistics for the Ixnay world • Updated {IxTime.formatIxTime(IxTime.getCurrentIxTime())}
              </p>
            </div>
            
            <div className="mt-4 sm:mt-0 flex items-center space-x-3">
              <button
                onClick={handleRefreshAll}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh All
              </button>
              <Link
                href="/admin"
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                <Settings className="h-4 w-4 mr-2" />
                Admin
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <Globe className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Countries</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalCountries}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Population</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatNumber(stats.totalPopulation, false)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total GDP</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatNumber(stats.totalGdp)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg GDP per Capita</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatNumber(stats.avgGdpPerCapita)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Countries List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Countries ({filteredCountries.length})
              </h2>
              
              <div className="mt-4 sm:mt-0">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="text-gray-400 h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search countries..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            {filteredCountries.length === 0 ? (
              <div className="text-center py-12">
                <Globe className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No countries found</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {searchTerm ? 'Try adjusting your search terms.' : 'Upload country data to get started.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCountries.map((country) => (
                  <CountryListItem
                    key={country.id}
                    country={country}
                    onRefresh={handleRefreshCountry}
                    isRefreshing={refreshingCountries.has(country.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center justify-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>
              IxTime runs 4x faster than real time • Current IxTime: {IxTime.formatIxTime(IxTime.getCurrentIxTime())}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
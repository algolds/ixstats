// src/app/_components/ixstats-dashboard.tsx
"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { Upload, RefreshCw, Clock, Globe, TrendingUp, Users, MapPin, Scaling, BarChart3, Target, Layers, AlertCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ImportPreviewDialog } from "./import-preview-dialog";
import type { CountryStats } from "~/types/ixstats";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  isAnalyzing: boolean;
}

function FileUpload({ onFileSelect, isUploading, isAnalyzing }: FileUploadProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
      <div className="text-center">
        <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
        <div className="mt-4">
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-white">
              Upload Excel roster file
            </span>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={handleFileChange}
              disabled={isUploading || isAnalyzing}
            />
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {isAnalyzing ? "Analyzing changes..." : isUploading ? "Importing..." : "Click to select file"}
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

interface CountryCardProps {
  country: CountryStats;
  onUpdate: () => void;
}

function CountryCard({ country, onUpdate }: CountryCardProps) {
  const updateMutation = api.countries.updateStats.useMutation({
    onSuccess: onUpdate,
  });

  const handleUpdate = () => {
    updateMutation.mutate({ countryId: country.id });
  };

  const formatNumber = (num: number | null | undefined, isCurrency = true, precision = 2) => {
    if (num == null) return isCurrency ? '$0.00' : '0';
    const prefix = isCurrency ? '$' : '';
    if (num >= 1e12) return `${prefix}${(num / 1e12).toFixed(precision)}T`;
    if (num >= 1e9) return `${prefix}${(num / 1e9).toFixed(precision)}B`;
    if (num >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (num >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(isCurrency ? precision : 0)}`;
  };

  const getEfficiencyRating = (country: CountryStats): { rating: string; color: string } => {
    if (!country.landArea || !country.populationDensity) {
      return { rating: 'N/A', color: 'gray' };
    }
    
    const economicDensity = country.currentTotalGdp / country.landArea;
    const populationEfficiency = country.currentGdpPerCapita / country.populationDensity;
    
    // Create a composite efficiency score
    const efficiencyScore = (economicDensity / 1000000) + (populationEfficiency / 100);
    
    if (efficiencyScore > 100) return { rating: 'Excellent', color: 'green' };
    if (efficiencyScore > 50) return { rating: 'Good', color: 'blue' };
    if (efficiencyScore > 25) return { rating: 'Average', color: 'yellow' };
    if (efficiencyScore > 10) return { rating: 'Below Avg', color: 'orange' };
    return { rating: 'Poor', color: 'red' };
  };

  const efficiency = getEfficiencyRating(country);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{country.name}</h3>
        <button
          onClick={handleUpdate}
          disabled={updateMutation.isPending}
          className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${updateMutation.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <p className="text-gray-500 dark:text-gray-400">Population</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">{formatNumber(country.currentPopulation, false)}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">GDP p.c.</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">{formatNumber(country.currentGdpPerCapita)}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Land Area</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">
            {country.landArea ? `${formatNumber(country.landArea, false, 0)} km²` : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Pop. Density</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">
            {country.populationDensity ? `${country.populationDensity.toFixed(1)}/km²` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Efficiency Rating */}
      <div className="flex justify-between items-center py-2 px-3 bg-gray-50 dark:bg-gray-750 rounded-md mb-4">
        <span className="text-sm text-gray-600 dark:text-gray-400">Economic Efficiency</span>
        <span className={`text-sm font-medium text-${efficiency.color}-600 dark:text-${efficiency.color}-400`}>
          {efficiency.rating}
        </span>
      </div>

      <div className="flex justify-between items-center text-xs">
        <span className={`px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200`}>
          {country.economicTier}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          Last updated: {new Date(country.lastCalculated).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// Enhanced Country Stats interface to match what comes from the database
interface EnhancedCountryStats extends CountryStats {
  // Add missing properties that come from the database
  baselinePopulation: number;
  baselineGdpPerCapita: number;
}

function GlobalAnalytics({ countries }: { countries: EnhancedCountryStats[] }) {
  const economicTierData = countries.reduce((acc, country) => {
    const tier = country.economicTier;
    const existing = acc.find(item => item.name === tier);
    if (existing) {
      existing.value += 1;
      existing.totalGdp += country.currentTotalGdp;
      existing.totalArea += country.landArea || 0;
    } else {
      acc.push({
        name: tier,
        value: 1,
        totalGdp: country.currentTotalGdp,
        totalArea: country.landArea || 0,
      });
    }
    return acc;
  }, [] as Array<{ name: string; value: number; totalGdp: number; totalArea: number }>);

  const densityDistribution = countries
    .filter(c => c.populationDensity && c.landArea)
    .map(c => ({
      name: c.name,
      populationDensity: c.populationDensity,
      gdpDensity: (c.gdpDensity || 0) / 1000000, // Convert to millions
      economicTier: c.economicTier,
    }))
    .sort((a, b) => b.populationDensity! - a.populationDensity!)
    .slice(0, 10); // Top 10 by population density

  const TIER_COLORS = {
    'Advanced': '#8B5CF6',
    'Developed': '#3B82F6', 
    'Emerging': '#10B981',
    'Developing': '#F59E0B'
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Economic Tier Distribution
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={economicTierData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value}`}
            >
              {economicTierData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={TIER_COLORS[entry.name as keyof typeof TIER_COLORS] || '#6B7280'} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Target className="h-5 w-5 mr-2" />
          Top 10 Countries by Population Density
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={densityDistribution} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={80} fontSize={10} />
            <Tooltip 
              formatter={(value: number, name: string) => [
                name === 'populationDensity' ? `${value.toFixed(1)}/km²` : `$${value.toFixed(1)}M/km²`,
                name === 'populationDensity' ? 'Population Density' : 'GDP Density'
              ]}
            />
            <Legend />
            <Bar dataKey="populationDensity" fill="#3B82F6" name="Pop. Density" />
            <Bar dataKey="gdpDensity" fill="#10B981" name="GDP Density (M$/km²)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function IxStatsDashboard() {
  const [currentIxTime, setCurrentIxTime] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importChanges, setImportChanges] = useState<any[]>([]);
  const [pendingFileData, setPendingFileData] = useState<string>("");

  // Queries
  const { data: countries, refetch: refetchCountries, isLoading: countriesLoading } = api.countries.getAll.useQuery();
  const { data: globalStats, refetch: refetchGlobalStats, isLoading: globalStatsLoading } = api.countries.getGlobalStats.useQuery();

  // Transform countries data to match CountryStats interface
  const transformedCountries: EnhancedCountryStats[] = countries?.map(country => ({
    ...country,
    // Map database fields to CountryStats interface
    population: country.baselinePopulation,
    gdpPerCapita: country.baselineGdpPerCapita,
    lastCalculated: country.lastCalculated.getTime(), // Convert Date to number
    totalGdp: country.currentTotalGdp,
    globalGrowthFactor: 1.0, // Default value, could be fetched from system config
  })) || [];

  // Mutations
  const analyzeImportMutation = api.countries.analyzeImport.useMutation({
    onSuccess: (data) => {
      setImportChanges(data.changes);
      setShowImportPreview(true);
      setIsAnalyzing(false);
    },
    onError: (error) => {
      console.error("Import analysis error:", error);
      alert(`Analysis Error: ${error.message}`);
      setIsAnalyzing(false);
    },
  });

  const importMutation = api.countries.importFromExcel.useMutation({
    onSuccess: (data) => {
      refetchCountries();
      refetchGlobalStats();
      setIsUploading(false);
      setShowImportPreview(false);
      setPendingFileData("");
      
      // Show success message
      const message = data.imported > 0 
        ? `Successfully imported ${data.imported} of ${data.totalInFile} countries!`
        : `No new countries imported. ${data.totalInFile} countries were analyzed.`;
      alert(message);
    },
    onError: (error) => {
      console.error("Import error:", error);
      alert(`Import Error: ${error.message}`);
      setIsUploading(false);
    },
  });

  const updateAllMutation = api.countries.updateStats.useMutation({
    onSuccess: () => {
      refetchCountries();
      refetchGlobalStats();
    },
    onError: (error) => {
      console.error("Update All Error:", error);
      alert(`Update All Error: ${error.message}`);
    },
  });

  // Update IxTime display
  useEffect(() => {
    const updateTime = () => {
      setCurrentIxTime(IxTime.formatIxTime(IxTime.getCurrentIxTime(), true));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = async (file: File) => {
    setIsAnalyzing(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      setPendingFileData(base64);
      
      // First, analyze the import
      await analyzeImportMutation.mutateAsync({
        fileData: base64,
      });
    } catch (error) {
      console.error("File analysis error:", error);
      setIsAnalyzing(false);
    }
  };

  const handleConfirmImport = async (replaceExisting: boolean) => {
    if (!pendingFileData) return;
    
    setIsUploading(true);
    
    try {
      await importMutation.mutateAsync({
        fileData: pendingFileData,
        replaceExisting,
      });
    } catch (error) {
      console.error("File import error:", error);
      setIsUploading(false);
    }
  };

  const handleUpdateAll = () => {
    updateAllMutation.mutate({});
  };

  const handleRefresh = () => {
    refetchCountries();
    refetchGlobalStats();
  };

  const handleClosePreview = () => {
    setShowImportPreview(false);
    setPendingFileData("");
    setImportChanges([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Import Preview Dialog */}
      <ImportPreviewDialog
        isOpen={showImportPreview}
        onClose={handleClosePreview}
        onConfirm={handleConfirmImport}
        changes={importChanges}
        isLoading={isUploading}
      />

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">IxStats Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Automated Economic Statistics for Ixnay with Geographic Analysis
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                <Clock className="h-4 w-4 mr-2" />
                {currentIxTime}
              </div>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${updateAllMutation.isPending || countriesLoading || globalStatsLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Global Stats */}
        {globalStats && !globalStatsLoading && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Global Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {[
                { icon: Users, label: "Total Population", value: `${(globalStats.totalPopulation / 1e9).toFixed(2)}B`, color: "blue" },
                { icon: Globe, label: "Total GDP", value: `$${(globalStats.totalGdp / 1e12).toFixed(2)}T`, color: "green" },
                { icon: TrendingUp, label: "Avg GDP p.c.", value: `$${globalStats.averageGdpPerCapita.toFixed(0)}`, color: "purple" },
                { icon: MapPin, label: "Countries", value: globalStats.countryCount, color: "orange" },
              ].map(stat => (
                <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <stat.icon className={`h-8 w-8 text-${stat.color}-500`} />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {stat.value}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Enhanced Geographic Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {[
                { 
                  icon: Scaling, 
                  label: "Avg. Population Density", 
                  value: `${globalStats.averagePopulationDensity?.toFixed(1) ?? 'N/A'} /km²`, 
                  color: "teal",
                  description: "Average population per square kilometer across all nations"
                },
                { 
                  icon: Layers, 
                  label: "Avg. GDP Density", 
                  value: `$${(globalStats.averageGdpDensity ? globalStats.averageGdpDensity / 1000000 : 0).toFixed(1)}M /km²`, 
                  color: "pink",
                  description: "Average economic output per square kilometer"
                },
              ].map(stat => (
                <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center mb-2">
                    <stat.icon className={`h-8 w-8 text-${stat.color}-500`} />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {stat.value}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{stat.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global Analytics Charts */}
        {transformedCountries && transformedCountries.length > 0 && (
          <GlobalAnalytics countries={transformedCountries} />
        )}

        {/* Controls */}
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Import Data with Preview
              </h3>
              <FileUpload 
                onFileSelect={handleFileUpload} 
                isUploading={isUploading}
                isAnalyzing={isAnalyzing} 
              />
              
              {/* Import Status Messages */}
              {analyzeImportMutation.isError && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                    <p className="text-sm text-red-800 dark:text-red-200">
                      Error analyzing file: {analyzeImportMutation.error?.message}
                    </p>
                  </div>
                </div>
              )}
              
              {importMutation.isError && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                    <p className="text-sm text-red-800 dark:text-red-200">
                      Error importing file: {importMutation.error?.message}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                <p>• Upload will show a preview of changes before importing</p>
                <p>• You can choose to update existing countries or skip them</p>
                <p>• Historical data and DM inputs are always preserved</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Bulk Actions</h3>
              <button
                onClick={handleUpdateAll}
                disabled={updateAllMutation.isPending}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50"
              >
                {updateAllMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4 mr-2" />
                )}
                Update All Countries
              </button>
            </div>
          </div>
        </div>

        {/* Countries Grid */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Countries</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {transformedCountries?.length || 0} countries loaded
            </p>
          </div>
          {countriesLoading && <p className="text-center text-gray-500 dark:text-gray-400">Loading countries list...</p>}
          {transformedCountries && transformedCountries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {transformedCountries.map((country) => (
                <CountryCard
                  key={country.id}
                  country={country}
                  onUpdate={() => {
                    refetchCountries();
                    refetchGlobalStats();
                  }}
                />
              ))}
            </div>
          ) : (
            !countriesLoading && (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <Globe className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No countries loaded</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Upload an Excel roster file to get started.
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
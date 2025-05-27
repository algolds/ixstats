// src/app/_components/ixstats-dashboard.tsx
"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { Upload, RefreshCw, Clock, Globe, TrendingUp, Users, MapPin, Scaling } from "lucide-react";
import type { CountryStats } from "~/types/ixstats"; // Import CountryStats type


interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
}

function FileUpload({ onFileSelect, isUploading }: FileUploadProps) {
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
              disabled={isUploading}
            />
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {isUploading ? "Uploading..." : "Click to select file"}
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

interface CountryCardProps {
  country: CountryStats; // Use the imported CountryStats type
  onUpdate: () => void;
}

function CountryCard({ country, onUpdate }: CountryCardProps) {
  const updateMutation = api.countries.updateStats.useMutation({
    onSuccess: onUpdate,
  });

  const handleUpdate = () => {
    updateMutation.mutate({ countryId: country.id });
  };

  const formatNumber = (num: number | null | undefined, isCurrency = true) => {
    if (num == null) return isCurrency ? '$0.00' : '0';
    const prefix = isCurrency ? '$' : '';
    if (num >= 1e12) return `${prefix}${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${prefix}${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${prefix}${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${prefix}${(num / 1e3).toFixed(2)}K`;
    return `${prefix}${num.toFixed(isCurrency ? 2 : 0)}`;
  };


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

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500 dark:text-gray-400">Population</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">{formatNumber(country.currentPopulation, false)}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">GDP p.c.</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">{formatNumber(country.currentGdpPerCapita)}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Total GDP</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">{formatNumber(country.currentTotalGdp)}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Econ. Tier</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">{country.economicTier}</p>
        </div>
         <div>
          <p className="text-gray-500 dark:text-gray-400">Land Area</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">
            {country.landArea ? `${formatNumber(country.landArea, false)} km²` : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Pop. Density</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">
            {country.populationDensity ? `${country.populationDensity.toFixed(2)}/km²` : 'N/A'}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-500 dark:text-gray-400">GDP Density</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">
            {country.gdpDensity ? `${formatNumber(country.gdpDensity)}/km²` : 'N/A'}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Last updated: {new Date(country.lastCalculated).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

export default function IxStatsDashboard() {
  const [currentIxTime, setCurrentIxTime] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  // Queries
  const { data: countries, refetch: refetchCountries, isLoading: countriesLoading } = api.countries.getAll.useQuery();
  const { data: globalStats, refetch: refetchGlobalStats, isLoading: globalStatsLoading } = api.countries.getGlobalStats.useQuery();

  // Mutations
  const importMutation = api.countries.importFromExcel.useMutation({
    onSuccess: () => {
      refetchCountries();
      refetchGlobalStats();
      setIsUploading(false);
    },
    onError: (error) => {
      console.error("Import error:", error);
      alert(`Import Error: ${error.message}`); // Simple alert for user feedback
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
    setIsUploading(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      await importMutation.mutateAsync({
        fileData: base64,
        replaceExisting: false, // Consider adding UI to control this
      });
    } catch (error) {
      console.error("File upload error:", error);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">IxStats Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Automated Economic Statistics for Ixnay
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
        {/* Global Stats */}
        {globalStats && !globalStatsLoading && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Global Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Users, label: "Total Population", value: `${(globalStats.totalPopulation / 1e9).toFixed(2)}B`, color: "blue" },
                { icon: Globe, label: "Total GDP", value: `$${(globalStats.totalGdp / 1e12).toFixed(2)}T`, color: "green" },
                { icon: TrendingUp, label: "Avg GDP p.c.", value: `$${globalStats.averageGdpPerCapita.toFixed(0)}`, color: "purple" },
                { icon: MapPin, label: "Countries", value: globalStats.countryCount, color: "orange" },
                { icon: Scaling, label: "Avg. Pop. Density", value: `${globalStats.averagePopulationDensity?.toFixed(2) ?? 'N/A'} /km²`, color: "teal" },
                { icon: Scaling, label: "Avg. GDP Density", value: `$${globalStats.averageGdpDensity?.toFixed(2) ?? 'N/A'} /km²`, color: "pink" },
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
          </div>
        )}
         {globalStatsLoading && <p className="text-center text-gray-500 dark:text-gray-400">Loading global stats...</p>}


        {/* Controls */}
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Import Data</h3>
              <FileUpload onFileSelect={handleFileUpload} isUploading={isUploading} />
              {importMutation.isError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  Error importing file: {importMutation.error?.message}
                </p>
              )}
              {importMutation.isSuccess && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                  Successfully imported {importMutation.data?.imported} of {importMutation.data?.totalInFile} countries.
                </p>
              )}
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
              {countries?.length || 0} countries loaded
            </p>
          </div>
          {countriesLoading && <p className="text-center text-gray-500 dark:text-gray-400">Loading countries list...</p>}
          {countries && countries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {countries.map((country) => (
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
"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { Upload, RefreshCw, Clock, Globe, TrendingUp, Users } from "lucide-react";

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
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
      <div className="text-center">
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <div className="mt-4">
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="mt-2 block text-sm font-medium text-gray-900">
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
            <div className="mt-2 text-xs text-gray-500">
              {isUploading ? "Uploading..." : "Click to select file"}
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

interface CountryCardProps {
  country: any;
  onUpdate: () => void;
}

function CountryCard({ country, onUpdate }: CountryCardProps) {
  const updateMutation = api.countries.updateStats.useMutation({
    onSuccess: onUpdate,
  });

  const handleUpdate = () => {
    updateMutation.mutate({ countryId: country.id });
  };

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPopulation = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(0);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{country.name}</h3>
        <button
          onClick={handleUpdate}
          disabled={updateMutation.isPending}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${updateMutation.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500">Population</p>
          <p className="text-lg font-medium">{formatPopulation(country.currentPopulation)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">GDP per Capita</p>
          <p className="text-lg font-medium">{formatNumber(country.currentGdpPerCapita)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Total GDP</p>
          <p className="text-lg font-medium">{formatNumber(country.currentTotalGdp)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Economic Tier</p>
          <p className="text-lg font-medium">{country.economicTier}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
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
  const { data: countries, refetch: refetchCountries } = api.countries.getAll.useQuery();
  const { data: globalStats, refetch: refetchGlobalStats } = api.countries.getGlobalStats.useQuery();

  // Mutations
  const importMutation = api.countries.importFromExcel.useMutation({
    onSuccess: () => {
      refetchCountries();
      refetchGlobalStats();
      setIsUploading(false);
    },
    onError: (error) => {
      console.error("Import error:", error);
      setIsUploading(false);
    },
  });

  const updateAllMutation = api.countries.updateStats.useMutation({
    onSuccess: () => {
      refetchCountries();
      refetchGlobalStats();
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
        replaceExisting: false,
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">IxStats Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Automated Economic Statistics for Ixnay
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <Clock className="h-4 w-4 mr-2" />
                {currentIxTime}
              </div>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Global Stats */}
        {globalStats && (
          <div className="mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Global Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Population</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {(globalStats.totalPopulation / 1e9).toFixed(2)}B
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Globe className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total GDP</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      ${(globalStats.totalGdp / 1e12).toFixed(2)}T
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Avg GDP per Capita</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      ${globalStats.avgGdpPerCapita.toFixed(0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Globe className="h-8 w-8 text-orange-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Countries</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {globalStats.countryCount}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Import Data</h3>
              <FileUpload onFileSelect={handleFileUpload} isUploading={isUploading} />
              {importMutation.isError && (
                <p className="mt-2 text-sm text-red-600">
                  Error importing file: {importMutation.error?.message}
                </p>
              )}
              {importMutation.isSuccess && (
                <p className="mt-2 text-sm text-green-600">
                  Successfully imported {importMutation.data?.imported} countries
                </p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Bulk Actions</h3>
              <button
                onClick={handleUpdateAll}
                disabled={updateAllMutation.isPending}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
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
            <h2 className="text-lg font-medium text-gray-900">Countries</h2>
            <p className="text-sm text-gray-500">
              {countries?.length || 0} countries loaded
            </p>
          </div>

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
            <div className="text-center py-12">
              <Globe className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No countries loaded</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload an Excel roster file to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
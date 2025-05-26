// src/app/layout.tsx
import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { Navigation, ThemeProvider } from "~/context/theme-context";

export const metadata: Metadata = {
  title: "IxStats",
  description: "IxStats - Automated Economic Statistics for Ixnay",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const RootLayout = ({
  children,
}: Readonly<{ children: React.ReactNode }>) => {
  return (
    <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
      <body className="transition-colors duration-200">
        <TRPCReactProvider>
          <ThemeProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
              <Navigation />
              <main>{children}</main>
            </div>
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}

// src/app/_components/ixstats-dashboard.tsx (Updated with dark mode support)
"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { Upload, RefreshCw, Clock, Globe, TrendingUp, Users, Moon, Sun } from "lucide-react";
import { useTheme } from "~/context/theme-context";

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
    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-white dark:bg-gray-800">
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

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "Advanced": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "Developed": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Emerging": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default: return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    }
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Population</p>
          <p className="text-lg font-medium text-gray-900 dark:text-white">{formatPopulation(country.currentPopulation)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">GDP per Capita</p>
          <p className="text-lg font-medium text-gray-900 dark:text-white">{formatNumber(country.currentGdpPerCapita)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total GDP</p>
          <p className="text-lg font-medium text-gray-900 dark:text-white">{formatNumber(country.currentTotalGdp)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Economic Tier</p>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierColor(country.economicTier)}`}>
            {country.economicTier}
          </span>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
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
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Global Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Population</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {(globalStats.totalPopulation / 1e9).toFixed(2)}B
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <Globe className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total GDP</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      ${(globalStats.totalGdp / 1e12).toFixed(2)}T
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg GDP per Capita</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      ${globalStats.avgGdpPerCapita.toFixed(0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <Globe className="h-8 w-8 text-orange-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Countries</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
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
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Import Data</h3>
              <FileUpload onFileSelect={handleFileUpload} isUploading={isUploading} />
              {importMutation.isError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  Error importing file: {importMutation.error?.message}
                </p>
              )}
              {importMutation.isSuccess && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                  Successfully imported {importMutation.data?.imported} countries
                </p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Bulk Actions</h3>
              <button
                onClick={handleUpdateAll}
                disabled={updateAllMutation.isPending}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
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
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Countries</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
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
              <Globe className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No countries loaded</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Upload an Excel roster file to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
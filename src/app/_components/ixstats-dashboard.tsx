// src/app/_components/ixstats-dashboard.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { Upload, RefreshCw, Clock, Globe, TrendingUp, Users, MapPin, Scaling, BarChart3, Target, Layers, AlertCircle, Wifi, WifiOff, X, Filter } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ImportPreviewDialog } from "./import-preview-dialog";
import type { CountryStats, EconomicTier, PopulationTier } from "~/types/ixstats";

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
          Last updated: {country.lastCalculated instanceof Date 
            ? country.lastCalculated.toLocaleDateString() 
            : new Date(country.lastCalculated).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// Interactive modal for showing countries in selected tier
interface TierDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: string | null;
  countries: ProcessedCountryData[];
}

function TierDetailsModal({ isOpen, onClose, tier, countries }: TierDetailsModalProps) {
  if (!isOpen || !tier) return null;

  const tierCountries = countries.filter(country => country.economicTier === tier);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {tier} Countries ({tierCountries.length})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh] scrollbar-thin">
          <div className="grid grid-cols-1 gap-3">
            {tierCountries.map((country, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-750 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{country.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Pop: {(country.currentPopulation / 1e6).toFixed(1)}M | 
                    GDP p.c.: ${country.currentGdpPerCapita.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    ${(country.currentTotalGdp / 1e9).toFixed(1)}B
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total GDP</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Fixed chart data processing interface
interface ProcessedCountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  landArea: number | null;
  populationDensity: number | null;
  gdpDensity: number | null;
}

type MetricFilter = 'populationDensity' | 'gdpDensity' | 'currentPopulation' | 'currentGdpPerCapita' | 'currentTotalGdp';

function GlobalAnalytics({ countries }: { countries: ProcessedCountryData[] }) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [showTierModal, setShowTierModal] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricFilter>('populationDensity');

  // Filter countries with valid data for charts
  const validCountries = countries.filter(country => 
    country.currentPopulation > 0 && 
    country.currentGdpPerCapita > 0 && 
    country.currentTotalGdp > 0
  );

  // Economic tier distribution with better data handling
  const economicTierData = validCountries.reduce((acc, country) => {
    const tier = country.economicTier || 'Unknown';
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

  // Enhanced top countries data with different metrics
  const topCountriesData = useMemo(() => {
    let filteredCountries = validCountries;
    let dataKey = selectedMetric;
    let label = '';
    let unit = '';

    switch (selectedMetric) {
      case 'populationDensity':
        filteredCountries = validCountries.filter(c => c.populationDensity != null && c.populationDensity > 0);
        label = 'Population Density';
        unit = '/km²';
        break;
      case 'gdpDensity':
        filteredCountries = validCountries.filter(c => c.gdpDensity != null && c.gdpDensity > 0);
        label = 'GDP Density';
        unit = 'M$/km²';
        break;
      case 'currentPopulation':
        label = 'Population';
        unit = 'M';
        break;
      case 'currentGdpPerCapita':
        label = 'GDP per Capita';
        unit = '$';
        break;
      case 'currentTotalGdp':
        label = 'Total GDP';
        unit = 'B$';
        break;
    }

    return filteredCountries
      .map(c => ({
        name: c.name.length > 10 ? c.name.substring(0, 10) + '...' : c.name,
        value: selectedMetric === 'gdpDensity' ? Number(((c.gdpDensity || 0) / 1000000).toFixed(2)) :
               selectedMetric === 'currentPopulation' ? Number((c.currentPopulation / 1000000).toFixed(1)) :
               selectedMetric === 'currentTotalGdp' ? Number((c.currentTotalGdp / 1000000000).toFixed(1)) :
               Number((c[selectedMetric] || 0)),
        fullName: c.name,
        economicTier: c.economicTier,
        [dataKey]: c[selectedMetric]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [validCountries, selectedMetric]);

  const handlePieClick = (data: any) => {
    setSelectedTier(data.name);
    setShowTierModal(true);
  };

  const TIER_COLORS: Record<string, string> = {
    'Advanced': '#8B5CF6',
    'Developed': '#3B82F6', 
    'Emerging': '#10B981',
    'Developing': '#F59E0B',
    'Unknown': '#6B7280'
  };

  const metricOptions = [
    { key: 'populationDensity', label: 'Population Density', icon: Users },
    { key: 'gdpDensity', label: 'GDP Density', icon: TrendingUp },
    { key: 'currentPopulation', label: 'Total Population', icon: Users },
    { key: 'currentGdpPerCapita', label: 'GDP per Capita', icon: TrendingUp },
    { key: 'currentTotalGdp', label: 'Total GDP', icon: Globe },
  ] as const;

  return (
    <>
      <TierDetailsModal 
        isOpen={showTierModal}
        onClose={() => setShowTierModal(false)}
        tier={selectedTier}
        countries={countries}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Economic Tier Distribution (Click to explore)
          </h3>
          {economicTierData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={economicTierData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                  onClick={handlePieClick}
                  style={{ cursor: 'pointer' }}
                >
                  {economicTierData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={TIER_COLORS[entry.name] || '#6B7280'}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name) => [value, 'Countries']}
                  labelFormatter={(label) => `Economic Tier: ${label}`}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No economic tier data available</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Target className="h-5 w-5 mr-2" />
              Top 10 Countries
            </h3>
            <div className="relative">
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as MetricFilter)}
                className="bg-gray-50 dark:bg-gray-750 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2 appearance-none pr-8"
              >
                {metricOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          
          {topCountriesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={topCountriesData} 
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: '#6B7280' }} 
                  angle={-45} 
                  textAnchor="end" 
                  height={80}
                  interval={0}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#6B7280' }} 
                  stroke="#6B7280"
                />
                <Tooltip 
                  formatter={(value: number) => {
                    const unit = selectedMetric === 'populationDensity' ? '/km²' :
                                selectedMetric === 'gdpDensity' ? 'M$/km²' :
                                selectedMetric === 'currentPopulation' ? 'M' :
                                selectedMetric === 'currentGdpPerCapita' ? '$' : 'B$';
                    return [`${value}${unit}`, metricOptions.find(m => m.key === selectedMetric)?.label];
                  }}
                  labelFormatter={(label, payload) => {
                    const data = payload?.[0]?.payload;
                    return data?.fullName || label;
                  }}
                  contentStyle={{
                    backgroundColor: 'rgba(31, 41, 55, 0.9)',
                    color: '#E5E7EB',
                    border: '1px solid #374151',
                    borderRadius: '0.375rem'
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#3B82F6" 
                  radius={[2, 2, 0, 0]}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No data available for selected metric</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function IxStatsDashboard() {
  const [currentIxTime, setCurrentIxTime] = useState<string>("");
  const [botConnected, setBotConnected] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importChanges, setImportChanges] = useState<any[]>([]);
  const [pendingFileData, setPendingFileData] = useState<string>("");

  // Queries
  const { data: countries, refetch: refetchCountries, isLoading: countriesLoading } = api.countries.getAll.useQuery();
  const { data: globalStats, refetch: refetchGlobalStats, isLoading: globalStatsLoading } = api.countries.getGlobalStats.useQuery();

  // Process countries data for charts with proper type safety and casting
  const processedCountries: ProcessedCountryData[] = countries?.map(country => ({
    id: country.id,
    name: country.name || country.country || 'Unknown',
    currentPopulation: country.currentPopulation || 0,
    currentGdpPerCapita: country.currentGdpPerCapita || 0,
    currentTotalGdp: country.currentTotalGdp || 0,
    economicTier: country.economicTier || 'Unknown',
    populationTier: country.populationTier || 'Unknown',
    landArea: country.landArea || null,
    populationDensity: country.populationDensity || null,
    gdpDensity: country.gdpDensity || null,
  })) || [];

  // Transform countries data to match CountryStats interface for CountryCard with proper casting
  const transformedCountries: CountryStats[] = countries?.map(country => ({
    ...country,
    // Map database fields to CountryStats interface
    population: country.baselinePopulation,
    gdpPerCapita: country.baselineGdpPerCapita,
    lastCalculated: country.lastCalculated, // Keep as Date object
    totalGdp: country.currentTotalGdp,
    globalGrowthFactor: 1.0, // Default value, could be fetched from system config
    // Cast enum types properly
    economicTier: country.economicTier as EconomicTier,
    populationTier: country.populationTier as PopulationTier,
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

  // Update IxTime display with bot sync - FIXED VERSION
  useEffect(() => {
    let isActive = true;
    
    const updateTime = async () => {
      try {
        // Try to get time from bot first
        const currentTime = await IxTime.getCurrentIxTimeFromBot();
        if (isActive) {
          setCurrentIxTime(IxTime.formatIxTime(currentTime, true));
          setBotConnected(true);
        }
      } catch (error) {
        // Fallback to local time calculation
        if (isActive) {
          const localTime = IxTime.getCurrentIxTime();
          setCurrentIxTime(IxTime.formatIxTime(localTime, true));
          setBotConnected(false);
          console.warn('[Dashboard] Using local time fallback:', error);
        }
      }
    };

    // Initial update
    updateTime();
    
    // Update every second
    const interval = setInterval(updateTime, 1000);
    
    return () => {
      isActive = false;
      clearInterval(interval);
    };
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>{currentIxTime}</span>
                  {!botConnected ? (
                    <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                      <WifiOff className="h-3 w-3 ml-1" />
                      <span className="text-xs ml-1">(Local)</span>
                    </div>
                  ) : (
                    <Wifi className="h-3 w-3 ml-1 text-green-600 dark:text-green-400" />
                  )}
                </div>
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
        {processedCountries && processedCountries.length > 0 && (
          <GlobalAnalytics countries={processedCountries} />
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
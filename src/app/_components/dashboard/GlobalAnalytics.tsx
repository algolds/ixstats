// src/app/_components/dashboard/GlobalAnalytics.tsx
"use client";

import { useState, useMemo } from "react";
import { BarChart3, Target, Filter, X, Users, TrendingUp, Globe } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useChartTheme } from "~/context/theme-context";

// Fixed chart data processing interface
export interface ProcessedCountryData {
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
    <div className="modal-backdrop">
      <div className="modal-content max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border-primary)]">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            {tier} Countries ({tierCountries.length})
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-ring rounded"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh] scrollbar-thin">
          <div className="grid grid-cols-1 gap-3">
            {tierCountries.map((country, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg hover:bg-[var(--color-bg-accent)] transition-colors">
                <div>
                  <h3 className="font-medium text-[var(--color-text-primary)]">{country.name}</h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Pop: {(country.currentPopulation / 1e6).toFixed(1)}M | 
                    GDP p.c.: ${country.currentGdpPerCapita.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                    ${(country.currentTotalGdp / 1e9).toFixed(1)}B
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">Total GDP</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface GlobalAnalyticsProps {
  countries: ProcessedCountryData[];
}

export function GlobalAnalytics({ countries }: GlobalAnalyticsProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [showTierModal, setShowTierModal] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricFilter>('populationDensity');
  
  const chartTheme = useChartTheme();

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
    
    switch (selectedMetric) {
      case 'populationDensity':
        filteredCountries = validCountries.filter(c => c.populationDensity != null && c.populationDensity > 0);
        break;
      case 'gdpDensity':
        filteredCountries = validCountries.filter(c => c.gdpDensity != null && c.gdpDensity > 0);
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

  const metricOptions = [
    { key: 'populationDensity', label: 'Population Density', icon: Users },
    { key: 'gdpDensity', label: 'GDP Density', icon: TrendingUp },
    { key: 'currentPopulation', label: 'Total Population', icon: Users },
    { key: 'currentGdpPerCapita', label: 'GDP per Capita', icon: TrendingUp },
    { key: 'currentTotalGdp', label: 'Total GDP', icon: Globe },
  ] as const;

  if (validCountries.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Global Analytics</h2>
        <div className="card text-center py-12">
          <BarChart3 className="mx-auto h-12 w-12 text-[var(--color-text-muted)] opacity-50" />
          <h3 className="mt-4 text-lg font-medium text-[var(--color-text-primary)]">
            No Data Available
          </h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Global analytics will appear here once countries are loaded and have valid data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <TierDetailsModal 
        isOpen={showTierModal}
        onClose={() => setShowTierModal(false)}
        tier={selectedTier}
        countries={countries}
      />
      
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">Global Analytics</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Economic Tier Distribution Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Economic Tier Distribution
            <span className="text-sm font-normal text-[var(--color-text-muted)] ml-2">(Click to explore)</span>
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
                      fill={chartTheme.colors[index % chartTheme.colors.length]}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: chartTheme.tooltipBg,
                    color: chartTheme.textColor,
                    border: `1px solid ${chartTheme.gridColor}`,
                    borderRadius: '0.375rem'
                  }}
                  formatter={(value, name) => [value, 'Countries']}
                  labelFormatter={(label) => `Economic Tier: ${label}`}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
              <div className="text-center">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No economic tier data available</p>
              </div>
            </div>
          )}
        </div>

        {/* Top Countries Chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
              <Target className="h-5 w-5 mr-2" />
              Top 10 Countries
            </h3>
            <div className="relative">
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as MetricFilter)}
                className="form-select pr-8 text-sm"
              >
                {metricOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)] pointer-events-none" />
            </div>
          </div>
          
          {topCountriesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={topCountriesData} 
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: chartTheme.textColor }} 
                  angle={-45} 
                  textAnchor="end" 
                  height={80}
                  interval={0}
                  stroke={chartTheme.axisColor}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: chartTheme.textColor }} 
                  stroke={chartTheme.axisColor}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: chartTheme.tooltipBg,
                    color: chartTheme.textColor,
                    border: `1px solid ${chartTheme.gridColor}`,
                    borderRadius: '0.375rem'
                  }}
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
                />
                <Bar 
                  dataKey="value" 
                  fill={chartTheme.colors[1]} 
                  radius={[2, 2, 0, 0]}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
              <div className="text-center">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No data available for selected metric</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
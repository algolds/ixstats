// src/app/economy/components/CoreEconomicIndicators.tsx
// GDP, inflation, currency controls

import { useState, useEffect } from "react";
import { TrendingUp, DollarSign, Activity, Globe, Info, AlertTriangle } from "lucide-react";
import type { EnhancedEconomicInputs, EconomicHint } from "../lib/enhanced-economic-types";
import type { RealCountryData } from "../lib/economy-data-service"; // Import RealCountryData

interface CoreEconomicIndicatorsProps {
  inputs: EnhancedEconomicInputs;
  onInputsChange: (inputs: Partial<EnhancedEconomicInputs>) => void;
  referenceCountries: RealCountryData[]; // Use RealCountryData type
}

export function CoreEconomicIndicators({ 
  inputs, 
  onInputsChange, 
  referenceCountries 
}: CoreEconomicIndicatorsProps) {
  const [hints, setHints] = useState<EconomicHint[]>([]);

  // Calculate derived values
  const totalGDP = inputs.population * inputs.gdpPerCapita;
  // const nominalGDP = totalGDP / (1 + inputs.inflationRate); // Simplified real vs nominal (Commented out as unused)

  useEffect(() => {
    generateHints();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.realGDPGrowthRate, inputs.inflationRate, inputs.gdpPerCapita, referenceCountries]); // Added referenceCountries to dependency array

  const generateHints = () => {
    const newHints: EconomicHint[] = [];

    // GDP Growth Rate Analysis
    if (inputs.realGDPGrowthRate > 0.08) {
      newHints.push({
        type: 'warning',
        title: 'Very High Growth Rate',
        message: 'Growth rates above 8% annually are rare and may indicate economic instability or unsustainable expansion.',
        relatedCountries: ['China (historical)', 'India (periods)'],
        impact: 'high'
      });
    } else if (inputs.realGDPGrowthRate > 0.05) {
      newHints.push({
        type: 'info',
        title: 'Strong Economic Growth',
        message: 'This growth rate is typical of rapidly developing economies.',
        relatedCountries: ['Vietnam', 'Bangladesh', 'Rwanda'],
        impact: 'medium'
      });
    } else if (inputs.realGDPGrowthRate < 0.01) {
      newHints.push({
        type: 'suggestion',
        title: 'Low Growth Economy',
        message: 'This suggests a mature, stable economy or potential economic challenges.',
        relatedCountries: ['Japan', 'Germany', 'France'],
        impact: 'medium'
      });
    }

    // Inflation Analysis
    if (inputs.inflationRate > 0.10) {
      newHints.push({
        type: 'warning',
        title: 'High Inflation',
        message: 'Inflation above 10% can indicate economic instability and hurt purchasing power.',
        relatedCountries: ['Turkey', 'Argentina (historical)'],
        impact: 'high'
      });
    } else if (inputs.inflationRate < 0) {
      newHints.push({
        type: 'warning',
        title: 'Deflation Risk',
        message: 'Negative inflation (deflation) can signal economic contraction.',
        relatedCountries: ['Japan (lost decades)'],
        impact: 'high'
      });
    } else if (inputs.inflationRate >= 0.015 && inputs.inflationRate <= 0.03) {
      newHints.push({
        type: 'info',
        title: 'Healthy Inflation',
        message: 'This inflation rate is within the target range of most central banks.',
        relatedCountries: ['United States', 'European Union'],
        impact: 'low'
      });
    }

    // Find closest matching countries
    if (referenceCountries && referenceCountries.length > 0) {
        const similarities = referenceCountries
        .filter(country => country && typeof country.gdpPerCapita === 'number') // Ensure country and gdpPerCapita are valid
        .map(country => {
            const gdpDiff = Math.abs(inputs.gdpPerCapita - country.gdpPerCapita) / country.gdpPerCapita;
            const similarity = Math.max(0, 100 - (gdpDiff * 100));
            return { name: country.name, similarity };
        }).sort((a, b) => b.similarity - a.similarity);

        if (similarities.length > 0 && similarities[0] && similarities[0].similarity > 70) {
            newHints.push({
                type: 'info',
                title: 'Similar Economy',
                message: `Your economy most closely resembles ${similarities[0].name} (${similarities[0].similarity.toFixed(0)}% match).`,
                relatedCountries: [similarities[0].name],
                impact: 'low'
            });
        }
    }


    setHints(newHints);
  };

  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  const getGrowthColor = (rate: number) => {
    if (rate > 0.06) return 'text-green-400';
    if (rate > 0.03) return 'text-green-500';
    if (rate > 0.01) return 'text-yellow-500';
    if (rate > -0.01) return 'text-gray-400';
    return 'text-red-500';
  };

  const getInflationColor = (rate: number) => {
    if (rate > 0.10) return 'text-red-500';
    if (rate > 0.05) return 'text-yellow-500';
    if (rate >= 0.015 && rate <= 0.03) return 'text-green-500';
    if (rate > 0) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Core Economic Indicators
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Fundamental economic metrics that define your nation's economic health
          </p>
        </div>

        <div className="card-content space-y-6">
          {/* Live Economic Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {formatCurrency(totalGDP)}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Total GDP</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {formatCurrency(inputs.gdpPerCapita)}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">GDP per Capita</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getGrowthColor(inputs.realGDPGrowthRate)}`}>
                {(inputs.realGDPGrowthRate * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Real GDP Growth</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getInflationColor(inputs.inflationRate)}`}>
                {(inputs.inflationRate * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Inflation Rate</div>
            </div>
          </div>

          {/* Input Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Real GDP Growth Rate */}
            <div className="space-y-3">
              <label className="form-label flex items-center">
                <Activity className="h-4 w-4 mr-2" />
                Real GDP Growth Rate
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="-0.05"
                  max="0.15"
                  step="0.001"
                  value={inputs.realGDPGrowthRate}
                  onChange={(e) => onInputsChange({ realGDPGrowthRate: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>-5%</span>
                  <span className={getGrowthColor(inputs.realGDPGrowthRate)}>
                    {(inputs.realGDPGrowthRate * 100).toFixed(1)}%
                  </span>
                  <span>15%</span>
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Annual economic growth after adjusting for inflation
              </div>
            </div>

            {/* Inflation Rate */}
            <div className="space-y-3">
              <label className="form-label flex items-center">
                <TrendingUp className="h-4 w-4 mr-2" />
                Inflation Rate
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="-0.02"
                  max="0.20"
                  step="0.001"
                  value={inputs.inflationRate}
                  onChange={(e) => onInputsChange({ inflationRate: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>-2%</span>
                  <span className={getInflationColor(inputs.inflationRate)}>
                    {(inputs.inflationRate * 100).toFixed(1)}%
                  </span>
                  <span>20%</span>
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Annual rate of price increase for goods and services
              </div>
            </div>

            {/* Currency Exchange Rate */}
            <div className="space-y-3">
              <label className="form-label flex items-center">
                <DollarSign className="h-4 w-4 mr-2" />
                Currency Exchange Rate
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  step="0.01"
                  value={inputs.currencyExchangeRate}
                  onChange={(e) => onInputsChange({ currencyExchangeRate: parseFloat(e.target.value) || 1 })}
                  className="form-input flex-1"
                  placeholder="1.00"
                />
                <select
                  value={inputs.baseCurrency}
                  onChange={(e) => onInputsChange({ baseCurrency: e.target.value })}
                  className="form-select w-20"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                  <option value="CNY">CNY</option>
                </select>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Local currency value relative to {inputs.baseCurrency}
              </div>
            </div>

            {/* Economic Health Score */}
            <div className="space-y-3">
              <label className="form-label flex items-center">
                <Globe className="h-4 w-4 mr-2" />
                Economic Health Score
              </label>
              <div className="relative">
                {(() => {
                  const healthScore = Math.min(100, Math.max(0, 
                    50 + 
                    (inputs.realGDPGrowthRate * 500) + 
                    (Math.max(0, 0.03 - Math.abs(inputs.inflationRate - 0.02)) * 1000) +
                    (Math.min(inputs.gdpPerCapita / 1000, 30))
                  ));
                  
                  const getHealthColor = (score: number) => {
                    if (score >= 80) return 'bg-green-500';
                    if (score >= 60) return 'bg-yellow-500';
                    return 'bg-red-500';
                  };

                  return (
                    <>
                      <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full ${getHealthColor(healthScore)} transition-all duration-300`}
                          style={{ width: `${healthScore}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                        <span>Poor</span>
                        <span className="font-medium">{healthScore.toFixed(0)}/100</span>
                        <span>Excellent</span>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Composite score based on growth, inflation, and GDP per capita
              </div>
            </div>
          </div>

          {/* Economic Hints */}
          {hints.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-[var(--color-text-secondary)] flex items-center">
                <Info className="h-4 w-4 mr-2" />
                Economic Analysis & Suggestions
              </h4>
              <div className="space-y-2">
                {hints.map((hint, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border-l-4 ${
                      hint.type === 'warning' ? 'border-[var(--color-warning)] bg-yellow-500/10' :
                      hint.type === 'suggestion' ? 'border-[var(--color-info)] bg-blue-500/10' :
                      'border-[var(--color-success)] bg-green-500/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          {hint.type === 'warning' && <AlertTriangle className="h-4 w-4 mr-2 text-[var(--color-warning)]" />}
                          {hint.type === 'suggestion' && <Info className="h-4 w-4 mr-2 text-[var(--color-info)]" />}
                          {hint.type === 'info' && <TrendingUp className="h-4 w-4 mr-2 text-[var(--color-success)]" />}
                          <h5 className="text-sm font-medium text-[var(--color-text-primary)]">
                            {hint.title}
                          </h5>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          {hint.message}
                        </p>
                        {hint.relatedCountries && hint.relatedCountries.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {hint.relatedCountries.map(countryName => ( // Changed variable name
                              <span 
                                key={countryName}
                                className="px-2 py-1 text-xs bg-[var(--color-bg-secondary)] rounded-full text-[var(--color-text-secondary)]"
                              >
                                {countryName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        hint.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                        hint.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {hint.impact}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: var(--color-brand-primary);
          cursor: pointer;
          border: 2px solid var(--color-bg-primary);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: var(--color-brand-primary);
          cursor: pointer;
          border: 2px solid var(--color-bg-primary);
        }
      `}</style>
    </div>
  );
}
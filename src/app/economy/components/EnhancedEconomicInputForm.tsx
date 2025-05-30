// src/app/economy/components/EnhancedEconomicInputForm.tsx
// Main form with subsystem tabs

import { useState, useEffect } from "react";
import { ArrowLeft, Eye, Building, TrendingUp, Users, DollarSign, AlertCircle, CheckCircle } from "lucide-react";
import { CoreEconomicIndicators } from "./CoreEconomicIndicators";
import { LaborEmployment } from "./LaborEmployment";
import { FiscalSystem } from "./FiscalSystem";
import type { EnhancedEconomicInputs, TaxBracket, CorporateTaxTier, ExciseTaxRates, GovernmentSpending } from "../lib/enhanced-economic-types";
import type { RealCountryData } from "../lib/economy-data-service";
import { getEconomicTier } from "../lib/economy-data-service";
import { getTierStyle } from "~/lib/theme-utils";

interface EnhancedEconomicInputFormProps {
  inputs: EnhancedEconomicInputs;
  referenceCountry: RealCountryData;
  allCountries: RealCountryData[];
  onInputsChange: (inputs: EnhancedEconomicInputs) => void;
  onPreview: () => void;
  onBack: () => void;
}

interface ValidationError {
  field: keyof EnhancedEconomicInputs | string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export function EnhancedEconomicInputForm({
  inputs,
  referenceCountry,
  allCountries,
  onInputsChange,
  onPreview,
  onBack
}: EnhancedEconomicInputFormProps) {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [activeSection, setActiveSection] = useState<'overview' | 'core' | 'labor' | 'fiscal'>('overview');

  // Initialize default values if not set
  useEffect(() => {
    if (!inputs.personalIncomeTaxRates?.length) {
      const defaultInputs: Partial<EnhancedEconomicInputs> = {
        // Core Economic Indicators
        realGDPGrowthRate: 0.025,
        inflationRate: 0.02,
        currencyExchangeRate: 1.0,
        baseCurrency: 'USD',

        // Labor & Employment  
        laborForceParticipationRate: 65,
        employmentRate: 100 - inputs.unemploymentRate,
        totalWorkforce: Math.round(inputs.population * 0.65 * 0.95),
        averageWorkweekHours: 40,
        minimumWage: 7.25,
        averageAnnualIncome: inputs.gdpPerCapita * 0.8,

        // Fiscal System
        governmentRevenueTotal: 0,
        taxRevenuePerCapita: 0,
        personalIncomeTaxRates: [
          { minIncome: 0, maxIncome: 10000, rate: 0.10 },
          { minIncome: 10000, maxIncome: 40000, rate: 0.22 },
          { minIncome: 40000, maxIncome: 85000, rate: 0.24 },
          { minIncome: 85000, maxIncome: null, rate: 0.32 }
        ] as TaxBracket[],
        corporateTaxRates: [
          { revenueThreshold: 0, rate: 0.15, description: 'Small Business' },
          { revenueThreshold: 50000, rate: 0.21, description: 'Standard Rate' },
          { revenueThreshold: 10000000, rate: 0.25, description: 'Large Corporation' }
        ] as CorporateTaxTier[],
        salesTaxRate: 8.5,
        propertyTaxRate: 1.2,
        payrollTaxRate: 15.3,
        exciseTaxRates: {
          alcohol: 2.5,
          tobacco: 15.0,
          fuel: 0.5,
          luxuryGoods: 10.0,
          environmentalTax: 5.0
        } as ExciseTaxRates,
        wealthTaxRate: 0.5,
        budgetDeficitSurplus: 0,
        governmentSpendingBreakdown: {
          defense: 15,
          education: 20,
          healthcare: 18,
          infrastructure: 12,
          socialServices: 15,
          administration: 8,
          diplomatic: 3,
          justice: 5
        } as GovernmentSpending
      };

      onInputsChange({ ...inputs, ...defaultInputs });
    }
  }, []);

  useEffect(() => {
    validateInputs();
  }, [inputs]);

  const validateInputs = () => {
    const newErrors: ValidationError[] = [];
    
    // Basic validation
    if (!inputs.countryName?.trim()) {
      newErrors.push({ field: 'countryName', message: 'Country name is required', severity: 'error' });
    }
    if (inputs.population <= 0) {
      newErrors.push({ field: 'population', message: 'Population must be > 0', severity: 'error' });
    }
    if (inputs.gdpPerCapita <= 0) {
      newErrors.push({ field: 'gdpPerCapita', message: 'GDP per capita must be > 0', severity: 'error' });
    }

    // Advanced validation
    if (inputs.realGDPGrowthRate && Math.abs(inputs.realGDPGrowthRate) > 0.15) {
      newErrors.push({ 
        field: 'realGDPGrowthRate', 
        message: 'Extreme GDP growth rates may be unrealistic', 
        severity: 'warning' 
      });
    }

    if (inputs.inflationRate && Math.abs(inputs.inflationRate) > 0.2) {
      newErrors.push({ 
        field: 'inflationRate', 
        message: 'Very high inflation/deflation rates are concerning', 
        severity: 'warning' 
      });
    }

    if (inputs.laborForceParticipationRate < 30 || inputs.laborForceParticipationRate > 90) {
      newErrors.push({ 
        field: 'laborForceParticipationRate', 
        message: 'Labor participation rate seems extreme', 
        severity: 'warning' 
      });
    }

    // Fiscal validation
    if (inputs.governmentSpendingBreakdown) {
      const totalSpending = Object.values(inputs.governmentSpendingBreakdown).reduce((sum, val) => sum + val, 0);
      if (totalSpending > 100) {
        newErrors.push({ 
          field: 'governmentSpendingBreakdown', 
          message: 'Government spending exceeds 100%', 
          severity: 'error' 
        });
      }
      if (totalSpending < 90) {
        newErrors.push({ 
          field: 'governmentSpendingBreakdown', 
          message: 'Some budget categories may be unallocated', 
          severity: 'info' 
        });
      }
    }

    setErrors(newErrors);
  };

  const handleInputsChange = (updates: Partial<EnhancedEconomicInputs>) => {
    onInputsChange({ ...inputs, ...updates });
  };

  const getFieldError = (field: keyof EnhancedEconomicInputs | string) => 
    errors.find(e => e.field === field);

  const hasFatalErrors = errors.some(e => e.severity === 'error');
  const canPreview = !hasFatalErrors && inputs.countryName?.trim();

  // Calculate summary statistics
  const totalGDP = inputs.population * inputs.gdpPerCapita;
  const currentEconomicTier = getEconomicTier(inputs.gdpPerCapita);
  const tierStyle = getTierStyle(currentEconomicTier);

  const sections = [
    { 
      id: 'overview', 
      label: 'Overview', 
      icon: Building, 
      description: 'Basic country parameters and summary' 
    },
    { 
      id: 'core', 
      label: 'Economic Indicators', 
      icon: TrendingUp, 
      description: 'GDP growth, inflation, and core metrics' 
    },
    { 
      id: 'labor', 
      label: 'Labor & Employment', 
      icon: Users, 
      description: 'Workforce, wages, and employment' 
    },
    { 
      id: 'fiscal', 
      label: 'Fiscal System', 
      icon: DollarSign, 
      description: 'Taxes, spending, and government finance' 
    }
  ];

  const formatNumber = (num: number, precision = 1, isCurrency = true): string => {
    const prefix = isCurrency ? '$' : '';
    if (Math.abs(num) >= 1e12) return `${prefix}${(num / 1e12).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(precision)}B`;
    if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(isCurrency ? precision : 0)}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">
            Enhanced Economic Builder
          </h2>
          <p className="text-[var(--color-text-muted)]">
            Build a comprehensive economic model for {inputs.countryName || 'your nation'}
          </p>
        </div>
        <button onClick={onBack} className="btn-secondary text-sm py-1.5 px-3">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </button>
      </div>

      {/* Progress and Summary */}
      <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 border border-[var(--color-border-primary)]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-[var(--color-text-muted)]">Country:</span>
            <div className="font-semibold text-[var(--color-text-primary)]">
              {inputs.countryName || 'Unnamed'}
            </div>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Total GDP:</span>
            <div className="font-semibold text-[var(--color-text-primary)]">
              {formatNumber(totalGDP)}
            </div>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Economic Tier:</span>
            <div className={`tier-badge ${tierStyle.className} text-xs`}>
              {currentEconomicTier}
            </div>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Status:</span>
            <div className={`flex items-center text-xs ${canPreview ? 'text-green-400' : 'text-yellow-400'}`}>
              {canPreview ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Ready
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  In Progress
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="flex space-x-1 bg-[var(--color-bg-secondary)] rounded-lg p-1">
        {sections.map(section => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={`flex-1 flex flex-col items-center justify-center py-3 px-2 rounded-md text-xs font-medium transition-all ${
                activeSection === section.id
                  ? 'bg-[var(--color-brand-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="font-medium">{section.label}</span>
              <span className="text-xs opacity-75 hidden md:block">{section.description}</span>
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <div className="min-h-[600px]">
        {activeSection === 'overview' && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">Country Overview</h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Basic parameters and reference comparison with {referenceCountry.name}
              </p>
            </div>
            <div className="card-content space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="form-label">Country Name</label>
                    <input
                      type="text"
                      value={inputs.countryName}
                      onChange={(e) => handleInputsChange({ countryName: e.target.value })}
                      className="form-input"
                      placeholder={`New ${referenceCountry.name}`}
                    />
                    {getFieldError('countryName') && (
                      <p className="text-xs text-red-400 mt-1">
                        {getFieldError('countryName')?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="form-label">Population</label>
                    <input
                      type="number"
                      value={inputs.population}
                      onChange={(e) => handleInputsChange({ population: parseInt(e.target.value) || 0 })}
                      className="form-input"
                      placeholder={referenceCountry.population.toLocaleString()}
                    />
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                      Reference: {referenceCountry.population.toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <label className="form-label">GDP per Capita ($)</label>
                    <input
                      type="number"
                      value={inputs.gdpPerCapita}
                      onChange={(e) => handleInputsChange({ gdpPerCapita: parseFloat(e.target.value) || 0 })}
                      className="form-input"
                      placeholder={referenceCountry.gdpPerCapita.toLocaleString()}
                    />
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                      Reference: ${referenceCountry.gdpPerCapita.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="form-label">Tax Revenue (% of GDP)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={inputs.taxRevenuePercent}
                      onChange={(e) => handleInputsChange({ taxRevenuePercent: parseFloat(e.target.value) || 0 })}
                      className="form-input"
                    />
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                      Reference: {referenceCountry.taxRevenuePercent.toFixed(1)}%
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Government Budget (% of GDP)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={inputs.governmentBudgetPercent}
                      onChange={(e) => handleInputsChange({ governmentBudgetPercent: parseFloat(e.target.value) || 0 })}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label">Unemployment Rate (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={inputs.unemploymentRate}
                      onChange={(e) => handleInputsChange({ unemploymentRate: parseFloat(e.target.value) || 0 })}
                      className="form-input"
                    />
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                      Reference: {referenceCountry.unemploymentRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Closest Matching Countries */}
              <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg">
                <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                  Countries with Similar Economics
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {allCountries
                    .filter(c => c.name !== referenceCountry.name)
                    .map(country => {
                      const gdpSimilarity = 1 - Math.abs(country.gdpPerCapita - inputs.gdpPerCapita) / Math.max(country.gdpPerCapita, inputs.gdpPerCapita);
                      const popSimilarity = 1 - Math.abs(country.population - inputs.population) / Math.max(country.population, inputs.population);
                      const overallSimilarity = (gdpSimilarity + popSimilarity) / 2;
                      return { ...country, similarity: overallSimilarity };
                    })
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, 6)
                    .map(country => {
                      const tier = getEconomicTier(country.gdpPerCapita);
                      const tierStyle = getTierStyle(tier);
                      return (
                        <div key={country.name} className="p-3 bg-[var(--color-bg-tertiary)] rounded border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{country.name}</span>
                            <span className={`tier-badge ${tierStyle.className} text-xs`}>{tier}</span>
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            GDP: {formatNumber(country.gdpPerCapita)} • Pop: {formatNumber(country.population, 1, false)}
                          </div>
                          <div className="text-xs text-green-400 mt-1">
                            {(country.similarity * 100).toFixed(0)}% similar
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'core' && (
          <CoreEconomicIndicators
            inputs={inputs}
            onInputsChange={handleInputsChange}
            referenceCountries={allCountries}
          />
        )}

        {activeSection === 'labor' && (
          <LaborEmployment
            inputs={inputs}
            onInputsChange={handleInputsChange}
            referenceCountries={allCountries}
          />
        )}

        {activeSection === 'fiscal' && (
          <FiscalSystem
            inputs={inputs}
            onInputsChange={handleInputsChange}
            referenceCountries={allCountries}
          />
        )}
      </div>

      {/* Error Summary */}
      {errors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">
            Validation Summary
          </h4>
          {errors.map((error, index) => (
            <div 
              key={index}
              className={`flex items-center text-xs p-2 rounded ${
                error.severity === 'error' ? 'bg-red-500/10 text-red-400' :
                error.severity === 'warning' ? 'bg-yellow-500/10 text-yellow-400' :
                'bg-blue-500/10 text-blue-400'
              }`}
            >
              <AlertCircle className="h-3 w-3 mr-2" />
              <span>{error.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center pt-6 border-t border-[var(--color-border-primary)]">
        <div className={`flex items-center text-sm ${canPreview ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {canPreview ? <CheckCircle className="h-4 w-4 mr-1.5" /> : <AlertCircle className="h-4 w-4 mr-1.5" />}
          {canPreview ? 'Ready for preview' : (hasFatalErrors ? 'Fix errors to continue' : 'Complete required fields')}
        </div>
        <button 
          onClick={onPreview} 
          disabled={!canPreview} 
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Eye className="h-4 w-4 mr-2" /> Preview & Compare
        </button>
      </div>
    </div>
  );
}
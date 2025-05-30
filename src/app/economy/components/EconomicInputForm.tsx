// src/app/economy/components/EconomicInputForm.tsx
"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Eye,
  Users,
  DollarSign,
  Percent,
  TrendingDown,
  Building,
  CreditCard,
  AlertCircle,
  Info,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import type { EconomicInputs, RealCountryData } from "../lib/economy-data-service";
import { getEconomicTier } from "../lib/economy-data-service";
import { getTierStyle } from "~/lib/theme-utils";

interface EconomicInputFormProps {
  inputs: EconomicInputs;
  referenceCountry: RealCountryData;
  onInputsChange: (inputs: EconomicInputs) => void;
  onPreview: () => void;
  onBack: () => void;
}

interface ValidationError {
  field: keyof EconomicInputs;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export function EconomicInputForm({
  inputs,
  referenceCountry,
  onInputsChange,
  onPreview,
  onBack
}: EconomicInputFormProps) {
  const [errors, setErrors] = useState<ValidationError[]>([]);

  useEffect(() => {
    validateInputs();
  }, [inputs]);

  const validateInputs = () => {
    const newErrors: ValidationError[] = [];
    if (!inputs.countryName.trim()) newErrors.push({ field: 'countryName', message: 'Country name is required', severity: 'error' });
    if (inputs.population <= 0) newErrors.push({ field: 'population', message: 'Population must be > 0', severity: 'error' });
    else if (inputs.population < 1000) newErrors.push({ field: 'population', message: 'Very small population', severity: 'warning' });
    if (inputs.gdpPerCapita <= 0) newErrors.push({ field: 'gdpPerCapita', message: 'GDP p.c. must be > 0', severity: 'error' });
    else if (inputs.gdpPerCapita < 500) newErrors.push({ field: 'gdpPerCapita', message: 'Very low GDP p.c.', severity: 'warning' });
    if (inputs.taxRevenuePercent < 0 || inputs.taxRevenuePercent > 100) newErrors.push({ field: 'taxRevenuePercent', message: 'Tax % must be 0-100', severity: 'error' });
    if (inputs.unemploymentRate < 0 || inputs.unemploymentRate > 100) newErrors.push({ field: 'unemploymentRate', message: 'Unemp. % must be 0-100', severity: 'error' });
    if (inputs.governmentBudgetPercent < 0 || inputs.governmentBudgetPercent > 100) newErrors.push({ field: 'governmentBudgetPercent', message: 'Budget % must be 0-100', severity: 'error' });
    if (inputs.internalDebtPercent < 0) newErrors.push({ field: 'internalDebtPercent', message: 'Debt % must be non-negative', severity: 'error' });
    if (inputs.externalDebtPercent < 0) newErrors.push({ field: 'externalDebtPercent', message: 'Debt % must be non-negative', severity: 'error' });
    setErrors(newErrors);
  };

  const handleInputChange = (field: keyof EconomicInputs, value: string | number) => {
    onInputsChange({ ...inputs, [field]: value });
  };

  const getFieldError = (field: keyof EconomicInputs) => errors.find(e => e.field === field);
  const hasFatalErrors = errors.some(e => e.severity === 'error');
  const canPreview = !hasFatalErrors && inputs.countryName.trim();

  const calculateTotalGDP = () => (inputs.population * inputs.gdpPerCapita) / 1e9; // Billions
  const calculateTaxRevenueValue = () => (calculateTotalGDP() * inputs.taxRevenuePercent) / 100;

  const formatNumber = (num: number, precision = 1): string => {
    if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(precision)}K`;
    return `$${num.toFixed(0)}`;
  };
  const formatPopulationDisplay = (pop: number): string => {
    if (pop >= 1e9) return `${(pop / 1e9).toFixed(1)}B`;
    if (pop >= 1e6) return `${(pop / 1e6).toFixed(1)}M`;
    if (pop >= 1e3) return `${(pop / 1e3).toFixed(0)}K`;
    return pop.toString();
  };


  const inputFields: Array<{
    key: keyof EconomicInputs; label: string; icon: React.ElementType; type: string;
    placeholder?: string; help: string; reference?: string; step?: string;
  }> = [
    { key: 'countryName', label: 'Country Name', icon: Building, type: 'text', placeholder: `New ${referenceCountry.name}`, help: 'Unique name for your nation.' },
    { key: 'population', label: 'Population', icon: Users, type: 'number', help: 'Total citizens.', reference: referenceCountry.population.toLocaleString() },
    { key: 'gdpPerCapita', label: 'GDP per Capita ($)', icon: DollarSign, type: 'number', help: 'Avg. economic output per person/year.', reference: `$${referenceCountry.gdpPerCapita.toLocaleString()}` },
    { key: 'taxRevenuePercent', label: 'Tax Revenue (% of GDP)', icon: Percent, type: 'number', step: '0.1', help: 'Gov tax collection as % of total GDP.', reference: `${referenceCountry.taxRevenuePercent.toFixed(1)}%` },
    { key: 'unemploymentRate', label: 'Unemployment Rate (%)', icon: TrendingDown, type: 'number', step: '0.1', help: '% of workforce seeking employment.', reference: `${referenceCountry.unemploymentRate.toFixed(1)}%` },
    { key: 'governmentBudgetPercent', label: 'Gov. Budget (% of GDP)', icon: Building, type: 'number', step: '0.1', help: 'Total gov spending as % of GDP.', reference: `Ref: ${referenceCountry.taxRevenuePercent.toFixed(1)}%` },
    { key: 'internalDebtPercent', label: 'Internal Debt (% of GDP)', icon: CreditCard, type: 'number', step: '0.1', help: 'Gov debt to domestic creditors.' },
    { key: 'externalDebtPercent', label: 'External Debt (% of GDP)', icon: CreditCard, type: 'number', step: '0.1', help: 'Gov debt to foreign creditors.' }
  ];
  
  const currentEconomicTier = getEconomicTier(inputs.gdpPerCapita);
  const tierStyle = getTierStyle(currentEconomicTier);


  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">Economic Parameters</h2>
          <p className="text-[var(--color-text-muted)]">Customize based on {referenceCountry.name}</p>
        </div>
        <button onClick={onBack} className="btn-secondary text-sm py-1.5 px-3">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </button>
      </div>

      <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 mb-6 border border-[var(--color-border-primary)]">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Live Economic Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            {label: "Total GDP", value: formatNumber(calculateTotalGDP() * 1e9)},
            {label: "Tax Revenue", value: formatNumber(calculateTaxRevenueValue() * 1e9)},
            {label: "Economic Tier", value: <span className={`tier-badge ${tierStyle.className}`}>{currentEconomicTier}</span> },
            {label: "Total Debt", value: `${(inputs.internalDebtPercent + inputs.externalDebtPercent).toFixed(1)}% GDP`}
          ].map(item => (
            <div key={item.label}>
              <span className="text-[var(--color-text-muted)]">{item.label}:</span>
              <div className="font-semibold text-[var(--color-text-primary)]">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        {inputFields.map(field => {
          const Icon = field.icon;
          const error = getFieldError(field.key);
          const value = inputs[field.key];

          return (
            <div key={field.key} className="space-y-1">
              <label htmlFor={field.key} className="form-label flex items-center">
                <Icon className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" /> {field.label}
              </label>
              <div className="relative">
                <input
                  id={field.key}
                  type={field.type}
                  step={field.step}
                  placeholder={field.placeholder || `e.g. ${field.reference || 'value'}`}
                  value={value}
                  onChange={(e) => handleInputChange(field.key, field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                  className={`form-input ${error ? (error.severity === 'error' ? 'border-red-500 dark:border-red-400' : 'border-yellow-500 dark:border-yellow-400') : ''}`}
                />
                {error && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2" title={error.message}>
                    {error.severity === 'error' ? <AlertCircle className="h-5 w-5 text-red-500" /> :
                     error.severity === 'warning' ? <AlertCircle className="h-5 w-5 text-yellow-500" /> :
                     <Info className="h-5 w-5 text-blue-500" />}
                  </div>
                )}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] flex justify-between items-center min-h-[1.25rem]">
                <span>{field.help}</span>
                {field.reference && <span className="text-[var(--color-brand-secondary)] text-right">Ref: {field.reference}</span>}
              </div>
              {error && <p className={`text-xs ${error.severity === 'error' ? 'text-red-500' : error.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'}`}>{error.message}</p>}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center pt-6 mt-6 border-t border-[var(--color-border-primary)]">
        <div className={`flex items-center text-sm ${canPreview ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {canPreview ? <CheckCircle className="h-4 w-4 mr-1.5" /> : <AlertCircle className="h-4 w-4 mr-1.5" />}
          {canPreview ? 'Ready for preview' : (hasFatalErrors ? 'Fix errors to continue' : 'Fill required fields')}
        </div>
        <button onClick={onPreview} disabled={!canPreview} className="btn-primary">
          <Eye className="h-4 w-4 mr-2" /> Preview & Compare
        </button>
      </div>
    </div>
  );
}
// src/app/economy/components/EconomicInputForm.tsx
"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Eye,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Briefcase,
  Building,
} from "lucide-react";
import type { EconomicInputs, RealCountryData } from "../lib/economy-data-service";
import { getEconomicTier, createDefaultEconomicInputs } from "../lib/economy-data-service";
import { getTierStyle } from "~/lib/theme-utils";
import { CoreEconomicIndicatorsComponent } from "./CoreEconomicIndicators";
import { LaborEmploymentComponent } from "./LaborEmployment";
import { FiscalSystemComponent } from "./FiscalSystem";

interface EconomicInputFormProps {
  inputs: EconomicInputs;
  referenceCountry: RealCountryData;
  onInputsChange: (inputs: EconomicInputs) => void;
  onPreview: () => void;
  onBack: () => void;
}

interface ValidationError {
  field: string;
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
  const [activeSection, setActiveSection] = useState<'core' | 'labor' | 'fiscal'>('core');

  useEffect(() => {
    validateInputs();
  }, [inputs]);

  const validateInputs = () => {
    const newErrors: ValidationError[] = [];
    
    // Core Indicators Validation
    if (!inputs.countryName.trim()) {
      newErrors.push({ field: 'countryName', message: 'Country name is required', severity: 'error' });
    }
    if (inputs.coreIndicators.totalPopulation <= 0) {
      newErrors.push({ field: 'totalPopulation', message: 'Population must be > 0', severity: 'error' });
    }
    if (inputs.coreIndicators.gdpPerCapita <= 0) {
      newErrors.push({ field: 'gdpPerCapita', message: 'GDP p.c. must be > 0', severity: 'error' });
    }
    if (inputs.coreIndicators.realGDPGrowthRate < -10 || inputs.coreIndicators.realGDPGrowthRate > 15) {
      newErrors.push({ field: 'realGDPGrowthRate', message: 'GDP growth rate seems unrealistic', severity: 'warning' });
    }
    if (inputs.coreIndicators.inflationRate < 0 || inputs.coreIndicators.inflationRate > 20) {
      newErrors.push({ field: 'inflationRate', message: 'Inflation rate seems extreme', severity: 'warning' });
    }

    // Labor Validation
    if (inputs.laborEmployment.unemploymentRate < 0 || inputs.laborEmployment.unemploymentRate > 100) {
      newErrors.push({ field: 'unemploymentRate', message: 'Unemployment rate must be 0-100%', severity: 'error' });
    }
    if (inputs.laborEmployment.laborForceParticipationRate < 0 || inputs.laborEmployment.laborForceParticipationRate > 100) {
      newErrors.push({ field: 'laborForceParticipationRate', message: 'Labor participation must be 0-100%', severity: 'error' });
    }
    if (inputs.laborEmployment.minimumWage <= 0) {
      newErrors.push({ field: 'minimumWage', message: 'Minimum wage must be > 0', severity: 'error' });
    }

    // Fiscal Validation
    if (inputs.fiscalSystem.taxRevenueGDPPercent < 0 || inputs.fiscalSystem.taxRevenueGDPPercent > 100) {
      newErrors.push({ field: 'taxRevenueGDPPercent', message: 'Tax revenue % must be 0-100', severity: 'error' });
    }
    if (inputs.fiscalSystem.governmentBudgetGDPPercent < 0 || inputs.fiscalSystem.governmentBudgetGDPPercent > 100) {
      newErrors.push({ field: 'governmentBudgetGDPPercent', message: 'Budget % must be 0-100', severity: 'error' });
    }
    if (inputs.fiscalSystem.totalDebtGDPRatio > 200) {
      newErrors.push({ field: 'totalDebtGDPRatio', message: 'Very high debt levels may be unsustainable', severity: 'warning' });
    }

    setErrors(newErrors);
  };

  const handleCountryNameChange = (name: string) => {
    onInputsChange({ ...inputs, countryName: name });
  };

  const handleCoreIndicatorsChange = (coreIndicators: typeof inputs.coreIndicators) => {
    onInputsChange({ ...inputs, coreIndicators });
  };

  const handleLaborDataChange = (laborEmployment: typeof inputs.laborEmployment) => {
    onInputsChange({ ...inputs, laborEmployment });
  };

  const handleFiscalDataChange = (fiscalSystem: typeof inputs.fiscalSystem) => {
    onInputsChange({ ...inputs, fiscalSystem });
  };

  const hasFatalErrors = errors.some(e => e.severity === 'error');
  const canPreview = !hasFatalErrors && inputs.countryName.trim();

  const currentEconomicTier = getEconomicTier(inputs.coreIndicators.gdpPerCapita);
  const tierStyle = getTierStyle(currentEconomicTier);

  const sections = [
    { key: 'core', label: 'Core Indicators', icon: BarChart3 },
    { key: 'labor', label: 'Labor & Employment', icon: Briefcase },
    { key: 'fiscal', label: 'Fiscal System', icon: Building },
  ] as const;

  const calculateTotalGDP = () => inputs.coreIndicators.nominalGDP / 1e9; // Billions
  const calculateTaxRevenue = () => inputs.fiscalSystem.governmentRevenueTotal / 1e9; // Billions

  const formatNumber = (num: number, precision = 1): string => {
    if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(precision)}K`;
    return `$${num.toFixed(0)}`;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">Economic Framework</h2>
          <p className="text-[var(--color-text-muted)]">Building comprehensive economic model for {inputs.countryName || 'your nation'}</p>
        </div>
        <button onClick={onBack} className="btn-secondary text-sm py-1.5 px-3">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </button>
      </div>

      {/* Country Name Input */}
      <div className="mb-6">
        <label className="form-label">
          <Building className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
          Country Name
        </label>
        <input
          type="text"
          value={inputs.countryName}
          onChange={(e) => handleCountryNameChange(e.target.value)}
          className="form-input"
          placeholder={`New ${referenceCountry.name}`}
        />
      </div>

      {/* Economic Summary */}
      <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 mb-6 border border-[var(--color-border-primary)]">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Live Economic Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          {[
            {label: "Total GDP", value: formatNumber(inputs.coreIndicators.nominalGDP)},
            {label: "GDP per Capita", value: formatNumber(inputs.coreIndicators.gdpPerCapita)},
            {label: "Population", value: (inputs.coreIndicators.totalPopulation / 1e6).toFixed(1) + "M"},
            {label: "Tax Revenue", value: formatNumber(inputs.fiscalSystem.governmentRevenueTotal)},
            {label: "Economic Tier", value: <span className={`tier-badge ${tierStyle.className}`}>{currentEconomicTier}</span> },
          ].map(item => (
            <div key={item.label}>
              <span className="text-[var(--color-text-muted)]">{item.label}:</span>
              <div className="font-semibold text-[var(--color-text-primary)]">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section Navigation */}
      <div className="flex border-b border-[var(--color-border-primary)] mb-6">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.key;
          
          return (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-secondary)]'
              }`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {section.label}
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <div className="min-h-[600px]">
        {activeSection === 'core' && (
          <CoreEconomicIndicatorsComponent
            indicators={inputs.coreIndicators}
            referenceCountry={referenceCountry}
            onIndicatorsChange={handleCoreIndicatorsChange}
          />
        )}
        
        {activeSection === 'labor' && (
          <LaborEmploymentComponent
            laborData={inputs.laborEmployment}
            referenceCountry={referenceCountry}
            totalPopulation={inputs.coreIndicators.totalPopulation}
            onLaborDataChange={handleLaborDataChange}
          />
        )}
        
        {activeSection === 'fiscal' && (
          <FiscalSystemComponent
            fiscalData={inputs.fiscalSystem}
            referenceCountry={referenceCountry}
            nominalGDP={inputs.coreIndicators.nominalGDP}
            totalPopulation={inputs.coreIndicators.totalPopulation}
            onFiscalDataChange={handleFiscalDataChange}
          />
        )}
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="mb-6 space-y-2">
          {errors.slice(0, 3).map((error, index) => (
            <div key={index} className={`flex items-center text-sm p-2 rounded ${
              error.severity === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
              error.severity === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400' :
              'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
            }`}>
              {error.severity === 'error' ? <AlertCircle className="h-4 w-4 mr-2" /> : 
               <AlertCircle className="h-4 w-4 mr-2" />}
              {error.message}
            </div>
          ))}
          {errors.length > 3 && (
            <div className="text-xs text-[var(--color-text-muted)]">
              +{errors.length - 3} more validation {errors.length - 3 === 1 ? 'issue' : 'issues'}
            </div>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex justify-between items-center pt-6 mt-6 border-t border-[var(--color-border-primary)]">
        <div className={`flex items-center text-sm ${canPreview ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {canPreview ? <CheckCircle className="h-4 w-4 mr-1.5" /> : <AlertCircle className="h-4 w-4 mr-1.5" />}
          {canPreview ? 'Ready for preview' : (hasFatalErrors ? 'Fix errors to continue' : 'Fill required fields')}
          {errors.length > 0 && (
            <span className="ml-2 text-xs">
              ({errors.filter(e => e.severity === 'error').length} errors, {errors.filter(e => e.severity === 'warning').length} warnings)
            </span>
          )}
        </div>
        <button onClick={onPreview} disabled={!canPreview} className="btn-primary">
          <Eye className="h-4 w-4 mr-2" /> Preview & Compare
        </button>
      </div>
    </div>
  );
}

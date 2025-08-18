// src/app/builder/components/EconomicInputForm.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Eye,
  CheckCircle,
  BarChart3,
  Briefcase,
  Scale,
  Building2,
  Users,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import type { EconomicInputs, RealCountryData } from "../lib/economy-data-service";
import { getEconomicTier } from "../lib/economy-data-service";
import { getTierStyle } from "~/lib/theme-utils";
import { CoreEconomicIndicatorsComponent } from "./CoreEconomicIndicators";
import { LaborEmploymentComponent } from "./LaborEmployment";
import { FiscalSystemComponent } from "./FiscalSystem";
import { IncomeWealthDistribution } from "./IncomeWealthDistribution";
import { GovernmentSpending } from "./GovernmentSpending";
import { Demographics } from "./Demographics";
import { CountrySymbolsUploader } from "./CountrySymbolsUploader";
import type { DemographicsData } from "~/types/economics";
import type { GovernmentSpendingData } from '~/types/economics';
import {
  BuilderHeader,
  CountryNameInput,
  EconomicOverview,
  SectionNavigation,
  SectionContent,
  ValidationDisplay,
  type Section,
  type ValidationError,
} from "../primitives";

interface EconomicInputFormProps {
  inputs: EconomicInputs;
  referenceCountry: RealCountryData;
  onInputsChange: (inputs: EconomicInputs) => void;
  onPreview: () => void;
  onBack: () => void;
}

export function EconomicInputForm({
  inputs,
  referenceCountry,
  onInputsChange,
  onPreview,
  onBack
}: EconomicInputFormProps) {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [activeSection, setActiveSection] = useState<'core' | 'labor' | 'fiscal' | 'income' | 'spending' | 'demographics'>('core');

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

    // Income & Wealth Validation
    if (inputs.incomeWealth.incomeInequalityGini < 0 || inputs.incomeWealth.incomeInequalityGini > 1) {
      newErrors.push({ field: 'incomeInequalityGini', message: 'Gini coefficient must be between 0-1', severity: 'error' });
    }
    if (inputs.incomeWealth.povertyRate < 0 || inputs.incomeWealth.povertyRate > 100) {
      newErrors.push({ field: 'povertyRate', message: 'Poverty rate must be 0-100%', severity: 'error' });
    }
    
    // Demographics Validation
    if (inputs.demographics.lifeExpectancy < 30 || inputs.demographics.lifeExpectancy > 100) {
      newErrors.push({ field: 'lifeExpectancy', message: 'Life expectancy seems unrealistic', severity: 'warning' });
    }
    if (inputs.demographics.literacyRate < 0 || inputs.demographics.literacyRate > 100) {
      newErrors.push({ field: 'literacyRate', message: 'Literacy rate must be 0-100%', severity: 'error' });
    }

    setErrors(newErrors);
  };

  const handleCountryNameChange = (name: string) => {
    onInputsChange({ ...inputs, countryName: name });
  };

  const handleSymbolsChange = (flagUrl: string, coatOfArmsUrl: string) => {
    onInputsChange({ ...inputs, flagUrl, coatOfArmsUrl });
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

  const handleIncomeWealthChange = (incomeWealth: typeof inputs.incomeWealth) => {
    onInputsChange({ ...inputs, incomeWealth });
  };

  const handleGovernmentSpendingChange = (governmentSpending: GovernmentSpendingData) => {
    onInputsChange({ ...inputs, governmentSpending });
  };

  const handleDemographicsChange = (demographics: typeof inputs.demographics) => {
    onInputsChange({ ...inputs, demographics });
  };

  const hasFatalErrors = errors.some(e => e.severity === 'error');
  const canPreview = !hasFatalErrors && inputs.countryName.trim();

  const currentEconomicTier = getEconomicTier(inputs.coreIndicators.gdpPerCapita);
  const tierStyle = getTierStyle(currentEconomicTier);

  const sections: Section[] = [
    { 
      key: 'core', 
      label: 'Core Indicators', 
      icon: BarChart3,
      description: 'Set basic economic metrics like GDP, population, growth rates, and inflation.'
    },
    { 
      key: 'labor', 
      label: 'Labor & Employment', 
      icon: Briefcase,
      description: 'Configure unemployment rates, labor force participation, wages, and employment by sector.'
    },
    { 
      key: 'fiscal', 
      label: 'Fiscal System', 
      icon: Scale,
      description: 'Define tax structure, government revenue sources, debt levels, and fiscal balance.'
    },
    { 
      key: 'income', 
      label: 'Income & Wealth', 
      icon: Building2,
      description: 'Set income distribution, wealth inequality (Gini coefficient), and wealth concentration.'
    },
    { 
      key: 'spending', 
      label: 'Gov. Spending', 
      icon: Building2,
      description: 'Allocate government budget across sectors like healthcare, education, defense, and infrastructure.'
    },
    { 
      key: 'demographics', 
      label: 'Demographics', 
      icon: Users,
      description: 'Configure population structure, age distribution, birth/death rates, and migration patterns.'
    }
  ];

  const calculateTotalGDP = () => inputs.coreIndicators.nominalGDP / 1e9; // Billions
  const calculateTaxRevenue = () => inputs.fiscalSystem.governmentRevenueTotal / 1e9; // Billions

  const formatNumber = (num: number, precision = 1): string => {
    if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(precision)}K`;
    return `$${num.toFixed(0)}`;
  };

  const economicMetrics = [
    {label: "Total GDP", value: formatNumber(inputs.coreIndicators.nominalGDP)},
    {label: "GDP per Capita", value: formatNumber(inputs.coreIndicators.gdpPerCapita)},
    {label: "Population", value: (inputs.coreIndicators.totalPopulation / 1e6).toFixed(1) + "M"},
    {label: "Tax Revenue", value: formatNumber(inputs.fiscalSystem.governmentRevenueTotal)},
    {label: "Economic Tier", value: <span className={`tier-badge ${tierStyle.className}`}>{currentEconomicTier}</span> },
  ];

  return (
    <div className="p-6">
      <BuilderHeader
        title="Customize Your Country"
        subtitle={`Fine-tune the economic parameters for ${inputs.countryName || 'your custom nation'}`}
        onBack={onBack}
      />

      <CountryNameInput
        value={inputs.countryName}
        onChange={handleCountryNameChange}
        placeholder={`New ${referenceCountry.name}`}
      />

      <CountrySymbolsUploader
        flagUrl={inputs.flagUrl || ""}
        coatOfArmsUrl={inputs.coatOfArmsUrl || ""}
        onUrlsChange={handleSymbolsChange}
      />

      <EconomicOverview metrics={economicMetrics} />

      <SectionNavigation
        sections={sections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <SectionContent>
        {activeSection === 'core' && (
          <CoreEconomicIndicatorsComponent
            indicators={inputs.coreIndicators}
            referenceCountry={referenceCountry}
            onIndicatorsChangeAction={handleCoreIndicatorsChange}
          />
        )}
        
        {activeSection === 'labor' && (
          <LaborEmploymentComponent
            laborData={inputs.laborEmployment}
            referenceCountry={referenceCountry}
            totalPopulation={inputs.coreIndicators.totalPopulation}
            onLaborDataChangeAction={handleLaborDataChange}
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

        {activeSection === 'income' && (
          <IncomeWealthDistribution
            incomeData={inputs.incomeWealth}
            totalPopulation={inputs.coreIndicators.totalPopulation}
            gdpPerCapita={inputs.coreIndicators.gdpPerCapita}
            onIncomeDataChange={handleIncomeWealthChange}
          />
        )}

        {activeSection === 'spending' && (
          <GovernmentSpending
            spendingData={inputs.governmentSpending}
            nominalGDP={inputs.coreIndicators.nominalGDP}
            totalPopulation={inputs.coreIndicators.totalPopulation}
            onSpendingDataChangeAction={(spendingData: GovernmentSpendingData) => handleGovernmentSpendingChange(spendingData)}
          />
        )}

        {activeSection === 'demographics' && (
          <Demographics
            demographicData={inputs.demographics}
            totalPopulation={inputs.coreIndicators.totalPopulation}
            onDemographicDataChange={(demographicData: DemographicsData) => handleDemographicsChange(demographicData as typeof inputs.demographics)}
          />
        )}
      </SectionContent>

      <ValidationDisplay errors={errors} className="mb-6" />

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

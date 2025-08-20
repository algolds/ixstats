"use client";

import React from 'react';
import { FoundationArchetypeSelector } from '../primitives/FoundationArchetypeSelector';
import { CoreEconomicIndicatorsComponent as CoreEconomicIndicators } from './CoreEconomicIndicators';
import { Demographics } from './Demographics';
import { FiscalSystemComponent as FiscalSystem } from './FiscalSystem';
import { GovernmentSpending } from './GovernmentSpending';
import { LaborEmploymentComponent as LaborEmployment } from './LaborEmployment';
import { IncomeWealthDistribution } from './IncomeWealthDistribution';
import { CountrySymbolsUploader } from './CountrySymbolsUploader';
import { CountryPreview } from '../primitives/CountryPreview';
import type { EconomicInputs, RealCountryData } from '../lib/economy-data-service';

interface BuilderHubProps {
  inputs: EconomicInputs;
  onInputsChange: (newInputs: EconomicInputs) => void;
  onPreview: () => void;
  onBack: () => void;
  selectedCountry: RealCountryData | null;
  countries: RealCountryData[];
  selectedArchetypes: string[]; // Changed to array
  onArchetypeSelect: (archetypeIds: string[]) => void; // Changed to handle array
}

export function BuilderHub({ inputs, onInputsChange, onPreview, onBack, selectedCountry, countries, selectedArchetypes, onArchetypeSelect }: BuilderHubProps) {
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

  const handleGovernmentSpendingChange = (governmentSpending: typeof inputs.governmentSpending) => {
    onInputsChange({ ...inputs, governmentSpending });
  };

  const handleDemographicsChange = (demographics: typeof inputs.demographics) => {
    onInputsChange({ ...inputs, demographics });
  };

  const handleSymbolsChange = (flagUrl: string, coatOfArmsUrl: string) => {
    onInputsChange({ ...inputs, flagUrl, coatOfArmsUrl });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <FoundationArchetypeSelector countries={countries} selectedArchetypes={selectedArchetypes} onArchetypeSelect={onArchetypeSelect} />
        <CoreEconomicIndicators indicators={inputs.coreIndicators} onIndicatorsChangeAction={handleCoreIndicatorsChange} referenceCountry={selectedCountry ?? undefined} />
        <Demographics demographicData={inputs.demographics} totalPopulation={inputs.coreIndicators.totalPopulation} onDemographicDataChange={handleDemographicsChange} />
        <FiscalSystem fiscalData={inputs.fiscalSystem} nominalGDP={inputs.coreIndicators.nominalGDP} totalPopulation={inputs.coreIndicators.totalPopulation} onFiscalDataChange={handleFiscalDataChange} referenceCountry={selectedCountry ?? undefined} />
        <GovernmentSpending spendingData={inputs.governmentSpending} nominalGDP={inputs.coreIndicators.nominalGDP} totalPopulation={inputs.coreIndicators.totalPopulation} onSpendingDataChangeAction={handleGovernmentSpendingChange} />
        <LaborEmployment laborData={inputs.laborEmployment} totalPopulation={inputs.coreIndicators.totalPopulation} onLaborDataChangeAction={handleLaborDataChange} referenceCountry={selectedCountry ?? undefined} />
        <IncomeWealthDistribution incomeData={inputs.incomeWealth} totalPopulation={inputs.coreIndicators.totalPopulation} gdpPerCapita={inputs.coreIndicators.gdpPerCapita} onIncomeDataChange={handleIncomeWealthChange} />
        <CountrySymbolsUploader flagUrl={inputs.flagUrl ?? ""} coatOfArmsUrl={inputs.coatOfArmsUrl ?? ""} onSelectFlag={() => console.log("Select Flag clicked")} onSelectCoatOfArms={() => console.log("Select Coat of Arms clicked")} />
        <div className="flex justify-between mt-8">
          <button onClick={onBack} className="btn-secondary">Back</button>
          <button onClick={onPreview} className="btn-primary">Preview</button>
        </div>
      </div>
      <div>
        {selectedCountry && <CountryPreview country={selectedCountry} />}
      </div>
    </div>
  );
}
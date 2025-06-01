export type Country = {
  id: string;
  name: string;
  population?: number;
  economicData?: {
    gdp?: number;
  };
};

export type EconomicYearData = {
  year: number;
  gdp?: number;
  inflation?: number;
  unemployment?: number;
};

export type DMInputs = {
  id: string;
  countryId: string;
};

export type EconomicModel = {
  id: string;
  countryId: string;
  baseYear: number;
  projectionYears: number;
  gdpGrowthRate: number;
  inflationRate: number;
  unemploymentRate: number;
  interestRate: number;
  exchangeRate: number;
  populationGrowthRate: number;
  investmentRate: number;
  fiscalBalance: number;
  tradeBalance: number;
  sectoralOutputs: SectoralOutput[];
  policyEffects: PolicyEffect[];
};

export type SectoralOutput = {
  year: number;
  agriculture: number;
  industry: number;
  services: number;
  government: number;
  totalGDP: number;
};

export type PolicyEffect = {
  id: string;
  name: string;
  description: string;
  gdpEffectPercentage: number;
  inflationEffectPercentage: number;
  employmentEffectPercentage: number;
  yearImplemented: number;
  durationYears: number;
  economicModelId: string;
}; 
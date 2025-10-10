// Economy Builder Calculation Engine
// Real-time calculations for economic metrics

import type {
  EmploymentData,
  IncomeData,
  SectorData,
  TradeData,
  ProductivityData,
  BusinessData,
  EconomicHealthData,
  ComprehensiveEconomyData
} from '../types/economy';

// ==================== DEFAULT DATA GENERATORS ====================

export function generateDefaultEmploymentData(
  totalPopulation: number,
  unemploymentRate: number = 5.0,
  participationRate: number = 63.0
): EmploymentData {
  const workingAgePopulation = totalPopulation * 0.65;
  const totalWorkforce = Math.round(workingAgePopulation * (participationRate / 100));
  
  return {
    totalWorkforce,
    laborForceParticipationRate: participationRate,
    employmentRate: 100 - unemploymentRate,
    unemploymentRate,
    underemploymentRate: unemploymentRate * 0.6, // typically 60% of unemployment
    
    youthUnemploymentRate: unemploymentRate * 2.2, // typically 2.2x overall rate
    seniorEmploymentRate: 55, // typical for 55+ age group
    femaleParticipationRate: participationRate * 0.85, // typically 85% of overall
    maleParticipationRate: participationRate * 1.15, // typically 115% of overall
    
    sectorDistribution: {
      agriculture: 3.5,
      mining: 0.8,
      manufacturing: 12.5,
      construction: 6.5,
      utilities: 1.2,
      wholesale: 5.5,
      retail: 11.0,
      transportation: 4.8,
      information: 3.2,
      finance: 5.5,
      professional: 13.5,
      education: 9.0,
      healthcare: 14.0,
      hospitality: 7.5,
      government: 15.0,
      other: 6.5
    },
    
    employmentType: {
      fullTime: 72.0,
      partTime: 18.5,
      temporary: 4.5,
      seasonal: 2.0,
      selfEmployed: 9.5,
      gig: 5.5,
      informal: 3.0
    },
    
    averageWorkweekHours: 38.5,
    averageOvertimeHours: 3.2,
    paidVacationDays: 15,
    paidSickLeaveDays: 8,
    parentalLeaveWeeks: 12,
    
    unionizationRate: 12.5,
    collectiveBargainingCoverage: 18.0,
    minimumWageHourly: 12.50,
    livingWageHourly: 18.75,
    workplaceSafetyIndex: 72,
    laborRightsScore: 68
  };
}

export function generateDefaultIncomeData(
  gdpPerCapita: number,
  giniCoefficient: number = 0.38
): IncomeData {
  // Estimate median income as ~70% of mean income for typical distribution
  const nationalMeanIncome = gdpPerCapita * 0.85;
  const nationalMedianIncome = nationalMeanIncome * 0.72;
  
  // Calculate income percentiles based on Gini
  const p10 = nationalMedianIncome * 0.35;
  const p25 = nationalMedianIncome * 0.55;
  const p50 = nationalMedianIncome;
  const p75 = nationalMedianIncome * 1.65;
  const p90 = nationalMedianIncome * 2.8;
  const p95 = nationalMedianIncome * 4.2;
  const p99 = nationalMedianIncome * 8.5;
  const p99_9 = nationalMedianIncome * 25;
  
  return {
    nationalMedianIncome,
    nationalMeanIncome,
    nationalMedianWage: nationalMedianIncome * 0.95,
    nationalMeanWage: nationalMeanIncome * 0.95,
    
    incomePercentiles: {
      p10, p25, p50, p75, p90, p95, p99, p99_9
    },
    
    incomeClasses: {
      lowerClass: { 
        percent: 18.0, 
        averageIncome: p10 * 1.3, 
        threshold: p10 * 1.8 
      },
      lowerMiddleClass: { 
        percent: 22.0, 
        averageIncome: p25 * 1.2, 
        threshold: p25 * 1.6 
      },
      middleClass: { 
        percent: 32.0, 
        averageIncome: p50 * 1.1, 
        threshold: p50 * 1.5 
      },
      upperMiddleClass: { 
        percent: 18.0, 
        averageIncome: p75 * 1.15, 
        threshold: p75 * 1.4 
      },
      upperClass: { 
        percent: 8.0, 
        averageIncome: p90 * 1.3, 
        threshold: p90 * 1.8 
      },
      wealthyClass: { 
        percent: 2.0, 
        averageIncome: p99 * 1.5, 
        threshold: p99 
      }
    },
    
    giniCoefficient,
    palmRatio: (p90 / (p10 * 4)), // Top 10% to Bottom 40% ratio
    incomeShare: {
      bottom50: 22.0,
      middle40: 43.0,
      top10: 35.0,
      top1: 15.0
    },
    
    povertyLine: nationalMedianIncome * 0.5,
    povertyRate: 12.5,
    extremePovertyRate: 3.2,
    childPovertyRate: 16.8,
    seniorPovertyRate: 9.5,
    
    averageWageBySector: {
      agriculture: nationalMeanIncome * 0.45,
      mining: nationalMeanIncome * 1.35,
      manufacturing: nationalMeanIncome * 0.85,
      construction: nationalMeanIncome * 0.78,
      utilities: nationalMeanIncome * 1.42,
      wholesale: nationalMeanIncome * 0.88,
      retail: nationalMeanIncome * 0.52,
      transportation: nationalMeanIncome * 0.72,
      information: nationalMeanIncome * 1.58,
      finance: nationalMeanIncome * 1.85,
      professional: nationalMeanIncome * 1.45,
      education: nationalMeanIncome * 0.82,
      healthcare: nationalMeanIncome * 0.95,
      hospitality: nationalMeanIncome * 0.48,
      government: nationalMeanIncome * 1.12
    },
    
    genderPayGap: 18.5,
    racialWageGap: 22.0,
    urbanRuralIncomeGap: 35.0,
    
    socialMobilityIndex: 58,
    interGenerationalElasticity: 0.42,
    economicMobilityRate: 12.5
  };
}

export function generateDefaultSectorData(gdpPerCapita: number): SectorData {
  // Determine economy type based on GDP per capita
  const isAdvanced = gdpPerCapita > 35000;
  const isEmerging = gdpPerCapita > 15000 && gdpPerCapita <= 35000;
  
  return {
    sectorGDPContribution: {
      agriculture: isAdvanced ? 1.5 : isEmerging ? 8.5 : 18.0,
      mining: isAdvanced ? 2.0 : isEmerging ? 5.5 : 8.5,
      manufacturing: isAdvanced ? 12.0 : isEmerging ? 22.0 : 14.0,
      construction: 6.5,
      utilities: 2.5,
      wholesale: 5.5,
      retail: 6.0,
      transportation: 4.5,
      information: isAdvanced ? 8.5 : isEmerging ? 5.0 : 2.5,
      finance: isAdvanced ? 12.0 : isEmerging ? 8.5 : 4.5,
      professional: isAdvanced ? 15.5 : isEmerging ? 9.0 : 5.0,
      education: 6.5,
      healthcare: isAdvanced ? 11.0 : isEmerging ? 7.0 : 3.5,
      hospitality: 4.0,
      government: 12.0,
      other: 5.5
    },
    
    sectorGrowthRates: {
      agriculture: isAdvanced ? 1.2 : isEmerging ? 3.5 : 2.8,
      manufacturing: isAdvanced ? 2.5 : isEmerging ? 6.5 : 5.2,
      services: isAdvanced ? 3.2 : isEmerging ? 5.8 : 4.5,
      technology: isAdvanced ? 8.5 : isEmerging ? 12.5 : 6.0,
      finance: isAdvanced ? 4.2 : isEmerging ? 7.5 : 5.5,
      construction: 3.8,
      retail: 2.5
    },
    
    economicStructure: {
      primarySector: isAdvanced ? 3.5 : isEmerging ? 14.0 : 26.5,
      secondarySector: isAdvanced ? 20.5 : isEmerging ? 28.5 : 22.5,
      tertiarySector: isAdvanced ? 58.0 : isEmerging ? 52.5 : 48.0,
      quaternarySector: isAdvanced ? 18.0 : isEmerging ? 5.0 : 3.0
    },
    
    sectorProductivity: {
      agriculture: isAdvanced ? 165 : isEmerging ? 95 : 62,
      manufacturing: isAdvanced ? 142 : isEmerging ? 108 : 78,
      services: isAdvanced ? 118 : isEmerging ? 96 : 82,
      technology: isAdvanced ? 185 : isEmerging ? 145 : 95,
      overall: 100
    },
    
    researchDevelopmentGDPPercent: isAdvanced ? 2.85 : isEmerging ? 1.25 : 0.45,
    patentsPerCapita: isAdvanced ? 0.025 : isEmerging ? 0.008 : 0.002,
    techAdoptionIndex: isAdvanced ? 82 : isEmerging ? 58 : 35,
    digitalEconomyShare: isAdvanced ? 18.5 : isEmerging ? 9.5 : 4.2
  };
}

export function generateDefaultTradeData(
  nominalGDP: number,
  gdpPerCapita: number
): TradeData {
  const isAdvanced = gdpPerCapita > 35000;
  const exportShare = isAdvanced ? 28 : 22;
  const importShare = isAdvanced ? 26 : 25;
  
  const totalExports = nominalGDP * (exportShare / 100);
  const totalImports = nominalGDP * (importShare / 100);
  
  return {
    totalExports,
    totalImports,
    tradeBalance: totalExports - totalImports,
    exportsGDPPercent: exportShare,
    importsGDPPercent: importShare,
    
    exportComposition: {
      goods: 65.0,
      services: 35.0,
      commodities: 12.0,
      manufactured: 45.0,
      technology: isAdvanced ? 28.0 : 8.0,
      agricultural: isAdvanced ? 5.0 : 18.0
    },
    
    importComposition: {
      goods: 70.0,
      services: 30.0,
      commodities: 22.0,
      manufactured: 38.0,
      technology: 25.0,
      agricultural: 8.0
    },
    
    tradingPartners: [
      { country: 'Partner A', exportsTo: totalExports * 0.22, importsFrom: totalImports * 0.18, tradeBalance: totalExports * 0.22 - totalImports * 0.18 },
      { country: 'Partner B', exportsTo: totalExports * 0.18, importsFrom: totalImports * 0.25, tradeBalance: totalExports * 0.18 - totalImports * 0.25 },
      { country: 'Partner C', exportsTo: totalExports * 0.15, importsFrom: totalImports * 0.15, tradeBalance: 0 }
    ],
    
    freeTradeAgreements: isAdvanced ? 12 : 6,
    customsUnionMembership: false,
    wtoMembership: true,
    
    foreignDirectInvestmentInflow: nominalGDP * 0.035,
    foreignDirectInvestmentOutflow: nominalGDP * 0.028,
    foreignExchangeReserves: nominalGDP * 0.18,
    currentAccountBalance: (totalExports - totalImports) * 1.15,
    currentAccountGDPPercent: ((totalExports - totalImports) * 1.15 / nominalGDP) * 100,
    
    tradeOpennessIndex: (totalExports + totalImports) / nominalGDP,
    economicComplexityIndex: isAdvanced ? 1.45 : 0.25,
    exportDiversificationIndex: isAdvanced ? 0.72 : 0.45
  };
}

export function generateDefaultProductivityData(gdpPerCapita: number): ProductivityData {
  const isAdvanced = gdpPerCapita > 35000;
  
  return {
    laborProductivityIndex: isAdvanced ? 125 : 85,
    laborProductivityGrowthRate: isAdvanced ? 1.8 : 3.5,
    multifactorProductivityGrowth: isAdvanced ? 0.9 : 1.8,
    
    capitalProductivity: isAdvanced ? 0.42 : 0.35,
    capitalIntensity: isAdvanced ? 285000 : 95000,
    returnOnInvestedCapital: isAdvanced ? 9.5 : 12.5,
    
    energyEfficiency: isAdvanced ? 9.2 : 4.8,
    resourceProductivity: isAdvanced ? 2.8 : 1.2,
    
    globalCompetitivenessIndex: isAdvanced ? 78 : 52,
    innovationIndex: isAdvanced ? 72 : 45,
    infrastructureQualityIndex: isAdvanced ? 82 : 58,
    institutionalQualityIndex: isAdvanced ? 75 : 48,
    
    averageEducationYears: isAdvanced ? 13.5 : 9.2,
    tertiaryEducationRate: isAdvanced ? 48.5 : 22.0,
    skillsIndex: isAdvanced ? 76 : 52,
    brainDrainIndex: isAdvanced ? 22 : 58
  };
}

export function generateDefaultBusinessData(
  totalPopulation: number,
  gdpPerCapita: number
): BusinessData {
  const isAdvanced = gdpPerCapita > 35000;
  const totalBusinesses = Math.round(totalPopulation * 0.05);
  
  return {
    totalBusinesses,
    smallBusinesses: Math.round(totalBusinesses * 0.85),
    mediumBusinesses: Math.round(totalBusinesses * 0.12),
    largeBusinesses: Math.round(totalBusinesses * 0.03),
    startupFormationRate: isAdvanced ? 8.5 : 4.2,
    businessFailureRate: 12.5,
    
    easeOfDoingBusinessRank: isAdvanced ? 25 : 85,
    timeToStartBusiness: isAdvanced ? 5 : 18,
    costToStartBusiness: isAdvanced ? 1.2 : 8.5,
    corporateRegistrationRate: isAdvanced ? 95 : 65,
    
    domesticInvestmentGDPPercent: isAdvanced ? 22.0 : 18.5,
    foreignInvestmentGDPPercent: 3.5,
    grossCapitalFormation: isAdvanced ? 23.5 : 20.0,
    investmentGrowthRate: 4.2,
    
    domesticCreditToPrivateSector: isAdvanced ? 145.0 : 65.0,
    interestRateCommercial: isAdvanced ? 4.5 : 8.5,
    interestRateSavings: isAdvanced ? 1.2 : 3.5,
    bankLendingRate: isAdvanced ? 5.2 : 9.8,
    
    entrepreneurshipRate: isAdvanced ? 14.5 : 8.2,
    venturCapitalAvailability: isAdvanced ? 72 : 38,
    accessToFinanceScore: isAdvanced ? 78 : 52,
    regulatoryQualityIndex: isAdvanced ? 82 : 55
  };
}

export function generateDefaultEconomicHealthData(
  gdpGrowthRate: number,
  inflationRate: number,
  publicDebtGDP: number
): EconomicHealthData {
  return {
    gdpGrowthRateCurrent: gdpGrowthRate,
    gdpGrowthRate5YearAverage: gdpGrowthRate * 0.95,
    potentialGDPGrowthRate: gdpGrowthRate * 1.15,
    outputGap: 1.2,
    
    inflationRateCurrent: inflationRate,
    inflationRate5YearAverage: inflationRate * 1.05,
    inflationTargetRate: 2.0,
    coreInflationRate: inflationRate * 0.9,
    priceStabilityIndex: Math.max(0, 100 - Math.abs(inflationRate - 2) * 15),
    
    economicVolatilityIndex: 35,
    recessionRiskIndex: 28,
    financialStabilityIndex: 72,
    
    budgetBalanceGDPPercent: -2.5,
    structuralBalanceGDPPercent: -1.8,
    publicDebtGDPPercent: publicDebtGDP,
    debtSustainabilityScore: Math.max(0, 100 - publicDebtGDP * 0.8),
    
    externalDebtGDPPercent: publicDebtGDP * 0.35,
    debtServiceRatio: 12.5,
    reserveCoverMonths: 5.5,
    
    economicHealthScore: 68,
    sustainabilityScore: 72,
    resilienceScore: 65
  };
}

// ==================== CALCULATIONS ====================

export function calculateComprehensiveEconomy(
  totalPopulation: number,
  nominalGDP: number,
  gdpPerCapita: number,
  gdpGrowthRate: number,
  inflationRate: number,
  unemploymentRate: number,
  giniCoefficient: number = 0.38,
  publicDebtGDP: number = 60
): ComprehensiveEconomyData {
  return {
    employment: generateDefaultEmploymentData(totalPopulation, unemploymentRate),
    income: generateDefaultIncomeData(gdpPerCapita, giniCoefficient),
    sectors: generateDefaultSectorData(gdpPerCapita),
    trade: generateDefaultTradeData(nominalGDP, gdpPerCapita),
    productivity: generateDefaultProductivityData(gdpPerCapita),
    business: generateDefaultBusinessData(totalPopulation, gdpPerCapita),
    health: generateDefaultEconomicHealthData(gdpGrowthRate, inflationRate, publicDebtGDP),
    
    dataQuality: 85,
    lastUpdated: new Date(),
    sourceReliability: 'high',
    coveragePeriod: {
      start: new Date(new Date().getFullYear() - 1, 0, 1),
      end: new Date()
    }
  };
}

// ==================== METRIC CALCULATORS ====================

export function calculateEconomicHealth(data: Partial<ComprehensiveEconomyData>): number {
  if (!data.health) return 50;
  
  const weights = {
    growth: 0.25,
    inflation: 0.20,
    employment: 0.25,
    debt: 0.15,
    trade: 0.15
  };
  
  const growthScore = Math.min(100, Math.max(0, (data.health.gdpGrowthRateCurrent + 2) * 20));
  const inflationScore = Math.max(0, 100 - Math.abs(data.health.inflationRateCurrent - 2) * 15);
  const employmentScore = data.employment ? (data.employment.employmentRate) : 50;
  const debtScore = Math.max(0, 100 - data.health.publicDebtGDPPercent * 0.8);
  const tradeScore = data.trade ? Math.min(100, data.trade.tradeOpennessIndex * 100) : 50;
  
  return (
    growthScore * weights.growth +
    inflationScore * weights.inflation +
    employmentScore * weights.employment +
    debtScore * weights.debt +
    tradeScore * weights.trade
  );
}

export function calculateSustainabilityScore(data: Partial<ComprehensiveEconomyData>): number {
  if (!data.health || !data.productivity) return 50;
  
  const debtSustainability = Math.max(0, 100 - data.health.publicDebtGDPPercent * 0.8);
  const productivityGrowth = Math.min(100, (data.productivity.laborProductivityGrowthRate + 1) * 25);
  const innovationScore = data.productivity.innovationIndex;
  
  return (debtSustainability * 0.4 + productivityGrowth * 0.3 + innovationScore * 0.3);
}


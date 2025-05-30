// src/app/economy/lib/enhanced-economy-data-service.ts
//  Business logic & calculations

import type { EnhancedEconomicInputs, CountryComparison, EconomicHint } from "./enhanced-economic-types";
import type { RealCountryData } from "./economy-data-service";
import { getEconomicTier } from "./economy-data-service";

export interface EnhancedCountryProfile {
  basic: EnhancedEconomicInputs;
  calculated: {
    totalGDP: number;
    realTotalGDP: number;
    taxRevenue: number;
    governmentBudget: number;
    budgetBalance: number;
    budgetBalancePercent: number;
    totalDebt: number;
    debtToGDPRatio: number;
    laborForce: number;
    employedPopulation: number;
    unemployedPopulation: number;
    economicHealthScore: number;
    productivityPerWorker: number;
    taxBurdenPerCapita: number;
    governmentEfficiencyRatio: number;
  };
  comparisons: CountryComparison[];
  hints: EconomicHint[];
  ixTimeData: {
    baselineDate: number;
    lastUpdated: number;
    projectedGrowth: {
      oneYear: { gdp: number; population: number };
      fiveYear: { gdp: number; population: number };
      tenYear: { gdp: number; population: number };
    };
  };
}

export class EnhancedEconomyDataService {
  
  /**
   * Calculate comprehensive metrics from enhanced economic inputs
   */
  static calculateMetrics(inputs: EnhancedEconomicInputs): EnhancedCountryProfile['calculated'] {
    // Basic calculations
    const totalGDP = inputs.population * inputs.gdpPerCapita;
    const realTotalGDP = totalGDP * (1 + inputs.realGDPGrowthRate);
    const taxRevenue = totalGDP * (inputs.taxRevenuePercent / 100);
    const governmentBudget = totalGDP * (inputs.governmentBudgetPercent / 100);
    const budgetBalance = taxRevenue - governmentBudget;
    const budgetBalancePercent = (budgetBalance / totalGDP) * 100;
    const totalDebt = totalGDP * ((inputs.internalDebtPercent + inputs.externalDebtPercent) / 100);
    const debtToGDPRatio = inputs.internalDebtPercent + inputs.externalDebtPercent;

    // Labor market calculations
    const workingAgePopulation = inputs.population * 0.65;
    const laborForce = workingAgePopulation * (inputs.laborForceParticipationRate / 100);
    const employedPopulation = laborForce * (1 - inputs.unemploymentRate / 100);
    const unemployedPopulation = laborForce - employedPopulation;

    // Advanced calculations
    const productivityPerWorker = totalGDP / employedPopulation;
    const taxBurdenPerCapita = taxRevenue / inputs.population;
    const governmentEfficiencyRatio = governmentBudget / inputs.population;

    // Economic health score (0-100)
    const economicHealthScore = this.calculateEconomicHealthScore(inputs);

    return {
      totalGDP,
      realTotalGDP,
      taxRevenue,
      governmentBudget,
      budgetBalance,
      budgetBalancePercent,
      totalDebt,
      debtToGDPRatio,
      laborForce,
      employedPopulation,
      unemployedPopulation,
      economicHealthScore,
      productivityPerWorker,
      taxBurdenPerCapita,
      governmentEfficiencyRatio
    };
  }

  /**
   * Calculate comprehensive economic health score
   */
  private static calculateEconomicHealthScore(inputs: EnhancedEconomicInputs): number {
    let score = 50; // Base score

    // GDP per capita contribution (0-20 points)
    if (inputs.gdpPerCapita >= 50000) score += 20;
    else if (inputs.gdpPerCapita >= 35000) score += 15;
    else if (inputs.gdpPerCapita >= 25000) score += 10;
    else if (inputs.gdpPerCapita >= 15000) score += 5;
    else if (inputs.gdpPerCapita < 5000) score -= 10;

    // Employment health (0-15 points)
    if (inputs.unemploymentRate <= 3) score += 15;
    else if (inputs.unemploymentRate <= 5) score += 12;
    else if (inputs.unemploymentRate <= 8) score += 8;
    else if (inputs.unemploymentRate <= 12) score += 4;
    else if (inputs.unemploymentRate >= 20) score -= 15;
    else if (inputs.unemploymentRate >= 15) score -= 10;

    // Fiscal health (0-15 points)
    const budgetBalance = inputs.taxRevenuePercent - inputs.governmentBudgetPercent;
    if (budgetBalance >= 2) score += 15;
    else if (budgetBalance >= 0) score += 10;
    else if (budgetBalance >= -3) score += 5;
    else if (budgetBalance >= -6) score -= 5;
    else score -= 15;

    // Debt sustainability (0-10 points)
    const totalDebt = inputs.internalDebtPercent + inputs.externalDebtPercent;
    if (totalDebt <= 40) score += 10;
    else if (totalDebt <= 60) score += 8;
    else if (totalDebt <= 90) score += 5;
    else if (totalDebt <= 120) score -= 5;
    else score -= 15;

    // Growth and inflation balance (0-10 points)
    if (inputs.realGDPGrowthRate >= 0.02 && inputs.realGDPGrowthRate <= 0.06) score += 5;
    else if (inputs.realGDPGrowthRate < 0) score -= 10;
    else if (inputs.realGDPGrowthRate > 0.10) score -= 5;

    if (inputs.inflationRate >= 0.015 && inputs.inflationRate <= 0.035) score += 5;
    else if (inputs.inflationRate < 0) score -= 10;
    else if (inputs.inflationRate > 0.08) score -= 10;

    // Labor force efficiency (0-5 points)
    if (inputs.laborForceParticipationRate >= 70) score += 5;
    else if (inputs.laborForceParticipationRate >= 60) score += 3;
    else if (inputs.laborForceParticipationRate < 50) score -= 5;

    // Tax efficiency (0-5 points)
    if (inputs.taxRevenuePercent >= 18 && inputs.taxRevenuePercent <= 35) score += 5;
    else if (inputs.taxRevenuePercent < 12 || inputs.taxRevenuePercent > 45) score -= 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Find similar countries based on comprehensive economic indicators
   */
  static findSimilarCountries(
    inputs: EnhancedEconomicInputs,
    allCountries: RealCountryData[]
  ): CountryComparison[] {
    return allCountries
      .filter(country => country.name !== "World")
      .map(country => {
        // Calculate similarity across multiple dimensions
        const gdpSimilarity = this.calculateSimilarity(inputs.gdpPerCapita, country.gdpPerCapita, 'logarithmic');
        const populationSimilarity = this.calculateSimilarity(inputs.population, country.population, 'logarithmic');
        const taxSimilarity = this.calculateSimilarity(inputs.taxRevenuePercent, country.taxRevenuePercent, 'linear');
        const unemploymentSimilarity = this.calculateSimilarity(inputs.unemploymentRate, country.unemploymentRate, 'linear');

        // Weighted similarity score
        const overallSimilarity = (
          gdpSimilarity * 0.4 +
          populationSimilarity * 0.2 +
          taxSimilarity * 0.25 +
          unemploymentSimilarity * 0.15
        ) * 100; // Convert to percentage

        // Identify key differences
        const keyDifferences = [
          {
            field: 'GDP per Capita',
            userValue: inputs.gdpPerCapita,
            countryValue: country.gdpPerCapita,
            difference: ((inputs.gdpPerCapita - country.gdpPerCapita) / country.gdpPerCapita) * 100
          },
          {
            field: 'Population',
            userValue: inputs.population,
            countryValue: country.population,
            difference: ((inputs.population - country.population) / country.population) * 100
          },
          {
            field: 'Tax Revenue %',
            userValue: inputs.taxRevenuePercent,
            countryValue: country.taxRevenuePercent,
            difference: inputs.taxRevenuePercent - country.taxRevenuePercent
          },
          {
            field: 'Unemployment %',
            userValue: inputs.unemploymentRate,
            countryValue: country.unemploymentRate,
            difference: inputs.unemploymentRate - country.unemploymentRate
          }
        ].filter(diff => Math.abs(diff.difference) > 10); // Only significant differences

        return {
          countryName: country.name,
          similarity: overallSimilarity,
          matchingFields: this.getMatchingFields(inputs, country),
          keyDifferences
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);
  }

  /**
   * Calculate similarity between two values
   */
  private static calculateSimilarity(
    value1: number, 
    value2: number, 
    method: 'linear' | 'logarithmic' = 'linear'
  ): number {
    if (method === 'logarithmic') {
      const logDiff = Math.abs(Math.log(value1 + 1) - Math.log(value2 + 1));
      return Math.max(0, 1 - logDiff / Math.log(Math.max(value1, value2) + 1));
    } else {
      const maxValue = Math.max(value1, value2);
      if (maxValue === 0) return 1;
      const diff = Math.abs(value1 - value2) / maxValue;
      return Math.max(0, 1 - diff);
    }
  }

  /**
   * Get fields that closely match between user input and country
   */
  private static getMatchingFields(inputs: EnhancedEconomicInputs, country: RealCountryData): string[] {
    const matches: string[] = [];
    const threshold = 0.9; // 90% similarity threshold

    if (this.calculateSimilarity(inputs.gdpPerCapita, country.gdpPerCapita, 'logarithmic') > threshold) {
      matches.push('GDP per Capita');
    }
    if (this.calculateSimilarity(inputs.population, country.population, 'logarithmic') > threshold) {
      matches.push('Population');
    }
    if (this.calculateSimilarity(inputs.taxRevenuePercent, country.taxRevenuePercent) > threshold) {
      matches.push('Tax Revenue');
    }
    if (this.calculateSimilarity(inputs.unemploymentRate, country.unemploymentRate) > threshold) {
      matches.push('Unemployment Rate');
    }

    return matches;
  }

  /**
   * Generate comprehensive economic hints and suggestions
   */
  static generateEconomicHints(inputs: EnhancedEconomicInputs): EconomicHint[] {
    const hints: EconomicHint[] = [];

    // GDP per capita analysis
    if (inputs.gdpPerCapita > 80000) {
      hints.push({
        type: 'info',
        title: 'Very High GDP per Capita',
        message: 'This places your nation among the wealthiest in the world, comparable to Luxembourg or Monaco.',
        relatedCountries: ['Luxembourg', 'Monaco', 'Switzerland'],
        impact: 'low'
      });
    } else if (inputs.gdpPerCapita < 1000) {
      hints.push({
        type: 'warning',
        title: 'Very Low GDP per Capita',
        message: 'This indicates significant economic development challenges.',
        relatedCountries: ['Central African Republic', 'Madagascar'],
        impact: 'high'
      });
    }

    // Unemployment analysis
    if (inputs.unemploymentRate > 25) {
      hints.push({
        type: 'warning',
        title: 'Extremely High Unemployment',
        message: 'Unemployment above 25% indicates severe economic crisis requiring immediate intervention.',
        relatedCountries: ['South Africa', 'Spain (2012)'],
        impact: 'high'
      });
    } else if (inputs.unemploymentRate < 2) {
      hints.push({
        type: 'suggestion',
        title: 'Very Low Unemployment',
        message: 'Such low unemployment may indicate labor shortages and potential wage inflation.',
        relatedCountries: ['Japan', 'Czech Republic'],
        impact: 'medium'
      });
    }

    // Fiscal balance analysis
    const budgetBalance = inputs.taxRevenuePercent - inputs.governmentBudgetPercent;
    if (budgetBalance < -10) {
      hints.push({
        type: 'warning',
        title: 'Large Budget Deficit',
        message: 'Budget deficits exceeding 10% of GDP are unsustainable and may lead to debt crisis.',
        relatedCountries: ['Greece (2010)', 'Argentina'],
        impact: 'high'
      });
    } else if (budgetBalance > 8) {
      hints.push({
        type: 'info',
        title: 'Large Budget Surplus',
        message: 'Consider whether excess surplus could be better utilized for growth or debt reduction.',
        relatedCountries: ['Norway', 'Singapore'],
        impact: 'medium'
      });
    }

    // Debt analysis
    const totalDebt = inputs.internalDebtPercent + inputs.externalDebtPercent;
    if (totalDebt > 200) {
      hints.push({
        type: 'warning',
        title: 'Extremely High Debt',
        message: 'Debt levels above 200% of GDP indicate potential debt sustainability issues.',
        relatedCountries: ['Japan', 'Greece'],
        impact: 'high'
      });
    } else if (totalDebt < 20) {
      hints.push({
        type: 'info',
        title: 'Very Low Debt',
        message: 'Low debt levels provide fiscal flexibility but may indicate underinvestment.',
        relatedCountries: ['Estonia', 'Luxembourg'],
        impact: 'low'
      });
    }

    // Growth and inflation analysis
    if (inputs.realGDPGrowthRate > 0.08) {
      hints.push({
        type: 'warning',
        title: 'Very High Growth Rate',
        message: 'Growth rates above 8% are rare and may indicate economic overheating.',
        relatedCountries: ['China (historical)', 'Ireland (1990s)'],
        impact: 'medium'
      });
    }

    if (inputs.inflationRate > 0.15) {
      hints.push({
        type: 'warning',
        title: 'High Inflation',
        message: 'Inflation above 15% can severely damage economic stability and living standards.',
        relatedCountries: ['Turkey', 'Argentina'],
        impact: 'high'
      });
    } else if (inputs.inflationRate < -0.02) {
      hints.push({
        type: 'warning',
        title: 'Deflation Risk',
        message: 'Persistent deflation can lead to economic stagnation and debt deflation spirals.',
        relatedCountries: ['Japan (lost decades)'],
        impact: 'high'
      });
    }

    // Tax burden analysis
    if (inputs.taxRevenuePercent > 45) {
      hints.push({
        type: 'suggestion',
        title: 'Very High Tax Burden',
        message: 'Tax rates above 45% of GDP may impact competitiveness but enable strong public services.',
        relatedCountries: ['Denmark', 'France'],
        impact: 'medium'
      });
    } else if (inputs.taxRevenuePercent < 10) {
      hints.push({
        type: 'suggestion',
        title: 'Very Low Tax Burden',
        message: 'Low tax collection may limit government ability to provide essential services.',
        relatedCountries: ['Afghanistan', 'Chad'],
        impact: 'medium'
      });
    }

    // Labor force participation
    if (inputs.laborForceParticipationRate > 80) {
      hints.push({
        type: 'info',
        title: 'Very High Labor Participation',
        message: 'Exceptional labor force participation indicates strong economic opportunity.',
        relatedCountries: ['Iceland', 'Switzerland'],
        impact: 'low'
      });
    } else if (inputs.laborForceParticipationRate < 45) {
      hints.push({
        type: 'warning',
        title: 'Low Labor Participation',
        message: 'Low participation may indicate barriers to employment or cultural factors.',
        relatedCountries: ['Iraq', 'Yemen'],
        impact: 'high'
      });
    }

    // Government spending efficiency
    const spendingTotal = Object.values(inputs.governmentSpendingBreakdown).reduce((a, b) => a + b, 0);
    if (spendingTotal > 100) {
      hints.push({
        type: 'warning',
        title: 'Over-allocated Budget',
        message: 'Government spending categories exceed 100% - budget rebalancing needed.',
        relatedCountries: [],
        impact: 'high'
      });
    } else if (spendingTotal < 85) {
      hints.push({
        type: 'info',
        title: 'Unallocated Budget',
        message: 'Consider allocating remaining budget to priority areas or debt reduction.',
        relatedCountries: [],
        impact: 'low'
      });
    }

    return hints;
  }

  /**
   * Create comprehensive country profile with IxTime integration
   */
  static createCountryProfile(
    inputs: EnhancedEconomicInputs,
    allCountries: RealCountryData[],
    ixTimeData?: {
      baselineDate: number;
      currentTime: number;
    }
  ): EnhancedCountryProfile {
    const calculated = this.calculateMetrics(inputs);
    const comparisons = this.findSimilarCountries(inputs, allCountries);
    const hints = this.generateEconomicHints(inputs);

    // IxTime projections (simplified for now)
    const currentTime = ixTimeData?.currentTime || Date.now();
    const baselineDate = ixTimeData?.baselineDate || currentTime;
    
    const projectedGrowth = {
      oneYear: {
        gdp: inputs.gdpPerCapita * Math.pow(1 + inputs.realGDPGrowthRate, 1),
        population: inputs.population * Math.pow(1.01, 1) // Assume 1% population growth
      },
      fiveYear: {
        gdp: inputs.gdpPerCapita * Math.pow(1 + inputs.realGDPGrowthRate, 5),
        population: inputs.population * Math.pow(1.01, 5)
      },
      tenYear: {
        gdp: inputs.gdpPerCapita * Math.pow(1 + inputs.realGDPGrowthRate, 10),
        population: inputs.population * Math.pow(1.01, 10)
      }
    };

    return {
      basic: inputs,
      calculated,
      comparisons,
      hints,
      ixTimeData: {
        baselineDate,
        lastUpdated: currentTime,
        projectedGrowth
      }
    };
  }

  /**
   * Export enhanced economic data to format compatible with IxStats
   */
  static exportToIxStatsFormat(profile: EnhancedCountryProfile) {
    return {
      // Basic country data
      country: profile.basic.countryName,
      population: profile.basic.population,
      gdpPerCapita: profile.basic.gdpPerCapita,
      
      // Enhanced economic indicators
      realGDPGrowthRate: profile.basic.realGDPGrowthRate,
      inflationRate: profile.basic.inflationRate,
      
      // Labor market data
      laborForceParticipationRate: profile.basic.laborForceParticipationRate,
      unemploymentRate: profile.basic.unemploymentRate,
      totalWorkforce: profile.calculated.employedPopulation,
      
      // Fiscal data
      taxRevenuePercent: profile.basic.taxRevenuePercent,
      governmentBudgetPercent: profile.basic.governmentBudgetPercent,
      internalDebtPercent: profile.basic.internalDebtPercent,
      externalDebtPercent: profile.basic.externalDebtPercent,
      
      // Calculated metrics
      totalGDP: profile.calculated.totalGDP,
      economicHealthScore: profile.calculated.economicHealthScore,
      productivityPerWorker: profile.calculated.productivityPerWorker,
      
      // IxTime data
      baselineDate: profile.ixTimeData.baselineDate,
      lastUpdated: profile.ixTimeData.lastUpdated,
      
      // Economic tier
      economicTier: getEconomicTier(profile.basic.gdpPerCapita),
      
      // Projections
      projections: profile.ixTimeData.projectedGrowth
    };
  }

  /**
   * Save enhanced baseline to storage with IxTime metadata
   */
  static saveEnhancedBaseline(profile: EnhancedCountryProfile): void {
    try {
      if (typeof window !== 'undefined') {
        const saveData = {
          profile,
          exportedData: this.exportToIxStatsFormat(profile),
          timestamp: Date.now(),
          version: '1.0.0'
        };
        
        localStorage.setItem('ixeconomy_enhanced_baseline', JSON.stringify(saveData));
        localStorage.setItem('ixeconomy_last_update', Date.now().toString());
      }
    } catch (error) {
      console.error('Failed to save enhanced baseline:', error);
      throw new Error('Could not save economic model');
    }
  }

  /**
   * Load enhanced baseline from storage
   */
  static loadEnhancedBaseline(): EnhancedCountryProfile | null {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('ixeconomy_enhanced_baseline');
        if (!stored) return null;
        
        const parsed = JSON.parse(stored);
        return parsed.profile || null;
      }
      return null;
    } catch (error) {
      console.error('Failed to load enhanced baseline:', error);
      return null;
    }
  }
}
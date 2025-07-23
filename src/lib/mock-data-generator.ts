// Mock Data Generator for IxStats Private Preview
// Generates realistic country data, historical trends, and user interactions

import { IxTime } from "./ixtime";

export interface MockCountryProfile {
  id: string;
  name: string;
  continent: string;
  region: string;
  governmentType: string;
  leader: string;
  religion?: string;
  landArea: number;
  baselinePopulation: number;
  baselineGdpPerCapita: number;
  economicTier: string;
  populationTier: string;
  characteristics: {
    resourceRich: boolean;
    islandNation: boolean;
    landlocked: boolean;
    developedInfrastructure: boolean;
    politicalStability: number; // 0-100
    tradeOpenness: number; // 0-100
  };
}

export interface MockHistoricalData {
  ixTimeTimestamp: number;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  gdpGrowthRate: number;
  populationGrowthRate: number;
  inflationRate: number;
  unemploymentRate: number;
  events?: string[];
}

export interface MockUserActivity {
  userId: string;
  countryId: string;
  action: string;
  timestamp: number;
  details?: any;
}

export class MockDataGenerator {
  private static readonly COUNTRY_NAMES = [
    "Valdoria", "Castania", "Meridia", "Norvathia", "Zelvania", "Korathia", 
    "Thylonia", "Asteria", "Belmont", "Crestfall", "Drakmoor", "Elandra",
    "Frostheim", "Galveston", "Havencrest", "Ironhold", "Jarvik", "Kethara",
    "Luminar", "Mordain", "Nightfall", "Orencia", "Penbrook", "Quillhaven",
    "Ravenshollow", "Silverpeak", "Thornwall", "Underhill", "Verdania", "Westmarch"
  ];

  private static readonly CONTINENTS = [
    { name: "Eurasia", regions: ["Northern Eurasia", "Central Eurasia", "Southern Eurasia", "Eastern Eurasia"] },
    { name: "Oceania", regions: ["Pacific Islands", "Australasia", "Maritime Southeast"] },
    { name: "Americas", regions: ["North America", "Central America", "South America", "Caribbean"] },
    { name: "Africa", regions: ["West Africa", "East Africa", "Central Africa", "Southern Africa", "North Africa"] }
  ];

  private static readonly GOVERNMENT_TYPES = [
    "Federal Republic", "Parliamentary Democracy", "Constitutional Monarchy", 
    "Presidential Republic", "Semi-Presidential Republic", "Parliamentary Monarchy",
    "Federal Constitutional Republic", "Unitary Republic", "Democratic Republic",
    "Federal Parliamentary Republic"
  ];

  public static readonly ECONOMIC_TIERS = [
    { name: "Impoverished", minGdpPerCapita: 500, maxGdpPerCapita: 2000, growthVolatility: 0.8 },
    { name: "Developing", minGdpPerCapita: 2000, maxGdpPerCapita: 8000, growthVolatility: 0.6 },
    { name: "Developed", minGdpPerCapita: 8000, maxGdpPerCapita: 25000, growthVolatility: 0.4 },
    { name: "Healthy", minGdpPerCapita: 25000, maxGdpPerCapita: 40000, growthVolatility: 0.3 },
    { name: "Strong", minGdpPerCapita: 40000, maxGdpPerCapita: 60000, growthVolatility: 0.2 },
    { name: "Very Strong", minGdpPerCapita: 60000, maxGdpPerCapita: 80000, growthVolatility: 0.15 },
    { name: "Elite", minGdpPerCapita: 80000, maxGdpPerCapita: 120000, growthVolatility: 0.1 }
  ];

  private static readonly POPULATION_TIERS = [
    { tier: "1", min: 500000, max: 9999999 },
    { tier: "2", min: 10000000, max: 29999999 },
    { tier: "3", min: 30000000, max: 49999999 },
    { tier: "4", min: 50000000, max: 79999999 },
    { tier: "5", min: 80000000, max: 119999999 },
    { tier: "6", min: 120000000, max: 349999999 },
    { tier: "7", min: 350000000, max: 499999999 },
    { tier: "X", min: 500000000, max: 2000000000 }
  ];

  /**
   * Generate a realistic country profile
   */
  public static generateCountryProfile(
    overrides: Partial<MockCountryProfile> = {}
  ): MockCountryProfile {
    const continent = this.randomChoice(this.CONTINENTS);
    const region = this.randomChoice(continent.regions);
    const economicTier = this.randomChoice(this.ECONOMIC_TIERS);
    const populationTier = this.randomChoice(this.POPULATION_TIERS);
    
    const baselinePopulation = this.randomBetween(
      populationTier.min, 
      Math.min(populationTier.max, populationTier.min * 3)
    );
    
    const baselineGdpPerCapita = this.randomBetween(
      economicTier.minGdpPerCapita,
      economicTier.maxGdpPerCapita
    );

    // Generate realistic land area based on population
    const populationDensityFactor = this.randomBetween(50, 500); // people per sq km
    const landArea = Math.round(baselinePopulation / populationDensityFactor);

    const name = overrides.name || this.randomChoice(this.COUNTRY_NAMES);
    
    return {
      id: overrides.id || `country_${name.toLowerCase().replace(/\s+/g, '_')}`,
      name,
      continent: continent.name,
      region,
      governmentType: this.randomChoice(this.GOVERNMENT_TYPES),
      leader: this.generateLeaderName(),
      religion: this.generateReligion(),
      landArea,
      baselinePopulation,
      baselineGdpPerCapita,
      economicTier: economicTier.name,
      populationTier: populationTier.tier,
      characteristics: {
        resourceRich: Math.random() > 0.7,
        islandNation: Math.random() > 0.85,
        landlocked: Math.random() > 0.75,
        developedInfrastructure: baselineGdpPerCapita > 30000,
        politicalStability: this.randomBetween(30, 95),
        tradeOpenness: this.randomBetween(40, 90)
      },
      ...overrides
    };
  }

  /**
   * Generate historical data for a country over time
   */
  public static generateHistoricalData(
    country: MockCountryProfile,
    startTime: number,
    endTime: number,
    intervalMs: number = 7 * 24 * 60 * 60 * 1000 // Weekly
  ): MockHistoricalData[] {
    const data: MockHistoricalData[] = [];
    const economicTier = this.ECONOMIC_TIERS.find(t => t.name === country.economicTier)!;
    
    let currentPopulation = country.baselinePopulation;
    let currentGdpPerCapita = country.baselineGdpPerCapita;
    
    // Base growth rates influenced by country characteristics
    const basePopGrowthRate = this.calculateBasePopulationGrowth(country);
    const baseEconGrowthRate = this.calculateBaseEconomicGrowth(country);
    
    for (let time = startTime; time <= endTime; time += intervalMs) {
      // Add some realistic volatility and trends
      const timeProgress = (time - startTime) / (endTime - startTime);
      
      // Economic cycles and random events
      const economicCycle = Math.sin(timeProgress * Math.PI * 4) * 0.02; // 4 cycles over the period
      const randomShock = (Math.random() - 0.5) * 0.1 * economicTier.growthVolatility;
      
      const gdpGrowthRate = Math.max(-0.15, Math.min(0.12, 
        baseEconGrowthRate + economicCycle + randomShock
      ));
      
      const populationGrowthRate = Math.max(-0.05, Math.min(0.08,
        basePopGrowthRate + (Math.random() - 0.5) * 0.005
      ));
      
      const inflationRate = Math.max(0, Math.min(0.25,
        0.02 + (Math.random() - 0.5) * 0.02 + Math.abs(gdpGrowthRate) * 0.5
      ));
      
      const unemploymentRate = Math.max(1, Math.min(25,
        8 - gdpGrowthRate * 20 + (Math.random() - 0.5) * 3
      ));
      
      // Update values
      currentPopulation *= (1 + populationGrowthRate / 52); // Weekly growth
      currentGdpPerCapita *= (1 + gdpGrowthRate / 52); // Weekly growth
      
      // Generate occasional events
      const events: string[] = [];
      if (Math.random() > 0.98) {
        events.push(this.generateRandomEvent(country, gdpGrowthRate));
      }
      
      data.push({
        ixTimeTimestamp: time,
        population: Math.round(currentPopulation),
        gdpPerCapita: Math.round(currentGdpPerCapita),
        totalGdp: Math.round(currentPopulation * currentGdpPerCapita),
        gdpGrowthRate: gdpGrowthRate,
        populationGrowthRate: populationGrowthRate,
        inflationRate: inflationRate,
        unemploymentRate: unemploymentRate,
        events: events.length > 0 ? events : undefined
      });
    }
    
    return data;
  }

  /**
   * Generate mock user activities for testing
   */
  public static generateUserActivities(
    userCountryPairs: Array<{ userId: string; countryId: string }>,
    days = 30
  ): MockUserActivity[] {
    const activities: MockUserActivity[] = [];
    const now = IxTime.getCurrentIxTime();
    const dayMs = 24 * 60 * 60 * 1000;
    
    const actionTypes = [
      "view_dashboard", "edit_economic_data", "view_historical_data", 
      "create_scenario", "view_modal", "export_data", "update_profile",
      "view_analytics", "compare_countries", "create_dm_input"
    ];
    
    for (const pair of userCountryPairs) {
      const activitiesPerDay = this.randomBetween(2, 12);
      
      for (let day = 0; day < days; day++) {
        const dayStart = now - (day * dayMs);
        
        for (let i = 0; i < activitiesPerDay; i++) {
          const timestamp = dayStart + this.randomBetween(0, dayMs);
          const action = this.randomChoice(actionTypes);
          
          activities.push({
            userId: pair.userId,
            countryId: pair.countryId,
            action,
            timestamp,
            details: this.generateActivityDetails(action)
          });
        }
      }
    }
    
    return activities.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Generate realistic economic data with proper relationships
   */
  public static generateEconomicData(country: MockCountryProfile) {
    const gdp = country.baselinePopulation * country.baselineGdpPerCapita;
    const economicTier = this.ECONOMIC_TIERS.find(t => t.name === country.economicTier)!;
    
    return {
      // Core Economic Indicators
      nominalGDP: gdp,
      realGDPGrowthRate: this.calculateBaseEconomicGrowth(country),
      inflationRate: this.randomBetween(0.01, 0.06),
      currencyExchangeRate: this.randomBetween(0.5, 2.0),
      
      // Labor Market
      laborForceParticipationRate: this.randomBetween(55, 85),
      unemploymentRate: this.randomBetween(3, 15),
      averageAnnualIncome: country.baselineGdpPerCapita * this.randomBetween(0.7, 1.3),
      
      // Fiscal System
      taxRevenueGDPPercent: this.randomBetween(15, 45),
      totalDebtGDPRatio: this.randomBetween(20, 120),
      budgetDeficitSurplus: gdp * this.randomBetween(-0.08, 0.03),
      
      // Demographics
      lifeExpectancy: this.randomBetween(65, 85),
      urbanPopulationPercent: this.randomBetween(30, 95),
      literacyRate: this.randomBetween(70, 99)
    };
  }

  // Private helper methods
  private static randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)]!;
  }

  public static randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private static calculateBasePopulationGrowth(country: MockCountryProfile): number {
    const tierFactor = country.economicTier === "Impoverished" ? 0.03 :
                      country.economicTier === "Developing" ? 0.02 :
                      country.economicTier === "Developed" ? 0.01 :
                      country.economicTier === "Healthy" ? 0.008 :
                      country.economicTier === "Strong" ? 0.006 :
                      country.economicTier === "Very Strong" ? 0.004 : 0.002;
    
    const stabilityFactor = (country.characteristics.politicalStability - 50) / 5000;
    return tierFactor + stabilityFactor + this.randomBetween(-0.005, 0.005);
  }

  private static calculateBaseEconomicGrowth(country: MockCountryProfile): number {
    const tierFactor = country.economicTier === "Impoverished" ? 0.06 :
                      country.economicTier === "Developing" ? 0.05 :
                      country.economicTier === "Developed" ? 0.035 :
                      country.economicTier === "Healthy" ? 0.025 :
                      country.economicTier === "Strong" ? 0.02 :
                      country.economicTier === "Very Strong" ? 0.015 : 0.01;
    
    const resourceBonus = country.characteristics.resourceRich ? 0.01 : 0;
    const tradeBonus = (country.characteristics.tradeOpenness - 50) / 5000;
    const stabilityBonus = (country.characteristics.politicalStability - 50) / 2500;
    
    return tierFactor + resourceBonus + tradeBonus + stabilityBonus;
  }

  private static generateLeaderName(): string {
    const firstNames = ["Alexander", "Victoria", "Constantine", "Isabella", "Maximilian", "Catherine", "Frederick", "Eleanor", "Leopold", "Margaret"];
    const lastNames = ["von Habsburg", "Valdez", "Blackthorne", "Meridian", "Goldwater", "Sterling", "Ashworth", "Brightbane", "Stormwind", "Fairfax"];
    return `${this.randomChoice(firstNames)} ${this.randomChoice(lastNames)}`;
  }

  private static generateReligion(): string {
    const religions = ["Monotheistic", "Reformed Traditional", "Secular Humanism", "Constitutional Faith", "Traditional Beliefs", "Mixed Faith"];
    return this.randomChoice(religions);
  }

  private static generateRandomEvent(country: MockCountryProfile, growthRate: number): string {
    const positiveEvents = [
      "Major infrastructure project completed",
      "New trade agreement signed",
      "Technology sector breakthrough",
      "Tourism industry expansion",
      "Educational reform implementation"
    ];
    
    const negativeEvents = [
      "Natural disaster response",
      "Supply chain disruption",
      "Political uncertainty",
      "Global market volatility",
      "Climate adaptation measures"
    ];
    
    const neutralEvents = [
      "Census data released",
      "Government policy review",
      "International summit participation",
      "Economic forum hosted",
      "Diplomatic mission established"
    ];
    
    if (growthRate > 0.03) {
      return this.randomChoice(positiveEvents);
    } else if (growthRate < -0.02) {
      return this.randomChoice(negativeEvents);
    } else {
      return this.randomChoice(neutralEvents);
    }
  }

  private static generateActivityDetails(action: string): any {
    switch (action) {
      case "edit_economic_data":
        return { 
          fields: ["gdpGrowthRate", "unemploymentRate", "inflationRate"].slice(0, Math.floor(Math.random() * 3) + 1),
          duration: this.randomBetween(120, 600) // seconds
        };
      case "view_modal":
        return { 
          modal: this.randomChoice(["gdp_details", "population_details", "strategic_planning", "analytics"]),
          duration: this.randomBetween(30, 300)
        };
      case "create_scenario":
        return { 
          name: this.randomChoice(["Economic Growth Focus", "Balanced Development", "Social Priority"]),
          timeframe: this.randomBetween(5, 25)
        };
      default:
        return { duration: this.randomBetween(10, 180) };
    }
  }
}

/**
 * Seed the database with mock countries for preview
 */
export function generatePreviewCountries(count = 15): MockCountryProfile[] {
  const countries: MockCountryProfile[] = [];
  
  // Generate a diverse set of countries across tiers and continents
  for (let i = 0; i < count; i++) {
    const country = MockDataGenerator.generateCountryProfile();
    countries.push(country);
  }
  
  // Ensure we have representation across all tiers
  const tierNames = MockDataGenerator.ECONOMIC_TIERS.map(t => t.name);
  for (const tierName of tierNames) {
    if (!countries.some(c => c.economicTier === tierName)) {
      const tierSpecificCountry = MockDataGenerator.generateCountryProfile();
      tierSpecificCountry.economicTier = tierName;
      // Adjust GDP per capita to match tier
      const tier = MockDataGenerator.ECONOMIC_TIERS.find(t => t.name === tierName)!;
      tierSpecificCountry.baselineGdpPerCapita = MockDataGenerator.randomBetween(
        tier.minGdpPerCapita, 
        tier.maxGdpPerCapita
      );
      countries.push(tierSpecificCountry);
    }
  }
  
  return countries.slice(0, count);
}
// Database seeding utility for IxStats private preview
// Populates the database with realistic mock data for demonstration

import { type PrismaClient } from "@prisma/client";
import { MockDataGenerator, generatePreviewCountries } from "./mock-data-generator";
import { IxTime } from "./ixtime";
import { IxStatsCalculator } from "./calculations";

export interface PreviewSeedOptions {
  countriesCount?: number;
  usersCount?: number;
  historicalMonths?: number;
  clearExisting?: boolean;
}

export class PreviewSeeder {
  constructor(private db: PrismaClient) {}

  /**
   * Seed the database with comprehensive preview data
   */
  async seedPreviewData(options: PreviewSeedOptions = {}): Promise<void> {
    const {
      countriesCount = 20,
      usersCount = 10,
      historicalMonths = 12,
      clearExisting = false
    } = options;

    console.log("🌱 Starting preview data seeding...");

    if (clearExisting) {
      await this.clearExistingData();
    }

    // Step 1: Generate and insert countries
    console.log(`📍 Creating ${countriesCount} countries...`);
    const countries = await this.seedCountries(countriesCount);

    // Step 2: Generate historical data
    console.log(`📊 Generating ${historicalMonths} months of historical data...`);
    await this.seedHistoricalData(countries, historicalMonths);

    // Step 3: Create preview users
    console.log(`👥 Creating ${usersCount} preview users...`);
    const users = await this.seedUsers(usersCount, countries);

    // Step 4: Generate user activities
    console.log(`🎯 Generating user activities...`);
    await this.seedUserActivities(users);

    // Step 5: Add DM inputs for dynamic scenarios
    console.log(`🎛️ Adding DM inputs for scenario testing...`);
    await this.seedDmInputs(countries);

    // Step 6: Create calculation logs
    console.log(`📋 Creating calculation logs...`);
    await this.seedCalculationLogs();

    console.log("✅ Preview data seeding completed successfully!");
  }

  private async clearExistingData(): Promise<void> {
    console.log("🧹 Clearing existing data...");
    
    // Clear in order to respect foreign key constraints
    await this.db.calculationLog.deleteMany();
    await this.db.dmInputs.deleteMany();
    await this.db.historicalDataPoint.deleteMany();
    await this.db.user.deleteMany();
    
    // Clear country-related tables (if they exist)
    try {
      await this.db.economicProfile.deleteMany();
      await this.db.laborMarket.deleteMany();
      await this.db.fiscalSystem.deleteMany();
      await this.db.incomeDistribution.deleteMany();
      await this.db.governmentBudget.deleteMany();
      await this.db.demographics.deleteMany();
    } catch (error) {
      console.log("Note: Some advanced tables don't exist yet, skipping...");
    }
    
    await this.db.country.deleteMany();
  }

  private async seedCountries(count: number): Promise<any[]> {
    const mockCountries = generatePreviewCountries(count);
    const countries = [];

    for (const mockCountry of mockCountries) {
      const economicData = MockDataGenerator.generateEconomicData(mockCountry);
      const currentTime = IxTime.getCurrentIxTime();
      
      // Calculate current stats using the actual economic calculator
      const baseData = {
        country: mockCountry.name,
        continent: mockCountry.continent,
        region: mockCountry.region,
        governmentType: mockCountry.governmentType,
        religion: mockCountry.religion,
        leader: mockCountry.leader,
        population: mockCountry.baselinePopulation,
        gdpPerCapita: mockCountry.baselineGdpPerCapita,
        landArea: mockCountry.landArea,
        areaSqMi: mockCountry.landArea * 0.386102, // Convert to square miles
        maxGdpGrowthRate: economicData.realGDPGrowthRate,
        adjustedGdpGrowth: economicData.realGDPGrowthRate,
        populationGrowthRate: this.calculatePopulationGrowthRate(mockCountry),
        actualGdpGrowth: economicData.realGDPGrowthRate,
        projected2040Population: mockCountry.baselinePopulation * 1.3,
        projected2040Gdp: economicData.nominalGDP * 1.8,
        projected2040GdpPerCapita: mockCountry.baselineGdpPerCapita * 1.4,
        localGrowthFactor: 1.0 + (Math.random() - 0.5) * 0.1,
      };

      const country = await this.db.country.create({
        data: {
          name: mockCountry.name,
          continent: mockCountry.continent,
          region: mockCountry.region,
          governmentType: mockCountry.governmentType,
          religion: mockCountry.religion,
          leader: mockCountry.leader,
          landArea: mockCountry.landArea,
          areaSqMi: baseData.areaSqMi,
          baselinePopulation: mockCountry.baselinePopulation,
          baselineGdpPerCapita: mockCountry.baselineGdpPerCapita,
          currentPopulation: mockCountry.baselinePopulation,
          currentGdpPerCapita: mockCountry.baselineGdpPerCapita,
          currentTotalGdp: economicData.nominalGDP,
          economicTier: mockCountry.economicTier,
          populationTier: mockCountry.populationTier,
          populationDensity: mockCountry.baselinePopulation / mockCountry.landArea,
          gdpDensity: economicData.nominalGDP / mockCountry.landArea,
          maxGdpGrowthRate: economicData.realGDPGrowthRate,
          adjustedGdpGrowth: economicData.realGDPGrowthRate,
          populationGrowthRate: baseData.populationGrowthRate,
          actualGdpGrowth: economicData.realGDPGrowthRate,
          projected2040Population: baseData.projected2040Population,
          projected2040Gdp: baseData.projected2040Gdp,
          projected2040GdpPerCapita: baseData.projected2040GdpPerCapita,
          localGrowthFactor: baseData.localGrowthFactor,
          baselineDate: new Date(IxTime.getInGameEpoch()),
          lastCalculated: new Date(currentTime),
          
          // Add economic data fields that exist in the API
          nominalGDP: economicData.nominalGDP,
          realGDPGrowthRate: economicData.realGDPGrowthRate,
          inflationRate: economicData.inflationRate,
          currencyExchangeRate: economicData.currencyExchangeRate,
          laborForceParticipationRate: economicData.laborForceParticipationRate,
          employmentRate: 100 - economicData.unemploymentRate,
          unemploymentRate: economicData.unemploymentRate,
          totalWorkforce: Math.round(mockCountry.baselinePopulation * economicData.laborForceParticipationRate / 100),
          averageWorkweekHours: 40,
          minimumWage: economicData.averageAnnualIncome * 0.4 / 2080, // Rough hourly wage
          averageAnnualIncome: economicData.averageAnnualIncome,
          
          // Fiscal data
          taxRevenueGDPPercent: economicData.taxRevenueGDPPercent,
          governmentRevenueTotal: economicData.nominalGDP * economicData.taxRevenueGDPPercent / 100,
          taxRevenuePerCapita: (economicData.nominalGDP * economicData.taxRevenueGDPPercent / 100) / mockCountry.baselinePopulation,
          governmentBudgetGDPPercent: economicData.taxRevenueGDPPercent + 2,
          budgetDeficitSurplus: economicData.budgetDeficitSurplus,
          internalDebtGDPPercent: economicData.totalDebtGDPRatio * 0.7,
          externalDebtGDPPercent: economicData.totalDebtGDPRatio * 0.3,
          totalDebtGDPRatio: economicData.totalDebtGDPRatio,
          debtPerCapita: (economicData.nominalGDP * economicData.totalDebtGDPRatio / 100) / mockCountry.baselinePopulation,
          interestRates: 0.03 + Math.random() * 0.05,
          debtServiceCosts: economicData.nominalGDP * economicData.totalDebtGDPRatio / 100 * 0.05,
          
          // Demographics
          lifeExpectancy: economicData.lifeExpectancy,
          urbanPopulationPercent: economicData.urbanPopulationPercent,
          ruralPopulationPercent: 100 - economicData.urbanPopulationPercent,
          literacyRate: economicData.literacyRate,
          
          // Government spending
          totalGovernmentSpending: economicData.nominalGDP * (economicData.taxRevenueGDPPercent + 2) / 100,
          spendingGDPPercent: economicData.taxRevenueGDPPercent + 2,
          spendingPerCapita: (economicData.nominalGDP * (economicData.taxRevenueGDPPercent + 2) / 100) / mockCountry.baselinePopulation,
        }
      });

      countries.push(country);
    }

    return countries;
  }

  private async seedHistoricalData(countries: any[], months: number): Promise<void> {
    const now = IxTime.getCurrentIxTime();
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    const startTime = now - (months * monthMs);

    for (const country of countries) {
      const mockCountry = {
        id: country.id,
        name: country.name,
        continent: country.continent,
        region: country.region,
        governmentType: country.governmentType,
        leader: country.leader,
        religion: country.religion,
        landArea: country.landArea,
        baselinePopulation: country.baselinePopulation,
        baselineGdpPerCapita: country.baselineGdpPerCapita,
        economicTier: country.economicTier,
        populationTier: country.populationTier,
        characteristics: {
          resourceRich: Math.random() > 0.7,
          islandNation: Math.random() > 0.85,
          landlocked: Math.random() > 0.75,
          developedInfrastructure: country.baselineGdpPerCapita > 30000,
          politicalStability: 60 + Math.random() * 35,
          tradeOpenness: 50 + Math.random() * 40
        }
      };

      const historicalData = MockDataGenerator.generateHistoricalData(
        mockCountry,
        startTime,
        now,
        7 * 24 * 60 * 60 * 1000 // Weekly data points
      );

      // Insert historical data in batches
      const batchSize = 50;
      for (let i = 0; i < historicalData.length; i += batchSize) {
        const batch = historicalData.slice(i, i + batchSize);
        await this.db.historicalDataPoint.createMany({
          data: batch.map(point => ({
            countryId: country.id,
            ixTimeTimestamp: new Date(point.ixTimeTimestamp),
            population: point.population,
            gdpPerCapita: point.gdpPerCapita,
            totalGdp: point.totalGdp,
            populationGrowthRate: point.populationGrowthRate,
            gdpGrowthRate: point.gdpGrowthRate,
            landArea: country.landArea,
            populationDensity: point.population / country.landArea,
            gdpDensity: point.totalGdp / country.landArea,
          }))
        });
      }
    }
  }

  private async seedUsers(count: number, countries: any[]): Promise<any[]> {
    const users = [];
    const userNames = [
      "Alexander Chen", "Sophia Rodriguez", "Marcus Johnson", "Elena Petrov", 
      "David Kim", "Isabella Santos", "James Wilson", "Maria García",
      "Robert Taylor", "Anna Kowalski", "Michael Brown", "Victoria Lee",
      "Thomas Anderson", "Catherine Moore", "Daniel Jackson"
    ];

    for (let i = 0; i < count; i++) {
      const clerkUserId = `user_${Date.now()}_${i}`;
      const assignedCountry = countries[i % countries.length];
      
      const user = await this.db.user.create({
        data: {
          clerkUserId,
          countryId: assignedCountry?.id || null,
          // Add any additional user fields as needed
        }
      });

      users.push({
        ...user,
        displayName: userNames[i % userNames.length],
        country: assignedCountry
      });
    }

    return users;
  }

  private async seedUserActivities(users: any[]): Promise<void> {
    const userCountryPairs = users
      .filter(u => u.countryId)
      .map(u => ({ userId: u.clerkUserId, countryId: u.countryId }));

    const activities = MockDataGenerator.generateUserActivities(userCountryPairs, 30);
    
    // For now, we'll just log the activities since we don't have a UserActivity table
    // In a real implementation, you'd create this table and insert the data
    console.log(`Generated ${activities.length} user activities for analysis`);
  }

  private async seedDmInputs(countries: any[]): Promise<void> {
    const inputTypes = [
      "economic_stimulus", "trade_policy", "infrastructure_investment",
      "education_reform", "healthcare_expansion", "tax_reform",
      "environmental_policy", "social_program", "regulatory_change"
    ];

    const descriptions = {
      "economic_stimulus": "Government economic stimulus package",
      "trade_policy": "New international trade agreement",
      "infrastructure_investment": "Major infrastructure development project",
      "education_reform": "Educational system modernization",
      "healthcare_expansion": "Healthcare system expansion",
      "tax_reform": "Tax system restructuring",
      "environmental_policy": "Environmental protection initiative",
      "social_program": "Social welfare program expansion",
      "regulatory_change": "Regulatory framework update"
    };

    for (let i = 0; i < 15; i++) {
      const country = countries[Math.floor(Math.random() * countries.length)];
      const inputType = inputTypes[Math.floor(Math.random() * inputTypes.length)];
      const value = (Math.random() - 0.5) * 0.1; // -5% to +5% impact
      const duration = Math.floor(Math.random() * 12) + 1; // 1-12 months

      const daysAgo = Math.floor(Math.random() * 90); // Last 90 days
      const timestamp = IxTime.getCurrentIxTime() - (daysAgo * 24 * 60 * 60 * 1000);

      await this.db.dmInputs.create({
        data: {
          countryId: Math.random() > 0.7 ? country.id : null, // 30% global, 70% country-specific
          ixTimeTimestamp: new Date(timestamp),
          inputType: inputType!,
          value,
          description: descriptions[inputType as keyof typeof descriptions] || "Economic policy change",
          duration,
          isActive: Math.random() > 0.2, // 80% are still active
          createdBy: "preview_admin"
        }
      });
    }
  }

  private async seedCalculationLogs(): Promise<void> {
    const now = IxTime.getCurrentIxTime();
    const dayMs = 24 * 60 * 60 * 1000;

    // Create logs for the last 30 days
    for (let i = 0; i < 30; i++) {
      const timestamp = now - (i * dayMs);
      const countriesUpdated = 15 + Math.floor(Math.random() * 10);
      const executionTime = 500 + Math.floor(Math.random() * 2000);

      await this.db.calculationLog.create({
        data: {
          timestamp: new Date(timestamp),
          ixTimeTimestamp: new Date(timestamp),
          countriesUpdated,
          executionTimeMs: executionTime,
          globalGrowthFactor: 1.0321,
          notes: i === 0 ? "Preview data initialization" : 
                 i < 5 ? "Regular calculation cycle" :
                 Math.random() > 0.8 ? "Economic event triggered calculation" :
                 "Scheduled system update"
        }
      });
    }
  }

  private calculatePopulationGrowthRate(country: any): number {
    // Base rate influenced by economic tier
    const tierMultiplier = {
      "Impoverished": 0.025,
      "Developing": 0.02,
      "Developed": 0.012,
      "Healthy": 0.008,
      "Strong": 0.006,
      "Very Strong": 0.004,
      "Extravagant": 0.002
    };

    const baseRate = tierMultiplier[country.economicTier as keyof typeof tierMultiplier] || 0.01;
    return baseRate + (Math.random() - 0.5) * 0.005;
  }
}

/**
 * Utility function to quickly seed preview data
 */
export async function seedPreviewDatabase(db: PrismaClient, options?: PreviewSeedOptions): Promise<void> {
  const seeder = new PreviewSeeder(db);
  await seeder.seedPreviewData(options);
}

/**
 * CLI-friendly seeding function
 */
export async function runPreviewSeeder(): Promise<void> {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  
  try {
    await seedPreviewDatabase(db, {
      countriesCount: 25,
      usersCount: 15,
      historicalMonths: 18,
      clearExisting: true
    });
    
    console.log("🎉 Preview database successfully seeded!");
  } catch (error) {
    console.error("❌ Error seeding preview database:", error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Allow running as script
if (require.main === module) {
  runPreviewSeeder().catch(console.error);
}
// Database seeding utility for IxStats private preview
// Populates the database with realistic mock data for demonstration

import { type PrismaClient } from "@prisma/client";
import { IxTime } from "./ixtime";
import { IxStatsCalculator } from "./calculations";
import { generateSlug } from "./slug-utils";

export interface PreviewSeedOptions {
  countriesCount?: number;
  usersCount?: number;
  historicalMonths?: number;
  clearExisting?: boolean;
}

export class PreviewSeeder {
  private static readonly IS_PRODUCTION = process.env.NODE_ENV === 'production'
  
  constructor(private db: PrismaClient) {
    // Prevent running in production
    if (PreviewSeeder.IS_PRODUCTION) {
      throw new Error('PreviewSeeder cannot run in production environment');
    }
  }

  /**
   * Seed the database with comprehensive preview data
   * @throws Error in production environment
   */
  async seedPreviewData(options: PreviewSeedOptions = {}): Promise<void> {
    if (PreviewSeeder.IS_PRODUCTION) {
      throw new Error('Preview data seeding is disabled in production');
    }
    const {
      countriesCount = 20,
      usersCount = 10,
      historicalMonths = 12,
      clearExisting = false
    } = options;

    // Only log in development environment
    if (process.env.NODE_ENV === 'development') {
      console.log("🌱 Starting preview data seeding...");
    }

    if (clearExisting) {
      await this.clearExistingData();
    }

    // Step 1: Generate and insert countries
    if (process.env.NODE_ENV === 'development') {
      console.log(`📍 Creating ${countriesCount} countries...`);
    }
    const countries = await this.seedCountries(countriesCount);

    // Step 2: Generate historical data
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Generating ${historicalMonths} months of historical data...`);
    }
    // Historical data generation temporarily disabled
    // await this.seedHistoricalData(countries, historicalMonths);

    // Step 3: Create preview users
    if (process.env.NODE_ENV === 'development') {
      console.log(`👥 Creating ${usersCount} preview users...`);
    }
    const users = await this.seedUsers(usersCount, countries);

    // Step 4: Generate user activities
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎯 Generating user activities...`);
    }
    await this.seedUserActivities(users);

    // Step 5: Add DM inputs for dynamic scenarios
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎛️ Adding DM inputs for scenario testing...`);
    }
    await this.seedDmInputs(countries);

    // Step 6: Create calculation logs
    if (process.env.NODE_ENV === 'development') {
      console.log(`📋 Creating calculation logs...`);
    }
    await this.seedCalculationLogs();

    if (process.env.NODE_ENV === 'development') {
      console.log("✅ Preview data seeding completed successfully!");
    }
  }

  private async clearExistingData(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log("🧹 Clearing existing data...");
    }
    
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
    if (count <= 0) {
      return [];
    }

    const countryTemplates = [
      {
        name: "Asteria Federation",
        continent: "North America",
        region: "Northern Reach",
        governmentType: "Federal Republic",
        religion: "Pluralistic",
        leader: "Elena Marquez",
        landArea: 652_000,
        baselinePopulation: 52_000_000,
        baselineGdpPerCapita: 45_800,
        economicTier: "Developed",
        populationTier: "Large",
        realGDPGrowthRate: 0.032,
        inflationRate: 0.021,
        currencyExchangeRate: 1.0,
        populationGrowthRate: 0.011,
        diplomaticStanding: 82,
        publicApproval: 71,
        governmentalEfficiencyScore: 84,
      },
      {
        name: "Helios Union",
        continent: "Europe",
        region: "Mediterranean Arc",
        governmentType: "Parliamentary Democracy",
        religion: "Secular",
        leader: "Amelia Kovács",
        landArea: 412_300,
        baselinePopulation: 34_500_000,
        baselineGdpPerCapita: 53_200,
        economicTier: "Very Strong",
        populationTier: "Medium",
        realGDPGrowthRate: 0.028,
        inflationRate: 0.018,
        currencyExchangeRate: 0.92,
        populationGrowthRate: 0.009,
        diplomaticStanding: 88,
        publicApproval: 69,
        governmentalEfficiencyScore: 86,
      },
      {
        name: "Solaria Alliance",
        continent: "Asia",
        region: "Pacific Crescent",
        governmentType: "Technocratic Council",
        religion: "Pluralistic",
        leader: "Ren Ito",
        landArea: 298_400,
        baselinePopulation: 61_200_000,
        baselineGdpPerCapita: 38_400,
        economicTier: "Strong",
        populationTier: "Large",
        realGDPGrowthRate: 0.035,
        inflationRate: 0.024,
        currencyExchangeRate: 115.0,
        populationGrowthRate: 0.013,
        diplomaticStanding: 79,
        publicApproval: 74,
        governmentalEfficiencyScore: 81,
      },
      {
        name: "Verdantia Coalition",
        continent: "South America",
        region: "Andean Corridor",
        governmentType: "Federal Republic",
        religion: "Pluralistic",
        leader: "Isabela Duarte",
        landArea: 905_600,
        baselinePopulation: 41_800_000,
        baselineGdpPerCapita: 27_600,
        economicTier: "Healthy",
        populationTier: "Medium",
        realGDPGrowthRate: 0.041,
        inflationRate: 0.032,
        currencyExchangeRate: 4.2,
        populationGrowthRate: 0.016,
        diplomaticStanding: 72,
        publicApproval: 67,
        governmentalEfficiencyScore: 76,
      },
      {
        name: "Aurora Confederacy",
        continent: "Africa",
        region: "Great Lakes Nexus",
        governmentType: "Coalition Government",
        religion: "Pluralistic",
        leader: "Nia Okoye",
        landArea: 1_120_000,
        baselinePopulation: 58_900_000,
        baselineGdpPerCapita: 21_400,
        economicTier: "Developing",
        populationTier: "Large",
        realGDPGrowthRate: 0.048,
        inflationRate: 0.038,
        currencyExchangeRate: 3.7,
        populationGrowthRate: 0.018,
        diplomaticStanding: 68,
        publicApproval: 61,
        governmentalEfficiencyScore: 73,
      },
      {
        name: "Meridian Compact",
        continent: "Oceania",
        region: "Coral Frontier",
        governmentType: "Constitutional Monarchy",
        religion: "Pluralistic",
        leader: "Ari Thompson",
        landArea: 186_400,
        baselinePopulation: 9_800_000,
        baselineGdpPerCapita: 61_500,
        economicTier: "Extravagant",
        populationTier: "Small",
        realGDPGrowthRate: 0.026,
        inflationRate: 0.016,
        currencyExchangeRate: 1.4,
        populationGrowthRate: 0.007,
        diplomaticStanding: 91,
        publicApproval: 78,
        governmentalEfficiencyScore: 88,
      },
    ];

    const countries: any[] = [];
    const now = IxTime.getCurrentIxTime();
    const baselineDate = new Date(IxTime.getInGameEpoch());

    for (let i = 0; i < count; i++) {
      const template = countryTemplates[i % countryTemplates.length];
      const replicationIndex = Math.floor(i / countryTemplates.length);
      const nameSuffix = replicationIndex === 0 ? "" : ` ${replicationIndex + 1}`;
      const countryName = `${template.name}${nameSuffix}`;

      const populationScale = 1 + replicationIndex * 0.035;
      const growthRate = template.realGDPGrowthRate ?? 0.03;
      const populationGrowthRate = template.populationGrowthRate ?? 0.012;
      const baselinePopulation = Math.round(template.baselinePopulation * populationScale);
      const baselineGdpPerCapita = template.baselineGdpPerCapita * (1 + replicationIndex * 0.02);
      const nominalGDP = baselinePopulation * baselineGdpPerCapita;
      const currentPopulation = Math.round(baselinePopulation * (1 + populationGrowthRate));
      const currentGdpPerCapita = baselineGdpPerCapita * (1 + growthRate);
      const currentTotalGdp = currentPopulation * currentGdpPerCapita;
      const landArea = template.landArea ?? 500_000;
      const populationDensity = landArea ? currentPopulation / landArea : null;
      const gdpDensity = landArea ? currentTotalGdp / landArea : null;
      const adjustedGdpGrowth = (template.realGDPGrowthRate ?? growthRate) * 0.92;
      const maxGdpGrowthRate = Math.max(growthRate + 0.01, adjustedGdpGrowth + 0.015);
      const laborForceParticipationRate = 63.5;
      const unemploymentRate = 5.1;
      const employmentRate = 100 - unemploymentRate;
      const totalWorkforce = (currentPopulation * laborForceParticipationRate) / 100;
      const averageAnnualIncome = baselineGdpPerCapita * 0.78;
      const minimumWage = (averageAnnualIncome / 2080) * 0.45;
      const taxRevenueGDPPercent = 32.5;
      const governmentRevenueTotal = (currentTotalGdp * taxRevenueGDPPercent) / 100;
      const taxRevenuePerCapita = governmentRevenueTotal / currentPopulation;
      const governmentBudgetGDPPercent = 34.2;
      const budgetDeficitSurplus = currentTotalGdp * 0.018;
      const internalDebtGDPPercent = 46.3;
      const externalDebtGDPPercent = 23.1;
      const totalDebtGDPRatio = internalDebtGDPPercent + externalDebtGDPPercent;
      const debtPerCapita = (currentTotalGdp * totalDebtGDPRatio) / 100 / currentPopulation;
      const spendingGDPPercent = 35.4;
      const totalGovernmentSpending = (currentTotalGdp * spendingGDPPercent) / 100;
      const spendingPerCapita = totalGovernmentSpending / currentPopulation;
      const economicVitality = template.governmentalEfficiencyScore + 6;
      const populationWellbeing = template.publicApproval + 15;
      const diplomaticStanding = template.diplomaticStanding ?? 75;
      const governmentalEfficiency = template.governmentalEfficiencyScore;
      const overallNationalHealth = Math.round(
        (economicVitality + populationWellbeing + diplomaticStanding + governmentalEfficiency) / 4
      );

      const createdCountry = await this.db.country.create({
        data: {
          name: countryName,
          slug: generateSlug(countryName),
          continent: template.continent,
          region: template.region,
          governmentType: template.governmentType,
          religion: template.religion,
          leader: template.leader,
          landArea,
          areaSqMi: landArea * 0.386102,
          baselinePopulation,
          baselineGdpPerCapita,
          currentPopulation,
          currentGdpPerCapita,
          currentTotalGdp,
          maxGdpGrowthRate,
          adjustedGdpGrowth,
          populationGrowthRate,
          populationDensity: populationDensity ?? undefined,
          gdpDensity: gdpDensity ?? undefined,
          economicTier: template.economicTier,
          populationTier: template.populationTier,
          nominalGDP: currentTotalGdp,
          realGDPGrowthRate: growthRate,
          inflationRate: template.inflationRate ?? 0.02,
          currencyExchangeRate: template.currencyExchangeRate ?? 1,
          laborForceParticipationRate,
          employmentRate,
          unemploymentRate,
          totalWorkforce,
          averageWorkweekHours: 39.5,
          minimumWage,
          averageAnnualIncome,
          taxRevenueGDPPercent,
          governmentRevenueTotal,
          taxRevenuePerCapita,
          governmentBudgetGDPPercent,
          budgetDeficitSurplus,
          internalDebtGDPPercent,
          externalDebtGDPPercent,
          totalDebtGDPRatio,
          debtPerCapita,
          interestRates: 3.15,
          debtServiceCosts: (totalDebtGDPRatio / 100) * currentTotalGdp * 0.025,
          povertyRate: 12.4,
          incomeInequalityGini: 36.2,
          socialMobilityIndex: 58.3,
          totalGovernmentSpending,
          spendingGDPPercent,
          spendingPerCapita,
          lifeExpectancy: 78.6,
          urbanPopulationPercent: 68.4,
          ruralPopulationPercent: 31.6,
          literacyRate: 97.2,
          economicVitality,
          populationWellbeing,
          diplomaticStanding,
          governmentalEfficiency,
          overallNationalHealth,
          activeAlliances: 6 + replicationIndex,
          activeTreaties: 12 + replicationIndex * 2,
          diplomaticReputation: diplomaticStanding > 85 ? "Exemplary" : diplomaticStanding > 75 ? "Strong" : "Stable",
          publicApproval: template.publicApproval,
          governmentEfficiency: governmentalEfficiency > 85 ? "Exceptional" : governmentalEfficiency > 75 ? "High" : "Moderate",
          politicalStability: governmentalEfficiency > 80 ? "Stable" : "Emerging",
          tradeBalance: currentTotalGdp * 0.015,
          infrastructureRating: 72 + replicationIndex * 2,
          lastCalculated: new Date(now),
          baselineDate,
        }
      });

      countries.push(createdCountry);
    }

    return countries;

    /* for (const mockCountry of mockCountries) {
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
        localGrowthFactor: 1.0, // Fixed value, no random generation
      };

      const country = await this.db.country.create({
        data: {
          name: mockCountry.name,
          slug: generateSlug(mockCountry.name),
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
    } */
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
    // TODO: Re-enable when MockDataGenerator is available
    // const userCountryPairs = users
    //   .filter(u => u.countryId)
    //   .map(u => ({ userId: u.clerkUserId, countryId: u.countryId }));

    // const activities = MockDataGenerator.generateUserActivities(userCountryPairs, 30);

    if (process.env.NODE_ENV === 'development') {
      console.log(`User activities seeding temporarily disabled`);
    }
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
 * @throws Error in production environment
 */
export async function seedPreviewDatabase(db: PrismaClient, options?: PreviewSeedOptions): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Preview database seeding is disabled in production');
  }

  const seeder = new PreviewSeeder(db);
  await seeder.seedPreviewData(options);
}

/**
 * CLI-friendly seeding function
 * @throws Error in production environment
 */
export async function runPreviewSeeder(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Preview seeder CLI is disabled in production');
  }

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
if (import.meta.url === `file://${process.argv[1]}`) {
  runPreviewSeeder().catch(console.error);
}
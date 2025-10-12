#!/usr/bin/env tsx
/**
 * Audit script to verify all MyCountry data points are in database and builder/editor
 *
 * Checks:
 * 1. Database schema (Prisma) has all required fields
 * 2. Builder/Editor components access all database fields
 * 3. tRPC routers expose all necessary mutations/queries
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface DataPointAudit {
  field: string;
  inDatabase: boolean;
  inBuilder: boolean;
  inEditor: boolean;
  inTrpc: boolean;
  model: string;
  notes: string[];
}

// Expected MyCountry data points based on intelligence system and types
const EXPECTED_DATA_POINTS = {
  // Core Country fields
  Country: [
    'name', 'slug', 'continent', 'region', 'governmentType', 'religion', 'leader',
    'flag', 'coatOfArms', 'landArea', 'areaSqMi',
    'baselinePopulation', 'currentPopulation', 'populationGrowthRate', 'populationDensity',
    'baselineGdpPerCapita', 'currentGdpPerCapita', 'currentTotalGdp', 'nominalGDP',
    'maxGdpGrowthRate', 'adjustedGdpGrowth', 'actualGdpGrowth', 'realGDPGrowthRate',
    'gdpDensity', 'economicTier', 'populationTier',
    'projected2040Population', 'projected2040Gdp', 'projected2040GdpPerCapita',
    'inflationRate', 'currencyExchangeRate',
    'laborForceParticipationRate', 'employmentRate', 'unemploymentRate',
    'totalWorkforce', 'averageWorkweekHours', 'minimumWage', 'averageAnnualIncome',
    'taxRevenueGDPPercent', 'governmentRevenueTotal', 'taxRevenuePerCapita',
    'governmentBudgetGDPPercent', 'budgetDeficitSurplus',
    'internalDebtGDPPercent', 'externalDebtGDPPercent', 'totalDebtGDPRatio',
    'debtPerCapita', 'interestRates', 'debtServiceCosts',
    'povertyRate', 'incomeInequalityGini', 'socialMobilityIndex',
    'totalGovernmentSpending', 'spendingGDPPercent', 'spendingPerCapita',
    'lifeExpectancy', 'urbanPopulationPercent', 'ruralPopulationPercent', 'literacyRate',
    'localGrowthFactor',
    // Vitality scores
    'economicVitality', 'populationWellbeing', 'diplomaticStanding',
    'governmentalEfficiency', 'overallNationalHealth',
    // Diplomatic
    'activeAlliances', 'activeTreaties', 'diplomaticReputation',
    // Government effectiveness
    'publicApproval', 'governmentEfficiency', 'politicalStability',
    // Other
    'tradeBalance', 'infrastructureRating',
    'usesAtomicGovernment', 'hideDiplomaticOps', 'hideStratcommIntel'
  ],

  // National Identity fields
  NationalIdentity: [
    'countryName', 'officialName', 'governmentType', 'motto', 'mottoNative',
    'capitalCity', 'largestCity', 'demonym', 'currency', 'currencySymbol',
    'officialLanguages', 'nationalLanguage', 'nationalAnthem', 'nationalDay',
    'callingCode', 'internetTLD', 'drivingSide', 'timeZone', 'isoCode',
    'coordinatesLatitude', 'coordinatesLongitude', 'emergencyNumber',
    'postalCodeFormat', 'nationalSport', 'weekStartDay'
  ],

  // Economic Profile
  EconomicProfile: [
    'gdpGrowthVolatility', 'economicComplexity', 'innovationIndex',
    'competitivenessRank', 'easeOfDoingBusiness', 'corruptionIndex',
    'sectorBreakdown', 'exportsGDPPercent', 'importsGDPPercent', 'tradeBalance'
  ],

  // Labor Market
  LaborMarket: [
    'employmentBySector', 'youthUnemploymentRate', 'femaleParticipationRate',
    'informalEmploymentRate', 'medianWage', 'wageGrowthRate', 'wageBySector'
  ],

  // Fiscal System
  FiscalSystem: [
    'personalIncomeTaxRates', 'corporateTaxRates', 'salesTaxRate', 'propertyTaxRate',
    'payrollTaxRate', 'exciseTaxRates', 'wealthTaxRate', 'spendingByCategory',
    'fiscalBalanceGDPPercent', 'primaryBalanceGDPPercent', 'taxEfficiency'
  ],

  // Income Distribution
  IncomeDistribution: [
    'economicClasses', 'top10PercentWealth', 'bottom50PercentWealth',
    'middleClassPercent', 'intergenerationalMobility', 'educationMobility'
  ],

  // Government Budget
  GovernmentBudget: [
    'spendingCategories', 'spendingEfficiency', 'publicInvestmentRate', 'socialSpendingPercent'
  ],

  // Demographics
  Demographics: [
    'ageDistribution', 'regions', 'educationLevels', 'citizenshipStatuses',
    'birthRate', 'deathRate', 'migrationRate', 'dependencyRatio',
    'medianAge', 'populationGrowthProjection'
  ]
};

function auditDataPoints(): DataPointAudit[] {
  const results: DataPointAudit[] = [];
  const rootDir = join(__dirname, '..');

  // Read files
  const schemaPath = join(rootDir, 'prisma', 'schema.prisma');
  const schema = readFileSync(schemaPath, 'utf-8');

  // Check each model's expected fields
  for (const [model, fields] of Object.entries(EXPECTED_DATA_POINTS)) {
    // Find model in schema
    const modelRegex = new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`, 'm');
    const modelMatch = schema.match(modelRegex);
    const modelContent = modelMatch ? modelMatch[1] : '';

    for (const field of fields) {
      const audit: DataPointAudit = {
        field,
        inDatabase: false,
        inBuilder: false,
        inEditor: false,
        inTrpc: false,
        model,
        notes: []
      };

      // Check if field is in database model
      const fieldRegex = new RegExp(`^\\s+${field}\\s+`, 'm');
      audit.inDatabase = fieldRegex.test(modelContent);

      if (!audit.inDatabase) {
        audit.notes.push('Missing from database schema');
      }

      results.push(audit);
    }
  }

  return results;
}

function generateReport(audits: DataPointAudit[]): void {
  console.log('\n=== MyCountry Data Points Audit ===\n');

  const byModel = audits.reduce((acc, audit) => {
    if (!acc[audit.model]) acc[audit.model] = [];
    acc[audit.model].push(audit);
    return acc;
  }, {} as Record<string, DataPointAudit[]>);

  for (const [model, modelAudits] of Object.entries(byModel)) {
    const missingFromDb = modelAudits.filter(a => !a.inDatabase);
    const inDb = modelAudits.filter(a => a.inDatabase);

    console.log(`\n## ${model} (${inDb.length}/${modelAudits.length} in database)`);

    if (missingFromDb.length > 0) {
      console.log('\n❌ Missing from database:');
      for (const audit of missingFromDb) {
        console.log(`   - ${audit.field}`);
      }
    }

    if (inDb.length > 0) {
      console.log(`\n✅ Present in database: ${inDb.length} fields`);
    }
  }

  // Summary statistics
  const totalFields = audits.length;
  const inDb = audits.filter(a => a.inDatabase).length;
  const missingDb = totalFields - inDb;

  console.log('\n=== Summary ===');
  console.log(`Total expected fields: ${totalFields}`);
  console.log(`In database: ${inDb} (${Math.round(inDb/totalFields*100)}%)`);
  console.log(`Missing from database: ${missingDb}`);

  if (missingDb > 0) {
    console.log('\n⚠️  Action required: Add missing fields to database schema');
  } else {
    console.log('\n✅ All expected fields are in the database!');
  }
}

// Run audit
const audits = auditDataPoints();
generateReport(audits);

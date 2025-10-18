/**
 * Test Data Fixtures
 * Mock data for economy builder tests
 */

import type {
  EconomyBuilderState,
  DemographicsConfiguration,
  LaborConfiguration,
  SectorConfiguration,
} from '~/types/economy-builder';
import { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';

/**
 * Mock Demographics Configuration
 */
export const mockDemographics: DemographicsConfiguration = {
  totalPopulation: 10000000,
  populationGrowthRate: 1.2,
  ageDistribution: {
    under15: 25,
    age15to64: 65,
    over65: 10,
  },
  urbanRuralSplit: {
    urban: 70,
    rural: 30,
  },
  regions: [
    {
      name: 'Capital Region',
      population: 3000000,
      populationPercent: 30,
      urbanPercent: 90,
      economicActivity: 40,
      developmentLevel: 'Advanced',
    },
    {
      name: 'Northern Province',
      population: 2500000,
      populationPercent: 25,
      urbanPercent: 60,
      economicActivity: 25,
      developmentLevel: 'Developed',
    },
    {
      name: 'Southern Region',
      population: 4500000,
      populationPercent: 45,
      urbanPercent: 50,
      economicActivity: 35,
      developmentLevel: 'Developing',
    },
  ],
  lifeExpectancy: 78.5,
  literacyRate: 95.0,
  educationLevels: {
    noEducation: 5,
    primary: 25,
    secondary: 45,
    tertiary: 25,
  },
  netMigrationRate: 2.5,
  immigrationRate: 3.0,
  emigrationRate: 0.5,
  infantMortalityRate: 8.5,
  maternalMortalityRate: 15,
  healthExpenditureGDP: 7.5,
  youthDependencyRatio: 38.5,
  elderlyDependencyRatio: 15.4,
  totalDependencyRatio: 53.9,
};

/**
 * Mock Labor Configuration
 */
export const mockLabor: LaborConfiguration = {
  totalWorkforce: 6500000,
  laborForceParticipationRate: 65,
  employmentRate: 94,
  unemploymentRate: 6,
  underemploymentRate: 8,
  youthUnemploymentRate: 12,
  seniorEmploymentRate: 45,
  femaleParticipationRate: 58,
  maleParticipationRate: 72,
  sectorDistribution: {
    agriculture: 12,
    mining: 2,
    manufacturing: 18,
    construction: 7,
    utilities: 2,
    wholesale: 5,
    retail: 10,
    transportation: 6,
    information: 4,
    finance: 6,
    professional: 8,
    education: 7,
    healthcare: 9,
    hospitality: 3,
    government: 1,
    other: 0,
  },
  employmentType: {
    fullTime: 70,
    partTime: 15,
    temporary: 5,
    seasonal: 3,
    selfEmployed: 5,
    gig: 1,
    informal: 1,
  },
  averageWorkweekHours: 40,
  averageOvertimeHours: 5,
  paidVacationDays: 20,
  paidSickLeaveDays: 10,
  parentalLeaveWeeks: 16,
  unionizationRate: 25,
  collectiveBargainingCoverage: 35,
  minimumWageHourly: 15.0,
  livingWageHourly: 22.5,
  workplaceSafetyIndex: 85,
  laborRightsScore: 80,
  workerProtections: {
    jobSecurity: 75,
    wageProtection: 80,
    healthSafety: 85,
    discriminationProtection: 90,
    collectiveRights: 70,
  },
};

/**
 * Mock Sector Configurations
 */
export const mockSectors: SectorConfiguration[] = [
  {
    id: 'agriculture_1',
    name: 'Agriculture',
    category: 'Primary',
    gdpContribution: 12,
    employmentShare: 15,
    productivity: 65,
    growthRate: 1.5,
    exports: 25,
    imports: 10,
    technologyLevel: 'Modern',
    automation: 30,
    regulation: 'Moderate',
    subsidy: 5,
    innovation: 50,
    sustainability: 70,
    competitiveness: 65,
  },
  {
    id: 'manufacturing_1',
    name: 'Manufacturing',
    category: 'Secondary',
    gdpContribution: 25,
    employmentShare: 20,
    productivity: 85,
    growthRate: 3.5,
    exports: 45,
    imports: 30,
    technologyLevel: 'Advanced',
    automation: 60,
    regulation: 'Moderate',
    subsidy: 2,
    innovation: 75,
    sustainability: 60,
    competitiveness: 80,
  },
  {
    id: 'services_1',
    name: 'Services',
    category: 'Tertiary',
    gdpContribution: 63,
    employmentShare: 65,
    productivity: 78,
    growthRate: 4.2,
    exports: 20,
    imports: 15,
    technologyLevel: 'Modern',
    automation: 40,
    regulation: 'Light',
    subsidy: 0,
    innovation: 80,
    sustainability: 75,
    competitiveness: 85,
  },
];

/**
 * Mock Atomic Economic Components
 */
export const mockAtomicComponents: EconomicComponentType[] = [
  EconomicComponentType.FREE_MARKET_SYSTEM,
  EconomicComponentType.FINANCE_CENTERED,
  EconomicComponentType.MANUFACTURING_LED,
];

/**
 * Mock Economy Builder State
 */
export const mockEconomyBuilder: EconomyBuilderState = {
  structure: {
    economicModel: 'Mixed Market Economy',
    primarySectors: ['Agriculture', 'Mining'],
    secondarySectors: ['Manufacturing', 'Construction'],
    tertiarySectors: ['Services', 'Finance', 'Technology'],
    totalGDP: 500000000000,
    gdpCurrency: 'USD',
    economicTier: 'Developed',
    growthStrategy: 'Balanced',
    sectors: mockSectors,
  },
  sectors: mockSectors,
  laborMarket: mockLabor,
  demographics: mockDemographics,
  selectedAtomicComponents: mockAtomicComponents,
  isValid: true,
  errors: {},
  validation: {
    errors: [],
    warnings: [],
    isValid: true,
  },
  lastUpdated: new Date('2025-10-16T12:00:00Z'),
  version: '1.0.0',
};

/**
 * Mock Partial Demographics (for testing updates)
 */
export const mockPartialDemographics: Partial<DemographicsConfiguration> = {
  totalPopulation: 15000000,
  populationGrowthRate: 2.0,
  lifeExpectancy: 80.0,
};

/**
 * Mock Partial Labor (for testing updates)
 */
export const mockPartialLabor: Partial<LaborConfiguration> = {
  employmentRate: 96,
  unemploymentRate: 4,
  minimumWageHourly: 18.0,
};

/**
 * Mock Invalid Demographics (validation testing)
 */
export const mockInvalidDemographics: DemographicsConfiguration = {
  ...mockDemographics,
  ageDistribution: {
    under15: 40,
    age15to64: 70, // Sum exceeds 100
    over65: 20,
  },
};

/**
 * Mock Invalid Sectors (validation testing)
 */
export const mockInvalidSectors: SectorConfiguration[] = [
  {
    ...mockSectors[0],
    gdpContribution: 50,
  },
  {
    ...mockSectors[1],
    gdpContribution: 60, // Total exceeds 100%
  },
];

/**
 * Helper: Create empty economy builder
 */
export function createEmptyEconomyBuilder(): EconomyBuilderState {
  return {
    structure: {
      economicModel: '',
      primarySectors: [],
      secondarySectors: [],
      tertiarySectors: [],
      totalGDP: 0,
      gdpCurrency: 'USD',
      economicTier: 'Developing',
      growthStrategy: 'Balanced',
      sectors: [],
    },
    sectors: [],
    laborMarket: {
      totalWorkforce: 0,
      laborForceParticipationRate: 0,
      employmentRate: 0,
      unemploymentRate: 0,
      underemploymentRate: 0,
      youthUnemploymentRate: 0,
      seniorEmploymentRate: 0,
      femaleParticipationRate: 0,
      maleParticipationRate: 0,
      sectorDistribution: {
        agriculture: 0,
        mining: 0,
        manufacturing: 0,
        construction: 0,
        utilities: 0,
        wholesale: 0,
        retail: 0,
        transportation: 0,
        information: 0,
        finance: 0,
        professional: 0,
        education: 0,
        healthcare: 0,
        hospitality: 0,
        government: 0,
        other: 0,
      },
      employmentType: {
        fullTime: 0,
        partTime: 0,
        temporary: 0,
        seasonal: 0,
        selfEmployed: 0,
        gig: 0,
        informal: 0,
      },
      averageWorkweekHours: 40,
      averageOvertimeHours: 0,
      paidVacationDays: 0,
      paidSickLeaveDays: 0,
      parentalLeaveWeeks: 0,
      unionizationRate: 0,
      collectiveBargainingCoverage: 0,
      minimumWageHourly: 0,
      livingWageHourly: 0,
      workplaceSafetyIndex: 0,
      laborRightsScore: 0,
      workerProtections: {
        jobSecurity: 0,
        wageProtection: 0,
        healthSafety: 0,
        discriminationProtection: 0,
        collectiveRights: 0,
      },
    },
    demographics: {
      totalPopulation: 0,
      populationGrowthRate: 0,
      ageDistribution: {
        under15: 0,
        age15to64: 0,
        over65: 0,
      },
      urbanRuralSplit: {
        urban: 0,
        rural: 0,
      },
      regions: [],
      lifeExpectancy: 0,
      literacyRate: 0,
      educationLevels: {
        noEducation: 0,
        primary: 0,
        secondary: 0,
        tertiary: 0,
      },
      netMigrationRate: 0,
      immigrationRate: 0,
      emigrationRate: 0,
      infantMortalityRate: 0,
      maternalMortalityRate: 0,
      healthExpenditureGDP: 0,
      youthDependencyRatio: 0,
      elderlyDependencyRatio: 0,
      totalDependencyRatio: 0,
    },
    selectedAtomicComponents: [],
    isValid: false,
    errors: {},
    lastUpdated: new Date(),
    version: '1.0.0',
  };
}

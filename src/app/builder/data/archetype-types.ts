/**
 * Economic Archetype Type Definitions
 *
 * Contains type definitions for economic archetypes extracted from EconomicArchetypeService
 * to enable better code organization and reusability. Archetypes represent proven economic
 * models from real-world examples like Silicon Valley (Innovation Hub), Nordic Model
 * (Social Democracy), Asian Tigers (Export-Led Growth), etc.
 *
 * @module archetype-types
 */

import { EconomicComponentType } from '~/lib/atomic-economic-data';
import { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';

/**
 * EconomicArchetype - Complete economic archetype definition
 *
 * An economic archetype is a pre-configured economic model based on real-world
 * examples. Each archetype includes economic components, government structure,
 * tax policies, and performance metrics validated by historical data.
 *
 * @interface EconomicArchetype
 * @property {string} id - Unique identifier (e.g., 'silicon-valley', 'nordic-model')
 * @property {string} name - Display name of the archetype
 * @property {string} description - Detailed description of characteristics
 * @property {string} region - Geographic region or origin
 * @property {string[]} characteristics - Key defining features
 * @property {EconomicComponentType[]} economicComponents - Economic atomic components
 * @property {ComponentType[]} governmentComponents - Government atomic components
 * @property {Object} taxProfile - Tax system configuration
 * @property {number} taxProfile.corporateRate - Corporate tax rate (0-100)
 * @property {number} taxProfile.incomeRate - Personal income tax rate (0-100)
 * @property {number} taxProfile.consumptionRate - Consumption/sales tax rate (0-100)
 * @property {number} taxProfile.revenueEfficiency - Collection efficiency (0-1)
 * @property {Record<string, number>} sectorFocus - Sector GDP contributions
 * @property {Object} employmentProfile - Labor market characteristics
 * @property {number} employmentProfile.unemploymentRate - Unemployment rate (0-100)
 * @property {number} employmentProfile.laborParticipation - Participation rate (0-100)
 * @property {number} employmentProfile.wageGrowth - Annual wage growth (0-100)
 * @property {Object} growthMetrics - Performance indicators
 * @property {number} growthMetrics.gdpGrowth - GDP growth rate (0-100)
 * @property {number} growthMetrics.innovationIndex - Innovation score (0-100)
 * @property {number} growthMetrics.competitiveness - Competitiveness score (0-100)
 * @property {number} growthMetrics.stability - Economic stability (0-100)
 * @property {string[]} strengths - Major advantages
 * @property {string[]} challenges - Key limitations
 * @property {'low'|'medium'|'high'} implementationComplexity - Difficulty level
 * @property {string[]} culturalFactors - Cultural influences
 * @property {string} historicalContext - Historical development
 * @property {string[]} modernExamples - Real-world examples
 * @property {string[]} recommendations - Implementation guidance
 *
 * @example
 * ```ts
 * const siliconValley: EconomicArchetype = {
 *   id: 'silicon-valley',
 *   name: 'Innovation Hub (Silicon Valley Model)',
 *   description: 'Tech-driven innovation economy...',
 *   region: 'North America',
 *   characteristics: ['High R&D', 'Venture capital', 'Tech clusters'],
 *   economicComponents: ['TECH_HUB', 'FREE_MARKET', 'INNOVATION_DRIVEN'],
 *   governmentComponents: ['LIGHT_REGULATION', 'IP_PROTECTION'],
 *   taxProfile: {
 *     corporateRate: 21,
 *     incomeRate: 35,
 *     consumptionRate: 8,
 *     revenueEfficiency: 0.85
 *   },
 *   sectorFocus: { technology: 45, finance: 20, services: 35 },
 *   employmentProfile: {
 *     unemploymentRate: 3.5,
 *     laborParticipation: 68,
 *     wageGrowth: 5.2
 *   },
 *   growthMetrics: {
 *     gdpGrowth: 4.5,
 *     innovationIndex: 95,
 *     competitiveness: 90,
 *     stability: 75
 *   },
 *   strengths: ['High productivity', 'Innovation leadership'],
 *   challenges: ['Income inequality', 'Housing costs'],
 *   implementationComplexity: 'high',
 *   culturalFactors: ['Risk-taking culture', 'Entrepreneurship'],
 *   historicalContext: 'Emerged from post-WWII tech boom...',
 *   modernExamples: ['San Francisco Bay Area', 'Austin', 'Seattle'],
 *   recommendations: ['Invest in education', 'Support startups']
 * };
 * ```
 */
export interface EconomicArchetype {
  /** Unique identifier for the archetype */
  id: string;

  /** Display name of the archetype */
  name: string;

  /** Detailed description of the archetype's characteristics */
  description: string;

  /** Geographic region this archetype is based on */
  region: string;

  /** Key characteristics and defining features */
  characteristics: string[];

  /** Economic components that make up this archetype */
  economicComponents: EconomicComponentType[];

  /** Government components that complement this archetype */
  governmentComponents: ComponentType[];

  /** Tax profile configuration */
  taxProfile: {
    /** Corporate tax rate (0-100) */
    corporateRate: number;
    /** Personal income tax rate (0-100) */
    incomeRate: number;
    /** Consumption/sales tax rate (0-100) */
    consumptionRate: number;
    /** Revenue collection efficiency (0-1) */
    revenueEfficiency: number;
  };

  /** Economic sector focus as percentage of GDP */
  sectorFocus: Record<string, number>;

  /** Employment and labor market profile */
  employmentProfile: {
    /** Unemployment rate (0-100) */
    unemploymentRate: number;
    /** Labor force participation rate (0-100) */
    laborParticipation: number;
    /** Annual wage growth rate (0-100) */
    wageGrowth: number;
  };

  /** Key growth and performance metrics */
  growthMetrics: {
    /** Annual GDP growth rate (0-100) */
    gdpGrowth: number;
    /** Innovation index score (0-100) */
    innovationIndex: number;
    /** Competitiveness score (0-100) */
    competitiveness: number;
    /** Economic stability score (0-100) */
    stability: number;
  };

  /** Major strengths of this archetype */
  strengths: string[];

  /** Key challenges and limitations */
  challenges: string[];

  /** Complexity level for implementation */
  implementationComplexity: 'low' | 'medium' | 'high';

  /** Cultural factors that influence this model */
  culturalFactors: string[];

  /** Historical context and development */
  historicalContext: string;

  /** Modern real-world examples */
  modernExamples: string[];

  /** Implementation recommendations */
  recommendations: string[];
}

/**
 * ArchetypeComparison - Multi-archetype comparison analysis
 *
 * Compares multiple economic archetypes across key performance metrics
 * to help users make informed decisions about which model best fits
 * their country's goals and constraints.
 *
 * @interface ArchetypeComparison
 * @property {EconomicArchetype[]} archetypes - Archetypes being compared
 * @property {Object} comparisonMetrics - Performance metrics by archetype ID
 * @property {Record<string, number>} comparisonMetrics.gdpGrowth - GDP growth rates
 * @property {Record<string, number>} comparisonMetrics.innovationIndex - Innovation scores
 * @property {Record<string, number>} comparisonMetrics.competitiveness - Competitiveness scores
 * @property {Record<string, number>} comparisonMetrics.stability - Economic stability scores
 * @property {Record<string, number>} comparisonMetrics.taxEfficiency - Tax efficiency scores
 * @property {string[]} recommendations - Generated recommendations
 *
 * @example
 * ```ts
 * const comparison: ArchetypeComparison = {
 *   archetypes: [siliconValleyArchetype, nordicModelArchetype],
 *   comparisonMetrics: {
 *     gdpGrowth: {
 *       'silicon-valley': 4.5,
 *       'nordic-model': 2.8
 *     },
 *     innovationIndex: {
 *       'silicon-valley': 95,
 *       'nordic-model': 88
 *     },
 *     competitiveness: {
 *       'silicon-valley': 90,
 *       'nordic-model': 92
 *     },
 *     stability: {
 *       'silicon-valley': 75,
 *       'nordic-model': 95
 *     },
 *     taxEfficiency: {
 *       'silicon-valley': 82,
 *       'nordic-model': 90
 *     }
 *   },
 *   recommendations: [
 *     'Silicon Valley model offers higher growth but more inequality',
 *     'Nordic model provides greater stability and social cohesion',
 *     'Consider hybrid approach combining innovation with social safety nets'
 *   ]
 * };
 * ```
 */
export interface ArchetypeComparison {
  /** Archetypes being compared */
  archetypes: EconomicArchetype[];

  /** Comparison metrics across all archetypes */
  comparisonMetrics: {
    /** GDP growth rates by archetype ID */
    gdpGrowth: Record<string, number>;
    /** Innovation index scores by archetype ID */
    innovationIndex: Record<string, number>;
    /** Competitiveness scores by archetype ID */
    competitiveness: Record<string, number>;
    /** Stability scores by archetype ID */
    stability: Record<string, number>;
    /** Tax efficiency scores by archetype ID */
    taxEfficiency: Record<string, number>;
  };

  /** Generated recommendations based on comparison */
  recommendations: string[];
}

/**
 * ArchetypeCategory - Economic archetype classification system
 *
 * Categorizes economic archetypes by their primary characteristics,
 * historical period, or geographic origin. Used for filtering and
 * organizing archetype options in the UI.
 *
 * @enum {string}
 *
 * @example
 * ```ts
 * // Filter archetypes by category
 * const modernArchetypes = allArchetypes.filter(
 *   a => a.category === ArchetypeCategory.MODERN
 * );
 *
 * // Group archetypes by category
 * const groupedArchetypes = {
 *   [ArchetypeCategory.MODERN]: [siliconValley, fintech],
 *   [ArchetypeCategory.REGIONAL]: [nordicModel, asianTiger],
 *   [ArchetypeCategory.HISTORICAL]: [goldStandard, mercantilism]
 * };
 * ```
 */
export enum ArchetypeCategory {
  /** Modern 21st century economic models (e.g., Silicon Valley, Fintech Hub) */
  MODERN = 'MODERN',

  /** Historical economic systems (e.g., Gold Standard, Mercantilism) */
  HISTORICAL = 'HISTORICAL',

  /** Region-specific models (e.g., Nordic Model, Asian Tigers) */
  REGIONAL = 'REGIONAL',

  /** Experimental or theoretical models being tested */
  EXPERIMENTAL = 'EXPERIMENTAL',

  /** Emerging economy models (e.g., BRICs development path) */
  EMERGING = 'EMERGING',

  /** Traditional economic structures (e.g., Agricultural, Resource-based) */
  TRADITIONAL = 'TRADITIONAL'
}

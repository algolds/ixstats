/**
 * Historical Economic Archetypes
 *
 * Contains pre-configured economic models based on significant historical periods
 * and empires. These archetypes provide insights into economic systems that shaped
 * world history from the medieval period through the early 20th century.
 *
 * Extracted from EconomicArchetypeService.ts lines 1117-2056
 */

import { EconomicComponentType } from '~/lib/atomic-economic-data';
import { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import type { EconomicArchetype } from '../archetype-types';

/**
 * Historical Economic Archetypes Map
 *
 * Contains 10 major historical economic models:
 * - British Empire (1700s-1900s): Global maritime empire with industrial revolution
 * - Venetian Republic (800s-1700s): Maritime trading republic with banking
 * - Hanseatic League (1200s-1600s): Northern European trading confederation
 * - Dutch Golden Age (1600s-1700s): Maritime trading power with banking innovation
 * - Industrial Revolution (1700s-1900s): Mass production economy with steam power
 * - Soviet Command (1920s-1990s): Centralized planned economy
 * - American Gilded Age (1870s-1900s): Rapid industrialization
 * - French Mercantilism (1600s-1700s): State-directed economy with royal monopolies
 * - Ottoman Empire (1300s-1900s): Multi-ethnic empire with trade routes
 * - Chinese Ming Dynasty (1368-1644): Agricultural empire with bureaucratic administration
 */
export const historicalArchetypes = new Map<string, EconomicArchetype>([
  // British Empire Model
  ['british-empire', {
    id: 'british-empire',
    name: 'British Empire Model',
    description: 'Global maritime empire with colonial trade, industrial revolution, and naval supremacy (1700s-1900s)',
    region: 'British Empire (Global)',
    characteristics: [
      'Global maritime trade network',
      'Colonial resource extraction',
      'Industrial revolution leadership',
      'Naval supremacy and control',
      'Free trade policies',
      'Imperial administration'
    ],
    economicComponents: [
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.FREE_TRADE,
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
      EconomicComponentType.TRADE_BLOC,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.TECHNOLOGY_FOCUSED
    ],
    governmentComponents: [
      ComponentType.CENTRALIZED_POWER,
      ComponentType.AUTOCRATIC_PROCESS,
      ComponentType.MILITARY_ADMINISTRATION,
      ComponentType.FREE_MARKET_SYSTEM,
      ComponentType.MILITARY_ENFORCEMENT
    ],
    taxProfile: {
      corporateRate: 0,
      incomeRate: 5,
      consumptionRate: 15,
      revenueEfficiency: 0.65
    },
    sectorFocus: {
      'manufacturing': 35,
      'trade': 25,
      'agriculture': 20,
      'government': 10,
      'finance': 5,
      'mining': 5
    },
    employmentProfile: {
      unemploymentRate: 8.5,
      laborParticipation: 45,
      wageGrowth: 2.1
    },
    growthMetrics: {
      gdpGrowth: 1.8,
      innovationIndex: 75,
      competitiveness: 85,
      stability: 78
    },
    strengths: [
      'Global trade network',
      'Industrial leadership',
      'Naval supremacy',
      'Technological innovation',
      'Resource access',
      'Administrative efficiency'
    ],
    challenges: [
      'Colonial resistance',
      'High military costs',
      'Economic inequality',
      'Resource dependency',
      'Administrative complexity',
      'Competition from rivals'
    ],
    implementationComplexity: 'high',
    culturalFactors: [
      'Imperial mindset',
      'Maritime culture',
      'Industrial work ethic',
      'Global perspective',
      'Administrative tradition'
    ],
    historicalContext: 'Dominant global power from 1700s-1900s through naval supremacy, industrial revolution, and colonial expansion',
    modernExamples: ['London, UK', 'Liverpool, UK', 'Manchester, UK', 'Birmingham, UK'],
    recommendations: [
      'Build strong naval capabilities',
      'Develop global trade networks',
      'Invest in industrial technology',
      'Maintain administrative efficiency',
      'Focus on resource extraction',
      'Balance imperial costs'
    ]
  }],

  // Venetian Republic Model
  ['venetian-republic', {
    id: 'venetian-republic',
    name: 'Venetian Republic Model',
    description: 'Maritime trading republic with banking, shipbuilding, and Mediterranean commerce dominance (800s-1700s)',
    region: 'Venetian Republic (Italy)',
    characteristics: [
      'Maritime trading dominance',
      'Advanced banking system',
      'Shipbuilding excellence',
      'Mediterranean commerce control',
      'Republican governance',
      'Cultural and artistic patronage'
    ],
    economicComponents: [
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.FINANCE_CENTERED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.SKILL_BASED,
      EconomicComponentType.FREE_TRADE
    ],
    governmentComponents: [
      ComponentType.DEMOCRATIC_PROCESS,
      ComponentType.RULE_OF_LAW,
      ComponentType.OLIGARCHIC_PROCESS,
      ComponentType.CULTURAL_PRESERVATION,
      ComponentType.ECONOMIC_INCENTIVES
    ],
    taxProfile: {
      corporateRate: 0,
      incomeRate: 8,
      consumptionRate: 12,
      revenueEfficiency: 0.72
    },
    sectorFocus: {
      'trade': 40,
      'manufacturing': 25,
      'finance': 15,
      'government': 8,
      'agriculture': 7,
      'services': 5
    },
    employmentProfile: {
      unemploymentRate: 6.2,
      laborParticipation: 55,
      wageGrowth: 2.8
    },
    growthMetrics: {
      gdpGrowth: 2.2,
      innovationIndex: 82,
      competitiveness: 88,
      stability: 85
    },
    strengths: [
      'Maritime trade dominance',
      'Advanced banking system',
      'Shipbuilding excellence',
      'Cultural achievements',
      'Republican stability',
      'Mediterranean control'
    ],
    challenges: [
      'Limited territory',
      'Ottoman competition',
      'High defense costs',
      'Population constraints',
      'Trade route changes',
      'Political factionalism'
    ],
    implementationComplexity: 'high',
    culturalFactors: [
      'Maritime culture',
      'Merchant values',
      'Artistic patronage',
      'Republican ideals',
      'Commercial innovation'
    ],
    historicalContext: 'Dominant Mediterranean power from 800s-1700s through maritime trade, banking, and cultural achievements',
    modernExamples: ['Venice, Italy', 'Dubai, UAE', 'Singapore', 'Hong Kong'],
    recommendations: [
      'Develop maritime trade capabilities',
      'Build advanced banking system',
      'Invest in shipbuilding',
      'Maintain cultural excellence',
      'Focus on commercial innovation',
      'Balance republican governance'
    ]
  }],

  // Hanseatic League Model
  ['hanseatic-league', {
    id: 'hanseatic-league',
    name: 'Hanseatic League Model',
    description: 'Northern European trading confederation with Baltic commerce, guild systems, and merchant cooperation (1200s-1600s)',
    region: 'Northern Europe (Baltic)',
    characteristics: [
      'Baltic and North Sea trade',
      'Merchant guild cooperation',
      'City-state confederation',
      'Guild-based production',
      'Mutual protection agreements',
      'Commercial law development'
    ],
    economicComponents: [
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.PROTECTED_WORKERS,
      EconomicComponentType.FREE_TRADE,
      EconomicComponentType.MIXED_ECONOMY,
      EconomicComponentType.BALANCED_TRADE,
      EconomicComponentType.RULE_OF_LAW,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.BALANCED_TRADE,
      EconomicComponentType.PROTECTIONIST
    ],
    governmentComponents: [
      ComponentType.CONFEDERATE_SYSTEM,
      ComponentType.CONSENSUS_PROCESS,
      ComponentType.RULE_OF_LAW,
      ComponentType.RULE_OF_LAW,
      ComponentType.SECURITY_ALLIANCES
    ],
    taxProfile: {
      corporateRate: 0,
      incomeRate: 6,
      consumptionRate: 10,
      revenueEfficiency: 0.68
    },
    sectorFocus: {
      'trade': 35,
      'manufacturing': 30,
      'agriculture': 15,
      'government': 8,
      'finance': 7,
      'services': 5
    },
    employmentProfile: {
      unemploymentRate: 7.1,
      laborParticipation: 52,
      wageGrowth: 2.3
    },
    growthMetrics: {
      gdpGrowth: 1.9,
      innovationIndex: 71,
      competitiveness: 79,
      stability: 82
    },
    strengths: [
      'Baltic trade dominance',
      'Guild system efficiency',
      'Merchant cooperation',
      'Commercial law development',
      'Collective security',
      'Artisan quality'
    ],
    challenges: [
      'Confederation complexity',
      'Guild restrictions',
      'External competition',
      'Political fragmentation',
      'Limited innovation',
      'Resource constraints'
    ],
    implementationComplexity: 'medium',
    culturalFactors: [
      'Merchant cooperation',
      'Guild traditions',
      'Northern European culture',
      'Commercial law respect',
      'Collective security values'
    ],
    historicalContext: 'Dominant Northern European trading network from 1200s-1600s through merchant cooperation and guild systems',
    modernExamples: ['Hamburg, Germany', 'Lübeck, Germany', 'Bremen, Germany', 'Copenhagen, Denmark'],
    recommendations: [
      'Develop merchant cooperation',
      'Build guild systems',
      'Focus on Baltic trade',
      'Maintain commercial law',
      'Invest in collective security',
      'Balance confederation governance'
    ]
  }],

  // Dutch Golden Age Model
  ['dutch-golden-age', {
    id: 'dutch-golden-age',
    name: 'Dutch Golden Age Model',
    description: 'Maritime trading power with banking innovation, art patronage, and global commerce (1600s-1700s)',
    region: 'Netherlands',
    characteristics: [
      'Global maritime trade',
      'Banking and finance innovation',
      'Art and cultural patronage',
      'Religious tolerance',
      'Urban development',
      'Technological innovation'
    ],
    economicComponents: [
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.FINANCE_CENTERED,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.FINANCE_CENTERED,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.FREE_MARKET_SYSTEM
    ],
    governmentComponents: [
      ComponentType.FEDERAL_SYSTEM,
      ComponentType.OLIGARCHIC_PROCESS,
      ComponentType.MINORITY_RIGHTS,
      ComponentType.RULE_OF_LAW,
      ComponentType.ECONOMIC_INCENTIVES
    ],
    taxProfile: {
      corporateRate: 0,
      incomeRate: 10,
      consumptionRate: 8,
      revenueEfficiency: 0.78
    },
    sectorFocus: {
      'trade': 35,
      'finance': 20,
      'manufacturing': 20,
      'agriculture': 10,
      'government': 8,
      'services': 7
    },
    employmentProfile: {
      unemploymentRate: 5.8,
      laborParticipation: 58,
      wageGrowth: 3.2
    },
    growthMetrics: {
      gdpGrowth: 2.5,
      innovationIndex: 89,
      competitiveness: 91,
      stability: 87
    },
    strengths: [
      'Global trade network',
      'Banking innovation',
      'Cultural excellence',
      'Religious tolerance',
      'Urban development',
      'Technological advancement'
    ],
    challenges: [
      'Limited territory',
      'High defense costs',
      'Competition from rivals',
      'Population constraints',
      'Resource limitations',
      'Political complexity'
    ],
    implementationComplexity: 'high',
    culturalFactors: [
      'Merchant culture',
      'Religious tolerance',
      'Artistic patronage',
      'Urban sophistication',
      'Innovation mindset'
    ],
    historicalContext: 'Golden age of prosperity from 1600s-1700s through maritime trade, banking innovation, and cultural achievements',
    modernExamples: ['Amsterdam, Netherlands', 'Rotterdam, Netherlands', 'The Hague, Netherlands', 'Utrecht, Netherlands'],
    recommendations: [
      'Develop global trade networks',
      'Innovate in banking and finance',
      'Invest in cultural excellence',
      'Maintain religious tolerance',
      'Focus on urban development',
      'Promote technological innovation'
    ]
  }],

  // Industrial Revolution Model
  ['industrial-revolution', {
    id: 'industrial-revolution',
    name: 'Industrial Revolution Model',
    description: 'Mass production economy with steam power, factory systems, and urbanization (1700s-1900s)',
    region: 'Great Britain',
    characteristics: [
      'Steam power and mechanization',
      'Factory system development',
      'Mass production methods',
      'Urbanization and migration',
      'Capital accumulation',
      'Technological innovation'
    ],
    economicComponents: [
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.EXPORT_ORIENTED
    ],
    governmentComponents: [
      ComponentType.DEMOCRATIC_PROCESS,
      ComponentType.TECHNOCRATIC_AGENCIES,
      ComponentType.STRATEGIC_PLANNING,
      ComponentType.WORKER_PROTECTION,
      ComponentType.INNOVATION_ECOSYSTEM
    ],
    taxProfile: {
      corporateRate: 0,
      incomeRate: 12,
      consumptionRate: 18,
      revenueEfficiency: 0.71
    },
    sectorFocus: {
      'manufacturing': 45,
      'agriculture': 20,
      'trade': 15,
      'government': 8,
      'finance': 7,
      'services': 5
    },
    employmentProfile: {
      unemploymentRate: 9.2,
      laborParticipation: 48,
      wageGrowth: 1.8
    },
    growthMetrics: {
      gdpGrowth: 2.8,
      innovationIndex: 85,
      competitiveness: 87,
      stability: 75
    },
    strengths: [
      'Technological innovation',
      'Mass production efficiency',
      'Capital accumulation',
      'Urban development',
      'Transportation revolution',
      'Industrial leadership'
    ],
    challenges: [
      'Labor exploitation',
      'Urban overcrowding',
      'Environmental degradation',
      'Social inequality',
      'Economic instability',
      'Resource depletion'
    ],
    implementationComplexity: 'high',
    culturalFactors: [
      'Industrial work ethic',
      'Innovation culture',
      'Urban migration',
      'Capitalist values',
      'Technological optimism'
    ],
    historicalContext: 'Revolutionary transformation from 1700s-1900s through steam power, factory systems, and mass production',
    modernExamples: ['Manchester, UK', 'Birmingham, UK', 'Sheffield, UK', 'Leeds, UK'],
    recommendations: [
      'Invest in technological innovation',
      'Develop factory systems',
      'Build transportation infrastructure',
      'Manage urbanization',
      'Balance labor relations',
      'Address environmental impacts'
    ]
  }],

  // Soviet Command Economy Model
  ['soviet-command', {
    id: 'soviet-command',
    name: 'Soviet Command Economy Model',
    description: 'Centralized planned economy with state ownership, five-year plans, and industrial development (1920s-1990s)',
    region: 'Soviet Union',
    characteristics: [
      'Central economic planning',
      'State ownership of production',
      'Five-year development plans',
      'Industrial prioritization',
      'Collective agriculture',
      'Military-industrial complex'
    ],
    economicComponents: [
      EconomicComponentType.PLANNED_ECONOMY,
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.EDUCATION_FOCUSED,
      EconomicComponentType.HEALTHCARE_FOCUSED
    ],
    governmentComponents: [
      ComponentType.CENTRALIZED_POWER,
      ComponentType.AUTOCRATIC_PROCESS,
      ComponentType.TECHNOCRATIC_AGENCIES,
      ComponentType.STATE_CAPITALISM,
      ComponentType.CONSENSUS_PROCESS
    ],
    taxProfile: {
      corporateRate: 100,
      incomeRate: 13,
      consumptionRate: 0,
      revenueEfficiency: 0.82
    },
    sectorFocus: {
      'manufacturing': 40,
      'agriculture': 25,
      'government': 20,
      'energy': 8,
      'services': 5,
      'finance': 2
    },
    employmentProfile: {
      unemploymentRate: 0.1,
      laborParticipation: 85,
      wageGrowth: 2.1
    },
    growthMetrics: {
      gdpGrowth: 3.2,
      innovationIndex: 68,
      competitiveness: 45,
      stability: 88
    },
    strengths: [
      'Rapid industrialization',
      'Full employment',
      'Social equality',
      'Educational achievements',
      'Scientific advancement',
      'Infrastructure development'
    ],
    challenges: [
      'Economic inefficiency',
      'Consumer goods shortages',
      'Innovation limitations',
      'Environmental degradation',
      'Political repression',
      'Resource misallocation'
    ],
    implementationComplexity: 'high',
    culturalFactors: [
      'Collective values',
      'Industrial work ethic',
      'Educational emphasis',
      'Scientific culture',
      'Socialist ideology'
    ],
    historicalContext: 'Centralized planned economy from 1920s-1990s with rapid industrialization and social transformation',
    modernExamples: ['Moscow, Russia', 'St. Petersburg, Russia', 'Kiev, Ukraine', 'Minsk, Belarus'],
    recommendations: [
      'Implement central planning',
      'Develop heavy industry',
      'Invest in education',
      'Maintain social equality',
      'Balance efficiency and equity',
      'Manage resource allocation'
    ]
  }],

  // American Gilded Age Model
  ['american-gilded-age', {
    id: 'american-gilded-age',
    name: 'American Gilded Age Model',
    description: 'Rapid industrialization with railroad expansion, steel production, and corporate consolidation (1870s-1900s)',
    region: 'United States',
    characteristics: [
      'Railroad network expansion',
      'Steel and oil industries',
      'Corporate consolidation',
      'Immigration and urbanization',
      'Technological innovation',
      'Economic inequality'
    ],
    economicComponents: [
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.FLEXIBLE_LABOR,
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.EXPORT_ORIENTED
    ],
    governmentComponents: [
      ComponentType.FEDERAL_SYSTEM,
      ComponentType.FREE_MARKET_SYSTEM,
      ComponentType.ECONOMIC_INCENTIVES,
      ComponentType.WORKER_PROTECTION,
      ComponentType.STRATEGIC_PLANNING
    ],
    taxProfile: {
      corporateRate: 0,
      incomeRate: 0,
      consumptionRate: 25,
      revenueEfficiency: 0.69
    },
    sectorFocus: {
      'manufacturing': 35,
      'transportation': 20,
      'agriculture': 20,
      'government': 8,
      'finance': 10,
      'services': 7
    },
    employmentProfile: {
      unemploymentRate: 8.5,
      laborParticipation: 55,
      wageGrowth: 2.9
    },
    growthMetrics: {
      gdpGrowth: 3.8,
      innovationIndex: 78,
      competitiveness: 82,
      stability: 72
    },
    strengths: [
      'Rapid industrialization',
      'Infrastructure development',
      'Technological innovation',
      'Market expansion',
      'Capital accumulation',
      'Immigration benefits'
    ],
    challenges: [
      'Economic inequality',
      'Labor exploitation',
      'Monopoly power',
      'Political corruption',
      'Social unrest',
      'Environmental damage'
    ],
    implementationComplexity: 'medium',
    culturalFactors: [
      'Entrepreneurial spirit',
      'Immigration culture',
      'Industrial work ethic',
      'Capitalist values',
      'Innovation drive'
    ],
    historicalContext: 'Rapid economic expansion from 1870s-1900s through industrialization, railroads, and corporate growth',
    modernExamples: ['New York, USA', 'Chicago, USA', 'Pittsburgh, USA', 'Detroit, USA'],
    recommendations: [
      'Invest in infrastructure',
      'Develop heavy industries',
      'Support technological innovation',
      'Manage corporate power',
      'Address social inequality',
      'Balance growth and equity'
    ]
  }],

  // French Mercantilism Model
  ['french-mercantilism', {
    id: 'french-mercantilism',
    name: 'French Mercantilism Model',
    description: 'State-directed economy with royal monopolies, luxury goods, and colonial expansion (1600s-1700s)',
    region: 'France',
    characteristics: [
      'State economic direction',
      'Royal monopolies and privileges',
      'Luxury goods production',
      'Colonial expansion',
      'Mercantilist policies',
      'Cultural and artistic excellence'
    ],
    economicComponents: [
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.PROTECTIONIST,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.PROTECTIONIST,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.SKILL_BASED,
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.PROTECTIONIST
    ],
    governmentComponents: [
      ComponentType.CENTRALIZED_POWER,
      ComponentType.AUTOCRATIC_PROCESS,
      ComponentType.MILITARY_ADMINISTRATION,
      ComponentType.CULTURAL_PRESERVATION,
      ComponentType.ECONOMIC_INCENTIVES
    ],
    taxProfile: {
      corporateRate: 0,
      incomeRate: 15,
      consumptionRate: 20,
      revenueEfficiency: 0.73
    },
    sectorFocus: {
      'agriculture': 35,
      'manufacturing': 25,
      'government': 20,
      'trade': 10,
      'finance': 5,
      'services': 5
    },
    employmentProfile: {
      unemploymentRate: 12.3,
      laborParticipation: 42,
      wageGrowth: 1.5
    },
    growthMetrics: {
      gdpGrowth: 1.2,
      innovationIndex: 76,
      competitiveness: 71,
      stability: 85
    },
    strengths: [
      'Cultural excellence',
      'Luxury goods production',
      'State coordination',
      'Artisan craftsmanship',
      'Colonial resources',
      'Agricultural development'
    ],
    challenges: [
      'Economic inefficiency',
      'High taxation',
      'Social inequality',
      'Limited innovation',
      'Colonial resistance',
      'Administrative complexity'
    ],
    implementationComplexity: 'high',
    culturalFactors: [
      'Royal court culture',
      'Artistic excellence',
      'Artisan traditions',
      'Mercantilist mindset',
      'Cultural sophistication'
    ],
    historicalContext: 'State-directed economy from 1600s-1700s with royal monopolies, luxury production, and colonial expansion',
    modernExamples: ['Paris, France', 'Lyon, France', 'Marseille, France', 'Bordeaux, France'],
    recommendations: [
      'Develop luxury industries',
      'Maintain cultural excellence',
      'Balance state direction',
      'Invest in artisan crafts',
      'Manage colonial resources',
      'Address social inequality'
    ]
  }],

  // Ottoman Empire Model
  ['ottoman-empire', {
    id: 'ottoman-empire',
    name: 'Ottoman Empire Model',
    description: 'Multi-ethnic empire with trade routes, agricultural production, and administrative efficiency (1300s-1900s)',
    region: 'Ottoman Empire (Multi-continental)',
    characteristics: [
      'Multi-ethnic administration',
      'Trade route control',
      'Agricultural production',
      'Religious tolerance',
      'Administrative efficiency',
      'Military organization'
    ],
    economicComponents: [
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.MIXED_ECONOMY,
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.PROTECTED_WORKERS
    ],
    governmentComponents: [
      ComponentType.CENTRALIZED_POWER,
      ComponentType.CONSENSUS_PROCESS,
      ComponentType.MINORITY_RIGHTS,
      ComponentType.MILITARY_ADMINISTRATION,
      ComponentType.ECONOMIC_INCENTIVES
    ],
    taxProfile: {
      corporateRate: 0,
      incomeRate: 8,
      consumptionRate: 12,
      revenueEfficiency: 0.67
    },
    sectorFocus: {
      'agriculture': 45,
      'trade': 20,
      'manufacturing': 15,
      'government': 12,
      'services': 5,
      'finance': 3
    },
    employmentProfile: {
      unemploymentRate: 6.8,
      laborParticipation: 48,
      wageGrowth: 1.9
    },
    growthMetrics: {
      gdpGrowth: 1.5,
      innovationIndex: 62,
      competitiveness: 68,
      stability: 82
    },
    strengths: [
      'Trade route control',
      'Agricultural productivity',
      'Administrative efficiency',
      'Religious tolerance',
      'Military organization',
      'Multi-ethnic integration'
    ],
    challenges: [
      'Administrative complexity',
      'Economic stagnation',
      'Technological lag',
      'External competition',
      'Internal conflicts',
      'Resource constraints'
    ],
    implementationComplexity: 'high',
    culturalFactors: [
      'Multi-ethnic culture',
      'Religious tolerance',
      'Administrative tradition',
      'Military values',
      'Trade orientation'
    ],
    historicalContext: 'Multi-continental empire from 1300s-1900s with trade control, agricultural production, and administrative efficiency',
    modernExamples: ['Istanbul, Turkey', 'Cairo, Egypt', 'Damascus, Syria', 'Baghdad, Iraq'],
    recommendations: [
      'Control key trade routes',
      'Develop agricultural production',
      'Maintain administrative efficiency',
      'Preserve religious tolerance',
      'Invest in military organization',
      'Balance multi-ethnic governance'
    ]
  }],

  // Chinese Ming Dynasty Model
  ['chinese-ming-dynasty', {
    id: 'chinese-ming-dynasty',
    name: 'Chinese Ming Dynasty Model',
    description: 'Agricultural empire with bureaucratic administration, porcelain production, and maritime exploration (1368-1644)',
    region: 'China',
    characteristics: [
      'Bureaucratic administration',
      'Agricultural development',
      'Porcelain and silk production',
      'Maritime exploration',
      'Confucian governance',
      'Cultural achievements'
    ],
    economicComponents: [
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.EDUCATION_FOCUSED,
      EconomicComponentType.SKILL_BASED,
      EconomicComponentType.PROTECTIONIST
    ],
    governmentComponents: [
      ComponentType.CENTRALIZED_POWER,
      ComponentType.PROFESSIONAL_BUREAUCRACY,
      ComponentType.TRADITIONAL_LEGITIMACY,
      ComponentType.PUBLIC_EDUCATION,
      ComponentType.CULTURAL_PRESERVATION
    ],
    taxProfile: {
      corporateRate: 0,
      incomeRate: 10,
      consumptionRate: 15,
      revenueEfficiency: 0.74
    },
    sectorFocus: {
      'agriculture': 50,
      'manufacturing': 20,
      'government': 15,
      'trade': 8,
      'services': 5,
      'finance': 2
    },
    employmentProfile: {
      unemploymentRate: 5.2,
      laborParticipation: 52,
      wageGrowth: 2.2
    },
    growthMetrics: {
      gdpGrowth: 1.8,
      innovationIndex: 79,
      competitiveness: 75,
      stability: 89
    },
    strengths: [
      'Bureaucratic efficiency',
      'Agricultural productivity',
      'Cultural achievements',
      'Artisan excellence',
      'Educational system',
      'Administrative stability'
    ],
    challenges: [
      'Economic stagnation',
      'Limited innovation',
      'External threats',
      'Administrative corruption',
      'Resource constraints',
      'Technological lag'
    ],
    implementationComplexity: 'high',
    culturalFactors: [
      'Confucian values',
      'Bureaucratic culture',
      'Artistic excellence',
      'Educational emphasis',
      'Agricultural tradition'
    ],
    historicalContext: 'Imperial dynasty from 1368-1644 with bureaucratic administration, agricultural development, and cultural achievements',
    modernExamples: ['Beijing, China', 'Nanjing, China', 'Suzhou, China', 'Hangzhou, China'],
    recommendations: [
      'Develop bureaucratic administration',
      'Invest in agricultural productivity',
      'Maintain cultural excellence',
      'Support artisan crafts',
      'Balance tradition and innovation',
      'Manage external relations'
    ]
  }]
]);

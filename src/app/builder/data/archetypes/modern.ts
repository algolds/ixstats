/**
 * Modern Economic Archetypes
 *
 * Extracted from EconomicArchetypeService.ts
 * Contains contemporary economic models from the late 20th and 21st centuries.
 */

import type { EconomicArchetype } from '../archetype-types';
import { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';

export const modernArchetypes = new Map<string, EconomicArchetype>([
  ['silicon-valley', {
    id: 'silicon-valley',
    name: 'Silicon Valley Model',
    description: 'Innovation-driven economy with strong tech sector, venture capital, and entrepreneurial culture',
    region: 'United States (California)',
    characteristics: [
      'High innovation and R&D investment',
      'Strong venture capital ecosystem',
      'Flexible labor markets',
      'Minimal government intervention',
      'High income inequality',
      'Expensive cost of living'
    ],
    economicComponents: [
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.KNOWLEDGE_ECONOMY,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.FLEXIBLE_LABOR,
      EconomicComponentType.STARTUP_ECOSYSTEM,
      EconomicComponentType.FREE_TRADE,
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.HIGH_SKILLED_WORKERS,
      EconomicComponentType.INTELLECTUAL_PROPERTY,
      EconomicComponentType.VENTURE_CAPITAL
    ],
    governmentComponents: [
      ComponentType.MINIMAL_GOVERNMENT,
      ComponentType.PRIVATE_SECTOR_LEADERSHIP,
      ComponentType.DEMOCRATIC_PROCESS,
      ComponentType.FEDERAL_SYSTEM
    ],
    taxProfile: {
      corporateRate: 21,
      incomeRate: 37,
      consumptionRate: 7.25,
      revenueEfficiency: 0.78
    },
    sectorFocus: {
      'technology': 35,
      'finance': 20,
      'services': 25,
      'manufacturing': 10,
      'agriculture': 2,
      'government': 8
    },
    employmentProfile: {
      unemploymentRate: 3.5,
      laborParticipation: 68,
      wageGrowth: 4.2
    },
    growthMetrics: {
      gdpGrowth: 3.8,
      innovationIndex: 95,
      competitiveness: 92,
      stability: 75
    },
    strengths: [
      'World-leading innovation ecosystem',
      'Attracts top global talent',
      'High productivity and wages',
      'Strong intellectual property protection',
      'Dynamic entrepreneurial environment'
    ],
    challenges: [
      'High cost of living and housing',
      'Income inequality',
      'Traffic and infrastructure strain',
      'Dependency on tech sector',
      'Regulatory complexity'
    ],
    implementationComplexity: 'high',
    culturalFactors: [
      'Risk-taking culture',
      'Merit-based advancement',
      'Diverse international workforce',
      'Work-life balance challenges',
      'High stress environment'
    ],
    historicalContext: 'Emerged from defense industry in 1950s-60s, accelerated by semiconductor revolution and internet boom',
    modernExamples: ['San Francisco Bay Area', 'Austin, Texas', 'Seattle, Washington', 'Boston, Massachusetts'],
    recommendations: [
      'Invest heavily in R&D and education',
      'Create flexible regulatory environment',
      'Develop strong IP protection laws',
      'Foster venture capital ecosystem',
      'Address housing affordability',
      'Improve public transportation'
    ]
  }],

  ['nordic', {
    id: 'nordic',
    name: 'Nordic Model',
    description: 'Social market economy with high taxes, extensive welfare, and strong social cohesion',
    region: 'Scandinavia (Denmark, Sweden, Norway, Finland)',
    characteristics: [
      'High tax rates with extensive social services',
      'Strong labor unions and worker protection',
      'Gender equality and social mobility',
      'High trust in government institutions',
      'Strong environmental policies',
      'Innovation in public sector'
    ],
    economicComponents: [
      EconomicComponentType.SOCIAL_MARKET_ECONOMY,
      EconomicComponentType.MIXED_ECONOMY,
      EconomicComponentType.PROTECTED_WORKERS,
      EconomicComponentType.KNOWLEDGE_ECONOMY,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.BALANCED_TRADE,
      EconomicComponentType.GREEN_ECONOMY,
      EconomicComponentType.HIGH_SKILLED_WORKERS,
      EconomicComponentType.EDUCATION_FOCUSED,
      EconomicComponentType.HEALTHCARE_FOCUSED
    ],
    governmentComponents: [
      ComponentType.SOCIAL_DEMOCRACY,
      ComponentType.COMPREHENSIVE_WELFARE,
      ComponentType.PUBLIC_SECTOR_LEADERSHIP,
      ComponentType.DEMOCRATIC_PROCESS,
      ComponentType.ENVIRONMENTAL_FOCUS
    ],
    taxProfile: {
      corporateRate: 22,
      incomeRate: 55,
      consumptionRate: 25,
      revenueEfficiency: 0.92
    },
    sectorFocus: {
      'services': 30,
      'manufacturing': 20,
      'technology': 15,
      'government': 25,
      'agriculture': 3,
      'finance': 7
    },
    employmentProfile: {
      unemploymentRate: 6.5,
      laborParticipation: 72,
      wageGrowth: 2.8
    },
    growthMetrics: {
      gdpGrowth: 2.5,
      innovationIndex: 88,
      competitiveness: 85,
      stability: 95
    },
    strengths: [
      'High social equality and mobility',
      'Strong education and healthcare systems',
      'High trust and social cohesion',
      'Environmental leadership',
      'Innovation in public services',
      'Gender equality'
    ],
    challenges: [
      'High tax burden',
      'Limited entrepreneurship incentives',
      'Bureaucratic complexity',
      'Dependency on public sector',
      'Demographic aging',
      'Integration challenges'
    ],
    implementationComplexity: 'high',
    culturalFactors: [
      'High trust in institutions',
      'Collectivist mindset',
      'Work-life balance emphasis',
      'Environmental consciousness',
      'Gender equality values'
    ],
    historicalContext: 'Developed post-WWII with strong labor movements and social democratic governance',
    modernExamples: ['Copenhagen, Denmark', 'Stockholm, Sweden', 'Oslo, Norway', 'Helsinki, Finland'],
    recommendations: [
      'Build strong social safety nets',
      'Invest in education and healthcare',
      'Implement progressive taxation',
      'Foster social trust and cohesion',
      'Develop green technologies',
      'Maintain work-life balance'
    ]
  }],

  ['asian-tiger', {
    id: 'asian-tiger',
    name: 'Asian Tiger Model',
    description: 'Export-oriented development with strong state guidance and rapid industrialization',
    region: 'East Asia (South Korea, Taiwan, Singapore, Hong Kong)',
    characteristics: [
      'Export-oriented industrialization',
      'Strong state guidance and planning',
      'High savings and investment rates',
      'Focus on manufacturing and technology',
      'Rapid economic transformation',
      'Strong work ethic and education'
    ],
    economicComponents: [
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.HIGH_SKILLED_WORKERS,
      EconomicComponentType.EDUCATION_FOCUSED,
      EconomicComponentType.RESEARCH_AND_DEVELOPMENT,
      EconomicComponentType.FREE_TRADE,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.COMPETITIVE_MARKETS
    ],
    governmentComponents: [
      ComponentType.CENTRALIZED_POWER,
      ComponentType.ECONOMIC_PLANNING,
      ComponentType.PUBLIC_SECTOR_LEADERSHIP,
      ComponentType.DEVELOPMENTAL_STATE,
      ComponentType.TECHNOCRATIC_PROCESS
    ],
    taxProfile: {
      corporateRate: 25,
      incomeRate: 40,
      consumptionRate: 10,
      revenueEfficiency: 0.85
    },
    sectorFocus: {
      'manufacturing': 35,
      'technology': 25,
      'services': 20,
      'finance': 10,
      'agriculture': 2,
      'government': 8
    },
    employmentProfile: {
      unemploymentRate: 3.8,
      laborParticipation: 65,
      wageGrowth: 5.2
    },
    growthMetrics: {
      gdpGrowth: 4.5,
      innovationIndex: 90,
      competitiveness: 95,
      stability: 80
    },
    strengths: [
      'Rapid economic transformation',
      'Strong manufacturing base',
      'High education and skills',
      'Export competitiveness',
      'Innovation in technology',
      'Strong work ethic'
    ],
    challenges: [
      'High pressure and stress',
      'Limited work-life balance',
      'Dependency on exports',
      'Environmental concerns',
      'Aging population',
      'Geopolitical tensions'
    ],
    implementationComplexity: 'medium',
    culturalFactors: [
      'Strong work ethic',
      'Education emphasis',
      'Collective achievement',
      'Respect for authority',
      'Innovation focus'
    ],
    historicalContext: 'Developed rapidly from 1960s-90s through export-oriented industrialization and state guidance',
    modernExamples: ['Seoul, South Korea', 'Taipei, Taiwan', 'Singapore', 'Hong Kong'],
    recommendations: [
      'Focus on export-oriented development',
      'Invest heavily in education and R&D',
      'Develop strong manufacturing base',
      'Implement state-guided planning',
      'Foster innovation ecosystem',
      'Balance work-life demands'
    ]
  }],

  ['german-social-market', {
    id: 'german-social-market',
    name: 'German Social Market Economy',
    description: 'Balanced approach combining market efficiency with social responsibility and worker participation',
    region: 'Germany',
    characteristics: [
      'Social partnership between labor and capital',
      'Strong manufacturing and export focus',
      'Worker participation in management',
      'Balanced regional development',
      'Environmental consciousness',
      'Strong vocational training'
    ],
    economicComponents: [
      EconomicComponentType.SOCIAL_MARKET_ECONOMY,
      EconomicComponentType.MIXED_ECONOMY,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.PROTECTED_WORKERS,
      EconomicComponentType.GREEN_ECONOMY,
      EconomicComponentType.HIGH_SKILLED_WORKERS,
      EconomicComponentType.VOCATIONAL_TRAINING,
      EconomicComponentType.BALANCED_TRADE,
      EconomicComponentType.INNOVATION_ECONOMY
    ],
    governmentComponents: [
      ComponentType.FEDERAL_SYSTEM,
      ComponentType.SOCIAL_DEMOCRACY,
      ComponentType.WORKER_PROTECTION,
      ComponentType.ENVIRONMENTAL_FOCUS,
      ComponentType.REGIONAL_DEVELOPMENT
    ],
    taxProfile: {
      corporateRate: 30,
      incomeRate: 45,
      consumptionRate: 19,
      revenueEfficiency: 0.88
    },
    sectorFocus: {
      'manufacturing': 28,
      'services': 35,
      'technology': 12,
      'government': 15,
      'agriculture': 3,
      'finance': 7
    },
    employmentProfile: {
      unemploymentRate: 5.2,
      laborParticipation: 70,
      wageGrowth: 3.1
    },
    growthMetrics: {
      gdpGrowth: 2.8,
      innovationIndex: 85,
      competitiveness: 88,
      stability: 92
    },
    strengths: [
      'Strong manufacturing excellence',
      'Worker participation and social partnership',
      'Excellent vocational training',
      'Environmental leadership',
      'Balanced regional development',
      'Export competitiveness'
    ],
    challenges: [
      'High labor costs',
      'Complex regulations',
      'Slow digital transformation',
      'Dependency on exports',
      'Energy transition costs',
      'Demographic aging'
    ],
    implementationComplexity: 'high',
    culturalFactors: [
      'Work quality emphasis',
      'Social partnership values',
      'Environmental consciousness',
      'Regional identity',
      'Technical precision'
    ],
    historicalContext: 'Developed post-WWII combining free market principles with social responsibility and worker rights',
    modernExamples: ['Munich, Germany', 'Stuttgart, Germany', 'Frankfurt, Germany', 'Hamburg, Germany'],
    recommendations: [
      'Develop strong manufacturing base',
      'Implement worker participation',
      'Invest in vocational training',
      'Balance market efficiency with social goals',
      'Focus on environmental sustainability',
      'Maintain export competitiveness'
    ]
  }],

  ['singapore', {
    id: 'singapore',
    name: 'Singapore Model',
    description: 'Highly efficient city-state with strategic state planning, open markets, and strict governance',
    region: 'Singapore',
    characteristics: [
      'Strategic state planning and intervention',
      'Open and competitive markets',
      'Strong rule of law and governance',
      'Multicultural and international focus',
      'High efficiency and productivity',
      'Limited natural resources'
    ],
    economicComponents: [
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.FINANCE_CENTERED,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.FLEXIBLE_LABOR,
      EconomicComponentType.FREE_TRADE,
      EconomicComponentType.HIGH_SKILLED_WORKERS,
      EconomicComponentType.INNOVATION_ECONOMY
    ],
    governmentComponents: [
      ComponentType.CENTRALIZED_POWER,
      ComponentType.RULE_OF_LAW,
      ComponentType.TECHNOCRATIC_PROCESS,
      ComponentType.ECONOMIC_PLANNING,
      ComponentType.MERITOCRATIC_SYSTEM
    ],
    taxProfile: {
      corporateRate: 17,
      incomeRate: 22,
      consumptionRate: 7,
      revenueEfficiency: 0.95
    },
    sectorFocus: {
      'finance': 25,
      'services': 35,
      'technology': 20,
      'manufacturing': 15,
      'government': 3,
      'agriculture': 0.1
    },
    employmentProfile: {
      unemploymentRate: 2.9,
      laborParticipation: 68,
      wageGrowth: 3.8
    },
    growthMetrics: {
      gdpGrowth: 4.2,
      innovationIndex: 92,
      competitiveness: 98,
      stability: 96
    },
    strengths: [
      'Exceptional governance and efficiency',
      'Strategic location and connectivity',
      'Strong rule of law',
      'Open and competitive markets',
      'High productivity and innovation',
      'Multicultural advantage'
    ],
    challenges: [
      'Limited domestic market',
      'High cost of living',
      'Dependency on external factors',
      'Limited political freedoms',
      'Resource constraints',
      'Demographic challenges'
    ],
    implementationComplexity: 'medium',
    culturalFactors: [
      'Multicultural integration',
      'Meritocratic values',
      'Efficiency focus',
      'International orientation',
      'Discipline and order'
    ],
    historicalContext: 'Developed from 1960s through strategic planning, foreign investment, and efficient governance',
    modernExamples: ['Singapore', 'Dubai, UAE', 'Hong Kong', 'Luxembourg'],
    recommendations: [
      'Develop efficient governance systems',
      'Create strategic economic planning',
      'Maintain open and competitive markets',
      'Invest in human capital',
      'Build strong international connections',
      'Ensure rule of law and stability'
    ]
  }],

  ['swiss', {
    id: 'swiss',
    name: 'Swiss Model',
    description: 'High-value precision economy with strong banking, pharmaceuticals, and manufacturing excellence',
    region: 'Switzerland',
    characteristics: [
      'High-value precision manufacturing',
      'Strong banking and finance sector',
      'Pharmaceutical and chemical industries',
      'Direct democracy and federalism',
      'High wages and living standards',
      'Neutral foreign policy'
    ],
    economicComponents: [
      EconomicComponentType.HIGH_SKILLED_WORKERS,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.FINANCE_CENTERED,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.RESEARCH_AND_DEVELOPMENT,
      EconomicComponentType.INTELLECTUAL_PROPERTY,
      EconomicComponentType.BALANCED_TRADE,
      EconomicComponentType.VOCATIONAL_TRAINING
    ],
    governmentComponents: [
      ComponentType.FEDERAL_SYSTEM,
      ComponentType.DEMOCRATIC_PROCESS,
      ComponentType.PERFORMANCE_LEGITIMACY,
      ComponentType.RULE_OF_LAW,
      ComponentType.MERIT_BASED_SYSTEM
    ],
    taxProfile: {
      corporateRate: 8.5,
      incomeRate: 40,
      consumptionRate: 7.7,
      revenueEfficiency: 0.89
    },
    sectorFocus: {
      'manufacturing': 25,
      'finance': 20,
      'pharmaceuticals': 15,
      'services': 25,
      'government': 10,
      'agriculture': 5
    },
    employmentProfile: {
      unemploymentRate: 2.8,
      laborParticipation: 69,
      wageGrowth: 2.5
    },
    growthMetrics: {
      gdpGrowth: 2.1,
      innovationIndex: 96,
      competitiveness: 94,
      stability: 98
    },
    strengths: [
      'World-class precision manufacturing',
      'Strong financial services',
      'High innovation and R&D',
      'Political stability and neutrality',
      'Excellent vocational training',
      'High quality of life'
    ],
    challenges: [
      'High cost of living',
      'Limited domestic market',
      'Currency appreciation pressure',
      'Aging population',
      'Regulatory complexity',
      'Dependency on exports'
    ],
    implementationComplexity: 'high',
    culturalFactors: [
      'Precision and quality focus',
      'Multilingual society',
      'Consensus-based decision making',
      'Work-life balance emphasis',
      'Environmental consciousness'
    ],
    historicalContext: 'Developed through neutrality, federalism, and focus on high-value precision industries',
    modernExamples: ['Zurich, Switzerland', 'Basel, Switzerland', 'Geneva, Switzerland', 'Bern, Switzerland'],
    recommendations: [
      'Develop precision manufacturing capabilities',
      'Build strong financial services sector',
      'Invest in vocational training',
      'Maintain political stability',
      'Focus on high-value exports',
      'Preserve quality standards'
    ]
  }],

  ['japanese', {
    id: 'japanese',
    name: 'Japanese Model',
    description: 'Technology-driven economy with strong manufacturing, innovation, and lifetime employment culture',
    region: 'Japan',
    characteristics: [
      'Advanced technology and robotics',
      'Strong manufacturing base',
      'Lifetime employment system',
      'High savings rate',
      'Innovation in electronics and automotive',
      'Aging population challenges'
    ],
    economicComponents: [
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.HIGH_SKILLED_WORKERS,
      EconomicComponentType.RESEARCH_AND_DEVELOPMENT,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.TECH_TRANSFER,
      EconomicComponentType.INTELLECTUAL_PROPERTY,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.EXPORT_ORIENTED
    ],
    governmentComponents: [
      ComponentType.CENTRALIZED_POWER,
      ComponentType.PLANNED_ECONOMY,
      ComponentType.TECHNOCRATIC_PROCESS,
      ComponentType.TECHNOCRATIC_AGENCIES,
      ComponentType.PROFESSIONAL_BUREAUCRACY
    ],
    taxProfile: {
      corporateRate: 30,
      incomeRate: 45,
      consumptionRate: 10,
      revenueEfficiency: 0.82
    },
    sectorFocus: {
      'manufacturing': 30,
      'technology': 20,
      'services': 25,
      'finance': 8,
      'government': 12,
      'agriculture': 5
    },
    employmentProfile: {
      unemploymentRate: 2.9,
      laborParticipation: 62,
      wageGrowth: 1.8
    },
    growthMetrics: {
      gdpGrowth: 1.2,
      innovationIndex: 93,
      competitiveness: 89,
      stability: 85
    },
    strengths: [
      'World-leading technology and robotics',
      'Strong manufacturing excellence',
      'High innovation capacity',
      'Quality and precision focus',
      'Strong work ethic',
      'Advanced automation'
    ],
    challenges: [
      'Aging population',
      'Low birth rate',
      'Deflationary pressures',
      'High public debt',
      'Rigid labor markets',
      'Limited immigration'
    ],
    implementationComplexity: 'high',
    culturalFactors: [
      'Strong work ethic and loyalty',
      'Quality and precision focus',
      'Group harmony emphasis',
      'Respect for hierarchy',
      'Innovation culture'
    ],
    historicalContext: 'Post-WWII economic miracle through manufacturing, technology, and export-oriented growth',
    modernExamples: ['Tokyo, Japan', 'Osaka, Japan', 'Nagoya, Japan', 'Yokohama, Japan'],
    recommendations: [
      'Invest heavily in technology and robotics',
      'Develop strong manufacturing base',
      'Focus on quality and precision',
      'Build innovation ecosystem',
      'Address demographic challenges',
      'Maintain export competitiveness'
    ]
  }],

  ['australian', {
    id: 'australian',
    name: 'Australian Model',
    description: 'Resource-rich economy with strong mining, agriculture, and service sectors in a stable democratic framework',
    region: 'Australia',
    characteristics: [
      'Abundant natural resources',
      'Strong mining and agriculture',
      'High immigration and multiculturalism',
      'Stable democratic institutions',
      'Service-oriented economy',
      'Geographic isolation advantages'
    ],
    economicComponents: [
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.EDUCATION_FOCUSED,
      EconomicComponentType.TOURISM_BASED,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.INNOVATION_ECONOMY
    ],
    governmentComponents: [
      ComponentType.FEDERAL_SYSTEM,
      ComponentType.DEMOCRATIC_PROCESS,
      ComponentType.SOCIAL_SAFETY_NET,
      ComponentType.ENVIRONMENTAL_PROTECTION,
      ComponentType.WORKER_PROTECTION
    ],
    taxProfile: {
      corporateRate: 30,
      incomeRate: 45,
      consumptionRate: 10,
      revenueEfficiency: 0.85
    },
    sectorFocus: {
      'mining': 15,
      'agriculture': 8,
      'services': 45,
      'manufacturing': 12,
      'government': 15,
      'finance': 5
    },
    employmentProfile: {
      unemploymentRate: 5.1,
      laborParticipation: 66,
      wageGrowth: 3.2
    },
    growthMetrics: {
      gdpGrowth: 2.8,
      innovationIndex: 78,
      competitiveness: 82,
      stability: 88
    },
    strengths: [
      'Abundant natural resources',
      'Strong agricultural sector',
      'High immigration and diversity',
      'Stable political system',
      'Good education system',
      'Strong service economy'
    ],
    challenges: [
      'Resource dependency',
      'Geographic isolation',
      'High cost of living',
      'Environmental concerns',
      'Skills shortages',
      'Climate change impacts'
    ],
    implementationComplexity: 'medium',
    culturalFactors: [
      'Multicultural society',
      'Outdoor lifestyle',
      'Egalitarian values',
      'Work-life balance',
      'Environmental awareness'
    ],
    historicalContext: 'Developed from resource extraction and agriculture, now diversified into services and technology',
    modernExamples: ['Sydney, Australia', 'Melbourne, Australia', 'Perth, Australia', 'Brisbane, Australia'],
    recommendations: [
      'Leverage natural resource advantages',
      'Develop service economy',
      'Invest in education and skills',
      'Maintain immigration policies',
      'Address environmental challenges',
      'Diversify economic base'
    ]
  }],

  ['brazilian', {
    id: 'brazilian',
    name: 'Brazilian Model',
    description: 'Emerging market economy with strong agriculture, mining, and growing technology sector in a large domestic market',
    region: 'Brazil',
    characteristics: [
      'Large domestic market',
      'Strong agricultural sector',
      'Abundant natural resources',
      'Growing technology industry',
      'Social inequality challenges',
      'Emerging market dynamics'
    ],
    economicComponents: [
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.MIXED_ECONOMY,
      EconomicComponentType.DOMESTIC_FOCUSED,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.BALANCED_TRADE
    ],
    governmentComponents: [
      ComponentType.FEDERAL_SYSTEM,
      ComponentType.DEMOCRATIC_PROCESS,
      ComponentType.SOCIAL_MARKET_ECONOMY,
      ComponentType.TECHNOCRATIC_AGENCIES,
      ComponentType.ENVIRONMENTAL_PROTECTION
    ],
    taxProfile: {
      corporateRate: 34,
      incomeRate: 27.5,
      consumptionRate: 18,
      revenueEfficiency: 0.75
    },
    sectorFocus: {
      'agriculture': 20,
      'mining': 8,
      'manufacturing': 18,
      'services': 35,
      'government': 12,
      'finance': 7
    },
    employmentProfile: {
      unemploymentRate: 11.8,
      laborParticipation: 61,
      wageGrowth: 4.5
    },
    growthMetrics: {
      gdpGrowth: 2.9,
      innovationIndex: 65,
      competitiveness: 72,
      stability: 68
    },
    strengths: [
      'Large domestic market',
      'Abundant natural resources',
      'Strong agricultural sector',
      'Growing technology industry',
      'Diverse economy',
      'Young population'
    ],
    challenges: [
      'High social inequality',
      'Infrastructure gaps',
      'Bureaucratic complexity',
      'Environmental concerns',
      'Political instability',
      'Skills shortages'
    ],
    implementationComplexity: 'medium',
    culturalFactors: [
      'Diverse multicultural society',
      'Entrepreneurial spirit',
      'Social inequality awareness',
      'Environmental consciousness',
      'Innovation drive'
    ],
    historicalContext: 'Emerging from commodity-based economy to diversified industrial and service economy',
    modernExamples: ['São Paulo, Brazil', 'Rio de Janeiro, Brazil', 'Brasília, Brazil', 'Belo Horizonte, Brazil'],
    recommendations: [
      'Leverage large domestic market',
      'Invest in infrastructure',
      'Develop technology sector',
      'Address social inequality',
      'Improve education system',
      'Strengthen institutions'
    ]
  }],

  ['canadian', {
    id: 'canadian',
    name: 'Canadian Model',
    description: 'Resource-rich economy with strong social programs, multiculturalism, and technology sector in a federal system',
    region: 'Canada',
    characteristics: [
      'Abundant natural resources',
      'Strong social safety net',
      'Multicultural society',
      'Technology and innovation focus',
      'Federal system with provinces',
      'High immigration rates'
    ],
    economicComponents: [
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
      EconomicComponentType.SOCIAL_MARKET_ECONOMY,
      EconomicComponentType.MIXED_ECONOMY,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.EDUCATION_FOCUSED,
      EconomicComponentType.HEALTHCARE_FOCUSED,
      EconomicComponentType.GREEN_ECONOMY,
      EconomicComponentType.FREE_TRADE
    ],
    governmentComponents: [
      ComponentType.FEDERAL_SYSTEM,
      ComponentType.SOCIAL_DEMOCRACY,
      ComponentType.SOCIAL_SAFETY_NET,
      ComponentType.ENVIRONMENTAL_PROTECTION,
      ComponentType.WORKER_PROTECTION
    ],
    taxProfile: {
      corporateRate: 26.5,
      incomeRate: 33,
      consumptionRate: 13,
      revenueEfficiency: 0.87
    },
    sectorFocus: {
      'services': 40,
      'manufacturing': 15,
      'mining': 12,
      'agriculture': 6,
      'government': 20,
      'finance': 7
    },
    employmentProfile: {
      unemploymentRate: 6.8,
      laborParticipation: 65,
      wageGrowth: 3.1
    },
    growthMetrics: {
      gdpGrowth: 2.4,
      innovationIndex: 81,
      competitiveness: 85,
      stability: 92
    },
    strengths: [
      'Abundant natural resources',
      'Strong social programs',
      'High immigration and diversity',
      'Stable political system',
      'Good education system',
      'Technology innovation'
    ],
    challenges: [
      'Resource dependency',
      'High taxes',
      'Cold climate',
      'Skills shortages',
      'Regional disparities',
      'Environmental concerns'
    ],
    implementationComplexity: 'medium',
    culturalFactors: [
      'Multicultural society',
      'Egalitarian values',
      'Environmental consciousness',
      'Work-life balance',
      'Innovation culture'
    ],
    historicalContext: 'Developed from resource extraction to diversified economy with strong social programs',
    modernExamples: ['Toronto, Canada', 'Vancouver, Canada', 'Montreal, Canada', 'Calgary, Canada'],
    recommendations: [
      'Leverage natural resources',
      'Maintain social programs',
      'Invest in technology',
      'Support immigration',
      'Address regional disparities',
      'Focus on sustainability'
    ]
  }]
]);

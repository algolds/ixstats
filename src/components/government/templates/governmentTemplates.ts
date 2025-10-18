/**
 * Government Templates Library
 * 
 * This file contains all predefined government templates that users can select
 * when building their government structures. Each template represents a real-world
 * government system with authentic department structures, budget allocations,
 * and revenue sources.
 */

import type { GovernmentTemplate } from '~/types/government';

// Enhanced Government Templates with Atomic Components
export const governmentTemplates: GovernmentTemplate[] = [
  {
    name: 'Caphirian Imperial Administration',
    governmentType: 'Constitutional Monarchy',
    description: 'Complex administrative structure with Imperial oversight and provincial autonomy',
    fiscalYear: 'Calendar Year',
    departments: [
      {
        name: 'Imperial Ministry of State',
        shortName: 'IMS',
        category: 'Interior',
        description: 'Central coordination of imperial policy and provincial oversight',
        ministerTitle: 'Imperial Chancellor',
        organizationalLevel: 'Ministry',
        icon: 'Crown',
        color: '#7c2d12',
        priority: 100,
        functions: ['Imperial Policy Coordination', 'Provincial Relations', 'Constitutional Affairs', 'Imperial Ceremonies'],
        typicalBudgetPercent: 8,
        subBudgets: [
          { name: 'Imperial Court', budgetType: 'Operations', percent: 25, isRecurring: true, priority: 'Critical' },
          { name: 'Provincial Liaison', budgetType: 'Personnel', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Policy Development', budgetType: 'Operations', percent: 40, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Imperial Unity Index', description: 'Measure of provincial cooperation and imperial cohesion', targetValue: 85, unit: '%', frequency: 'Quarterly', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Defense',
        shortName: 'MoD',
        category: 'Defense',
        description: 'Imperial military forces and territorial defense',
        ministerTitle: 'Minister of Defense',
        organizationalLevel: 'Ministry',
        icon: 'Shield',
        color: '#dc2626',
        priority: 95,
        functions: ['Military Operations', 'Defense Policy', 'National Security', 'Veterans Affairs'],
        typicalBudgetPercent: 18,
        subBudgets: [
          { name: 'Active Forces', budgetType: 'Personnel', percent: 45, isRecurring: true, priority: 'Critical' },
          { name: 'Equipment & Procurement', budgetType: 'Capital', percent: 30, isRecurring: false, priority: 'High' },
          { name: 'Operations & Training', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'High' },
          { name: 'Veterans Support', budgetType: 'Personnel', percent: 5, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Defense Readiness', description: 'Overall military readiness and capability', targetValue: 90, unit: '%', frequency: 'Monthly', trend: 'Up', category: 'Performance' },
          { name: 'Recruitment Rate', description: 'Success rate in meeting recruitment targets', targetValue: 95, unit: '%', frequency: 'Monthly', trend: 'Stable', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Imperial Finance',
        shortName: 'MIF',
        category: 'Finance',
        description: 'Economic policy, taxation, and imperial treasury management',
        ministerTitle: 'Chancellor of the Imperial Treasury',
        organizationalLevel: 'Ministry',
        icon: 'Coins',
        color: '#7c3aed',
        priority: 98,
        functions: ['Tax Policy', 'Budget Management', 'Economic Planning', 'Currency Management', 'Trade Policy'],
        typicalBudgetPercent: 6,
        subBudgets: [
          { name: 'Tax Administration', budgetType: 'Personnel', percent: 40, isRecurring: true, priority: 'Critical' },
          { name: 'Economic Analysis', budgetType: 'Operations', percent: 25, isRecurring: true, priority: 'High' },
          { name: 'Financial Systems', budgetType: 'Capital', percent: 20, isRecurring: false, priority: 'High' },
          { name: 'International Relations', budgetType: 'Operations', percent: 15, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Tax Collection Efficiency', description: 'Percentage of assessed taxes collected', targetValue: 92, unit: '%', frequency: 'Monthly', trend: 'Up', category: 'Financial' },
          { name: 'Budget Variance', description: 'Deviation from planned budget allocations', targetValue: 5, unit: '%', frequency: 'Quarterly', trend: 'Down', category: 'Financial' }
        ]
      },
      {
        name: 'Ministry of Education',
        shortName: 'MoE',
        category: 'Education',
        description: 'Educational policy and administration',
        ministerTitle: 'Minister of Education',
        organizationalLevel: 'Ministry',
        icon: 'GraduationCap',
        color: '#2563eb',
        priority: 95,
        functions: ['Educational Policy', 'School Administration', 'Higher Education'],
        typicalBudgetPercent: 18,
        subBudgets: [
          { name: 'Teacher Salaries', budgetType: 'Personnel', percent: 55, isRecurring: true, priority: 'Critical' },
          { name: 'Infrastructure', budgetType: 'Capital', percent: 25, isRecurring: false, priority: 'High' },
          { name: 'Programs', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Literacy Rate', description: 'National literacy rate', targetValue: 98, unit: '%', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Health',
        shortName: 'MoH',
        category: 'Health',
        description: 'Public health services and policy',
        ministerTitle: 'Minister of Health',
        organizationalLevel: 'Ministry',
        icon: 'Heart',
        color: '#059669',
        priority: 92,
        functions: ['Healthcare Policy', 'Public Health', 'Medical Services'],
        typicalBudgetPercent: 16,
        subBudgets: [
          { name: 'Medical Staff', budgetType: 'Personnel', percent: 50, isRecurring: true, priority: 'Critical' },
          { name: 'Medical Equipment', budgetType: 'Capital', percent: 30, isRecurring: false, priority: 'High' },
          { name: 'Public Health Programs', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Life Expectancy', description: 'Average life expectancy', targetValue: 82, unit: 'years', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Finance',
        shortName: 'MoF',
        category: 'Finance',
        description: 'Economic policy and fiscal management',
        ministerTitle: 'Chancellor of the Exchequer',
        organizationalLevel: 'Ministry',
        icon: 'Briefcase',
        color: '#7c3aed',
        priority: 98,
        functions: ['Budget Management', 'Tax Policy', 'Economic Policy'],
        typicalBudgetPercent: 8,
        subBudgets: [
          { name: 'Administration', budgetType: 'Personnel', percent: 40, isRecurring: true, priority: 'High' },
          { name: 'Economic Programs', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Infrastructure', budgetType: 'Capital', percent: 25, isRecurring: false, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Fiscal Balance', description: 'Budget surplus/deficit ratio', targetValue: 2, unit: '% GDP', frequency: 'Quarterly', trend: 'Up', category: 'Financial' }
        ]
      }
    ],
    typicalRevenueSources: [
      { name: 'Personal Income Tax', category: 'Direct Tax', rate: 25, collectionMethod: 'Payroll Deduction' },
      { name: 'Corporate Income Tax', category: 'Direct Tax', rate: 20, collectionMethod: 'Annual Filing' },
      { name: 'Value Added Tax', category: 'Indirect Tax', rate: 15, collectionMethod: 'Point of Sale' },
      { name: 'Property Tax', category: 'Direct Tax', rate: 1.5, collectionMethod: 'Annual Assessment' }
    ]
  },
  {
    name: 'Nordic Social Democracy',
    governmentType: 'Parliamentary Democracy',
    description: 'Comprehensive welfare state with strong social safety nets and progressive taxation',
    fiscalYear: 'Calendar Year',
    departments: [
      {
        name: 'Ministry of Social Affairs',
        shortName: 'MSA',
        category: 'Social Services',
        description: 'Comprehensive social welfare and safety net programs',
        ministerTitle: 'Minister of Social Affairs',
        organizationalLevel: 'Ministry',
        icon: 'Users',
        color: '#059669',
        priority: 100,
        functions: ['Social Security', 'Unemployment Benefits', 'Disability Support', 'Family Services'],
        typicalBudgetPercent: 25,
        subBudgets: [
          { name: 'Social Security', budgetType: 'Personnel', percent: 40, isRecurring: true, priority: 'Critical' },
          { name: 'Welfare Programs', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'Critical' },
          { name: 'Social Services', budgetType: 'Personnel', percent: 25, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Social Welfare Coverage', description: 'Percentage of population covered by social programs', targetValue: 95, unit: '%', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Labor',
        shortName: 'MoL',
        category: 'Social Services',
        description: 'Labor relations, employment policy, and workplace safety',
        ministerTitle: 'Minister of Labor',
        organizationalLevel: 'Ministry',
        icon: 'Briefcase',
        color: '#f59e0b',
        priority: 95,
        functions: ['Employment Policy', 'Labor Relations', 'Workplace Safety', 'Job Training'],
        typicalBudgetPercent: 8,
        subBudgets: [
          { name: 'Employment Services', budgetType: 'Personnel', percent: 45, isRecurring: true, priority: 'High' },
          { name: 'Training Programs', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'High' },
          { name: 'Labor Inspection', budgetType: 'Operations', percent: 25, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Unemployment Rate', description: 'National unemployment rate', targetValue: 4, unit: '%', frequency: 'Monthly', trend: 'Down', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Environment',
        shortName: 'MoE',
        category: 'Environment',
        description: 'Environmental protection and climate policy',
        ministerTitle: 'Minister of Environment',
        organizationalLevel: 'Ministry',
        icon: 'Leaf',
        color: '#10b981',
        priority: 90,
        functions: ['Environmental Protection', 'Climate Policy', 'Renewable Energy', 'Conservation'],
        typicalBudgetPercent: 6,
        subBudgets: [
          { name: 'Environmental Monitoring', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Climate Programs', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'High' },
          { name: 'Green Infrastructure', budgetType: 'Capital', percent: 35, isRecurring: false, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Carbon Emissions Reduction', description: 'Annual reduction in carbon emissions', targetValue: 5, unit: '%', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      }
    ],
    typicalRevenueSources: [
      { name: 'Progressive Income Tax', category: 'Direct Tax', rate: 45, collectionMethod: 'Payroll Deduction' },
      { name: 'Corporate Tax', category: 'Direct Tax', rate: 22, collectionMethod: 'Annual Filing' },
      { name: 'Value Added Tax', category: 'Indirect Tax', rate: 25, collectionMethod: 'Point of Sale' },
      { name: 'Social Security Contributions', category: 'Direct Tax', rate: 18, collectionMethod: 'Payroll Deduction' }
    ]
  },
  {
    name: 'Singaporean Meritocracy',
    governmentType: 'Parliamentary Democracy',
    description: 'Efficient technocratic governance with focus on economic development and merit-based advancement',
    fiscalYear: 'April to March',
    departments: [
      {
        name: 'Ministry of Trade and Industry',
        shortName: 'MTI',
        category: 'Commerce',
        description: 'Economic development, trade policy, and industrial strategy',
        ministerTitle: 'Minister of Trade and Industry',
        organizationalLevel: 'Ministry',
        icon: 'TrendingUp',
        color: '#7c3aed',
        priority: 100,
        functions: ['Trade Policy', 'Economic Development', 'Industrial Strategy', 'Investment Promotion'],
        typicalBudgetPercent: 15,
        subBudgets: [
          { name: 'Trade Development', budgetType: 'Operations', percent: 40, isRecurring: true, priority: 'Critical' },
          { name: 'Investment Promotion', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'High' },
          { name: 'Economic Research', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'GDP Growth Rate', description: 'Annual GDP growth percentage', targetValue: 4, unit: '%', frequency: 'Quarterly', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Education',
        shortName: 'MoE',
        category: 'Education',
        description: 'Education policy with focus on merit-based advancement and technical skills',
        ministerTitle: 'Minister of Education',
        organizationalLevel: 'Ministry',
        icon: 'GraduationCap',
        color: '#2563eb',
        priority: 98,
        functions: ['Education Policy', 'Curriculum Development', 'Teacher Training', 'Technical Education'],
        typicalBudgetPercent: 20,
        subBudgets: [
          { name: 'Teacher Salaries', budgetType: 'Personnel', percent: 50, isRecurring: true, priority: 'Critical' },
          { name: 'Infrastructure', budgetType: 'Capital', percent: 30, isRecurring: false, priority: 'High' },
          { name: 'Programs', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'PISA Score', description: 'International student assessment score', targetValue: 550, unit: 'points', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Manpower',
        shortName: 'MOM',
        category: 'Labor',
        description: 'Labor policy, foreign workforce management, and skills development',
        ministerTitle: 'Minister of Manpower',
        organizationalLevel: 'Ministry',
        icon: 'Users',
        color: '#f59e0b',
        priority: 95,
        functions: ['Labor Policy', 'Foreign Workers', 'Skills Development', 'Workplace Safety'],
        typicalBudgetPercent: 8,
        subBudgets: [
          { name: 'Labor Services', budgetType: 'Personnel', percent: 40, isRecurring: true, priority: 'High' },
          { name: 'Skills Programs', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Foreign Worker Management', budgetType: 'Operations', percent: 25, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Skills Development Rate', description: 'Percentage of workforce in skills programs', targetValue: 60, unit: '%', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      }
    ],
    typicalRevenueSources: [
      { name: 'Corporate Income Tax', category: 'Direct Tax', rate: 17, collectionMethod: 'Annual Filing' },
      { name: 'Personal Income Tax', category: 'Direct Tax', rate: 22, collectionMethod: 'Payroll Deduction' },
      { name: 'Goods and Services Tax', category: 'Indirect Tax', rate: 7, collectionMethod: 'Point of Sale' },
      { name: 'Stamp Duty', category: 'Direct Tax', rate: 3, collectionMethod: 'Transaction Based' }
    ]
  },
  {
    name: 'Swiss Federal Confederation',
    governmentType: 'Federal Republic',
    description: 'Decentralized federal system with strong cantonal autonomy and direct democracy',
    fiscalYear: 'Calendar Year',
    departments: [
      {
        name: 'Federal Department of Foreign Affairs',
        shortName: 'FDFA',
        category: 'Foreign Affairs',
        description: 'International relations, diplomacy, and foreign policy',
        ministerTitle: 'Federal Councillor',
        organizationalLevel: 'Department',
        icon: 'Globe',
        color: '#3b82f6',
        priority: 100,
        functions: ['Diplomacy', 'International Relations', 'Foreign Aid', 'Consular Services'],
        typicalBudgetPercent: 8,
        subBudgets: [
          { name: 'Diplomatic Missions', budgetType: 'Operations', percent: 50, isRecurring: true, priority: 'Critical' },
          { name: 'Foreign Aid', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'High' },
          { name: 'International Organizations', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Diplomatic Relations Index', description: 'Quality of international relationships', targetValue: 85, unit: '%', frequency: 'Annually', trend: 'Stable', category: 'Performance' }
        ]
      },
      {
        name: 'Federal Department of Justice and Police',
        shortName: 'FDJP',
        category: 'Justice',
        description: 'Federal justice system, police coordination, and legal affairs',
        ministerTitle: 'Federal Councillor',
        organizationalLevel: 'Department',
        icon: 'Scale',
        color: '#8b5cf6',
        priority: 98,
        functions: ['Federal Justice', 'Police Coordination', 'Legal Affairs', 'Immigration'],
        typicalBudgetPercent: 12,
        subBudgets: [
          { name: 'Federal Police', budgetType: 'Personnel', percent: 45, isRecurring: true, priority: 'Critical' },
          { name: 'Justice System', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'Critical' },
          { name: 'Immigration Services', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Crime Rate', description: 'Federal crimes per 100,000 population', targetValue: 250, unit: 'crimes', frequency: 'Annually', trend: 'Down', category: 'Performance' }
        ]
      },
      {
        name: 'Federal Department of Economic Affairs',
        shortName: 'EAER',
        category: 'Commerce',
        description: 'Economic policy, agriculture, and innovation',
        ministerTitle: 'Federal Councillor',
        organizationalLevel: 'Department',
        icon: 'TrendingUp',
        color: '#10b981',
        priority: 95,
        functions: ['Economic Policy', 'Agriculture', 'Innovation', 'Trade'],
        typicalBudgetPercent: 15,
        subBudgets: [
          { name: 'Economic Development', budgetType: 'Operations', percent: 40, isRecurring: true, priority: 'High' },
          { name: 'Agricultural Support', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Innovation Programs', budgetType: 'Operations', percent: 25, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Innovation Index', description: 'National innovation capacity score', targetValue: 75, unit: 'points', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      }
    ],
    typicalRevenueSources: [
      { name: 'Federal Income Tax', category: 'Direct Tax', rate: 11.5, collectionMethod: 'Annual Filing' },
      { name: 'Value Added Tax', category: 'Indirect Tax', rate: 7.7, collectionMethod: 'Point of Sale' },
      { name: 'Withholding Tax', category: 'Direct Tax', rate: 35, collectionMethod: 'Source Deduction' },
      { name: 'Customs Duties', category: 'Indirect Tax', rate: 3.2, collectionMethod: 'Import Based' }
    ]
  },
  {
    name: 'Emirati Federation',
    governmentType: 'Federal Constitutional Republic',
    description: 'Federation of seven emirates with strong central coordination and oil-based economy',
    fiscalYear: 'January to December',
    departments: [
      {
        name: 'Ministry of Energy and Infrastructure',
        shortName: 'MEI',
        category: 'Energy',
        description: 'Energy policy, oil and gas management, and infrastructure development',
        ministerTitle: 'Minister of Energy and Infrastructure',
        organizationalLevel: 'Ministry',
        icon: 'Zap',
        color: '#f59e0b',
        priority: 100,
        functions: ['Energy Policy', 'Oil & Gas', 'Renewable Energy', 'Infrastructure'],
        typicalBudgetPercent: 25,
        subBudgets: [
          { name: 'Energy Infrastructure', budgetType: 'Capital', percent: 45, isRecurring: false, priority: 'Critical' },
          { name: 'Oil & Gas Operations', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'Critical' },
          { name: 'Renewable Energy', budgetType: 'Capital', percent: 20, isRecurring: false, priority: 'High' }
        ],
        kpis: [
          { name: 'Energy Production', description: 'Total energy production capacity', targetValue: 95, unit: '% capacity', frequency: 'Monthly', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Economy',
        shortName: 'MoE',
        category: 'Commerce',
        description: 'Economic diversification, trade, and business development',
        ministerTitle: 'Minister of Economy',
        organizationalLevel: 'Ministry',
        icon: 'TrendingUp',
        color: '#10b981',
        priority: 98,
        functions: ['Economic Diversification', 'Trade Policy', 'Business Development', 'Investment'],
        typicalBudgetPercent: 12,
        subBudgets: [
          { name: 'Economic Development', budgetType: 'Operations', percent: 40, isRecurring: true, priority: 'High' },
          { name: 'Trade Promotion', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'High' },
          { name: 'Investment Attraction', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Economic Diversification Index', description: 'Non-oil GDP as percentage of total GDP', targetValue: 70, unit: '%', frequency: 'Quarterly', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Foreign Affairs',
        shortName: 'MFA',
        category: 'Foreign Affairs',
        description: 'International relations and diplomatic affairs',
        ministerTitle: 'Minister of Foreign Affairs',
        organizationalLevel: 'Ministry',
        icon: 'Globe',
        color: '#3b82f6',
        priority: 95,
        functions: ['Diplomacy', 'International Relations', 'Foreign Policy', 'Consular Services'],
        typicalBudgetPercent: 8,
        subBudgets: [
          { name: 'Diplomatic Missions', budgetType: 'Operations', percent: 50, isRecurring: true, priority: 'High' },
          { name: 'International Organizations', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'High' },
          { name: 'Consular Services', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'International Relations Score', description: 'Quality of diplomatic relationships', targetValue: 80, unit: 'points', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      }
    ],
    typicalRevenueSources: [
      { name: 'Oil and Gas Revenue', category: 'Non-Tax Revenue', rate: 60, collectionMethod: 'State Owned Enterprises' },
      { name: 'Corporate Tax', category: 'Direct Tax', rate: 9, collectionMethod: 'Annual Filing' },
      { name: 'Value Added Tax', category: 'Indirect Tax', rate: 5, collectionMethod: 'Point of Sale' },
      { name: 'Customs Duties', category: 'Indirect Tax', rate: 5, collectionMethod: 'Import Based' }
    ]
  },
  {
    name: 'Japanese Parliamentary System',
    governmentType: 'Constitutional Monarchy',
    description: 'Stable parliamentary democracy with strong bureaucracy and consensus-based decision making',
    fiscalYear: 'April to March',
    departments: [
      {
        name: 'Ministry of Internal Affairs and Communications',
        shortName: 'MIC',
        category: 'Interior',
        description: 'Local government coordination, communications, and administrative oversight',
        ministerTitle: 'Minister of Internal Affairs and Communications',
        organizationalLevel: 'Ministry',
        icon: 'Building2',
        color: '#6b7280',
        priority: 100,
        functions: ['Local Government', 'Communications Policy', 'Administrative Oversight', 'Elections'],
        typicalBudgetPercent: 12,
        subBudgets: [
          { name: 'Local Government Support', budgetType: 'Operations', percent: 40, isRecurring: true, priority: 'Critical' },
          { name: 'Communications Infrastructure', budgetType: 'Capital', percent: 30, isRecurring: false, priority: 'High' },
          { name: 'Administrative Services', budgetType: 'Personnel', percent: 30, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Administrative Efficiency', description: 'Government service delivery effectiveness', targetValue: 88, unit: '%', frequency: 'Quarterly', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Economy, Trade and Industry',
        shortName: 'METI',
        category: 'Commerce',
        description: 'Economic policy, trade, and industrial development',
        ministerTitle: 'Minister of Economy, Trade and Industry',
        organizationalLevel: 'Ministry',
        icon: 'TrendingUp',
        color: '#10b981',
        priority: 98,
        functions: ['Economic Policy', 'Trade Relations', 'Industrial Development', 'Innovation'],
        typicalBudgetPercent: 15,
        subBudgets: [
          { name: 'Economic Development', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Trade Promotion', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'High' },
          { name: 'Industrial Support', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Export Growth Rate', description: 'Annual export growth percentage', targetValue: 3, unit: '%', frequency: 'Quarterly', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Health, Labour and Welfare',
        shortName: 'MHLW',
        category: 'Health',
        description: 'Public health, labor standards, and social welfare programs',
        ministerTitle: 'Minister of Health, Labour and Welfare',
        organizationalLevel: 'Ministry',
        icon: 'Heart',
        color: '#059669',
        priority: 95,
        functions: ['Public Health', 'Labor Standards', 'Social Welfare', 'Pension System'],
        typicalBudgetPercent: 20,
        subBudgets: [
          { name: 'Healthcare Services', budgetType: 'Personnel', percent: 45, isRecurring: true, priority: 'Critical' },
          { name: 'Social Welfare', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Labor Services', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Life Expectancy', description: 'Average life expectancy at birth', targetValue: 84, unit: 'years', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      }
    ],
    typicalRevenueSources: [
      { name: 'Income Tax', category: 'Direct Tax', rate: 45, collectionMethod: 'Payroll Deduction' },
      { name: 'Consumption Tax', category: 'Indirect Tax', rate: 10, collectionMethod: 'Point of Sale' },
      { name: 'Corporate Tax', category: 'Direct Tax', rate: 30, collectionMethod: 'Annual Filing' },
      { name: 'Social Insurance', category: 'Direct Tax', rate: 15, collectionMethod: 'Payroll Deduction' }
    ]
  },
  {
    name: 'German Federal Republic',
    governmentType: 'Federal Republic',
    description: 'Strong federal system with social market economy and comprehensive welfare state',
    fiscalYear: 'Calendar Year',
    departments: [
      {
        name: 'Federal Ministry of Labour and Social Affairs',
        shortName: 'BMAS',
        category: 'Social Services',
        description: 'Labor policy, social security, and worker protection',
        ministerTitle: 'Federal Minister',
        organizationalLevel: 'Ministry',
        icon: 'Users',
        color: '#f59e0b',
        priority: 100,
        functions: ['Labor Policy', 'Social Security', 'Worker Protection', 'Employment Services'],
        typicalBudgetPercent: 35,
        subBudgets: [
          { name: 'Social Security', budgetType: 'Operations', percent: 50, isRecurring: true, priority: 'Critical' },
          { name: 'Employment Services', budgetType: 'Personnel', percent: 30, isRecurring: true, priority: 'High' },
          { name: 'Worker Protection', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Unemployment Rate', description: 'National unemployment rate', targetValue: 3.5, unit: '%', frequency: 'Monthly', trend: 'Down', category: 'Performance' }
        ]
      },
      {
        name: 'Federal Ministry for Economic Affairs and Climate Action',
        shortName: 'BMWK',
        category: 'Commerce',
        description: 'Economic policy, energy transition, and industrial development',
        ministerTitle: 'Federal Minister',
        organizationalLevel: 'Ministry',
        icon: 'TrendingUp',
        color: '#10b981',
        priority: 98,
        functions: ['Economic Policy', 'Energy Transition', 'Industrial Policy', 'Innovation'],
        typicalBudgetPercent: 18,
        subBudgets: [
          { name: 'Economic Development', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Energy Transition', budgetType: 'Capital', percent: 35, isRecurring: false, priority: 'High' },
          { name: 'Innovation Support', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Renewable Energy Share', description: 'Percentage of energy from renewable sources', targetValue: 65, unit: '%', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Federal Ministry of Education and Research',
        shortName: 'BMBF',
        category: 'Education',
        description: 'Education policy, research funding, and scientific development',
        ministerTitle: 'Federal Minister',
        organizationalLevel: 'Ministry',
        icon: 'GraduationCap',
        color: '#2563eb',
        priority: 95,
        functions: ['Education Policy', 'Research Funding', 'Scientific Development', 'Vocational Training'],
        typicalBudgetPercent: 15,
        subBudgets: [
          { name: 'Research Funding', budgetType: 'Operations', percent: 45, isRecurring: true, priority: 'High' },
          { name: 'Education Programs', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Vocational Training', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Research and Development Intensity', description: 'R&D spending as percentage of GDP', targetValue: 3.5, unit: '%', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      }
    ],
    typicalRevenueSources: [
      { name: 'Income Tax', category: 'Direct Tax', rate: 42, collectionMethod: 'Payroll Deduction' },
      { name: 'Value Added Tax', category: 'Indirect Tax', rate: 19, collectionMethod: 'Point of Sale' },
      { name: 'Corporate Tax', category: 'Direct Tax', rate: 30, collectionMethod: 'Annual Filing' },
      { name: 'Social Insurance Contributions', category: 'Direct Tax', rate: 20, collectionMethod: 'Payroll Deduction' }
    ]
  },
  {
    name: 'Canadian Confederation',
    governmentType: 'Parliamentary Democracy',
    description: 'Decentralized federation with strong provincial autonomy and multicultural society',
    fiscalYear: 'April to March',
    departments: [
      {
        name: 'Department of Finance',
        shortName: 'FIN',
        category: 'Finance',
        description: 'Economic policy, fiscal management, and financial regulation',
        ministerTitle: 'Minister of Finance',
        organizationalLevel: 'Department',
        icon: 'DollarSign',
        color: '#7c3aed',
        priority: 100,
        functions: ['Economic Policy', 'Fiscal Management', 'Financial Regulation', 'Tax Policy'],
        typicalBudgetPercent: 8,
        subBudgets: [
          { name: 'Economic Analysis', budgetType: 'Personnel', percent: 40, isRecurring: true, priority: 'High' },
          { name: 'Financial Regulation', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'High' },
          { name: 'Tax Administration', budgetType: 'Personnel', percent: 30, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Fiscal Balance', description: 'Government budget balance as percentage of GDP', targetValue: 0, unit: '% GDP', frequency: 'Quarterly', trend: 'Stable', category: 'Financial' }
        ]
      },
      {
        name: 'Department of Indigenous Services',
        shortName: 'ISC',
        category: 'Social Services',
        description: 'Services for Indigenous peoples and reconciliation efforts',
        ministerTitle: 'Minister of Indigenous Services',
        organizationalLevel: 'Department',
        icon: 'Users',
        color: '#059669',
        priority: 98,
        functions: ['Indigenous Services', 'Reconciliation', 'Community Development', 'Cultural Support'],
        typicalBudgetPercent: 12,
        subBudgets: [
          { name: 'Community Services', budgetType: 'Operations', percent: 45, isRecurring: true, priority: 'High' },
          { name: 'Infrastructure Development', budgetType: 'Capital', percent: 35, isRecurring: false, priority: 'High' },
          { name: 'Cultural Programs', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Indigenous Well-being Index', description: 'Overall quality of life for Indigenous communities', targetValue: 75, unit: 'points', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Department of Environment and Climate Change',
        shortName: 'ECCC',
        category: 'Environment',
        description: 'Environmental protection, climate action, and natural resource management',
        ministerTitle: 'Minister of Environment and Climate Change',
        organizationalLevel: 'Department',
        icon: 'Leaf',
        color: '#10b981',
        priority: 95,
        functions: ['Environmental Protection', 'Climate Action', 'Natural Resources', 'Biodiversity'],
        typicalBudgetPercent: 10,
        subBudgets: [
          { name: 'Climate Programs', budgetType: 'Operations', percent: 40, isRecurring: true, priority: 'High' },
          { name: 'Environmental Monitoring', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'High' },
          { name: 'Conservation Programs', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Greenhouse Gas Reduction', description: 'Annual reduction in greenhouse gas emissions', targetValue: 8, unit: '%', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      }
    ],
    typicalRevenueSources: [
      { name: 'Personal Income Tax', category: 'Direct Tax', rate: 33, collectionMethod: 'Payroll Deduction' },
      { name: 'Goods and Services Tax', category: 'Indirect Tax', rate: 5, collectionMethod: 'Point of Sale' },
      { name: 'Corporate Tax', category: 'Direct Tax', rate: 15, collectionMethod: 'Annual Filing' },
      { name: 'Employment Insurance', category: 'Direct Tax', rate: 2.4, collectionMethod: 'Payroll Deduction' }
    ]
  },
  {
    name: 'Brazilian Federal Republic',
    governmentType: 'Presidential Republic',
    description: 'Large federal system with strong regional diversity and social programs',
    fiscalYear: 'Calendar Year',
    departments: [
      {
        name: 'Ministry of Social Development',
        shortName: 'MDS',
        category: 'Social Services',
        description: 'Social assistance programs and poverty reduction initiatives',
        ministerTitle: 'Minister of Social Development',
        organizationalLevel: 'Ministry',
        icon: 'Users',
        color: '#059669',
        priority: 100,
        functions: ['Social Assistance', 'Poverty Reduction', 'Family Support', 'Food Security'],
        typicalBudgetPercent: 20,
        subBudgets: [
          { name: 'Bolsa Família Program', budgetType: 'Operations', percent: 50, isRecurring: true, priority: 'Critical' },
          { name: 'Social Assistance', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'High' },
          { name: 'Food Security', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Poverty Rate', description: 'Percentage of population below poverty line', targetValue: 15, unit: '%', frequency: 'Annually', trend: 'Down', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Education',
        shortName: 'MEC',
        category: 'Education',
        description: 'National education system and educational policy',
        ministerTitle: 'Minister of Education',
        organizationalLevel: 'Ministry',
        icon: 'GraduationCap',
        color: '#2563eb',
        priority: 98,
        functions: ['Education Policy', 'Higher Education', 'Teacher Training', 'Educational Infrastructure'],
        typicalBudgetPercent: 18,
        subBudgets: [
          { name: 'Basic Education', budgetType: 'Operations', percent: 45, isRecurring: true, priority: 'Critical' },
          { name: 'Higher Education', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Infrastructure', budgetType: 'Capital', percent: 20, isRecurring: false, priority: 'High' }
        ],
        kpis: [
          { name: 'Literacy Rate', description: 'Adult literacy rate', targetValue: 93, unit: '%', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Health',
        shortName: 'MS',
        category: 'Health',
        description: 'Public health system and healthcare policy',
        ministerTitle: 'Minister of Health',
        organizationalLevel: 'Ministry',
        icon: 'Heart',
        color: '#dc2626',
        priority: 95,
        functions: ['Public Health', 'Healthcare Policy', 'Disease Prevention', 'Medical Services'],
        typicalBudgetPercent: 15,
        subBudgets: [
          { name: 'Public Health Services', budgetType: 'Personnel', percent: 50, isRecurring: true, priority: 'Critical' },
          { name: 'Disease Prevention', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'High' },
          { name: 'Medical Infrastructure', budgetType: 'Capital', percent: 20, isRecurring: false, priority: 'High' }
        ],
        kpis: [
          { name: 'Life Expectancy', description: 'Average life expectancy at birth', targetValue: 76, unit: 'years', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      }
    ],
    typicalRevenueSources: [
      { name: 'Income Tax', category: 'Direct Tax', rate: 27.5, collectionMethod: 'Payroll Deduction' },
      { name: 'Corporate Tax', category: 'Direct Tax', rate: 34, collectionMethod: 'Annual Filing' },
      { name: 'Value Added Tax', category: 'Indirect Tax', rate: 17, collectionMethod: 'Point of Sale' },
      { name: 'Social Security Contributions', category: 'Direct Tax', rate: 11, collectionMethod: 'Payroll Deduction' }
    ]
  },
  {
    name: 'Indian Union Government',
    governmentType: 'Federal Republic',
    description: 'Large federal democracy with strong central government and state autonomy',
    fiscalYear: 'April to March',
    departments: [
      {
        name: 'Ministry of Finance',
        shortName: 'MoF',
        category: 'Finance',
        description: 'Economic policy, fiscal management, and financial regulation',
        ministerTitle: 'Finance Minister',
        organizationalLevel: 'Ministry',
        icon: 'DollarSign',
        color: '#7c3aed',
        priority: 100,
        functions: ['Economic Policy', 'Fiscal Management', 'Tax Administration', 'Financial Regulation'],
        typicalBudgetPercent: 12,
        subBudgets: [
          { name: 'Tax Administration', budgetType: 'Personnel', percent: 40, isRecurring: true, priority: 'Critical' },
          { name: 'Economic Programs', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Financial Regulation', budgetType: 'Operations', percent: 25, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Tax to GDP Ratio', description: 'Total tax revenue as percentage of GDP', targetValue: 17, unit: '%', frequency: 'Annually', trend: 'Up', category: 'Financial' }
        ]
      },
      {
        name: 'Ministry of Rural Development',
        shortName: 'MoRD',
        category: 'Agriculture',
        description: 'Rural development programs and agricultural support',
        ministerTitle: 'Minister of Rural Development',
        organizationalLevel: 'Ministry',
        icon: 'Home',
        color: '#10b981',
        priority: 98,
        functions: ['Rural Development', 'Agricultural Support', 'Rural Employment', 'Infrastructure'],
        typicalBudgetPercent: 15,
        subBudgets: [
          { name: 'Rural Employment Programs', budgetType: 'Operations', percent: 45, isRecurring: true, priority: 'Critical' },
          { name: 'Rural Infrastructure', budgetType: 'Capital', percent: 35, isRecurring: false, priority: 'High' },
          { name: 'Agricultural Support', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Rural Employment Generation', description: 'Number of rural employment opportunities created', targetValue: 250, unit: 'million days', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Education',
        shortName: 'MoE',
        category: 'Education',
        description: 'Education policy and school system administration',
        ministerTitle: 'Minister of Education',
        organizationalLevel: 'Ministry',
        icon: 'GraduationCap',
        color: '#2563eb',
        priority: 95,
        functions: ['Education Policy', 'School Administration', 'Teacher Training', 'Educational Access'],
        typicalBudgetPercent: 16,
        subBudgets: [
          { name: 'School Education', budgetType: 'Operations', percent: 50, isRecurring: true, priority: 'Critical' },
          { name: 'Higher Education', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'High' },
          { name: 'Teacher Training', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Gross Enrollment Ratio', description: 'Percentage of children enrolled in schools', targetValue: 95, unit: '%', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      }
    ],
    typicalRevenueSources: [
      { name: 'Income Tax', category: 'Direct Tax', rate: 30, collectionMethod: 'Payroll Deduction' },
      { name: 'Goods and Services Tax', category: 'Indirect Tax', rate: 18, collectionMethod: 'Point of Sale' },
      { name: 'Corporate Tax', category: 'Direct Tax', rate: 30, collectionMethod: 'Annual Filing' },
      { name: 'Customs Duties', category: 'Indirect Tax', rate: 10, collectionMethod: 'Import Based' }
    ]
  },
  {
    name: 'Australian Commonwealth',
    governmentType: 'Constitutional Monarchy',
    description: 'Federal system with strong state governments and resource-based economy',
    fiscalYear: 'July to June',
    departments: [
      {
        name: 'Department of Treasury',
        shortName: 'Treasury',
        category: 'Finance',
        description: 'Economic policy, fiscal management, and financial regulation',
        ministerTitle: 'Treasurer',
        organizationalLevel: 'Department',
        icon: 'DollarSign',
        color: '#7c3aed',
        priority: 100,
        functions: ['Economic Policy', 'Fiscal Management', 'Tax Policy', 'Financial Regulation'],
        typicalBudgetPercent: 10,
        subBudgets: [
          { name: 'Economic Analysis', budgetType: 'Personnel', percent: 40, isRecurring: true, priority: 'High' },
          { name: 'Tax Administration', budgetType: 'Personnel', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Financial Regulation', budgetType: 'Operations', percent: 25, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Budget Balance', description: 'Government budget balance as percentage of GDP', targetValue: 0, unit: '% GDP', frequency: 'Quarterly', trend: 'Stable', category: 'Financial' }
        ]
      },
      {
        name: 'Department of Foreign Affairs and Trade',
        shortName: 'DFAT',
        category: 'Foreign Affairs',
        description: 'International relations, trade policy, and diplomatic affairs',
        ministerTitle: 'Minister for Foreign Affairs',
        organizationalLevel: 'Department',
        icon: 'Globe',
        color: '#3b82f6',
        priority: 98,
        functions: ['Diplomacy', 'Trade Policy', 'International Relations', 'Consular Services'],
        typicalBudgetPercent: 8,
        subBudgets: [
          { name: 'Diplomatic Missions', budgetType: 'Operations', percent: 50, isRecurring: true, priority: 'High' },
          { name: 'Trade Promotion', budgetType: 'Operations', percent: 30, isRecurring: true, priority: 'High' },
          { name: 'International Aid', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Trade Balance', description: 'Balance of trade as percentage of GDP', targetValue: 2, unit: '% GDP', frequency: 'Quarterly', trend: 'Stable', category: 'Performance' }
        ]
      },
      {
        name: 'Department of Industry, Science and Resources',
        shortName: 'DISR',
        category: 'Science and Technology',
        description: 'Industrial policy, scientific research, and resource management',
        ministerTitle: 'Minister for Industry and Science',
        organizationalLevel: 'Department',
        icon: 'TrendingUp',
        color: '#10b981',
        priority: 95,
        functions: ['Industrial Policy', 'Scientific Research', 'Resource Management', 'Innovation'],
        typicalBudgetPercent: 12,
        subBudgets: [
          { name: 'Research and Development', budgetType: 'Operations', percent: 40, isRecurring: true, priority: 'High' },
          { name: 'Industrial Support', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Resource Management', budgetType: 'Operations', percent: 25, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Research Intensity', description: 'R&D expenditure as percentage of GDP', targetValue: 2.2, unit: '%', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      }
    ],
    typicalRevenueSources: [
      { name: 'Income Tax', category: 'Direct Tax', rate: 45, collectionMethod: 'Payroll Deduction' },
      { name: 'Goods and Services Tax', category: 'Indirect Tax', rate: 10, collectionMethod: 'Point of Sale' },
      { name: 'Company Tax', category: 'Direct Tax', rate: 30, collectionMethod: 'Annual Filing' },
      { name: 'Resource Rent Tax', category: 'Direct Tax', rate: 40, collectionMethod: 'Annual Filing' }
    ]
  }
];

/**
 * Get all available government templates
 */
export function getGovernmentTemplates(): GovernmentTemplate[] {
  return governmentTemplates;
}

/**
 * Get a specific government template by name
 */
export function getGovernmentTemplate(name: string): GovernmentTemplate | undefined {
  return governmentTemplates.find(template => template.name === name);
}

/**
 * Get government templates by type
 */
export function getGovernmentTemplatesByType(governmentType: string): GovernmentTemplate[] {
  return governmentTemplates.filter(template => template.governmentType === governmentType);
}

/**
 * Get all unique government types
 */
export function getGovernmentTypes(): string[] {
  const types = new Set(governmentTemplates.map(template => template.governmentType));
  return Array.from(types);
}

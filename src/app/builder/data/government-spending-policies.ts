// Government Spending Policies Data
// Refactored from GovernmentSpendingSectionEnhanced.tsx
// Contains all spending policy definitions and utility functions

import type { LucideIcon } from 'lucide-react';
import {
  Shield, Heart, GraduationCap, Building2, Trees, Briefcase,
  Users, TrendingUp, Coins, Target, Recycle, Wifi,
  DollarSign, Baby, Landmark, Microscope, Plane,
  Sparkles, AlertTriangle, Scale, Globe, FileText,
  UserCheck, Home
} from 'lucide-react';
import { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';

export interface SpendingPolicy {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  impact: Record<string, number>;
}

export const SPENDING_POLICIES: SpendingPolicy[] = [
  // Budget Management Policies
  {
    id: 'performanceBasedBudgeting',
    name: 'Performance-Based Budgeting',
    description: 'Link budget allocations to measurable outcomes',
    icon: Target,
    impact: { efficiency: 15, transparency: 20 }
  },
  {
    id: 'zeroBasedBudgeting',
    name: 'Zero-Based Budgeting',
    description: 'Rebuild budget from zero each fiscal year',
    icon: DollarSign,
    impact: { efficiency: 20, flexibility: -10 }
  },
  {
    id: 'emergencyReserveFund',
    name: 'Emergency Reserve Fund',
    description: 'Maintain reserve fund for crisis response',
    icon: Shield,
    impact: { stability: 25, flexibility: 20 }
  },
  {
    id: 'infrastructureBankFund',
    name: 'Infrastructure Bank',
    description: 'Create dedicated infrastructure investment bank',
    icon: Landmark,
    impact: { infrastructure: 30, debt: 10 }
  },

  // Service Delivery Policies
  {
    id: 'universalBasicServices',
    name: 'Universal Basic Services',
    description: 'Provide free essential services to all citizens',
    icon: Heart,
    impact: { equality: 25, cost: 20 }
  },
  {
    id: 'digitalGovernmentInitiative',
    name: 'Digital Government Initiative',
    description: 'Digitize all government services and processes',
    icon: Wifi,
    impact: { efficiency: 25, accessibility: 30 }
  },
  {
    id: 'publicPrivatePartnerships',
    name: 'Public-Private Partnerships',
    description: 'Collaborate with private sector for public projects',
    icon: Briefcase,
    impact: { efficiency: 15, privatization: 25 }
  },
  {
    id: 'socialImpactBonds',
    name: 'Social Impact Bonds',
    description: 'Private funding for social programs with outcome-based returns',
    icon: TrendingUp,
    impact: { innovation: 20, privatization: 15 }
  },

  // Democratic Participation Policies
  {
    id: 'participatoryBudgeting',
    name: 'Participatory Budgeting',
    description: 'Citizens directly decide on portions of budget',
    icon: Users,
    impact: { democracy: 30, efficiency: -10 }
  },
  {
    id: 'citizenEngagement',
    name: 'Citizen Engagement Program',
    description: 'Increase citizen participation in government',
    icon: Users,
    impact: { democracy: 30, participation: 25, legitimacy: 20 }
  },
  {
    id: 'transparencyInitiative',
    name: 'Government Transparency Initiative',
    description: 'Increase government transparency and accountability',
    icon: Globe,
    impact: { transparency: 35, trust: 25, democracy: 20 }
  },

  // Economic Policies
  {
    id: 'universalBasicIncome',
    name: 'Universal Basic Income',
    description: 'Provide unconditional cash payments to all citizens',
    icon: DollarSign,
    impact: { equality: 40, cost: 35, poverty: -30 }
  },
  {
    id: 'progressiveTaxation',
    name: 'Progressive Taxation',
    description: 'Higher tax rates for higher income brackets',
    icon: TrendingUp,
    impact: { equality: 25, revenue: 20, growth: -10 }
  },
  {
    id: 'carbonTax',
    name: 'Carbon Tax',
    description: 'Tax on carbon emissions to incentivize green practices',
    icon: Trees,
    impact: { environment: 35, revenue: 15, industry: -15 }
  },
  {
    id: 'wealthTax',
    name: 'Wealth Tax',
    description: 'Annual tax on net wealth above threshold',
    icon: Building2,
    impact: { equality: 30, revenue: 25, investment: -20 }
  },
  {
    id: 'financialTransactionTax',
    name: 'Financial Transaction Tax',
    description: 'Tax on financial transactions to curb speculation',
    icon: Coins,
    impact: { stability: 20, revenue: 15, trading: -25 }
  },

  // Social Welfare Policies
  {
    id: 'universalHealthcare',
    name: 'Universal Healthcare',
    description: 'Free healthcare for all citizens',
    icon: Heart,
    impact: { health: 40, equality: 35, cost: 30 }
  },
  {
    id: 'freeEducation',
    name: 'Free Education',
    description: 'Free education from kindergarten to university',
    icon: GraduationCap,
    impact: { education: 40, equality: 30, cost: 25 }
  },
  {
    id: 'affordableHousing',
    name: 'Affordable Housing Initiative',
    description: 'Subsidized housing for low-income families',
    icon: Home,
    impact: { housing: 35, equality: 25, cost: 20 }
  },
  {
    id: 'elderlyCare',
    name: 'Comprehensive Elderly Care',
    description: 'Free healthcare and support for elderly citizens',
    icon: Users,
    impact: { health: 30, social: 25, cost: 20 }
  },
  {
    id: 'disabilitySupport',
    name: 'Disability Support Program',
    description: 'Comprehensive support for citizens with disabilities',
    icon: UserCheck,
    impact: { equality: 30, accessibility: 35, cost: 15 }
  },
  {
    id: 'mentalHealthServices',
    name: 'Mental Health Services',
    description: 'Free mental health counseling and treatment',
    icon: Heart,
    impact: { health: 25, productivity: 20, cost: 15 }
  },
  {
    id: 'childWelfareFirstPolicy',
    name: 'Child Welfare First',
    description: 'Prioritize spending on children and family services',
    icon: Baby,
    impact: { education: 20, social: 25 }
  },
  {
    id: 'preventiveCareEmphasis',
    name: 'Preventive Care Emphasis',
    description: 'Focus healthcare spending on prevention',
    icon: Heart,
    impact: { health: 25, longTermSavings: 20 }
  },

  // Education Policies
  {
    id: 'stemEducationFocus',
    name: 'STEM Education Focus',
    description: 'Prioritize science, technology, engineering, and math education',
    icon: Microscope,
    impact: { education: 25, innovation: 30, competitiveness: 20 }
  },
  {
    id: 'vocationalTraining',
    name: 'Vocational Training Program',
    description: 'Free vocational training for skilled trades',
    icon: Briefcase,
    impact: { employment: 25, skills: 30, productivity: 20 }
  },
  {
    id: 'adultEducation',
    name: 'Adult Education Initiative',
    description: 'Free education opportunities for adult citizens',
    icon: GraduationCap,
    impact: { education: 20, employment: 25, equality: 20 }
  },
  {
    id: 'earlyChildhoodEducation',
    name: 'Early Childhood Education',
    description: 'Free preschool and early learning programs',
    icon: Baby,
    impact: { education: 30, equality: 25, development: 35 }
  },

  // Infrastructure Policies
  {
    id: 'greenInvestmentPriority',
    name: 'Green Investment Priority',
    description: 'Prioritize environmentally sustainable projects',
    icon: Recycle,
    impact: { environment: 30, growth: -5 }
  },
  {
    id: 'smartCityInitiative',
    name: 'Smart City Initiative',
    description: 'Integrate technology into urban infrastructure',
    icon: Wifi,
    impact: { efficiency: 30, technology: 35, cost: 20 }
  },
  {
    id: 'publicTransportExpansion',
    name: 'Public Transport Expansion',
    description: 'Expand and modernize public transportation',
    icon: Plane,
    impact: { infrastructure: 25, environment: 20, accessibility: 30 }
  },
  {
    id: 'renewableEnergyTransition',
    name: 'Renewable Energy Transition',
    description: 'Transition to 100% renewable energy sources',
    icon: Recycle,
    impact: { environment: 40, energy: 35, cost: 25 }
  },
  {
    id: 'highSpeedInternet',
    name: 'Universal High-Speed Internet',
    description: 'Provide high-speed internet to all citizens',
    icon: Wifi,
    impact: { technology: 30, equality: 25, economy: 20 }
  },
  {
    id: 'waterInfrastructure',
    name: 'Modern Water Infrastructure',
    description: 'Upgrade and expand water treatment and distribution',
    icon: Globe,
    impact: { health: 25, infrastructure: 30, environment: 20 }
  },

  // Innovation Policies
  {
    id: 'researchDevelopmentFund',
    name: 'Research & Development Fund',
    description: 'Dedicated funding for scientific research and innovation',
    icon: Microscope,
    impact: { innovation: 35, technology: 30, competitiveness: 25 }
  },
  {
    id: 'startupIncubators',
    name: 'Startup Incubators',
    description: 'Government-funded startup incubators and accelerators',
    icon: Sparkles,
    impact: { innovation: 30, entrepreneurship: 35, economy: 20 }
  },
  {
    id: 'patentReform',
    name: 'Patent Reform',
    description: 'Streamline patent process and reduce costs',
    icon: FileText,
    impact: { innovation: 25, efficiency: 20, competition: 15 }
  },
  {
    id: 'openDataInitiative',
    name: 'Open Data Initiative',
    description: 'Make government data freely available for innovation',
    icon: Globe,
    impact: { transparency: 25, innovation: 20, efficiency: 15 }
  },

  // Security Policies
  {
    id: 'cybersecurityInitiative',
    name: 'Cybersecurity Initiative',
    description: 'Comprehensive cybersecurity protection for government and citizens',
    icon: Shield,
    impact: { security: 35, technology: 25, trust: 20 }
  },
  {
    id: 'borderSecurity',
    name: 'Enhanced Border Security',
    description: 'Improve border control and immigration processing',
    icon: Shield,
    impact: { security: 30, immigration: 25, cost: 20 }
  },
  {
    id: 'disasterPreparedness',
    name: 'Disaster Preparedness',
    description: 'Comprehensive disaster response and preparedness system',
    icon: AlertTriangle,
    impact: { security: 25, resilience: 30, cost: 15 }
  },
  {
    id: 'crimePrevention',
    name: 'Crime Prevention Program',
    description: 'Community-based crime prevention and intervention',
    icon: Shield,
    impact: { security: 20, community: 25, cost: 15 }
  },

  // Environmental Policies
  {
    id: 'carbonNeutrality',
    name: 'Carbon Neutrality Goal',
    description: 'Achieve net-zero carbon emissions by target date',
    icon: Trees,
    impact: { environment: 40, innovation: 25, cost: 30 }
  },
  {
    id: 'biodiversityProtection',
    name: 'Biodiversity Protection',
    description: 'Protect and restore natural habitats and species',
    icon: Trees,
    impact: { environment: 30, sustainability: 25, tourism: 15 }
  },
  {
    id: 'wasteReduction',
    name: 'Zero Waste Initiative',
    description: 'Eliminate waste through recycling and reduction programs',
    icon: Recycle,
    impact: { environment: 25, efficiency: 20, cost: 10 }
  },
  {
    id: 'greenBuildingStandards',
    name: 'Green Building Standards',
    description: 'Mandate environmentally friendly building practices',
    icon: Building2,
    impact: { environment: 20, efficiency: 25, cost: 15 }
  },
  {
    id: 'sustainableAgriculture',
    name: 'Sustainable Agriculture',
    description: 'Support environmentally friendly farming practices',
    icon: Trees,
    impact: { environment: 25, food: 20, rural: 15 }
  },

  // Justice Policies
  {
    id: 'criminalJusticeReform',
    name: 'Criminal Justice Reform',
    description: 'Reform sentencing, rehabilitation, and prison systems',
    icon: Scale,
    impact: { justice: 30, equality: 25, cost: 15 }
  },
  {
    id: 'legalAidExpansion',
    name: 'Legal Aid Expansion',
    description: 'Free legal assistance for low-income citizens',
    icon: Scale,
    impact: { justice: 25, equality: 30, cost: 20 }
  },
  {
    id: 'restorativeJustice',
    name: 'Restorative Justice Program',
    description: 'Focus on healing and reconciliation over punishment',
    icon: Heart,
    impact: { justice: 20, community: 25, rehabilitation: 30 }
  },
  {
    id: 'courtSystemModernization',
    name: 'Court System Modernization',
    description: 'Digitize and streamline court processes',
    icon: FileText,
    impact: { efficiency: 25, accessibility: 20, transparency: 15 }
  },

  // Cultural Policies
  {
    id: 'artsCultureFunding',
    name: 'Arts & Culture Funding',
    description: 'Support for arts, culture, and creative industries',
    icon: Sparkles,
    impact: { culture: 30, tourism: 20, creativity: 25 }
  },
  {
    id: 'heritagePreservation',
    name: 'Heritage Preservation',
    description: 'Protect and maintain historical sites and artifacts',
    icon: Building2,
    impact: { culture: 25, tourism: 20, identity: 30 }
  },
  {
    id: 'multiculturalPrograms',
    name: 'Multicultural Programs',
    description: 'Celebrate and support cultural diversity',
    icon: Globe,
    impact: { diversity: 30, inclusion: 25, harmony: 20 }
  },
  {
    id: 'languagePreservation',
    name: 'Language Preservation',
    description: 'Protect and promote minority languages',
    icon: FileText,
    impact: { culture: 20, identity: 25, diversity: 15 }
  },

  // Rural Development Policies
  {
    id: 'ruralDevelopment',
    name: 'Rural Development Program',
    description: 'Invest in rural infrastructure and economic development',
    icon: Home,
    impact: { rural: 30, equality: 25, agriculture: 20 }
  },
  {
    id: 'ruralHealthcare',
    name: 'Rural Healthcare Access',
    description: 'Improve healthcare access in rural areas',
    icon: Heart,
    impact: { health: 25, rural: 30, equality: 20 }
  },
  {
    id: 'ruralBroadband',
    name: 'Rural Broadband Expansion',
    description: 'Extend high-speed internet to rural communities',
    icon: Wifi,
    impact: { technology: 25, rural: 30, equality: 20 }
  },
  {
    id: 'agriculturalSupport',
    name: 'Agricultural Support Program',
    description: 'Support and modernize agricultural sector',
    icon: Trees,
    impact: { agriculture: 30, rural: 25, food: 20 }
  },

  // International Policies
  {
    id: 'foreignAidProgram',
    name: 'Foreign Aid Program',
    description: 'Development assistance to other nations',
    icon: Globe,
    impact: { diplomacy: 25, influence: 20, cost: 30 }
  },
  {
    id: 'refugeeSupport',
    name: 'Refugee Support Program',
    description: 'Comprehensive support for refugees and asylum seekers',
    icon: Users,
    impact: { humanitarian: 30, integration: 25, cost: 20 }
  },
  {
    id: 'diplomaticEngagement',
    name: 'Enhanced Diplomatic Engagement',
    description: 'Strengthen international relations and diplomacy',
    icon: Globe,
    impact: { diplomacy: 30, trade: 20, security: 15 }
  },
  {
    id: 'tradePromotion',
    name: 'Trade Promotion Initiative',
    description: 'Promote international trade and exports',
    icon: Plane,
    impact: { economy: 25, trade: 30, competitiveness: 20 }
  },

  // Governance Policies
  {
    id: 'antiCorruption',
    name: 'Anti-Corruption Initiative',
    description: 'Comprehensive anti-corruption measures',
    icon: Shield,
    impact: { integrity: 35, trust: 25, efficiency: 20 }
  },
  {
    id: 'publicServiceReform',
    name: 'Public Service Reform',
    description: 'Modernize and improve public service delivery',
    icon: Building2,
    impact: { efficiency: 25, quality: 30, satisfaction: 20 }
  }
];

// Policy-component mappings for filtering based on atomic components
const POLICY_COMPONENT_MAPPINGS: Record<string, ComponentType[]> = {
  'participatoryBudgeting': [ComponentType.DEMOCRATIC_PROCESS, ComponentType.ELECTORAL_LEGITIMACY],
  'citizenEngagement': [ComponentType.DEMOCRATIC_PROCESS, ComponentType.ELECTORAL_LEGITIMACY],
  'transparencyInitiative': [ComponentType.DEMOCRATIC_PROCESS, ComponentType.INSTITUTIONAL_LEGITIMACY],
  'performanceBasedBudgeting': [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.PERFORMANCE_LEGITIMACY],
  'universalHealthcare': [ComponentType.UNIVERSAL_HEALTHCARE, ComponentType.WELFARE_STATE],
  'freeEducation': [ComponentType.PUBLIC_EDUCATION, ComponentType.WELFARE_STATE],
  'environmentalProtection': [ComponentType.ENVIRONMENTAL_PROTECTION, ComponentType.RESEARCH_AND_DEVELOPMENT],
  'researchDevelopmentFund': [ComponentType.RESEARCH_AND_DEVELOPMENT, ComponentType.PERFORMANCE_LEGITIMACY],
  'cybersecurityInitiative': [ComponentType.DIGITAL_GOVERNMENT, ComponentType.CYBERSECURITY],
  'culturalPreservation': [ComponentType.CULTURAL_PRESERVATION, ComponentType.MINORITY_RIGHTS],
  'developmentAid': [ComponentType.DEVELOPMENT_AID, ComponentType.MULTILATERAL_DIPLOMACY],
  'digitalInfrastructure': [ComponentType.DIGITAL_GOVERNMENT, ComponentType.DIGITAL_INFRASTRUCTURE]
};

// Basic policies always shown regardless of atomic components
const BASIC_POLICY_IDS = [
  'performanceBasedBudgeting',
  'emergencyReserveFund',
  'infrastructureBankFund',
  'universalBasicServices',
  'greenInvestmentPriority',
  'digitalGovernmentInitiative',
  'zeroBasedBudgeting',
  'publicPrivatePartnerships',
  'socialImpactBonds',
  'childWelfareFirstPolicy',
  'preventiveCareEmphasis'
];

/**
 * Get applicable policies based on selected atomic components
 * Returns filtered list of policies relevant to the government structure
 */
export function getApplicablePolicies(selectedComponents: ComponentType[]): SpendingPolicy[] {
  if (selectedComponents.length === 0) {
    // If no atomic components selected, show basic policies
    return SPENDING_POLICIES.filter(p => BASIC_POLICY_IDS.includes(p.id));
  }

  const applicablePolicies: SpendingPolicy[] = [];

  // Check each policy against selected components
  SPENDING_POLICIES.forEach(policy => {
    const requiredComponents = POLICY_COMPONENT_MAPPINGS[policy.id] || [];

    if (requiredComponents.length === 0) {
      // If no specific mapping, include basic policies
      if (BASIC_POLICY_IDS.includes(policy.id)) {
        applicablePolicies.push(policy);
      }
    } else {
      // Check if any required components are selected
      const hasRequiredComponent = requiredComponents.some(comp =>
        selectedComponents.includes(comp)
      );
      if (hasRequiredComponent) {
        applicablePolicies.push(policy);
      }
    }
  });

  // Always include essential basic policies regardless of components
  const essentialPolicies = SPENDING_POLICIES.filter(p =>
    ['performanceBasedBudgeting', 'emergencyReserveFund', 'infrastructureBankFund'].includes(p.id)
  );

  essentialPolicies.forEach(policy => {
    if (!applicablePolicies.find(p => p.id === policy.id)) {
      applicablePolicies.push(policy);
    }
  });

  return applicablePolicies;
}

// Policy preset configurations
export const POLICY_PRESETS = {
  balanced: {
    name: 'Balanced',
    description: 'Well-rounded policy mix',
    icon: Target,
    color: 'blue',
    policies: [
      'performanceBasedBudgeting',
      'digitalGovernmentInitiative',
      'emergencyReserveFund',
      'infrastructureBankFund',
      'universalHealthcare',
      'freeEducation'
    ]
  },
  social: {
    name: 'Social Welfare',
    description: 'Focus on social services',
    icon: Heart,
    color: 'pink',
    policies: [
      'universalBasicServices',
      'universalHealthcare',
      'freeEducation',
      'childWelfareFirstPolicy',
      'affordableHousing',
      'preventiveCareEmphasis',
      'elderlyCare',
      'mentalHealthServices'
    ]
  },
  security: {
    name: 'Security',
    description: 'National security focus',
    icon: Shield,
    color: 'red',
    policies: [
      'cybersecurityInitiative',
      'borderSecurity',
      'disasterPreparedness',
      'crimePrevention',
      'emergencyReserveFund'
    ]
  },
  growth: {
    name: 'Economic Growth',
    description: 'Infrastructure & development',
    icon: TrendingUp,
    color: 'green',
    policies: [
      'infrastructureBankFund',
      'researchDevelopmentFund',
      'startupIncubators',
      'stemEducationFocus',
      'publicTransportExpansion',
      'smartCityInitiative'
    ]
  },
  innovation: {
    name: 'Innovation',
    description: 'Tech & research focus',
    icon: Sparkles,
    color: 'purple',
    policies: [
      'researchDevelopmentFund',
      'startupIncubators',
      'patentReform',
      'openDataInitiative',
      'digitalGovernmentInitiative',
      'stemEducationFocus',
      'vocationalTraining'
    ]
  }
} as const;

export type PolicyPresetKey = keyof typeof POLICY_PRESETS;

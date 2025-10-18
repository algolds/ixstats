/**
 * Atomic Government Integration System
 * 
 * This module provides live-wired integration between atomic government components
 * and the government builder system, ensuring all government data flows through
 * the atomic components with real-time feedback and intelligent adjustments.
 */

import { ComponentType, ATOMIC_COMPONENTS } from '~/components/government/atoms/AtomicGovernmentComponents';
import type { GovernmentBuilderState } from '~/types/government';
import type { GovernmentType } from '~/types/government';
import type { EconomicInputs } from '../lib/economy-data-service';

export interface AtomicGovernmentMapping {
  component: ComponentType;
  departments: Array<{
    name: string;
    category: string;
    functions: string[];
    priority: number;
    budgetPercent: number;
    effectiveness: number;
    description: string;
  }>;
  budgetAllocations: Array<{
    departmentId: string;
    allocatedAmount: number;
    allocatedPercent: number;
    rationale: string;
  }>;
  policies: Array<{
    name: string;
    description: string;
    impact: Record<string, number>;
    enabled: boolean;
  }>;
}

export interface AtomicIntegrationFeedback {
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  actionable: boolean;
  actionLabel?: string;
  actionUrl?: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Complete mapping of atomic components to government builder structures
 */
export const ATOMIC_TO_GOVERNMENT_MAPPING: Partial<Record<ComponentType, AtomicGovernmentMapping>> = {
  // Power Distribution Components
  [ComponentType.CENTRALIZED_POWER]: {
    component: ComponentType.CENTRALIZED_POWER,
    departments: [
      {
        name: "Central Planning Office",
        category: "Administration",
        functions: ["Policy Coordination", "Strategic Planning", "Resource Allocation"],
        priority: 1,
        budgetPercent: 15,
        effectiveness: 90,
        description: "Central authority for all policy coordination and strategic planning"
      },
      {
        name: "National Coordination Bureau",
        category: "Administration", 
        functions: ["Inter-agency Coordination", "Implementation Oversight"],
        priority: 2,
        budgetPercent: 10,
        effectiveness: 85,
        description: "Coordinates implementation across all government agencies"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 15,
        rationale: "High priority for centralized planning and coordination"
      },
      {
        departmentId: "1", 
        allocatedAmount: 0,
        allocatedPercent: 10,
        rationale: "Essential for maintaining centralized control"
      }
    ],
    policies: [
      {
        name: "Centralized Decision Making",
        description: "All major decisions flow through central authority",
        impact: { efficiency: 25, responsiveness: -15, transparency: -10 },
        enabled: true
      },
      {
        name: "Unified Policy Framework",
        description: "Single policy framework across all departments",
        impact: { consistency: 30, flexibility: -20 },
        enabled: true
      }
    ]
  },

  [ComponentType.FEDERAL_SYSTEM]: {
    component: ComponentType.FEDERAL_SYSTEM,
    departments: [
      {
        name: "Federal Relations Office",
        category: "Administration",
        functions: ["Inter-governmental Relations", "Federal Coordination", "Dispute Resolution"],
        priority: 1,
        budgetPercent: 12,
        effectiveness: 80,
        description: "Manages relations between federal and regional governments"
      },
      {
        name: "Regional Development Agency",
        category: "Infrastructure",
        functions: ["Regional Planning", "Infrastructure Development", "Regional Coordination"],
        priority: 2,
        budgetPercent: 18,
        effectiveness: 75,
        description: "Coordinates development across federal regions"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 12,
        rationale: "Essential for federal coordination"
      },
      {
        departmentId: "1",
        allocatedAmount: 0,
        allocatedPercent: 18,
        rationale: "Supports regional development and equity"
      }
    ],
    policies: [
      {
        name: "Subsidiarity Principle",
        description: "Decisions made at the most appropriate level of government",
        impact: { efficiency: 15, responsiveness: 20, accountability: 25 },
        enabled: true
      },
      {
        name: "Regional Autonomy",
        description: "Regional governments have significant autonomy",
        impact: { diversity: 30, innovation: 20, coordination: -10 },
        enabled: true
      }
    ]
  },

  [ComponentType.DEMOCRATIC_PROCESS]: {
    component: ComponentType.DEMOCRATIC_PROCESS,
    departments: [
      {
        name: "Electoral Commission",
        category: "Administration",
        functions: ["Election Management", "Voter Registration", "Electoral Oversight"],
        priority: 1,
        budgetPercent: 8,
        effectiveness: 85,
        description: "Manages all electoral processes and voter engagement"
      },
      {
        name: "Citizen Engagement Office",
        category: "Social Services",
        functions: ["Public Consultation", "Civic Education", "Participatory Processes"],
        priority: 2,
        budgetPercent: 6,
        effectiveness: 75,
        description: "Promotes citizen participation in governance"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Essential for democratic legitimacy"
      },
      {
        departmentId: "1",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Supports democratic participation"
      }
    ],
    policies: [
      {
        name: "Regular Elections",
        description: "Regular, free, and fair elections for all positions",
        impact: { legitimacy: 40, accountability: 30, stability: 15 },
        enabled: true
      },
      {
        name: "Public Consultation",
        description: "Systematic public consultation on major policies",
        impact: { responsiveness: 25, transparency: 30, efficiency: -10 },
        enabled: true
      }
    ]
  },

  [ComponentType.RULE_OF_LAW]: {
    component: ComponentType.RULE_OF_LAW,
    departments: [
      {
        name: "Legal Affairs Department",
        category: "Justice",
        functions: ["Legal Framework", "Constitutional Affairs", "Legal Compliance"],
        priority: 1,
        budgetPercent: 10,
        effectiveness: 90,
        description: "Ensures legal framework and constitutional compliance"
      },
      {
        name: "Ombudsman Office",
        category: "Justice",
        functions: ["Administrative Oversight", "Citizen Rights Protection", "Complaint Resolution"],
        priority: 2,
        budgetPercent: 5,
        effectiveness: 80,
        description: "Protects citizen rights and ensures administrative fairness"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 10,
        rationale: "Foundation for all other government functions"
      },
      {
        departmentId: "1",
        allocatedAmount: 0,
        allocatedPercent: 5,
        rationale: "Essential for citizen protection and rights"
      }
    ],
    policies: [
      {
        name: "Legal Certainty",
        description: "Clear, consistent, and predictable legal framework",
        impact: { stability: 35, predictability: 40, investment: 25 },
        enabled: true
      },
      {
        name: "Equal Protection",
        description: "Equal treatment under the law for all citizens",
        impact: { fairness: 45, socialCohesion: 30, legitimacy: 25 },
        enabled: true
      }
    ]
  },

  [ComponentType.PROFESSIONAL_BUREAUCRACY]: {
    component: ComponentType.PROFESSIONAL_BUREAUCRACY,
    departments: [
      {
        name: "Civil Service Commission",
        category: "Administration",
        functions: ["Recruitment", "Training", "Performance Management", "Career Development"],
        priority: 1,
        budgetPercent: 12,
        effectiveness: 85,
        description: "Manages professional civil service recruitment and development"
      },
      {
        name: "Administrative Efficiency Office",
        category: "Administration",
        functions: ["Process Optimization", "Digital Services", "Performance Monitoring"],
        priority: 2,
        budgetPercent: 8,
        effectiveness: 80,
        description: "Optimizes government processes and service delivery"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 12,
        rationale: "Investment in human capital and expertise"
      },
      {
        departmentId: "1",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Continuous improvement and modernization"
      }
    ],
    policies: [
      {
        name: "Merit-Based Recruitment",
        description: "Hiring based on qualifications and merit",
        impact: { competence: 40, efficiency: 30, fairness: 25 },
        enabled: true
      },
      {
        name: "Performance Management",
        description: "Systematic performance evaluation and improvement",
        impact: { productivity: 35, accountability: 30, quality: 25 },
        enabled: true
      }
    ]
  },

  // Add more components as needed...
  [ComponentType.CONFEDERATE_SYSTEM]: {
    component: ComponentType.CONFEDERATE_SYSTEM,
    departments: [
      {
        name: "Confederation Coordination Office",
        category: "Administration",
        functions: ["Inter-regional Coordination", "Consensus Building", "Limited Central Services"],
        priority: 1,
        budgetPercent: 8,
        effectiveness: 70,
        description: "Minimal central coordination for confederate system"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Minimal central authority in confederate system"
      }
    ],
    policies: [
      {
        name: "Regional Autonomy",
        description: "Maximum autonomy for regional governments",
        impact: { diversity: 40, localResponsiveness: 35, coordination: -25 },
        enabled: true
      }
    ]
  },

  [ComponentType.UNITARY_SYSTEM]: {
    component: ComponentType.UNITARY_SYSTEM,
    departments: [
      {
        name: "National Administration Office",
        category: "Administration",
        functions: ["National Coordination", "Local Government Oversight", "Uniform Standards"],
        priority: 1,
        budgetPercent: 14,
        effectiveness: 85,
        description: "Centralized administration with local implementation"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 14,
        rationale: "Unified national administration"
      }
    ],
    policies: [
      {
        name: "Uniform Standards",
        description: "Consistent standards across all regions",
        impact: { consistency: 40, efficiency: 25, equity: 30 },
        enabled: true
      }
    ]
  },

  [ComponentType.AUTOCRATIC_PROCESS]: {
    component: ComponentType.AUTOCRATIC_PROCESS,
    departments: [
      {
        name: "Executive Command Office",
        category: "Administration",
        functions: ["Executive Decision Making", "Policy Implementation", "Administrative Control"],
        priority: 1,
        budgetPercent: 16,
        effectiveness: 75,
        description: "Centralized executive decision making"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 16,
        rationale: "Strong executive control and rapid decision making"
      }
    ],
    policies: [
      {
        name: "Executive Authority",
        description: "Concentrated executive power for rapid decisions",
        impact: { speed: 40, stability: 25, responsiveness: 30, accountability: -20 },
        enabled: true
      }
    ]
  },

  [ComponentType.TECHNOCRATIC_PROCESS]: {
    component: ComponentType.TECHNOCRATIC_PROCESS,
    departments: [
      {
        name: "Technical Advisory Council",
        category: "Administration",
        functions: ["Technical Analysis", "Evidence-Based Policy", "Scientific Advisory"],
        priority: 1,
        budgetPercent: 10,
        effectiveness: 90,
        description: "Technical expertise for policy formulation"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 10,
        rationale: "Investment in technical expertise and evidence-based policy"
      }
    ],
    policies: [
      {
        name: "Evidence-Based Policy",
        description: "Policies based on technical analysis and evidence",
        impact: { effectiveness: 35, innovation: 30, scientificRigour: 40 },
        enabled: true
      }
    ]
  },

  [ComponentType.CONSENSUS_PROCESS]: {
    component: ComponentType.CONSENSUS_PROCESS,
    departments: [
      {
        name: "Consensus Building Office",
        category: "Administration",
        functions: ["Stakeholder Engagement", "Consensus Facilitation", "Mediation Services"],
        priority: 1,
        budgetPercent: 9,
        effectiveness: 80,
        description: "Facilitates consensus building and stakeholder engagement"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 9,
        rationale: "Investment in consensus building and stakeholder engagement"
      }
    ],
    policies: [
      {
        name: "Consensus Decision Making",
        description: "Decisions require broad consensus among stakeholders",
        impact: { legitimacy: 35, inclusiveness: 40, stability: 30, speed: -25 },
        enabled: true
      }
    ]
  },

  [ComponentType.OLIGARCHIC_PROCESS]: {
    component: ComponentType.OLIGARCHIC_PROCESS,
    departments: [
      {
        name: "Elite Coordination Council",
        category: "Administration",
        functions: ["Elite Coordination", "Limited Participation", "Elite Decision Making"],
        priority: 1,
        budgetPercent: 7,
        effectiveness: 70,
        description: "Coordination among elite decision makers"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 7,
        rationale: "Limited elite coordination structure"
      }
    ],
    policies: [
      {
        name: "Elite Governance",
        description: "Governance by a small elite group",
        impact: { efficiency: 20, stability: 15, legitimacy: -30, inclusiveness: -40 },
        enabled: true
      }
    ]
  },

  [ComponentType.ELECTORAL_LEGITIMACY]: {
    component: ComponentType.ELECTORAL_LEGITIMACY,
    departments: [
      {
        name: "Electoral Integrity Office",
        category: "Administration",
        functions: ["Election Integrity", "Voter Education", "Electoral Reform"],
        priority: 1,
        budgetPercent: 8,
        effectiveness: 85,
        description: "Ensures electoral integrity and democratic legitimacy"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Essential for democratic legitimacy"
      }
    ],
    policies: [
      {
        name: "Free and Fair Elections",
        description: "Regular, free, and fair electoral processes",
        impact: { legitimacy: 45, accountability: 35, democraticParticipation: 40 },
        enabled: true
      }
    ]
  },

  [ComponentType.TRADITIONAL_LEGITIMACY]: {
    component: ComponentType.TRADITIONAL_LEGITIMACY,
    departments: [
      {
        name: "Traditional Affairs Office",
        category: "Culture",
        functions: ["Traditional Authority Relations", "Cultural Preservation", "Traditional Governance"],
        priority: 1,
        budgetPercent: 6,
        effectiveness: 75,
        description: "Maintains traditional authority and cultural legitimacy"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Support for traditional authority and cultural continuity"
      }
    ],
    policies: [
      {
        name: "Traditional Authority",
        description: "Recognition and integration of traditional authority",
        impact: { culturalContinuity: 40, socialStability: 30, traditionalLegitimacy: 45 },
        enabled: true
      }
    ]
  },

  [ComponentType.PERFORMANCE_LEGITIMACY]: {
    component: ComponentType.PERFORMANCE_LEGITIMACY,
    departments: [
      {
        name: "Performance Monitoring Office",
        category: "Administration",
        functions: ["Performance Measurement", "Outcome Tracking", "Results-Based Management"],
        priority: 1,
        budgetPercent: 10,
        effectiveness: 85,
        description: "Monitors and reports on government performance"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 10,
        rationale: "Investment in performance measurement and accountability"
      }
    ],
    policies: [
      {
        name: "Results-Based Governance",
        description: "Government legitimacy based on performance and results",
        impact: { effectiveness: 40, accountability: 35, performanceCulture: 45 },
        enabled: true
      }
    ]
  },

  [ComponentType.CHARISMATIC_LEGITIMACY]: {
    component: ComponentType.CHARISMATIC_LEGITIMACY,
    departments: [
      {
        name: "Leadership Development Office",
        category: "Administration",
        functions: ["Leadership Training", "Vision Communication", "Inspirational Leadership"],
        priority: 1,
        budgetPercent: 7,
        effectiveness: 70,
        description: "Develops and supports charismatic leadership"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 7,
        rationale: "Investment in leadership development and vision"
      }
    ],
    policies: [
      {
        name: "Visionary Leadership",
        description: "Leadership based on charisma and vision",
        impact: { inspiration: 40, mobilization: 35, stability: -15, institutionalization: -20 },
        enabled: true
      }
    ]
  },

  [ComponentType.RELIGIOUS_LEGITIMACY]: {
    component: ComponentType.RELIGIOUS_LEGITIMACY,
    departments: [
      {
        name: "Religious Affairs Office",
        category: "Culture",
        functions: ["Religious Relations", "Moral Guidance", "Religious Freedom"],
        priority: 1,
        budgetPercent: 8,
        effectiveness: 75,
        description: "Manages religious affairs and moral guidance"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Support for religious legitimacy and moral guidance"
      }
    ],
    policies: [
      {
        name: "Religious Authority",
        description: "Integration of religious authority in governance",
        impact: { moralGuidance: 40, religiousLegitimacy: 45, pluralism: -20 },
        enabled: true
      }
    ]
  },

  [ComponentType.MILITARY_ADMINISTRATION]: {
    component: ComponentType.MILITARY_ADMINISTRATION,
    departments: [
      {
        name: "Military Affairs Office",
        category: "Defense",
        functions: ["Military Coordination", "Defense Planning", "Military Administration"],
        priority: 1,
        budgetPercent: 15,
        effectiveness: 80,
        description: "Military coordination and defense administration"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 15,
        rationale: "Strong military presence in administration"
      }
    ],
    policies: [
      {
        name: "Military Governance",
        description: "Military involvement in civil administration",
        impact: { security: 35, stability: 25, civilianControl: -30, democraticParticipation: -25 },
        enabled: true
      }
    ]
  },

  [ComponentType.INDEPENDENT_JUDICIARY]: {
    component: ComponentType.INDEPENDENT_JUDICIARY,
    departments: [
      {
        name: "Judicial Affairs Office",
        category: "Justice",
        functions: ["Judicial Independence", "Legal Interpretation", "Constitutional Review"],
        priority: 1,
        budgetPercent: 12,
        effectiveness: 90,
        description: "Maintains judicial independence and constitutional review"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 12,
        rationale: "Essential for judicial independence and rule of law"
      }
    ],
    policies: [
      {
        name: "Judicial Independence",
        description: "Independent judiciary free from political interference",
        impact: { ruleOfLaw: 45, fairness: 40, checksAndBalances: 35 },
        enabled: true
      }
    ]
  },

  [ComponentType.PARTISAN_INSTITUTIONS]: {
    component: ComponentType.PARTISAN_INSTITUTIONS,
    departments: [
      {
        name: "Political Affairs Office",
        category: "Administration",
        functions: ["Political Coordination", "Partisan Management", "Political Oversight"],
        priority: 1,
        budgetPercent: 9,
        effectiveness: 70,
        description: "Manages partisan aspects of government institutions"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 9,
        rationale: "Support for partisan political coordination"
      }
    ],
    policies: [
      {
        name: "Partisan Control",
        description: "Government institutions controlled by political parties",
        impact: { politicalCoherence: 30, accountability: -15, meritocracy: -25 },
        enabled: true
      }
    ]
  },

  [ComponentType.TECHNOCRATIC_AGENCIES]: {
    component: ComponentType.TECHNOCRATIC_AGENCIES,
    departments: [
      {
        name: "Technical Agencies Office",
        category: "Administration",
        functions: ["Technical Expertise", "Specialized Administration", "Professional Management"],
        priority: 1,
        budgetPercent: 11,
        effectiveness: 85,
        description: "Technical expertise and specialized administration"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 11,
        rationale: "Investment in technical expertise and professional management"
      }
    ],
    policies: [
      {
        name: "Technical Expertise",
        description: "Government by technical experts and professionals",
        impact: { competence: 40, efficiency: 35, scientificRigour: 30, democraticParticipation: -15 },
        enabled: true
      }
    ]
  },

  [ComponentType.SURVEILLANCE_SYSTEM]: {
    component: ComponentType.SURVEILLANCE_SYSTEM,
    departments: [
      {
        name: "Surveillance Coordination Office",
        category: "Security",
        functions: ["Surveillance Operations", "Information Monitoring", "Security Intelligence"],
        priority: 1,
        budgetPercent: 13,
        effectiveness: 75,
        description: "Coordinates surveillance and monitoring activities"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 13,
        rationale: "Investment in surveillance and security capabilities"
      }
    ],
    policies: [
      {
        name: "Comprehensive Surveillance",
        description: "Extensive surveillance and monitoring systems",
        impact: { security: 35, control: 40, privacy: -35, freedom: -30 },
        enabled: true
      }
    ]
  },

  [ComponentType.ECONOMIC_INCENTIVES]: {
    component: ComponentType.ECONOMIC_INCENTIVES,
    departments: [
      {
        name: "Economic Incentives Office",
        category: "Economics",
        functions: ["Incentive Design", "Economic Policy", "Behavioral Economics"],
        priority: 1,
        budgetPercent: 10,
        effectiveness: 80,
        description: "Designs and manages economic incentive systems"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 10,
        rationale: "Investment in economic incentive systems"
      }
    ],
    policies: [
      {
        name: "Market-Based Governance",
        description: "Use of economic incentives to guide behavior",
        impact: { efficiency: 30, innovation: 25, marketOrientation: 35, equity: -20 },
        enabled: true
      }
    ]
  },

  [ComponentType.SOCIAL_PRESSURE]: {
    component: ComponentType.SOCIAL_PRESSURE,
    departments: [
      {
        name: "Social Cohesion Office",
        category: "Social Services",
        functions: ["Social Integration", "Community Building", "Social Norms"],
        priority: 1,
        budgetPercent: 8,
        effectiveness: 75,
        description: "Promotes social cohesion and community pressure"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Investment in social cohesion and community building"
      }
    ],
    policies: [
      {
        name: "Social Governance",
        description: "Governance through social pressure and community norms",
        impact: { socialCohesion: 35, communityEngagement: 30, socialControl: 25, individualFreedom: -20 },
        enabled: true
      }
    ]
  },

  [ComponentType.MILITARY_ENFORCEMENT]: {
    component: ComponentType.MILITARY_ENFORCEMENT,
    departments: [
      {
        name: "Military Enforcement Office",
        category: "Defense",
        functions: ["Law Enforcement", "Military Justice", "Security Operations"],
        priority: 1,
        budgetPercent: 14,
        effectiveness: 80,
        description: "Military-based law enforcement and security"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 14,
        rationale: "Strong military presence in law enforcement"
      }
    ],
    policies: [
      {
        name: "Military Law Enforcement",
        description: "Military involvement in law enforcement and security",
        impact: { security: 40, order: 35, civilianRights: -25, democraticControl: -30 },
        enabled: true
      }
    ]
  },

  // Economic Governance Components
  [ComponentType.FREE_MARKET_SYSTEM]: {
    component: ComponentType.FREE_MARKET_SYSTEM,
    departments: [
      {
        name: "Market Regulation Office",
        category: "Commerce",
        functions: ["Market Monitoring", "Competition Policy", "Consumer Protection"],
        priority: 3,
        budgetPercent: 5,
        effectiveness: 80,
        description: "Minimal regulatory oversight to ensure fair market competition"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 5,
        rationale: "Minimal government intervention in markets"
      }
    ],
    policies: [
      {
        name: "Market Liberalization",
        description: "Reduce government intervention in economic activities",
        impact: { efficiency: 20, innovation: 15, inequality: -10 },
        enabled: true
      }
    ]
  },

  [ComponentType.PLANNED_ECONOMY]: {
    component: ComponentType.PLANNED_ECONOMY,
    departments: [
      {
        name: "Economic Planning Commission",
        category: "Commerce",
        functions: ["Resource Allocation", "Production Planning", "Price Setting"],
        priority: 1,
        budgetPercent: 20,
        effectiveness: 85,
        description: "Central authority for all economic planning and resource allocation"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 20,
        rationale: "Central economic planning requires significant resources"
      }
    ],
    policies: [
      {
        name: "Central Economic Planning",
        description: "Government controls major economic decisions",
        impact: { efficiency: -10, stability: 25, innovation: -15 },
        enabled: true
      }
    ]
  },

  [ComponentType.MIXED_ECONOMY]: {
    component: ComponentType.MIXED_ECONOMY,
    departments: [
      {
        name: "Economic Coordination Bureau",
        category: "Commerce",
        functions: ["Market Regulation", "Public Sector Management", "Economic Policy"],
        priority: 2,
        budgetPercent: 12,
        effectiveness: 75,
        description: "Balances market forces with government intervention"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 12,
        rationale: "Mixed approach requires moderate government involvement"
      }
    ],
    policies: [
      {
        name: "Balanced Economic Policy",
        description: "Combines market mechanisms with government oversight",
        impact: { efficiency: 10, stability: 15, flexibility: 5 },
        enabled: true
      }
    ]
  },

  [ComponentType.CORPORATIST_SYSTEM]: {
    component: ComponentType.CORPORATIST_SYSTEM,
    departments: [
      {
        name: "Corporatist Coordination Office",
        category: "Commerce",
        functions: ["Interest Group Mediation", "Sectoral Planning", "Social Partnership"],
        priority: 2,
        budgetPercent: 8,
        effectiveness: 70,
        description: "Coordinates between government, business, and labor organizations"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Corporatist coordination requires institutional support"
      }
    ],
    policies: [
      {
        name: "Tripartite Coordination",
        description: "Government, business, and labor work together on policy",
        impact: { stability: 20, consensus: 25, efficiency: -5 },
        enabled: true
      }
    ]
  },

  [ComponentType.SOCIAL_MARKET_ECONOMY]: {
    component: ComponentType.SOCIAL_MARKET_ECONOMY,
    departments: [
      {
        name: "Social Market Coordination",
        category: "Commerce",
        functions: ["Market Regulation", "Social Safety Nets", "Competition Policy"],
        priority: 2,
        budgetPercent: 10,
        effectiveness: 80,
        description: "Combines free markets with strong social protections"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 10,
        rationale: "Social market economy requires balanced approach"
      }
    ],
    policies: [
      {
        name: "Social Market Principles",
        description: "Free markets with social responsibility",
        impact: { efficiency: 15, social_cohesion: 20, innovation: 10 },
        enabled: true
      }
    ]
  },

  [ComponentType.STATE_CAPITALISM]: {
    component: ComponentType.STATE_CAPITALISM,
    departments: [
      {
        name: "State Enterprise Board",
        category: "Commerce",
        functions: ["State-Owned Enterprise Management", "Strategic Investment", "Economic Planning"],
        priority: 1,
        budgetPercent: 18,
        effectiveness: 75,
        description: "Manages state-owned enterprises and strategic investments"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 18,
        rationale: "State capitalism requires significant state enterprise investment"
      }
    ],
    policies: [
      {
        name: "Strategic State Control",
        description: "Government controls key economic sectors",
        impact: { stability: 25, efficiency: -5, strategic_control: 30 },
        enabled: true
      }
    ]
  },

  [ComponentType.RESOURCE_BASED_ECONOMY]: {
    component: ComponentType.RESOURCE_BASED_ECONOMY,
    departments: [
      {
        name: "Resource Management Authority",
        category: "Commerce",
        functions: ["Resource Extraction", "Environmental Protection", "Resource Allocation"],
        priority: 1,
        budgetPercent: 15,
        effectiveness: 70,
        description: "Manages natural resource extraction and distribution"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 15,
        rationale: "Resource-based economy requires strong resource management"
      }
    ],
    policies: [
      {
        name: "Resource Sovereignty",
        description: "Government controls natural resource extraction",
        impact: { revenue: 25, sustainability: -10, stability: 15 },
        enabled: true
      }
    ]
  },

  [ComponentType.KNOWLEDGE_ECONOMY]: {
    component: ComponentType.KNOWLEDGE_ECONOMY,
    departments: [
      {
        name: "Innovation and Technology Office",
        category: "Science and Technology",
        functions: ["R&D Funding", "Technology Transfer", "Innovation Policy"],
        priority: 2,
        budgetPercent: 12,
        effectiveness: 85,
        description: "Promotes knowledge-based economic development"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 12,
        rationale: "Knowledge economy requires investment in innovation"
      }
    ],
    policies: [
      {
        name: "Innovation-Driven Growth",
        description: "Economic growth through knowledge and innovation",
        impact: { innovation: 30, productivity: 20, competitiveness: 25 },
        enabled: true
      }
    ]
  },

  // Administrative Efficiency Components
  [ComponentType.DIGITAL_GOVERNMENT]: {
    component: ComponentType.DIGITAL_GOVERNMENT,
    departments: [
      {
        name: "Digital Services Bureau",
        category: "Interior",
        functions: ["E-Government Services", "Digital Infrastructure", "Cybersecurity"],
        priority: 2,
        budgetPercent: 8,
        effectiveness: 90,
        description: "Provides digital government services and infrastructure"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Digital government requires technology investment"
      }
    ],
    policies: [
      {
        name: "Digital Transformation",
        description: "Government services delivered digitally",
        impact: { efficiency: 25, accessibility: 20, transparency: 15 },
        enabled: true
      }
    ]
  },

  [ComponentType.ADMINISTRATIVE_DECENTRALIZATION]: {
    component: ComponentType.ADMINISTRATIVE_DECENTRALIZATION,
    departments: [
      {
        name: "Administrative Efficiency Office",
        category: "Interior",
        functions: ["Process Optimization", "Red Tape Reduction", "Service Delivery"],
        priority: 2,
        budgetPercent: 6,
        effectiveness: 80,
        description: "Streamlines government processes and reduces bureaucracy"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Streamlined bureaucracy reduces administrative costs"
      }
    ],
    policies: [
      {
        name: "Administrative Simplification",
        description: "Reduces bureaucratic complexity and improves efficiency",
        impact: { efficiency: 20, responsiveness: 15, citizen_satisfaction: 10 },
        enabled: true
      }
    ]
  },

  [ComponentType.E_GOVERNANCE]: {
    component: ComponentType.E_GOVERNANCE,
    departments: [
      {
        name: "Local Government Coordination",
        category: "Interior",
        functions: ["Local Autonomy Support", "Regional Coordination", "Subsidiarity Implementation"],
        priority: 3,
        budgetPercent: 7,
        effectiveness: 75,
        description: "Supports decentralized administrative functions"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 7,
        rationale: "Decentralized administration requires coordination support"
      }
    ],
    policies: [
      {
        name: "Subsidiarity Principle",
        description: "Decisions made at the most appropriate level",
        impact: { responsiveness: 20, local_autonomy: 25, efficiency: -5 },
        enabled: true
      }
    ]
  },

  [ComponentType.MERIT_BASED_SYSTEM]: {
    component: ComponentType.MERIT_BASED_SYSTEM,
    departments: [
      {
        name: "Civil Service Commission",
        category: "Interior",
        functions: ["Recruitment", "Performance Evaluation", "Career Development"],
        priority: 2,
        budgetPercent: 4,
        effectiveness: 85,
        description: "Ensures merit-based hiring and promotion in civil service"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 4,
        rationale: "Merit-based systems require robust HR infrastructure"
      }
    ],
    policies: [
      {
        name: "Meritocratic Recruitment",
        description: "Hiring based on qualifications and performance",
        impact: { competence: 25, efficiency: 15, corruption: -20 },
        enabled: true
      }
    ]
  },

  [ComponentType.PERFORMANCE_MANAGEMENT]: {
    component: ComponentType.PERFORMANCE_MANAGEMENT,
    departments: [
      {
        name: "Performance Evaluation Office",
        category: "Interior",
        functions: ["KPI Tracking", "Performance Analysis", "Improvement Recommendations"],
        priority: 2,
        budgetPercent: 5,
        effectiveness: 80,
        description: "Monitors and evaluates government performance"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 5,
        rationale: "Performance monitoring requires data collection and analysis"
      }
    ],
    policies: [
      {
        name: "Results-Based Management",
        description: "Government performance measured by outcomes",
        impact: { accountability: 20, efficiency: 15, transparency: 10 },
        enabled: true
      }
    ]
  },

  [ComponentType.STRATEGIC_PLANNING]: {
    component: ComponentType.STRATEGIC_PLANNING,
    departments: [
      {
        name: "Rapid Response Coordination",
        category: "Interior",
        functions: ["Emergency Procedures", "Fast-Track Processing", "Crisis Management"],
        priority: 2,
        budgetPercent: 6,
        effectiveness: 75,
        description: "Enables rapid government decision-making and response"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Quick decision-making requires streamlined processes"
      }
    ],
    policies: [
      {
        name: "Accelerated Decision Processes",
        description: "Reduces time for government decisions and responses",
        impact: { responsiveness: 25, flexibility: 20, stability: -5 },
        enabled: true
      }
    ]
  },

  [ComponentType.RISK_MANAGEMENT]: {
    component: ComponentType.RISK_MANAGEMENT,
    departments: [
      {
        name: "Cross-Agency Coordination Office",
        category: "Interior",
        functions: ["Inter-Agency Communication", "Joint Project Management", "Policy Coordination"],
        priority: 2,
        budgetPercent: 7,
        effectiveness: 70,
        description: "Coordinates activities across government agencies"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 7,
        rationale: "Inter-agency coordination requires dedicated resources"
      }
    ],
    policies: [
      {
        name: "Whole-of-Government Approach",
        description: "Coordination across all government agencies",
        impact: { coordination: 25, efficiency: 15, duplication: -20 },
        enabled: true
      }
    ]
  },

  [ComponentType.QUALITY_ASSURANCE]: {
    component: ComponentType.QUALITY_ASSURANCE,
    departments: [
      {
        name: "Citizen Engagement Office",
        category: "Interior",
        functions: ["Feedback Collection", "Public Consultation", "Service Improvement"],
        priority: 3,
        budgetPercent: 4,
        effectiveness: 75,
        description: "Collects and processes citizen feedback on government services"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 4,
        rationale: "Citizen feedback systems require engagement infrastructure"
      }
    ],
    policies: [
      {
        name: "Participatory Governance",
        description: "Citizens provide feedback on government services",
        impact: { responsiveness: 20, citizen_satisfaction: 25, accountability: 15 },
        enabled: true
      }
    ]
  },

  // Social Policy Components
  [ComponentType.WELFARE_STATE]: {
    component: ComponentType.WELFARE_STATE,
    departments: [
      {
        name: "Social Welfare Department",
        category: "Social Services",
        functions: ["Social Security", "Unemployment Benefits", "Disability Support"],
        priority: 1,
        budgetPercent: 25,
        effectiveness: 85,
        description: "Comprehensive social safety net and welfare programs"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 25,
        rationale: "Welfare state requires substantial social spending"
      }
    ],
    policies: [
      {
        name: "Universal Social Protection",
        description: "Comprehensive social safety net for all citizens",
        impact: { social_cohesion: 30, equality: 25, economic_freedom: -15 },
        enabled: true
      }
    ]
  },

  [ComponentType.UNIVERSAL_HEALTHCARE]: {
    component: ComponentType.UNIVERSAL_HEALTHCARE,
    departments: [
      {
        name: "Ministry of Health",
        category: "Health",
        functions: ["Healthcare Delivery", "Public Health", "Medical Research"],
        priority: 1,
        budgetPercent: 18,
        effectiveness: 80,
        description: "Comprehensive healthcare system and public health services"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 18,
        rationale: "Healthcare system requires significant investment"
      }
    ],
    policies: [
      {
        name: "Universal Healthcare",
        description: "Healthcare accessible to all citizens",
        impact: { public_health: 30, equality: 20, productivity: 15 },
        enabled: true
      }
    ]
  },

  [ComponentType.PUBLIC_EDUCATION]: {
    component: ComponentType.PUBLIC_EDUCATION,
    departments: [
      {
        name: "Ministry of Education",
        category: "Education",
        functions: ["Primary Education", "Secondary Education", "Higher Education"],
        priority: 1,
        budgetPercent: 15,
        effectiveness: 80,
        description: "Comprehensive education system from primary to higher education"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 15,
        rationale: "Education system requires substantial investment"
      }
    ],
    policies: [
      {
        name: "Universal Education",
        description: "Education accessible to all citizens",
        impact: { human_capital: 30, innovation: 20, equality: 25 },
        enabled: true
      }
    ]
  },

  [ComponentType.SOCIAL_SAFETY_NET]: {
    component: ComponentType.SOCIAL_SAFETY_NET,
    departments: [
      {
        name: "Housing and Urban Development",
        category: "Social Services",
        functions: ["Affordable Housing", "Urban Planning", "Housing Assistance"],
        priority: 2,
        budgetPercent: 8,
        effectiveness: 70,
        description: "Provides affordable housing and urban development services"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Affordable housing requires significant infrastructure investment"
      }
    ],
    policies: [
      {
        name: "Housing for All",
        description: "Affordable housing accessible to all citizens",
        impact: { social_cohesion: 20, equality: 15, urban_development: 25 },
        enabled: true
      }
    ]
  },

  [ComponentType.WORKER_PROTECTION]: {
    component: ComponentType.WORKER_PROTECTION,
    departments: [
      {
        name: "Early Childhood Development",
        category: "Social Services",
        functions: ["Child Care", "Early Education", "Family Support"],
        priority: 2,
        budgetPercent: 6,
        effectiveness: 75,
        description: "Comprehensive child care and early childhood development services"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Child care services require specialized facilities and staff"
      }
    ],
    policies: [
      {
        name: "Universal Child Care",
        description: "Child care accessible to all families",
        impact: { gender_equality: 25, workforce_participation: 20, child_development: 30 },
        enabled: true
      }
    ]
  },

  [ComponentType.ENVIRONMENTAL_PROTECTION]: {
    component: ComponentType.ENVIRONMENTAL_PROTECTION,
    departments: [
      {
        name: "Senior Services Department",
        category: "Social Services",
        functions: ["Elderly Care", "Pension Administration", "Senior Health"],
        priority: 2,
        budgetPercent: 10,
        effectiveness: 75,
        description: "Comprehensive care and support for elderly citizens"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 10,
        rationale: "Elderly care requires specialized facilities and healthcare"
      }
    ],
    policies: [
      {
        name: "Comprehensive Elderly Support",
        description: "Complete care system for elderly citizens",
        impact: { social_cohesion: 20, dignity: 25, family_support: 15 },
        enabled: true
      }
    ]
  },

  [ComponentType.CULTURAL_PRESERVATION]: {
    component: ComponentType.CULTURAL_PRESERVATION,
    departments: [
      {
        name: "Disability Services Office",
        category: "Social Services",
        functions: ["Accessibility Services", "Disability Benefits", "Inclusive Programs"],
        priority: 2,
        budgetPercent: 5,
        effectiveness: 80,
        description: "Support services and accessibility for citizens with disabilities"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 5,
        rationale: "Disability support requires specialized services and accessibility"
      }
    ],
    policies: [
      {
        name: "Inclusive Society",
        description: "Full inclusion and support for citizens with disabilities",
        impact: { inclusion: 30, dignity: 25, accessibility: 20 },
        enabled: true
      }
    ]
  },

  [ComponentType.MINORITY_RIGHTS]: {
    component: ComponentType.MINORITY_RIGHTS,
    departments: [
      {
        name: "Mental Health Bureau",
        category: "Health",
        functions: ["Mental Health Treatment", "Crisis Intervention", "Prevention Programs"],
        priority: 2,
        budgetPercent: 7,
        effectiveness: 75,
        description: "Comprehensive mental health services and support programs"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 7,
        rationale: "Mental health services require specialized treatment and facilities"
      }
    ],
    policies: [
      {
        name: "Mental Health for All",
        description: "Mental health services accessible to all citizens",
        impact: { public_health: 25, productivity: 20, social_cohesion: 15 },
        enabled: true
      }
    ]
  },

  // International Relations Components
  [ComponentType.MULTILATERAL_DIPLOMACY]: {
    component: ComponentType.MULTILATERAL_DIPLOMACY,
    departments: [
      {
        name: "International Relations Department",
        category: "Foreign Affairs",
        functions: ["Multilateral Negotiations", "International Cooperation", "Global Governance"],
        priority: 2,
        budgetPercent: 8,
        effectiveness: 80,
        description: "Engages in multilateral diplomacy and international cooperation"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Multilateral diplomacy requires international engagement resources"
      }
    ],
    policies: [
      {
        name: "Multilateral Engagement",
        description: "Active participation in international organizations and agreements",
        impact: { international_influence: 25, cooperation: 20, sovereignty: -10 },
        enabled: true
      }
    ]
  },

  [ComponentType.REGIONAL_INTEGRATION]: {
    component: ComponentType.REGIONAL_INTEGRATION,
    departments: [
      {
        name: "Regional Cooperation Office",
        category: "Foreign Affairs",
        functions: ["Regional Trade", "Regional Security", "Cultural Exchange"],
        priority: 2,
        budgetPercent: 6,
        effectiveness: 75,
        description: "Promotes regional integration and cooperation"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Regional integration requires coordination and cooperation resources"
      }
    ],
    policies: [
      {
        name: "Regional Partnership",
        description: "Deep integration with regional neighbors and partners",
        impact: { regional_influence: 20, trade: 25, security: 15 },
        enabled: true
      }
    ]
  },

  [ComponentType.DEVELOPMENT_AID]: {
    component: ComponentType.DEVELOPMENT_AID,
    departments: [
      {
        name: "International Development Agency",
        category: "Foreign Affairs",
        functions: ["Foreign Aid", "Development Projects", "Capacity Building"],
        priority: 3,
        budgetPercent: 4,
        effectiveness: 70,
        description: "Provides development assistance and foreign aid"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 4,
        rationale: "Development assistance requires dedicated aid resources"
      }
    ],
    policies: [
      {
        name: "Global Development Partnership",
        description: "Provides development assistance to other countries",
        impact: { international_influence: 15, global_cooperation: 20, soft_power: 25 },
        enabled: true
      }
    ]
  },

  [ComponentType.BILATERAL_RELATIONS]: {
    component: ComponentType.BILATERAL_RELATIONS,
    departments: [
      {
        name: "Cultural Relations Bureau",
        category: "Foreign Affairs",
        functions: ["Cultural Programs", "Educational Exchange", "Cultural Diplomacy"],
        priority: 3,
        budgetPercent: 3,
        effectiveness: 65,
        description: "Promotes cultural exchange and international cultural relations"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 3,
        rationale: "Cultural exchange requires cultural programs and exchange resources"
      }
    ],
    policies: [
      {
        name: "Cultural Diplomacy",
        description: "Promotes national culture and values internationally",
        impact: { soft_power: 20, cultural_influence: 25, understanding: 15 },
        enabled: true
      }
    ]
  },

  [ComponentType.TRADE_AGREEMENTS]: {
    component: ComponentType.TRADE_AGREEMENTS,
    departments: [
      {
        name: "Trade Negotiation Office",
        category: "Foreign Affairs",
        functions: ["Trade Negotiations", "Trade Policy", "Economic Diplomacy"],
        priority: 2,
        budgetPercent: 5,
        effectiveness: 75,
        description: "Negotiates and manages international trade agreements"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 5,
        rationale: "Trade agreements require negotiation and policy expertise"
      }
    ],
    policies: [
      {
        name: "Strategic Trade Partnerships",
        description: "Comprehensive trade agreements with key partners",
        impact: { economic_growth: 20, trade_volume: 25, competitiveness: 15 },
        enabled: true
      }
    ]
  },

  [ComponentType.INTERNATIONAL_LAW]: {
    component: ComponentType.INTERNATIONAL_LAW,
    departments: [
      {
        name: "Environmental Diplomacy Office",
        category: "Foreign Affairs",
        functions: ["Climate Agreements", "Environmental Standards", "Green Technology Transfer"],
        priority: 3,
        budgetPercent: 4,
        effectiveness: 70,
        description: "Coordinates international environmental cooperation and agreements"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 4,
        rationale: "Environmental cooperation requires international coordination"
      }
    ],
    policies: [
      {
        name: "Global Environmental Leadership",
        description: "Active participation in international environmental agreements",
        impact: { environmental_protection: 25, international_influence: 15, sustainability: 20 },
        enabled: true
      }
    ]
  },

  [ComponentType.SECURITY_ALLIANCES]: {
    component: ComponentType.SECURITY_ALLIANCES,
    departments: [
      {
        name: "Alliance Coordination Office",
        category: "Foreign Affairs",
        functions: ["Military Cooperation", "Intelligence Sharing", "Joint Exercises"],
        priority: 2,
        budgetPercent: 6,
        effectiveness: 80,
        description: "Coordinates security alliances and military cooperation"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Security alliances require military and intelligence coordination"
      }
    ],
    policies: [
      {
        name: "Collective Security",
        description: "Participates in security alliances for mutual defense",
        impact: { security: 25, military_capability: 20, international_cooperation: 15 },
        enabled: true
      }
    ]
  },

  // Innovation and Development Components
  [ComponentType.RESEARCH_AND_DEVELOPMENT]: {
    component: ComponentType.RESEARCH_AND_DEVELOPMENT,
    departments: [
      {
        name: "Research and Development Agency",
        category: "Science and Technology",
        functions: ["Scientific Research", "Technology Development", "Innovation Funding"],
        priority: 2,
        budgetPercent: 10,
        effectiveness: 85,
        description: "Promotes scientific research and technological development"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 10,
        rationale: "R&D requires significant investment in research and development"
      }
    ],
    policies: [
      {
        name: "Innovation-Driven Economy",
        description: "Government investment in research and development",
        impact: { innovation: 30, competitiveness: 25, productivity: 20 },
        enabled: true
      }
    ]
  },

  [ComponentType.INNOVATION_ECOSYSTEM]: {
    component: ComponentType.INNOVATION_ECOSYSTEM,
    departments: [
      {
        name: "Entrepreneurship Development Office",
        category: "Science and Technology",
        functions: ["Startup Support", "Venture Capital", "Incubator Programs"],
        priority: 2,
        budgetPercent: 6,
        effectiveness: 75,
        description: "Supports startup ecosystem and entrepreneurial development"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Startup ecosystem requires support programs and funding"
      }
    ],
    policies: [
      {
        name: "Entrepreneurial Nation",
        description: "Comprehensive support for startups and entrepreneurs",
        impact: { innovation: 25, job_creation: 20, economic_dynamism: 30 },
        enabled: true
      }
    ]
  },

  [ComponentType.DIGITAL_INFRASTRUCTURE]: {
    component: ComponentType.DIGITAL_INFRASTRUCTURE,
    departments: [
      {
        name: "Infrastructure Development Authority",
        category: "Transportation",
        functions: ["Transportation Infrastructure", "Digital Infrastructure", "Utilities"],
        priority: 1,
        budgetPercent: 20,
        effectiveness: 80,
        description: "Manages large-scale infrastructure investment and development"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 20,
        rationale: "Infrastructure investment requires substantial capital expenditure"
      }
    ],
    policies: [
      {
        name: "Infrastructure-Led Growth",
        description: "Major investment in transportation and digital infrastructure",
        impact: { economic_growth: 25, connectivity: 30, competitiveness: 20 },
        enabled: true
      }
    ]
  },

  [ComponentType.TECHNOLOGY_TRANSFER]: {
    component: ComponentType.TECHNOLOGY_TRANSFER,
    departments: [
      {
        name: "Workforce Development Bureau",
        category: "Education",
        functions: ["Vocational Training", "Skills Assessment", "Career Development"],
        priority: 2,
        budgetPercent: 8,
        effectiveness: 75,
        description: "Develops workforce skills and vocational training programs"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Skill development requires training programs and assessment systems"
      }
    ],
    policies: [
      {
        name: "Lifelong Learning Society",
        description: "Continuous skill development and workforce training",
        impact: { human_capital: 25, productivity: 20, adaptability: 30 },
        enabled: true
      }
    ]
  },

  [ComponentType.ENTREPRENEURSHIP_SUPPORT]: {
    component: ComponentType.ENTREPRENEURSHIP_SUPPORT,
    departments: [
      {
        name: "Technology Integration Office",
        category: "Science and Technology",
        functions: ["Technology Transfer", "Digital Adoption", "Tech Training"],
        priority: 2,
        budgetPercent: 7,
        effectiveness: 80,
        description: "Promotes technology adoption across government and society"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 7,
        rationale: "Technology adoption requires training and integration support"
      }
    ],
    policies: [
      {
        name: "Technology-Enabled Society",
        description: "Widespread adoption of new technologies",
        impact: { productivity: 25, efficiency: 20, innovation: 15 },
        enabled: true
      }
    ]
  },

  [ComponentType.INTELLECTUAL_PROPERTY]: {
    component: ComponentType.INTELLECTUAL_PROPERTY,
    departments: [
      {
        name: "Innovation Investment Fund",
        category: "Science and Technology",
        functions: ["Innovation Grants", "Venture Investment", "Technology Commercialization"],
        priority: 2,
        budgetPercent: 8,
        effectiveness: 75,
        description: "Provides funding for innovation and technology development"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Innovation funding requires dedicated investment resources"
      }
    ],
    policies: [
      {
        name: "Innovation Investment Strategy",
        description: "Strategic investment in innovation and technology",
        impact: { innovation: 30, competitiveness: 25, economic_growth: 20 },
        enabled: true
      }
    ]
  },

  [ComponentType.STARTUP_INCUBATION]: {
    component: ComponentType.STARTUP_INCUBATION,
    departments: [
      {
        name: "Green Technology Bureau",
        category: "Science and Technology",
        functions: ["Renewable Energy", "Green Innovation", "Environmental Technology"],
        priority: 2,
        budgetPercent: 9,
        effectiveness: 80,
        description: "Promotes green technology and sustainable innovation"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 9,
        rationale: "Green technology requires investment in sustainable innovation"
      }
    ],
    policies: [
      {
        name: "Green Innovation Leadership",
        description: "Leadership in green technology and sustainable innovation",
        impact: { sustainability: 30, innovation: 20, environmental_protection: 25 },
        enabled: true
      }
    ]
  },

  [ComponentType.SMART_CITIES]: {
    component: ComponentType.SMART_CITIES,
    departments: [
      {
        name: "Digital Skills Development",
        category: "Education",
        functions: ["Digital Education", "Computer Literacy", "Online Skills Training"],
        priority: 2,
        budgetPercent: 5,
        effectiveness: 75,
        description: "Promotes digital literacy and computer skills education"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 5,
        rationale: "Digital literacy requires education and training programs"
      }
    ],
    policies: [
      {
        name: "Digitally Literate Society",
        description: "Comprehensive digital literacy education for all citizens",
        impact: { digital_inclusion: 25, productivity: 20, innovation: 15 },
        enabled: true
      }
    ]
  },

  // Crisis Management Components
  [ComponentType.EMERGENCY_RESPONSE]: {
    component: ComponentType.EMERGENCY_RESPONSE,
    departments: [
      {
        name: "Emergency Management Agency",
        category: "Defense",
        functions: ["Disaster Response", "Emergency Planning", "Crisis Coordination"],
        priority: 1,
        budgetPercent: 8,
        effectiveness: 85,
        description: "Coordinates emergency response and disaster management"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Emergency response requires specialized equipment and trained personnel"
      }
    ],
    policies: [
      {
        name: "Comprehensive Emergency Preparedness",
        description: "Robust emergency response and disaster management system",
        impact: { resilience: 30, public_safety: 25, crisis_response: 30 },
        enabled: true
      }
    ]
  },

  [ComponentType.DISASTER_PREPAREDNESS]: {
    component: ComponentType.DISASTER_PREPAREDNESS,
    departments: [
      {
        name: "Public Health Emergency Office",
        category: "Health",
        functions: ["Disease Surveillance", "Vaccination Programs", "Health Emergency Response"],
        priority: 1,
        budgetPercent: 6,
        effectiveness: 85,
        description: "Prepares for and responds to pandemic and health emergencies"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Pandemic preparedness requires health surveillance and response systems"
      }
    ],
    policies: [
      {
        name: "Global Health Security",
        description: "Comprehensive pandemic preparedness and response system",
        impact: { public_health: 30, resilience: 25, international_cooperation: 20 },
        enabled: true
      }
    ]
  },

  [ComponentType.PANDEMIC_MANAGEMENT]: {
    component: ComponentType.PANDEMIC_MANAGEMENT,
    departments: [
      {
        name: "Climate Adaptation Bureau",
        category: "Environment",
        functions: ["Climate Monitoring", "Adaptation Planning", "Resilience Building"],
        priority: 2,
        budgetPercent: 7,
        effectiveness: 75,
        description: "Develops climate adaptation strategies and resilience measures"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 7,
        rationale: "Climate adaptation requires monitoring and resilience infrastructure"
      }
    ],
    policies: [
      {
        name: "Climate-Resilient Nation",
        description: "Comprehensive climate adaptation and resilience strategy",
        impact: { resilience: 30, sustainability: 25, environmental_protection: 20 },
        enabled: true
      }
    ]
  },

  [ComponentType.CYBERSECURITY]: {
    component: ComponentType.CYBERSECURITY,
    departments: [
      {
        name: "Cybersecurity Agency",
        category: "Defense",
        functions: ["Cyber Defense", "Information Security", "Cyber Threat Monitoring"],
        priority: 1,
        budgetPercent: 8,
        effectiveness: 85,
        description: "Protects against cyber threats and ensures information security"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Cybersecurity requires specialized technology and expertise"
      }
    ],
    policies: [
      {
        name: "Cyber-Resilient Nation",
        description: "Comprehensive cybersecurity defense and information protection",
        impact: { security: 30, digital_resilience: 25, information_protection: 30 },
        enabled: true
      }
    ]
  },

  [ComponentType.COUNTER_TERRORISM]: {
    component: ComponentType.COUNTER_TERRORISM,
    departments: [
      {
        name: "Economic Stability Office",
        category: "Commerce",
        functions: ["Economic Monitoring", "Stabilization Policies", "Crisis Response"],
        priority: 2,
        budgetPercent: 6,
        effectiveness: 80,
        description: "Monitors economic stability and implements stabilization measures"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Economic stabilization requires monitoring and policy tools"
      }
    ],
    policies: [
      {
        name: "Economic Crisis Management",
        description: "Rapid response to economic crises and instability",
        impact: { economic_stability: 30, resilience: 25, crisis_response: 20 },
        enabled: true
      }
    ]
  },

  [ComponentType.CRISIS_COMMUNICATION]: {
    component: ComponentType.CRISIS_COMMUNICATION,
    departments: [
      {
        name: "Food Security Bureau",
        category: "Agriculture",
        functions: ["Food Production", "Supply Chain Management", "Food Distribution"],
        priority: 2,
        budgetPercent: 7,
        effectiveness: 80,
        description: "Ensures food security and sustainable food production"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 7,
        rationale: "Food security requires agricultural support and supply chain management"
      }
    ],
    policies: [
      {
        name: "Sustainable Food Security",
        description: "Comprehensive food security and sustainable agriculture system",
        impact: { food_security: 30, sustainability: 20, self_sufficiency: 25 },
        enabled: true
      }
    ]
  },

  [ComponentType.RECOVERY_PLANNING]: {
    component: ComponentType.RECOVERY_PLANNING,
    departments: [
      {
        name: "Recovery Planning Office",
        category: "Commerce",
        functions: ["Recovery Planning", "Post-Crisis Reconstruction", "Economic Recovery"],
        priority: 2,
        budgetPercent: 8,
        effectiveness: 80,
        description: "Plans and coordinates post-crisis recovery and reconstruction"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Recovery planning requires coordination and reconstruction resources"
      }
    ],
    policies: [
      {
        name: "Comprehensive Recovery Strategy",
        description: "Coordinated post-crisis recovery and reconstruction system",
        impact: { recovery_speed: 30, resilience: 25, reconstruction_efficiency: 20 },
        enabled: true
      }
    ]
  },

  [ComponentType.RESILIENCE_BUILDING]: {
    component: ComponentType.RESILIENCE_BUILDING,
    departments: [
      {
        name: "Resilience Building Bureau",
        category: "Social Services",
        functions: ["Resilience Assessment", "Capacity Building", "Risk Mitigation"],
        priority: 2,
        budgetPercent: 6,
        effectiveness: 75,
        description: "Builds resilience and adaptive capacity across society"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Resilience building requires capacity development and risk management"
      }
    ],
    policies: [
      {
        name: "Resilient Nation Initiative",
        description: "Comprehensive resilience building and adaptive capacity program",
        impact: { resilience: 30, adaptive_capacity: 25, risk_reduction: 20 },
        enabled: true
      }
    ]
  },

  // Missing Components
  [ComponentType.INSTITUTIONAL_LEGITIMACY]: {
    component: ComponentType.INSTITUTIONAL_LEGITIMACY,
    departments: [
      {
        name: "Institutional Affairs Office",
        category: "Interior",
        functions: ["Institutional Development", "Legitimacy Building", "Public Trust"],
        priority: 2,
        budgetPercent: 6,
        effectiveness: 80,
        description: "Builds institutional legitimacy and public trust"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Institutional legitimacy requires trust-building programs"
      }
    ],
    policies: [
      {
        name: "Institutional Trust Building",
        description: "Strengthens institutional legitimacy and public confidence",
        impact: { legitimacy: 25, trust: 20, institutional_stability: 30 },
        enabled: true
      }
    ]
  },

  [ComponentType.HUMANITARIAN_INTERVENTION]: {
    component: ComponentType.HUMANITARIAN_INTERVENTION,
    departments: [
      {
        name: "Humanitarian Affairs Bureau",
        category: "Foreign Affairs",
        functions: ["Humanitarian Aid", "Crisis Intervention", "International Relief"],
        priority: 3,
        budgetPercent: 5,
        effectiveness: 75,
        description: "Coordinates humanitarian interventions and aid"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 5,
        rationale: "Humanitarian intervention requires aid and relief resources"
      }
    ],
    policies: [
      {
        name: "Global Humanitarian Leadership",
        description: "Active humanitarian intervention and international relief",
        impact: { humanitarian_impact: 30, international_reputation: 25, global_cooperation: 20 },
        enabled: true
      }
    ]
  },

  // Governance Quality Components
  [ComponentType.ANTI_CORRUPTION]: {
    component: ComponentType.ANTI_CORRUPTION,
    departments: [
      {
        name: "Anti-Corruption Commission",
        category: "Justice",
        functions: ["Corruption Investigation", "Ethics Oversight", "Transparency Enforcement"],
        priority: 2,
        budgetPercent: 3,
        effectiveness: 85,
        description: "Independent body investigating and preventing corruption"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 3,
        rationale: "Anti-corruption efforts improve governance quality and public trust"
      }
    ],
    policies: [
      {
        name: "Zero Tolerance Anti-Corruption",
        description: "Strict enforcement of anti-corruption measures across all government levels",
        impact: { governance_quality: 25, public_trust: 30, transparency: 35 },
        enabled: true
      }
    ]
  },

  [ComponentType.TRANSPARENCY_INITIATIVE]: {
    component: ComponentType.TRANSPARENCY_INITIATIVE,
    departments: [
      {
        name: "Government Transparency Office",
        category: "Administration",
        functions: ["Open Data", "Public Disclosure", "Freedom of Information"],
        priority: 3,
        budgetPercent: 2,
        effectiveness: 80,
        description: "Ensures government transparency and public access to information"
      }
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 2,
        rationale: "Transparency initiatives build public trust and accountability"
      }
    ],
    policies: [
      {
        name: "Open Government Initiative",
        description: "Comprehensive transparency and open data policies",
        impact: { transparency: 40, public_trust: 25, civic_engagement: 20 },
        enabled: true
      }
    ]
  }
};

/**
 * Generate government builder state from atomic components
 */
export function generateGovernmentBuilderFromAtomicComponents(
  selectedComponents: ComponentType[],
  baseBudget: number,
  economicInputs: EconomicInputs
): GovernmentBuilderState {
  const departments: Array<{
    name: string;
    category: string;
    functions: string[];
    priority: number;
    effectiveness: number;
    description: string;
    icon: string;
    color: string;
    ministerTitle: string;
    organizationalLevel: string;
  }> = [];
  const budgetAllocations: Array<{
    departmentId: string;
    allocatedAmount: number;
    allocatedPercent: number;
    rationale: string;
    budgetYear: number;
  }> = [];
  const revenueSources: Array<{
    name: string;
    category: string;
    revenueAmount: number;
    rate?: number;
    collectionMethod: string;
    administeredBy: string;
  }> = [];
  
  let departmentIndex = 0;
  
  // Generate departments and budget allocations for each component
  selectedComponents.forEach(component => {
    const mapping = ATOMIC_TO_GOVERNMENT_MAPPING[component];
    if (mapping) {
      mapping.departments.forEach(dept => {
        const departmentId = departmentIndex.toString();
        
        departments.push({
          name: dept.name,
          category: dept.category,
          functions: dept.functions,
          priority: dept.priority,
          effectiveness: dept.effectiveness,
          description: dept.description,
          icon: getDepartmentIcon(dept.category),
          color: getDepartmentColor(dept.category),
          ministerTitle: `Minister of ${dept.category}`,
          organizationalLevel: 'Ministry'
        });
        
        // Find corresponding budget allocation
        const allocation = mapping.budgetAllocations.find(a => a.departmentId === departmentIndex.toString());
        if (allocation) {
          const allocatedAmount = (baseBudget * allocation.allocatedPercent) / 100;
          budgetAllocations.push({
            departmentId: departmentId,
            allocatedAmount: allocatedAmount,
            allocatedPercent: allocation.allocatedPercent,
            rationale: allocation.rationale,
            budgetYear: new Date().getFullYear()
          });
        }
        
        departmentIndex++;
      });
    }
  });
  
  // Calculate annual maintenance costs from atomic components
  const annualMaintenanceCost = selectedComponents.reduce((sum, comp) => {
    const component = ATOMIC_COMPONENTS[comp];
    return sum + (component?.maintenanceCost || 0);
  }, 0);

  // Adjust base budget to include annual maintenance costs
  const adjustedBudget = baseBudget + annualMaintenanceCost;

  // Generate revenue sources based on components
  const revenueSourcesList = generateRevenueSourcesFromComponents(selectedComponents, adjustedBudget);
  
  return {
    structure: {
      governmentName: `Government of ${economicInputs.countryName || 'Nation'}`,
      governmentType: determineGovernmentType(selectedComponents),
      totalBudget: adjustedBudget,
      fiscalYear: 'Calendar Year',
      budgetCurrency: economicInputs.nationalIdentity?.currency || 'USD'
    },
    departments: departments,
    budgetAllocations: budgetAllocations,
    revenueSources: revenueSourcesList,
    isValid: true,
    errors: { structure: [], departments: {}, budget: [], revenue: [] },
    atomicComponentCosts: {
      annualMaintenanceCost,
      implementationCost: selectedComponents.reduce((sum, comp) => sum + (ATOMIC_COMPONENTS[comp]?.implementationCost || 0), 0)
    }
  } as GovernmentBuilderState & { atomicComponentCosts: { annualMaintenanceCost: number; implementationCost: number } };
}

/**
 * Generate intelligent feedback based on atomic component selections
 */
export function generateAtomicIntegrationFeedback(
  selectedComponents: ComponentType[],
  currentGovernmentBuilder: GovernmentBuilderState | null,
  economicInputs: EconomicInputs
): AtomicIntegrationFeedback[] {
  const feedback: AtomicIntegrationFeedback[] = [];
  
  // Check for synergies
  const synergies = detectSynergies(selectedComponents);
  synergies.forEach(synergy => {
    feedback.push({
      type: 'success',
      title: 'Synergy Detected',
      message: `Components ${synergy.components.join(' + ')} create a powerful synergy effect (+${synergy.modifier}% effectiveness)`,
      actionable: false,
      impact: 'high'
    });
  });
  
  // Check for conflicts
  const conflicts = detectConflicts(selectedComponents);
  if (conflicts.length > 0) {
    // Group conflicts by type to reduce UI clutter
    const conflictGroups = new Map<string, { components: string[], penalties: number[] }>();
    
    conflicts.forEach(conflict => {
      const key = conflict.components.sort().join('+');
      if (!conflictGroups.has(key)) {
        conflictGroups.set(key, { components: conflict.components, penalties: [] });
      }
      conflictGroups.get(key)!.penalties.push(conflict.penalty);
    });

    conflictGroups.forEach((group, key) => {
      const avgPenalty = Math.round(group.penalties.reduce((a, b) => a + b, 0) / group.penalties.length);
      feedback.push({
        type: 'warning',
        title: 'Component Conflict Detected',
        message: `Components ${group.components.join(' and ')} are mutually exclusive (${avgPenalty}% effectiveness penalty)`,
        actionable: true,
        actionLabel: 'Review Components',
        impact: 'medium'
      });
    });
  }
  
  // Check if government builder needs updating
  if (currentGovernmentBuilder && !isGovernmentBuilderInSync(selectedComponents, currentGovernmentBuilder)) {
    feedback.push({
      type: 'info',
      title: 'Government Builder Update Available',
      message: 'Your atomic components have changed. Update your government builder to reflect these changes.',
      actionable: true,
      actionLabel: 'Update Government Builder',
      actionUrl: '/builder?section=government',
      impact: 'high'
    });
  }
  
  // Check for missing essential components
  const essentialComponents = getEssentialComponents(economicInputs);
  const missingEssential = essentialComponents.filter(comp => !selectedComponents.includes(comp));
  if (missingEssential.length > 0) {
    feedback.push({
      type: 'error',
      title: 'Essential Components Missing',
      message: `Consider adding: ${missingEssential.join(', ')} for better governance`,
      actionable: true,
      actionLabel: 'Add Components',
      impact: 'critical'
    });
  }
  
  return feedback;
}

/**
 * Detect synergies between atomic components
 */
function detectSynergies(components: ComponentType[]): Array<{components: string[], modifier: number}> {
  const synergies: Array<{components: string[], modifier: number}> = [];
  
  // Define synergy patterns
  const synergyPatterns = [
    {
      components: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.RULE_OF_LAW],
      modifier: 15,
      description: 'Democratic rule of law'
    },
    {
      components: [ComponentType.FEDERAL_SYSTEM, ComponentType.PROFESSIONAL_BUREAUCRACY],
      modifier: 12,
      description: 'Professional federal administration'
    },
    {
      components: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.PERFORMANCE_LEGITIMACY],
      modifier: 18,
      description: 'Evidence-based performance governance'
    }
  ];
  
  synergyPatterns.forEach(pattern => {
    if (pattern.components.every(comp => components.includes(comp))) {
      synergies.push({
        components: pattern.components,
        modifier: pattern.modifier
      });
    }
  });
  
  return synergies;
}

/**
 * Detect conflicts between atomic components
 */
function detectConflicts(components: ComponentType[]): Array<{components: string[], penalty: number}> {
  const conflicts: Array<{components: string[], penalty: number}> = [];
  
  // Define conflict patterns
  const conflictPatterns = [
    {
      components: [ComponentType.CENTRALIZED_POWER, ComponentType.FEDERAL_SYSTEM],
      penalty: 20,
      description: 'Centralized vs federal power'
    },
    {
      components: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.DEMOCRATIC_PROCESS],
      penalty: 25,
      description: 'Autocratic vs democratic processes'
    }
  ];
  
  conflictPatterns.forEach(pattern => {
    if (pattern.components.every(comp => components.includes(comp))) {
      conflicts.push({
        components: pattern.components,
        penalty: pattern.penalty
      });
    }
  });
  
  return conflicts;
}

/**
 * Check if government builder is in sync with atomic components
 */
function isGovernmentBuilderInSync(components: ComponentType[], governmentBuilder: GovernmentBuilderState): boolean {
  // Check if departments match expected departments from components
  const expectedDepartments = components.flatMap(comp => 
    ATOMIC_TO_GOVERNMENT_MAPPING[comp]?.departments.map(d => d.name) || []
  );
  
  const actualDepartments = governmentBuilder.departments.map(d => d.name);
  
  return expectedDepartments.every(dept => actualDepartments.includes(dept));
}

/**
 * Get essential components based on economic inputs
 */
function getEssentialComponents(economicInputs: EconomicInputs): ComponentType[] {
  const essential: ComponentType[] = [ComponentType.RULE_OF_LAW];
  
  // Add components based on economic characteristics
  if (economicInputs.coreIndicators.nominalGDP > 1000000000000) {
    essential.push(ComponentType.PROFESSIONAL_BUREAUCRACY);
  }
  
  if (economicInputs.governmentSpending.totalSpending > 100000000000) {
    essential.push(ComponentType.PERFORMANCE_LEGITIMACY);
  }
  
  return essential;
}

/**
 * Determine government type from atomic components
 */
function determineGovernmentType(components: ComponentType[]): GovernmentType {
  if (components.includes(ComponentType.DEMOCRATIC_PROCESS)) {
    if (components.includes(ComponentType.FEDERAL_SYSTEM)) {
      return 'Federal Republic';
    }
    return 'Parliamentary Democracy';
  }
  
  if (components.includes(ComponentType.AUTOCRATIC_PROCESS)) {
    return 'Unitary State';
  }
  
  if (components.includes(ComponentType.TECHNOCRATIC_PROCESS)) {
    return 'Unitary State';
  }
  
  return 'Constitutional Monarchy';
}

/**
 * Generate revenue sources based on components
 */
function generateRevenueSourcesFromComponents(components: ComponentType[], baseBudget: number): any[] {
  const revenueSources: any[] = [];
  
  // Base tax revenue
  revenueSources.push({
    name: 'General Tax Revenue',
    category: 'Direct Tax',
    revenueAmount: baseBudget * 0.6,
    rate: 20,
    collectionMethod: 'Annual Assessment',
    administeredBy: 'Tax Administration'
  });
  
  // Component-specific revenue sources
  if (components.includes(ComponentType.ECONOMIC_INCENTIVES)) {
    revenueSources.push({
      name: 'Market-Based Fees',
      category: 'Fees and Fines',
      revenueAmount: baseBudget * 0.15,
      collectionMethod: 'Service Fees',
      administeredBy: 'Economic Affairs Office'
    });
  }
  
  return revenueSources;
}

/**
 * Get department icon based on category
 */
function getDepartmentIcon(category: string): string {
  const iconMap: Record<string, string> = {
    'Administration': 'Building2',
    'Justice': 'Scale',
    'Defense': 'Shield',
    'Economics': 'TrendingUp',
    'Social Services': 'Users',
    'Culture': 'Palette',
    'Infrastructure': 'Building',
    'Security': 'Shield'
  };
  
  return iconMap[category] || 'Building2';
}

/**
 * Get department color based on category
 */
function getDepartmentColor(category: string): string {
  const colorMap: Record<string, string> = {
    'Administration': '#3b82f6',
    'Justice': '#8b5cf6',
    'Defense': '#ef4444',
    'Economics': '#10b981',
    'Social Services': '#f59e0b',
    'Culture': '#ec4899',
    'Infrastructure': '#6b7280',
    'Security': '#dc2626'
  };
  
  return colorMap[category] || '#3b82f6';
}

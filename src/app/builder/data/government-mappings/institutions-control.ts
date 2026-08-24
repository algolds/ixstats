import { ComponentType } from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";
import type { AtomicGovernmentMapping } from "./types";

export const institutions_control_mapping: Partial<Record<ComponentType, AtomicGovernmentMapping>> = {
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
          description: "Ensures electoral integrity and democratic legitimacy",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 8,
          rationale: "Essential for democratic legitimacy",
        },
      ],
      policies: [
        {
          name: "Free and Fair Elections",
          description: "Regular, free, and fair electoral processes",
          impact: { legitimacy: 45, accountability: 35, democraticParticipation: 40 },
          enabled: true,
        },
      ],
    },

    [ComponentType.TRADITIONAL_LEGITIMACY]: {
      component: ComponentType.TRADITIONAL_LEGITIMACY,
      departments: [
        {
          name: "Traditional Affairs Office",
          category: "Culture",
          functions: [
            "Traditional Authority Relations",
            "Cultural Preservation",
            "Traditional Governance",
          ],
          priority: 1,
          budgetPercent: 6,
          effectiveness: 75,
          description: "Maintains traditional authority and cultural legitimacy",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 6,
          rationale: "Support for traditional authority and cultural continuity",
        },
      ],
      policies: [
        {
          name: "Traditional Authority",
          description: "Recognition and integration of traditional authority",
          impact: { culturalContinuity: 40, socialStability: 30, traditionalLegitimacy: 45 },
          enabled: true,
        },
      ],
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
          description: "Monitors and reports on government performance",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 10,
          rationale: "Investment in performance measurement and accountability",
        },
      ],
      policies: [
        {
          name: "Results-Based Governance",
          description: "Government legitimacy based on performance and results",
          impact: { effectiveness: 40, accountability: 35, performanceCulture: 45 },
          enabled: true,
        },
      ],
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
          description: "Develops and supports charismatic leadership",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 7,
          rationale: "Investment in leadership development and vision",
        },
      ],
      policies: [
        {
          name: "Visionary Leadership",
          description: "Leadership based on charisma and vision",
          impact: { inspiration: 40, mobilization: 35, stability: -15, institutionalization: -20 },
          enabled: true,
        },
      ],
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
          description: "Manages religious affairs and moral guidance",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 8,
          rationale: "Support for religious legitimacy and moral guidance",
        },
      ],
      policies: [
        {
          name: "Religious Authority",
          description: "Integration of religious authority in governance",
          impact: { moralGuidance: 40, religiousLegitimacy: 45, pluralism: -20 },
          enabled: true,
        },
      ],
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
          description: "Military coordination and defense administration",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 15,
          rationale: "Strong military presence in administration",
        },
      ],
      policies: [
        {
          name: "Military Governance",
          description: "Military involvement in civil administration",
          impact: {
            security: 35,
            stability: 25,
            civilianControl: -30,
            democraticParticipation: -25,
          },
          enabled: true,
        },
      ],
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
          description: "Maintains judicial independence and constitutional review",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 12,
          rationale: "Essential for judicial independence and rule of law",
        },
      ],
      policies: [
        {
          name: "Judicial Independence",
          description: "Independent judiciary free from political interference",
          impact: { ruleOfLaw: 45, fairness: 40, checksAndBalances: 35 },
          enabled: true,
        },
      ],
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
          description: "Manages partisan aspects of government institutions",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 9,
          rationale: "Support for partisan political coordination",
        },
      ],
      policies: [
        {
          name: "Partisan Control",
          description: "Government institutions controlled by political parties",
          impact: { politicalCoherence: 30, accountability: -15, meritocracy: -25 },
          enabled: true,
        },
      ],
    },

    [ComponentType.TECHNOCRATIC_AGENCIES]: {
      component: ComponentType.TECHNOCRATIC_AGENCIES,
      departments: [
        {
          name: "Technical Agencies Office",
          category: "Administration",
          functions: [
            "Technical Expertise",
            "Specialized Administration",
            "Professional Management",
          ],
          priority: 1,
          budgetPercent: 11,
          effectiveness: 85,
          description: "Technical expertise and specialized administration",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 11,
          rationale: "Investment in technical expertise and professional management",
        },
      ],
      policies: [
        {
          name: "Technical Expertise",
          description: "Government by technical experts and professionals",
          impact: {
            competence: 40,
            efficiency: 35,
            scientificRigour: 30,
            democraticParticipation: -15,
          },
          enabled: true,
        },
      ],
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
          description: "Coordinates surveillance and monitoring activities",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 13,
          rationale: "Investment in surveillance and security capabilities",
        },
      ],
      policies: [
        {
          name: "Comprehensive Surveillance",
          description: "Extensive surveillance and monitoring systems",
          impact: { security: 35, control: 40, privacy: -35, freedom: -30 },
          enabled: true,
        },
      ],
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
          description: "Designs and manages economic incentive systems",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 10,
          rationale: "Investment in economic incentive systems",
        },
      ],
      policies: [
        {
          name: "Market-Based Governance",
          description: "Use of economic incentives to guide behavior",
          impact: { efficiency: 30, innovation: 25, marketOrientation: 35, equity: -20 },
          enabled: true,
        },
      ],
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
          description: "Promotes social cohesion and community pressure",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 8,
          rationale: "Investment in social cohesion and community building",
        },
      ],
      policies: [
        {
          name: "Social Governance",
          description: "Governance through social pressure and community norms",
          impact: {
            socialCohesion: 35,
            communityEngagement: 30,
            socialControl: 25,
            individualFreedom: -20,
          },
          enabled: true,
        },
      ],
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
          description: "Military-based law enforcement and security",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 14,
          rationale: "Strong military presence in law enforcement",
        },
      ],
      policies: [
        {
          name: "Military Law Enforcement",
          description: "Military involvement in law enforcement and security",
          impact: { security: 40, order: 35, civilianRights: -25, democraticControl: -30 },
          enabled: true,
        },
      ],
    }
};
};

import { ComponentType } from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";
import type { AtomicGovernmentMapping } from "./types";

export const social_policy_mapping: Partial<Record<ComponentType, AtomicGovernmentMapping>> = {
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
          description: "Comprehensive social safety net and welfare programs",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 25,
          rationale: "Welfare state requires substantial social spending",
        },
      ],
      policies: [
        {
          name: "Universal Social Protection",
          description: "Comprehensive social safety net for all citizens",
          impact: { social_cohesion: 30, equality: 25, economic_freedom: -15 },
          enabled: true,
        },
      ],
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
          description: "Comprehensive healthcare system and public health services",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 18,
          rationale: "Healthcare system requires significant investment",
        },
      ],
      policies: [
        {
          name: "Universal Healthcare",
          description: "Healthcare accessible to all citizens",
          impact: { public_health: 30, equality: 20, productivity: 15 },
          enabled: true,
        },
      ],
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
          description: "Comprehensive education system from primary to higher education",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 15,
          rationale: "Education system requires substantial investment",
        },
      ],
      policies: [
        {
          name: "Universal Education",
          description: "Education accessible to all citizens",
          impact: { human_capital: 30, innovation: 20, equality: 25 },
          enabled: true,
        },
      ],
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
          description: "Provides affordable housing and urban development services",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 8,
          rationale: "Affordable housing requires significant infrastructure investment",
        },
      ],
      policies: [
        {
          name: "Housing for All",
          description: "Affordable housing accessible to all citizens",
          impact: { social_cohesion: 20, equality: 15, urban_development: 25 },
          enabled: true,
        },
      ],
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
          description: "Comprehensive child care and early childhood development services",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 6,
          rationale: "Child care services require specialized facilities and staff",
        },
      ],
      policies: [
        {
          name: "Universal Child Care",
          description: "Child care accessible to all families",
          impact: { gender_equality: 25, workforce_participation: 20, child_development: 30 },
          enabled: true,
        },
      ],
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
          description: "Comprehensive care and support for elderly citizens",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 10,
          rationale: "Elderly care requires specialized facilities and healthcare",
        },
      ],
      policies: [
        {
          name: "Comprehensive Elderly Support",
          description: "Complete care system for elderly citizens",
          impact: { social_cohesion: 20, dignity: 25, family_support: 15 },
          enabled: true,
        },
      ],
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
          description: "Support services and accessibility for citizens with disabilities",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 5,
          rationale: "Disability support requires specialized services and accessibility",
        },
      ],
      policies: [
        {
          name: "Inclusive Society",
          description: "Full inclusion and support for citizens with disabilities",
          impact: { inclusion: 30, dignity: 25, accessibility: 20 },
          enabled: true,
        },
      ],
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
          description: "Comprehensive mental health services and support programs",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 7,
          rationale: "Mental health services require specialized treatment and facilities",
        },
      ],
      policies: [
        {
          name: "Mental Health for All",
          description: "Mental health services accessible to all citizens",
          impact: { public_health: 25, productivity: 20, social_cohesion: 15 },
          enabled: true,
        },
      ],
    }
};

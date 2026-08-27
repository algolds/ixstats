import { ComponentType } from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";
import type { AtomicGovernmentMapping } from "./types";

export const crisis_governance_mapping: Partial<Record<ComponentType, AtomicGovernmentMapping>> = {
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
          description: "Coordinates emergency response and disaster management",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 8,
          rationale: "Emergency response requires specialized equipment and trained personnel",
        },
      ],
      policies: [
        {
          name: "Comprehensive Emergency Preparedness",
          description: "Robust emergency response and disaster management system",
          impact: { resilience: 30, public_safety: 25, crisis_response: 30 },
          enabled: true,
        },
      ],
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
          description: "Prepares for and responds to pandemic and health emergencies",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 6,
          rationale: "Pandemic preparedness requires health surveillance and response systems",
        },
      ],
      policies: [
        {
          name: "Global Health Security",
          description: "Comprehensive pandemic preparedness and response system",
          impact: { public_health: 30, resilience: 25, international_cooperation: 20 },
          enabled: true,
        },
      ],
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
          description: "Develops climate adaptation strategies and resilience measures",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 7,
          rationale: "Climate adaptation requires monitoring and resilience infrastructure",
        },
      ],
      policies: [
        {
          name: "Climate-Resilient Nation",
          description: "Comprehensive climate adaptation and resilience strategy",
          impact: { resilience: 30, sustainability: 25, environmental_protection: 20 },
          enabled: true,
        },
      ],
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
          description: "Protects against cyber threats and ensures information security",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 8,
          rationale: "Cybersecurity requires specialized technology and expertise",
        },
      ],
      policies: [
        {
          name: "Cyber-Resilient Nation",
          description: "Comprehensive cybersecurity defense and information protection",
          impact: { security: 30, digital_resilience: 25, information_protection: 30 },
          enabled: true,
        },
      ],
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
          description: "Monitors economic stability and implements stabilization measures",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 6,
          rationale: "Economic stabilization requires monitoring and policy tools",
        },
      ],
      policies: [
        {
          name: "Economic Crisis Management",
          description: "Rapid response to economic crises and instability",
          impact: { economic_stability: 30, resilience: 25, crisis_response: 20 },
          enabled: true,
        },
      ],
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
          description: "Ensures food security and sustainable food production",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 7,
          rationale: "Food security requires agricultural support and supply chain management",
        },
      ],
      policies: [
        {
          name: "Sustainable Food Security",
          description: "Comprehensive food security and sustainable agriculture system",
          impact: { food_security: 30, sustainability: 20, self_sufficiency: 25 },
          enabled: true,
        },
      ],
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
          description: "Plans and coordinates post-crisis recovery and reconstruction",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 8,
          rationale: "Recovery planning requires coordination and reconstruction resources",
        },
      ],
      policies: [
        {
          name: "Comprehensive Recovery Strategy",
          description: "Coordinated post-crisis recovery and reconstruction system",
          impact: { recovery_speed: 30, resilience: 25, reconstruction_efficiency: 20 },
          enabled: true,
        },
      ],
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
          description: "Builds resilience and adaptive capacity across society",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 6,
          rationale: "Resilience building requires capacity development and risk management",
        },
      ],
      policies: [
        {
          name: "Resilient Nation Initiative",
          description: "Comprehensive resilience building and adaptive capacity program",
          impact: { resilience: 30, adaptive_capacity: 25, risk_reduction: 20 },
          enabled: true,
        },
      ],
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
          description: "Builds institutional legitimacy and public trust",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 6,
          rationale: "Institutional legitimacy requires trust-building programs",
        },
      ],
      policies: [
        {
          name: "Institutional Trust Building",
          description: "Strengthens institutional legitimacy and public confidence",
          impact: { legitimacy: 25, trust: 20, institutional_stability: 30 },
          enabled: true,
        },
      ],
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
          description: "Coordinates humanitarian interventions and aid",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 5,
          rationale: "Humanitarian intervention requires aid and relief resources",
        },
      ],
      policies: [
        {
          name: "Global Humanitarian Leadership",
          description: "Active humanitarian intervention and international relief",
          impact: { humanitarian_impact: 30, international_reputation: 25, global_cooperation: 20 },
          enabled: true,
        },
      ],
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
          description: "Independent body investigating and preventing corruption",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 3,
          rationale: "Anti-corruption efforts improve governance quality and public trust",
        },
      ],
      policies: [
        {
          name: "Zero Tolerance Anti-Corruption",
          description:
            "Strict enforcement of anti-corruption measures across all government levels",
          impact: { governance_quality: 25, public_trust: 30, transparency: 35 },
          enabled: true,
        },
      ],
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
          description: "Ensures government transparency and public access to information",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 2,
          rationale: "Transparency initiatives build public trust and accountability",
        },
      ],
      policies: [
        {
          name: "Open Government Initiative",
          description: "Comprehensive transparency and open data policies",
          impact: { transparency: 40, public_trust: 25, civic_engagement: 20 },
          enabled: true,
        },
      ],
    }
};

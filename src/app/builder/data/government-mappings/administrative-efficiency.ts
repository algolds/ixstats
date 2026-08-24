import { ComponentType } from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";
import type { AtomicGovernmentMapping } from "./types";

export const administrative_efficiency_mapping: Partial<Record<ComponentType, AtomicGovernmentMapping>> = {
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
          description: "Provides digital government services and infrastructure",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 8,
          rationale: "Digital government requires technology investment",
        },
      ],
      policies: [
        {
          name: "Digital Transformation",
          description: "Government services delivered digitally",
          impact: { efficiency: 25, accessibility: 20, transparency: 15 },
          enabled: true,
        },
      ],
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
          description: "Streamlines government processes and reduces bureaucracy",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 6,
          rationale: "Streamlined bureaucracy reduces administrative costs",
        },
      ],
      policies: [
        {
          name: "Administrative Simplification",
          description: "Reduces bureaucratic complexity and improves efficiency",
          impact: { efficiency: 20, responsiveness: 15, citizen_satisfaction: 10 },
          enabled: true,
        },
      ],
    },

    [ComponentType.E_GOVERNANCE]: {
      component: ComponentType.E_GOVERNANCE,
      departments: [
        {
          name: "Local Government Coordination",
          category: "Interior",
          functions: [
            "Local Autonomy Support",
            "Regional Coordination",
            "Subsidiarity Implementation",
          ],
          priority: 3,
          budgetPercent: 7,
          effectiveness: 75,
          description: "Supports decentralized administrative functions",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 7,
          rationale: "Decentralized administration requires coordination support",
        },
      ],
      policies: [
        {
          name: "Subsidiarity Principle",
          description: "Decisions made at the most appropriate level",
          impact: { responsiveness: 20, local_autonomy: 25, efficiency: -5 },
          enabled: true,
        },
      ],
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
          description: "Ensures merit-based hiring and promotion in civil service",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 4,
          rationale: "Merit-based systems require robust HR infrastructure",
        },
      ],
      policies: [
        {
          name: "Meritocratic Recruitment",
          description: "Hiring based on qualifications and performance",
          impact: { competence: 25, efficiency: 15, corruption: -20 },
          enabled: true,
        },
      ],
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
          description: "Monitors and evaluates government performance",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 5,
          rationale: "Performance monitoring requires data collection and analysis",
        },
      ],
      policies: [
        {
          name: "Results-Based Management",
          description: "Government performance measured by outcomes",
          impact: { accountability: 20, efficiency: 15, transparency: 10 },
          enabled: true,
        },
      ],
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
          description: "Enables rapid government decision-making and response",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 6,
          rationale: "Quick decision-making requires streamlined processes",
        },
      ],
      policies: [
        {
          name: "Accelerated Decision Processes",
          description: "Reduces time for government decisions and responses",
          impact: { responsiveness: 25, flexibility: 20, stability: -5 },
          enabled: true,
        },
      ],
    },

    [ComponentType.RISK_MANAGEMENT]: {
      component: ComponentType.RISK_MANAGEMENT,
      departments: [
        {
          name: "Cross-Agency Coordination Office",
          category: "Interior",
          functions: [
            "Inter-Agency Communication",
            "Joint Project Management",
            "Policy Coordination",
          ],
          priority: 2,
          budgetPercent: 7,
          effectiveness: 70,
          description: "Coordinates activities across government agencies",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 7,
          rationale: "Inter-agency coordination requires dedicated resources",
        },
      ],
      policies: [
        {
          name: "Whole-of-Government Approach",
          description: "Coordination across all government agencies",
          impact: { coordination: 25, efficiency: 15, duplication: -20 },
          enabled: true,
        },
      ],
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
          description: "Collects and processes citizen feedback on government services",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 4,
          rationale: "Citizen feedback systems require engagement infrastructure",
        },
      ],
      policies: [
        {
          name: "Participatory Governance",
          description: "Citizens provide feedback on government services",
          impact: { responsiveness: 20, citizen_satisfaction: 25, accountability: 15 },
          enabled: true,
        },
      ],
    }
};

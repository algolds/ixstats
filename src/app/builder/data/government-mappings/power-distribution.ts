import { ComponentType } from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";
import type { AtomicGovernmentMapping } from "./types";

export const power_distribution_mapping: Partial<Record<ComponentType, AtomicGovernmentMapping>> = {
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
        description: "Central authority for all policy coordination and strategic planning",
      },
      {
        name: "National Coordination Bureau",
        category: "Administration",
        functions: ["Inter-agency Coordination", "Implementation Oversight"],
        priority: 2,
        budgetPercent: 10,
        effectiveness: 85,
        description: "Coordinates implementation across all government agencies",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 15,
        rationale: "High priority for centralized planning and coordination",
      },
      {
        departmentId: "1",
        allocatedAmount: 0,
        allocatedPercent: 10,
        rationale: "Essential for maintaining centralized control",
      },
    ],
    policies: [
      {
        name: "Centralized Decision Making",
        description: "All major decisions flow through central authority",
        impact: { efficiency: 25, responsiveness: -15, transparency: -10 },
        enabled: true,
      },
      {
        name: "Unified Policy Framework",
        description: "Single policy framework across all departments",
        impact: { consistency: 30, flexibility: -20 },
        enabled: true,
      },
    ],
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
        description: "Manages relations between federal and regional governments",
      },
      {
        name: "Regional Development Agency",
        category: "Infrastructure",
        functions: ["Regional Planning", "Infrastructure Development", "Regional Coordination"],
        priority: 2,
        budgetPercent: 18,
        effectiveness: 75,
        description: "Coordinates development across federal regions",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 12,
        rationale: "Essential for federal coordination",
      },
      {
        departmentId: "1",
        allocatedAmount: 0,
        allocatedPercent: 18,
        rationale: "Supports regional development and equity",
      },
    ],
    policies: [
      {
        name: "Subsidiarity Principle",
        description: "Decisions made at the most appropriate level of government",
        impact: { efficiency: 15, responsiveness: 20, accountability: 25 },
        enabled: true,
      },
      {
        name: "Regional Autonomy",
        description: "Regional governments have significant autonomy",
        impact: { diversity: 30, innovation: 20, coordination: -10 },
        enabled: true,
      },
    ],
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
        description: "Manages all electoral processes and voter engagement",
      },
      {
        name: "Citizen Engagement Office",
        category: "Social Services",
        functions: ["Public Consultation", "Civic Education", "Participatory Processes"],
        priority: 2,
        budgetPercent: 6,
        effectiveness: 75,
        description: "Promotes citizen participation in governance",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Essential for democratic legitimacy",
      },
      {
        departmentId: "1",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Supports democratic participation",
      },
    ],
    policies: [
      {
        name: "Regular Elections",
        description: "Regular, free, and fair elections for all positions",
        impact: { legitimacy: 40, accountability: 30, stability: 15 },
        enabled: true,
      },
      {
        name: "Public Consultation",
        description: "Systematic public consultation on major policies",
        impact: { responsiveness: 25, transparency: 30, efficiency: -10 },
        enabled: true,
      },
    ],
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
        description: "Ensures legal framework and constitutional compliance",
      },
      {
        name: "Ombudsman Office",
        category: "Justice",
        functions: [
          "Administrative Oversight",
          "Citizen Rights Protection",
          "Complaint Resolution",
        ],
        priority: 2,
        budgetPercent: 5,
        effectiveness: 80,
        description: "Protects citizen rights and ensures administrative fairness",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 10,
        rationale: "Foundation for all other government functions",
      },
      {
        departmentId: "1",
        allocatedAmount: 0,
        allocatedPercent: 5,
        rationale: "Essential for citizen protection and rights",
      },
    ],
    policies: [
      {
        name: "Legal Certainty",
        description: "Clear, consistent, and predictable legal framework",
        impact: { stability: 35, predictability: 40, investment: 25 },
        enabled: true,
      },
      {
        name: "Equal Protection",
        description: "Equal treatment under the law for all citizens",
        impact: { fairness: 45, socialCohesion: 30, legitimacy: 25 },
        enabled: true,
      },
    ],
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
        description: "Manages professional civil service recruitment and development",
      },
      {
        name: "Administrative Efficiency Office",
        category: "Administration",
        functions: ["Process Optimization", "Digital Services", "Performance Monitoring"],
        priority: 2,
        budgetPercent: 8,
        effectiveness: 80,
        description: "Optimizes government processes and service delivery",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 12,
        rationale: "Investment in human capital and expertise",
      },
      {
        departmentId: "1",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Continuous improvement and modernization",
      },
    ],
    policies: [
      {
        name: "Merit-Based Recruitment",
        description: "Hiring based on qualifications and merit",
        impact: { competence: 40, efficiency: 30, fairness: 25 },
        enabled: true,
      },
      {
        name: "Performance Management",
        description: "Systematic performance evaluation and improvement",
        impact: { productivity: 35, accountability: 30, quality: 25 },
        enabled: true,
      },
    ],
  },

  // Add more components as needed...
  [ComponentType.CONFEDERATE_SYSTEM]: {
    component: ComponentType.CONFEDERATE_SYSTEM,
    departments: [
      {
        name: "Confederation Coordination Office",
        category: "Administration",
        functions: [
          "Inter-regional Coordination",
          "Consensus Building",
          "Limited Central Services",
        ],
        priority: 1,
        budgetPercent: 8,
        effectiveness: 70,
        description: "Minimal central coordination for confederate system",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Minimal central authority in confederate system",
      },
    ],
    policies: [
      {
        name: "Regional Autonomy",
        description: "Maximum autonomy for regional governments",
        impact: { diversity: 40, localResponsiveness: 35, coordination: -25 },
        enabled: true,
      },
    ],
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
        description: "Centralized administration with local implementation",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 14,
        rationale: "Unified national administration",
      },
    ],
    policies: [
      {
        name: "Uniform Standards",
        description: "Consistent standards across all regions",
        impact: { consistency: 40, efficiency: 25, equity: 30 },
        enabled: true,
      },
    ],
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
        description: "Centralized executive decision making",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 16,
        rationale: "Strong executive control and rapid decision making",
      },
    ],
    policies: [
      {
        name: "Executive Authority",
        description: "Concentrated executive power for rapid decisions",
        impact: { speed: 40, stability: 25, responsiveness: 30, accountability: -20 },
        enabled: true,
      },
    ],
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
        description: "Technical expertise for policy formulation",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 10,
        rationale: "Investment in technical expertise and evidence-based policy",
      },
    ],
    policies: [
      {
        name: "Evidence-Based Policy",
        description: "Policies based on technical analysis and evidence",
        impact: { effectiveness: 35, innovation: 30, scientificRigour: 40 },
        enabled: true,
      },
    ],
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
        description: "Facilitates consensus building and stakeholder engagement",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 9,
        rationale: "Investment in consensus building and stakeholder engagement",
      },
    ],
    policies: [
      {
        name: "Consensus Decision Making",
        description: "Decisions require broad consensus among stakeholders",
        impact: { legitimacy: 35, inclusiveness: 40, stability: 30, speed: -25 },
        enabled: true,
      },
    ],
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
        description: "Coordination among elite decision makers",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 7,
        rationale: "Limited elite coordination structure",
      },
    ],
    policies: [
      {
        name: "Elite Governance",
        description: "Governance by a small elite group",
        impact: { efficiency: 20, stability: 15, legitimacy: -30, inclusiveness: -40 },
        enabled: true,
      },
    ],
  },
};

import { ComponentType } from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";
import type { AtomicGovernmentMapping } from "./types";

export const innovation_development_mapping: Partial<Record<ComponentType, AtomicGovernmentMapping>> = {
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
          description: "Promotes scientific research and technological development",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 10,
          rationale: "R&D requires significant investment in research and development",
        },
      ],
      policies: [
        {
          name: "Innovation-Driven Economy",
          description: "Government investment in research and development",
          impact: { innovation: 30, competitiveness: 25, productivity: 20 },
          enabled: true,
        },
      ],
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
          description: "Supports startup ecosystem and entrepreneurial development",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 6,
          rationale: "Startup ecosystem requires support programs and funding",
        },
      ],
      policies: [
        {
          name: "Entrepreneurial Nation",
          description: "Comprehensive support for startups and entrepreneurs",
          impact: { innovation: 25, job_creation: 20, economic_dynamism: 30 },
          enabled: true,
        },
      ],
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
          description: "Manages large-scale infrastructure investment and development",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 20,
          rationale: "Infrastructure investment requires substantial capital expenditure",
        },
      ],
      policies: [
        {
          name: "Infrastructure-Led Growth",
          description: "Major investment in transportation and digital infrastructure",
          impact: { economic_growth: 25, connectivity: 30, competitiveness: 20 },
          enabled: true,
        },
      ],
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
          description: "Develops workforce skills and vocational training programs",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 8,
          rationale: "Skill development requires training programs and assessment systems",
        },
      ],
      policies: [
        {
          name: "Lifelong Learning Society",
          description: "Continuous skill development and workforce training",
          impact: { human_capital: 25, productivity: 20, adaptability: 30 },
          enabled: true,
        },
      ],
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
          description: "Promotes technology adoption across government and society",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 7,
          rationale: "Technology adoption requires training and integration support",
        },
      ],
      policies: [
        {
          name: "Technology-Enabled Society",
          description: "Widespread adoption of new technologies",
          impact: { productivity: 25, efficiency: 20, innovation: 15 },
          enabled: true,
        },
      ],
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
          description: "Provides funding for innovation and technology development",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 8,
          rationale: "Innovation funding requires dedicated investment resources",
        },
      ],
      policies: [
        {
          name: "Innovation Investment Strategy",
          description: "Strategic investment in innovation and technology",
          impact: { innovation: 30, competitiveness: 25, economic_growth: 20 },
          enabled: true,
        },
      ],
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
          description: "Promotes green technology and sustainable innovation",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 9,
          rationale: "Green technology requires investment in sustainable innovation",
        },
      ],
      policies: [
        {
          name: "Green Innovation Leadership",
          description: "Leadership in green technology and sustainable innovation",
          impact: { sustainability: 30, innovation: 20, environmental_protection: 25 },
          enabled: true,
        },
      ],
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
          description: "Promotes digital literacy and computer skills education",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 5,
          rationale: "Digital literacy requires education and training programs",
        },
      ],
      policies: [
        {
          name: "Digitally Literate Society",
          description: "Comprehensive digital literacy education for all citizens",
          impact: { digital_inclusion: 25, productivity: 20, innovation: 15 },
          enabled: true,
        },
      ],
    }
};

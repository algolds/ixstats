/**
 * Diplomatic Policy Templates
 *
 * Pre-defined policy templates for diplomatic operations that can be used
 * in the policy creation system or quick actions.
 */

export interface DiplomaticPolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: "trade" | "cultural" | "embassy" | "relationship";
  difficulty: "easy" | "moderate" | "complex";
  estimatedDuration: string;
  estimatedCost: number;
  objectives: string[];
  impact: {
    diplomatic: number; // -100 to 100
    economic: number;
    social: number;
    governance: number;
  };
  requirements: string[];
  suggestedMetrics: Array<{
    name: string;
    targetValue: number;
    timeframe: string;
  }>;
  suggestedActions: string[];
  risks: string[];
  benefits: string[];
}

export const DIPLOMATIC_POLICY_TEMPLATES: DiplomaticPolicyTemplate[] = [
  // Trade Agreement Framework
  {
    id: "trade-agreement-framework",
    name: "Bilateral Trade Agreement Framework",
    description:
      "Establish a comprehensive trade agreement with a partner nation, reducing tariffs and streamlining customs procedures to boost bilateral trade volume.",
    category: "trade",
    difficulty: "complex",
    estimatedDuration: "6-12 months",
    estimatedCost: 500000,
    objectives: [
      "Reduce import/export tariffs by 25-50%",
      "Streamline customs clearance procedures",
      "Establish dispute resolution mechanisms",
      "Create joint economic committee",
      "Increase bilateral trade volume by 30%",
    ],
    impact: {
      diplomatic: 25,
      economic: 35,
      social: 5,
      governance: 10,
    },
    requirements: [
      "Active embassy with partner country",
      "Relationship strength of at least 50",
      "No active trade disputes",
      "Approval from economic ministry",
    ],
    suggestedMetrics: [
      {
        name: "Bilateral trade volume",
        targetValue: 130,
        timeframe: "12 months",
      },
      {
        name: "Average tariff rate",
        targetValue: 50,
        timeframe: "6 months",
      },
      {
        name: "Customs processing time",
        targetValue: 70,
        timeframe: "6 months",
      },
    ],
    suggestedActions: [
      "Conduct trade impact assessment",
      "Establish negotiation team",
      "Schedule preliminary talks",
      "Draft agreement framework",
      "Conduct public consultations",
      "Finalize and sign agreement",
      "Ratify in parliament",
      "Implement customs changes",
    ],
    risks: [
      "Domestic industry opposition",
      "Political backlash if jobs are lost",
      "Partner country may not reciprocate equally",
      "Currency fluctuations affecting trade balance",
    ],
    benefits: [
      "Increased export opportunities",
      "Lower consumer prices for imports",
      "Stronger diplomatic ties",
      "Economic growth stimulus",
      "Job creation in export sectors",
    ],
  },

  // Cultural Exchange Policy
  {
    id: "cultural-exchange-policy",
    name: "National Cultural Exchange Program",
    description:
      "Launch a comprehensive cultural exchange program prioritizing arts, education, and people-to-people connections to strengthen diplomatic goodwill.",
    category: "cultural",
    difficulty: "moderate",
    estimatedDuration: "3-6 months",
    estimatedCost: 250000,
    objectives: [
      "Establish student exchange programs with 5+ countries",
      "Host 10+ cultural events annually",
      "Create artist-in-residence programs",
      "Increase cultural awareness by 40%",
      "Boost diplomatic relationships by 15 points",
    ],
    impact: {
      diplomatic: 30,
      economic: 10,
      social: 25,
      governance: 5,
    },
    requirements: [
      "At least 3 active embassies",
      "Cultural affairs budget allocation",
      "Partner country interest confirmed",
    ],
    suggestedMetrics: [
      {
        name: "Student exchanges",
        targetValue: 100,
        timeframe: "12 months",
      },
      {
        name: "Cultural events hosted",
        targetValue: 10,
        timeframe: "12 months",
      },
      {
        name: "Public engagement",
        targetValue: 5000,
        timeframe: "12 months",
      },
    ],
    suggestedActions: [
      "Survey partner countries for interest",
      "Allocate budget for exchanges",
      "Create cultural committee",
      "Design exchange programs",
      "Launch marketing campaign",
      "Host inaugural cultural festival",
      "Establish ongoing program management",
    ],
    risks: [
      "Low participation rates",
      "Cultural misunderstandings",
      "Budget overruns",
      "Political opposition to foreign cultural influence",
    ],
    benefits: [
      "Enhanced soft power",
      "Increased tourism",
      "Educational enrichment",
      "Strengthened people-to-people ties",
      "Long-term diplomatic dividends",
    ],
  },

  // Embassy Expansion Strategy
  {
    id: "embassy-expansion-strategy",
    name: "Strategic Embassy Network Expansion",
    description:
      "Systematically expand embassy network to target regions, establishing diplomatic presence in key strategic, economic, and cultural partner nations.",
    category: "embassy",
    difficulty: "complex",
    estimatedDuration: "12-24 months",
    estimatedCost: 1500000,
    objectives: [
      "Establish embassies in 5 strategic countries",
      "Achieve 80% embassy coverage in target region",
      "Increase diplomatic influence by 40%",
      "Create hub-and-spoke embassy model",
      "Optimize embassy operational costs",
    ],
    impact: {
      diplomatic: 45,
      economic: 20,
      social: 10,
      governance: 15,
    },
    requirements: [
      "Diplomatic budget of at least $2M",
      "Foreign ministry approval",
      "Identified target countries with relationship strength >40",
      "Parliamentary authorization",
    ],
    suggestedMetrics: [
      {
        name: "Active embassies",
        targetValue: 10,
        timeframe: "24 months",
      },
      {
        name: "Regional coverage",
        targetValue: 80,
        timeframe: "24 months",
      },
      {
        name: "Diplomatic influence score",
        targetValue: 75,
        timeframe: "18 months",
      },
    ],
    suggestedActions: [
      "Conduct strategic analysis of target regions",
      "Prioritize countries by strategic value",
      "Negotiate establishment agreements",
      "Secure embassy properties",
      "Recruit and train diplomatic staff",
      "Open embassies in phases",
      "Evaluate and optimize network",
    ],
    risks: [
      "High upfront and recurring costs",
      "Staffing challenges",
      "Security concerns in certain regions",
      "Host country approval delays",
      "Maintenance budget strain",
    ],
    benefits: [
      "Enhanced global presence",
      "Improved intelligence gathering",
      "Greater trade opportunities",
      "Stronger crisis response capability",
      "Increased international influence",
    ],
  },

  // Relationship Improvement Plan
  {
    id: "relationship-improvement-plan",
    name: "Diplomatic Relationship Rehabilitation",
    description:
      "Comprehensive plan to improve strained or weak diplomatic relationships through targeted missions, exchanges, trade, and high-level engagement.",
    category: "relationship",
    difficulty: "moderate",
    estimatedDuration: "6-12 months",
    estimatedCost: 400000,
    objectives: [
      "Improve relationship strength by 30+ points",
      "Resolve outstanding diplomatic issues",
      "Increase mutual trust and cooperation",
      "Establish regular high-level dialogue",
      "Create joint initiatives",
    ],
    impact: {
      diplomatic: 40,
      economic: 15,
      social: 10,
      governance: 10,
    },
    requirements: [
      "Relationship strength below 60",
      "No active conflicts or sanctions",
      "Both countries willing to engage",
      "Clear diplomatic objectives",
    ],
    suggestedMetrics: [
      {
        name: "Relationship strength",
        targetValue: 70,
        timeframe: "12 months",
      },
      {
        name: "High-level meetings",
        targetValue: 4,
        timeframe: "12 months",
      },
      {
        name: "Joint initiatives",
        targetValue: 2,
        timeframe: "12 months",
      },
    ],
    suggestedActions: [
      "Conduct relationship audit",
      "Identify key issues and grievances",
      "Propose confidence-building measures",
      "Launch diplomatic missions",
      "Host cultural exchanges",
      "Negotiate trade agreements",
      "Schedule summit meetings",
      "Create joint working groups",
    ],
    risks: [
      "Historical grievances resurface",
      "Domestic political opposition",
      "Partner country not reciprocating",
      "Public skepticism",
      "Slow progress leading to frustration",
    ],
    benefits: [
      "Regional stability",
      "Economic cooperation opportunities",
      "Enhanced security",
      "Reduced tension",
      "Long-term partnership potential",
    ],
  },

  // Trade Diversification Policy
  {
    id: "trade-diversification-policy",
    name: "Trade Partner Diversification Strategy",
    description:
      "Reduce economic dependence on single trade partners by diversifying trade relationships across multiple regions and countries.",
    category: "trade",
    difficulty: "moderate",
    estimatedDuration: "12-18 months",
    estimatedCost: 600000,
    objectives: [
      "Establish trade relationships with 8+ new countries",
      "Reduce top partner dependency to <40% of total trade",
      "Open new export markets",
      "Secure diverse import sources",
      "Increase trade resilience",
    ],
    impact: {
      diplomatic: 20,
      economic: 40,
      social: 5,
      governance: 10,
    },
    requirements: [
      "Active trade ministry",
      "Export promotion agency",
      "At least 5 embassies in different regions",
    ],
    suggestedMetrics: [
      {
        name: "Number of active trade partners",
        targetValue: 15,
        timeframe: "18 months",
      },
      {
        name: "Top partner trade share",
        targetValue: 35,
        timeframe: "18 months",
      },
      {
        name: "Regional trade balance",
        targetValue: 60,
        timeframe: "18 months",
      },
    ],
    suggestedActions: [
      "Analyze current trade concentration",
      "Identify promising new markets",
      "Organize trade missions",
      "Negotiate market access agreements",
      "Support exporters with grants",
      "Build trade infrastructure",
      "Monitor and adjust strategy",
    ],
    risks: [
      "Existing partners may retaliate",
      "Higher transaction costs initially",
      "Quality concerns with new suppliers",
      "Cultural and regulatory barriers",
    ],
    benefits: [
      "Economic resilience",
      "Reduced political leverage by single partners",
      "Access to new markets and resources",
      "Competitive pricing through diversification",
      "Innovation through exposure to different markets",
    ],
  },

  // Crisis Diplomatic Response
  {
    id: "crisis-diplomatic-response",
    name: "Rapid Diplomatic Crisis Response Framework",
    description:
      "Establish protocols and capabilities for swift diplomatic response to international crises, conflicts, or humanitarian emergencies.",
    category: "relationship",
    difficulty: "complex",
    estimatedDuration: "3-6 months",
    estimatedCost: 350000,
    objectives: [
      "Create 24/7 crisis response team",
      "Establish rapid communication channels",
      "Build crisis mediation capacity",
      "Develop humanitarian response protocols",
      "Enhance international coordination",
    ],
    impact: {
      diplomatic: 35,
      economic: 5,
      social: 15,
      governance: 20,
    },
    requirements: [
      "Foreign ministry approval",
      "Trained diplomatic corps",
      "Secure communications infrastructure",
      "International relationships established",
    ],
    suggestedMetrics: [
      {
        name: "Crisis response time",
        targetValue: 2,
        timeframe: "Immediate",
      },
      {
        name: "Successful mediations",
        targetValue: 3,
        timeframe: "12 months",
      },
      {
        name: "International partnerships",
        targetValue: 10,
        timeframe: "6 months",
      },
    ],
    suggestedActions: [
      "Create crisis response protocols",
      "Train diplomatic staff",
      "Establish communication infrastructure",
      "Build international network",
      "Conduct crisis simulations",
      "Deploy to first crisis",
      "Evaluate and improve",
    ],
    risks: [
      "Intervention in foreign affairs backlash",
      "Security risks to diplomatic staff",
      "High operational costs",
      "Political complications",
      "Ineffective mediation damaging credibility",
    ],
    benefits: [
      "Enhanced international standing",
      "Crisis prevention capabilities",
      "Humanitarian impact",
      "Stronger diplomatic relationships",
      "Regional stability contribution",
    ],
  },
];

/**
 * Get policy template by ID
 */
export function getPolicyTemplate(id: string): DiplomaticPolicyTemplate | undefined {
  return DIPLOMATIC_POLICY_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get policy templates by category
 */
export function getPolicyTemplatesByCategory(
  category: DiplomaticPolicyTemplate["category"]
): DiplomaticPolicyTemplate[] {
  return DIPLOMATIC_POLICY_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get policy templates by difficulty
 */
export function getPolicyTemplatesByDifficulty(
  difficulty: DiplomaticPolicyTemplate["difficulty"]
): DiplomaticPolicyTemplate[] {
  return DIPLOMATIC_POLICY_TEMPLATES.filter((t) => t.difficulty === difficulty);
}

/**
 * Get recommended templates based on country situation
 */
export function getRecommendedTemplates(params: {
  embassyCount: number;
  avgRelationshipStrength: number;
  tradePartners: number;
  budget: number;
}): DiplomaticPolicyTemplate[] {
  const recommendations: DiplomaticPolicyTemplate[] = [];

  // Recommend embassy expansion if count is low
  if (params.embassyCount < 5 && params.budget >= 1500000) {
    const template = getPolicyTemplate("embassy-expansion-strategy");
    if (template) recommendations.push(template);
  }

  // Recommend relationship improvement if average strength is low
  if (params.avgRelationshipStrength < 60 && params.budget >= 400000) {
    const template = getPolicyTemplate("relationship-improvement-plan");
    if (template) recommendations.push(template);
  }

  // Recommend trade diversification if partners are few
  if (params.tradePartners < 10 && params.budget >= 600000) {
    const template = getPolicyTemplate("trade-diversification-policy");
    if (template) recommendations.push(template);
  }

  // Recommend cultural exchange for soft power
  if (params.embassyCount >= 3 && params.budget >= 250000) {
    const template = getPolicyTemplate("cultural-exchange-policy");
    if (template) recommendations.push(template);
  }

  return recommendations;
}

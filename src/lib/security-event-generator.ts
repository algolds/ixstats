/**
 * Security Event Generator with Markov Chain & NPC Threat Actors
 *
 * Advanced system for generating dynamic, contextual security events based on
 * country stability metrics, military readiness, economic conditions, and threat actor personalities.
 *
 * Design Philosophy:
 * - Events emerge organically from country conditions
 * - Threat actors have persistent personalities and motivations
 * - Markov chains model security state transitions
 * - Multiple triggers create realistic, cascading crises
 *
 * Mathematical Foundation:
 * - P(Event_t+1 | State_t) = probability of event given current security state
 * - Weighted formula: stability_weight * 0.35 + military_weight * 0.25 +
 *                     economic_weight * 0.20 + political_weight * 0.15 + random * 0.05
 */

// ==================== SECURITY STATES ====================

/**
 * Five-state Markov model for national security
 * States ordered from worst to best security posture
 */
export type SecurityState = "crisis" | "unstable" | "moderate" | "secure" | "fortified";

const STATE_RANK: Record<SecurityState, number> = {
  crisis: 0,
  unstable: 1,
  moderate: 2,
  secure: 3,
  fortified: 4,
};

const RANK_TO_STATE: Record<number, SecurityState> = {
  0: "crisis",
  1: "unstable",
  2: "moderate",
  3: "secure",
  4: "fortified",
};

// ==================== THREAT ACTOR PERSONALITIES ====================

/**
 * NPC threat actor personality traits (0-100 scale)
 */
export interface ThreatActorPersonality {
  /**
   * AGGRESSION (0-100)
   * Likelihood of violent action vs peaceful protest
   * High: Terrorism, armed attacks, bombings
   * Low: Peaceful demonstrations, civil disobedience
   */
  aggression: number;

  /**
   * ORGANIZATION (0-100)
   * Level of coordination and hierarchy
   * High: Sophisticated cells, clear command structure
   * Low: Lone wolves, disorganized mobs
   */
  organization: number;

  /**
   * IDEOLOGY_RIGIDITY (0-100)
   * Commitment to ideological goals vs pragmatism
   * High: Uncompromising, will sacrifice for cause
   * Low: Negotiable, motivated by practical gains
   */
  ideologyRigidity: number;

  /**
   * SOPHISTICATION (0-100)
   * Technical capability and operational skill
   * High: Advanced weapons, cyber attacks, coordinated strikes
   * Low: Improvised weapons, simple tactics
   */
  sophistication: number;

  /**
   * POPULAR_SUPPORT (0-100)
   * Level of public sympathy and recruitment potential
   * High: Broad base, easy recruiting, safe havens
   * Low: Isolated, hunted, no sanctuary
   */
  popularSupport: number;

  /**
   * EXTERNAL_BACKING (0-100)
   * Foreign support (money, weapons, training, safe havens)
   * High: State sponsor, international networks
   * Low: Self-funded, isolated
   */
  externalBacking: number;

  /**
   * PATIENCE (0-100)
   * Willingness to wait for opportunities
   * High: Strategic, long-term planning, dormant cells
   * Low: Opportunistic, reactive, impulsive strikes
   */
  patience: number;

  /**
   * BRUTALITY (0-100)
   * Willingness to cause civilian casualties
   * High: Indiscriminate attacks, terror tactics
   * Low: Targeted strikes, minimize collateral damage
   */
  brutality: number;
}

/**
 * Threat actor archetypes with pre-configured personalities
 */
export const THREAT_ARCHETYPES: Record<
  string,
  { traits: ThreatActorPersonality; description: string }
> = {
  JIHADIST_CELL: {
    description: "Religious extremist terrorist group",
    traits: {
      aggression: 85,
      organization: 70,
      ideologyRigidity: 95,
      sophistication: 60,
      popularSupport: 35,
      externalBacking: 55,
      patience: 65,
      brutality: 90,
    },
  },
  SEPARATIST_MOVEMENT: {
    description: "Ethnic/regional independence insurgency",
    traits: {
      aggression: 60,
      organization: 65,
      ideologyRigidity: 80,
      sophistication: 50,
      popularSupport: 60,
      externalBacking: 40,
      patience: 75,
      brutality: 55,
    },
  },
  ORGANIZED_CRIME: {
    description: "Criminal syndicate/cartel",
    traits: {
      aggression: 70,
      organization: 85,
      ideologyRigidity: 25,
      sophistication: 75,
      popularSupport: 30,
      externalBacking: 65,
      patience: 80,
      brutality: 75,
    },
  },
  POLITICAL_EXTREMISTS: {
    description: "Radical political movement (far-left/right)",
    traits: {
      aggression: 55,
      organization: 50,
      ideologyRigidity: 85,
      sophistication: 45,
      popularSupport: 40,
      externalBacking: 35,
      patience: 50,
      brutality: 50,
    },
  },
  CYBER_ATTACKERS: {
    description: "Hacktivist group or cyber criminals",
    traits: {
      aggression: 40,
      organization: 60,
      ideologyRigidity: 50,
      sophistication: 95,
      popularSupport: 35,
      externalBacking: 70,
      patience: 85,
      brutality: 15,
    },
  },
  LONE_WOLF: {
    description: "Radicalized individual actor",
    traits: {
      aggression: 75,
      organization: 10,
      ideologyRigidity: 90,
      sophistication: 25,
      popularSupport: 5,
      externalBacking: 10,
      patience: 20,
      brutality: 80,
    },
  },
  FOREIGN_AGENT: {
    description: "State-sponsored espionage/sabotage",
    traits: {
      aggression: 50,
      organization: 95,
      ideologyRigidity: 60,
      sophistication: 90,
      popularSupport: 10,
      externalBacking: 100,
      patience: 95,
      brutality: 40,
    },
  },
};

// ==================== EVENT CONTEXT ====================

/**
 * Country context factors influencing event generation
 */
export interface SecurityEventContext {
  countryId: string;

  // Stability metrics (from stability-formulas.ts)
  stability: {
    stabilityScore: number; // 0-100 (overall stability)
    crimeRate: number; // per 100k
    organizedCrimeLevel: number; // 0-100
    riotRisk: number; // 0-100
    ethnicTension: number; // 0-100
    protestFrequency: number; // events/year
    trustInGovernment: number; // 0-100
    socialCohesion: number; // 0-100
  };

  // Military readiness (from security router)
  military: {
    averageReadiness: number; // 0-100
    militaryStrength: number; // 0-100
    borderSecurity: number; // 0-100
    counterTerrorism: number; // 0-100
    cybersecurity: number; // 0-100
  };

  // Economic conditions
  economy: {
    gdpPerCapita: number;
    unemploymentRate: number; // 0-100
    inequalityGini: number; // 0-100
    povertyRate: number; // 0-100
    economicGrowth: number; // -50 to +50
  };

  // Political environment
  politics: {
    democracyLevel: number; // 0-100
    politicalStability: number; // 0-100
    corruption: number; // 0-100
    polarization: number; // 0-100
  };

  // Recent events (affects probability)
  recentEvents: {
    securityEventsLast30Days: number;
    majorCrisesLast90Days: number;
    successfulAttacksLast90Days: number;
  };
}

// ==================== EVENT TYPES ====================

/**
 * Security event categories with weighted probabilities
 */
export interface SecurityEventType {
  type:
    | "terrorism"
    | "insurgency"
    | "organized_crime"
    | "cyber_attack"
    | "espionage"
    | "civil_unrest"
    | "border_incident"
    | "natural_disaster";
  severity: "low" | "moderate" | "high" | "critical" | "existential";
  name: string;
  description: string;
  actorArchetype?: keyof typeof THREAT_ARCHETYPES;

  // Trigger conditions
  requiredConditions: {
    minStability?: number;
    maxStability?: number;
    minMilitaryReadiness?: number;
    maxMilitaryReadiness?: number;
    minCrimeRate?: number;
    minEthnicTension?: number;
    minPolarization?: number;
  };

  // Effects on country (applied if event occurs)
  effects: {
    stabilityImpact: number; // -10 to +10
    militaryReadinessImpact: number; // -10 to +10
    economicImpact: number; // in dollars
    casualtyRange: [number, number]; // [min, max]
  };

  // Base probability (modified by context)
  baseProbability: number; // 0-1
}

// ==================== EVENT CATALOG ====================

/**
 * Comprehensive catalog of potential security events
 */
export const SECURITY_EVENT_CATALOG: SecurityEventType[] = [
  // TERRORISM EVENTS
  {
    type: "terrorism",
    severity: "critical",
    name: "Coordinated Bombing Campaign",
    description:
      "Multiple simultaneous explosions targeting government buildings, transportation hubs, and civilian areas",
    actorArchetype: "JIHADIST_CELL",
    requiredConditions: {
      maxStability: 60,
      minEthnicTension: 40,
    },
    effects: {
      stabilityImpact: -8,
      militaryReadinessImpact: -3,
      economicImpact: -50000000,
      casualtyRange: [50, 200],
    },
    baseProbability: 0.02,
  },
  {
    type: "terrorism",
    severity: "high",
    name: "Vehicle Ramming Attack",
    description: "Radicalized individual drives vehicle into crowded public space",
    actorArchetype: "LONE_WOLF",
    requiredConditions: {
      maxStability: 70,
      minPolarization: 50,
    },
    effects: {
      stabilityImpact: -4,
      militaryReadinessImpact: -1,
      economicImpact: -5000000,
      casualtyRange: [10, 50],
    },
    baseProbability: 0.05,
  },

  // INSURGENCY EVENTS
  {
    type: "insurgency",
    severity: "critical",
    name: "Armed Separatist Uprising",
    description: "Regional insurgent group launches coordinated attacks to seize territory",
    actorArchetype: "SEPARATIST_MOVEMENT",
    requiredConditions: {
      maxStability: 50,
      minEthnicTension: 60,
      maxMilitaryReadiness: 70,
    },
    effects: {
      stabilityImpact: -10,
      militaryReadinessImpact: -5,
      economicImpact: -100000000,
      casualtyRange: [100, 500],
    },
    baseProbability: 0.01,
  },
  {
    type: "insurgency",
    severity: "moderate",
    name: "Guerrilla Ambush",
    description: "Insurgent fighters ambush military patrol in remote area",
    actorArchetype: "SEPARATIST_MOVEMENT",
    requiredConditions: {
      maxStability: 65,
      minEthnicTension: 40,
    },
    effects: {
      stabilityImpact: -3,
      militaryReadinessImpact: -2,
      economicImpact: -10000000,
      casualtyRange: [5, 20],
    },
    baseProbability: 0.08,
  },

  // ORGANIZED CRIME
  {
    type: "organized_crime",
    severity: "high",
    name: "Cartel Violence Surge",
    description: "Drug cartel war erupts with assassinations, kidnappings, and open firefights",
    actorArchetype: "ORGANIZED_CRIME",
    requiredConditions: {
      maxStability: 65,
      minCrimeRate: 500,
    },
    effects: {
      stabilityImpact: -6,
      militaryReadinessImpact: -2,
      economicImpact: -75000000,
      casualtyRange: [30, 100],
    },
    baseProbability: 0.06,
  },

  // CYBER ATTACKS
  {
    type: "cyber_attack",
    severity: "critical",
    name: "Critical Infrastructure Hack",
    description: "Cyber attackers compromise power grid, causing widespread blackouts",
    actorArchetype: "CYBER_ATTACKERS",
    requiredConditions: {
      maxStability: 80,
    },
    effects: {
      stabilityImpact: -7,
      militaryReadinessImpact: -4,
      economicImpact: -500000000,
      casualtyRange: [5, 50],
    },
    baseProbability: 0.03,
  },

  // ESPIONAGE
  {
    type: "espionage",
    severity: "high",
    name: "Foreign Spy Ring Discovered",
    description: "Intelligence services uncover extensive espionage operation stealing military secrets",
    actorArchetype: "FOREIGN_AGENT",
    requiredConditions: {},
    effects: {
      stabilityImpact: -2,
      militaryReadinessImpact: -3,
      economicImpact: -25000000,
      casualtyRange: [0, 0],
    },
    baseProbability: 0.04,
  },

  // CIVIL UNREST
  {
    type: "civil_unrest",
    severity: "moderate",
    name: "Mass Protests Turn Violent",
    description: "Peaceful demonstrations escalate into riots with property destruction",
    requiredConditions: {
      maxStability: 60,
      minPolarization: 55,
    },
    effects: {
      stabilityImpact: -4,
      militaryReadinessImpact: -1,
      economicImpact: -20000000,
      casualtyRange: [2, 20],
    },
    baseProbability: 0.10,
  },

  // BORDER INCIDENTS
  {
    type: "border_incident",
    severity: "moderate",
    name: "Cross-Border Incursion",
    description: "Armed group crosses border, engages with border patrol",
    requiredConditions: {
      maxStability: 70,
    },
    effects: {
      stabilityImpact: -3,
      militaryReadinessImpact: -2,
      economicImpact: -15000000,
      casualtyRange: [3, 15],
    },
    baseProbability: 0.07,
  },
];

// ==================== EVENT GENERATION ENGINE ====================

/**
 * Calculate weighted event probability based on context
 */
export function calculateEventProbability(
  event: SecurityEventType,
  context: SecurityEventContext
): number {
  let probability = event.baseProbability;

  // Check required conditions
  const { requiredConditions } = event;

  if (requiredConditions.minStability && context.stability.stabilityScore < requiredConditions.minStability) {
    return 0; // Condition not met
  }
  if (requiredConditions.maxStability && context.stability.stabilityScore > requiredConditions.maxStability) {
    return 0;
  }
  if (requiredConditions.minMilitaryReadiness && context.military.averageReadiness < requiredConditions.minMilitaryReadiness) {
    return 0;
  }
  if (requiredConditions.maxMilitaryReadiness && context.military.averageReadiness > requiredConditions.maxMilitaryReadiness) {
    return 0;
  }
  if (requiredConditions.minCrimeRate && context.stability.crimeRate < requiredConditions.minCrimeRate) {
    return 0;
  }
  if (requiredConditions.minEthnicTension && context.stability.ethnicTension < requiredConditions.minEthnicTension) {
    return 0;
  }
  if (requiredConditions.minPolarization && context.politics.polarization < requiredConditions.minPolarization) {
    return 0;
  }

  // Apply context multipliers
  const stabilityMultiplier = 1 + (100 - context.stability.stabilityScore) / 100; // Worse stability = higher probability
  const militaryMultiplier = 1 + (100 - context.military.averageReadiness) / 150; // Poor military = more events
  const economicMultiplier = 1 + context.economy.unemploymentRate / 200; // High unemployment = instability
  const politicalMultiplier = 1 + context.politics.polarization / 150; // Polarization increases risk

  // Recent events fatigue (too many events recently reduces probability)
  const eventFatigue = Math.max(0.5, 1 - context.recentEvents.securityEventsLast30Days * 0.1);

  probability *= stabilityMultiplier * 0.35;
  probability *= militaryMultiplier * 0.25;
  probability *= economicMultiplier * 0.20;
  probability *= politicalMultiplier * 0.15;
  probability *= eventFatigue * 0.05;

  // Cap at reasonable maximum
  return Math.min(probability, 0.95);
}

/**
 * Generate security event based on weighted probabilities
 */
export function generateSecurityEvent(context: SecurityEventContext): SecurityEventType | null {
  // Calculate probabilities for all eligible events
  const eligibleEvents = SECURITY_EVENT_CATALOG.map((event) => ({
    event,
    probability: calculateEventProbability(event, context),
  })).filter((e) => e.probability > 0);

  if (eligibleEvents.length === 0) {
    return null; // No eligible events
  }

  // Weighted random selection
  const totalProbability = eligibleEvents.reduce((sum, e) => sum + e.probability, 0);
  const roll = Math.random() * totalProbability;

  let cumulative = 0;
  for (const { event, probability } of eligibleEvents) {
    cumulative += probability;
    if (roll <= cumulative) {
      return event;
    }
  }

  return null;
}

/**
 * Generate threat actor personality for event
 */
export function generateThreatActor(
  event: SecurityEventType,
  context: SecurityEventContext
): ThreatActorPersonality & { name: string; archetype: string } {
  const archetypeKey = event.actorArchetype || "POLITICAL_EXTREMISTS";
  const archetype = THREAT_ARCHETYPES[archetypeKey];

  // Apply context-based personality drift
  const traits = { ...archetype.traits };

  // More unstable countries = more aggressive actors
  if (context.stability.stabilityScore < 40) {
    traits.aggression += 10;
    traits.brutality += 15;
  }

  // High poverty/unemployment increases popular support
  if (context.economy.povertyRate > 30) {
    traits.popularSupport += 15;
  }

  // Strong military reduces actor sophistication (they get caught/killed)
  if (context.military.averageReadiness > 80) {
    traits.sophistication -= 10;
    traits.organization -= 10;
  }

  // Cap traits at 0-100
  for (const key in traits) {
    traits[key as keyof ThreatActorPersonality] = Math.max(
      0,
      Math.min(100, traits[key as keyof ThreatActorPersonality])
    );
  }

  return {
    ...traits,
    name: generateThreatActorName(archetypeKey),
    archetype: archetypeKey,
  };
}

/**
 * Generate random threat actor name
 */
function generateThreatActorName(archetype: string): string {
  const names: Record<string, string[]> = {
    JIHADIST_CELL: [
      "Islamic Liberation Front",
      "Warriors of the Faith",
      "Army of the Righteous",
      "Brotherhood of Jihad",
    ],
    SEPARATIST_MOVEMENT: [
      "National Liberation Army",
      "Free State Movement",
      "People's Independence Front",
      "Regional Defense Force",
    ],
    ORGANIZED_CRIME: [
      "The Syndicate",
      "Northern Cartel",
      "Shadow Network",
      "The Organization",
    ],
    POLITICAL_EXTREMISTS: [
      "Revolutionary Action Front",
      "People's Resistance Movement",
      "National Renewal Coalition",
      "Liberation Brigade",
    ],
    CYBER_ATTACKERS: [
      "Ghost Protocol",
      "Digital Shadow Collective",
      "Anonymous Legion",
      "CyberStorm Group",
    ],
    LONE_WOLF: [
      "Self-Radicalized Individual",
      "Lone Extremist",
      "Isolated Actor",
      "Radicalized Citizen",
    ],
    FOREIGN_AGENT: [
      "Foreign Intelligence Operatives",
      "State-Sponsored Cell",
      "External Saboteurs",
      "Covert Operations Team",
    ],
  };

  const pool = names[archetype] || ["Unknown Threat Actor"];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

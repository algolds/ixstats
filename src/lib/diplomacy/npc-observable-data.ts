/**
 * Build the `ObservableData` an NPC personality is derived from, out of the country's stored
 * diplomatic relations and embassies. Shared by every NPC decision (cultural-exchange
 * participation, alliance invites) so the same nation always reads with the same traits.
 */
import type { ObservableData } from "~/lib/diplomacy/npc-personality";
import type { RelationshipState as MarkovRelationshipState } from "~/lib/diplomacy/markov-engine";

export interface NpcRelationRow {
  country1: string;
  country2: string;
  relationship: string;
  strength: number;
  culturalExchange?: string | null;
}

export interface NpcEmbassyRow {
  specialization: string | null;
  level: number;
  influence: number;
}

/** Stored relationship labels are mixed-case and come from several writers (drift, seeds, UI). */
const rel = (r: { relationship: string }) => r.relationship.toLowerCase();

export function buildNpcObservableData(
  relationships: NpcRelationRow[],
  embassies: NpcEmbassyRow[]
): ObservableData {
  const countRel = (...labels: string[]) =>
    relationships.filter((r) => labels.includes(rel(r))).length;
  const countSpec = (spec: string) => embassies.filter((e) => e.specialization === spec).length;
  const countExchange = (level: string) =>
    relationships.filter((r) => r.culturalExchange === level).length;

  return {
    relationships: {
      total: relationships.length,
      allied: countRel("alliance", "allied"),
      friendly: countRel("friendly", "cooperative"),
      tense: countRel("cool", "strained", "tense"),
      hostile: countRel("hostile"),
      neutral: countRel("neutral"),
      averageStrength:
        relationships.length > 0
          ? relationships.reduce((sum, r) => sum + r.strength, 0) / relationships.length
          : 50,
      deterioratingCount: 0, // Could track this in future
    },
    embassies: {
      total: embassies.length,
      culturalSpecialized: countSpec("cultural"),
      economicSpecialized: countSpec("economic"),
      securitySpecialized: countSpec("security"),
      averageLevel:
        embassies.length > 0
          ? embassies.reduce((sum, e) => sum + e.level, 0) / embassies.length
          : 1,
      averageInfluence:
        embassies.length > 0
          ? embassies.reduce((sum, e) => sum + e.influence, 0) / embassies.length
          : 50,
    },
    treaties: { total: 0, multilateral: 0, defensive: 0, trade: 0, cultural: 0 },
    economic: {
      totalTradeVolume: 0,
      highValuePartners: 0,
      tradeTreatyCount: 0,
      tradeGrowthTrend: 0,
    },
    cultural: {
      highExchangeCount: countExchange("High"),
      mediumExchangeCount: countExchange("Medium"),
      culturalTreatyCount: 0,
      totalExchangePrograms: 0,
    },
    historical: {
      totalActions: Math.max(1, relationships.length + embassies.length),
      cooperativeActions: countRel("alliance", "allied", "friendly"),
      aggressiveActions: countRel("hostile", "strained"),
      consistencyScore: 70, // Default moderate consistency
      policyVolatility: 30, // Default moderate volatility
    },
  };
}

/** Map a stored relationship label onto the Markov engine's five states. */
export function toMarkovState(relationship: string | null | undefined): MarkovRelationshipState {
  switch ((relationship ?? "neutral").toLowerCase()) {
    case "alliance":
    case "allied":
      return "allied";
    case "friendly":
    case "cooperative":
      return "friendly";
    case "cool":
    case "strained":
    case "tense":
      return "tense";
    case "hostile":
      return "hostile";
    default:
      return "neutral";
  }
}

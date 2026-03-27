/**
 * Cross-Pillar Gameplay Engine
 *
 * Pure functions that compute numeric gameplay effects across the three
 * core pillars (Executive, Diplomacy, Politics). These are the mechanical
 * connections that make NationStates-on-steroids feel alive.
 *
 * All functions are pure — no React, no database, no side effects.
 * Effect application is handled by tRPC endpoints.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface PolicyData {
  id: string;
  name: string;
  policyType: string;      // economic, social, diplomatic, infrastructure, governance
  category?: string | null;
  status: string;           // draft, active, suspended, expired, repealed
  priority?: string | null; // critical, high, medium, low
}

export interface RelationData {
  id: string;
  targetCountryId: string;
  targetCountryName?: string;
  strength: number;       // 0-100
  relationType?: string;
}

export interface PartyData {
  id: string;
  name: string;
  ideology: string;        // far_left, left, center_left, center, center_right, right, far_right
  baseSupport: number;     // 0-100
  color?: string;
}

export interface LegislatureData {
  totalSeats: number;
  electoralSystem?: string;
}

export interface SeatSummary {
  partyId: string;
  partyName: string;
  seats: number;
  ideology?: string;
}

export interface ElectionResult {
  winnerId?: string;
  winnerIdeology?: string;
  seatSummary: SeatSummary[];
}

export interface ForeignPolicyData {
  id: string;
  actionType: string;   // embargo, sanction, free_trade, military_alliance, blockade
  targetCountryId: string;
  status: string;
}

export interface CrisisData {
  id: string;
  severity: string;      // critical, high, medium, low
  crisisType: string;
  status: string;
}

// ── Effect types ─────────────────────────────────────────────────────

export interface DiplomaticEffect {
  relationId: string;
  targetCountryName?: string;
  strengthDelta: number;  // positive = improve, negative = strain
  reason: string;
  source: "policy" | "election" | "foreign_policy";
}

export interface PartyEffect {
  partyId: string;
  partyName: string;
  supportDelta: number;   // positive = boost, negative = reduce
  stance: "support" | "oppose" | "neutral";
  reason: string;
  source: "policy" | "diplomacy" | "crisis";
}

export interface PolicyEffect {
  policyId: string;
  policyName: string;
  effectivenessModifier: number; // percentage modifier
  passageProbability?: number;   // 0-100
  reason: string;
  source: "legislature" | "diplomacy" | "alliance";
}

export interface CrossPillarEffects {
  diplomaticEffects: DiplomaticEffect[];
  partyEffects: PartyEffect[];
  policyEffects: PolicyEffect[];
}

// ── Priority multipliers ─────────────────────────────────────────────

const PRIORITY_MULTIPLIER: Record<string, number> = {
  critical: 2.0,
  high: 1.5,
  medium: 1.0,
  low: 0.5,
};

// ── Ideology spectrum ────────────────────────────────────────────────

const IDEOLOGY_SPECTRUM: Record<string, number> = {
  far_left: -3,
  left: -2,
  center_left: -1,
  center: 0,
  center_right: 1,
  right: 2,
  far_right: 3,
};

/** Policy type maps to ideology preference: negative = left favors, positive = right favors */
const POLICY_IDEOLOGY_ALIGNMENT: Record<string, number> = {
  economic: 1,          // right tends to favor free-market economic policies
  social: -1,           // left tends to favor social spending policies
  diplomatic: 0,        // neutral ideologically
  infrastructure: 0,    // neutral
  governance: -0.5,     // slight left lean (regulation/oversight)
};

// ── Executive → Diplomacy ────────────────────────────────────────────

/**
 * Compute how active policies affect diplomatic relationships.
 * Economic policies affect trade partners, diplomatic policies directly
 * target relations, social policies affect cultural exchange value.
 */
export function computePolicyDiplomaticImpact(
  policies: PolicyData[],
  relations: RelationData[],
): DiplomaticEffect[] {
  const activePolicies = policies.filter((p) => p.status === "active");
  if (activePolicies.length === 0 || relations.length === 0) return [];

  const effects: DiplomaticEffect[] = [];

  for (const policy of activePolicies) {
    const multiplier = PRIORITY_MULTIPLIER[policy.priority || "medium"] ?? 1.0;

    // Base impact ranges by policy type
    let baseDelta = 0;
    const affectedRelations = relations;

    switch (policy.policyType) {
      case "economic":
        // Economic policies affect all trade partners moderately
        baseDelta = 2 * multiplier; // +2-8% depending on priority
        break;
      case "social":
        // Social policies have mild diplomatic effects
        baseDelta = 1 * multiplier; // +1-5%
        break;
      case "diplomatic":
        // Diplomatic policies strongly affect target relations
        baseDelta = 5 * multiplier; // +5-15%
        break;
      case "infrastructure":
        // Infrastructure affects nearby/neighbor relations mildly
        baseDelta = 1 * multiplier; // +1-3%
        break;
      default:
        continue; // governance has no diplomatic impact
    }

    // Apply to relations (for simplicity, all get a positive bump from
    // having policies — the *type* of relationship effect would be
    // computed by examining policy details)
    for (const relation of affectedRelations) {
      effects.push({
        relationId: relation.id,
        targetCountryName: relation.targetCountryName,
        strengthDelta: baseDelta,
        reason: `"${policy.name}" (${policy.policyType}) — ${policy.priority || "medium"} priority`,
        source: "policy",
      });
    }
  }

  // Aggregate effects per relation (merge multiple policy effects)
  return aggregateDiplomaticEffects(effects);
}

// ── Executive → Politics ─────────────────────────────────────────────

/**
 * Compute how active policies affect party support levels.
 * Parties support/oppose policies based on ideology alignment.
 */
export function computePolicyPartyReactions(
  policies: PolicyData[],
  parties: PartyData[],
): PartyEffect[] {
  const activePolicies = policies.filter((p) => p.status === "active");
  if (activePolicies.length === 0 || parties.length === 0) return [];

  const effects: PartyEffect[] = [];

  for (const policy of activePolicies) {
    const policyLean = POLICY_IDEOLOGY_ALIGNMENT[policy.policyType] ?? 0;
    const multiplier = PRIORITY_MULTIPLIER[policy.priority || "medium"] ?? 1.0;

    for (const party of parties) {
      const ideologyScore = IDEOLOGY_SPECTRUM[party.ideology] ?? 0;

      // If policy leans the same direction as the party, they support it
      // If opposite, they oppose. Magnitude matters.
      const alignment = policyLean * ideologyScore;
      let supportDelta: number;
      let stance: "support" | "oppose" | "neutral";

      if (alignment > 0) {
        // Same direction — support
        supportDelta = Math.min(5, 1 + Math.abs(alignment)) * multiplier;
        stance = "support";
      } else if (alignment < 0) {
        // Opposite direction — oppose
        supportDelta = -Math.min(5, 1 + Math.abs(alignment)) * multiplier;
        stance = "oppose";
      } else {
        // Neutral (centrist or non-ideological policy)
        supportDelta = 0.5 * multiplier;
        stance = "neutral";
      }

      effects.push({
        partyId: party.id,
        partyName: party.name,
        supportDelta: Math.round(supportDelta * 10) / 10,
        stance,
        reason: `"${policy.name}" (${policy.policyType})`,
        source: "policy",
      });
    }
  }

  // Aggregate per party
  return aggregatePartyEffects(effects);
}

// ── Diplomacy → Executive ────────────────────────────────────────────

/**
 * Compute how diplomatic relationships and foreign policies affect
 * executive policy effectiveness.
 */
export function computeDiplomaticPolicyPressure(
  relations: RelationData[],
  foreignPolicies: ForeignPolicyData[],
  policies: PolicyData[],
): PolicyEffect[] {
  if (policies.length === 0) return [];

  const activePolicies = policies.filter((p) => p.status === "active");
  const effects: PolicyEffect[] = [];

  // Strong allies boost economic policy effectiveness
  const strongAllies = relations.filter((r) => r.strength >= 70).length;
  const allyBonus = Math.min(10, strongAllies * 2); // +2% per strong ally, max +10%

  // Active trade agreements boost economics
  const tradeDeals = foreignPolicies.filter((fp) => fp.actionType === "free_trade" && fp.status === "active").length;
  const tradeBonus = Math.min(8, tradeDeals * 3); // +3% per trade deal, max +8%

  // Embargoes/sanctions reduce overall effectiveness
  const negativePolicies = foreignPolicies.filter((fp) =>
    (fp.actionType === "embargo" || fp.actionType === "sanction" || fp.actionType === "blockade") && fp.status === "active"
  ).length;
  const negativePenalty = Math.min(15, negativePolicies * 5); // -5% per negative policy, max -15%

  for (const policy of activePolicies) {
    let modifier = 0;
    const reasons: string[] = [];

    if (policy.policyType === "economic" && (allyBonus > 0 || tradeBonus > 0)) {
      modifier += allyBonus + tradeBonus;
      if (allyBonus > 0) reasons.push(`${strongAllies} strong allies (+${allyBonus}%)`);
      if (tradeBonus > 0) reasons.push(`${tradeDeals} trade agreements (+${tradeBonus}%)`);
    }

    if (negativePenalty > 0) {
      modifier -= negativePenalty;
      reasons.push(`${negativePolicies} sanctions/embargoes (-${negativePenalty}%)`);
    }

    if (modifier !== 0) {
      effects.push({
        policyId: policy.id,
        policyName: policy.name,
        effectivenessModifier: modifier,
        reason: reasons.join(", "),
        source: "diplomacy",
      });
    }
  }

  return effects;
}

// ── Politics → Executive ─────────────────────────────────────────────

/**
 * Compute how legislature composition affects policy passage probability
 * and effectiveness.
 */
export function computeLegislativeGovernance(
  legislature: LegislatureData | null,
  seatSummary: SeatSummary[],
  policies: PolicyData[],
): PolicyEffect[] {
  if (!legislature || seatSummary.length === 0 || policies.length === 0) return [];

  const activePolicies = policies.filter((p) => p.status === "active" || p.status === "draft");
  const totalSeats = legislature.totalSeats;
  if (totalSeats === 0) return [];

  // Find the largest party/coalition
  const sortedParties = [...seatSummary].sort((a, b) => b.seats - a.seats);
  const largestParty = sortedParties[0];
  if (!largestParty) return [];

  const majorityThreshold = totalSeats / 2;
  const hasMajority = largestParty.seats > majorityThreshold;

  const effects: PolicyEffect[] = [];

  for (const policy of activePolicies) {
    const policyLean = POLICY_IDEOLOGY_ALIGNMENT[policy.policyType] ?? 0;
    const partyLean = IDEOLOGY_SPECTRUM[largestParty.ideology || "center"] ?? 0;
    const alignment = policyLean * partyLean;

    let effectivenessModifier = 0;
    let passageProbability = 50; // base
    let reason: string;

    if (hasMajority && alignment >= 0) {
      // Majority party aligned with policy — strong passage
      effectivenessModifier = 20;
      passageProbability = 85;
      reason = `${largestParty.partyName} majority supports this policy type`;
    } else if (hasMajority && alignment < 0) {
      // Majority party opposes this policy type
      effectivenessModifier = -30;
      passageProbability = 25;
      reason = `${largestParty.partyName} majority opposes this policy direction`;
    } else if (!hasMajority && alignment >= 0) {
      // No majority, but largest party is aligned — needs coalition
      effectivenessModifier = -10;
      passageProbability = 55;
      reason = `Coalition required — ${largestParty.partyName} is sympathetic but lacks majority`;
    } else {
      // No majority, largest party opposes
      effectivenessModifier = -20;
      passageProbability = 35;
      reason = `Coalition dynamics unfavorable — ${largestParty.partyName} leans against this policy type`;
    }

    effects.push({
      policyId: policy.id,
      policyName: policy.name,
      effectivenessModifier,
      passageProbability,
      reason,
      source: "legislature",
    });
  }

  return effects;
}

// ── Politics → Diplomacy ─────────────────────────────────────────────

/**
 * Compute how election outcomes shift diplomatic posture.
 */
export function computeElectionDiplomaticShift(
  electionResult: ElectionResult | null,
  relations: RelationData[],
): DiplomaticEffect[] {
  if (!electionResult || relations.length === 0) return [];

  const winnerIdeology = electionResult.winnerIdeology || "center";
  const ideologyScore = IDEOLOGY_SPECTRUM[winnerIdeology] ?? 0;

  const effects: DiplomaticEffect[] = [];

  for (const relation of relations) {
    let strengthDelta = 0;
    let reason = "";

    if (Math.abs(ideologyScore) >= 2) {
      // Far-leaning parties have strong diplomatic effects
      if (ideologyScore >= 2) {
        // Right-wing/hawkish — military alliances strengthen, general relations weaken
        strengthDelta = relation.relationType === "military_alliance" ? 10 : -5;
        reason = `Hawkish government ${strengthDelta > 0 ? "strengthens military ties" : "strains diplomatic bonds"}`;
      } else {
        // Far-left — internationalist, general relations improve slightly
        strengthDelta = 3;
        reason = "Internationalist government improves diplomatic outreach";
      }
    } else if (ideologyScore <= -1) {
      // Center-left — mild positive
      strengthDelta = 2;
      reason = "Center-left government modestly improves diplomatic relations";
    } else if (ideologyScore >= 1) {
      // Center-right — mild positive for trade
      strengthDelta = 1;
      reason = "Center-right government maintains trade-focused relations";
    }
    // Center = no change (stability)

    if (strengthDelta !== 0) {
      effects.push({
        relationId: relation.id,
        targetCountryName: relation.targetCountryName,
        strengthDelta,
        reason,
        source: "election",
      });
    }
  }

  return effects;
}

// ── Diplomacy → Politics ─────────────────────────────────────────────

/**
 * Compute how diplomatic events and crises affect domestic party support.
 */
export function computeDiplomaticDomesticPressure(
  crises: CrisisData[],
  parties: PartyData[],
): PartyEffect[] {
  if (crises.length === 0 || parties.length === 0) return [];

  const activeCrises = crises.filter((c) => c.status === "active" || c.status === "ongoing");
  const effects: PartyEffect[] = [];

  for (const party of parties) {
    const ideologyScore = IDEOLOGY_SPECTRUM[party.ideology] ?? 0;
    let supportDelta = 0;
    const reasons: string[] = [];

    // Crises boost hawkish (right-wing) party support
    const criticalCrises = activeCrises.filter((c) => c.severity === "critical" || c.severity === "high").length;
    if (criticalCrises > 0) {
      if (ideologyScore >= 2) {
        // Hawkish parties gain
        supportDelta += Math.min(5, criticalCrises * 2);
        reasons.push(`${criticalCrises} critical crises boost hawkish support`);
      } else if (ideologyScore <= -2) {
        // Dovish parties lose
        supportDelta -= Math.min(3, criticalCrises * 1);
        reasons.push(`${criticalCrises} critical crises reduce dovish support`);
      }
    }

    // Ongoing lower-severity crises cause general unease
    const mildCrises = activeCrises.filter((c) => c.severity === "medium" || c.severity === "low").length;
    if (mildCrises > 0 && ideologyScore === 0) {
      // Centrist parties gain during mild uncertainty
      supportDelta += Math.min(2, mildCrises);
      reasons.push(`${mildCrises} ongoing situations favor centrist stability`);
    }

    if (supportDelta !== 0) {
      effects.push({
        partyId: party.id,
        partyName: party.name,
        supportDelta: Math.round(supportDelta * 10) / 10,
        stance: supportDelta > 0 ? "support" : "oppose",
        reason: reasons.join("; "),
        source: "crisis",
      });
    }
  }

  return effects;
}

// ── Foreign Policy → Diplomacy ───────────────────────────────────────

/**
 * Compute how foreign policy actions directly affect diplomatic relations.
 */
export function computeForeignPolicyEffects(
  foreignPolicies: ForeignPolicyData[],
  relations: RelationData[],
): DiplomaticEffect[] {
  const activeFP = foreignPolicies.filter((fp) => fp.status === "active");
  if (activeFP.length === 0) return [];

  const effects: DiplomaticEffect[] = [];

  for (const fp of activeFP) {
    const targetRelation = relations.find((r) => r.targetCountryId === fp.targetCountryId);
    if (!targetRelation) continue;

    let strengthDelta = 0;
    let reason = "";

    switch (fp.actionType) {
      case "embargo":
        strengthDelta = -15;
        reason = "Active trade embargo severely strains relations";
        break;
      case "sanction":
        strengthDelta = -10;
        reason = "Sanctions are reducing diplomatic trust";
        break;
      case "blockade":
        strengthDelta = -20;
        reason = "Active blockade is critically damaging relations";
        break;
      case "free_trade":
        strengthDelta = 8;
        reason = "Free trade agreement strengthens economic ties";
        break;
      case "military_alliance":
        strengthDelta = 12;
        reason = "Military alliance deepens strategic partnership";
        break;
    }

    if (strengthDelta !== 0) {
      effects.push({
        relationId: targetRelation.id,
        targetCountryName: targetRelation.targetCountryName,
        strengthDelta,
        reason,
        source: "foreign_policy",
      });
    }
  }

  return effects;
}

// ── Aggregation ──────────────────────────────────────────────────────

/** Aggregate multiple diplomatic effects on the same relation into one */
function aggregateDiplomaticEffects(effects: DiplomaticEffect[]): DiplomaticEffect[] {
  const grouped = new Map<string, DiplomaticEffect>();

  for (const effect of effects) {
    const existing = grouped.get(effect.relationId);
    if (existing) {
      existing.strengthDelta += effect.strengthDelta;
      existing.reason = `${existing.reason}; ${effect.reason}`;
    } else {
      grouped.set(effect.relationId, { ...effect });
    }
  }

  return Array.from(grouped.values()).filter((e) => e.strengthDelta !== 0);
}

/** Aggregate multiple party effects into one per party */
function aggregatePartyEffects(effects: PartyEffect[]): PartyEffect[] {
  const grouped = new Map<string, PartyEffect>();

  for (const effect of effects) {
    const existing = grouped.get(effect.partyId);
    if (existing) {
      existing.supportDelta += effect.supportDelta;
      existing.reason = `${existing.reason}; ${effect.reason}`;
      // Update stance based on aggregate direction
      existing.stance = existing.supportDelta > 0.5 ? "support" : existing.supportDelta < -0.5 ? "oppose" : "neutral";
    } else {
      grouped.set(effect.partyId, { ...effect });
    }
  }

  return Array.from(grouped.values()).filter((e) => Math.abs(e.supportDelta) >= 0.1);
}

// ── Master computation ───────────────────────────────────────────────

/**
 * Compute all cross-pillar effects for a country in one call.
 * Returns categorized effects that can be displayed in CrossPillarBanner
 * and applied to the database.
 */
export function computeAllCrossPillarEffects(data: {
  policies: PolicyData[];
  relations: RelationData[];
  parties: PartyData[];
  foreignPolicies: ForeignPolicyData[];
  crises: CrisisData[];
  legislature: LegislatureData | null;
  seatSummary: SeatSummary[];
  lastElectionResult: ElectionResult | null;
}): CrossPillarEffects {
  const diplomaticEffects: DiplomaticEffect[] = [
    ...computePolicyDiplomaticImpact(data.policies, data.relations),
    ...computeElectionDiplomaticShift(data.lastElectionResult, data.relations),
    ...computeForeignPolicyEffects(data.foreignPolicies, data.relations),
  ];

  const partyEffects: PartyEffect[] = [
    ...computePolicyPartyReactions(data.policies, data.parties),
    ...computeDiplomaticDomesticPressure(data.crises, data.parties),
  ];

  const policyEffects: PolicyEffect[] = [
    ...computeDiplomaticPolicyPressure(data.relations, data.foreignPolicies, data.policies),
    ...computeLegislativeGovernance(data.legislature, data.seatSummary, data.policies),
  ];

  return {
    diplomaticEffects: aggregateDiplomaticEffects(diplomaticEffects),
    partyEffects: aggregatePartyEffects(partyEffects),
    policyEffects,
  };
}

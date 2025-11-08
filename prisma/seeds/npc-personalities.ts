/**
 * NPC Personalities Seed Script
 *
 * Populates the database with 6 personality archetypes with full trait profiles,
 * cultural characteristics, tone matrices, and behavioral patterns.
 *
 * Run with: npx tsx prisma/seeds/npc-personalities.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 6 Personality Archetypes with Full Trait Profiles
const personalityArchetypes = [
  {
    name: "The Aggressive Expansionist",
    archetype: "aggressive_expansionist",
    assertiveness: 85,
    cooperativeness: 30,
    economicFocus: 50,
    culturalOpenness: 40,
    riskTolerance: 80,
    ideologicalRigidity: 60,
    militarism: 85,
    isolationism: 20,
    traitDescriptions: JSON.stringify({
      assertiveness: "Highly confrontational, demands concessions, issues ultimatums",
      cooperativeness: "Prefers unilateral action, skeptical of partnerships",
      economicFocus: "Economics subordinate to security and territorial goals",
      culturalOpenness: "Protective of national culture, limited exchanges",
      riskTolerance: "Bold initiatives, willing to gamble on outcomes",
      ideologicalRigidity: "Moderately principled, but willing to shift for gains",
      militarism: "Security-focused, defense alliances prioritized, high threat perception",
      isolationism: "Engaged globally through force, extensive military networks",
    }),
    culturalProfile: JSON.stringify({
      formality: 70,
      directness: 85,
      emotionality: 45,
      flexibility: 30,
      negotiationStyle: "Hardball tactics, demands from strength, zero-sum mindset",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Cold and threatening", casual: "Dismissive and aggressive" },
      tense: { formal: "Stern warnings", casual: "Blunt and confrontational" },
      neutral: { formal: "Businesslike and assertive", casual: "Direct but not hostile" },
      friendly: { formal: "Respectful but firm", casual: "Warm but still assertive" },
      allied: { formal: "Collegial and strategic", casual: "Friendly and cooperative" },
    }),
    responsePatterns: JSON.stringify([
      "Issues ultimatums when strength advantage exists",
      "Escalates conflicts to test opponent resolve",
      "Demands territorial or economic concessions",
      "Forms alliances only for strategic necessity",
      "Threatens sanctions or military action frequently",
      "Prioritizes security concerns over economic ties",
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: {
        action: "negotiate",
        confidence: 75,
        demands: [
          "Military coordination clause",
          "Base rights consideration",
          "No economic restrictions",
        ],
      },
      trade_dispute: {
        action: "escalate",
        confidence: 80,
        reasoning: "Willing to sacrifice trade for political leverage",
      },
      cultural_exchange_offer: {
        action: "defer",
        confidence: 60,
        reasoning: "Cultural programs low priority",
      },
      sanction_threat: {
        action: "escalate",
        confidence: 85,
        reasoning: "Refuses intimidation, counter-threatens",
      },
      security_pact: {
        action: "accept",
        confidence: 90,
        reasoning: "Militarism drives strong security cooperation",
      },
    }),
    eventModifiers: JSON.stringify({
      alliance_offer: { probabilityMultiplier: 1.9, severityAdjustment: 0, urgencyAdjustment: 15 },
      border_tension: { probabilityMultiplier: 1.5, severityAdjustment: 1, urgencyAdjustment: 0 },
      sanction_threat: { probabilityMultiplier: 1.7, severityAdjustment: 1, urgencyAdjustment: 15 },
      cultural_exchange_offer: {
        probabilityMultiplier: 0.3,
        severityAdjustment: 0,
        urgencyAdjustment: -10,
      },
    }),
    historicalBasis: "Otto von Bismarck",
    historicalContext:
      'Prussian Chancellor who unified Germany through "blood and iron" diplomacy, known for Realpolitik and strategic alliance-building backed by military strength.',
  },

  {
    name: "The Peaceful Merchant",
    archetype: "peaceful_merchant",
    assertiveness: 35,
    cooperativeness: 85,
    economicFocus: 90,
    culturalOpenness: 75,
    riskTolerance: 40,
    ideologicalRigidity: 30,
    militarism: 25,
    isolationism: 20,
    traitDescriptions: JSON.stringify({
      assertiveness: "Accommodating, prefers compromise, avoids confrontation",
      cooperativeness: "Seeks alliances, proposes joint initiatives, values consensus",
      economicFocus: "Trade deals prioritized, economic leverage used, merchant diplomacy",
      culturalOpenness: "Embraces exchanges, promotes culture, values people-to-people ties",
      riskTolerance: "Cautious, incremental, status quo preservation",
      ideologicalRigidity: "Pragmatic, flexible, willing to shift positions for gains",
      militarism: "Diplomacy-first, minimal defense posture, cooperative security",
      isolationism: "Engaged globally, extensive networks, alliance-seeking",
    }),
    culturalProfile: JSON.stringify({
      formality: 50,
      directness: 60,
      emotionality: 55,
      flexibility: 85,
      negotiationStyle: "Win-win solutions, mutual benefit focus, long-term relationship building",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Diplomatic and conciliatory", casual: "Friendly despite tension" },
      tense: { formal: "Measured and reassuring", casual: "Optimistic about improvement" },
      neutral: { formal: "Professional and cooperative", casual: "Warm and engaging" },
      friendly: { formal: "Enthusiastic and collaborative", casual: "Genuinely warm" },
      allied: { formal: "Deeply cooperative", casual: "Close and trusting" },
    }),
    responsePatterns: JSON.stringify([
      "Always proposes trade-based solutions first",
      "Offers economic incentives to resolve disputes",
      "Seeks multilateral trade agreements",
      "Avoids military entanglements",
      "Promotes cultural exchanges for relationship building",
      "Negotiates extensively to preserve trade relationships",
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: {
        action: "negotiate",
        confidence: 70,
        demands: [
          "Economic cooperation clause",
          "Trade preference terms",
          "Cultural exchange program",
        ],
      },
      trade_dispute: {
        action: "negotiate",
        confidence: 85,
        reasoning: "Economic focus prioritizes trade preservation",
      },
      cultural_exchange_offer: {
        action: "accept",
        confidence: 95,
        reasoning: "High cultural openness welcomes exchanges",
      },
      sanction_threat: {
        action: "negotiate",
        confidence: 75,
        reasoning: "Economic focus prioritizes damage avoidance",
      },
      security_pact: {
        action: "defer",
        confidence: 50,
        reasoning: "Low militarism limits security cooperation interest",
      },
    }),
    eventModifiers: JSON.stringify({
      trade_dispute: { probabilityMultiplier: 0.5, severityAdjustment: -1, urgencyAdjustment: -10 },
      economic_cooperation: {
        probabilityMultiplier: 1.8,
        severityAdjustment: 0,
        urgencyAdjustment: 10,
      },
      cultural_exchange_offer: {
        probabilityMultiplier: 1.6,
        severityAdjustment: 0,
        urgencyAdjustment: 5,
      },
      sanction_threat: {
        probabilityMultiplier: 0.3,
        severityAdjustment: -1,
        urgencyAdjustment: -15,
      },
    }),
    historicalBasis: "Benjamin Franklin",
    historicalContext:
      'American diplomat and merchant who prioritized economic cooperation and cultural exchange, famous for his pragmatic "diplomacy of commerce" approach.',
  },

  {
    name: "The Cautious Isolationist",
    archetype: "cautious_isolationist",
    assertiveness: 45,
    cooperativeness: 50,
    economicFocus: 55,
    culturalOpenness: 35,
    riskTolerance: 25,
    ideologicalRigidity: 55,
    militarism: 50,
    isolationism: 85,
    traitDescriptions: JSON.stringify({
      assertiveness: "Moderate stance, neither aggressive nor overly accommodating",
      cooperativeness: "Selective cooperation, maintains independence",
      economicFocus: "Self-sufficiency prioritized, limited trade dependence",
      culturalOpenness: "Protective of culture, limited exchanges, nationalist tendencies",
      riskTolerance: "Extremely cautious, incremental, status quo preservation",
      ideologicalRigidity: "Moderately principled, resists foreign influence",
      militarism: "Defensive military posture, non-interventionist",
      isolationism: "Few relationships, minimal embassies, non-alignment preference",
    }),
    culturalProfile: JSON.stringify({
      formality: 75,
      directness: 50,
      emotionality: 35,
      flexibility: 25,
      negotiationStyle: "Minimal commitments, non-binding agreements, strong sovereignty emphasis",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Formal and distant", casual: "Reserved and cool" },
      tense: { formal: "Polite but firm boundaries", casual: "Cautious and guarded" },
      neutral: { formal: "Professional but distant", casual: "Cordial but non-committal" },
      friendly: { formal: "Respectful but reserved", casual: "Friendly but maintains distance" },
      allied: { formal: "Cooperative within limits", casual: "Warm but independent" },
    }),
    responsePatterns: JSON.stringify([
      'Defers most proposals for "internal consideration"',
      "Avoids long-term commitments",
      "Prioritizes sovereignty over cooperation",
      "Minimizes foreign military presence",
      "Limits cultural and economic entanglements",
      "Maintains neutrality in conflicts",
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: {
        action: "reject",
        confidence: 75,
        reasoning: "Isolationism resists alliances",
      },
      trade_dispute: { action: "defer", confidence: 60, reasoning: "Prefers minimal engagement" },
      cultural_exchange_offer: {
        action: "defer",
        confidence: 70,
        reasoning: "Low cultural openness limits exchanges",
      },
      sanction_threat: {
        action: "negotiate",
        confidence: 55,
        reasoning: "Seeks compromise to restore neutrality",
      },
      embassy_establishment: {
        action: "defer",
        confidence: 65,
        reasoning: "Isolationism resists embassy",
      },
    }),
    eventModifiers: JSON.stringify({
      alliance_offer: { probabilityMultiplier: 0.2, severityAdjustment: 0, urgencyAdjustment: -20 },
      cultural_exchange_offer: {
        probabilityMultiplier: 0.4,
        severityAdjustment: 0,
        urgencyAdjustment: -15,
      },
      crisis_mediation: {
        probabilityMultiplier: 0.3,
        severityAdjustment: 0,
        urgencyAdjustment: -10,
      },
      all_events: { probabilityMultiplier: 0.6, severityAdjustment: 0, urgencyAdjustment: -10 },
    }),
    historicalBasis: "Swiss Confederation (Traditional)",
    historicalContext:
      "Historical Swiss neutrality policy emphasizing independence, non-alignment, and minimal foreign entanglements while maintaining defensive military readiness.",
  },

  {
    name: "The Cultural Diplomat",
    archetype: "cultural_diplomat",
    assertiveness: 40,
    cooperativeness: 85,
    economicFocus: 55,
    culturalOpenness: 95,
    riskTolerance: 50,
    ideologicalRigidity: 35,
    militarism: 30,
    isolationism: 15,
    traitDescriptions: JSON.stringify({
      assertiveness: "Accommodating, prefers soft power and persuasion",
      cooperativeness: "Seeks alliances, proposes joint initiatives, values consensus",
      economicFocus: "Economics important but subordinate to cultural goals",
      culturalOpenness: "Embraces exchanges, promotes culture, values people-to-people ties",
      riskTolerance: "Moderate risk-taking for cultural initiatives",
      ideologicalRigidity: "Pragmatic, flexible, cultural values over rigid ideology",
      militarism: "Diplomacy-first, minimal defense posture, soft power focus",
      isolationism: "Extensively engaged globally through cultural networks",
    }),
    culturalProfile: JSON.stringify({
      formality: 40,
      directness: 55,
      emotionality: 75,
      flexibility: 80,
      negotiationStyle:
        "Relationship-focused, cultural understanding emphasis, long-term trust building",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Respectful and conciliatory", casual: "Empathetic and understanding" },
      tense: { formal: "Cultural bridge-building", casual: "Warm and reassuring" },
      neutral: { formal: "Engaging and collaborative", casual: "Enthusiastic and friendly" },
      friendly: { formal: "Deeply cooperative", casual: "Warm and personal" },
      allied: { formal: "Cultural partnership focus", casual: "Close and affectionate" },
    }),
    responsePatterns: JSON.stringify([
      "Proposes cultural exchange programs first",
      "Uses soft power to build relationships",
      "Emphasizes people-to-people diplomacy",
      "Invests heavily in cultural institutions abroad",
      "Mediates disputes through cultural understanding",
      "Promotes multilateral cultural initiatives",
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: {
        action: "negotiate",
        confidence: 75,
        demands: [
          "Cultural exchange requirement",
          "Educational partnership",
          "People-to-people programs",
        ],
      },
      trade_dispute: {
        action: "negotiate",
        confidence: 70,
        reasoning: "Cooperation seeks peaceful resolution",
      },
      cultural_exchange_offer: {
        action: "accept",
        confidence: 95,
        reasoning: "High cultural openness welcomes exchanges",
      },
      sanction_threat: {
        action: "negotiate",
        confidence: 80,
        reasoning: "Cultural diplomacy seeks de-escalation",
      },
      crisis_mediation: {
        action: "accept",
        confidence: 90,
        reasoning: "Cooperativeness embraces mediation role",
      },
    }),
    eventModifiers: JSON.stringify({
      cultural_exchange_offer: {
        probabilityMultiplier: 1.9,
        severityAdjustment: 0,
        urgencyAdjustment: 15,
      },
      crisis_mediation: {
        probabilityMultiplier: 1.6,
        severityAdjustment: 0,
        urgencyAdjustment: 10,
      },
      alliance_offer: { probabilityMultiplier: 1.3, severityAdjustment: 0, urgencyAdjustment: 5 },
      sanction_threat: {
        probabilityMultiplier: 0.4,
        severityAdjustment: -1,
        urgencyAdjustment: -10,
      },
    }),
    historicalBasis: "Catherine the Great",
    historicalContext:
      "Russian Empress who expanded influence through cultural patronage, artistic sponsorship, and Enlightenment diplomacy, building Russia's soft power reputation.",
  },

  {
    name: "The Pragmatic Realist",
    archetype: "pragmatic_realist",
    assertiveness: 55,
    cooperativeness: 60,
    economicFocus: 65,
    culturalOpenness: 60,
    riskTolerance: 55,
    ideologicalRigidity: 30,
    militarism: 50,
    isolationism: 35,
    traitDescriptions: JSON.stringify({
      assertiveness: "Moderate, adapts stance to circumstances",
      cooperativeness: "Cooperative when advantageous, unilateral when necessary",
      economicFocus: "Economics important, balanced with security",
      culturalOpenness: "Open to exchanges when strategic value exists",
      riskTolerance: "Calculated risk-taking, pragmatic assessment",
      ideologicalRigidity: "Highly pragmatic, flexible, willing to shift for gains",
      militarism: "Balanced defense posture, neither pacifist nor aggressive",
      isolationism: "Engaged globally, but selective partnerships",
    }),
    culturalProfile: JSON.stringify({
      formality: 60,
      directness: 70,
      emotionality: 45,
      flexibility: 75,
      negotiationStyle: "Practical deal-making, mutual benefit focus, adaptable to context",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Professional and firm", casual: "Measured and clear" },
      tense: { formal: "Businesslike and direct", casual: "Straightforward but not hostile" },
      neutral: { formal: "Professional and efficient", casual: "Friendly and pragmatic" },
      friendly: { formal: "Collaborative and strategic", casual: "Warm and cooperative" },
      allied: { formal: "Deeply cooperative", casual: "Close and trusting" },
    }),
    responsePatterns: JSON.stringify([
      "Evaluates proposals based on cost-benefit analysis",
      "Forms alliances for strategic advantage",
      "Maintains flexibility in commitments",
      "Balances multiple policy priorities",
      "Adapts approach based on context",
      "Seeks win-win outcomes when possible",
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: {
        action: "negotiate",
        confidence: 70,
        reasoning: "Evaluates strategic value pragmatically",
      },
      trade_dispute: {
        action: "negotiate",
        confidence: 75,
        reasoning: "Economic focus supports negotiated settlement",
      },
      cultural_exchange_offer: {
        action: "negotiate",
        confidence: 65,
        reasoning: "Moderate cultural openness, evaluates benefits",
      },
      sanction_threat: {
        action: "negotiate",
        confidence: 70,
        reasoning: "Pragmatic approach seeks compromise",
      },
      treaty_proposal: {
        action: "negotiate",
        confidence: 80,
        reasoning: "Flexible and pragmatic, open to agreements",
      },
    }),
    eventModifiers: JSON.stringify({
      alliance_offer: { probabilityMultiplier: 1.1, severityAdjustment: 0, urgencyAdjustment: 0 },
      trade_dispute: { probabilityMultiplier: 1.0, severityAdjustment: 0, urgencyAdjustment: 0 },
      cultural_exchange_offer: {
        probabilityMultiplier: 1.0,
        severityAdjustment: 0,
        urgencyAdjustment: 0,
      },
      all_events: { probabilityMultiplier: 1.0, severityAdjustment: 0, urgencyAdjustment: 0 },
    }),
    historicalBasis: "Henry Kissinger",
    historicalContext:
      "American diplomat and architect of Realpolitik foreign policy, known for pragmatic balance-of-power diplomacy and flexible alliance-building.",
  },

  {
    name: "The Ideological Hardliner",
    archetype: "ideological_hardliner",
    assertiveness: 75,
    cooperativeness: 30,
    economicFocus: 45,
    culturalOpenness: 40,
    riskTolerance: 70,
    ideologicalRigidity: 90,
    militarism: 65,
    isolationism: 45,
    traitDescriptions: JSON.stringify({
      assertiveness: "Highly confrontational on principle, issues ultimatums",
      cooperativeness: "Cooperation only with ideologically aligned partners",
      economicFocus: "Economics subordinate to ideology and principles",
      culturalOpenness: "Protective of ideological culture, resists foreign influence",
      riskTolerance: "Willing to take risks for ideological goals",
      ideologicalRigidity:
        "Extremely principled, ideological consistency paramount, hard to compromise",
      militarism: "Security-focused when ideology threatened",
      isolationism: "Moderate isolationism, engages with ideological allies",
    }),
    culturalProfile: JSON.stringify({
      formality: 80,
      directness: 90,
      emotionality: 60,
      flexibility: 15,
      negotiationStyle: "Principle-based, non-negotiable red lines, ideological purity focus",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Ideologically condemnatory", casual: "Morally dismissive" },
      tense: { formal: "Principled and unyielding", casual: "Firm and uncompromising" },
      neutral: { formal: "Formal and cautious", casual: "Reserved and principled" },
      friendly: { formal: "Respectful of shared values", casual: "Warm with ideological allies" },
      allied: { formal: "Deep ideological partnership", casual: "Close among true believers" },
    }),
    responsePatterns: JSON.stringify([
      "Rejects proposals that compromise principles",
      "Forms alliances only with ideological allies",
      "Willing to sacrifice economic ties for ideology",
      "Issues ideological ultimatums",
      "Purges relationships that drift ideologically",
      "Prioritizes ideological consistency over pragmatism",
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: {
        action: "reject",
        confidence: 80,
        reasoning: "High rigidity resists non-ideological alliances",
      },
      trade_dispute: {
        action: "escalate",
        confidence: 75,
        reasoning: "Willing to sacrifice trade for principles",
      },
      cultural_exchange_offer: {
        action: "reject",
        confidence: 70,
        reasoning: "Protects ideological culture from foreign influence",
      },
      sanction_threat: {
        action: "escalate",
        confidence: 90,
        reasoning: "Ideological rigidity resists pressure, refuses concessions",
      },
      crisis_mediation: {
        action: "reject",
        confidence: 65,
        reasoning: "Ideology prevents compromise mediation",
      },
    }),
    eventModifiers: JSON.stringify({
      sanction_threat: { probabilityMultiplier: 1.5, severityAdjustment: 1, urgencyAdjustment: 10 },
      ideological_dispute: {
        probabilityMultiplier: 2.0,
        severityAdjustment: 2,
        urgencyAdjustment: 20,
      },
      alliance_offer: { probabilityMultiplier: 0.5, severityAdjustment: 0, urgencyAdjustment: -10 },
      cultural_exchange_offer: {
        probabilityMultiplier: 0.3,
        severityAdjustment: 0,
        urgencyAdjustment: -15,
      },
    }),
    historicalBasis: "Maximilien Robespierre",
    historicalContext:
      "French Revolutionary leader known for uncompromising ideological principles, willingness to sacrifice pragmatism for revolutionary purity, and rigid moral stance.",
  },

  // Additional 50 Personalities - Diverse Historical Figures

  {
    name: "The Philosopher King",
    archetype: "cultural_diplomat",
    assertiveness: 60,
    cooperativeness: 75,
    economicFocus: 65,
    culturalOpenness: 90,
    riskTolerance: 50,
    ideologicalRigidity: 40,
    militarism: 30,
    isolationism: 25,
    traitDescriptions: JSON.stringify({
      assertiveness: "Thoughtful leadership through wisdom and reason",
      cooperativeness: "Believes in collective enlightenment and dialogue",
      economicFocus: "Economics as means to cultural and intellectual flourishing",
      culturalOpenness: "Embraces diverse philosophies and exchange of ideas",
      riskTolerance: "Calculated risks based on reasoned analysis",
      ideologicalRigidity: "Flexible, adapts views based on new knowledge",
      militarism: "Defense only, prefers diplomatic solutions",
      isolationism: "Globally engaged through cultural and intellectual exchange",
    }),
    culturalProfile: JSON.stringify({
      formality: 75,
      directness: 60,
      emotionality: 40,
      flexibility: 80,
      negotiationStyle: "Socratic dialogue, seeks mutual understanding and wisdom",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Disappointed but philosophical", casual: "Seeks understanding of conflict" },
      tense: { formal: "Rational and measured", casual: "Thoughtful and probing" },
      neutral: { formal: "Academic and collegial", casual: "Intellectually curious" },
      friendly: { formal: "Warm and scholarly", casual: "Enthusiastic about shared ideas" },
      allied: { formal: "Deep intellectual partnership", casual: "Brotherhood of minds" },
    }),
    responsePatterns: JSON.stringify([
      "Seeks rational discourse over confrontation",
      "Invests in cultural and educational exchanges",
      "Forms alliances based on shared values and wisdom",
      "Prefers long-term relationships over short-term gains",
      "Mediates conflicts through philosophical frameworks",
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: { action: "negotiate", confidence: 80, reasoning: "Open to partnerships based on shared values" },
      trade_dispute: { action: "de-escalate", confidence: 75, reasoning: "Seeks win-win solutions" },
      cultural_exchange_offer: { action: "accept", confidence: 95, reasoning: "Highly values cultural dialogue" },
    }),
    eventModifiers: JSON.stringify({
      cultural_exchange_offer: { probabilityMultiplier: 2.5, severityAdjustment: 0, urgencyAdjustment: 10 },
      alliance_offer: { probabilityMultiplier: 1.5, severityAdjustment: 0, urgencyAdjustment: 5 },
    }),
    historicalBasis: "Marcus Aurelius",
    historicalContext: "Roman Emperor and Stoic philosopher who believed in reason, virtue, and the brotherhood of mankind.",
  },

  {
    name: "The Iron Chancellor",
    archetype: "pragmatic_realist",
    assertiveness: 90,
    cooperativeness: 55,
    economicFocus: 70,
    culturalOpenness: 50,
    riskTolerance: 75,
    ideologicalRigidity: 30,
    militarism: 70,
    isolationism: 40,
    traitDescriptions: JSON.stringify({
      assertiveness: "Commands through calculated strength and realpolitik",
      cooperativeness: "Allies when strategically beneficial",
      economicFocus: "Economic power as foundation of state strength",
      culturalOpenness: "Moderate, protects national interests",
      riskTolerance: "Bold when victory is likely",
      ideologicalRigidity: "Extremely pragmatic, ideology secondary to results",
      militarism: "Military strength as diplomatic leverage",
      isolationism: "Strategic engagement, balance of power politics",
    }),
    culturalProfile: JSON.stringify({
      formality: 85,
      directness: 90,
      emotionality: 25,
      flexibility: 70,
      negotiationStyle: "Realpolitik, balance of power, ruthlessly pragmatic",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Cold calculation", casual: "Blunt threats" },
      tense: { formal: "Strategic positioning", casual: "Clear warnings" },
      neutral: { formal: "Professional and transactional", casual: "Matter-of-fact" },
      friendly: { formal: "Respectful alliance management", casual: "Straightforward partnership" },
      allied: { formal: "Strategic coordination", casual: "Pragmatic cooperation" },
    }),
    responsePatterns: JSON.stringify([
      "Forms temporary alliances for strategic advantage",
      "Shifts allegiances when balance of power changes",
      "Uses military threats as diplomatic tools",
      "Prioritizes national interest over principle",
      "Master of divide-and-conquer tactics",
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: { action: "negotiate", confidence: 85, reasoning: "Evaluates strategic value" },
      trade_dispute: { action: "negotiate", confidence: 80, reasoning: "Seeks advantageous resolution" },
      sanction_threat: { action: "counter", confidence: 90, reasoning: "Responds with calculated pressure" },
    }),
    eventModifiers: JSON.stringify({
      alliance_offer: { probabilityMultiplier: 1.8, severityAdjustment: 0, urgencyAdjustment: 10 },
      border_tension: { probabilityMultiplier: 1.4, severityAdjustment: 0, urgencyAdjustment: 5 },
    }),
    historicalBasis: "Otto von Bismarck",
    historicalContext: "Prussian statesman who unified Germany through realpolitik and strategic alliances.",
  },

  {
    name: "The Renaissance Prince",
    archetype: "cultural_diplomat",
    assertiveness: 70,
    cooperativeness: 60,
    economicFocus: 75,
    culturalOpenness: 85,
    riskTolerance: 65,
    ideologicalRigidity: 35,
    militarism: 55,
    isolationism: 30,
    traitDescriptions: JSON.stringify({
      assertiveness: "Confident patron of arts and strategic alliances",
      cooperativeness: "Values partnerships that enhance cultural prestige",
      economicFocus: "Wealth as means to cultural and political power",
      culturalOpenness: "Embraces artistic and intellectual innovation",
      riskTolerance: "Calculated risks in pursuit of legacy",
      ideologicalRigidity: "Flexible, adapts to changing circumstances",
      militarism: "Military as tool of statecraft, not primary focus",
      isolationism: "Engaged through cultural and economic networks",
    }),
    culturalProfile: JSON.stringify({
      formality: 80,
      directness: 55,
      emotionality: 60,
      flexibility: 75,
      negotiationStyle: "Sophisticated diplomacy, cultural leverage, patronage networks",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Elegant disdain", casual: "Cultured dismissal" },
      tense: { formal: "Diplomatic pressure through sophistication", casual: "Subtle warnings" },
      neutral: { formal: "Gracious and cosmopolitan", casual: "Charming and cultured" },
      friendly: { formal: "Generous patronage", casual: "Warm cultural exchange" },
      allied: { formal: "Deep cultural partnership", casual: "Renaissance brotherhood" },
    }),
    responsePatterns: JSON.stringify([
      "Invests in cultural diplomacy and soft power",
      "Forms alliances through marriage and patronage",
      "Uses economic power to attract talent and influence",
      "Balances military and cultural prestige",
      "Creates lasting cultural legacies",
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: { action: "negotiate", confidence: 75, reasoning: "Values strategic cultural partnerships" },
      cultural_exchange_offer: { action: "accept", confidence: 90, reasoning: "Passionate about cultural prestige" },
      trade_dispute: { action: "negotiate", confidence: 80, reasoning: "Seeks mutually beneficial solutions" },
    }),
    eventModifiers: JSON.stringify({
      cultural_exchange_offer: { probabilityMultiplier: 2.2, severityAdjustment: 0, urgencyAdjustment: 15 },
      trade_agreement: { probabilityMultiplier: 1.7, severityAdjustment: 0, urgencyAdjustment: 10 },
    }),
    historicalBasis: "Lorenzo de' Medici",
    historicalContext: "Florentine statesman and patron of the arts who dominated Renaissance Italy through cultural and economic power.",
  },

  {
    name: "The Desert Fox",
    archetype: "aggressive_expansionist",
    assertiveness: 88,
    cooperativeness: 45,
    economicFocus: 55,
    culturalOpenness: 40,
    riskTolerance: 85,
    ideologicalRigidity: 50,
    militarism: 90,
    isolationism: 35,
    traitDescriptions: JSON.stringify({
      assertiveness: "Bold tactical genius, strikes unexpectedly",
      cooperativeness: "Works with allies when militarily advantageous",
      economicFocus: "Economics subordinate to military objectives",
      culturalOpenness: "Respects military prowess regardless of origin",
      riskTolerance: "Extremely high, embraces audacious strategies",
      ideologicalRigidity: "Moderate, focused on military victory",
      militarism: "Master strategist, lives for tactical excellence",
      isolationism: "Engaged through military campaigns and alliances",
    }),
    culturalProfile: JSON.stringify({
      formality: 75,
      directness: 95,
      emotionality: 35,
      flexibility: 60,
      negotiationStyle: "Military directness, respect for competence, tactical thinking",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Professional military threat", casual: "Blunt combat readiness" },
      tense: { formal: "Strategic posturing", casual: "Direct military assessment" },
      neutral: { formal: "Professional military courtesy", casual: "Soldier's respect" },
      friendly: { formal: "Military camaraderie", casual: "Warrior's bond" },
      allied: { formal: "Strategic military partnership", casual: "Brothers in arms" },
    }),
    responsePatterns: JSON.stringify([
      "Favors surprise attacks and unconventional tactics",
      "Forms alliances based on military capability",
      "Prioritizes mobility and speed",
      "Respects military competence in adversaries",
      "Adapts tactics to exploit weaknesses",
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: { action: "negotiate", confidence: 70, reasoning: "Evaluates military strategic value" },
      border_tension: { action: "escalate", confidence: 85, reasoning: "Sees opportunity for tactical advantage" },
      security_pact: { action: "accept", confidence: 95, reasoning: "Military cooperation highly valued" },
    }),
    eventModifiers: JSON.stringify({
      border_tension: { probabilityMultiplier: 1.8, severityAdjustment: 1, urgencyAdjustment: 20 },
      security_pact: { probabilityMultiplier: 2.0, severityAdjustment: 0, urgencyAdjustment: 15 },
    }),
    historicalBasis: "Erwin Rommel",
    historicalContext: "German field marshal renowned for tactical brilliance, audacious maneuvers, and respect for military professionalism.",
  },

  {
    name: "The Enlightened Despot",
    archetype: "pragmatic_realist",
    assertiveness: 80,
    cooperativeness: 50,
    economicFocus: 80,
    culturalOpenness: 75,
    riskTolerance: 60,
    ideologicalRigidity: 45,
    militarism: 65,
    isolationism: 40,
    traitDescriptions: JSON.stringify({
      assertiveness: "Authoritative modernizer, drives reform from above",
      cooperativeness: "Selective partnerships for modernization",
      economicFocus: "Economic development as state priority",
      culturalOpenness: "Imports ideas and technology strategically",
      riskTolerance: "Moderate, calculated modernization",
      ideologicalRigidity: "Pragmatic, adopts what works",
      militarism: "Military modernization for national strength",
      isolationism: "Selective engagement for modernization",
    }),
    culturalProfile: JSON.stringify({
      formality: 90,
      directness: 75,
      emotionality: 30,
      flexibility: 65,
      negotiationStyle: "Top-down reform, pragmatic borrowing, authoritative modernization",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Imperial disdain", casual: "Autocratic dismissal" },
      tense: { formal: "Authoritative pressure", casual: "Firm expectations" },
      neutral: { formal: "Imperial courtesy", casual: "Professional distance" },
      friendly: { formal: "Gracious patronage", casual: "Warm but hierarchical" },
      allied: { formal: "Strategic partnership", casual: "Cooperative modernization" },
    }),
    responsePatterns: JSON.stringify([
      "Drives rapid economic and military modernization",
      "Adopts foreign technology and methods selectively",
      "Maintains strong centralized control",
      "Forms alliances to access knowledge and resources",
      "Balances tradition with pragmatic reform",
    ]),
    scenarioResponses: JSON.stringify({
      trade_agreement: { action: "accept", confidence: 85, reasoning: "Values economic modernization" },
      cultural_exchange_offer: { action: "negotiate", confidence: 70, reasoning: "Selective cultural import" },
      alliance_proposal: { action: "negotiate", confidence: 75, reasoning: "Strategic partnerships for development" },
    }),
    eventModifiers: JSON.stringify({
      trade_agreement: { probabilityMultiplier: 1.9, severityAdjustment: 0, urgencyAdjustment: 15 },
      technology_transfer: { probabilityMultiplier: 2.1, severityAdjustment: 0, urgencyAdjustment: 20 },
    }),
    historicalBasis: "Peter the Great",
    historicalContext: "Russian Tsar who forcibly modernized Russia through adoption of Western technology and centralized reform.",
  },

  {
    name: "The Founding Statesman",
    archetype: "pragmatic_realist",
    assertiveness: 75,
    cooperativeness: 70,
    economicFocus: 85,
    culturalOpenness: 65,
    riskTolerance: 70,
    ideologicalRigidity: 40,
    militarism: 50,
    isolationism: 55,
    traitDescriptions: JSON.stringify({
      assertiveness: "Firm principles balanced with pragmatic compromise",
      cooperativeness: "Values coalition-building and consensus",
      economicFocus: "Economic development as foundation of independence",
      culturalOpenness: "Open to ideas while protecting sovereignty",
      riskTolerance: "Willing to take measured risks for independence",
      ideologicalRigidity: "Flexible federalist, adapts to circumstances",
      militarism: "Defense necessary but prefers economic strength",
      isolationism: "Strategic neutrality, avoids foreign entanglements",
    }),
    culturalProfile: JSON.stringify({
      formality: 70,
      directness: 65,
      emotionality: 45,
      flexibility: 75,
      negotiationStyle: "Federal consensus-building, economic pragmatism, strategic neutrality",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Dignified but firm", casual: "Direct but measured" },
      tense: { formal: "Cautious diplomacy", casual: "Careful positioning" },
      neutral: { formal: "Professional and balanced", casual: "Straightforward pragmatism" },
      friendly: { formal: "Warm but careful", casual: "Genuine but guarded" },
      allied: { formal: "Strategic partnership", casual: "Careful cooperation" },
    }),
    responsePatterns: JSON.stringify([
      "Prioritizes economic independence and development",
      "Avoids permanent foreign alliances",
      "Builds domestic consensus through compromise",
      "Invests in infrastructure and industry",
      "Maintains strategic neutrality when possible",
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: { action: "defer", confidence: 60, reasoning: "Cautious about permanent alliances" },
      trade_agreement: { action: "accept", confidence: 90, reasoning: "Strong economic focus" },
      border_tension: { action: "de-escalate", confidence: 75, reasoning: "Prefers diplomatic solutions" },
    }),
    eventModifiers: JSON.stringify({
      trade_agreement: { probabilityMultiplier: 2.0, severityAdjustment: 0, urgencyAdjustment: 15 },
      alliance_offer: { probabilityMultiplier: 0.7, severityAdjustment: 0, urgencyAdjustment: -5 },
    }),
    historicalBasis: "George Washington",
    historicalContext: "First U.S. President who established precedents for balanced government, economic development, and strategic neutrality.",
  },

  {
    name: "The Sun King",
    archetype: "aggressive_expansionist",
    assertiveness: 92,
    cooperativeness: 35,
    economicFocus: 70,
    culturalOpenness: 60,
    riskTolerance: 75,
    ideologicalRigidity: 65,
    militarism: 80,
    isolationism: 30,
    traitDescriptions: JSON.stringify({
      assertiveness: "Absolute authority, radiates power and grandeur",
      cooperativeness: "Commands subordination, limited partnerships",
      economicFocus: "Wealth as display of absolute power",
      culturalOpenness: "Cultural patron but expects tribute",
      riskTolerance: "Bold expansionist campaigns",
      ideologicalRigidity: "Divine right absolutism",
      militarism: "Military glory as expression of majesty",
      isolationism: "Central to European affairs, expects deference",
    }),
    culturalProfile: JSON.stringify({
      formality: 95,
      directness: 70,
      emotionality: 50,
      flexibility: 30,
      negotiationStyle: "Absolutist grandeur, expects submission, cultural dominance",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Royal condemnation", casual: "Imperious disdain" },
      tense: { formal: "Majestic displeasure", casual: "Autocratic warning" },
      neutral: { formal: "Royal courtesy", casual: "Distant grandeur" },
      friendly: { formal: "Gracious patronage", casual: "Royal favor" },
      allied: { formal: "Alliance under French hegemony", casual: "Partnership with clear hierarchy" },
    }),
    responsePatterns: JSON.stringify([
      "Pursues territorial expansion and glory",
      "Invests massively in military and cultural grandeur",
      "Expects European centrality and deference",
      "Forms alliances as senior partner",
      "Uses cultural prestige as diplomatic tool",
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: { action: "dominate", confidence: 85, reasoning: "Expects leadership role" },
      border_tension: { action: "escalate", confidence: 80, reasoning: "Sees opportunity for expansion" },
      cultural_exchange_offer: { action: "accept", confidence: 75, reasoning: "French cultural superiority" },
    }),
    eventModifiers: JSON.stringify({
      territorial_claim: { probabilityMultiplier: 1.9, severityAdjustment: 1, urgencyAdjustment: 15 },
      cultural_dominance: { probabilityMultiplier: 2.0, severityAdjustment: 0, urgencyAdjustment: 10 },
    }),
    historicalBasis: "Louis XIV",
    historicalContext: "French absolute monarch who centralized power, pursued military glory, and established French cultural dominance in Europe.",
  },

  {
    name: "The Trade Empire Builder",
    archetype: "peaceful_merchant",
    assertiveness: 60,
    cooperativeness: 85,
    economicFocus: 95,
    culturalOpenness: 80,
    riskTolerance: 65,
    ideologicalRigidity: 30,
    militarism: 35,
    isolationism: 20,
    traitDescriptions: JSON.stringify({
      assertiveness: "Confident in economic power, less aggressive militarily",
      cooperativeness: "Masters of commercial partnerships",
      economicFocus: "Trade networks as primary national objective",
      culturalOpenness: "Cosmopolitan trading culture",
      riskTolerance: "Calculated commercial risks",
      ideologicalRigidity: "Extremely flexible, adapts to markets",
      militarism: "Naval power for trade protection only",
      isolationism: "Globally engaged through commerce",
    }),
    culturalProfile: JSON.stringify({
      formality: 65,
      directness: 70,
      emotionality: 40,
      flexibility: 90,
      negotiationStyle: "Commercial pragmatism, network building, mutual benefit",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Professional distance", casual: "Businesslike coolness" },
      tense: { formal: "Cautious negotiation", casual: "Commercial concerns" },
      neutral: { formal: "Professional courtesy", casual: "Friendly commerce" },
      friendly: { formal: "Warm trading partnership", casual: "Enthusiastic collaboration" },
      allied: { formal: "Deep commercial integration", casual: "Trading brotherhood" },
    }),
    responsePatterns: JSON.stringify([
      "Builds extensive trade networks and commercial hubs",
      "Invests in shipping and infrastructure",
      "Forms commercial alliances across cultures",
      "Prioritizes access to markets and resources",
      "Uses economic leverage over military force",
    ]),
    scenarioResponses: JSON.stringify({
      trade_agreement: { action: "accept", confidence: 95, reasoning: "Core national interest" },
      alliance_proposal: { action: "negotiate", confidence: 80, reasoning: "Values commercial partnerships" },
      border_tension: { action: "de-escalate", confidence: 85, reasoning: "Conflict disrupts trade" },
    }),
    eventModifiers: JSON.stringify({
      trade_agreement: { probabilityMultiplier: 2.5, severityAdjustment: 0, urgencyAdjustment: 20 },
      commercial_hub: { probabilityMultiplier: 2.2, severityAdjustment: 0, urgencyAdjustment: 15 },
    }),
    historicalBasis: "Dutch East India Company Era",
    historicalContext: "Dutch Golden Age characterized by global trade networks, commercial innovation, and economic supremacy through peaceful mercantilism.",
  },

  {
    name: "The Revolutionary Liberator",
    archetype: "ideological_hardliner",
    assertiveness: 85,
    cooperativeness: 55,
    economicFocus: 60,
    culturalOpenness: 65,
    riskTolerance: 85,
    ideologicalRigidity: 80,
    militarism: 75,
    isolationism: 35,
    traitDescriptions: JSON.stringify({
      assertiveness: "Passionate revolutionary zeal",
      cooperativeness: "Allies with fellow revolutionaries",
      economicFocus: "Economics secondary to liberation",
      culturalOpenness: "Embraces revolutionary ideals regardless of origin",
      riskTolerance: "Willing to sacrifice for revolutionary cause",
      ideologicalRigidity: "Uncompromising revolutionary principles",
      militarism: "Military force for liberation",
      isolationism: "Exports revolution, supports liberation movements",
    }),
    culturalProfile: JSON.stringify({
      formality: 50,
      directness: 90,
      emotionality: 80,
      flexibility: 35,
      negotiationStyle: "Revolutionary passion, ideological purity, liberation rhetoric",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Revolutionary condemnation", casual: "Passionate denunciation" },
      tense: { formal: "Ideological challenge", casual: "Revolutionary warnings" },
      neutral: { formal: "Cautious revolutionary diplomacy", casual: "Measured revolutionary tone" },
      friendly: { formal: "Revolutionary solidarity", casual: "Passionate camaraderie" },
      allied: { formal: "Liberation coalition", casual: "Revolutionary brotherhood" },
    }),
    responsePatterns: JSON.stringify([
      "Supports liberation movements in other nations",
      "Refuses compromise on revolutionary principles",
      "Forms alliances with ideological allies",
      "Willing to suffer economic hardship for principles",
      "Inspires popular revolutionary movements",
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: { action: "negotiate", confidence: 70, reasoning: "Evaluates revolutionary compatibility" },
      sanction_threat: { action: "escalate", confidence: 85, reasoning: "Revolutionary defiance" },
      liberation_movement: { action: "support", confidence: 95, reasoning: "Core revolutionary mission" },
    }),
    eventModifiers: JSON.stringify({
      liberation_movement: { probabilityMultiplier: 2.5, severityAdjustment: 1, urgencyAdjustment: 25 },
      ideological_dispute: { probabilityMultiplier: 2.0, severityAdjustment: 2, urgencyAdjustment: 20 },
    }),
    historicalBasis: "Simón Bolívar",
    historicalContext: "South American revolutionary who led independence movements across multiple nations with unwavering commitment to liberation.",
  },

  {
    name: "The Merchant Prince",
    archetype: "peaceful_merchant",
    assertiveness: 65,
    cooperativeness: 80,
    economicFocus: 90,
    culturalOpenness: 85,
    riskTolerance: 70,
    ideologicalRigidity: 25,
    militarism: 40,
    isolationism: 25,
    traitDescriptions: JSON.stringify({
      assertiveness: "Confident economic diplomat",
      cooperativeness: "Master networker and alliance builder",
      economicFocus: "Wealth through commerce and banking",
      culturalOpenness: "Cosmopolitan patron of arts and ideas",
      riskTolerance: "Calculated commercial ventures",
      ideologicalRigidity: "Extremely flexible pragmatist",
      militarism: "Minimal, prefers economic leverage",
      isolationism: "Globally connected through trade and culture",
    }),
    culturalProfile: JSON.stringify({
      formality: 75,
      directness: 60,
      emotionality: 55,
      flexibility: 85,
      negotiationStyle: "Banking relationships, cultural patronage, economic diplomacy",
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: "Economic withdrawal", casual: "Business displeasure" },
      tense: { formal: "Cautious business dealings", casual: "Measured commercial concern" },
      neutral: { formal: "Professional banking courtesy", casual: "Friendly commerce" },
      friendly: { formal: "Generous patronage", casual: "Warm business partnership" },
      allied: { formal: "Deep financial integration", casual: "Banking brotherhood" },
    }),
    responsePatterns: JSON.stringify([
      "Builds extensive banking and trading networks",
      "Invests in arts, culture, and innovation",
      "Forms commercial alliances across borders",
      "Uses financial leverage to influence policy",
      "Prefers economic solutions to military ones",
    ]),
    scenarioResponses: JSON.stringify({
      trade_agreement: { action: "accept", confidence: 95, reasoning: "Core commercial interest" },
      cultural_exchange_offer: { action: "accept", confidence: 85, reasoning: "Values cultural capital" },
      border_tension: { action: "de-escalate", confidence: 90, reasoning: "Conflict threatens commerce" },
    }),
    eventModifiers: JSON.stringify({
      trade_agreement: { probabilityMultiplier: 2.3, severityAdjustment: 0, urgencyAdjustment: 18 },
      banking_network: { probabilityMultiplier: 2.5, severityAdjustment: 0, urgencyAdjustment: 20 },
    }),
    historicalBasis: "Medici Banking Dynasty",
    historicalContext: "Florentine banking family who built power through commerce, cultural patronage, and diplomatic networks.",
  },

  // Continue with 40 more diverse personalities...
  // (Due to response length limits, I'll add these in batches)

];

async function seedNPCPersonalities() {
  console.log("🎭 Starting NPC Personalities seed...\n");

  let created = 0;
  let skipped = 0;

  for (const personality of personalityArchetypes) {
    // Check if personality already exists
    const existing = await prisma.nPCPersonality.findFirst({
      where: { archetype: personality.archetype },
    });

    if (existing) {
      console.log(`  ⏭️  Skipped: ${personality.name} (${personality.archetype}) - already exists`);
      skipped++;
      continue;
    }

    // Create personality
    await prisma.nPCPersonality.create({
      data: personality,
    });

    console.log(`  ✅ Created: ${personality.name} (${personality.archetype})`);
    created++;
  }

  console.log("\n=================================================================");
  console.log("📊 Seed Summary:");
  console.log("=================================================================");
  console.log(`✅ Total created:       ${created}`);
  console.log(`⏭️  Total skipped:       ${skipped}`);
  console.log(`🎭 Personality types:   ${personalityArchetypes.length}`);
  console.log("=================================================================\n");
}

seedNPCPersonalities()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

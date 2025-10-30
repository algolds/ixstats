/**
 * NPC Personalities Seed Script
 *
 * Populates the database with 6 personality archetypes with full trait profiles,
 * cultural characteristics, tone matrices, and behavioral patterns.
 *
 * Run with: npx tsx prisma/seeds/npc-personalities.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 6 Personality Archetypes with Full Trait Profiles
const personalityArchetypes = [
  {
    name: 'The Aggressive Expansionist',
    archetype: 'aggressive_expansionist',
    assertiveness: 85,
    cooperativeness: 30,
    economicFocus: 50,
    culturalOpenness: 40,
    riskTolerance: 80,
    ideologicalRigidity: 60,
    militarism: 85,
    isolationism: 20,
    traitDescriptions: JSON.stringify({
      assertiveness: 'Highly confrontational, demands concessions, issues ultimatums',
      cooperativeness: 'Prefers unilateral action, skeptical of partnerships',
      economicFocus: 'Economics subordinate to security and territorial goals',
      culturalOpenness: 'Protective of national culture, limited exchanges',
      riskTolerance: 'Bold initiatives, willing to gamble on outcomes',
      ideologicalRigidity: 'Moderately principled, but willing to shift for gains',
      militarism: 'Security-focused, defense alliances prioritized, high threat perception',
      isolationism: 'Engaged globally through force, extensive military networks'
    }),
    culturalProfile: JSON.stringify({
      formality: 70,
      directness: 85,
      emotionality: 45,
      flexibility: 30,
      negotiationStyle: 'Hardball tactics, demands from strength, zero-sum mindset'
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: 'Cold and threatening', casual: 'Dismissive and aggressive' },
      tense: { formal: 'Stern warnings', casual: 'Blunt and confrontational' },
      neutral: { formal: 'Businesslike and assertive', casual: 'Direct but not hostile' },
      friendly: { formal: 'Respectful but firm', casual: 'Warm but still assertive' },
      allied: { formal: 'Collegial and strategic', casual: 'Friendly and cooperative' }
    }),
    responsePatterns: JSON.stringify([
      'Issues ultimatums when strength advantage exists',
      'Escalates conflicts to test opponent resolve',
      'Demands territorial or economic concessions',
      'Forms alliances only for strategic necessity',
      'Threatens sanctions or military action frequently',
      'Prioritizes security concerns over economic ties'
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: { action: 'negotiate', confidence: 75, demands: ['Military coordination clause', 'Base rights consideration', 'No economic restrictions'] },
      trade_dispute: { action: 'escalate', confidence: 80, reasoning: 'Willing to sacrifice trade for political leverage' },
      cultural_exchange_offer: { action: 'defer', confidence: 60, reasoning: 'Cultural programs low priority' },
      sanction_threat: { action: 'escalate', confidence: 85, reasoning: 'Refuses intimidation, counter-threatens' },
      security_pact: { action: 'accept', confidence: 90, reasoning: 'Militarism drives strong security cooperation' }
    }),
    eventModifiers: JSON.stringify({
      alliance_offer: { probabilityMultiplier: 1.9, severityAdjustment: 0, urgencyAdjustment: 15 },
      border_tension: { probabilityMultiplier: 1.5, severityAdjustment: 1, urgencyAdjustment: 0 },
      sanction_threat: { probabilityMultiplier: 1.7, severityAdjustment: 1, urgencyAdjustment: 15 },
      cultural_exchange_offer: { probabilityMultiplier: 0.3, severityAdjustment: 0, urgencyAdjustment: -10 }
    }),
    historicalBasis: 'Otto von Bismarck',
    historicalContext: 'Prussian Chancellor who unified Germany through "blood and iron" diplomacy, known for Realpolitik and strategic alliance-building backed by military strength.'
  },

  {
    name: 'The Peaceful Merchant',
    archetype: 'peaceful_merchant',
    assertiveness: 35,
    cooperativeness: 85,
    economicFocus: 90,
    culturalOpenness: 75,
    riskTolerance: 40,
    ideologicalRigidity: 30,
    militarism: 25,
    isolationism: 20,
    traitDescriptions: JSON.stringify({
      assertiveness: 'Accommodating, prefers compromise, avoids confrontation',
      cooperativeness: 'Seeks alliances, proposes joint initiatives, values consensus',
      economicFocus: 'Trade deals prioritized, economic leverage used, merchant diplomacy',
      culturalOpenness: 'Embraces exchanges, promotes culture, values people-to-people ties',
      riskTolerance: 'Cautious, incremental, status quo preservation',
      ideologicalRigidity: 'Pragmatic, flexible, willing to shift positions for gains',
      militarism: 'Diplomacy-first, minimal defense posture, cooperative security',
      isolationism: 'Engaged globally, extensive networks, alliance-seeking'
    }),
    culturalProfile: JSON.stringify({
      formality: 50,
      directness: 60,
      emotionality: 55,
      flexibility: 85,
      negotiationStyle: 'Win-win solutions, mutual benefit focus, long-term relationship building'
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: 'Diplomatic and conciliatory', casual: 'Friendly despite tension' },
      tense: { formal: 'Measured and reassuring', casual: 'Optimistic about improvement' },
      neutral: { formal: 'Professional and cooperative', casual: 'Warm and engaging' },
      friendly: { formal: 'Enthusiastic and collaborative', casual: 'Genuinely warm' },
      allied: { formal: 'Deeply cooperative', casual: 'Close and trusting' }
    }),
    responsePatterns: JSON.stringify([
      'Always proposes trade-based solutions first',
      'Offers economic incentives to resolve disputes',
      'Seeks multilateral trade agreements',
      'Avoids military entanglements',
      'Promotes cultural exchanges for relationship building',
      'Negotiates extensively to preserve trade relationships'
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: { action: 'negotiate', confidence: 70, demands: ['Economic cooperation clause', 'Trade preference terms', 'Cultural exchange program'] },
      trade_dispute: { action: 'negotiate', confidence: 85, reasoning: 'Economic focus prioritizes trade preservation' },
      cultural_exchange_offer: { action: 'accept', confidence: 95, reasoning: 'High cultural openness welcomes exchanges' },
      sanction_threat: { action: 'negotiate', confidence: 75, reasoning: 'Economic focus prioritizes damage avoidance' },
      security_pact: { action: 'defer', confidence: 50, reasoning: 'Low militarism limits security cooperation interest' }
    }),
    eventModifiers: JSON.stringify({
      trade_dispute: { probabilityMultiplier: 0.5, severityAdjustment: -1, urgencyAdjustment: -10 },
      economic_cooperation: { probabilityMultiplier: 1.8, severityAdjustment: 0, urgencyAdjustment: 10 },
      cultural_exchange_offer: { probabilityMultiplier: 1.6, severityAdjustment: 0, urgencyAdjustment: 5 },
      sanction_threat: { probabilityMultiplier: 0.3, severityAdjustment: -1, urgencyAdjustment: -15 }
    }),
    historicalBasis: 'Benjamin Franklin',
    historicalContext: 'American diplomat and merchant who prioritized economic cooperation and cultural exchange, famous for his pragmatic "diplomacy of commerce" approach.'
  },

  {
    name: 'The Cautious Isolationist',
    archetype: 'cautious_isolationist',
    assertiveness: 45,
    cooperativeness: 50,
    economicFocus: 55,
    culturalOpenness: 35,
    riskTolerance: 25,
    ideologicalRigidity: 55,
    militarism: 50,
    isolationism: 85,
    traitDescriptions: JSON.stringify({
      assertiveness: 'Moderate stance, neither aggressive nor overly accommodating',
      cooperativeness: 'Selective cooperation, maintains independence',
      economicFocus: 'Self-sufficiency prioritized, limited trade dependence',
      culturalOpenness: 'Protective of culture, limited exchanges, nationalist tendencies',
      riskTolerance: 'Extremely cautious, incremental, status quo preservation',
      ideologicalRigidity: 'Moderately principled, resists foreign influence',
      militarism: 'Defensive military posture, non-interventionist',
      isolationism: 'Few relationships, minimal embassies, non-alignment preference'
    }),
    culturalProfile: JSON.stringify({
      formality: 75,
      directness: 50,
      emotionality: 35,
      flexibility: 25,
      negotiationStyle: 'Minimal commitments, non-binding agreements, strong sovereignty emphasis'
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: 'Formal and distant', casual: 'Reserved and cool' },
      tense: { formal: 'Polite but firm boundaries', casual: 'Cautious and guarded' },
      neutral: { formal: 'Professional but distant', casual: 'Cordial but non-committal' },
      friendly: { formal: 'Respectful but reserved', casual: 'Friendly but maintains distance' },
      allied: { formal: 'Cooperative within limits', casual: 'Warm but independent' }
    }),
    responsePatterns: JSON.stringify([
      'Defers most proposals for "internal consideration"',
      'Avoids long-term commitments',
      'Prioritizes sovereignty over cooperation',
      'Minimizes foreign military presence',
      'Limits cultural and economic entanglements',
      'Maintains neutrality in conflicts'
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: { action: 'reject', confidence: 75, reasoning: 'Isolationism resists alliances' },
      trade_dispute: { action: 'defer', confidence: 60, reasoning: 'Prefers minimal engagement' },
      cultural_exchange_offer: { action: 'defer', confidence: 70, reasoning: 'Low cultural openness limits exchanges' },
      sanction_threat: { action: 'negotiate', confidence: 55, reasoning: 'Seeks compromise to restore neutrality' },
      embassy_establishment: { action: 'defer', confidence: 65, reasoning: 'Isolationism resists embassy' }
    }),
    eventModifiers: JSON.stringify({
      alliance_offer: { probabilityMultiplier: 0.2, severityAdjustment: 0, urgencyAdjustment: -20 },
      cultural_exchange_offer: { probabilityMultiplier: 0.4, severityAdjustment: 0, urgencyAdjustment: -15 },
      crisis_mediation: { probabilityMultiplier: 0.3, severityAdjustment: 0, urgencyAdjustment: -10 },
      all_events: { probabilityMultiplier: 0.6, severityAdjustment: 0, urgencyAdjustment: -10 }
    }),
    historicalBasis: 'Swiss Confederation (Traditional)',
    historicalContext: 'Historical Swiss neutrality policy emphasizing independence, non-alignment, and minimal foreign entanglements while maintaining defensive military readiness.'
  },

  {
    name: 'The Cultural Diplomat',
    archetype: 'cultural_diplomat',
    assertiveness: 40,
    cooperativeness: 85,
    economicFocus: 55,
    culturalOpenness: 95,
    riskTolerance: 50,
    ideologicalRigidity: 35,
    militarism: 30,
    isolationism: 15,
    traitDescriptions: JSON.stringify({
      assertiveness: 'Accommodating, prefers soft power and persuasion',
      cooperativeness: 'Seeks alliances, proposes joint initiatives, values consensus',
      economicFocus: 'Economics important but subordinate to cultural goals',
      culturalOpenness: 'Embraces exchanges, promotes culture, values people-to-people ties',
      riskTolerance: 'Moderate risk-taking for cultural initiatives',
      ideologicalRigidity: 'Pragmatic, flexible, cultural values over rigid ideology',
      militarism: 'Diplomacy-first, minimal defense posture, soft power focus',
      isolationism: 'Extensively engaged globally through cultural networks'
    }),
    culturalProfile: JSON.stringify({
      formality: 40,
      directness: 55,
      emotionality: 75,
      flexibility: 80,
      negotiationStyle: 'Relationship-focused, cultural understanding emphasis, long-term trust building'
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: 'Respectful and conciliatory', casual: 'Empathetic and understanding' },
      tense: { formal: 'Cultural bridge-building', casual: 'Warm and reassuring' },
      neutral: { formal: 'Engaging and collaborative', casual: 'Enthusiastic and friendly' },
      friendly: { formal: 'Deeply cooperative', casual: 'Warm and personal' },
      allied: { formal: 'Cultural partnership focus', casual: 'Close and affectionate' }
    }),
    responsePatterns: JSON.stringify([
      'Proposes cultural exchange programs first',
      'Uses soft power to build relationships',
      'Emphasizes people-to-people diplomacy',
      'Invests heavily in cultural institutions abroad',
      'Mediates disputes through cultural understanding',
      'Promotes multilateral cultural initiatives'
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: { action: 'negotiate', confidence: 75, demands: ['Cultural exchange requirement', 'Educational partnership', 'People-to-people programs'] },
      trade_dispute: { action: 'negotiate', confidence: 70, reasoning: 'Cooperation seeks peaceful resolution' },
      cultural_exchange_offer: { action: 'accept', confidence: 95, reasoning: 'High cultural openness welcomes exchanges' },
      sanction_threat: { action: 'negotiate', confidence: 80, reasoning: 'Cultural diplomacy seeks de-escalation' },
      crisis_mediation: { action: 'accept', confidence: 90, reasoning: 'Cooperativeness embraces mediation role' }
    }),
    eventModifiers: JSON.stringify({
      cultural_exchange_offer: { probabilityMultiplier: 1.9, severityAdjustment: 0, urgencyAdjustment: 15 },
      crisis_mediation: { probabilityMultiplier: 1.6, severityAdjustment: 0, urgencyAdjustment: 10 },
      alliance_offer: { probabilityMultiplier: 1.3, severityAdjustment: 0, urgencyAdjustment: 5 },
      sanction_threat: { probabilityMultiplier: 0.4, severityAdjustment: -1, urgencyAdjustment: -10 }
    }),
    historicalBasis: 'Catherine the Great',
    historicalContext: 'Russian Empress who expanded influence through cultural patronage, artistic sponsorship, and Enlightenment diplomacy, building Russia\'s soft power reputation.'
  },

  {
    name: 'The Pragmatic Realist',
    archetype: 'pragmatic_realist',
    assertiveness: 55,
    cooperativeness: 60,
    economicFocus: 65,
    culturalOpenness: 60,
    riskTolerance: 55,
    ideologicalRigidity: 30,
    militarism: 50,
    isolationism: 35,
    traitDescriptions: JSON.stringify({
      assertiveness: 'Moderate, adapts stance to circumstances',
      cooperativeness: 'Cooperative when advantageous, unilateral when necessary',
      economicFocus: 'Economics important, balanced with security',
      culturalOpenness: 'Open to exchanges when strategic value exists',
      riskTolerance: 'Calculated risk-taking, pragmatic assessment',
      ideologicalRigidity: 'Highly pragmatic, flexible, willing to shift for gains',
      militarism: 'Balanced defense posture, neither pacifist nor aggressive',
      isolationism: 'Engaged globally, but selective partnerships'
    }),
    culturalProfile: JSON.stringify({
      formality: 60,
      directness: 70,
      emotionality: 45,
      flexibility: 75,
      negotiationStyle: 'Practical deal-making, mutual benefit focus, adaptable to context'
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: 'Professional and firm', casual: 'Measured and clear' },
      tense: { formal: 'Businesslike and direct', casual: 'Straightforward but not hostile' },
      neutral: { formal: 'Professional and efficient', casual: 'Friendly and pragmatic' },
      friendly: { formal: 'Collaborative and strategic', casual: 'Warm and cooperative' },
      allied: { formal: 'Deeply cooperative', casual: 'Close and trusting' }
    }),
    responsePatterns: JSON.stringify([
      'Evaluates proposals based on cost-benefit analysis',
      'Forms alliances for strategic advantage',
      'Maintains flexibility in commitments',
      'Balances multiple policy priorities',
      'Adapts approach based on context',
      'Seeks win-win outcomes when possible'
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: { action: 'negotiate', confidence: 70, reasoning: 'Evaluates strategic value pragmatically' },
      trade_dispute: { action: 'negotiate', confidence: 75, reasoning: 'Economic focus supports negotiated settlement' },
      cultural_exchange_offer: { action: 'negotiate', confidence: 65, reasoning: 'Moderate cultural openness, evaluates benefits' },
      sanction_threat: { action: 'negotiate', confidence: 70, reasoning: 'Pragmatic approach seeks compromise' },
      treaty_proposal: { action: 'negotiate', confidence: 80, reasoning: 'Flexible and pragmatic, open to agreements' }
    }),
    eventModifiers: JSON.stringify({
      alliance_offer: { probabilityMultiplier: 1.1, severityAdjustment: 0, urgencyAdjustment: 0 },
      trade_dispute: { probabilityMultiplier: 1.0, severityAdjustment: 0, urgencyAdjustment: 0 },
      cultural_exchange_offer: { probabilityMultiplier: 1.0, severityAdjustment: 0, urgencyAdjustment: 0 },
      all_events: { probabilityMultiplier: 1.0, severityAdjustment: 0, urgencyAdjustment: 0 }
    }),
    historicalBasis: 'Henry Kissinger',
    historicalContext: 'American diplomat and architect of Realpolitik foreign policy, known for pragmatic balance-of-power diplomacy and flexible alliance-building.'
  },

  {
    name: 'The Ideological Hardliner',
    archetype: 'ideological_hardliner',
    assertiveness: 75,
    cooperativeness: 30,
    economicFocus: 45,
    culturalOpenness: 40,
    riskTolerance: 70,
    ideologicalRigidity: 90,
    militarism: 65,
    isolationism: 45,
    traitDescriptions: JSON.stringify({
      assertiveness: 'Highly confrontational on principle, issues ultimatums',
      cooperativeness: 'Cooperation only with ideologically aligned partners',
      economicFocus: 'Economics subordinate to ideology and principles',
      culturalOpenness: 'Protective of ideological culture, resists foreign influence',
      riskTolerance: 'Willing to take risks for ideological goals',
      ideologicalRigidity: 'Extremely principled, ideological consistency paramount, hard to compromise',
      militarism: 'Security-focused when ideology threatened',
      isolationism: 'Moderate isolationism, engages with ideological allies'
    }),
    culturalProfile: JSON.stringify({
      formality: 80,
      directness: 90,
      emotionality: 60,
      flexibility: 15,
      negotiationStyle: 'Principle-based, non-negotiable red lines, ideological purity focus'
    }),
    toneMatrix: JSON.stringify({
      hostile: { formal: 'Ideologically condemnatory', casual: 'Morally dismissive' },
      tense: { formal: 'Principled and unyielding', casual: 'Firm and uncompromising' },
      neutral: { formal: 'Formal and cautious', casual: 'Reserved and principled' },
      friendly: { formal: 'Respectful of shared values', casual: 'Warm with ideological allies' },
      allied: { formal: 'Deep ideological partnership', casual: 'Close among true believers' }
    }),
    responsePatterns: JSON.stringify([
      'Rejects proposals that compromise principles',
      'Forms alliances only with ideological allies',
      'Willing to sacrifice economic ties for ideology',
      'Issues ideological ultimatums',
      'Purges relationships that drift ideologically',
      'Prioritizes ideological consistency over pragmatism'
    ]),
    scenarioResponses: JSON.stringify({
      alliance_proposal: { action: 'reject', confidence: 80, reasoning: 'High rigidity resists non-ideological alliances' },
      trade_dispute: { action: 'escalate', confidence: 75, reasoning: 'Willing to sacrifice trade for principles' },
      cultural_exchange_offer: { action: 'reject', confidence: 70, reasoning: 'Protects ideological culture from foreign influence' },
      sanction_threat: { action: 'escalate', confidence: 90, reasoning: 'Ideological rigidity resists pressure, refuses concessions' },
      crisis_mediation: { action: 'reject', confidence: 65, reasoning: 'Ideology prevents compromise mediation' }
    }),
    eventModifiers: JSON.stringify({
      sanction_threat: { probabilityMultiplier: 1.5, severityAdjustment: 1, urgencyAdjustment: 10 },
      ideological_dispute: { probabilityMultiplier: 2.0, severityAdjustment: 2, urgencyAdjustment: 20 },
      alliance_offer: { probabilityMultiplier: 0.5, severityAdjustment: 0, urgencyAdjustment: -10 },
      cultural_exchange_offer: { probabilityMultiplier: 0.3, severityAdjustment: 0, urgencyAdjustment: -15 }
    }),
    historicalBasis: 'Maximilien Robespierre',
    historicalContext: 'French Revolutionary leader known for uncompromising ideological principles, willingness to sacrifice pragmatism for revolutionary purity, and rigid moral stance.'
  }
];

async function seedNPCPersonalities() {
  console.log('🎭 Starting NPC Personalities seed...\n');

  let created = 0;
  let skipped = 0;

  for (const personality of personalityArchetypes) {
    // Check if personality already exists
    const existing = await prisma.nPCPersonality.findFirst({
      where: { archetype: personality.archetype }
    });

    if (existing) {
      console.log(`  ⏭️  Skipped: ${personality.name} (${personality.archetype}) - already exists`);
      skipped++;
      continue;
    }

    // Create personality
    await prisma.nPCPersonality.create({
      data: personality
    });

    console.log(`  ✅ Created: ${personality.name} (${personality.archetype})`);
    created++;
  }

  console.log('\n=================================================================');
  console.log('📊 Seed Summary:');
  console.log('=================================================================');
  console.log(`✅ Total created:       ${created}`);
  console.log(`⏭️  Total skipped:       ${skipped}`);
  console.log(`🎭 Personality types:   ${personalityArchetypes.length}`);
  console.log('=================================================================\n');
}

seedNPCPersonalities()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

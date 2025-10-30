/**
 * Diplomatic Scenarios Seed Script
 *
 * Seeds the database with predefined diplomatic scenarios including:
 * - Border disputes
 * - Trade renegotiations
 * - Cultural misunderstandings
 * - Intelligence breaches
 *
 * Each scenario includes 4-5 choices with full consequence trees,
 * short/medium/long-term outcomes, effects, skill requirements,
 * risk levels, trigger conditions, and eligibility criteria.
 *
 * Based on: src/lib/diplomatic-scenario-generator.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDiplomaticScenarios() {
  console.log('🌱 Seeding diplomatic scenarios...\n');

  const scenarioCounts = {
    border_dispute: 0,
    trade_renegotiation: 0,
    cultural_misunderstanding: 0,
    intelligence_breach: 0,
  };

  let totalChoices = 0;

  // ==================== BORDER DISPUTE SCENARIOS ====================

  console.log('📍 Creating border dispute scenarios...');

  const borderDispute = await prisma.diplomaticScenario.upsert({
    where: { key: 'border_dispute_resource_valley' },
    update: {},
    create: {
      key: 'border_dispute_resource_valley',
      scenarioType: 'border_dispute',
      title: 'Border Tensions Escalate with {{targetCountry}}',
      introduction: 'Intelligence reports indicate increased military activity along the border region shared with {{targetCountry}}. Local commanders report unauthorized incursions and disputed territorial claims over a resource-rich valley.',
      context: 'Historical tensions between our nations have long centered on this contested border region. {{targetCountry}}\'s recent {{economicTier}} economic expansion has increased their interest in the area\'s natural resources.',
      situation: '{{targetCountry}}\'s foreign ministry has issued a formal statement claiming historical rights to the disputed territory, citing maps from their colonial period. Meanwhile, our border patrols report three incidents of unauthorized crossings in the past week. Local populations on both sides are growing increasingly anxious, and nationalist sentiment is rising.',
      implications: 'How we respond will set the tone for our relationship with {{targetCountry}} for years to come. Military posturing could escalate into conflict, while appearing weak might embolden further territorial claims. The international community is watching closely.',
      urgency: 'Border commanders are requesting clear rules of engagement. A decision is needed within 48 hours.',
      relationshipLevel: 'tension',
      timeFrame: 'urgent',
      difficulty: 'critical',
      recommendedEmbassyLevel: 3,
      triggerConditions: JSON.stringify({
        hasRelationship: true,
        relationshipTypes: ['tension', 'hostile'],
        minStrength: 0,
        maxStrength: 30
      }),
      eligibilityCriteria: JSON.stringify({
        requiresBorderSharing: true,
        excludeAlliances: true
      }),
      templateVariables: JSON.stringify(['targetCountry', 'economicTier', 'embassyLevel']),
      historicalContext: JSON.stringify([
        'Border demarcation has been disputed since colonial withdrawal',
        'Previous skirmishes in the region occurred during economic downturns',
        'International arbitration was attempted in the past but failed to produce lasting agreement',
        'Our embassy in {{targetCountry}} has {{embassyLevel >= 3 ? "strong" : "limited"}} influence to facilitate dialogue'
      ]),
      involvedCountries: JSON.stringify({
        primary: true,
        secondary: false
      }),
      weight: 1.0,
      baseRelevance: 85,
      choices: {
        create: [
          {
            choiceKey: 'border_military_show',
            label: 'Military Deterrence',
            description: 'Deploy additional forces to the border as a show of strength and resolve',
            skillRequired: 'firmness',
            skillLevel: 7,
            riskLevel: 'extreme',
            requirements: JSON.stringify({}),
            shortTerm: '{{targetCountry}} will view this as provocation. Regional tensions escalate immediately. International observers express concern.',
            mediumTerm: 'Arms race may develop. Economic cooperation freezes. Risk of accidental escalation remains high for months.',
            longTerm: 'If successful deterrence, establishes credible defense posture. If fails, could trigger actual conflict with lasting consequences.',
            effects: JSON.stringify({
              relationshipChange: -40,
              economicImpact: -25,
              reputationChange: 15,
              securityImpact: 30
            }),
            displayOrder: 1
          },
          {
            choiceKey: 'border_negotiate',
            label: 'Diplomatic Negotiation',
            description: 'Propose immediate bilateral talks with international mediation',
            skillRequired: 'negotiation',
            skillLevel: 6,
            riskLevel: 'medium',
            requirements: JSON.stringify({
              minimumEmbassyLevel: 2
            }),
            shortTerm: '{{targetCountry}} agrees to talks, de-escalating immediate crisis. Both sides pull back from border.',
            mediumTerm: 'Negotiations prove difficult but prevent escalation. Compromise solution may emerge over resource sharing.',
            longTerm: 'Could establish framework for permanent border settlement and improved relations, or negotiations could stall indefinitely.',
            effects: JSON.stringify({
              relationshipChange: 20,
              economicImpact: 10,
              reputationChange: 10,
              securityImpact: -10
            }),
            displayOrder: 2
          },
          {
            choiceKey: 'border_international',
            label: 'International Arbitration',
            description: 'Escalate to international courts and multilateral organizations',
            skillRequired: 'persuasion',
            skillLevel: 8,
            riskLevel: 'medium',
            requirements: JSON.stringify({
              minimumEmbassyLevel: 3,
              requiredRelationshipLevel: 20
            }),
            shortTerm: 'Issue moves to international stage. {{targetCountry}} forced to defend claims publicly. Immediate tensions pause.',
            mediumTerm: 'Legal proceedings take months. International pressure builds on both sides to maintain peace during arbitration.',
            longTerm: 'Court ruling provides legitimate settlement, though losing party may refuse to comply. Creates precedent for future disputes.',
            effects: JSON.stringify({
              relationshipChange: -15,
              economicImpact: -5,
              reputationChange: 25,
              securityImpact: 15
            }),
            displayOrder: 3
          },
          {
            choiceKey: 'border_joint_development',
            label: 'Joint Development Zone',
            description: 'Propose shared sovereignty and joint resource exploitation',
            skillRequired: 'compromise',
            skillLevel: 9,
            riskLevel: 'low',
            requirements: JSON.stringify({
              minimumEmbassyLevel: 4,
              minimumBudget: 500000
            }),
            shortTerm: 'Creative solution surprises {{targetCountry}}. Nationalist hardliners on both sides object, but pragmatists see economic benefits.',
            mediumTerm: 'Joint administration established. Revenue sharing begins. Sets precedent for cooperative approach to disputes.',
            longTerm: 'Could transform contentious border into zone of cooperation. Economic benefits cement peace. Model for other disputed regions.',
            effects: JSON.stringify({
              relationshipChange: 35,
              economicImpact: 40,
              reputationChange: 30,
              securityImpact: 25
            }),
            displayOrder: 4
          }
        ]
      }
    }
  });

  scenarioCounts.border_dispute++;
  totalChoices += 4;
  console.log(`  ✅ Created: ${borderDispute.title} (4 choices)`);

  // ==================== TRADE RENEGOTIATION SCENARIOS ====================

  console.log('\n💼 Creating trade renegotiation scenarios...');

  const tradeRenegotiation = await prisma.diplomaticScenario.upsert({
    where: { key: 'trade_renegotiation_bilateral' },
    update: {},
    create: {
      key: 'trade_renegotiation_bilateral',
      scenarioType: 'trade_renegotiation',
      title: '{{targetCountry}} Seeks Trade Agreement Revision',
      introduction: '{{targetCountry}}\'s Ministry of Commerce has formally requested renegotiation of our bilateral trade agreement, which currently governs ${{tradeVolume}}M in annual commerce.',
      context: 'As a {{economicTier}} economy, {{targetCountry}} has experienced significant economic shifts since our original agreement was signed. Their domestic industries now face different competitive pressures, and they seek updated terms to reflect current realities.',
      situation: 'Specifically, {{targetCountry}} is requesting: (1) reduced tariffs on their agricultural exports, (2) increased quotas for manufactured goods, and (3) new provisions for digital services. In exchange, they offer improved market access for our technology sector and financial services. However, these changes would impact approximately 50,000 jobs in our agricultural regions.',
      implications: 'Our response will affect not just this trade relationship, but signal our broader approach to economic diplomacy. Domestic agricultural lobbies are already mobilizing opposition, while our tech sector sees opportunities for expansion.',
      urgency: null,
      relationshipLevel: 'friendly',
      timeFrame: 'time_sensitive',
      difficulty: 'challenging',
      recommendedEmbassyLevel: 3,
      triggerConditions: JSON.stringify({
        hasRelationship: true,
        relationshipTypes: ['trade', 'friendly'],
        minStrength: 40
      }),
      eligibilityCriteria: JSON.stringify({
        requiresTradeAgreement: true
      }),
      templateVariables: JSON.stringify(['targetCountry', 'economicTier', 'tradeVolume']),
      historicalContext: JSON.stringify([
        'Current trade agreement has been in force for 7 years',
        'Original negotiations took 14 months and were contentious',
        'Trade volume has grown 35% since agreement signed',
        'Both economies have evolved significantly in intervening period'
      ]),
      involvedCountries: JSON.stringify({
        primary: true,
        secondary: false
      }),
      weight: 1.2,
      baseRelevance: 70,
      choices: {
        create: [
          {
            choiceKey: 'trade_accept_terms',
            label: 'Accept Proposed Terms',
            description: 'Agree to their requests with minimal modifications',
            skillRequired: 'compromise',
            skillLevel: 4,
            riskLevel: 'medium',
            requirements: JSON.stringify({}),
            shortTerm: '{{targetCountry}} celebrates diplomatic success. Our agricultural sector protests. Tech companies begin planning expansion.',
            mediumTerm: 'Trade volume increases 20%. Job losses in agriculture offset by gains in tech sector. Domestic political pressure builds.',
            longTerm: 'Stronger economic ties with {{targetCountry}}. Economic restructuring pain subsides. Sets precedent for future negotiations.',
            effects: JSON.stringify({
              relationshipChange: 35,
              economicImpact: 15,
              reputationChange: -10,
              securityImpact: 0
            }),
            displayOrder: 1
          },
          {
            choiceKey: 'trade_counter_offer',
            label: 'Strategic Counter-Proposal',
            description: 'Accept some requests but negotiate hard on key sectors',
            skillRequired: 'negotiation',
            skillLevel: 7,
            riskLevel: 'low',
            requirements: JSON.stringify({
              minimumEmbassyLevel: 3
            }),
            shortTerm: 'Extended negotiations begin. Both sides stake out positions. Minor concessions exchanged to build goodwill.',
            mediumTerm: 'Balanced agreement emerges protecting key domestic interests while expanding opportunities. Both sides claim victory.',
            longTerm: 'Demonstrates sophisticated negotiation capacity. Strengthens relationship while protecting vital interests.',
            effects: JSON.stringify({
              relationshipChange: 20,
              economicImpact: 25,
              reputationChange: 20,
              securityImpact: 5
            }),
            displayOrder: 2
          },
          {
            choiceKey: 'trade_reject',
            label: 'Reject Renegotiation',
            description: 'Insist current agreement remains fair and balanced',
            skillRequired: 'firmness',
            skillLevel: 5,
            riskLevel: 'high',
            requirements: JSON.stringify({}),
            shortTerm: '{{targetCountry}} expresses disappointment. Trade relations cool. They begin exploring alternative markets.',
            mediumTerm: 'Trade volume stagnates or declines. {{targetCountry}} shifts focus to other partners. Domestic industries protected but opportunities lost.',
            longTerm: 'Relationship weakens. May miss window for mutually beneficial cooperation. Other trading partners gain ground.',
            effects: JSON.stringify({
              relationshipChange: -25,
              economicImpact: -15,
              reputationChange: 5,
              securityImpact: -5
            }),
            displayOrder: 3
          },
          {
            choiceKey: 'trade_expand_scope',
            label: 'Propose Comprehensive Partnership',
            description: 'Suggest broader economic integration beyond just trade',
            skillRequired: 'persuasion',
            skillLevel: 8,
            riskLevel: 'medium',
            requirements: JSON.stringify({
              minimumEmbassyLevel: 4,
              minimumBudget: 750000
            }),
            shortTerm: 'Ambitious proposal catches {{targetCountry}} by surprise. Requires extensive study and domestic consultation on both sides.',
            mediumTerm: 'If accepted, establishes framework for deep economic integration. Investment flows increase. Regulatory harmonization begins.',
            longTerm: 'Could create powerful economic bloc. Transforms relationship from transactional to strategic. Significant domestic restructuring required.',
            effects: JSON.stringify({
              relationshipChange: 40,
              economicImpact: 45,
              reputationChange: 30,
              securityImpact: 15
            }),
            displayOrder: 4
          }
        ]
      }
    }
  });

  scenarioCounts.trade_renegotiation++;
  totalChoices += 4;
  console.log(`  ✅ Created: ${tradeRenegotiation.title} (4 choices)`);

  // ==================== CULTURAL MISUNDERSTANDING SCENARIOS ====================

  console.log('\n🎭 Creating cultural misunderstanding scenarios...');

  const culturalMisunderstanding = await prisma.diplomaticScenario.upsert({
    where: { key: 'cultural_exhibition_controversy' },
    update: {},
    create: {
      key: 'cultural_exhibition_controversy',
      scenarioType: 'cultural_misunderstanding',
      title: 'Cultural Incident Strains Relations with {{targetCountry}}',
      introduction: 'A cultural exhibition from our national museum, currently on tour in {{targetCountry}}, has sparked unexpected controversy and diplomatic complications.',
      context: 'The exhibition, "Crossroads of Civilizations," was intended to celebrate shared historical ties and promote cultural understanding. However, certain artifacts and their contextual descriptions have been interpreted by {{targetCountry}}\'s public as culturally insensitive and historically inaccurate.',
      situation: 'Social media in {{targetCountry}} has erupted with criticism. Several prominent historians and cultural figures have called for the exhibition to be closed. The government of {{targetCountry}} has requested we either modify the exhibition or withdraw it entirely. Our cultural ministry insists the exhibition is historically accurate and academically sound. Meanwhile, our embassy staff are facing protests outside the exhibition venue.',
      implications: 'Cultural diplomacy is a cornerstone of soft power. How we handle this situation will affect not just our relationship with {{targetCountry}}, but our broader reputation for cultural sensitivity and respect.',
      urgency: null,
      relationshipLevel: 'neutral',
      timeFrame: 'urgent',
      difficulty: 'moderate',
      recommendedEmbassyLevel: 2,
      triggerConditions: JSON.stringify({
        hasEmbassy: true,
        recentCulturalExchange: true
      }),
      eligibilityCriteria: JSON.stringify({
        requiresCulturalPrograms: true
      }),
      templateVariables: JSON.stringify(['targetCountry']),
      historicalContext: JSON.stringify([
        'Our nations have complex shared history dating back centuries',
        'Cultural exchange programs have generally been positive',
        'Previous exhibitions have been well-received in both countries',
        'Social media has amplified cultural controversies in recent years'
      ]),
      involvedCountries: JSON.stringify({
        primary: true,
        secondary: false
      }),
      weight: 0.8,
      baseRelevance: 60,
      choices: {
        create: [
          {
            choiceKey: 'cultural_apologize',
            label: 'Issue Formal Apology',
            description: 'Apologize for offense and modify exhibition content',
            skillRequired: 'empathy',
            skillLevel: 5,
            riskLevel: 'low',
            requirements: JSON.stringify({}),
            shortTerm: 'Controversy subsides. {{targetCountry}} appreciates responsiveness. Domestic critics accuse us of capitulating to political pressure.',
            mediumTerm: 'Modified exhibition continues with reduced controversy. Cultural ties resume positive trajectory. Sets precedent for handling future incidents.',
            longTerm: 'Relationship strengthened by demonstrated cultural sensitivity. May limit future cultural programming to avoid controversy.',
            effects: JSON.stringify({
              relationshipChange: 25,
              economicImpact: 0,
              reputationChange: -5,
              securityImpact: 0
            }),
            displayOrder: 1
          },
          {
            choiceKey: 'cultural_dialogue',
            label: 'Organize Academic Dialogue',
            description: 'Host joint academic forum to discuss historical interpretations',
            skillRequired: 'persuasion',
            skillLevel: 6,
            riskLevel: 'medium',
            requirements: JSON.stringify({
              minimumEmbassyLevel: 2
            }),
            shortTerm: 'Announcement of dialogue reduces immediate pressure. Scholars from both countries agree to participate. Exhibition continues during discussions.',
            mediumTerm: 'Dialogue produces nuanced understanding of different historical perspectives. Joint statement acknowledges complexity of shared history.',
            longTerm: 'Creates model for addressing cultural differences through scholarly exchange. Strengthens academic ties. Exhibition becomes case study in cultural diplomacy.',
            effects: JSON.stringify({
              relationshipChange: 30,
              economicImpact: 5,
              reputationChange: 20,
              securityImpact: 0
            }),
            displayOrder: 2
          },
          {
            choiceKey: 'cultural_defend',
            label: 'Defend Academic Freedom',
            description: 'Refuse modifications, citing historical accuracy and free expression',
            skillRequired: 'firmness',
            skillLevel: 7,
            riskLevel: 'high',
            requirements: JSON.stringify({}),
            shortTerm: 'Controversy intensifies. {{targetCountry}} government faces domestic pressure. Exhibition may be forced to close anyway.',
            mediumTerm: 'Cultural relations damaged. Future exchange programs face additional scrutiny. Domestic audiences appreciate principled stance.',
            longTerm: 'May establish important precedent for cultural independence, but at cost of near-term relationship damage.',
            effects: JSON.stringify({
              relationshipChange: -30,
              economicImpact: -10,
              reputationChange: 15,
              securityImpact: 0
            }),
            displayOrder: 3
          },
          {
            choiceKey: 'cultural_collaborative',
            label: 'Joint Curation Initiative',
            description: 'Propose collaboration with local scholars to recontextualize exhibition',
            skillRequired: 'compromise',
            skillLevel: 8,
            riskLevel: 'low',
            requirements: JSON.stringify({
              minimumEmbassyLevel: 3,
              minimumBudget: 100000
            }),
            shortTerm: 'Creative solution welcomed. Scholars from {{targetCountry}} join curatorial team. Exhibition temporarily paused for revision.',
            mediumTerm: 'Revised exhibition presents multiple perspectives. Becomes model of collaborative cultural diplomacy. Both countries claim success.',
            longTerm: 'Establishes framework for future cultural collaborations. Strengthens people-to-people ties. Demonstrates soft power sophistication.',
            effects: JSON.stringify({
              relationshipChange: 40,
              economicImpact: 10,
              reputationChange: 25,
              securityImpact: 5
            }),
            displayOrder: 4
          }
        ]
      }
    }
  });

  scenarioCounts.cultural_misunderstanding++;
  totalChoices += 4;
  console.log(`  ✅ Created: ${culturalMisunderstanding.title} (4 choices)`);

  // ==================== INTELLIGENCE BREACH SCENARIOS ====================

  console.log('\n🕵️  Creating intelligence breach scenarios...');

  const intelligenceBreach = await prisma.diplomaticScenario.upsert({
    where: { key: 'intelligence_operation_exposed' },
    update: {},
    create: {
      key: 'intelligence_operation_exposed',
      scenarioType: 'intelligence_breach',
      title: 'Intelligence Operation Exposed in {{targetCountry}}',
      introduction: 'Classified diplomatic cables have been leaked to {{targetCountry}}\'s media, revealing details of our intelligence-gathering operations conducted through our embassy.',
      context: 'The leaked documents describe routine intelligence activities that most nations conduct through diplomatic channels. However, the public disclosure has created a political firestorm in {{targetCountry}}, where opposition parties are demanding government response.',
      situation: '{{targetCountry}}\'s Foreign Ministry has summoned our ambassador for an explanation. Their security services have increased surveillance of our embassy staff. Three of our diplomatic personnel have been declared "persona non grata" and must leave within 48 hours. The leak appears to have come from a source within their own government, possibly as a political maneuver, but our operations are nonetheless exposed.',
      implications: 'How we respond will affect our intelligence capabilities throughout the region. Other countries are watching to see if we admit to intelligence activities or maintain deniability. Our relationship with {{targetCountry}} hangs in the balance.',
      urgency: 'We must respond before the 48-hour deadline for diplomatic expulsions.',
      relationshipLevel: 'neutral',
      timeFrame: 'urgent',
      difficulty: 'critical',
      recommendedEmbassyLevel: 4,
      triggerConditions: JSON.stringify({
        hasEmbassy: true,
        minimumEmbassyLevel: 3,
        embassySpecialization: 'intelligence'
      }),
      eligibilityCriteria: JSON.stringify({
        requiresIntelligenceOperations: true
      }),
      templateVariables: JSON.stringify(['targetCountry', 'embassyLevel']),
      historicalContext: JSON.stringify([
        'Our embassy has maintained {{embassyLevel}}-level presence for years',
        'Intelligence cooperation has been standard practice between nations',
        '{{targetCountry}} conducts similar activities in our country',
        'Leak timing suggests internal political motivations'
      ]),
      involvedCountries: JSON.stringify({
        primary: true,
        secondary: false
      }),
      weight: 0.6,
      baseRelevance: 80,
      choices: {
        create: [
          {
            choiceKey: 'intel_deny',
            label: 'Categorical Denial',
            description: 'Deny all allegations and claim documents are fabricated',
            skillRequired: 'firmness',
            skillLevel: 6,
            riskLevel: 'high',
            requirements: JSON.stringify({}),
            shortTerm: '{{targetCountry}} unconvinced. Expulsions proceed. Media skeptical of denial. Domestic audience divided.',
            mediumTerm: 'Intelligence operations severely curtailed. Trust damaged. However, official deniability maintained for future operations.',
            longTerm: 'Relationship recovers slowly. Intelligence capabilities take years to rebuild. Precedent set for plausible deniability.',
            effects: JSON.stringify({
              relationshipChange: -35,
              economicImpact: -15,
              reputationChange: -10,
              securityImpact: -30
            }),
            displayOrder: 1
          },
          {
            choiceKey: 'intel_acknowledge',
            label: 'Limited Acknowledgment',
            description: 'Acknowledge routine diplomatic information gathering, not espionage',
            skillRequired: 'negotiation',
            skillLevel: 8,
            riskLevel: 'medium',
            requirements: JSON.stringify({
              minimumEmbassyLevel: 3
            }),
            shortTerm: 'Honesty surprises {{targetCountry}}. Reduces political pressure as we admit what everyone does. Expulsions may be reduced.',
            mediumTerm: 'Relationship enters period of recalibration. New protocols established for intelligence cooperation. Sets realistic expectations.',
            longTerm: 'Could lead to formalized intelligence-sharing agreement. Transparency builds unexpected trust. Both sides benefit.',
            effects: JSON.stringify({
              relationshipChange: 10,
              economicImpact: -5,
              reputationChange: 15,
              securityImpact: -15
            }),
            displayOrder: 2
          },
          {
            choiceKey: 'intel_counter',
            label: 'Reciprocal Exposures',
            description: 'Threaten to expose their intelligence activities in our country',
            skillRequired: 'intimidation',
            skillLevel: 7,
            riskLevel: 'extreme',
            requirements: JSON.stringify({}),
            shortTerm: 'Tit-for-tat escalation. Both countries begin expelling diplomats. Intelligence war threatens broader relationship.',
            mediumTerm: 'Mutual recriminations damage relationship severely. Intelligence operations on both sides disrupted. Other countries avoid getting involved.',
            longTerm: 'Extended period of hostile relations. Intelligence capabilities degraded on both sides. May take years to normalize.',
            effects: JSON.stringify({
              relationshipChange: -60,
              economicImpact: -30,
              reputationChange: -20,
              securityImpact: -40
            }),
            displayOrder: 3
          },
          {
            choiceKey: 'intel_cooperative',
            label: 'Propose Intelligence Partnership',
            description: 'Turn crisis into opportunity by proposing formal intelligence cooperation',
            skillRequired: 'persuasion',
            skillLevel: 10,
            riskLevel: 'medium',
            requirements: JSON.stringify({
              minimumEmbassyLevel: 4,
              requiredRelationshipLevel: 40
            }),
            shortTerm: 'Bold proposal stuns {{targetCountry}}. Requires high-level consultations. Expulsions paused pending discussions.',
            mediumTerm: 'If successful, establishes unprecedented intelligence-sharing framework. Transforms competitive intelligence gathering into cooperation.',
            longTerm: 'Could create powerful intelligence alliance. Requires significant trust-building. Sets new paradigm for intelligence diplomacy.',
            effects: JSON.stringify({
              relationshipChange: 45,
              economicImpact: 10,
              reputationChange: 35,
              securityImpact: 50
            }),
            displayOrder: 4
          }
        ]
      }
    }
  });

  scenarioCounts.intelligence_breach++;
  totalChoices += 4;
  console.log(`  ✅ Created: ${intelligenceBreach.title} (4 choices)`);

  // ==================== SUMMARY STATISTICS ====================

  console.log('\n' + '='.repeat(60));
  console.log('📊 SEED SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n✅ Total Scenarios Created: ${Object.values(scenarioCounts).reduce((a, b) => a + b, 0)}`);
  console.log(`✅ Total Choices Created: ${totalChoices}`);
  console.log('\n📈 Scenarios by Type:');
  console.log(`  - Border Disputes: ${scenarioCounts.border_dispute}`);
  console.log(`  - Trade Renegotiations: ${scenarioCounts.trade_renegotiation}`);
  console.log(`  - Cultural Misunderstandings: ${scenarioCounts.cultural_misunderstanding}`);
  console.log(`  - Intelligence Breaches: ${scenarioCounts.intelligence_breach}`);
  console.log('\n🎯 Average Choices per Scenario:', (totalChoices / Object.values(scenarioCounts).reduce((a, b) => a + b, 0)).toFixed(1));
  console.log('\n✨ All scenarios seeded with:');
  console.log('  - Full consequence trees (short/medium/long-term outcomes)');
  console.log('  - Skill requirements and risk levels');
  console.log('  - Effects on relationship, economy, reputation, security');
  console.log('  - Trigger conditions and eligibility criteria');
  console.log('  - Historical context and template variables');
  console.log('\n' + '='.repeat(60));
  console.log('🌱 Diplomatic scenarios seed complete!\n');
}

// Execute seed function
seedDiplomaticScenarios()
  .catch((e) => {
    console.error('❌ Error seeding diplomatic scenarios:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

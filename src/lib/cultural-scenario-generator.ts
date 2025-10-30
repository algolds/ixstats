/**
 * Cultural Exchange Scenario Generator
 *
 * Generates rich narrative scenarios for cultural exchange programs that integrate with
 * the Markov diplomacy engine, NPC personality system, and diplomatic response AI.
 *
 * Features:
 * - 10 distinct scenario templates for cultural exchange situations
 * - Context-aware narrative generation based on country relationships
 * - Multiple response options with skill/personality requirements
 * - Predicted outcomes using Markov engine calculations
 * - Integration with NPC personality system for realistic responses
 */

import type { RelationshipState } from "./diplomatic-markov-engine";
import type { DiplomaticChoice, CumulativeEffects } from "./diplomatic-choice-tracker";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type CulturalScenarioType =
  | "festival_collaboration"
  | "artifact_repatriation"
  | "cultural_appropriation"
  | "exhibition_censorship"
  | "student_visa_crisis"
  | "heritage_restoration"
  | "language_preservation"
  | "knowledge_sharing"
  | "festival_security"
  | "artistic_freedom";

export type ResponseRequirement = {
  skill: "negotiation" | "cultural_sensitivity" | "economic" | "legal" | "security";
  level: number; // 0-100
};

export interface CulturalScenarioTemplate {
  type: CulturalScenarioType;
  name: string;
  description: string;
  minimumRelationship: RelationshipState;
  culturalImpact: number; // 0-100
  diplomaticRisk: number; // 0-100
  economicCost: number; // 0-100
  tags: string[];
}

export interface ScenarioContext {
  exchangeId: string;
  exchangeType: string;
  country1: {
    id: string;
    name: string;
    culturalOpenness: number;
    economicStrength: number;
  };
  country2: {
    id: string;
    name: string;
    culturalOpenness: number;
    economicStrength: number;
  };
  relationshipState: RelationshipState;
  relationshipStrength: number; // 0-100
  existingExchanges: number;
  historicalTensions: boolean;
  economicTies: number; // 0-100
}

export interface ResponseOption {
  id: string;
  label: string;
  description: string;
  requirements: ResponseRequirement[];
  predictedOutcomes: {
    immediate: {
      culturalImpact: number;
      diplomaticChange: number;
      economicCost: number;
      relationshipStateChange: RelationshipState | null;
    };
    shortTerm: {
      description: string;
      culturalBenefit: number;
      diplomaticBenefit: number;
    };
    longTerm: {
      description: string;
      culturalBenefit: number;
      diplomaticBenefit: number;
    };
  };
  npcsLikelyToChoose: string[]; // Personality archetypes
}

export type CulturalScenarioRecentAction = Pick<
  DiplomaticChoice,
  "id" | "type" | "targetCountry" | "targetCountryId" | "timestamp" | "ixTimeTimestamp"
>;

export interface CulturalScenarioMetadata {
  triggeredBy: string;
  relevanceScore: number;
  playerReputation?: CumulativeEffects;
  recentPlayerActions?: CulturalScenarioRecentAction[];
  lastFetched?: number;
}

export interface CulturalScenario {
  id: string;
  type: CulturalScenarioType;
  title: string;
  narrative: string; // 3-5 paragraph rich narrative
  context: ScenarioContext;
  responseOptions: ResponseOption[];
  timestamp: string;
  expiresAt: string;
  tags: string[];
  metadata: CulturalScenarioMetadata;
}

// ============================================================================
// SCENARIO TEMPLATES
// ============================================================================

export const CULTURAL_SCENARIO_TEMPLATES: Record<CulturalScenarioType, CulturalScenarioTemplate> = {
  festival_collaboration: {
    type: "festival_collaboration",
    name: "Festival Collaboration Conflict",
    description:
      "Disagreements arise over the organization and representation in a joint cultural festival",
    minimumRelationship: "neutral",
    culturalImpact: 65,
    diplomaticRisk: 45,
    economicCost: 30,
    tags: ["festival", "collaboration", "cultural_identity", "public_event"],
  },

  artifact_repatriation: {
    type: "artifact_repatriation",
    name: "Cultural Artifact Repatriation Request",
    description: "One country formally requests the return of significant cultural artifacts",
    minimumRelationship: "neutral",
    culturalImpact: 85,
    diplomaticRisk: 70,
    economicCost: 20,
    tags: ["artifacts", "heritage", "historical_claims", "legal"],
  },

  cultural_appropriation: {
    type: "cultural_appropriation",
    name: "Cultural Appropriation Dispute",
    description: "Controversy emerges over the use of cultural symbols or practices",
    minimumRelationship: "tense",
    culturalImpact: 75,
    diplomaticRisk: 60,
    economicCost: 15,
    tags: ["cultural_sensitivity", "symbols", "identity", "controversy"],
  },

  exhibition_censorship: {
    type: "exhibition_censorship",
    name: "Joint Exhibition Censorship Crisis",
    description: "Disagreement over what content can be displayed in a collaborative exhibition",
    minimumRelationship: "neutral",
    culturalImpact: 70,
    diplomaticRisk: 55,
    economicCost: 25,
    tags: ["art", "censorship", "freedom", "controversy"],
  },

  student_visa_crisis: {
    type: "student_visa_crisis",
    name: "Student Exchange Visa Crisis",
    description: "Visa processing delays or denials threaten to derail student exchange programs",
    minimumRelationship: "friendly",
    culturalImpact: 60,
    diplomaticRisk: 50,
    economicCost: 40,
    tags: ["education", "visa", "students", "bureaucracy"],
  },

  heritage_restoration: {
    type: "heritage_restoration",
    name: "Cultural Heritage Restoration Project",
    description: "Opportunity for joint restoration of significant cultural heritage sites",
    minimumRelationship: "friendly",
    culturalImpact: 80,
    diplomaticRisk: 30,
    economicCost: 70,
    tags: ["heritage", "restoration", "cooperation", "investment"],
  },

  language_preservation: {
    type: "language_preservation",
    name: "Language Preservation Initiative",
    description: "Collaborative effort to preserve and promote endangered languages or dialects",
    minimumRelationship: "friendly",
    culturalImpact: 75,
    diplomaticRisk: 25,
    economicCost: 45,
    tags: ["language", "preservation", "education", "cultural_identity"],
  },

  knowledge_sharing: {
    type: "knowledge_sharing",
    name: "Traditional Knowledge Sharing Agreement",
    description: "Negotiating terms for sharing indigenous or traditional knowledge",
    minimumRelationship: "neutral",
    culturalImpact: 85,
    diplomaticRisk: 40,
    economicCost: 35,
    tags: ["indigenous", "knowledge", "intellectual_property", "tradition"],
  },

  festival_security: {
    type: "festival_security",
    name: "Cultural Festival Security Incident",
    description:
      "Security concerns emerge at a major cultural festival threatening its continuation",
    minimumRelationship: "friendly",
    culturalImpact: 55,
    diplomaticRisk: 65,
    economicCost: 50,
    tags: ["security", "festival", "safety", "crisis_management"],
  },

  artistic_freedom: {
    type: "artistic_freedom",
    name: "Artistic Freedom Controversy",
    description: "Artists face censorship or controversy over provocative cultural expressions",
    minimumRelationship: "tense",
    culturalImpact: 80,
    diplomaticRisk: 75,
    economicCost: 20,
    tags: ["art", "freedom", "censorship", "controversy"],
  },
};

// ============================================================================
// SCENARIO GENERATOR CLASS
// ============================================================================

export class CulturalScenarioGenerator {
  /**
   * Generate a cultural exchange scenario based on template and context
   */
  static generateScenario(
    template: CulturalScenarioTemplate,
    context: ScenarioContext,
    options: {
      playerReputation?: CumulativeEffects;
      recentPlayerActions?: DiplomaticChoice[];
    } = {}
  ): CulturalScenario {
    const narrative = this.generateNarrative(template, context);
    const responseOptions = this.generateResponseOptions(template, context);
    const metadata: CulturalScenarioMetadata = {
      triggeredBy: template.name,
      relevanceScore: Math.round((template.culturalImpact + template.diplomaticRisk) / 2),
      playerReputation: options.playerReputation,
      recentPlayerActions: options.recentPlayerActions
        ? options.recentPlayerActions.slice(-5).map((action) => ({
            id: action.id,
            type: action.type,
            targetCountry: action.targetCountry,
            targetCountryId: action.targetCountryId,
            timestamp: action.timestamp,
            ixTimeTimestamp: action.ixTimeTimestamp,
          }))
        : undefined,
      lastFetched: Date.now(),
    };

    return {
      id: `cultural_scenario_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: template.type,
      title: this.generateTitle(template, context),
      narrative,
      context,
      responseOptions,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      tags: template.tags,
      metadata,
    };
  }

  /**
   * Generate contextual title for the scenario
   */
  private static generateTitle(
    template: CulturalScenarioTemplate,
    context: ScenarioContext
  ): string {
    const titleTemplates: Record<CulturalScenarioType, string> = {
      festival_collaboration: `${context.country1.name}-${context.country2.name} Festival Dispute`,
      artifact_repatriation: `${context.country2.name} Requests Return of Cultural Artifacts`,
      cultural_appropriation: `Cultural Symbol Controversy Between ${context.country1.name} and ${context.country2.name}`,
      exhibition_censorship: `Content Dispute Threatens Joint ${context.exchangeType} Exhibition`,
      student_visa_crisis: `${context.country2.name} Visa Crisis Endangers Student Exchange`,
      heritage_restoration: `Joint Heritage Restoration Opportunity in ${context.country1.name}`,
      language_preservation: `Collaborative Language Preservation Proposal`,
      knowledge_sharing: `Traditional Knowledge Sharing Negotiation`,
      festival_security: `Security Incident at ${context.country1.name} Cultural Festival`,
      artistic_freedom: `Artistic Censorship Controversy Erupts`,
    };

    return titleTemplates[template.type];
  }

  /**
   * Generate rich 3-5 paragraph narrative
   */
  private static generateNarrative(
    template: CulturalScenarioTemplate,
    context: ScenarioContext
  ): string {
    const narrativeTemplates: Record<CulturalScenarioType, (ctx: ScenarioContext) => string> = {
      festival_collaboration: (ctx) =>
        `
The much-anticipated ${ctx.exchangeType} festival, jointly organized by ${ctx.country1.name} and ${ctx.country2.name}, has encountered significant organizational challenges that threaten to overshadow its cultural objectives. What began as an ambitious collaboration to celebrate shared cultural heritage has devolved into heated disputes over representation, funding allocation, and the festival's core messaging.

${ctx.country1.name}'s organizing committee has expressed frustration over what they perceive as unequal representation of their cultural contributions in the festival's programming. They argue that ${ctx.country2.name} has dominated the planning process and allocated premium time slots and venues to their own performers while relegating ${ctx.country1.name}'s artists to secondary status. The funding dispute adds another layer of complexity, with both sides claiming they've contributed more resources than originally agreed upon.

The controversy has spilled into public discourse, with cultural commentators in both nations weighing in. Some ${ctx.country1.name} intellectuals have characterized the situation as "cultural imperialism," while ${ctx.country2.name} officials counter that ${ctx.country1.name} is being unreasonably demanding and failing to honor agreed-upon commitments. The media attention has transformed what should have been a celebration of cultural exchange into a diplomatic flashpoint.

With the festival's opening ceremony just weeks away, both governments face a critical decision. The event has already sold thousands of tickets, secured international performers, and attracted significant media coverage. Cancellation would be financially costly and diplomatically embarrassing, but proceeding with the current tensions could result in a public relations disaster.

Your diplomatic team must navigate this delicate situation, balancing cultural pride with pragmatic collaboration, while ensuring that the original spirit of cultural exchange is not lost in bureaucratic disputes and nationalist posturing.
      `.trim(),

      artifact_repatriation: (ctx) =>
        `
${ctx.country2.name} has formally submitted a request to ${ctx.country1.name} for the repatriation of a collection of significant cultural artifacts currently housed in ${ctx.country1.name}'s National Museum. These artifacts, which include sacred religious items, royal regalia, and irreplaceable historical documents, were acquired during a period of colonial administration over a century ago. The request has ignited a passionate debate about cultural heritage, historical responsibility, and the role of museums in preserving global culture.

The artifacts in question hold profound cultural and spiritual significance for ${ctx.country2.name}. Religious leaders argue that sacred items are incomplete outside their proper cultural context and that their display in a foreign museum amounts to continued cultural violation. Historians in ${ctx.country2.name} emphasize that these artifacts are essential for understanding their national identity and teaching future generations about their heritage. A grassroots movement has emerged, with thousands of ${ctx.country2.name} citizens petitioning for the artifacts' return.

${ctx.country1.name} faces a complex dilemma. The National Museum's curators argue that the artifacts have been meticulously preserved and are accessible to a global audience, serving educational purposes that benefit humanity broadly. They express concerns about ${ctx.country2.name}'s capacity to provide equivalent preservation standards and note that the artifacts have been part of ${ctx.country1.name}'s museum collections for generations. Some scholars worry that repatriation could set a precedent leading to the wholesale dismantling of museum collections worldwide.

The legal framework is murky. The artifacts were acquired under colonial-era laws that were legal at the time but are now widely considered morally problematic. International conventions on cultural property offer limited guidance, and both countries are signatories to agreements that could be interpreted to support either position. The case has attracted attention from international cultural organizations and could influence similar disputes globally.

Your diplomatic team must weigh cultural sensitivity, legal precedent, preservation concerns, and the broader implications for bilateral relations while the world watches how this dispute unfolds.
      `.trim(),

      cultural_appropriation: (ctx) =>
        `
A controversy has erupted over the use of traditional ${ctx.country1.name} cultural symbols in a commercial venture by ${ctx.country2.name} fashion designers. What began as a "cultural fusion" fashion line intended to celebrate ${ctx.country1.name}'s rich textile heritage has been denounced by ${ctx.country1.name} cultural advocates as exploitative appropriation that commodifies sacred symbols for profit without proper understanding or respect.

The fashion collection features patterns and designs drawn from ${ctx.country1.name}'s indigenous communities, including symbols with religious and ceremonial significance. ${ctx.country2.name} designers claim they conducted research and worked with ${ctx.country1.name} consultants, viewing their work as appreciation and cultural bridge-building. However, ${ctx.country1.name} indigenous leaders counter that the consultants lacked authority to authorize commercial use of sacred symbols and that the designs have been altered in ways that distort their original meanings and violate cultural protocols.

The controversy has intensified with social media campaigns in both countries. ${ctx.country1.name} activists have organized boycotts and called for the collection's withdrawal, sharing educational content about the symbols' true significance. Meanwhile, some ${ctx.country2.name} commentators have accused ${ctx.country1.name} of cultural gatekeeping and stifling creative expression, arguing that cultural exchange requires openness to reinterpretation.

The dispute threatens the broader cultural exchange program between the two nations. ${ctx.country1.name} has suspended several pending collaborations pending resolution of the controversy, while ${ctx.country2.name} cultural institutions have expressed frustration with what they perceive as oversensitivity. The fashion company at the center of the controversy faces mounting pressure but is contractually committed to launching the collection within weeks.

Your diplomatic team must address complex questions about cultural ownership, the boundaries of cultural exchange, intellectual property rights for traditional knowledge, and how to move forward in ways that respect both cultural integrity and creative freedom.
      `.trim(),

      exhibition_censorship: (ctx) =>
        `
The upcoming joint ${ctx.exchangeType} exhibition between ${ctx.country1.name} and ${ctx.country2.name}, months in the making, faces cancellation over irreconcilable disagreements about content inclusion. The exhibition was designed to showcase contemporary artistic responses to shared historical experiences, but several pieces have sparked intense controversy about censorship, artistic freedom, and the limits of cultural dialogue.

${ctx.country2.name}'s curatorial team has demanded the removal of three artworks by ${ctx.country1.name} artists that they claim present historical events in an offensive and one-sided manner. They argue that including these pieces would cause public outrage in ${ctx.country2.name} and betray the exhibition's stated goal of promoting mutual understanding. The works in question address sensitive historical episodes, including periods of conflict and cultural tension between the two nations, from perspectives that ${ctx.country2.name} officials find unacceptable.

${ctx.country1.name}'s artistic community has rallied around the contested works, framing the dispute as a fundamental issue of artistic freedom. Artists and intellectuals argue that meaningful cultural exchange requires confronting uncomfortable truths and that censoring artwork based on political sensitivities undermines the exhibition's integrity. They've threatened to withdraw all ${ctx.country1.name} contributions if the pieces are removed, which would effectively end the exhibition.

The controversy has exposed deeper differences in how the two nations approach freedom of expression. ${ctx.country2.name} emphasizes social harmony and collective sensitivities, with cultural products expected to serve nation-building and avoid divisive content. ${ctx.country1.name} prizes individual artistic freedom and believes that art's value often lies in provoking thought and challenging comfortable narratives. These philosophical differences extend beyond this single exhibition to the fundamental nature of cultural collaboration.

With the exhibition's opening date approaching, international art critics watching the dispute, and both governments under pressure from domestic constituencies, your diplomatic team must find a path forward that either bridges these differences or gracefully manages the exhibition's cancellation without derailing the broader cultural relationship.
      `.trim(),

      student_visa_crisis: (ctx) =>
        `
The flagship student exchange program between ${ctx.country1.name} and ${ctx.country2.name}, celebrating its tenth year, faces an unprecedented crisis. ${ctx.country2.name}'s immigration authorities have abruptly delayed or denied visas for over 60% of ${ctx.country1.name} students accepted into the program, citing new security protocols. With the academic term starting in weeks, hundreds of students face shattered plans while universities scramble to respond.

The visa denials appear concentrated among students from specific regions of ${ctx.country1.name} and those pursuing certain fields of study, particularly technology and social sciences. ${ctx.country2.name} officials cryptically reference "enhanced security screening requirements" without providing detailed explanations, leading ${ctx.country1.name} officials to suspect political motivations. Some ${ctx.country1.name} commentators have characterized the situation as discriminatory profiling disguised as security protocol.

The affected students represent ${ctx.country1.name}'s best and brightest, many of whom turned down opportunities elsewhere to participate in this prestigious program. Families have made significant financial commitments, students have left jobs and other educational programs, and universities in both countries have allocated resources and positions. The human cost extends beyond logistics to crushed dreams and damaged trust in what was considered a model cultural exchange program.

${ctx.country1.name} is considering reciprocal measures, which could affect ${ctx.country2.name} students already enrolled in ${ctx.country1.name} institutions. Education officials warn this could trigger a tit-for-tat escalation that would devastate academic cooperation built over decades. Some ${ctx.country1.name} universities are exploring emergency partnerships with third countries to place affected students, which would bypass ${ctx.country2.name} entirely and potentially signal a permanent shift away from bilateral educational cooperation.

Your diplomatic team must urgently address the immediate crisis—getting students processed in time for the academic term—while investigating the root causes of the visa problems and ensuring such disruptions don't recur. The broader implications for people-to-people ties, youth perceptions of the partner country, and the future of institutional cooperation hang in the balance.
      `.trim(),

      heritage_restoration: (ctx) =>
        `
An extraordinary opportunity for cultural cooperation has emerged: ${ctx.country1.name} has proposed a joint heritage restoration project focusing on historically significant sites connected to both nations' shared past. The proposal involves restoring a complex of temples, monuments, and cultural sites that represent a golden age of cultural exchange between the two civilizations, predating modern nation-states. If successful, the project could become a powerful symbol of reconciliation and cooperation.

The scope is ambitious. The sites have deteriorated significantly, requiring extensive archaeological work, structural restoration, and careful preservation of deteriorating artwork and inscriptions. ${ctx.country1.name} proposes a partnership where ${ctx.country2.name} provides technical expertise and restoration technology while ${ctx.country1.name} contributes archaeological knowledge and site access. The project would employ hundreds of workers, create opportunities for joint research, and produce a restored heritage site that could attract international tourism and scholarly attention.

However, the proposal raises complex questions about representation and narrative control. The historical period in question is interpreted differently in both countries' national histories. ${ctx.country1.name} narratives emphasize cultural flowering and peaceful exchange, while ${ctx.country2.name} historical accounts focus more on economic exploitation and cultural dominance. How the restored site is presented to visitors could either bridge these narratives or create new conflicts about historical truth.

Financial considerations are substantial. The project requires an estimated investment that would make it one of the largest cultural collaborations in the region. Questions about cost-sharing, economic benefits from future tourism, intellectual property rights to restoration techniques, and how to credit the restoration work have all sparked negotiation challenges. There's also the sensitive question of whether the restored sites should be designated as joint cultural heritage or belong primarily to ${ctx.country1.name} as the territorial state.

Your diplomatic team must evaluate this opportunity's potential to advance cultural understanding and bilateral relations against the financial, political, and historical complexities it presents. The decision will signal whether both nations are ready for deep, long-term cultural cooperation or prefer more limited, safer forms of exchange.
      `.trim(),

      language_preservation: (ctx) =>
        `
A coalition of linguists and cultural advocates from ${ctx.country1.name} and ${ctx.country2.name} has proposed an ambitious collaborative initiative to preserve and revitalize endangered languages and dialects that exist in border regions and diaspora communities in both countries. The proposal has captured public imagination but raised complex questions about cultural identity, educational policy, and the politics of language.

The languages targeted for preservation are spoken by minority communities with historical and cultural connections spanning both nations. Some are ancient tongues predating modern borders; others are creole languages that evolved through historical migration and trade. All are endangered, with declining numbers of fluent speakers as younger generations adopt dominant national languages for economic advancement. Without intervention, linguists warn these languages could disappear within two generations, taking with them irreplaceable cultural knowledge and identity.

The proposed initiative includes developing teaching materials, training language instructors, creating digital archives of native speakers, establishing language immersion programs, and ultimately incorporating these languages into educational curricula in regions where they're traditionally spoken. ${ctx.country2.name} has offered technological expertise and funding, while ${ctx.country1.name} would provide access to speaker communities and cultural context.

However, the project has sparked controversy on multiple fronts. Some ${ctx.country1.name} nationalists view it as encouraging separatism and undermining national unity, arguing that minority languages should give way to the national language that unifies the country. There are concerns that ${ctx.country2.name}'s involvement could be a vehicle for cultural influence over border regions. Additionally, some minority communities themselves are divided, with younger members questioning whether preserving declining languages serves their economic interests or traps them in traditional roles.

The educational and political establishments in both countries are wary. Incorporating minority languages into curricula requires resources, teacher training, and curriculum development that would compete with other educational priorities. There are questions about standardization—who decides the "correct" form of languages with regional variations? How should writing systems be developed for traditionally oral languages?

Your diplomatic team must navigate the intersection of cultural preservation, national identity politics, minority rights, and practical educational policy. Success could set a model for linguistic preservation globally; failure could damage relations with minority communities and between the two countries.
      `.trim(),

      knowledge_sharing: (ctx) =>
        `
${ctx.country1.name} indigenous communities possess extensive traditional knowledge about medicinal plants, agricultural practices, and ecological management that has sustained them for millennia. ${ctx.country2.name} research institutions have proposed a partnership to document, study, and potentially develop this knowledge for broader application, offering resources, scientific expertise, and revenue-sharing arrangements. The proposal has ignited a complex debate about traditional knowledge rights, biopiracy concerns, and the terms of ethical knowledge exchange.

The traditional knowledge in question includes sophisticated understanding of plant properties, sustainable farming techniques adapted to challenging environments, and ecological practices that maintain biodiversity. ${ctx.country2.name} researchers argue that combining this traditional wisdom with modern scientific methods could yield breakthroughs in sustainable agriculture, medical treatments, and environmental conservation that benefit humanity globally while providing economic opportunities for knowledge-holding communities.

However, ${ctx.country1.name} indigenous leaders and advocates have raised serious concerns about how the partnership would operate. Historical examples of indigenous knowledge being extracted, commercialized by outsiders without proper compensation, and divorced from its cultural context have created deep distrust. There are questions about who has authority to share communal knowledge, how benefits would be distributed, and whether scientific documentation might strip sacred knowledge of its spiritual context or expose it to misuse.

The intellectual property framework adds complexity. Traditional knowledge often does not fit conventional patent systems designed for individual inventors. ${ctx.country1.name} is advocating for recognition of collective knowledge rights and wants guarantees that any commercial applications would require ongoing consent and benefit-sharing. ${ctx.country2.name} institutions worry that overly restrictive arrangements could make research impractical or create precedents that complicate other international research collaborations.

Cultural concerns intersect with practical ones. Some knowledge is considered sacred or restricted within indigenous communities, appropriate only for certain individuals or contexts. Indigenous knowledge systems are holistic, not easily separated into discrete "useful" components without losing meaning. There are concerns that Western scientific validation might be positioned as more legitimate than traditional understanding, undermining indigenous epistemologies.

Your diplomatic team must broker an agreement that respects indigenous knowledge sovereignty while enabling beneficial research collaboration, sets appropriate precedents for traditional knowledge rights, and ensures that cultural exchange genuinely benefits knowledge-holding communities rather than merely extracting value from them.
      `.trim(),

      festival_security: (ctx) =>
        `
The annual International Cultural Festival in ${ctx.country1.name}, a flagship event featuring performers and artists from ${ctx.country2.name} and dozens of other countries, has been disrupted by a serious security incident. A group of protesters managed to reach the main stage during a ${ctx.country2.name} cultural performance, unfurling banners with political messages and briefly halting the event before security intervened. While no one was injured, the incident has raised urgent questions about security protocols, political expression, and whether the festival can continue.

The protesters were ${ctx.country1.name} citizens demonstrating against ${ctx.country2.name} government policies they view as oppressive. Their action was non-violent but disruptive, and they've framed it as legitimate political expression protected by ${ctx.country1.name}'s free speech principles. Civil liberties organizations have defended their right to protest, arguing that cultural events with governmental sponsorship are appropriate venues for political expression.

${ctx.country2.name} has reacted strongly, viewing the incident as a serious security breach and a diplomatic affront. They've demanded formal apologies, assurances that performers and cultural delegations can operate without political harassment, and visible security improvements. Some ${ctx.country2.name} officials have hinted at withdrawing from future festivals unless ${ctx.country1.name} demonstrates it can maintain appropriate security and respect for participating nations.

${ctx.country1.name} faces competing pressures. Security officials are embarrassed by the breach and are proposing dramatically enhanced security measures, including extensive screening of festival attendees and restrictions on protest activities near venues. However, civil liberties advocates warn that turning the festival into a securitized space would fundamentally alter its character as an open, accessible public celebration of culture. Festival organizers worry that intensive security would deter attendees and performers, effectively killing the event.

The incident has also exposed deeper tensions about the relationship between cultural exchange and political neutrality. Can cultural events truly be separated from politics, or should they serve as spaces for contestation and dialogue? Should host countries guarantee that cultural delegations will not face political protest, or is such protest a healthy aspect of cultural exchange in democratic societies?

Your diplomatic team must immediately address ${ctx.country2.name}'s security concerns and decide whether the festival can continue this year. Beyond that, you must develop a framework for balancing security, free expression, and cultural exchange that can sustain the festival's future while navigating these tensions.
      `.trim(),

      artistic_freedom: (ctx) =>
        `
A group of ${ctx.country1.name} artists participating in a cultural exchange residency in ${ctx.country2.name} has created an artistic installation that ${ctx.country2.name} authorities have deemed unacceptable for public display. The work addresses themes of political authority, individual freedom, and social conformity through provocative imagery that ${ctx.country2.name} officials argue crosses from artistic expression into illegal political propaganda. The artists refuse to modify their work, and the confrontation has become an international cause célèbre about artistic freedom.

The installation uses symbolic imagery that references ${ctx.country2.name}'s political system, historical events, and contemporary social issues in ways the artists describe as "critical engagement" but authorities characterize as "disrespectful provocation." The work does not explicitly violate any laws ${ctx.country1.name} artists were briefed about before the residency, but ${ctx.country2.name} authorities argue that its overall message and context create an illegal critique of the government. They have demanded the installation be dismantled or the artists will face legal consequences.

${ctx.country1.name}'s artistic community and free expression advocates have rallied to the artists' defense, arguing that censoring artwork based on political content contradicts the cultural exchange program's stated goals of mutual understanding and creative dialogue. Prominent ${ctx.country1.name} cultural figures have characterized the situation as a test of ${ctx.country2.name}'s commitment to cultural exchange and warned that backing down would set a dangerous precedent of self-censorship.

${ctx.country2.name} counters that the residency program had clear parameters, that artistic freedom does not extend to violating host country laws, and that the artists deliberately courted controversy rather than engaging in good-faith cultural exchange. They argue that ${ctx.country1.name} would not tolerate foreign artists creating installations that violated ${ctx.country1.name} laws and that demanding exceptions amounts to cultural imperialism.

The dispute has drawn international attention, with global artistic communities, free expression organizations, and cultural institutions weighing in. The controversy threatens to overshadow all other aspects of the cultural exchange program. Several ${ctx.country1.name} artists have withdrawn from upcoming exchanges in solidarity, while ${ctx.country2.name} has suspended new cultural exchange approvals pending review of program protocols.

Your diplomatic team must navigate this highly public confrontation between artistic freedom principles and host country sovereignty, manage pressure from vocal constituencies in both countries, and determine whether the cultural exchange program can continue under terms acceptable to both nations or whether fundamental differences about expression and creativity make such programs unsustainable.
      `.trim(),
    };

    return narrativeTemplates[template.type](context);
  }

  /**
   * Generate 3-4 response options with requirements and predicted outcomes
   */
  private static generateResponseOptions(
    template: CulturalScenarioTemplate,
    context: ScenarioContext
  ): ResponseOption[] {
    const optionGenerators: Record<
      CulturalScenarioType,
      (ctx: ScenarioContext) => ResponseOption[]
    > = {
      festival_collaboration: (ctx) => [
        {
          id: "mediation",
          label: "Hire Independent Mediator",
          description:
            "Bring in a neutral third-party cultural organization to mediate disputes and restructure the festival collaboratively",
          requirements: [
            { skill: "negotiation", level: 70 },
            { skill: "cultural_sensitivity", level: 65 },
          ],
          predictedOutcomes: {
            immediate: {
              culturalImpact: 15,
              diplomaticChange: 20,
              economicCost: 35,
              relationshipStateChange: null,
            },
            shortTerm: {
              description:
                "Mediation resolves immediate disputes, festival proceeds with revised format emphasizing equal partnership",
              culturalBenefit: 60,
              diplomaticBenefit: 45,
            },
            longTerm: {
              description:
                "Establishes collaborative framework for future cultural events, strengthens institutional ties",
              culturalBenefit: 75,
              diplomaticBenefit: 70,
            },
          },
          npcsLikelyToChoose: ["Cultural Diplomat", "Pragmatic Realist"],
        },
        {
          id: "assert_dominance",
          label: "Assert Your Rights",
          description:
            "Stand firm on your original agreements and demand the partner country honor commitments",
          requirements: [
            { skill: "negotiation", level: 80 },
            { skill: "legal", level: 60 },
          ],
          predictedOutcomes: {
            immediate: {
              culturalImpact: -10,
              diplomaticChange: -25,
              economicCost: 20,
              relationshipStateChange: "tense",
            },
            shortTerm: {
              description:
                "Festival proceeds but tensions remain high, partner country feels disrespected",
              culturalBenefit: 30,
              diplomaticBenefit: -20,
            },
            longTerm: {
              description:
                "Sets precedent for contract enforcement but damages trust for future collaborations",
              culturalBenefit: 40,
              diplomaticBenefit: -30,
            },
          },
          npcsLikelyToChoose: ["Aggressive Expansionist", "Ideological Hardliner"],
        },
        {
          id: "compromise",
          label: "Propose Balanced Compromise",
          description:
            "Offer specific concessions on representation and funding in exchange for partner concessions",
          requirements: [
            { skill: "negotiation", level: 75 },
            { skill: "cultural_sensitivity", level: 70 },
            { skill: "economic", level: 50 },
          ],
          predictedOutcomes: {
            immediate: {
              culturalImpact: 10,
              diplomaticChange: 15,
              economicCost: 25,
              relationshipStateChange: null,
            },
            shortTerm: {
              description:
                "Both sides accept compromise, festival proceeds with slight modifications to program",
              culturalBenefit: 55,
              diplomaticBenefit: 50,
            },
            longTerm: {
              description:
                "Demonstrates flexibility and willingness to find middle ground, moderately strengthens relationship",
              culturalBenefit: 65,
              diplomaticBenefit: 60,
            },
          },
          npcsLikelyToChoose: ["Pragmatic Realist", "Peaceful Merchant", "Cultural Diplomat"],
        },
        {
          id: "postpone",
          label: "Postpone Festival",
          description:
            "Delay the festival to allow time for proper resolution rather than proceeding under contentious circumstances",
          requirements: [
            { skill: "negotiation", level: 60 },
            { skill: "economic", level: 65 },
          ],
          predictedOutcomes: {
            immediate: {
              culturalImpact: -15,
              diplomaticChange: -5,
              economicCost: 60,
              relationshipStateChange: null,
            },
            shortTerm: {
              description:
                "Disappointment from public and performers, but tensions de-escalate with time",
              culturalBenefit: 20,
              diplomaticBenefit: 30,
            },
            longTerm: {
              description:
                "If disputes are truly resolved, future festival could be stronger; if not, program may languish",
              culturalBenefit: 50,
              diplomaticBenefit: 45,
            },
          },
          npcsLikelyToChoose: ["Cautious Isolationist", "Pragmatic Realist"],
        },
      ],

      artifact_repatriation: (ctx) => [
        {
          id: "full_repatriation",
          label: "Full Repatriation",
          description:
            "Return all requested artifacts unconditionally, acknowledging historical injustice",
          requirements: [
            { skill: "cultural_sensitivity", level: 85 },
            { skill: "legal", level: 60 },
          ],
          predictedOutcomes: {
            immediate: {
              culturalImpact: 40,
              diplomaticChange: 50,
              economicCost: 15,
              relationshipStateChange: "friendly",
            },
            shortTerm: {
              description:
                "Massive goodwill from partner country, sets global precedent for repatriation",
              culturalBenefit: 85,
              diplomaticBenefit: 90,
            },
            longTerm: {
              description:
                "Transforms bilateral relationship into model partnership, but may trigger other repatriation requests",
              culturalBenefit: 90,
              diplomaticBenefit: 95,
            },
          },
          npcsLikelyToChoose: ["Cultural Diplomat", "Ideological Hardliner"],
        },
        {
          id: "joint_custody",
          label: "Joint Custody Agreement",
          description:
            "Propose rotating custody where artifacts spend time in both countries with shared preservation responsibilities",
          requirements: [
            { skill: "negotiation", level: 80 },
            { skill: "cultural_sensitivity", level: 75 },
            { skill: "legal", level: 70 },
          ],
          predictedOutcomes: {
            immediate: {
              culturalImpact: 25,
              diplomaticChange: 30,
              economicCost: 45,
              relationshipStateChange: null,
            },
            shortTerm: {
              description:
                "Innovative solution satisfies both sides partially, creates logistical complexity",
              culturalBenefit: 70,
              diplomaticBenefit: 65,
            },
            longTerm: {
              description:
                "Ongoing collaboration on artifact care strengthens institutional ties, serves as model for similar disputes",
              culturalBenefit: 80,
              diplomaticBenefit: 75,
            },
          },
          npcsLikelyToChoose: ["Pragmatic Realist", "Cultural Diplomat", "Peaceful Merchant"],
        },
        {
          id: "conditional_return",
          label: "Conditional Return",
          description:
            "Return artifacts contingent on verified preservation capacity and public access guarantees",
          requirements: [
            { skill: "negotiation", level: 75 },
            { skill: "legal", level: 80 },
          ],
          predictedOutcomes: {
            immediate: {
              culturalImpact: 15,
              diplomaticChange: 10,
              economicCost: 25,
              relationshipStateChange: null,
            },
            shortTerm: {
              description:
                "Partner country views conditions as paternalistic but accepts to secure return",
              culturalBenefit: 50,
              diplomaticBenefit: 35,
            },
            longTerm: {
              description:
                "Artifacts returned but relationship strained by perceived distrust implied by conditions",
              culturalBenefit: 60,
              diplomaticBenefit: 45,
            },
          },
          npcsLikelyToChoose: ["Cautious Isolationist", "Pragmatic Realist"],
        },
        {
          id: "maintain_status",
          label: "Maintain Current Status",
          description:
            "Refuse repatriation while offering enhanced collaboration on exhibition and research",
          requirements: [
            { skill: "negotiation", level: 70 },
            { skill: "legal", level: 85 },
          ],
          predictedOutcomes: {
            immediate: {
              culturalImpact: -30,
              diplomaticChange: -45,
              economicCost: 10,
              relationshipStateChange: "tense",
            },
            shortTerm: {
              description:
                "Significant public backlash in partner country, cultural exchange programs suspended",
              culturalBenefit: 20,
              diplomaticBenefit: -40,
            },
            longTerm: {
              description:
                "Long-term damage to cultural relations, potential international criticism",
              culturalBenefit: 25,
              diplomaticBenefit: -50,
            },
          },
          npcsLikelyToChoose: [
            "Aggressive Expansionist",
            "Cautious Isolationist",
            "Ideological Hardliner",
          ],
        },
      ],

      cultural_appropriation: (ctx) => [
        {
          id: "withdraw_collection",
          label: "Demand Collection Withdrawal",
          description:
            "Publicly demand the fashion company withdraw the collection and issue formal apology",
          requirements: [
            { skill: "cultural_sensitivity", level: 80 },
            { skill: "negotiation", level: 65 },
          ],
          predictedOutcomes: {
            immediate: {
              culturalImpact: 20,
              diplomaticChange: -15,
              economicCost: 35,
              relationshipStateChange: null,
            },
            shortTerm: {
              description:
                "Indigenous communities feel heard, but partner country perceives overreach",
              culturalBenefit: 60,
              diplomaticBenefit: -10,
            },
            longTerm: {
              description:
                "Sets strong precedent for cultural protection but may chill future creative collaborations",
              culturalBenefit: 70,
              diplomaticBenefit: 20,
            },
          },
          npcsLikelyToChoose: ["Ideological Hardliner", "Cultural Diplomat"],
        },
        {
          id: "collaborative_redesign",
          label: "Collaborative Redesign",
          description:
            "Work with designers and indigenous communities to respectfully redesign the collection",
          requirements: [
            { skill: "cultural_sensitivity", level: 85 },
            { skill: "negotiation", level: 80 },
            { skill: "economic", level: 60 },
          ],
          predictedOutcomes: {
            immediate: {
              culturalImpact: 30,
              diplomaticChange: 25,
              economicCost: 50,
              relationshipStateChange: null,
            },
            shortTerm: {
              description:
                "Difficult negotiations but produces culturally appropriate collection with indigenous participation",
              culturalBenefit: 80,
              diplomaticBenefit: 70,
            },
            longTerm: {
              description:
                "Creates model for ethical cultural collaboration in commercial contexts, strengthens relationship",
              culturalBenefit: 90,
              diplomaticBenefit: 85,
            },
          },
          npcsLikelyToChoose: ["Cultural Diplomat", "Pragmatic Realist", "Peaceful Merchant"],
        },
        {
          id: "educational_campaign",
          label: "Launch Educational Campaign",
          description:
            "Use controversy as opportunity for public education about cultural symbols while allowing collection",
          requirements: [
            { skill: "cultural_sensitivity", level: 70 },
            { skill: "negotiation", level: 65 },
          ],
          predictedOutcomes: {
            immediate: {
              culturalImpact: 15,
              diplomaticChange: 5,
              economicCost: 30,
              relationshipStateChange: null,
            },
            shortTerm: {
              description:
                "Raises awareness about cultural sensitivity, but does not address core grievance",
              culturalBenefit: 45,
              diplomaticBenefit: 40,
            },
            longTerm: {
              description:
                "Modest improvement in cultural understanding, but indigenous communities may feel unheard",
              culturalBenefit: 55,
              diplomaticBenefit: 50,
            },
          },
          npcsLikelyToChoose: ["Pragmatic Realist", "Peaceful Merchant"],
        },
        {
          id: "non_intervention",
          label: "Non-Intervention",
          description: "Take position that this is commercial matter outside government purview",
          requirements: [{ skill: "legal", level: 60 }],
          predictedOutcomes: {
            immediate: {
              culturalImpact: -25,
              diplomaticChange: -10,
              economicCost: 5,
              relationshipStateChange: null,
            },
            shortTerm: {
              description:
                "Indigenous communities feel abandoned, controversy continues to damage cultural exchange reputation",
              culturalBenefit: -20,
              diplomaticBenefit: -15,
            },
            longTerm: {
              description:
                "Missed opportunity to address cultural protection, potential for recurring similar controversies",
              culturalBenefit: -10,
              diplomaticBenefit: -20,
            },
          },
          npcsLikelyToChoose: ["Cautious Isolationist", "Aggressive Expansionist"],
        },
      ],

      // Simplified option generators for remaining scenarios (space considerations)
      exhibition_censorship: (ctx) => this.generateGenericResponseOptions("censorship", ctx),
      student_visa_crisis: (ctx) => this.generateGenericResponseOptions("visa_crisis", ctx),
      heritage_restoration: (ctx) => this.generateGenericResponseOptions("restoration", ctx),
      language_preservation: (ctx) => this.generateGenericResponseOptions("language", ctx),
      knowledge_sharing: (ctx) => this.generateGenericResponseOptions("knowledge", ctx),
      festival_security: (ctx) => this.generateGenericResponseOptions("security", ctx),
      artistic_freedom: (ctx) => this.generateGenericResponseOptions("artistic", ctx),
    };

    return optionGenerators[template.type](context);
  }

  /**
   * Generate generic response options for simplified scenarios
   */
  private static generateGenericResponseOptions(
    scenarioSubtype: string,
    context: ScenarioContext
  ): ResponseOption[] {
    // Generate 3-4 balanced response options with varying approaches
    return [
      {
        id: `${scenarioSubtype}_cooperative`,
        label: "Cooperative Approach",
        description: "Work collaboratively to find mutually beneficial solution",
        requirements: [
          { skill: "negotiation", level: 70 },
          { skill: "cultural_sensitivity", level: 65 },
        ],
        predictedOutcomes: {
          immediate: {
            culturalImpact: 20,
            diplomaticChange: 25,
            economicCost: 40,
            relationshipStateChange: null,
          },
          shortTerm: {
            description: "Collaborative solution strengthens working relationship",
            culturalBenefit: 65,
            diplomaticBenefit: 70,
          },
          longTerm: {
            description: "Establishes pattern of effective cooperation on complex issues",
            culturalBenefit: 75,
            diplomaticBenefit: 80,
          },
        },
        npcsLikelyToChoose: ["Cultural Diplomat", "Pragmatic Realist", "Peaceful Merchant"],
      },
      {
        id: `${scenarioSubtype}_assertive`,
        label: "Assertive Position",
        description: "Stand firm on your interests while remaining open to negotiation",
        requirements: [
          { skill: "negotiation", level: 75 },
          { skill: "economic", level: 60 },
        ],
        predictedOutcomes: {
          immediate: {
            culturalImpact: 10,
            diplomaticChange: 5,
            economicCost: 25,
            relationshipStateChange: null,
          },
          shortTerm: {
            description: "Protects your interests but may create tension",
            culturalBenefit: 50,
            diplomaticBenefit: 40,
          },
          longTerm: {
            description: "Establishes boundaries but limits depth of cooperation",
            culturalBenefit: 55,
            diplomaticBenefit: 50,
          },
        },
        npcsLikelyToChoose: ["Aggressive Expansionist", "Pragmatic Realist"],
      },
      {
        id: `${scenarioSubtype}_cautious`,
        label: "Cautious Approach",
        description: "Proceed slowly with thorough evaluation and risk mitigation",
        requirements: [
          { skill: "legal", level: 70 },
          { skill: "security", level: 65 },
        ],
        predictedOutcomes: {
          immediate: {
            culturalImpact: 5,
            diplomaticChange: 10,
            economicCost: 35,
            relationshipStateChange: null,
          },
          shortTerm: {
            description: "Minimizes risks but may be perceived as overly cautious",
            culturalBenefit: 45,
            diplomaticBenefit: 50,
          },
          longTerm: {
            description: "Protects against negative outcomes but limits potential gains",
            culturalBenefit: 50,
            diplomaticBenefit: 55,
          },
        },
        npcsLikelyToChoose: ["Cautious Isolationist", "Pragmatic Realist"],
      },
    ];
  }

  /**
   * Select appropriate scenario template based on context
   */
  static selectScenarioTemplate(
    context: ScenarioContext,
    preferredTypes?: CulturalScenarioType[]
  ): CulturalScenarioTemplate {
    // Filter templates by relationship state compatibility
    const compatibleTemplates = Object.values(CULTURAL_SCENARIO_TEMPLATES).filter((template) => {
      const relationshipOrder: RelationshipState[] = [
        "hostile",
        "tense",
        "neutral",
        "friendly",
        "allied",
      ];
      const currentIndex = relationshipOrder.indexOf(context.relationshipState);
      const minIndex = relationshipOrder.indexOf(template.minimumRelationship);

      return currentIndex >= minIndex;
    });

    // If preferred types specified, prioritize those
    if (preferredTypes && preferredTypes.length > 0) {
      const preferred = compatibleTemplates.filter((t) => preferredTypes.includes(t.type));
      if (preferred.length > 0) {
        return preferred[Math.floor(Math.random() * preferred.length)]!;
      }
    }

    // Select based on context factors
    let weights = compatibleTemplates.map((template) => {
      let weight = 1.0;

      // Weight based on cultural openness
      if (context.country1.culturalOpenness > 70 && template.culturalImpact > 60) {
        weight *= 1.3;
      }

      // Weight based on existing relationship
      if (context.relationshipStrength > 70 && template.diplomaticRisk < 50) {
        weight *= 1.2;
      }

      // Weight based on historical tensions
      if (context.historicalTensions && template.type === "artifact_repatriation") {
        weight *= 1.5;
      }

      return weight;
    });

    // Weighted random selection
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < compatibleTemplates.length; i++) {
      random -= weights[i]!;
      if (random <= 0) {
        return compatibleTemplates[i]!;
      }
    }

    return compatibleTemplates[0]!;
  }
}

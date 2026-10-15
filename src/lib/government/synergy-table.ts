/**
 * Government component synergy table (spec D13, §5)
 *
 * The one list of government component pairs that help or hurt each other. The picker
 * (`atomic-utils.ts`), the per-component `synergies`/`conflicts` arrays on
 * `ATOMIC_COMPONENTS`, and the server save (`syncGovernmentComponents`) all read it, so the
 * synergies a player sees are the ones that are saved and scored.
 *
 * Every pair is unordered: `a`/`b` order carries no meaning and each pair appears once.
 * Every component named here is defined in `ATOMIC_COMPONENTS` (enforced by a test).
 *
 * Scoring, shared by client and server:
 * - ADDITIVE: +10 effectiveness
 * - MULTIPLICATIVE: +10 × multiplier
 * - CONFLICTING: -15 effectiveness
 */

import type { ComponentType } from "@prisma/client";

export type SynergyType = "ADDITIVE" | "MULTIPLICATIVE" | "CONFLICTING";

export interface SynergyData {
  type: SynergyType;
  multiplier: number;
  description: string;
}

export interface SynergyPair extends SynergyData {
  a: ComponentType;
  b: ComponentType;
}

/** Effectiveness points per synergy type. */
export const SYNERGY_BONUS = 10;
export const CONFLICT_PENALTY = 15;

function helps(a: ComponentType, b: ComponentType, description: string): SynergyPair {
  return { a, b, type: "ADDITIVE", multiplier: 1, description };
}

function hurts(a: ComponentType, b: ComponentType, description: string): SynergyPair {
  return { a, b, type: "CONFLICTING", multiplier: 1, description };
}

export const GOVERNMENT_SYNERGY_TABLE: readonly SynergyPair[] = [
  // Where power sits
  helps(
    "CENTRALIZED_POWER",
    "AUTOCRATIC_PROCESS",
    "Central control makes a single ruler's decisions easy to carry out."
  ),
  helps(
    "CENTRALIZED_POWER",
    "PROFESSIONAL_BUREAUCRACY",
    "A strong centre gives the civil service one clear chain of command."
  ),
  helps(
    "CENTRALIZED_POWER",
    "EMERGENCY_RESPONSE",
    "A strong centre can order a fast response when disaster strikes."
  ),
  helps(
    "UNITARY_SYSTEM",
    "CENTRALIZED_POWER",
    "A single level of government keeps control in the capital."
  ),
  helps(
    "UNITARY_SYSTEM",
    "PROFESSIONAL_BUREAUCRACY",
    "One national civil service runs the same way everywhere."
  ),
  helps(
    "FEDERAL_SYSTEM",
    "DEMOCRATIC_PROCESS",
    "Regional governments give voters more places to have a say."
  ),
  helps(
    "FEDERAL_SYSTEM",
    "RULE_OF_LAW",
    "Clear laws settle disputes between the national and regional governments."
  ),
  helps(
    "FEDERAL_SYSTEM",
    "ADMINISTRATIVE_DECENTRALIZATION",
    "Regions with their own powers are ready to run local services."
  ),
  helps(
    "CONFEDERATE_SYSTEM",
    "CONSENSUS_PROCESS",
    "Member regions keep working together by reaching broad agreement."
  ),
  helps(
    "CONFEDERATE_SYSTEM",
    "TRADITIONAL_LEGITIMACY",
    "Long-standing customs hold a loose union of regions together."
  ),
  helps(
    "ADMINISTRATIVE_DECENTRALIZATION",
    "CONSENSUS_PROCESS",
    "Local offices that share power are used to reaching agreement."
  ),
  hurts(
    "CENTRALIZED_POWER",
    "FEDERAL_SYSTEM",
    "A strong centre overrides the powers of regional governments."
  ),
  hurts(
    "CENTRALIZED_POWER",
    "CONSENSUS_PROCESS",
    "A strong centre leaves little room for decisions by broad agreement."
  ),
  hurts(
    "CENTRALIZED_POWER",
    "ADMINISTRATIVE_DECENTRALIZATION",
    "A strong centre pulls back the powers handed to local offices."
  ),
  hurts(
    "CONFEDERATE_SYSTEM",
    "CENTRALIZED_POWER",
    "Member regions of a confederation resist a strong centre."
  ),
  hurts(
    "CONFEDERATE_SYSTEM",
    "PROFESSIONAL_BUREAUCRACY",
    "A loose union of regions struggles to run one national civil service."
  ),
  hurts(
    "UNITARY_SYSTEM",
    "FEDERAL_SYSTEM",
    "Power cannot sit with one national government and be shared with regions at once."
  ),
  hurts(
    "UNITARY_SYSTEM",
    "CONFEDERATE_SYSTEM",
    "A single national government clashes with self-governing member regions."
  ),

  // How decisions are made
  helps(
    "DEMOCRATIC_PROCESS",
    "ELECTORAL_LEGITIMACY",
    "Free elections give elected leaders a clear mandate."
  ),
  helps(
    "DEMOCRATIC_PROCESS",
    "RULE_OF_LAW",
    "Laws that apply to everyone keep democratic decisions fair."
  ),
  helps(
    "DEMOCRATIC_PROCESS",
    "E_GOVERNANCE",
    "Online tools make it easier for citizens to take part."
  ),
  helps(
    "DEMOCRATIC_PROCESS",
    "MINORITY_RIGHTS",
    "Protected minorities can take full part in democratic life."
  ),
  helps(
    "DEMOCRATIC_PROCESS",
    "MULTILATERAL_DIPLOMACY",
    "Democracies find it easier to build trust in international bodies."
  ),
  helps(
    "DEMOCRATIC_PROCESS",
    "SOCIAL_SAFETY_NET",
    "Voters back a safety net that protects them in hard times."
  ),
  helps(
    "DEMOCRATIC_PROCESS",
    "WELFARE_STATE",
    "Voters keep up the public services they use every day."
  ),
  helps(
    "DEMOCRATIC_PROCESS",
    "WORKER_PROTECTION",
    "Workers can vote for the laws that protect them."
  ),
  helps(
    "AUTOCRATIC_PROCESS",
    "CHARISMATIC_LEGITIMACY",
    "A popular leader makes rule by one person easier to accept."
  ),
  helps(
    "AUTOCRATIC_PROCESS",
    "MILITARY_ENFORCEMENT",
    "The army enforces the decisions of a single ruler."
  ),
  helps(
    "MILITARY_ADMINISTRATION",
    "AUTOCRATIC_PROCESS",
    "A military chain of command suits rule from the top."
  ),
  helps(
    "SURVEILLANCE_SYSTEM",
    "AUTOCRATIC_PROCESS",
    "Watching the population helps a single ruler stay in control."
  ),
  helps(
    "TECHNOCRATIC_PROCESS",
    "PERFORMANCE_LEGITIMACY",
    "Experts in charge earn support by delivering results."
  ),
  helps(
    "TECHNOCRATIC_PROCESS",
    "TECHNOCRATIC_AGENCIES",
    "Expert decision makers rely on expert agencies to carry out plans."
  ),
  helps(
    "STRATEGIC_PLANNING",
    "TECHNOCRATIC_PROCESS",
    "Experts in charge make the most of long-term plans."
  ),
  helps(
    "CONSENSUS_PROCESS",
    "TRADITIONAL_LEGITIMACY",
    "Shared customs give everyone a starting point for agreement."
  ),
  helps(
    "SOCIAL_PRESSURE",
    "CONSENSUS_PROCESS",
    "Community expectations help people settle on a shared decision."
  ),
  helps(
    "OLIGARCHIC_PROCESS",
    "ECONOMIC_INCENTIVES",
    "A small elite rewards those who keep it in power."
  ),
  helps(
    "OLIGARCHIC_PROCESS",
    "SURVEILLANCE_SYSTEM",
    "Monitoring helps a small elite spot challenges early."
  ),
  helps(
    "PARTISAN_INSTITUTIONS",
    "OLIGARCHIC_PROCESS",
    "Loyal appointees keep a small elite in charge."
  ),
  helps(
    "PARTISAN_INSTITUTIONS",
    "ECONOMIC_INCENTIVES",
    "Party-run institutions hand out jobs and favours to loyal supporters."
  ),
  hurts(
    "DEMOCRATIC_PROCESS",
    "AUTOCRATIC_PROCESS",
    "Decisions cannot be made by voters and by a single ruler at once."
  ),
  hurts(
    "DEMOCRATIC_PROCESS",
    "MILITARY_ADMINISTRATION",
    "Military rule works against elected government: both weaken."
  ),
  hurts(
    "AUTOCRATIC_PROCESS",
    "CONSENSUS_PROCESS",
    "Rule by one person leaves no room for decisions by broad agreement."
  ),
  hurts(
    "AUTOCRATIC_PROCESS",
    "ELECTORAL_LEGITIMACY",
    "Rule by one person empties elections of meaning."
  ),
  hurts(
    "AUTOCRATIC_PROCESS",
    "INDEPENDENT_JUDICIARY",
    "A single ruler and independent courts keep clashing over who has the final say."
  ),
  hurts(
    "AUTOCRATIC_PROCESS",
    "INTERNATIONAL_LAW",
    "A single ruler resists treaty obligations that limit their power."
  ),
  hurts(
    "AUTOCRATIC_PROCESS",
    "MINORITY_RIGHTS",
    "Rule by one person rarely protects minorities who object to it."
  ),
  hurts(
    "AUTOCRATIC_PROCESS",
    "E_GOVERNANCE",
    "Rule by one person has little use for citizens taking part online."
  ),
  hurts(
    "AUTOCRATIC_PROCESS",
    "ADMINISTRATIVE_DECENTRALIZATION",
    "A single ruler distrusts local offices acting on their own."
  ),
  hurts(
    "FEDERAL_SYSTEM",
    "AUTOCRATIC_PROCESS",
    "Rule by one person overrides the powers of regional governments."
  ),
  hurts(
    "RULE_OF_LAW",
    "AUTOCRATIC_PROCESS",
    "A ruler who stands above the law undermines it for everyone."
  ),
  hurts(
    "OLIGARCHIC_PROCESS",
    "DEMOCRATIC_PROCESS",
    "A small elite in charge works against rule by voters."
  ),
  hurts(
    "OLIGARCHIC_PROCESS",
    "ELECTORAL_LEGITIMACY",
    "Elite control empties elections of meaning."
  ),
  hurts(
    "TECHNOCRATIC_PROCESS",
    "CHARISMATIC_LEGITIMACY",
    "Rule by experts clashes with rule by a popular personality."
  ),
  hurts(
    "TECHNOCRATIC_PROCESS",
    "TRADITIONAL_LEGITIMACY",
    "Expert judgement clashes with doing things the way they have always been done."
  ),
  hurts(
    "CONSENSUS_PROCESS",
    "EMERGENCY_RESPONSE",
    "Waiting for broad agreement slows the response to emergencies."
  ),

  // Where authority comes from
  helps(
    "ELECTORAL_LEGITIMACY",
    "INDEPENDENT_JUDICIARY",
    "Independent courts protect the fairness of elections."
  ),
  helps(
    "ELECTORAL_LEGITIMACY",
    "RULE_OF_LAW",
    "Elections run under clear laws are trusted by winners and losers alike."
  ),
  helps(
    "TRADITIONAL_LEGITIMACY",
    "RELIGIOUS_LEGITIMACY",
    "Custom and faith each lend weight to the same rulers."
  ),
  helps(
    "PERFORMANCE_LEGITIMACY",
    "PROFESSIONAL_BUREAUCRACY",
    "A capable civil service delivers the results that earn public support."
  ),
  helps(
    "PERFORMANCE_LEGITIMACY",
    "PERFORMANCE_MANAGEMENT",
    "Measuring results shows the public what the government delivers."
  ),
  helps(
    "PERFORMANCE_LEGITIMACY",
    "TECHNOCRATIC_AGENCIES",
    "Expert agencies deliver the results that earn public support."
  ),
  helps(
    "MERIT_BASED_SYSTEM",
    "PERFORMANCE_LEGITIMACY",
    "Hiring on ability helps the government deliver results."
  ),
  helps(
    "ECONOMIC_INCENTIVES",
    "PERFORMANCE_LEGITIMACY",
    "Rising prosperity is the result people judge the government on."
  ),
  helps(
    "CHARISMATIC_LEGITIMACY",
    "SOCIAL_PRESSURE",
    "A popular leader rallies communities to fall in line."
  ),
  helps(
    "RELIGIOUS_LEGITIMACY",
    "SOCIAL_PRESSURE",
    "Community expectations reinforce religious authority."
  ),
  helps(
    "SOCIAL_PRESSURE",
    "TRADITIONAL_LEGITIMACY",
    "Community expectations keep traditions alive."
  ),
  helps(
    "CULTURAL_PRESERVATION",
    "SOCIAL_PRESSURE",
    "Communities help pass shared customs on to the next generation."
  ),
  helps(
    "CULTURAL_PRESERVATION",
    "TRADITIONAL_LEGITIMACY",
    "Protecting heritage strengthens rulers whose authority rests on tradition."
  ),
  helps(
    "INSTITUTIONAL_LEGITIMACY",
    "RULE_OF_LAW",
    "People trust institutions that follow the law."
  ),
  helps(
    "INSTITUTIONAL_LEGITIMACY",
    "PROFESSIONAL_BUREAUCRACY",
    "A capable civil service makes public institutions worth trusting."
  ),
  helps(
    "INSTITUTIONAL_LEGITIMACY",
    "INDEPENDENT_JUDICIARY",
    "Independent courts show that no office is above the rules."
  ),
  hurts(
    "TRADITIONAL_LEGITIMACY",
    "PERFORMANCE_LEGITIMACY",
    "Authority from custom and authority from results pull in different directions."
  ),
  hurts(
    "CHARISMATIC_LEGITIMACY",
    "PERFORMANCE_LEGITIMACY",
    "Personal appeal and measured results pull support in different directions."
  ),
  hurts(
    "CHARISMATIC_LEGITIMACY",
    "INSTITUTIONAL_LEGITIMACY",
    "Loyalty to one person weakens trust in institutions."
  ),
  hurts(
    "CHARISMATIC_LEGITIMACY",
    "PERFORMANCE_MANAGEMENT",
    "Leaders who rule by personal appeal resist having their results measured."
  ),
  hurts(
    "CHARISMATIC_LEGITIMACY",
    "STRATEGIC_PLANNING",
    "Plans shift with the leader's wishes, so long-term planning suffers."
  ),
  hurts(
    "RELIGIOUS_LEGITIMACY",
    "TECHNOCRATIC_PROCESS",
    "Religious authority and expert judgement compete for the final word."
  ),
  hurts(
    "RELIGIOUS_LEGITIMACY",
    "RULE_OF_LAW",
    "Religious law and secular law compete for the final word."
  ),
  hurts(
    "ECONOMIC_INCENTIVES",
    "RELIGIOUS_LEGITIMACY",
    "Buying loyalty with money cheapens authority that rests on faith."
  ),

  // Running the state
  helps(
    "PROFESSIONAL_BUREAUCRACY",
    "RULE_OF_LAW",
    "A professional civil service applies the law the same way to everyone."
  ),
  helps(
    "MERIT_BASED_SYSTEM",
    "PROFESSIONAL_BUREAUCRACY",
    "Hiring on ability keeps the civil service skilled."
  ),
  helps(
    "INDEPENDENT_JUDICIARY",
    "RULE_OF_LAW",
    "Independent courts make sure the law is applied fairly."
  ),
  helps(
    "DIGITAL_GOVERNMENT",
    "DIGITAL_INFRASTRUCTURE",
    "Online public services need fast, reliable networks."
  ),
  helps(
    "DIGITAL_GOVERNMENT",
    "E_GOVERNANCE",
    "Online services and online participation run on the same systems."
  ),
  helps(
    "DIGITAL_GOVERNMENT",
    "PERFORMANCE_MANAGEMENT",
    "Digital services make results easy to measure."
  ),
  helps(
    "PERFORMANCE_MANAGEMENT",
    "QUALITY_ASSURANCE",
    "Tracking results and checking quality improve services together."
  ),
  helps(
    "PERFORMANCE_MANAGEMENT",
    "STRATEGIC_PLANNING",
    "Measured results show whether long-term plans are working."
  ),
  helps(
    "QUALITY_ASSURANCE",
    "TECHNOCRATIC_AGENCIES",
    "Expert agencies hold public services to clear standards."
  ),
  helps(
    "RISK_MANAGEMENT",
    "STRATEGIC_PLANNING",
    "Planning ahead includes preparing for what could go wrong."
  ),
  hurts(
    "PROFESSIONAL_BUREAUCRACY",
    "PARTISAN_INSTITUTIONS",
    "Jobs for party loyalists undermine a civil service hired on ability."
  ),
  hurts(
    "PROFESSIONAL_BUREAUCRACY",
    "MILITARY_ADMINISTRATION",
    "Military command pushes the civilian civil service aside."
  ),
  hurts(
    "MILITARY_ADMINISTRATION",
    "INDEPENDENT_JUDICIARY",
    "Military rule works against independent courts: both weaken."
  ),
  hurts(
    "ELECTORAL_LEGITIMACY",
    "MILITARY_ADMINISTRATION",
    "Military rule overrides the result of elections."
  ),
  hurts(
    "PARTISAN_INSTITUTIONS",
    "INDEPENDENT_JUDICIARY",
    "Party control of institutions threatens the independence of the courts."
  ),
  hurts(
    "TECHNOCRATIC_AGENCIES",
    "PARTISAN_INSTITUTIONS",
    "Party loyalists push experts out of their agencies."
  ),
  hurts(
    "MERIT_BASED_SYSTEM",
    "PARTISAN_INSTITUTIONS",
    "Hiring on ability clashes with hiring on loyalty."
  ),
  hurts(
    "MERIT_BASED_SYSTEM",
    "TRADITIONAL_LEGITIMACY",
    "Hiring on ability clashes with posts handed down by birth or custom."
  ),
  hurts(
    "PARTISAN_INSTITUTIONS",
    "QUALITY_ASSURANCE",
    "Loyalist appointees are rarely held to quality standards."
  ),

  // Security and order
  helps(
    "MILITARY_ADMINISTRATION",
    "MILITARY_ENFORCEMENT",
    "Soldiers both run the state and enforce its orders."
  ),
  helps(
    "MILITARY_ADMINISTRATION",
    "SECURITY_ALLIANCES",
    "A military government works easily with allied armed forces."
  ),
  helps(
    "EMERGENCY_RESPONSE",
    "MILITARY_ADMINISTRATION",
    "Military logistics speed up the response to emergencies."
  ),
  helps(
    "COUNTER_TERRORISM",
    "MILITARY_ADMINISTRATION",
    "Military command structures support counter-terrorism operations."
  ),
  helps(
    "COUNTER_TERRORISM",
    "SURVEILLANCE_SYSTEM",
    "Monitoring helps find threats before they strike."
  ),
  helps(
    "CYBERSECURITY",
    "DIGITAL_INFRASTRUCTURE",
    "Protected networks keep the digital economy running."
  ),
  helps("CYBERSECURITY", "TECHNOCRATIC_AGENCIES", "Expert agencies defend government systems."),
  helps(
    "DISASTER_PREPAREDNESS",
    "RISK_MANAGEMENT",
    "Knowing the risks shows where to prepare for disasters."
  ),
  helps(
    "DISASTER_PREPAREDNESS",
    "STRATEGIC_PLANNING",
    "Long-term plans pay for preparation before disasters strike."
  ),
  helps(
    "EMERGENCY_RESPONSE",
    "RISK_MANAGEMENT",
    "Known risks come with rehearsed emergency plans."
  ),
  helps(
    "CRISIS_COMMUNICATION",
    "EMERGENCY_RESPONSE",
    "Clear public messages make an emergency response work."
  ),
  helps(
    "CRISIS_COMMUNICATION",
    "DIGITAL_GOVERNMENT",
    "Digital channels get warnings to people quickly."
  ),
  helps(
    "RECOVERY_PLANNING",
    "STRATEGIC_PLANNING",
    "Long-term plans speed up rebuilding after a crisis."
  ),
  helps(
    "ECONOMIC_INCENTIVES",
    "RECOVERY_PLANNING",
    "Grants and rewards speed up rebuilding after a crisis."
  ),
  helps(
    "RESILIENCE_BUILDING",
    "STRATEGIC_PLANNING",
    "Planning ahead makes the country harder to knock over."
  ),
  helps(
    "RESILIENCE_BUILDING",
    "SOCIAL_SAFETY_NET",
    "A safety net helps households get through shocks."
  ),
  helps(
    "PANDEMIC_MANAGEMENT",
    "TECHNOCRATIC_AGENCIES",
    "Public health experts lead the response to outbreaks."
  ),
  helps(
    "PANDEMIC_MANAGEMENT",
    "UNIVERSAL_HEALTHCARE",
    "Everyone can be tested and treated during an outbreak."
  ),
  hurts(
    "RULE_OF_LAW",
    "MILITARY_ENFORCEMENT",
    "Order kept by soldiers sidesteps the courts and fair trials."
  ),
  hurts(
    "MILITARY_ENFORCEMENT",
    "DEMOCRATIC_PROCESS",
    "Soldiers on the streets undermine free elections."
  ),
  hurts(
    "SURVEILLANCE_SYSTEM",
    "DEMOCRATIC_PROCESS",
    "Mass surveillance discourages free debate and voting."
  ),
  hurts(
    "SURVEILLANCE_SYSTEM",
    "RULE_OF_LAW",
    "Mass surveillance oversteps legal protections for privacy."
  ),

  // What the state provides
  helps(
    "SOCIAL_SAFETY_NET",
    "UNIVERSAL_HEALTHCARE",
    "Health cover and basic support protect people together."
  ),
  helps("SOCIAL_SAFETY_NET", "WELFARE_STATE", "A safety net is the core of a welfare state."),
  helps(
    "SOCIAL_SAFETY_NET",
    "WORKER_PROTECTION",
    "Labour rules and basic support catch workers who lose their jobs."
  ),
  helps(
    "UNIVERSAL_HEALTHCARE",
    "WELFARE_STATE",
    "Healthcare for everyone is a pillar of the welfare state."
  ),
  helps("PUBLIC_EDUCATION", "WELFARE_STATE", "Free schooling is a pillar of the welfare state."),
  helps("MINORITY_RIGHTS", "RULE_OF_LAW", "Laws that apply to everyone protect minorities."),
  helps(
    "ENVIRONMENTAL_PROTECTION",
    "INTERNATIONAL_LAW",
    "Climate and nature treaties back up national rules."
  ),
  helps(
    "ENVIRONMENTAL_PROTECTION",
    "TECHNOCRATIC_PROCESS",
    "Experts set environmental rules based on evidence."
  ),
  helps("DIGITAL_INFRASTRUCTURE", "SMART_CITIES", "Smart cities run on fast, reliable networks."),
  helps("SMART_CITIES", "TECHNOCRATIC_AGENCIES", "Expert agencies keep city systems running well."),

  // Economy and trade
  helps(
    "PLANNED_ECONOMY",
    "CENTRALIZED_POWER",
    "Central control lets the state direct the whole economy."
  ),
  helps(
    "PLANNED_ECONOMY",
    "TECHNOCRATIC_PROCESS",
    "Experts in charge draw up more workable economic plans."
  ),
  helps(
    "PLANNED_ECONOMY",
    "STRATEGIC_PLANNING",
    "Long-term planning gives the state's economic targets a direction."
  ),
  helps(
    "ENTREPRENEURSHIP_SUPPORT",
    "INNOVATION_ECOSYSTEM",
    "New businesses turn fresh ideas into products."
  ),
  helps(
    "ENTREPRENEURSHIP_SUPPORT",
    "STARTUP_INCUBATION",
    "Help for founders and incubators reach the same new businesses."
  ),
  helps(
    "INNOVATION_ECOSYSTEM",
    "RESEARCH_AND_DEVELOPMENT",
    "Public research feeds new ideas to businesses."
  ),
  helps(
    "INNOVATION_ECOSYSTEM",
    "STARTUP_INCUBATION",
    "Incubators help new ideas grow into companies."
  ),
  helps(
    "INTELLECTUAL_PROPERTY",
    "RULE_OF_LAW",
    "Courts that enforce the law protect inventors and creators."
  ),
  helps(
    "RESEARCH_AND_DEVELOPMENT",
    "TECHNOCRATIC_AGENCIES",
    "Expert agencies put research to practical use."
  ),
  helps(
    "RESEARCH_AND_DEVELOPMENT",
    "TECHNOLOGY_TRANSFER",
    "Sharing technology spreads the results of research."
  ),
  hurts(
    "PLANNED_ECONOMY",
    "ECONOMIC_INCENTIVES",
    "Fixed state targets leave little room for rewarding initiative."
  ),
  hurts(
    "ENTREPRENEURSHIP_SUPPORT",
    "PLANNED_ECONOMY",
    "A state-run economy leaves little room for new private businesses."
  ),
  hurts(
    "PLANNED_ECONOMY",
    "STARTUP_INCUBATION",
    "A state-run economy leaves little room for start-ups."
  ),
  hurts(
    "INTELLECTUAL_PROPERTY",
    "TECHNOLOGY_TRANSFER",
    "Strict patents make technology harder to share."
  ),

  // Foreign relations
  helps(
    "BILATERAL_RELATIONS",
    "SECURITY_ALLIANCES",
    "Close ties with partner countries underpin alliances."
  ),
  helps(
    "BILATERAL_RELATIONS",
    "TRADE_AGREEMENTS",
    "Close ties with partner countries lead to trade deals."
  ),
  helps(
    "DEVELOPMENT_AID",
    "MULTILATERAL_DIPLOMACY",
    "International bodies channel aid to where it is needed."
  ),
  helps(
    "HUMANITARIAN_INTERVENTION",
    "INTERNATIONAL_LAW",
    "Treaties give interventions a legal basis."
  ),
  helps(
    "HUMANITARIAN_INTERVENTION",
    "MULTILATERAL_DIPLOMACY",
    "Interventions backed by international bodies win wider support."
  ),
  helps(
    "INTERNATIONAL_LAW",
    "MULTILATERAL_DIPLOMACY",
    "International bodies write and uphold treaties."
  ),
  helps(
    "INTERNATIONAL_LAW",
    "RULE_OF_LAW",
    "Respect for the law at home carries over to treaties abroad."
  ),
  helps(
    "INTERNATIONAL_LAW",
    "TECHNOLOGY_TRANSFER",
    "Treaties make it easier to share technology across borders."
  ),
  helps(
    "MULTILATERAL_DIPLOMACY",
    "REGIONAL_INTEGRATION",
    "Working through international bodies supports regional cooperation."
  ),
  helps(
    "REGIONAL_INTEGRATION",
    "TRADE_AGREEMENTS",
    "Regional blocs come with trade deals between neighbours."
  ),
];

function pairKey(a: string, b: string): string {
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}

const PAIR_INDEX = new Map<string, SynergyPair>(
  GOVERNMENT_SYNERGY_TABLE.map((pair) => [pairKey(pair.a, pair.b), pair])
);

/** The table entry for two components in either order, or null when they do not interact. */
export function findSynergyPair(type1: string, type2: string): SynergyPair | null {
  if (type1 === type2) return null;
  return PAIR_INDEX.get(pairKey(type1, type2)) ?? null;
}

/**
 * Check if two government components have synergy or conflict.
 *
 * @returns SynergyData if synergy/conflict exists, null otherwise
 */
export function checkComponentSynergy(
  type1: ComponentType,
  type2: ComponentType
): SynergyData | null {
  const pair = findSynergyPair(type1, type2);
  return pair
    ? { type: pair.type, multiplier: pair.multiplier, description: pair.description }
    : null;
}

/** Effectiveness change for one interaction: positive for synergies, negative for conflicts. */
export function synergyScoreDelta(type: string, multiplier: number): number {
  if (type === "CONFLICTING") return -CONFLICT_PENALTY;
  if (type === "ADDITIVE") return SYNERGY_BONUS;
  return type === "MULTIPLICATIVE" ? multiplier * SYNERGY_BONUS : 0;
}

/** Components that help (`synergies`) or hurt (`conflicts`) the given component. */
export function getSynergyPartners(type: ComponentType): {
  synergies: ComponentType[];
  conflicts: ComponentType[];
} {
  const synergies: ComponentType[] = [];
  const conflicts: ComponentType[] = [];
  for (const pair of GOVERNMENT_SYNERGY_TABLE) {
    const other = pair.a === type ? pair.b : pair.b === type ? pair.a : null;
    if (!other) continue;
    (pair.type === "CONFLICTING" ? conflicts : synergies).push(other);
  }
  return { synergies, conflicts };
}

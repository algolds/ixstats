/** Government synergy pairs, part 1: power, decisions, authority and running the state. Read through `synergy-table.ts`. */

import { helps, hurts, type SynergyPair } from "./synergy-types";

export const SYNERGY_PAIRS_1: readonly SynergyPair[] = ([] = [
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
]);

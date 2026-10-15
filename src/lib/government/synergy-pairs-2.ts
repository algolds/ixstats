/** Government synergy pairs, part 2: security, services, economy and foreign relations. Read through `synergy-table.ts`. */

import { helps, hurts, type SynergyPair } from "./synergy-types";

export const SYNERGY_PAIRS_2: readonly SynergyPair[] = [
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

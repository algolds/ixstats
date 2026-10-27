/**
 * Plain-language guide to government components (spec §1 Step 3, §5)
 *
 * The government picker groups components under a few plain headings and shows one line
 * per component saying what it does, in words a player without a politics degree reads at a
 * glance. The technical `category` on each component stays for existing callers.
 */

import type { ComponentType } from "@prisma/client";

export const GOVERNMENT_COMPONENT_GROUPS = [
  "How leaders are chosen",
  "Where power sits",
  "What the state provides",
  "Economy and trade",
  "Security",
  "Foreign relations",
  "Running the state",
] as const;

export type GovernmentComponentGroup = (typeof GOVERNMENT_COMPONENT_GROUPS)[number];

interface ComponentGuideEntry {
  group: GovernmentComponentGroup;
  effect: string;
}

const GUIDE: Partial<Record<ComponentType, ComponentGuideEntry>> = {
  // How leaders are chosen
  ELECTORAL_LEGITIMACY: {
    group: "How leaders are chosen",
    effect: "Leaders hold power because they won free and fair elections.",
  },
  TRADITIONAL_LEGITIMACY: {
    group: "How leaders are chosen",
    effect: "Leaders hold power by custom and inheritance, such as a royal line.",
  },
  PERFORMANCE_LEGITIMACY: {
    group: "How leaders are chosen",
    effect: "People accept the government as long as it delivers growth and good services.",
  },
  CHARISMATIC_LEGITIMACY: {
    group: "How leaders are chosen",
    effect: "A popular leader's personal appeal holds the system together.",
  },
  RELIGIOUS_LEGITIMACY: {
    group: "How leaders are chosen",
    effect: "Rulers claim a religious mandate, and faith backs their authority.",
  },
  INSTITUTIONAL_LEGITIMACY: {
    group: "How leaders are chosen",
    effect: "People trust the offices and institutions, whoever happens to hold them.",
  },

  // Where power sits
  CENTRALIZED_POWER: {
    group: "Where power sits",
    effect: "The national government makes most decisions and acts quickly.",
  },
  FEDERAL_SYSTEM: {
    group: "Where power sits",
    effect: "Power is shared between the national government and regions with their own laws.",
  },
  CONFEDERATE_SYSTEM: {
    group: "Where power sits",
    effect: "Self-governing regions keep most power and cooperate through a weak centre.",
  },
  UNITARY_SYSTEM: {
    group: "Where power sits",
    effect: "One national government runs the country, and local offices carry out its decisions.",
  },
  ADMINISTRATIVE_DECENTRALIZATION: {
    group: "Where power sits",
    effect: "Local offices run day-to-day services closer to the people they serve.",
  },
  DEMOCRATIC_PROCESS: {
    group: "Where power sits",
    effect: "Elected representatives make decisions by majority vote.",
  },
  AUTOCRATIC_PROCESS: {
    group: "Where power sits",
    effect: "One ruler or a small circle decides, fast and without checks.",
  },
  TECHNOCRATIC_PROCESS: {
    group: "Where power sits",
    effect: "Experts make decisions based on evidence rather than votes.",
  },
  CONSENSUS_PROCESS: {
    group: "Where power sits",
    effect: "Decisions need broad agreement, so they are slow but widely supported.",
  },
  OLIGARCHIC_PROCESS: {
    group: "Where power sits",
    effect: "A small group of wealthy or powerful families makes the decisions.",
  },
  INDEPENDENT_JUDICIARY: {
    group: "Where power sits",
    effect: "Courts can rule against the government without fear of being overruled.",
  },
  RULE_OF_LAW: {
    group: "Where power sits",
    effect: "The same laws apply to everyone, including those in power.",
  },
  MILITARY_ADMINISTRATION: {
    group: "Where power sits",
    effect: "Officers run the government through the military chain of command.",
  },

  // What the state provides
  WELFARE_STATE: {
    group: "What the state provides",
    effect: "The state funds broad support for people from birth to old age.",
  },
  UNIVERSAL_HEALTHCARE: {
    group: "What the state provides",
    effect: "Everyone can see a doctor and get treatment, paid for by the state.",
  },
  PUBLIC_EDUCATION: {
    group: "What the state provides",
    effect: "Free schools for every child raise skills across the country.",
  },
  SOCIAL_SAFETY_NET: {
    group: "What the state provides",
    effect: "Basic support catches people who lose their job or fall ill.",
  },
  WORKER_PROTECTION: {
    group: "What the state provides",
    effect: "Labour laws set fair pay, safe workplaces and limits on working hours.",
  },
  ENVIRONMENTAL_PROTECTION: {
    group: "What the state provides",
    effect: "Rules keep air, water and land clean, at some cost to industry.",
  },
  CULTURAL_PRESERVATION: {
    group: "What the state provides",
    effect: "The state protects heritage, languages and national traditions.",
  },
  MINORITY_RIGHTS: {
    group: "What the state provides",
    effect: "The law protects minority groups from discrimination.",
  },
  DIGITAL_INFRASTRUCTURE: {
    group: "What the state provides",
    effect: "Fast internet and modern networks reach homes and businesses.",
  },
  SMART_CITIES: {
    group: "What the state provides",
    effect: "Cities use sensors and data to run transport, power and services better.",
  },

  // Economy and trade
  ECONOMIC_INCENTIVES: {
    group: "Economy and trade",
    effect: "The state uses money, jobs and contracts to reward the behaviour it wants.",
  },
  PLANNED_ECONOMY: {
    group: "Economy and trade",
    effect: "State planners set what is produced, at what price, and where money is invested.",
  },
  TRADE_AGREEMENTS: {
    group: "Economy and trade",
    effect: "Deals with other countries cut tariffs and open markets for exports.",
  },
  ENTREPRENEURSHIP_SUPPORT: {
    group: "Economy and trade",
    effect: "Loans, advice and simpler rules help people start businesses.",
  },
  STARTUP_INCUBATION: {
    group: "Economy and trade",
    effect: "Funded programmes give new companies space, money and mentors.",
  },
  INNOVATION_ECOSYSTEM: {
    group: "Economy and trade",
    effect: "Universities, investors and businesses work together on new ideas.",
  },
  RESEARCH_AND_DEVELOPMENT: {
    group: "Economy and trade",
    effect: "Public money pays for science and new technology.",
  },
  TECHNOLOGY_TRANSFER: {
    group: "Economy and trade",
    effect: "Programmes help businesses adopt technology from labs and abroad.",
  },
  INTELLECTUAL_PROPERTY: {
    group: "Economy and trade",
    effect: "Patents and copyright protect inventors and creators.",
  },

  // Security
  SURVEILLANCE_SYSTEM: {
    group: "Security",
    effect: "The state watches communications and movement to spot threats and dissent.",
  },
  MILITARY_ENFORCEMENT: {
    group: "Security",
    effect: "Soldiers keep order at home, not just the police.",
  },
  SOCIAL_PRESSURE: {
    group: "Security",
    effect: "Community expectations and peer pressure keep people in line.",
  },
  CYBERSECURITY: {
    group: "Security",
    effect: "Specialists defend government and national networks from attack.",
  },
  COUNTER_TERRORISM: {
    group: "Security",
    effect: "Dedicated units find and stop terrorist plots.",
  },
  EMERGENCY_RESPONSE: {
    group: "Security",
    effect: "Rescue and relief services move fast when disaster strikes.",
  },
  DISASTER_PREPAREDNESS: {
    group: "Security",
    effect: "Plans, drills and stockpiles are ready before disasters happen.",
  },
  PANDEMIC_MANAGEMENT: {
    group: "Security",
    effect: "Public health teams track and contain disease outbreaks.",
  },
  CRISIS_COMMUNICATION: {
    group: "Security",
    effect: "Clear public warnings and updates reach people during a crisis.",
  },
  RECOVERY_PLANNING: {
    group: "Security",
    effect: "Ready plans speed up rebuilding after a crisis.",
  },
  RESILIENCE_BUILDING: {
    group: "Security",
    effect: "Backups and reserves help the country absorb shocks.",
  },

  // Foreign relations
  MULTILATERAL_DIPLOMACY: {
    group: "Foreign relations",
    effect: "The country works through international bodies to solve shared problems.",
  },
  BILATERAL_RELATIONS: {
    group: "Foreign relations",
    effect: "The country builds close one-to-one ties with chosen partners.",
  },
  REGIONAL_INTEGRATION: {
    group: "Foreign relations",
    effect: "The country joins its neighbours in a regional bloc for trade and travel.",
  },
  INTERNATIONAL_LAW: {
    group: "Foreign relations",
    effect: "The country signs and keeps international treaties.",
  },
  DEVELOPMENT_AID: {
    group: "Foreign relations",
    effect: "The country funds aid for poorer countries, which builds goodwill abroad.",
  },
  HUMANITARIAN_INTERVENTION: {
    group: "Foreign relations",
    effect: "The country is willing to step in abroad to stop mass suffering.",
  },
  SECURITY_ALLIANCES: {
    group: "Foreign relations",
    effect: "Allies promise to defend each other if attacked.",
  },

  // Running the state
  PROFESSIONAL_BUREAUCRACY: {
    group: "Running the state",
    effect: "A trained civil service runs public services by clear rules.",
  },
  PARTISAN_INSTITUTIONS: {
    group: "Running the state",
    effect: "Government jobs go to loyal party members.",
  },
  TECHNOCRATIC_AGENCIES: {
    group: "Running the state",
    effect: "Expert-led agencies run specialist areas such as health, energy and money.",
  },
  MERIT_BASED_SYSTEM: {
    group: "Running the state",
    effect: "Public jobs go to the best qualified candidates through open exams.",
  },
  PERFORMANCE_MANAGEMENT: {
    group: "Running the state",
    effect: "Targets and regular reviews show which services work and which do not.",
  },
  QUALITY_ASSURANCE: {
    group: "Running the state",
    effect: "Inspections and standards keep public services reliable.",
  },
  STRATEGIC_PLANNING: {
    group: "Running the state",
    effect: "Long-term plans line up spending and policy across ministries.",
  },
  RISK_MANAGEMENT: {
    group: "Running the state",
    effect: "The government spots risks early and plans for them.",
  },
  DIGITAL_GOVERNMENT: {
    group: "Running the state",
    effect: "People use public services online instead of queueing at offices.",
  },
  E_GOVERNANCE: {
    group: "Running the state",
    effect: "Citizens can comment on and take part in decisions online.",
  },
};

/** Plain group for every defined government component, by component type. */
export const GOVERNMENT_COMPONENT_GROUP: Partial<Record<ComponentType, GovernmentComponentGroup>> =
  Object.fromEntries(Object.entries(GUIDE).map(([type, entry]) => [type, entry.group]));

/** One plain line per defined government component saying what it does. */
export const GOVERNMENT_COMPONENT_EFFECT: Partial<Record<ComponentType, string>> =
  Object.fromEntries(Object.entries(GUIDE).map(([type, entry]) => [type, entry.effect]));

export function getComponentGroup(type: ComponentType): GovernmentComponentGroup | undefined {
  return GUIDE[type]?.group;
}

export function getComponentEffect(type: ComponentType): string | undefined {
  return GUIDE[type]?.effect;
}

/** Components bucketed by plain group, groups in display order, empty groups omitted. */
export function groupComponentsByPlainGroup(
  types: readonly ComponentType[]
): Array<{ group: GovernmentComponentGroup; components: ComponentType[] }> {
  return GOVERNMENT_COMPONENT_GROUPS.map((group) => ({
    group,
    components: types.filter((type) => GUIDE[type]?.group === group),
  })).filter((bucket) => bucket.components.length > 0);
}

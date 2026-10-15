/**
 * Government forms catalogue (spec §4, D7)
 *
 * A recognisable form of government is the first government choice a player makes. Picking
 * one sets `GovernmentStructure.governmentType`, the institution names and a working
 * component set. No form starts with a conflicting pair from the shared synergy table, and
 * every component is defined in `ATOMIC_COMPONENTS` (both enforced by tests).
 */

import type { ComponentType } from "@prisma/client";

export const GOVERNMENT_FORM_IDS = [
  "parliamentary-republic",
  "presidential-republic",
  "federal-republic",
  "constitutional-monarchy",
  "absolute-monarchy",
  "one-party-state",
  "military-government",
  "theocracy",
  "technocracy",
  "merchant-oligarchy",
  "confederation",
] as const;

export type GovernmentFormId = (typeof GOVERNMENT_FORM_IDS)[number];

export interface GovernmentInstitutions {
  headOfStateTitle: string;
  headOfGovernmentTitle: string;
  legislatureName: string;
  executiveName: string;
  judicialName: string;
}

export interface GovernmentForm {
  id: GovernmentFormId;
  name: string;
  /** One plain line. */
  description: string;
  /** Saved to `GovernmentStructure.governmentType`. */
  governmentType: string;
  institutions: GovernmentInstitutions;
  components: ComponentType[];
}

export const DEFAULT_GOVERNMENT_FORM_ID: GovernmentFormId = "parliamentary-republic";

export const GOVERNMENT_FORMS: GovernmentForm[] = [
  {
    id: "parliamentary-republic",
    name: "Parliamentary republic",
    description:
      "Voters elect a parliament, which chooses the prime minister who runs the government.",
    governmentType: "Parliamentary Republic",
    institutions: {
      headOfStateTitle: "President",
      headOfGovernmentTitle: "Prime Minister",
      legislatureName: "Parliament",
      executiveName: "Cabinet",
      judicialName: "Supreme Court",
    },
    components: [
      "DEMOCRATIC_PROCESS",
      "ELECTORAL_LEGITIMACY",
      "INDEPENDENT_JUDICIARY",
      "RULE_OF_LAW",
      "PROFESSIONAL_BUREAUCRACY",
      "UNITARY_SYSTEM",
    ],
  },
  {
    id: "presidential-republic",
    name: "Presidential republic",
    description: "Voters elect a president who leads both the state and the government.",
    governmentType: "Presidential Republic",
    institutions: {
      headOfStateTitle: "President",
      headOfGovernmentTitle: "President",
      legislatureName: "Congress",
      executiveName: "Cabinet",
      judicialName: "Supreme Court",
    },
    components: [
      "DEMOCRATIC_PROCESS",
      "ELECTORAL_LEGITIMACY",
      "INDEPENDENT_JUDICIARY",
      "RULE_OF_LAW",
      "PROFESSIONAL_BUREAUCRACY",
      "UNITARY_SYSTEM",
    ],
  },
  {
    id: "federal-republic",
    name: "Federal republic",
    description:
      "An elected national government shares power with regions that make their own laws.",
    governmentType: "Federal Republic",
    institutions: {
      headOfStateTitle: "President",
      headOfGovernmentTitle: "Chancellor",
      legislatureName: "Federal Assembly",
      executiveName: "Federal Government",
      judicialName: "Federal Constitutional Court",
    },
    components: [
      "DEMOCRATIC_PROCESS",
      "ELECTORAL_LEGITIMACY",
      "FEDERAL_SYSTEM",
      "ADMINISTRATIVE_DECENTRALIZATION",
      "INDEPENDENT_JUDICIARY",
      "RULE_OF_LAW",
    ],
  },
  {
    id: "constitutional-monarchy",
    name: "Constitutional monarchy",
    description: "A monarch reigns as head of state while an elected parliament governs.",
    governmentType: "Constitutional Monarchy",
    institutions: {
      headOfStateTitle: "Monarch",
      headOfGovernmentTitle: "Prime Minister",
      legislatureName: "Parliament",
      executiveName: "Cabinet",
      judicialName: "Supreme Court",
    },
    components: [
      "TRADITIONAL_LEGITIMACY",
      "DEMOCRATIC_PROCESS",
      "INDEPENDENT_JUDICIARY",
      "RULE_OF_LAW",
      "PROFESSIONAL_BUREAUCRACY",
    ],
  },
  {
    id: "absolute-monarchy",
    name: "Absolute monarchy",
    description:
      "A hereditary monarch rules directly, with advisers but no elected check on power.",
    governmentType: "Absolute Monarchy",
    institutions: {
      headOfStateTitle: "Monarch",
      headOfGovernmentTitle: "Monarch",
      legislatureName: "Royal Council",
      executiveName: "Royal Court",
      judicialName: "Royal Court of Justice",
    },
    components: [
      "TRADITIONAL_LEGITIMACY",
      "AUTOCRATIC_PROCESS",
      "CENTRALIZED_POWER",
      "PROFESSIONAL_BUREAUCRACY",
      "CULTURAL_PRESERVATION",
    ],
  },
  {
    id: "one-party-state",
    name: "One-party state",
    description:
      "A single ruling party controls the state, plans for the long term and allows no rivals.",
    governmentType: "One-Party State",
    institutions: {
      headOfStateTitle: "Chairman",
      headOfGovernmentTitle: "Premier",
      legislatureName: "People's Assembly",
      executiveName: "State Council",
      judicialName: "Supreme People's Court",
    },
    components: [
      "PARTISAN_INSTITUTIONS",
      "AUTOCRATIC_PROCESS",
      "CENTRALIZED_POWER",
      "STRATEGIC_PLANNING",
      "SURVEILLANCE_SYSTEM",
    ],
  },
  {
    id: "military-government",
    name: "Military government",
    description: "Senior officers run the country and the army keeps order.",
    governmentType: "Military Government",
    institutions: {
      headOfStateTitle: "Chairman of the Military Council",
      headOfGovernmentTitle: "Premier",
      legislatureName: "Military Council",
      executiveName: "Council of Ministers",
      judicialName: "Supreme Court",
    },
    components: [
      "MILITARY_ADMINISTRATION",
      "MILITARY_ENFORCEMENT",
      "CENTRALIZED_POWER",
      "AUTOCRATIC_PROCESS",
    ],
  },
  {
    id: "theocracy",
    name: "Theocracy",
    description: "Religious leaders hold power and religious law shapes the state.",
    governmentType: "Theocracy",
    institutions: {
      headOfStateTitle: "Supreme Leader",
      headOfGovernmentTitle: "Chief Minister",
      legislatureName: "Consultative Assembly",
      executiveName: "Council of Ministers",
      judicialName: "Supreme Religious Court",
    },
    components: [
      "RELIGIOUS_LEGITIMACY",
      "TRADITIONAL_LEGITIMACY",
      "CULTURAL_PRESERVATION",
      "CENTRALIZED_POWER",
      "SOCIAL_PRESSURE",
    ],
  },
  {
    id: "technocracy",
    name: "Technocracy",
    description: "Experts chosen for their skill run the state and are judged on results.",
    governmentType: "Technocracy",
    institutions: {
      headOfStateTitle: "Chancellor",
      headOfGovernmentTitle: "Director-General",
      legislatureName: "Council of Experts",
      executiveName: "Directorate",
      judicialName: "Supreme Court",
    },
    components: [
      "TECHNOCRATIC_PROCESS",
      "TECHNOCRATIC_AGENCIES",
      "MERIT_BASED_SYSTEM",
      "PERFORMANCE_LEGITIMACY",
    ],
  },
  {
    id: "merchant-oligarchy",
    name: "Merchant oligarchy",
    description: "Wealthy trading families govern through councils and protect commerce.",
    governmentType: "Merchant Oligarchy",
    institutions: {
      headOfStateTitle: "Doge",
      headOfGovernmentTitle: "Chief Councillor",
      legislatureName: "Grand Council",
      executiveName: "Executive Council",
      judicialName: "High Court",
    },
    components: ["OLIGARCHIC_PROCESS", "ECONOMIC_INCENTIVES", "RULE_OF_LAW", "TRADE_AGREEMENTS"],
  },
  {
    id: "confederation",
    name: "Confederation",
    description: "Self-governing member states cooperate through a light central council.",
    governmentType: "Confederation",
    institutions: {
      headOfStateTitle: "President of the Confederation",
      headOfGovernmentTitle: "President of the Confederation",
      legislatureName: "Confederal Diet",
      executiveName: "Confederal Council",
      judicialName: "Confederal Court",
    },
    components: ["CONFEDERATE_SYSTEM", "CONSENSUS_PROCESS", "ADMINISTRATIVE_DECENTRALIZATION"],
  },
];

const FORMS_BY_ID = new Map<string, GovernmentForm>(
  GOVERNMENT_FORMS.map((form) => [form.id, form])
);

export function getGovernmentForm(id: string): GovernmentForm | undefined {
  return FORMS_BY_ID.get(id);
}

/**
 * Ordered keyword rules: the first rule with a matching pattern wins. More specific forms
 * come first so "Federal parliamentary constitutional monarchy" reads as a monarchy and
 * "Islamic republic" as a theocracy.
 */
const FORM_MATCH_RULES: Array<{ id: GovernmentFormId; patterns: RegExp[] }> = [
  { id: "confederation", patterns: [/confedera/] },
  { id: "military-government", patterns: [/junta/, /militar/, /stratocra/, /martial law/] },
  {
    id: "theocracy",
    patterns: [/theocra/, /islamic/, /caliphate/, /ecclesiastic/, /papal/, /clerical/, /hierocra/],
  },
  { id: "technocracy", patterns: [/technocra/] },
  {
    id: "one-party-state",
    patterns: [
      /one[- ]party/,
      /single[- ]party/,
      /dominant[- ]party/,
      /communist/,
      /marxist/,
      /leninist/,
      /socialist state/,
      /people'?s republic/,
    ],
  },
  { id: "merchant-oligarchy", patterns: [/oligarch/, /merchant/, /plutocra/, /mercantile/] },
  {
    id: "absolute-monarchy",
    patterns: [
      /absolute/,
      /autocratic monarchy/,
      /despot/,
      // A sultanate or emirate rules directly unless the text says otherwise.
      /^(?!.*(constitutional|parliamentary)).*(sultanate|emirate)/,
    ],
  },
  {
    id: "constitutional-monarchy",
    patterns: [
      /monarch/,
      /kingdom/,
      /\bempire\b/,
      /principality/,
      /grand duchy/,
      /emirate/,
      /sultanate/,
    ],
  },
  { id: "federal-republic", patterns: [/federa/] },
  { id: "presidential-republic", patterns: [/presidential/, /semi-presidential/] },
  { id: "parliamentary-republic", patterns: [/parliamentary/, /republic/, /democra/] },
];

/**
 * Closest government form for a free-text government type, such as a wiki infobox value.
 * Defaults to a parliamentary republic when nothing matches.
 */
export function matchGovernmentForm(text: string): GovernmentFormId {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return DEFAULT_GOVERNMENT_FORM_ID;
  for (const rule of FORM_MATCH_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) return rule.id;
  }
  return DEFAULT_GOVERNMENT_FORM_ID;
}

/**
 * Default departments per government form (redesign spec §3, §4).
 *
 * At founding the builder no longer asks for departments: each government form starts with 5 to
 * 9 departments named for the form ("Ministry of Defence" or "Royal Army Command"). Each carries
 * the share of the starting budget it receives; the shares of a form sum to 1.
 */

import type { DepartmentCategory } from "~/types/government";

export interface FormDepartment {
  name: string;
  shortName: string;
  category: DepartmentCategory;
  ministerTitle: string;
  /** 1 to 100, higher first. */
  priority: number;
  /** Share of the total budget, 0 to 1. A form's shares sum to 1. */
  spendingShare: number;
}

type Row = [
  name: string,
  shortName: string,
  category: DepartmentCategory,
  ministerTitle: string,
  spendingShare: number,
];

const PARLIAMENTARY: Row[] = [
  ["Ministry of Finance", "Finance", "Finance", "Minister of Finance", 0.1],
  ["Ministry of Health", "Health", "Health", "Minister of Health", 0.2],
  [
    "Ministry of Social Affairs",
    "Social Affairs",
    "Social Services",
    "Minister of Social Affairs",
    0.2,
  ],
  ["Ministry of Education", "Education", "Education", "Minister of Education", 0.18],
  ["Ministry of Defence", "Defence", "Defense", "Minister of Defence", 0.1],
  ["Ministry of the Interior", "Interior", "Interior", "Minister of the Interior", 0.08],
  ["Ministry of Justice", "Justice", "Justice", "Minister of Justice", 0.05],
  ["Ministry of Transport", "Transport", "Transportation", "Minister of Transport", 0.05],
  ["Ministry of Foreign Affairs", "Foreign Affairs", "Foreign Affairs", "Foreign Minister", 0.04],
];

const PRESIDENTIAL: Row[] = [
  ["Department of the Treasury", "Treasury", "Finance", "Secretary of the Treasury", 0.08],
  ["Department of Health", "Health", "Health", "Secretary of Health", 0.2],
  [
    "Department of Social Security",
    "Social Security",
    "Social Services",
    "Secretary of Social Security",
    0.18,
  ],
  ["Department of Defense", "Defense", "Defense", "Secretary of Defense", 0.16],
  ["Department of Education", "Education", "Education", "Secretary of Education", 0.14],
  [
    "Department of Homeland Security",
    "Homeland Security",
    "Interior",
    "Secretary of Homeland Security",
    0.08,
  ],
  ["Department of Justice", "Justice", "Justice", "Attorney General", 0.06],
  [
    "Department of Transportation",
    "Transportation",
    "Transportation",
    "Secretary of Transportation",
    0.06,
  ],
  ["Department of State", "State", "Foreign Affairs", "Secretary of State", 0.04],
];

const FEDERAL: Row[] = [
  [
    "Federal Ministry of Labour and Social Affairs",
    "Labour",
    "Social Services",
    "Federal Minister of Labour",
    0.26,
  ],
  ["Federal Ministry of Health", "Health", "Health", "Federal Minister of Health", 0.18],
  ["Federal Ministry of Finance", "Finance", "Finance", "Federal Minister of Finance", 0.1],
  ["Federal Ministry of Defence", "Defence", "Defense", "Federal Minister of Defence", 0.1],
  [
    "Federal Ministry of Education and Research",
    "Education",
    "Education",
    "Federal Minister of Education",
    0.1,
  ],
  [
    "Federal Ministry of Transport",
    "Transport",
    "Transportation",
    "Federal Minister of Transport",
    0.1,
  ],
  [
    "Federal Ministry of the Interior",
    "Interior",
    "Interior",
    "Federal Minister of the Interior",
    0.08,
  ],
  ["Federal Ministry of Justice", "Justice", "Justice", "Federal Minister of Justice", 0.04],
  ["Federal Foreign Office", "Foreign Office", "Foreign Affairs", "Federal Foreign Minister", 0.04],
];

const CONSTITUTIONAL_MONARCHY: Row[] = [
  ["Ministry of Health", "Health", "Health", "Secretary of State for Health", 0.22],
  [
    "Ministry of Work and Pensions",
    "Work and Pensions",
    "Social Services",
    "Secretary of State for Work and Pensions",
    0.2,
  ],
  ["Ministry of Education", "Education", "Education", "Secretary of State for Education", 0.16],
  ["The Treasury", "Treasury", "Finance", "Chancellor of the Treasury", 0.1],
  ["Ministry of Defence", "Defence", "Defense", "Secretary of State for Defence", 0.1],
  ["Home Office", "Home Office", "Interior", "Home Secretary", 0.08],
  ["Ministry of Justice", "Justice", "Justice", "Lord Chancellor", 0.05],
  [
    "Ministry of Culture and Heritage",
    "Culture",
    "Culture",
    "Secretary of State for Culture",
    0.05,
  ],
  ["Foreign Office", "Foreign Office", "Foreign Affairs", "Foreign Secretary", 0.04],
];

const ABSOLUTE_MONARCHY: Row[] = [
  ["Royal Army Command", "Royal Army", "Defense", "Marshal of the Realm", 0.26],
  [
    "Royal Ministry of the Interior",
    "Interior",
    "Interior",
    "Royal Minister of the Interior",
    0.14,
  ],
  ["Royal Office of Public Health", "Public Health", "Health", "Royal Physician General", 0.13],
  ["Royal Treasury", "Treasury", "Finance", "Royal Treasurer", 0.12],
  ["Royal Office of Public Works", "Public Works", "Transportation", "Master of Works", 0.12],
  ["Royal Household", "Household", "Other", "Lord Chamberlain", 0.1],
  ["Royal Court of Justice", "Justice", "Justice", "Lord Justice", 0.08],
  ["Royal Chancery", "Chancery", "Foreign Affairs", "Royal Chancellor", 0.05],
];

const ONE_PARTY_STATE: Row[] = [
  ["Ministry of National Defence", "Defence", "Defense", "Minister of National Defence", 0.2],
  ["Ministry of Heavy Industry", "Industry", "Commerce", "Minister of Heavy Industry", 0.14],
  ["Ministry of Public Health", "Public Health", "Health", "Minister of Public Health", 0.14],
  ["State Planning Commission", "Planning", "Finance", "Chairman of State Planning", 0.12],
  ["Ministry of Education", "Education", "Education", "Minister of Education", 0.12],
  [
    "Ministry of Public Security",
    "Public Security",
    "Interior",
    "Minister of Public Security",
    0.1,
  ],
  [
    "Ministry of State Security",
    "State Security",
    "Intelligence",
    "Minister of State Security",
    0.1,
  ],
  [
    "Ministry of Foreign Affairs",
    "Foreign Affairs",
    "Foreign Affairs",
    "Minister of Foreign Affairs",
    0.04,
  ],
  ["Central Party Office", "Party Office", "Other", "First Secretary", 0.04],
];

const MILITARY_GOVERNMENT: Row[] = [
  ["Ministry of Defence", "Defence", "Defense", "Minister of Defence", 0.34],
  [
    "Ministry of Health and Welfare",
    "Health and Welfare",
    "Health",
    "Minister of Health and Welfare",
    0.14,
  ],
  [
    "Directorate of Internal Security",
    "Internal Security",
    "Interior",
    "Director of Internal Security",
    0.12,
  ],
  ["Ministry of Public Works", "Public Works", "Transportation", "Minister of Public Works", 0.12],
  ["Ministry of Finance", "Finance", "Finance", "Minister of Finance", 0.1],
  [
    "Military Intelligence Directorate",
    "Intelligence",
    "Intelligence",
    "Director of Military Intelligence",
    0.08,
  ],
  ["Office of the Military Council", "Council Office", "Other", "Secretary of the Council", 0.06],
  [
    "Ministry of Foreign Affairs",
    "Foreign Affairs",
    "Foreign Affairs",
    "Minister of Foreign Affairs",
    0.04,
  ],
];

const THEOCRACY: Row[] = [
  ["Ministry of Defence", "Defence", "Defense", "Minister of Defence", 0.16],
  ["Ministry of Education and Learning", "Education", "Education", "Minister of Learning", 0.16],
  ["Ministry of Health", "Health", "Health", "Minister of Health", 0.16],
  ["Ministry of Charity and Welfare", "Charity", "Social Services", "Minister of Charity", 0.14],
  ["Ministry of Faith and Guidance", "Faith", "Culture", "Minister of Faith", 0.1],
  ["Ministry of Finance and Alms", "Finance", "Finance", "Minister of Finance", 0.1],
  ["Ministry of Religious Law", "Religious Law", "Justice", "Chief Jurist", 0.08],
  ["Office of the Supreme Council", "Council Office", "Other", "Secretary of the Council", 0.06],
  [
    "Ministry of Foreign Affairs",
    "Foreign Affairs",
    "Foreign Affairs",
    "Minister of Foreign Affairs",
    0.04,
  ],
];

const TECHNOCRACY: Row[] = [
  ["Agency for Health Systems", "Health", "Health", "Director of Health Systems", 0.2],
  ["Agency for Education and Skills", "Education", "Education", "Director of Education", 0.18],
  [
    "Agency for Science and Technology",
    "Science",
    "Science and Technology",
    "Chief Scientist",
    0.14,
  ],
  [
    "Agency for Infrastructure",
    "Infrastructure",
    "Transportation",
    "Director of Infrastructure",
    0.12,
  ],
  [
    "Agency for Social Insurance",
    "Social Insurance",
    "Social Services",
    "Director of Social Insurance",
    0.12,
  ],
  ["Office of Budget and Performance", "Budget", "Finance", "Director of Budget", 0.08],
  ["Agency for Energy and Environment", "Energy", "Energy", "Director of Energy", 0.08],
  ["Agency for National Security", "Security", "Defense", "Director of National Security", 0.06],
  [
    "Agency for External Relations",
    "External Relations",
    "Foreign Affairs",
    "Director of External Relations",
    0.02,
  ],
];

const MERCHANT_OLIGARCHY: Row[] = [
  ["Admiralty", "Admiralty", "Defense", "First Lord of the Admiralty", 0.18],
  ["Board of Trade", "Trade", "Commerce", "President of the Board of Trade", 0.14],
  ["Office of Harbours and Roads", "Harbours", "Transportation", "Harbourmaster General", 0.14],
  ["Guild Welfare Office", "Welfare", "Social Services", "Warden of the Guilds", 0.14],
  ["Office of Public Health", "Public Health", "Health", "Surgeon General", 0.14],
  ["Chamber of the Treasury", "Treasury", "Finance", "Treasurer", 0.12],
  ["Chamber of Justice", "Justice", "Justice", "Chief Magistrate", 0.08],
  ["Office of Embassies", "Embassies", "Foreign Affairs", "Chief Envoy", 0.06],
];

const CONFEDERATION: Row[] = [
  ["Confederal Defence Council", "Defence", "Defense", "Defence Commissioner", 0.3],
  [
    "Commission for Shared Infrastructure",
    "Infrastructure",
    "Transportation",
    "Infrastructure Commissioner",
    0.18,
  ],
  ["Commission for Trade and Customs", "Trade", "Commerce", "Trade Commissioner", 0.16],
  ["Confederal Treasury", "Treasury", "Finance", "Confederal Treasurer", 0.14],
  ["Confederal Court", "Court", "Justice", "Chief Justice", 0.12],
  ["Confederal Foreign Office", "Foreign Office", "Foreign Affairs", "Foreign Commissioner", 0.1],
];

/** Departments per form id; an unknown id gets the parliamentary set. */
const FORM_DEPARTMENTS: Record<string, Row[]> = {
  "parliamentary-republic": PARLIAMENTARY,
  "presidential-republic": PRESIDENTIAL,
  "federal-republic": FEDERAL,
  "constitutional-monarchy": CONSTITUTIONAL_MONARCHY,
  "absolute-monarchy": ABSOLUTE_MONARCHY,
  "one-party-state": ONE_PARTY_STATE,
  "military-government": MILITARY_GOVERNMENT,
  theocracy: THEOCRACY,
  technocracy: TECHNOCRACY,
  "merchant-oligarchy": MERCHANT_OLIGARCHY,
  confederation: CONFEDERATION,
};

/** The `governmentType` a form founds a nation with. */
const FORM_GOVERNMENT_TYPES: Record<string, string> = {
  "parliamentary-republic": "Parliamentary Republic",
  "presidential-republic": "Presidential Republic",
  "federal-republic": "Federal Republic",
  "constitutional-monarchy": "Constitutional Monarchy",
  "absolute-monarchy": "Absolute Monarchy",
  "one-party-state": "One-Party State",
  "military-government": "Military Government",
  theocracy: "Theocracy",
  technocracy: "Technocracy",
  "merchant-oligarchy": "Merchant Oligarchy",
  confederation: "Confederation",
};

export const KNOWN_FORM_IDS = Object.keys(FORM_DEPARTMENTS);

export const DEFAULT_FORM_ID = "parliamentary-republic";

/** The default departments for a government form, highest share first; shares sum to 1. */
export function departmentsForForm(formId: string): FormDepartment[] {
  const rows = FORM_DEPARTMENTS[formId] ?? PARLIAMENTARY;
  const total = rows.reduce((sum, row) => sum + row[4], 0);
  return rows.map(([name, shortName, category, ministerTitle, share], index) => ({
    name,
    shortName,
    category,
    ministerTitle,
    priority: Math.max(10, 90 - index * 5),
    spendingShare: share / total,
  }));
}

/** The government type a form founds a nation with; null for an unknown form id. */
export function governmentTypeForForm(formId: string): string | null {
  return FORM_GOVERNMENT_TYPES[formId] ?? null;
}

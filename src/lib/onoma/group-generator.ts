// src/lib/onoma/group-generator.ts
// Onoma Lab — Group & Organization Name Generator

import { COVERT_ORG_DATA, MILITARY_UNIT_DATA, MYSTIC_ORDER_DATA } from "./data/group-data";
import { MarkovChain } from "./markov-chain";
import { generateFantasySyllableName } from "./name-generator";
import { type GenerateOptions } from "./types";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickAndRemove<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  const idx = Math.floor(Math.random() * arr.length);
  const val = arr[idx];
  arr.splice(idx, 1);
  return val;
}

/**
 * Generates a name for a mystic or academic/religious order.
 */
export function generateMysticOrderName(chain?: MarkovChain, options?: GenerateOptions): string {
  const d10 = Math.floor(Math.random() * 10) + 1;
  let pattern = "";

  if (d10 < 2) {
    pattern = MYSTIC_ORDER_DATA.patterns[0]; // "<group> of the <entity>"
  } else if (d10 < 9) {
    pattern = MYSTIC_ORDER_DATA.patterns[1]; // "<group> of the <description> <entity>"
  } else if (d10 < 10) {
    pattern = MYSTIC_ORDER_DATA.patterns[2]; // "<description> <group> of the <description> <entity>"
  } else {
    pattern = MYSTIC_ORDER_DATA.patterns[3]; // "<description> <group>"
  }

  const groupOptions =
    Math.random() < 0.5 ? MYSTIC_ORDER_DATA.group.cliques : MYSTIC_ORDER_DATA.group.people;

  const descOptions = MYSTIC_ORDER_DATA.description.quality.concat(
    MYSTIC_ORDER_DATA.description.colour
  );

  const mapOptions: Record<string, string[]> = {
    group: groupOptions,
    entity: MYSTIC_ORDER_DATA.entities,
    description: descOptions,
  };

  return pattern.replace(/<([\w\W]*?)>/g, (match) => {
    const key = match.replace(/<|>/g, "");
    const values = mapOptions[key];
    if (!values) return match;
    return MarkovChain.capitalize(pickRandom(values));
  });
}

/**
 * Generates a name for a military unit or formation.
 */
export function generateMilitaryUnitName(chain?: MarkovChain, options?: GenerateOptions): string {
  const d10 = Math.floor(Math.random() * 10) + 1;
  let pattern = "";

  if (d10 < 2) {
    pattern = MILITARY_UNIT_DATA.patterns[0]; // "<commander>'s <group>"
  } else if (d10 < 8) {
    pattern = MILITARY_UNIT_DATA.patterns[1]; // "<description> <group>"
  } else if (d10 < 10) {
    pattern = MILITARY_UNIT_DATA.patterns[2]; // "<description> <description> <group>"
  } else {
    pattern = MILITARY_UNIT_DATA.patterns[3]; // "<group> of the <place>"
  }

  // Choose a random group type from the 6 military unit group categories
  const randomGroupSetIdx = Math.floor(Math.random() * 6);
  const groupList = [...MILITARY_UNIT_DATA.groups[randomGroupSetIdx]];

  const descList = MILITARY_UNIT_DATA.description.colour.concat(
    MILITARY_UNIT_DATA.description.other
  );
  const placeList = MILITARY_UNIT_DATA.places.seas.concat(MILITARY_UNIT_DATA.places.lands);

  const commanderName = chain?.generate(options) || generateFantasySyllableName();

  const mapOptions: Record<string, string[]> = {
    commander: [commanderName],
    group: groupList,
    description: [...descList],
    place: [...placeList],
  };

  return pattern.replace(/<([\w\W]*?)>/g, (match) => {
    const key = match.replace(/<|>/g, "");
    const list = mapOptions[key];
    if (!list || list.length === 0) return match;

    // Use pickAndRemove to prevent duplicates (e.g. "Red Red Blade" -> "Red Blood Blade")
    const val = pickAndRemove(list);
    return val ? MarkovChain.capitalize(val) : match;
  });
}

/**
 * Generates a name for a covert or criminal organization (thieves/assassins).
 */
export function generateCovertOrgName(chain?: MarkovChain, options?: GenerateOptions): string {
  const d30 = Math.floor(Math.random() * 30) + 1;

  const data = COVERT_ORG_DATA;

  if (d30 < 6) {
    // Role of Goal (e.g. "Restorers of Parity")
    const role = MarkovChain.capitalize(pickRandom(data.roles));
    const goal = MarkovChain.capitalize(pickRandom(data.goals));
    return `${role} of ${goal}`;
  } else if (d30 < 11) {
    // Adjective Action Title (e.g. "Ultimate Redress Syndicate")
    const adj = MarkovChain.capitalize(pickRandom(data.adjectives));
    const action = MarkovChain.capitalize(pickRandom(data.actions));
    const title = MarkovChain.capitalize(pickRandom(data.titles));
    return `${adj} ${action} ${title}`;
  } else {
    // Description + Group item (e.g. "Grey Scorpion")
    const desc = MarkovChain.capitalize(pickRandom(data.descriptions));
    const randomGroupSet = pickRandom(data.groups);
    const item = MarkovChain.capitalize(pickRandom(randomGroupSet));
    return `${desc} ${item}`;
  }
}

/**
 * Generates a name for a commercial business or company.
 */
export function generateBusinessCompanyName(
  chain?: MarkovChain,
  options?: GenerateOptions
): string {
  const d3 = Math.floor(Math.random() * 3);
  const founder = chain?.generate(options) || generateFantasySyllableName();

  const adjectives = [
    "global",
    "united",
    "central",
    "imperial",
    "national",
    "cooperative",
    "union",
    "standard",
    "sovereign",
    "continental",
    "apex",
    "vertex",
    "alpha",
    "omega",
    "first",
    "iron",
    "golden",
    "silver",
    "bronze",
    "eastern",
    "western",
    "northern",
    "southern",
  ];
  const industries = [
    "trade",
    "shipping",
    "logistics",
    "industries",
    "holdings",
    "mining",
    "steel",
    "textiles",
    "railway",
    "agricultural",
    "manufacturing",
    "chemicals",
    "trust",
    "ventures",
    "banking",
    "finance",
    "energy",
    "petroleum",
  ];
  const suffixes = [
    "Syndicate",
    "Company",
    "Corporation",
    "Group",
    "Consortium",
    "Enterprise",
    "Firm",
    "Guild",
  ];

  const adj = MarkovChain.capitalize(pickRandom(adjectives));
  const ind = MarkovChain.capitalize(pickRandom(industries));
  const suf = pickRandom(suffixes);

  if (d3 === 0) {
    return `${adj} ${ind} ${suf}`;
  } else if (d3 === 1) {
    return `${founder}'s ${ind} ${suf}`;
  } else {
    return `${founder} ${ind}`;
  }
}

/**
 * Generates a name for an academic institution / university.
 */
export function generateAcademicInstitutionName(
  chain?: MarkovChain,
  options?: GenerateOptions
): string {
  const d3 = Math.floor(Math.random() * 3);
  const name = chain?.generate(options) || generateFantasySyllableName();

  const types = [
    "University",
    "Academy",
    "College",
    "Institute",
    "Lyceum",
    "Conservatory",
    "School",
  ];
  const fields = [
    "Sciences",
    "Arts",
    "Medicine",
    "Philosophy",
    "Engineering",
    "Astronomy",
    "Lore",
    "Arcana",
    "Linguistics",
    "Diplomacy",
    "Administration",
  ];

  const type = pickRandom(types);
  const field = pickRandom(fields);

  if (d3 === 0) {
    return `${name} ${type} of ${field}`;
  } else if (d3 === 1) {
    return `${type} of ${field} of ${name}`;
  } else {
    return `${name} ${type}`;
  }
}

/**
 * Generates a name for a mercenary company or combat band.
 */
export function generateMercenaryBandName(chain?: MarkovChain, options?: GenerateOptions): string {
  const d3 = Math.floor(Math.random() * 3);
  const commander = chain?.generate(options) || generateFantasySyllableName();

  const groups = [
    "Mercenaries",
    "Company",
    "Free Company",
    "Legion",
    "Band",
    "Raiders",
    "Soldiers",
    "Blades",
    "Swords",
    "Hounds",
    "Wolves",
  ];
  const descriptions = [
    "Crimson",
    "Golden",
    "Black",
    "Silver",
    "Iron",
    "Red",
    "Grey",
    "Blood",
    "Death",
    "Doom",
    "Dark",
    "Free",
    "Wild",
  ];
  const entities = [
    "Coast",
    "North",
    "South",
    "East",
    "West",
    "Valley",
    "Ridge",
    "Sea",
    "Shield",
    "Skull",
  ];

  const group = pickRandom(groups);
  const desc = pickRandom(descriptions);
  const ent = pickRandom(entities);

  if (d3 === 0) {
    return `${commander}'s ${group}`;
  } else if (d3 === 1) {
    return `${desc} ${group}`;
  } else {
    return `${group} of the ${desc} ${ent}`;
  }
}

// src/lib/onoma/group-generator.ts
// Onoma Lab — Group & Organization Name Generator

import { COVERT_ORG_DATA, MILITARY_UNIT_DATA, MYSTIC_ORDER_DATA } from "./data/group-data";
import { MarkovChain } from "./markov-chain";
import { generateFantasySyllableName } from "./name-generator";
import { type GenerateOptions } from "./types";
import { pickRandom, resolvePatternTemplate } from "./template-resolver";

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

  return resolvePatternTemplate(pattern, mapOptions, { capitalize: true });
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
    description: descList,
    place: placeList,
  };

  return resolvePatternTemplate(pattern, mapOptions, { consumeElements: true, capitalize: true });
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

// --- Civic / modern organizations (geopolitical worldbuilding) ---

/** Political party, front, or movement. */
export function generatePoliticalPartyName(chain?: MarkovChain, options?: GenerateOptions): string {
  const adjectives = [
    "National",
    "People's",
    "United",
    "Democratic",
    "Progressive",
    "Liberal",
    "Social",
    "Free",
    "Patriotic",
    "Popular",
    "Republican",
    "Federal",
    "Sovereign",
    "Unity",
    "Reform",
    "Workers'",
    "Civic",
    "New",
  ];
  const ideologies = [
    "Conservative",
    "Labour",
    "Liberal",
    "Socialist",
    "Nationalist",
    "Green",
    "Centrist",
    "Communist",
    "Agrarian",
    "Democratic",
    "Reformist",
    "Federalist",
  ];
  const types = [
    "Party",
    "Front",
    "Movement",
    "League",
    "Union",
    "Alliance",
    "Coalition",
    "Congress",
    "Bloc",
  ];
  const adj = pickRandom(adjectives);
  const ide = pickRandom(ideologies);
  const type = pickRandom(types);
  const d3 = Math.floor(Math.random() * 3);
  if (d3 === 0) return `${adj} ${type}`;
  if (d3 === 1) return `${adj} ${ide} ${type}`;
  return `${ide} ${type}`;
}

/** Government ministry, department, or agency. */
export function generateGovernmentAgencyName(
  chain?: MarkovChain,
  options?: GenerateOptions
): string {
  const fields = [
    "Defense",
    "Finance",
    "Foreign Affairs",
    "the Interior",
    "Justice",
    "Health",
    "Education",
    "Agriculture",
    "Energy",
    "Trade",
    "Transport",
    "Labour",
    "Culture",
    "Intelligence",
    "Public Works",
    "the Treasury",
    "Industry",
  ];
  const prefixes = [
    "Ministry of",
    "Department of",
    "Bureau of",
    "Office of",
    "Council for",
    "Commission on",
  ];
  const field = pickRandom(fields);
  const d3 = Math.floor(Math.random() * 3);
  if (d3 < 2) return `${pickRandom(prefixes)} ${field}`;
  const bare = field.replace(/^the /, "");
  return pickRandom([`National ${bare} Agency`, `${bare} Authority`, `${bare} Administration`]);
}

/** Newspaper, broadcaster, or news agency. */
export function generateMediaOutletName(chain?: MarkovChain, options?: GenerateOptions): string {
  const place = MarkovChain.capitalize(chain?.generate(options) || generateFantasySyllableName());
  const papers = [
    "Times",
    "Herald",
    "Gazette",
    "Post",
    "Chronicle",
    "Tribune",
    "Observer",
    "Journal",
    "Standard",
    "Sentinel",
    "Courier",
    "Ledger",
    "Dispatch",
    "Star",
    "Mirror",
  ];
  const broadcast = [
    "Broadcasting Corporation",
    "News Network",
    "News Agency",
    "Media Group",
    "Press",
    "Broadcasting Service",
  ];
  const d3 = Math.floor(Math.random() * 3);
  if (d3 === 0) return `The ${place} ${pickRandom(papers)}`;
  if (d3 === 1) return `${place} ${pickRandom(broadcast)}`;
  return `The ${pickRandom(papers)}`;
}

/** NGO, foundation, or charitable society. */
export function generateNgoName(chain?: MarkovChain, options?: GenerateOptions): string {
  const causes = [
    "Children's",
    "Wildlife",
    "Humanitarian",
    "Heritage",
    "Peace",
    "Human Rights",
    "Environmental",
    "Relief",
    "Health",
    "Education",
    "Development",
    "Refugee",
    "Hunger",
    "Literacy",
  ];
  const types = [
    "Foundation",
    "Trust",
    "Society",
    "Council",
    "Initiative",
    "Alliance",
    "Fund",
    "Institute",
    "Federation",
    "Network",
  ];
  const founder = MarkovChain.capitalize(chain?.generate(options) || generateFantasySyllableName());
  const cause = pickRandom(causes);
  const type = pickRandom(types);
  const d3 = Math.floor(Math.random() * 3);
  if (d3 === 0) return `${cause} ${type}`;
  if (d3 === 1) return `${founder} ${type}`;
  return `${cause} ${type} of ${founder}`;
}

/** Religious order, church, or congregation. */
export function generateReligiousOrderName(chain?: MarkovChain, options?: GenerateOptions): string {
  const saint = MarkovChain.capitalize(chain?.generate(options) || generateFantasySyllableName());
  const virtues = [
    "the Sacred Heart",
    "the Holy Light",
    "Divine Mercy",
    "the Eternal Flame",
    "the Blessed Dawn",
    "the Sacred Vow",
    "the Holy Covenant",
    "the Risen Sun",
    "the Silent Saints",
  ];
  const orders = [
    "Order",
    "Brotherhood",
    "Sisterhood",
    "Congregation",
    "Fellowship",
    "Communion",
    "Synod",
    "Assembly",
  ];
  const churches = ["Church", "Temple", "Cathedral", "Chapter", "Mission"];
  const d3 = Math.floor(Math.random() * 3);
  if (d3 === 0) return `${pickRandom(orders)} of ${pickRandom(virtues)}`;
  if (d3 === 1) return `Church of Saint ${saint}`;
  return `${pickRandom(churches)} of ${pickRandom(virtues)}`;
}

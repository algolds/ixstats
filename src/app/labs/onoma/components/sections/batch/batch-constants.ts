// src/app/labs/onoma/components/sections/batch/batch-constants.ts
// Category, profile, and subtype taxonomies for the Onoma Batch Generation Workbench

export interface BatchNameResult {
  name: string;
  ipa: string;
  syllables: number;
  perplexity: number;
  length: number;
}

export const BATCH_CATEGORIES = [
  { value: "country", label: "Nations & Realms" },
  { value: "city", label: "Cities & Towns" },
  { value: "province", label: "Provinces & States" },
  { value: "geography", label: "Landmarks & Features" },
  { value: "person", label: "Characters & Rulers" },
  { value: "dynasty", label: "Dynasties & Families" },
  { value: "military", label: "Military & Formations" },
  { value: "organization", label: "Guilds & Orders" },
  { value: "culture", label: "Ethnic Groups & Tribes" },
  { value: "ship", label: "Vessel & Ship Names" },
];

export const BATCH_PROFILES = [
  { value: "any", label: "Any / Combined Profile" },
  { value: "latin", label: "Latin / Roman" },
  { value: "germanic", label: "Germanic / Norse" },
  { value: "celtic", label: "Celtic / Gaelic" },
  { value: "slavic", label: "Slavic / Eastern European" },
  { value: "arabic", label: "Arabic / Near Eastern" },
  { value: "east-asian", label: "East Asian" },
  { value: "austronesian", label: "Austronesian" },
  { value: "persian", label: "Persian" },
  { value: "turkic", label: "Turkic" },
  { value: "african", label: "African" },
  { value: "indic", label: "Indic" },
  { value: "uralic", label: "Uralic" },
  { value: "constructed", label: "Constructed Conlang" },
];

export function getBatchSubTypes(category: string) {
  if (category === "city") {
    return [
      { value: "generic", label: "City Name (Default)" },
      { value: "settlement-colony", label: "Settlement / Colony" },
    ];
  }
  if (category === "geography") {
    return [
      { value: "generic", label: "Landmark Name (Default)" },
      { value: "natural-landmark", label: "Natural Landmark" },
      { value: "architecture", label: "Architecture & Buildings" },
    ];
  }
  if (category === "person") {
    return [
      { value: "generic", label: "Person Name (Default)" },
      { value: "goblin", label: "Goblin" },
      { value: "orc", label: "Orc" },
      { value: "ogre", label: "Ogre" },
      { value: "primitive", label: "Primitive Tribal" },
      { value: "dwarf", label: "Dwarf" },
      { value: "halfling", label: "Halfling" },
      { value: "gnome", label: "Gnome" },
      { value: "elf", label: "Elf" },
      { value: "elf-alt", label: "Elf Alternate" },
      { value: "faery", label: "Faery" },
      { value: "faery-alt", label: "Faery Alternate" },
      { value: "dark-elf", label: "Dark Elf" },
      { value: "dark-elf-alt", label: "Dark Elf Alternate" },
      { value: "half-demon", label: "Half-Demon" },
      { value: "dragon", label: "Dragon" },
      { value: "demon", label: "Demon" },
      { value: "angel", label: "Angel" },
    ];
  }
  if (category === "organization") {
    return [
      { value: "generic", label: "Organization (Default)" },
      { value: "mystic-order", label: "Mystic Order" },
      { value: "military-unit", label: "Military Formation" },
      { value: "covert-org", label: "Covert Organization" },
      { value: "tavern", label: "Tavern & Inn" },
      { value: "business-company", label: "Guild / Company" },
      { value: "academic-institution", label: "Academy" },
      { value: "political-party", label: "Faction / Caucus" },
      { value: "government-agency", label: "Directorate / Ministry" },
      { value: "media-outlet", label: "Gazette / Broadcaster" },
      { value: "ngo-foundation", label: "Charitable Foundation" },
      { value: "religious-order", label: "Priesthood" },
    ];
  }
  if (category === "military") {
    return [
      { value: "generic", label: "Military (Default)" },
      { value: "military-unit", label: "Army Regiment" },
      { value: "mercenary-band", label: "Mercenary Company" },
    ];
  }
  if (category === "dynasty") {
    return [
      { value: "generic", label: "Dynasty (Default)" },
      { value: "fantasy-syllable", label: "Fantasy Syllable Name" },
      { value: "noble-surname", label: "Noble Surname" },
    ];
  }
  return [];
}

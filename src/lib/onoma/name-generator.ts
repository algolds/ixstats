import { FANTASY_SYLLABLES } from "./data/fantasy-names-data";
import { MarkovChain } from "./markov-chain";
import { type GenerateOptions, type NameCategory, type Gender } from "./types";
import {
  generateGoblinName,
  generateOrcName,
  generateOgreName,
  generatePrimitiveName,
  generateDwarfName,
  generateHalflingName,
  generateGnomeName,
  generateElfName,
  generateFaeryName,
  generateDarkElfName,
  generateHalfDemonName,
  generateDragonName,
  generateDemonName,
  generateAngelName,
} from "./species-generator";
import {
  generateMysticOrderName,
  generateMilitaryUnitName,
  generateCovertOrgName,
  generateBusinessCompanyName,
  generateAcademicInstitutionName,
  generatePoliticalPartyName,
  generateGovernmentAgencyName,
  generateMediaOutletName,
  generateNgoName,
  generateReligiousOrderName,
  generateMercenaryBandName,
} from "./group-generator";
import { generateTavernName } from "./tavern-generator";

/**
 * Generates a name by concatenating syllables from the original Onoma database
 * using the original weighted d20 probability distribution.
 */
export function generateFantasySyllableName(): string {
  const d20 = Math.floor(Math.random() * 20) + 1;
  let name = "";

  const ones = FANTASY_SYLLABLES[0];
  const twos = FANTASY_SYLLABLES[1];
  const threes = FANTASY_SYLLABLES[2];
  const multis = FANTASY_SYLLABLES[3];

  const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  if (d20 < 3) {
    // 10% — One syllable
    name = pickRandom(ones);
  } else if (d20 < 12) {
    // 45% — Two syllables
    name = pickRandom(twos);
  } else if (d20 < 17) {
    // 25% — Three syllables
    name = pickRandom(threes);
  } else if (d20 === 17) {
    // 5% — Multi syllables
    name = pickRandom(multis);
  } else if (d20 === 18) {
    // 5% — One syllable + Two syllables
    name = `${pickRandom(ones)} ${pickRandom(twos)}`;
  } else if (d20 === 19) {
    // 5% — Two syllables + One syllable
    name = `${pickRandom(twos)} ${pickRandom(ones)}`;
  } else {
    // 5% — Two random syllable lengths combined
    const firstList = FANTASY_SYLLABLES[Math.floor(Math.random() * FANTASY_SYLLABLES.length)];
    const secondList = FANTASY_SYLLABLES[Math.floor(Math.random() * FANTASY_SYLLABLES.length)];
    name = `${pickRandom(firstList)} ${pickRandom(secondList)}`;
  }

  // Capitalize each part of the name
  return name
    .split(" ")
    .map((word) => MarkovChain.capitalize(word))
    .join(" ");
}

/**
 * Generates a name using a Markov chain trained on the provided names list.
 */
export function generateMarkovName(
  trainingNames: string[],
  options: GenerateOptions = {},
  order = 2
): string | null {
  if (!trainingNames || trainingNames.length === 0) {
    return null;
  }
  const chain = new MarkovChain(order);
  chain.addWords(trainingNames);
  return chain.generate(options);
}

/**
 * Generates a noble/clan surname formatted according to the rules of the selected culture.
 */
export function generateNobleSurname(
  culture: string,
  chain?: MarkovChain,
  options?: GenerateOptions
): string {
  const baseName = chain?.generate(options) || generateFantasySyllableName();
  const name = MarkovChain.capitalize(baseName);
  const cult = culture.toLowerCase();

  if (cult === "latin") {
    return Math.random() < 0.5 ? `de ${name}` : `di ${name}`;
  } else if (cult === "germanic") {
    return Math.random() < 0.5 ? `von ${name}` : `zu ${name}`;
  } else if (cult === "celtic") {
    return Math.random() < 0.5 ? `O'${name}` : `Mac${name}`;
  } else if (cult === "slavic") {
    // Trim ending vowel if present to make suffix sound more natural
    const base = name.replace(/[aeiou]$/i, "");
    return Math.random() < 0.5 ? `${base}ovich` : `${base}ic`;
  } else if (cult === "arabic") {
    return Math.random() < 0.5 ? `Al-${name}` : `ibn ${name}`;
  } else {
    return Math.random() < 0.5 ? `de ${name}` : name;
  }
}

export interface PresetGenerationContext {
  category: NameCategory;
  subType?: string;
  gender?: Gender;
  culture?: string;
  characterChain: MarkovChain;
  syllableChain?: MarkovChain;
  options?: GenerateOptions;
}

export function generatePresetName(ctx: PresetGenerationContext): string | null {
  const {
    category,
    subType = "generic",
    gender = "neutral",
    culture = "any",
    characterChain,
    syllableChain,
    options,
  } = ctx;

  if (subType === "generic") return null;

  if (category === "person") {
    if (subType === "goblin") return generateGoblinName();
    if (subType === "orc") return generateOrcName();
    if (subType === "ogre") return generateOgreName();
    if (subType === "primitive") return generatePrimitiveName(gender);
    if (subType === "dwarf") return generateDwarfName(gender);
    if (subType === "halfling") return generateHalflingName(gender);
    if (subType === "gnome") return generateGnomeName(gender);
    if (subType === "elf") return generateElfName(gender);
    if (subType === "elf-alt") return generateElfName(gender, true);
    if (subType === "faery") return generateFaeryName(gender);
    if (subType === "faery-alt") return generateFaeryName(gender, true);
    if (subType === "dark-elf") return generateDarkElfName(gender);
    if (subType === "dark-elf-alt") return generateDarkElfName(gender, true);
    if (subType === "half-demon") return generateHalfDemonName(gender);
    if (subType === "dragon") return generateDragonName(gender);
    if (subType === "demon") return generateDemonName();
    if (subType === "angel") return generateAngelName(gender);
  }

  if (category === "organization") {
    if (subType === "mystic-order") return generateMysticOrderName(characterChain, options);
    if (subType === "military-unit") return generateMilitaryUnitName(characterChain, options);
    if (subType === "covert-org") return generateCovertOrgName(characterChain, options);
    if (subType === "tavern") return generateTavernName(options);
    if (subType === "business-company")
      return generateBusinessCompanyName(characterChain, options);
    if (subType === "academic-institution")
      return generateAcademicInstitutionName(characterChain, options);
    if (subType === "political-party") return generatePoliticalPartyName(characterChain, options);
    if (subType === "government-agency")
      return generateGovernmentAgencyName(characterChain, options);
    if (subType === "media-outlet") return generateMediaOutletName(characterChain, options);
    if (subType === "ngo-foundation") return generateNgoName(characterChain, options);
    if (subType === "religious-order") return generateReligiousOrderName(characterChain, options);
  }

  if (category === "military") {
    if (subType === "military-unit") return generateMilitaryUnitName(characterChain, options);
    if (subType === "mercenary-band") return generateMercenaryBandName(characterChain, options);
  }

  if (category === "dynasty") {
    if (subType === "fantasy-syllable") return generateFantasySyllableName();
    if (subType === "noble-surname")
      return generateNobleSurname(culture, characterChain, options);
  }

  if (category === "city" && subType === "settlement-colony") {
    const base =
      characterChain.generate(options) ||
      syllableChain?.generate(options) ||
      generateFantasySyllableName();
    const d3 = Math.floor(Math.random() * 3);
    const capitalized = MarkovChain.capitalize(base);
    if (d3 === 0) return `New ${capitalized}`;
    if (d3 === 1) return `Port ${capitalized}`;
    return `${capitalized} Colony`;
  }

  if (category === "geography" && subType === "natural-landmark") {
    const base =
      characterChain.generate(options) ||
      syllableChain?.generate(options) ||
      generateFantasySyllableName();
    const suffixes = [
      "River",
      "Valley",
      "Mount",
      "Bay",
      "Lake",
      "Ridge",
      "Coast",
      "Canyon",
      "Forest",
      "Peak",
      "Hills",
    ];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${MarkovChain.capitalize(base)} ${suffix}`;
  }

  return null;
}

export interface ExportNameItem {
  name: string;
  ipa: string;
  syllables: number;
  perplexity: number;
  length: number;
}

function escapeCSVCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToCSV(names: ExportNameItem[], filename = "onoma-batch.csv"): void {
  const headers = ["Name", "IPA Pronunciation", "SyllablesCount", "NaturalnessScore", "CharLength"];
  const rows = names.map((item) => [
    item.name,
    item.ipa,
    item.syllables,
    item.perplexity,
    item.length,
  ]);

  const csvContent = [headers, ...rows].map((row) => row.map(escapeCSVCell).join(",")).join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerBlobDownload(blob, filename);
}

export function exportToJSON(
  names: ExportNameItem[],
  metadata: Record<string, any>,
  filename = "onoma-batch.json"
): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    generator: "Onoma Lab Batch Generator",
    metadata,
    count: names.length,
    names: names.map((item) => ({
      name: item.name,
      ipa: item.ipa,
      syllables: item.syllables,
      naturalness: item.perplexity,
      length: item.length,
    })),
  };

  const jsonContent = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
  triggerBlobDownload(blob, filename);
}

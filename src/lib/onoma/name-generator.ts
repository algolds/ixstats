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
import { pickRandom } from "./template-resolver";

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

interface PresetGenerationContext {
  category: NameCategory;
  subType?: string;
  gender?: Gender;
  culture?: string;
  characterChain: MarkovChain;
  syllableChain?: MarkovChain;
  options?: GenerateOptions;
}

type PresetGenerator = (
  ctx: Required<Pick<PresetGenerationContext, "gender" | "culture">> & PresetGenerationContext
) => string | null;

/** Wraps a generator that takes the character chain and options. */
const withChain =
  (generate: (chain: MarkovChain, options?: GenerateOptions) => string): PresetGenerator =>
  ({ characterChain, options }) =>
    generate(characterChain, options);

/** Wraps a generator that takes the character's gender (and an optional alternate flag). */
const withGender =
  (generate: (gender: Gender, alt?: boolean) => string, alt?: boolean): PresetGenerator =>
  ({ gender }) =>
    generate(gender, alt);

const TAVERN_ADJECTIVES = [
  "Golden",
  "Prancing",
  "Rusty",
  "Drunken",
  "Green",
  "Silver",
  "Blind",
  "Laughing",
  "Broken",
  "Wandering",
];
const TAVERN_NOUNS = [
  "Pony",
  "Dragon",
  "Boar",
  "Anchor",
  "Goblet",
  "Shield",
  "Fox",
  "Hound",
  "Barrel",
  "Raven",
  "Flagon",
];
const LANDMARK_SUFFIXES = [
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

/** A chain-made base name, falling back to the syllable chain and then fantasy syllables. */
const chainedBase = ({ characterChain, syllableChain, options }: PresetGenerationContext) =>
  MarkovChain.capitalize(
    characterChain.generate(options) ||
      syllableChain?.generate(options) ||
      generateFantasySyllableName()
  );

const PRESET_GENERATORS: Partial<Record<NameCategory, Record<string, PresetGenerator>>> = {
  person: {
    goblin: () => generateGoblinName(),
    orc: () => generateOrcName(),
    ogre: () => generateOgreName(),
    primitive: withGender(generatePrimitiveName),
    dwarf: withGender(generateDwarfName),
    halfling: withGender(generateHalflingName),
    gnome: withGender(generateGnomeName),
    elf: withGender(generateElfName),
    "elf-alt": withGender(generateElfName, true),
    faery: withGender(generateFaeryName),
    "faery-alt": withGender(generateFaeryName, true),
    "dark-elf": withGender(generateDarkElfName),
    "dark-elf-alt": withGender(generateDarkElfName, true),
    "half-demon": withGender(generateHalfDemonName),
    dragon: withGender(generateDragonName),
    demon: () => generateDemonName(),
    angel: withGender(generateAngelName),
  },
  organization: {
    "mystic-order": withChain(generateMysticOrderName),
    "military-unit": withChain(generateMilitaryUnitName),
    "covert-org": withChain(generateCovertOrgName),
    "business-company": withChain(generateBusinessCompanyName),
    "academic-institution": withChain(generateAcademicInstitutionName),
    "political-party": withChain(generatePoliticalPartyName),
    "government-agency": withChain(generateGovernmentAgencyName),
    "media-outlet": withChain(generateMediaOutletName),
    "ngo-foundation": withChain(generateNgoName),
    "religious-order": withChain(generateReligiousOrderName),
    tavern: ({ characterChain, options }) => {
      const adj = pickRandom(TAVERN_ADJECTIVES);
      const noun = pickRandom(TAVERN_NOUNS);
      const base = characterChain.generate(options);
      if (base && Math.random() < 0.3) return `${MarkovChain.capitalize(base)}'s ${noun}`;
      return `The ${adj} ${noun}`;
    },
  },
  military: {
    "military-unit": withChain(generateMilitaryUnitName),
    "mercenary-band": withChain(generateMercenaryBandName),
  },
  dynasty: {
    "fantasy-syllable": () => generateFantasySyllableName(),
    "noble-surname": ({ culture, characterChain, options }) =>
      generateNobleSurname(culture, characterChain, options),
  },
  city: {
    "settlement-colony": (ctx) => {
      const base = chainedBase(ctx);
      const d3 = Math.floor(Math.random() * 3);
      if (d3 === 0) return `New ${base}`;
      if (d3 === 1) return `Port ${base}`;
      return `${base} Colony`;
    },
  },
  geography: {
    "natural-landmark": (ctx) => {
      const base = chainedBase(ctx);
      return `${base} ${LANDMARK_SUFFIXES[Math.floor(Math.random() * LANDMARK_SUFFIXES.length)]}`;
    },
  },
};

export function generatePresetName(ctx: PresetGenerationContext): string | null {
  const { category, subType = "generic", gender = "neutral", culture = "any" } = ctx;
  if (subType === "generic") return null;
  return PRESET_GENERATORS[category]?.[subType]?.({ ...ctx, gender, culture }) ?? null;
}

interface ExportNameItem {
  name: string;
  ipa: string;
  syllables: number;
  perplexity: number | null;
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
  if (
    typeof window === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
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

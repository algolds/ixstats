// scripts/extract-onoma-data.ts
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const SCRATCH_DIR = '/home/jxsig/.gemini/antigravity-ide/scratch/onoma';
const DEST_DIR = '/home/jxsig/projects/ixstats/src/lib/onoma/data';

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

// 1. Extract NameGenerator names array
console.log('Extracting name generator syllables...');
let nameGenCode = fs.readFileSync(path.join(SCRATCH_DIR, 'js', 'services', 'nameGenerator.js'), 'utf8');
const nameGenReturnIdx = nameGenCode.indexOf('return {');
if (nameGenReturnIdx === -1) {
  throw new Error('Could not find return statement in nameGenerator.js');
}
// Truncate at return and replace with custom return
nameGenCode = nameGenCode.substring(0, nameGenReturnIdx) + 'return { names: names }; \n}]);';

let extractedNames: any = null;
const mockApp1 = {
  factory: (name: string, fnArray: any[]) => {
    const fn = fnArray[fnArray.length - 1];
    extractedNames = fn().names;
  }
};

const nameGenContext = { app: mockApp1, console };
vm.createContext(nameGenContext);
vm.runInContext(nameGenCode, nameGenContext);

if (extractedNames && Array.isArray(extractedNames)) {
  const fileContent = `// src/lib/onoma/data/fantasy-names-data.ts
// Generated from original Onoma nameGenerator.js syllable lists.

export const FANTASY_SYLLABLES: string[][] = ${JSON.stringify(extractedNames, null, 2)};
`;
  fs.writeFileSync(path.join(DEST_DIR, 'fantasy-names-data.ts'), fileContent, 'utf8');
  console.log(`Saved fantasy-names-data.ts with ${extractedNames.length} syllable groups`);
} else {
  console.error('Failed to extract names array from nameGenerator.js');
}

// 2. Extract SpeciesGenerator names
console.log('Extracting species syllables...');
let speciesGenCode = fs.readFileSync(path.join(SCRATCH_DIR, 'js', 'services', 'fantasticSpeciesGenerator.js'), 'utf8');
const speciesGenReturnIdx = speciesGenCode.indexOf('return {');
if (speciesGenReturnIdx === -1) {
  throw new Error('Could not find return statement in fantasticSpeciesGenerator.js');
}
speciesGenCode = speciesGenCode.substring(0, speciesGenReturnIdx) + 'return { names: names }; \n}]);';

let extractedSpecies: any = null;
const mockApp2 = {
  factory: (name: string, fnArray: any[]) => {
    const fn = fnArray[fnArray.length - 1];
    extractedSpecies = fn().names;
  }
};

const speciesGenContext = { app: mockApp2, String: { prototype: {} }, console };
vm.createContext(speciesGenContext);
vm.runInContext(speciesGenCode, speciesGenContext);

if (extractedSpecies) {
  // Let's standardise "syllabes" -> "syllables" in our TS data structure
  const formatted: any = {};
  for (const [key, val] of Object.entries(extractedSpecies)) {
    const obj: any = val;
    formatted[key] = {};
    for (const [propName, propVal] of Object.entries(obj)) {
      if (propName === 'syllabes') {
        formatted[key]['syllables'] = propVal;
      } else {
        formatted[key][propName] = propVal;
      }
    }
  }

  const fileContent = `// src/lib/onoma/data/species-data.ts
// Generated from original Onoma fantasticSpeciesGenerator.js database.

export interface SpeciesSyllables {
  vileAndCrude: {
    small: string[];
    medium: string[];
    large: string[];
  };
  primitive: {
    names: string[];
    suffixes: string[];
  };
  doughty: {
    syllables: string[];
    maleSuffixes: string[];
    femaleSuffixes: string[];
  };
  homely: {
    syllables: string[];
    maleSuffixes: string[];
    femaleSuffixes: string[];
  };
  familyName: {
    english: string[];
    scottish: string[];
  };
  fairAndNoble: {
    elfprefixes: string[];
    alternativeElfPrefixes: string[];
    middle: string[];
    maleSuffixes: string[];
    femaleSuffixes: string[];
  };
  faerykind: {
    prefixes: string[];
    maleSuffixes: string[];
    femaleSuffixes: string[];
  };
  alternativeFaerykind: {
    prefixes: string[];
    maleSuffixes: string[];
    femaleSuffixes: string[];
  };
  elegantEvil: {
    prefixesDarkElves: string[];
    prefixesAlternateDarkElves: string[];
    middle: string[];
    maleSuffixes: string[];
    femaleSuffixes: string[];
  };
  malevolent: {
    prefixes: string[];
    maleSuffixes: string[];
    femaleSuffixes: string[];
  };
  draconic: {
    prefixes: string[];
    suffixes: string[];
  };
  infernal: {
    softs: string[];
    dulls: string[];
    sharps: string[];
  };
  empyreal: {
    prefixes: string[];
    maleSuffixes: string[];
    femaleSuffixes: string[];
    titles: string[];
  };
}

export const SPECIES_SYLLABLES: SpeciesSyllables = ${JSON.stringify(formatted, null, 2)};
`;
  fs.writeFileSync(path.join(DEST_DIR, 'species-data.ts'), fileContent, 'utf8');
  console.log('Saved species-data.ts');
} else {
  console.error('Failed to extract species syllables');
}

// 3. Extract GroupGenerator names
console.log('Extracting group/organization templates...');
let groupGenCode = fs.readFileSync(path.join(SCRATCH_DIR, 'js', 'services', 'groupNamesGenerator.js'), 'utf8');
const groupGenReturnIdx = groupGenCode.indexOf('return {');
if (groupGenReturnIdx === -1) {
  throw new Error('Could not find return statement in groupNamesGenerator.js');
}
groupGenCode = groupGenCode.substring(0, groupGenReturnIdx) + 'return { mysticOrder: mysticOrder, militaryUnit: militaryUnit, thievesAndAssassins: thievesAndAssassins }; \n}]);';

let extractedGroups: any = null;
const mockApp3 = {
  factory: (name: string, fnArray: any[]) => {
    const fn = fnArray[fnArray.length - 1];
    extractedGroups = fn();
  }
};

const groupGenContext = { app: mockApp3, String: { prototype: {} }, console };
vm.createContext(groupGenContext);
vm.runInContext(groupGenCode, groupGenContext);

if (extractedGroups) {
  const fileContent = `// src/lib/onoma/data/group-data.ts
// Generated from original Onoma groupNamesGenerator.js templates.

export const MYSTIC_ORDER_DATA = ${JSON.stringify(extractedGroups.mysticOrder, null, 2)};
export const MILITARY_UNIT_DATA = ${JSON.stringify(extractedGroups.militaryUnit, null, 2)};
export const COVERT_ORG_DATA = ${JSON.stringify(extractedGroups.thievesAndAssassins, null, 2)};
`;
  fs.writeFileSync(path.join(DEST_DIR, 'group-data.ts'), fileContent, 'utf8');
  console.log('Saved group-data.ts');
} else {
  console.error('Failed to extract group templates');
}

// 4. Extract TavernGenerator defaultValues
console.log('Extracting tavern word lists...');
let tavernGenCode = fs.readFileSync(path.join(SCRATCH_DIR, 'js', 'services', 'tavernGenerator.js'), 'utf8');
const tavernGenReturnIdx = tavernGenCode.indexOf('return {');
if (tavernGenReturnIdx === -1) {
  throw new Error('Could not find return statement in tavernGenerator.js');
}
tavernGenCode = tavernGenCode.substring(0, tavernGenReturnIdx) + 'return { patterns: patterns, defaultValues: defaultValues }; \n}]);';

let extractedTavern: any = null;
const mockApp4 = {
  factory: (name: string, fnArray: any[]) => {
    const fn = fnArray[fnArray.length - 1];
    extractedTavern = fn();
  }
};

const tavernGenContext = { app: mockApp4, String: { prototype: {} }, console };
vm.createContext(tavernGenContext);
vm.runInContext(tavernGenCode, tavernGenContext);

if (extractedTavern) {
  const fileContent = `// src/lib/onoma/data/tavern-data.ts
// Generated from original Onoma tavernGenerator.js data.

export const TAVERN_DATA = {
  patterns: ${JSON.stringify(extractedTavern.patterns, null, 2)},
  nouns: ${JSON.stringify(extractedTavern.defaultValues.nouns, null, 2)},
  adjectives: ${JSON.stringify(extractedTavern.defaultValues.adjectives, null, 2)},
  titles: ${JSON.stringify(extractedTavern.defaultValues.titles, null, 2)}
};
`;
  fs.writeFileSync(path.join(DEST_DIR, 'tavern-data.ts'), fileContent, 'utf8');
  console.log('Saved tavern-data.ts');
} else {
  console.error('Failed to extract tavern word lists');
}

// 5. Extract Default Dictionaries from json file
console.log('Extracting default dictionaries...');
const dictsJson = fs.readFileSync(path.join(SCRATCH_DIR, 'data', 'defaultDictionaries.json'), 'utf8');
const parsedDicts = JSON.parse(dictsJson);

const mappedDicts = parsedDicts.map((d: any) => ({
  id: d._id,
  title: d.title,
  values: d.values
}));

const dictsFileContent = `// src/lib/onoma/data/default-dictionaries.ts
// Pre-configured Markov training dictionaries from original Onoma.

export interface DefaultDictionary {
  id: string;
  title: string;
  values: string[];
}

export const DEFAULT_DICTIONARIES: DefaultDictionary[] = ${JSON.stringify(mappedDicts, null, 2)};
`;
fs.writeFileSync(path.join(DEST_DIR, 'default-dictionaries.ts'), dictsFileContent, 'utf8');
console.log('Saved default-dictionaries.ts');
console.log('All Onoma data extracted successfully!');

// scripts/onoma/build-dicts.ts — Phase 4 runner.
// Turns raw/lexicon-clean.json into the compact, committed dictionaries the
// browser loads: src/lib/onoma/data/lexicon/<category>.json (grouped by culture
// bucket) + manifest.json.
// Run with bun:
//   bun scripts/onoma/build-dicts.ts

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { LexiconName } from "../../src/lib/onoma/lexicon/clean";
import { assignBucket, topCompounds } from "../../src/lib/onoma/lexicon/bucket";

const TOP_N_COMPOUNDS = 6;
const CAP_PER_BUCKET = 300; // plenty for a Markov chain; keeps files small
const MIN_BUCKET = 12; // drop buckets too small to train on

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(here, "raw", "lexicon-clean.json");
const OUT = path.join(here, "..", "..", "src", "lib", "onoma", "data", "lexicon");

/** Deterministic stride sample of up to `cap` items (avoids source-order bias). */
function sample<T>(arr: T[], cap: number): T[] {
  if (arr.length <= cap) return arr;
  const step = arr.length / cap;
  const out: T[] = [];
  for (let i = 0; out.length < cap && Math.floor(i) < arr.length; i += step)
    out.push(arr[Math.floor(i)]);
  return out;
}

const PUBLIC_SEEDS: Record<string, Record<string, string[]>> = {
  culture_sports: {
    latin: [
      "Harpastum", "Calcio", "Trigon", "Lucta", "Cursus", "Venatio", "Pelota", "Bocce", "Pallone", "Tamburello", "Ruzzola"
    ],
    germanic: [
      "Eisstockschießen", "Hornussen", "Glima", "Schwingen", "Kloppstock", "Kubb", "Rounders", "Shinty", "Skittles"
    ],
    celtic: [
      "Hurling", "Camogie", "Shinty", "Cnapan", "Caid", "Keating", "Rounders", "Road Bowling"
    ],
    slavic: [
      "Gorodki", "Lapta", "Kila", "Sambo", "Chizhk", "Babki", "Pandolo"
    ],
    arabic: [
      "Al-Dahma", "Tahteeb", "Kurra", "Jarid", "Al-Mizmar", "Al-Tabtaba", "Naza"
    ],
    "east-asian": [
      "Kemari", "Cuju", "Jianzi", "Sumo", "Wushu", "Baduk", "Xiangqi", "Yutnori", "Go", "Shogi", "Tug-of-war"
    ],
    austronesian: [
      "Ki-o-rahi", "Kula", "Surfing", "He'e nalu", "Ulu maika", "Tatau", "Bando", "Seka", "Makahiki"
    ],
    constructed: [
      "Harpastum", "Cuju", "Kemari", "Glima", "Hurling", "Gorodki", "Tahteeb", "Ki-o-rahi",
      "Ringer", "Spear-throw", "Bow-flight", "Stone-cast", "Run-race", "Shield-clash"
    ]
  },
  culture_cuisine: {
    latin: [
      "Paella", "Risotto", "Polenta", "Focaccia", "Lasagne", "Gelato", "Sangria", "Tiramisu", "Minestrone",
      "Gnocchi", "Bruschetta", "Cannoli", "Prosciutto", "Coq au Vin", "Ratatouille", "Bouillabaisse", "Crepe", "Camembert"
    ],
    germanic: [
      "Sauerbraten", "Schnitzel", "Bratwurst", "Sauerkraut", "Pretzel", "Strudel", "Pumpernickel", "Knödel",
      "Spätzle", "Smørrebrød", "Lutefisk", "Haggis", "Black Pudding", "Cider", "Mead", "Ale", "Stout"
    ],
    celtic: [
      "Haggis", "Colcannon", "Champ", "Boxty", "Irish Stew", "Cullen Skink", "Stovies", "Cranachan", "Bannock", "Soda Bread", "Mead", "Whiskey"
    ],
    slavic: [
      "Borscht", "Pierogi", "Pelmeni", "Varenyky", "Blini", "Bigos", "Golubtsi", "Kvass", "Kompot", "Medovukha", "Smetana", "Bryndza", "Kielbasa", "Paska"
    ],
    arabic: [
      "Hummus", "Falafel", "Shawarma", "Tabbouleh", "Baba Ghanoush", "Kibbeh", "Mansaf", "Kabsa", "Shakshuka", "Baklava", "Halva", "Knafeh", "Arak", "Kahwa"
    ],
    "east-asian": [
      "Sushi", "Ramen", "Gyoza", "Tempura", "Kimchi", "Bibimbap", "Bulgogi", "Dim Sum", "Peking Duck", "Kung Pao", "Baozi", "Tofu", "Sake", "Soju", "Oolong", "Matcha"
    ],
    austronesian: [
      "Poi", "Luau", "Kalua Pig", "Haupia", "Lomi Salmon", "Poke", "Kava", "Roti", "Nasi Goreng", "Satay", "Rendang", "Tempeh", "Durian"
    ],
    constructed: [
      "Lembas", "Cram", "Miruvor", "Honey-cake", "Elven-bread", "Ent-draught", "Orc-draught", "Dwarven-stout", "Shire-ale"
    ]
  },
  culture_architecture: {
    latin: [
      "Basilica", "Colosseum", "Pantheon", "Villa", "Aqueduct", "Forum", "Amphitheatre", "Cathedral",
      "Campanile", "Duomo", "Palazzo", "Piazza", "Rotunda", "Chateau", "Arc de Triomphe"
    ],
    germanic: [
      "Fachwerkhäuser", "Burg", "Schloss", "Dom", "Rathaus", "Belfry", "Keep", "Manor", "Minster", "Abbey", "Gablehouse", "Longhouse"
    ],
    celtic: [
      "Round Tower", "Broch", "Crannog", "Dolmen", "Menhir", "Cairn", "Rath", "Ringfort", "Hillfort", "Abbey", "Keep"
    ],
    slavic: [
      "Kremlin", "Ostrog", "Terem", "Izba", "Sobor", "Belltower", "Monastyr", "Chapel", "Wooden Church", "Kurgan"
    ],
    arabic: [
      "Mosque", "Minaret", "Madrasa", "Caravanserai", "Kasbah", "Souq", "Riad", "Alcazar", "Citadel", "Mihrab", "Dome", "Hammam"
    ],
    "east-asian": [
      "Pagoda", "Pavilion", "Temple", "Shrine", "Torii", "Castle", "Tenshu", "Hanok", "Minka", "Hutong", "Great Wall"
    ],
    austronesian: [
      "Marae", "Fale", "Bure", "Heiau", "Longhouse", "Toraja", "Stilt house", "Langghar"
    ],
    constructed: [
      "Orthanc", "Barad-dur", "Minas Tirith", "Rivendell", "Caras Galadhon", "Meduseld", "Khazad-dum", "Erebor", "Gondolin"
    ]
  },
  culture_generic: {
    latin: [
      "Roman", "Latini", "Sabines", "Etruscans", "Italians", "Spanish", "French", "Portuguese", "Romanian", "Catalans"
    ],
    germanic: [
      "Goths", "Saxons", "Angles", "Frisians", "Norse", "Danes", "Swedes", "Gera", "Teutons", "Franks"
    ],
    celtic: [
      "Gauls", "Britons", "Picts", "Irish", "Scots", "Welsh", "Bretons", "Celtiberians", "Helvetii"
    ],
    slavic: [
      "Russians", "Ukrainians", "Poles", "Czechs", "Slovaks", "Serbs", "Croats", "Bulgars", "Slovenes"
    ],
    arabic: [
      "Arabs", "Phoenicians", "Carthaginians", "Nabataeans", "Hebrews", "Moabites", "Assyrians"
    ],
    "east-asian": [
      "Han", "Yamato", "Joseon", "Mongols", "Jurchens", "Manchus", "Tibetans", "Ryukyuans"
    ],
    austronesian: [
      "Polynesians", "Maori", "Hawaiians", "Samoans", "Tongans", "Tahitians", "Fijians", "Malays", "Javanese"
    ],
    constructed: [
      "Elves", "Dwarves", "Hobbits", "Orcs", "Valar", "Maiar", "Dunadan"
    ]
  }
};

const lexicon: LexiconName[] = JSON.parse(fs.readFileSync(RAW, "utf8"));
const keptCompounds = new Set(
  topCompounds(
    lexicon.map((r) => r.name),
    TOP_N_COMPOUNDS
  )
);

const byCategory = new Map<string, Map<string, string[]>>();
for (const { name, category } of lexicon) {
  const bucket = assignBucket(name, keptCompounds);
  if (!byCategory.has(category)) byCategory.set(category, new Map());
  const buckets = byCategory.get(category)!;
  (buckets.get(bucket) ?? buckets.set(bucket, []).get(bucket)!).push(name);
}

// Inject public seeds to ensure all culture buckets are populated
for (const [category, cultureMap] of Object.entries(PUBLIC_SEEDS)) {
  if (!byCategory.has(category)) byCategory.set(category, new Map());
  const buckets = byCategory.get(category)!;
  for (const [bucket, names] of Object.entries(cultureMap)) {
    const bucketList = buckets.get(bucket) ?? buckets.set(bucket, []).get(bucket)!;
    for (const name of names) {
      if (!bucketList.includes(name)) {
        bucketList.push(name);
      }
    }
  }
}

fs.mkdirSync(OUT, { recursive: true });
const manifest: Record<string, { total: number; buckets: Record<string, number> }> = {};
let grandTotal = 0;

for (const [category, buckets] of byCategory) {
  const dict: Record<string, string[]> = {};
  const counts: Record<string, number> = {};
  const overflow: string[] = [];
  for (const [bucket, names] of buckets) {
    const isCultureCat = category.startsWith("culture_");
    const minSize = isCultureCat ? 5 : MIN_BUCKET;
    if (names.length < minSize) {
      overflow.push(...names);
      continue;
    } // pool thin buckets
    const capped = sample(names, CAP_PER_BUCKET);
    dict[bucket] = capped;
    counts[bucket] = capped.length;
  }
  // Under-represented cultures for this category → a "mixed" grab-bag (never drop names).
  if (overflow.length) {
    const capped = sample(overflow, CAP_PER_BUCKET);
    dict.mixed = capped;
    counts.mixed = capped.length;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  grandTotal += total;
  manifest[category] = { total, buckets: counts };
  fs.writeFileSync(path.join(OUT, `${category}.json`), JSON.stringify(dict));
}

fs.writeFileSync(
  path.join(OUT, "manifest.json"),
  JSON.stringify({ keptCompounds: [...keptCompounds], categories: manifest }, null, 2)
);

console.log("kept compounds:", [...keptCompounds].join(", "));
for (const [cat, m] of Object.entries(manifest)) {
  console.log(
    `${cat.padEnd(13)} ${String(m.total).padStart(5)}  ${Object.keys(m.buckets).length} buckets`
  );
}
const bytes = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(
  `total ${grandTotal} names, ${(bytes / 1024).toFixed(0)} KB across ${byCategory.size} category files -> ${OUT}`
);

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

// Curated real-world seed floor merged into the extracted lexicon by category +
// family. The wiki has almost no culture data (sports=2 rows, cuisine=14), so
// these floors are what actually trains the culture generators. Keep them real:
// they're Markov seeds, so authentic terms produce authentic-feeling new names.
const PUBLIC_SEEDS: Record<string, Record<string, string[]>> = {
  culture_sports: {
    latin: ["Harpastum", "Calcio Storico", "Trigon", "Lucta", "Cursus", "Venatio", "Pelota", "Bocce", "Pallone", "Tamburello", "Ruzzola", "Petanque", "Jeu de Paume", "Morra", "Volata", "Palio"],
    germanic: ["Eisstockschiessen", "Hornussen", "Glima", "Schwingen", "Kubb", "Skittles", "Faustball", "Klootschieten", "Fierljeppen", "Wikingerschach", "Ringreiten", "Boßeln", "Stoolball"],
    celtic: ["Hurling", "Camogie", "Shinty", "Cnapan", "Caid", "Rounders", "Road Bowling", "Gaelic Football", "Bando", "Caber Toss", "Stone Put", "Highland Wrestling", "Knappan"],
    slavic: ["Gorodki", "Lapta", "Kila", "Sambo", "Babki", "Chizh", "Svayka", "Klek", "Gulki", "Palant", "Pesapallo"],
    arabic: ["Tahteeb", "Jereed", "Kurra", "Furusiyya", "Saluki Racing", "Camel Racing", "Falconry", "Mounted Archery", "Zorkhaneh", "Matrah", "Al-Dahma", "Kabsh"],
    "east-asian": ["Kemari", "Cuju", "Jianzi", "Sumo", "Wushu", "Baduk", "Xiangqi", "Yutnori", "Go", "Shogi", "Kendo", "Kyudo", "Dragon Boat", "Sepak Takraw", "Taekkyon"],
    austronesian: ["Ki-o-rahi", "Surfing", "Hee Nalu", "Ulu Maika", "Tatau", "Pencak Silat", "Arnis", "Sipa", "Vaa", "Waka Ama", "Lua", "Sepak Takraw", "Mokomoko"],
    persian: ["Polo", "Chovgan", "Zurkhaneh", "Koshti", "Pahlavani", "Varzesh-e Bastani", "Buzkashi", "Mounted Archery", "Tent Pegging", "Skittle Toss"],
    turkic: ["Oil Wrestling", "Yagli Gures", "Cirit", "Jereed", "Buzkashi", "Kokpar", "Kyz Kuu", "Mas-wrestling", "Mangala", "Asik", "Goresh", "Kurash", "Audaryspak", "Tepuk"],
    african: ["Dambe", "Laamb", "Nguni Stick Fighting", "Donga", "Senet", "Mancala", "Ayo", "Engolo", "Morabaraba", "Kgati", "Nuba Wrestling", "Surma Stick Fighting", "Boomerang Hunt"],
    indic: ["Kabaddi", "Kho Kho", "Gilli Danda", "Mallakhamba", "Kalaripayattu", "Gatka", "Pehlwani", "Polo", "Lagori", "Atya Patya", "Silambam", "Vajra Mushti", "Insuknawr"],
    uralic: ["Pesapallo", "Eukonkanto", "Swamp Football", "Molkky", "Kyykka", "Sauna Endurance", "Kaukalopallo", "Skijoring", "Reindeer Racing", "Hiidenkivi"],
    constructed: ["Harpastum", "Cuju", "Glima", "Hurling", "Ringer", "Spear-throw", "Bow-flight", "Stone-cast", "Run-race", "Shield-clash", "Axe-throw", "Mead-hall Wrestling", "Sky-joust"],
  },
  culture_cuisine: {
    latin: ["Paella", "Risotto", "Polenta", "Focaccia", "Lasagne", "Gelato", "Sangria", "Tiramisu", "Minestrone", "Gnocchi", "Bruschetta", "Cannoli", "Prosciutto", "Coq au Vin", "Ratatouille", "Bouillabaisse", "Crepe", "Camembert", "Baguette", "Chorizo", "Gazpacho", "Bacalhau"],
    germanic: ["Sauerbraten", "Schnitzel", "Bratwurst", "Sauerkraut", "Pretzel", "Strudel", "Pumpernickel", "Knodel", "Spatzle", "Smorrebrod", "Lutefisk", "Rollmops", "Stollen", "Currywurst", "Frikadeller", "Gravlax", "Cider", "Mead", "Ale", "Stout", "Aquavit"],
    celtic: ["Haggis", "Colcannon", "Champ", "Boxty", "Irish Stew", "Cullen Skink", "Stovies", "Cranachan", "Bannock", "Soda Bread", "Cawl", "Welsh Rarebit", "Laverbread", "Barmbrack", "Mead", "Whiskey"],
    slavic: ["Borscht", "Pierogi", "Pelmeni", "Varenyky", "Blini", "Bigos", "Golubtsi", "Kvass", "Kompot", "Medovukha", "Smetana", "Bryndza", "Kielbasa", "Paska", "Shchi", "Okroshka", "Kasha", "Syrniki", "Halushky"],
    arabic: ["Hummus", "Falafel", "Shawarma", "Tabbouleh", "Baba Ghanoush", "Kibbeh", "Mansaf", "Kabsa", "Shakshuka", "Baklava", "Halva", "Knafeh", "Maqluba", "Fattoush", "Mahshi", "Harira", "Arak", "Kahwa"],
    "east-asian": ["Sushi", "Ramen", "Gyoza", "Tempura", "Kimchi", "Bibimbap", "Bulgogi", "Dim Sum", "Peking Duck", "Kung Pao", "Baozi", "Tofu", "Mapo Tofu", "Hotpot", "Congee", "Sake", "Soju", "Oolong", "Matcha", "Udon", "Tteokbokki"],
    austronesian: ["Poi", "Luau", "Kalua Pig", "Haupia", "Lomi Salmon", "Poke", "Kava", "Roti", "Nasi Goreng", "Satay", "Rendang", "Tempeh", "Durian", "Laksa", "Sambal", "Lumpia", "Adobo", "Sinigang", "Kinilaw"],
    persian: ["Chelow Kebab", "Ghormeh Sabzi", "Fesenjan", "Tahdig", "Ash Reshteh", "Kuku", "Dolmeh", "Sholeh Zard", "Halim", "Abgoosht", "Zereshk Polo", "Faloodeh", "Doogh", "Sharbat", "Kashk Bademjan"],
    turkic: ["Pilaf", "Manti", "Kebab", "Lahmacun", "Borek", "Dolma", "Baklava", "Lokum", "Ayran", "Kumis", "Beshbarmak", "Shashlik", "Plov", "Cig Kofte", "Simit", "Pide", "Lagman"],
    african: ["Jollof", "Fufu", "Injera", "Egusi", "Bobotie", "Bunny Chow", "Suya", "Couscous", "Tagine", "Ugali", "Nyama Choma", "Biltong", "Pap", "Doro Wat", "Maafe", "Waakye", "Chapati", "Sadza"],
    indic: ["Biryani", "Curry", "Samosa", "Dosa", "Naan", "Tandoori", "Tikka", "Vindaloo", "Korma", "Dal", "Rogan Josh", "Paneer", "Idli", "Chaat", "Lassi", "Gulab Jamun", "Jalebi", "Chai", "Paratha"],
    uralic: ["Karjalanpiirakka", "Kalakukko", "Ruisleipa", "Mammi", "Leipajuusto", "Gulyas", "Porkolt", "Langos", "Halaszle", "Toltott Kaposzta", "Kurtoskalacs", "Verivorst", "Mulgipuder", "Palinka", "Kalja"],
    constructed: ["Lembas", "Cram", "Miruvor", "Honey-cake", "Elven-bread", "Ent-draught", "Orc-draught", "Dwarven-stout", "Shire-ale", "Old Toby", "Coney Stew", "Seed-cake"],
  },
  culture_architecture: {
    latin: ["Basilica", "Colosseum", "Pantheon", "Villa", "Aqueduct", "Forum", "Amphitheatre", "Cathedral", "Campanile", "Duomo", "Palazzo", "Piazza", "Rotunda", "Chateau", "Arc de Triomphe", "Insula", "Thermae", "Loggia", "Belvedere"],
    germanic: ["Fachwerkhaus", "Burg", "Schloss", "Dom", "Rathaus", "Belfry", "Keep", "Manor", "Minster", "Abbey", "Gablehouse", "Longhouse", "Stave Church", "Hallenkirche", "Wasserburg", "Bergfried", "Burgerhaus"],
    celtic: ["Round Tower", "Broch", "Crannog", "Dolmen", "Menhir", "Cairn", "Rath", "Ringfort", "Hillfort", "Abbey", "Keep", "Souterrain", "Wheelhouse", "Clochan", "High Cross", "Stone Circle"],
    slavic: ["Kremlin", "Ostrog", "Terem", "Izba", "Sobor", "Belltower", "Monastyr", "Chapel", "Wooden Church", "Kurgan", "Detinets", "Palaty", "Zvonnitsa", "Trapeznaya", "Skansen"],
    arabic: ["Mosque", "Minaret", "Madrasa", "Caravanserai", "Kasbah", "Souq", "Riad", "Alcazar", "Citadel", "Mihrab", "Dome", "Hammam", "Iwan", "Mashrabiya", "Qasr", "Ribat", "Mausoleum"],
    "east-asian": ["Pagoda", "Pavilion", "Temple", "Shrine", "Torii", "Castle", "Tenshu", "Hanok", "Minka", "Hutong", "Great Wall", "Siheyuan", "Tulou", "Machiya", "Dougong", "Zen Garden"],
    austronesian: ["Marae", "Fale", "Bure", "Heiau", "Longhouse", "Tongkonan", "Rumah Gadang", "Bahay Kubo", "Honai", "Nipa Hut", "Pa", "Ahu", "Moai", "Lapita"],
    persian: ["Apadana", "Chahar Bagh", "Iwan", "Badgir", "Caravanserai", "Qanat", "Pishtaq", "Talar", "Hosseiniyeh", "Chartaqi", "Ab Anbar", "Yakhchal", "Bazaar", "Imamzadeh"],
    turkic: ["Turbe", "Hammam", "Caravanserai", "Kumbet", "Han", "Yurt", "Kulliye", "Medrese", "Bedesten", "Konak", "Saray", "Cesme", "Kervansaray", "Minaret"],
    african: ["Rondavel", "Kraal", "Great Enclosure", "Conical Tower", "Djenne Mosque", "Aksum Obelisk", "Stelae", "Tata Somba", "Musgum Hut", "Tukul", "Impluvium", "Beehive Hut", "Granary", "Royal Compound"],
    indic: ["Mandir", "Gopuram", "Stupa", "Vihara", "Haveli", "Chhatri", "Shikhara", "Mandapa", "Baoli", "Stepwell", "Vimana", "Torana", "Jharokha", "Chaitya", "Garbhagriha", "Mahal"],
    uralic: ["Lavvu", "Goahti", "Aitta", "Riihi", "Sauna", "Tono", "Hodaly", "Csarda", "Loft Granary", "Smoke Sauna", "Porte", "Kota", "Tornhouse"],
    constructed: ["Orthanc", "Barad-dur", "Minas Tirith", "Rivendell", "Caras Galadhon", "Meduseld", "Khazad-dum", "Erebor", "Gondolin", "Helms Deep", "Bag End", "Isengard", "Argonath"],
  },
  culture_generic: {
    latin: ["Roman", "Latini", "Sabines", "Etruscans", "Italians", "Spanish", "French", "Portuguese", "Romanians", "Catalans", "Umbrians", "Samnites", "Lusitanians", "Dacians", "Occitans", "Galicians", "Sardinians", "Walloons", "Lombards", "Venetians"],
    germanic: ["Goths", "Saxons", "Angles", "Jutes", "Frisians", "Franks", "Norse", "Danes", "Swedes", "Norwegians", "Teutons", "Vandals", "Burgundians", "Alemanni", "Bavarians", "Flemish", "Dutch", "Icelanders", "Geats"],
    celtic: ["Gauls", "Britons", "Picts", "Irish", "Scots", "Welsh", "Bretons", "Cornish", "Manx", "Gaels", "Celtiberians", "Helvetii", "Belgae", "Boii", "Galatians", "Caledonians", "Brigantes", "Iceni"],
    slavic: ["Russians", "Ukrainians", "Poles", "Czechs", "Slovaks", "Serbs", "Croats", "Bulgarians", "Slovenes", "Belarusians", "Macedonians", "Sorbs", "Kashubians", "Rusyns", "Pomeranians", "Wends", "Moravians"],
    arabic: ["Arabs", "Phoenicians", "Carthaginians", "Nabataeans", "Hebrews", "Moabites", "Assyrians", "Akkadians", "Arameans", "Chaldeans", "Sabaeans", "Bedouins", "Levantines", "Hejazi", "Yemenis"],
    "east-asian": ["Han", "Yamato", "Joseon", "Mongols", "Jurchens", "Manchus", "Tibetans", "Ryukyuans", "Khitan", "Tangut", "Hmong", "Zhuang", "Cantonese", "Hokkien", "Ainu"],
    austronesian: ["Polynesians", "Maori", "Hawaiians", "Samoans", "Tongans", "Tahitians", "Fijians", "Malays", "Javanese", "Sundanese", "Balinese", "Filipinos", "Visayans", "Malagasy", "Chamorro", "Dayak"],
    persian: ["Persians", "Medes", "Parthians", "Bactrians", "Sogdians", "Scythians", "Kurds", "Tajiks", "Pashtuns", "Baloch", "Lurs", "Gilaki", "Ossetians", "Alans", "Elamites"],
    turkic: ["Turks", "Seljuks", "Ottomans", "Uyghurs", "Kazakhs", "Uzbeks", "Turkmens", "Kyrgyz", "Tatars", "Azeris", "Bashkirs", "Chuvash", "Yakuts", "Cumans", "Pechenegs", "Gokturks", "Khazars"],
    african: ["Zulu", "Yoruba", "Igbo", "Akan", "Hausa", "Swahili", "Bantu", "Maasai", "Amhara", "Shona", "Mandinka", "Wolof", "Kongo", "Tuareg", "Oromo", "Fulani", "Xhosa", "Ndebele"],
    indic: ["Tamils", "Bengalis", "Marathas", "Rajputs", "Gujaratis", "Punjabis", "Sinhalese", "Telugus", "Kannadigas", "Mughals", "Mauryans", "Cholas", "Pallavas", "Gondi", "Assamese"],
    uralic: ["Finns", "Hungarians", "Estonians", "Sami", "Karelians", "Mordvins", "Mari", "Udmurts", "Komi", "Mansi", "Khanty", "Nenets", "Veps", "Ingrians"],
    constructed: ["Elves", "Dwarves", "Hobbits", "Orcs", "Valar", "Maiar", "Dunedain", "Rohirrim", "Numenoreans", "Ents", "Easterlings", "Haradrim"],
  },
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

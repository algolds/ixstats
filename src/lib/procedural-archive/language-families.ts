/**
 * Language Families — Training Data & Compiled Families
 *
 * Each family is built from ~50-100 curated seed words inspired by
 * real-world phonetic patterns. The Markov chain trains on these to
 * produce culturally consistent procedural names.
 *
 * 10 families covering diverse linguistic traditions.
 */

import { buildLanguageFamily, type LanguageFamily } from "./markov-naming";

// ──────────────────────────────────────────────
// Seed Word Lists
// ──────────────────────────────────────────────

const LATIN_SEEDS = [
  "roma", "italia", "gallia", "hispania", "lusitania", "sicilia", "sardinia",
  "corsica", "dalmatia", "pannonia", "illyria", "thracia", "moesia", "noricum",
  "raetia", "britannia", "aquitania", "narbonensis", "baetica", "terraconensis",
  "venetia", "liguria", "campania", "calabria", "apulia", "lucania", "umbria",
  "etruria", "latium", "samnium", "brutium", "messina", "syracusa", "carthago",
  "cyrenaica", "mauretania", "numidia", "cappadocia", "cilicia", "pontus",
  "galatia", "bithynia", "lycia", "caria", "ionia", "aeolia", "arcadia",
  "attica", "boeotia", "epirus", "thessalia", "macedonia", "achaia",
  "victoria", "augusta", "florentia", "verona", "cremona", "bononia",
  "ravenna", "mediolanum", "taurinum", "genua", "patavium", "aquileia",
];

const GERMANIC_SEEDS = [
  "nordheim", "ostmark", "westfalen", "sachsen", "bayern", "schwaben",
  "franken", "thuringen", "holstein", "mecklenburg", "pommern", "schlesien",
  "brandenburg", "hannover", "braunschweig", "oldenburg", "hessen", "baden",
  "wurttemberg", "rheinland", "westmark", "ostland", "nordland", "eismark",
  "bergheim", "waldburg", "steinfeld", "grenzmark", "hochland", "tiefland",
  "friesland", "gotland", "vinland", "midgard", "alfheim", "svartalfheim",
  "niflheim", "jotunheim", "asgard", "vanaheim", "helheim", "muspelheim",
  "danemark", "svealand", "gotaland", "norrland", "finnmark", "trondheim",
  "vestland", "rogaland", "hordaland", "telemark", "hedmark", "oppland",
  "stromheim", "dunkelwald", "silberberg", "goldstein", "eisenstadt",
];

const SLAVIC_SEEDS = [
  "novgorod", "belgorod", "volgograd", "petrograd", "tsargrad", "kiev",
  "minsk", "smolensk", "murmansk", "arkhangelsk", "chelyabinsk", "omsk",
  "tomsk", "novosibirsk", "krasnoyarsk", "vladivostok", "khabarovsk",
  "irkutsk", "yakutsk", "magadan", "kamchatka", "sakhalin", "primorsk",
  "stavropol", "krasnodar", "rostov", "voronezh", "kursk", "bryansk",
  "pskov", "tver", "yaroslavl", "kostroma", "vladimir", "ryazan",
  "kaluga", "tula", "orel", "penza", "saratov", "samara", "kazan",
  "ulyanovsk", "cheboksary", "saransk", "izhevsk", "perm", "yekaterinburg",
  "tyumen", "surgut", "nizhnevartovsk", "vologda", "murom", "suzdal",
  "chernovtsy", "lvov", "ternopol", "vinnitsa", "zhitomir", "poltava",
];

const ARABIC_SEEDS = [
  "dimashq", "baghdad", "riyadh", "muscat", "sana", "amman", "beirut",
  "tunis", "rabat", "algir", "tripoli", "khartum", "mogadishu",
  "adan", "jiddah", "makkah", "madinah", "taif", "tabuk", "hail",
  "qasim", "najran", "jizan", "abha", "baha", "asir", "dammam",
  "qatif", "jubail", "yanbu", "dumat", "sakaka", "arar", "turaif",
  "rafha", "hafar", "dawadimi", "majmaah", "shaqra", "zilfi",
  "masqat", "salalah", "nizwa", "sohar", "ibri", "dhofar",
  "khalij", "sharjah", "fujairah", "ajman", "umm", "ras",
  "manama", "muharraq", "riffa", "hamad", "sitra", "juffair",
  "basrah", "karbala", "najaf", "kufa", "samarra", "tikrit",
];

const EAST_ASIAN_SEEDS = [
  "jingdu", "nanjing", "beijing", "shanghai", "guangzhou", "chengdu",
  "hangzhou", "suzhou", "fuzhou", "wenzhou", "lanzhou", "zhengzhou",
  "changsha", "wuhan", "xian", "kunming", "guiyang", "nanning",
  "taiyuan", "jinan", "hefei", "nanchang", "shenyang", "dalian",
  "harbin", "changchun", "urumqi", "hohhot", "yinchuan", "xining",
  "lhasa", "taipei", "kaohsiung", "taichung", "tainan", "hsinchu",
  "kyoto", "osaka", "nagoya", "sendai", "sapporo", "fukuoka",
  "hiroshima", "kobe", "kawasaki", "yokohama", "okinawa", "nagasaki",
  "kumamoto", "matsuyama", "kanazawa", "niigata", "shizuoka",
  "pyongyang", "kaesong", "wonsan", "hamhung", "chongjin",
];

const POLYNESIAN_SEEDS = [
  "aotearoa", "hawaiki", "rarotonga", "tahiti", "samoa", "tonga",
  "fiji", "vanuatu", "kiribati", "tuvalu", "nauru", "palau",
  "mangaia", "aitutaki", "atiu", "mauke", "mitiaro", "manihiki",
  "rakahanga", "pukapuka", "nassau", "suwarrow", "penrhyn",
  "tongatapu", "vavau", "haapai", "niuafoou", "niuatoputapu",
  "savaii", "upolu", "tutuila", "manua", "apia", "pago",
  "raiatea", "huahine", "moorea", "bora", "maupiti", "tetiaroa",
  "rangiroa", "fakarava", "tikehau", "manihi", "takapoto",
  "makatea", "rurutu", "tubuai", "raivavae", "rapa", "mangareva",
  "pitcairn", "rapanui", "tokelau", "niue", "wallis", "futuna",
  "rotuma", "lautoka", "nadi", "suva", "labasa", "levuka",
];

const CELTIC_SEEDS = [
  "caledonia", "hibernia", "cambria", "armorica", "gallaecia",
  "eireann", "ulaidh", "connacht", "laighin", "mumhain",
  "breifne", "osraige", "deisi", "muscraige", "corcu", "ciarraige",
  "desmumhain", "thomond", "ormond", "leinster", "meath",
  "tara", "emain", "cruachan", "cashel", "ailech", "dun",
  "glendalough", "clonmacnoise", "armagh", "downpatrick",
  "aberdeen", "inverness", "dunfermline", "stirling", "perth",
  "dundee", "kilmarnock", "ayr", "dumfries", "galloway",
  "argyll", "moray", "ross", "caithness", "sutherland",
  "aberystwyth", "caernarfon", "caerdydd", "abertawe", "bangor",
  "llanelli", "merthyr", "pontypridd", "cwmbran", "tredegar",
  "gwynedd", "powys", "dyfed", "ceredigion", "pembroke",
];

const TURKIC_SEEDS = [
  "istanbul", "ankara", "izmir", "bursa", "antalya", "konya",
  "adana", "gaziantep", "mersin", "diyarbakir", "kayseri",
  "trabzon", "samsun", "eskisehir", "denizli", "malatya",
  "erzurum", "sivas", "elazig", "tokat", "amasya", "corum",
  "kastamonu", "sinop", "bolu", "duzce", "sakarya", "bilecik",
  "almaty", "astana", "shymkent", "karaganda", "aktobe", "taraz",
  "pavlodar", "semey", "oskemen", "kostanay", "kyzylorda",
  "tashkent", "samarkand", "bukhara", "khiva", "fergana",
  "andijan", "namangan", "nukus", "termez", "karshi",
  "ashgabat", "turkmenabad", "mary", "dashoguz", "balkanabat",
  "bishkek", "osh", "jalal", "karakol", "batken", "naryn",
];

const SOUTH_ASIAN_SEEDS = [
  "varanasi", "pataliputra", "ujjayini", "mathura", "kashi",
  "hastinapura", "indraprastha", "ayodhya", "dvaraka", "lanka",
  "gandhara", "magadha", "kosala", "videha", "kuru", "panchala",
  "matsya", "avanti", "chedi", "vatsa", "anga", "vanga",
  "kalinga", "andhra", "chola", "pandya", "chera", "pallava",
  "chalukya", "rashtrakuta", "hoysala", "vijayanagara", "mysuru",
  "thanjavur", "madurai", "kanchipuram", "tirupati", "hampi",
  "badami", "pattadakal", "aihole", "belur", "halebidu",
  "amaravati", "nalanda", "vikramashila", "takshashila", "vallabhi",
  "sarnath", "bodh", "rajagriha", "kushinagara", "lumbini",
  "kathmandu", "patan", "bhaktapur", "pokhara", "janakpur",
  "colombo", "kandy", "anuradhapura", "polonnaruwa", "sigiriya",
];

const AFRICAN_SEEDS = [
  "timbuktu", "gao", "djenne", "kumasi", "benin", "ife",
  "kano", "zaria", "sokoto", "bornu", "kanem", "wadai",
  "darfur", "sennar", "meroe", "aksum", "lalibela", "gondar",
  "harar", "mogadishu", "kilwa", "zanzibar", "mombasa", "malindi",
  "sofala", "mapungubwe", "thulamela", "zimbabwe", "mutapa",
  "lunda", "luba", "kongo", "ndongo", "matamba", "loango",
  "buganda", "bunyoro", "ankole", "rwanda", "burundi", "karagwe",
  "tabora", "ujiji", "bagamoyo", "pangani", "tanga", "lamu",
  "pate", "brava", "zeila", "berbera", "tadjoura", "obock",
  "bamako", "ouagadougou", "niamey", "abuja", "accra", "lome",
  "cotonou", "douala", "yaounde", "brazzaville", "kinshasa",
];

const MESOAMERICAN_SEEDS = [
  "tenochtitlan", "texcoco", "tlacopan", "cholula", "tlaxcala",
  "zempoala", "mitla", "zaachila", "teotihuacan", "tula",
  "xochicalco", "cacaxtla", "cantona", "tajin", "papantla",
  "comalcalco", "palenque", "tonina", "bonampak", "yaxchilan",
  "calakmul", "uxmal", "chichen", "mayapan", "tulum", "coba",
  "tikal", "copan", "quirigua", "iximche", "kaminaljuyu",
  "takalik", "izapa", "chiapa", "mixco", "zaculeu",
  "tehuantepec", "oaxaca", "acapulco", "colima", "jalisco",
  "michoacan", "tzintzuntzan", "patzcuaro", "guanajuato",
  "queretaro", "zacatecas", "durango", "chihuahua", "sonora",
  "mazatlan", "tepic", "chapala", "tequila", "guadalajara",
  "zapopan", "tonala", "tlaquepaque", "arandas", "tepatitlan",
];

// ──────────────────────────────────────────────
// Compiled Families
// ──────────────────────────────────────────────

let _compiledFamilies: LanguageFamily[] | null = null;

/** Get all compiled language families (lazy-initialized, cached) */
export function getLanguageFamilies(): LanguageFamily[] {
  if (_compiledFamilies) return _compiledFamilies;

  _compiledFamilies = [
    buildLanguageFamily("latin", "Latin/Romance", LATIN_SEEDS, {
      suffixes: ["ia", "um", "is", "ium", "ania", "onia", "ica"],
      minLength: 4, maxLength: 12,
      vowelRatio: [0.35, 0.55],
      riverTemplates: ["Rio $N", "$N River", "Flumen $N"],
      lakeTemplates: ["Lago $N", "Lacus $N", "Lake $N"],
      mountainTemplates: ["Monte $N", "Mons $N", "$N Alps"],
      seaTemplates: ["Mare $N", "Sea of $N", "$N Sea"],
    }),

    buildLanguageFamily("germanic", "Germanic/Nordic", GERMANIC_SEEDS, {
      suffixes: ["heim", "land", "burg", "wald", "mark", "feld", "berg", "stein"],
      minLength: 4, maxLength: 14,
      vowelRatio: [0.25, 0.45],
      riverTemplates: ["$N River", "River $N", "$N Bach"],
      lakeTemplates: ["$N See", "Lake $N", "$Nsee"],
      mountainTemplates: ["$Nberg", "Mount $N", "$N Peak"],
      seaTemplates: ["$N Sea", "Sea of $N", "$N Strait"],
    }),

    buildLanguageFamily("slavic", "Slavic/Eastern", SLAVIC_SEEDS, {
      suffixes: ["sk", "grad", "ov", "ovo", "ovsk", "ansk", "insk"],
      minLength: 4, maxLength: 14,
      vowelRatio: [0.25, 0.45],
      riverTemplates: ["$N River", "Reka $N"],
      lakeTemplates: ["Lake $N", "Ozero $N"],
      mountainTemplates: ["$N Gora", "Mount $N", "$N Mountains"],
      seaTemplates: ["$N Sea", "Sea of $N", "$N More"],
    }),

    buildLanguageFamily("arabic", "Arabic/Semitic", ARABIC_SEEDS, {
      suffixes: ["abad", "istan", "iyya", "at", "an"],
      minLength: 3, maxLength: 10,
      vowelRatio: [0.3, 0.5],
      riverTemplates: ["Wadi $N", "Nahr $N", "$N River"],
      lakeTemplates: ["Bahr $N", "Lake $N"],
      mountainTemplates: ["Jabal $N", "Mount $N"],
      seaTemplates: ["Bahr $N", "Khalij $N", "Sea of $N"],
    }),

    buildLanguageFamily("eastasian", "East Asian", EAST_ASIAN_SEEDS, {
      suffixes: ["zhou", "jing", "shan", "hai", "chuan", "nan", "bei"],
      minLength: 3, maxLength: 10,
      vowelRatio: [0.35, 0.55],
      riverTemplates: ["$N He", "$N Jiang", "$N River"],
      lakeTemplates: ["$N Hu", "Lake $N", "$N Chi"],
      mountainTemplates: ["$N Shan", "Mount $N"],
      seaTemplates: ["$N Hai", "Sea of $N", "$N Ocean"],
    }),

    buildLanguageFamily("polynesian", "Polynesian/Oceanic", POLYNESIAN_SEEDS, {
      suffixes: ["nui", "roa", "iti", "ata", "anga", "otu"],
      minLength: 3, maxLength: 12,
      vowelRatio: [0.45, 0.7],
      riverTemplates: ["Awa $N", "$N Stream"],
      lakeTemplates: ["Roto $N", "Lake $N"],
      mountainTemplates: ["Maunga $N", "Mount $N"],
      seaTemplates: ["Moana $N", "Sea of $N", "$N Waters"],
    }),

    buildLanguageFamily("celtic", "Celtic/Gaelic", CELTIC_SEEDS, {
      suffixes: ["ach", "agh", "aith", "shire", "glen", "dun"],
      minLength: 4, maxLength: 13,
      vowelRatio: [0.3, 0.5],
      riverTemplates: ["Abhainn $N", "$N River", "River $N"],
      lakeTemplates: ["Loch $N", "Lough $N"],
      mountainTemplates: ["Ben $N", "Cnoc $N", "Mount $N"],
      seaTemplates: ["Muir $N", "Sea of $N", "$N Strait"],
    }),

    buildLanguageFamily("turkic", "Turkic/Central Asian", TURKIC_SEEDS, {
      suffixes: ["stan", "bad", "kent", "dag", "gol", "abad"],
      minLength: 3, maxLength: 12,
      vowelRatio: [0.3, 0.5],
      riverTemplates: ["$N Darya", "$N Su", "$N River"],
      lakeTemplates: ["$N Gol", "Lake $N", "$N Kol"],
      mountainTemplates: ["$N Dag", "$N Tau", "Mount $N"],
      seaTemplates: ["$N Deniz", "Sea of $N"],
    }),

    buildLanguageFamily("southasian", "South Asian/Indo-Aryan", SOUTH_ASIAN_SEEDS, {
      suffixes: ["pur", "pura", "nagar", "giri", "desh", "abad"],
      minLength: 4, maxLength: 13,
      vowelRatio: [0.35, 0.55],
      riverTemplates: ["$N Nadi", "$N Ganga", "$N River"],
      lakeTemplates: ["$N Tal", "Lake $N", "$N Sarovar"],
      mountainTemplates: ["$N Parvat", "Mount $N", "$N Giri"],
      seaTemplates: ["$N Sagar", "Sea of $N"],
    }),

    buildLanguageFamily("african", "African/Sub-Saharan", AFRICAN_SEEDS, {
      suffixes: ["ba", "wa", "we", "nda", "la", "ko", "so"],
      minLength: 3, maxLength: 12,
      vowelRatio: [0.35, 0.55],
      riverTemplates: ["$N River", "River $N"],
      lakeTemplates: ["Lake $N", "$N Pool"],
      mountainTemplates: ["Mount $N", "$N Peak"],
      seaTemplates: ["$N Sea", "Sea of $N", "$N Channel"],
    }),

    buildLanguageFamily("mesoamerican", "Mesoamerican/Nahuatl", MESOAMERICAN_SEEDS, {
      suffixes: ["tlan", "can", "pan", "co", "tepec", "titlan"],
      minLength: 4, maxLength: 14,
      vowelRatio: [0.35, 0.55],
      riverTemplates: ["Atoyac $N", "$N River"],
      lakeTemplates: ["$N Lake", "Lago $N"],
      mountainTemplates: ["$N Tepetl", "Mount $N"],
      seaTemplates: ["Sea of $N", "$N Waters"],
    }),
  ];

  return _compiledFamilies;
}

/** Get a specific language family by ID */
export function getLanguageFamily(id: string): LanguageFamily | undefined {
  return getLanguageFamilies().find((f) => f.id === id);
}

/** Get all family IDs */
export function getLanguageFamilyIds(): string[] {
  return getLanguageFamilies().map((f) => f.id);
}

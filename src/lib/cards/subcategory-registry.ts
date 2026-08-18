/**
 * Subcategory Registry for Lore Cards (Individual Non-Grouped Game-Icons Powered)
 *
 * Provides distinct individual subcategories for all 12 Lore categories,
 * mapped to Game-Icons library SVG paths and keyword matching signals.
 */

import type { LoreCategory } from "./category-enums";

export interface SubcategoryDefinition {
  id: string;
  label: string;
  iconPath: string; // Game-Icons SVG path under /icons/game-icons/icons/ffffff/transparent/1x1/...
  keywords: string[];
}

export const CATEGORY_SUBCATEGORIES: Record<LoreCategory, SubcategoryDefinition[]> = {
  CULTURE: [
    {
      id: "sports",
      label: "Sports",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/trophy.svg",
      keywords: [
        "sports",
        "football",
        "league",
        "cup",
        "stadium",
        "derby",
        "tournament",
        "championship",
      ],
    },
    {
      id: "athletics",
      label: "Athletics",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/running-shoe.svg",
      keywords: ["athletics", "marathon", "runner", "track", "field", "olympics", "athlete"],
    },
    {
      id: "music",
      label: "Music",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/musical-notes.svg",
      keywords: ["music", "orchestra", "song", "composer", "symphony", "melody", "album", "choir"],
    },
    {
      id: "performing_arts",
      label: "Performing Arts & Theatre",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/drama-masks.svg",
      keywords: ["theatre", "opera", "dance", "performance", "play", "ballet", "stage"],
    },
    {
      id: "literature",
      label: "Literature",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/feather.svg",
      keywords: ["literature", "novel", "poetry", "author", "prose", "epic", "fiction"],
    },
    {
      id: "festivals",
      label: "Festivals",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/firework-rocket.svg",
      keywords: ["festival", "carnival", "fair", "fiesta", "gala", "parade"],
    },
    {
      id: "traditions",
      label: "Traditions & Folklore",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/candle-light.svg",
      keywords: ["tradition", "folklore", "custom", "heritage", "mythology", "ritual"],
    },
    {
      id: "cuisine",
      label: "Cuisine & Gastronomy",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/hot-meal.svg",
      keywords: ["cuisine", "food", "gastronomy", "brewery", "dish", "culinary", "feast", "wine"],
    },
    {
      id: "architecture",
      label: "Architecture",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/mucous-pillar.svg",
      keywords: ["architecture", "building", "palace", "structure", "design", "monuments"],
    },
    {
      id: "heritage",
      label: "Heritage Landmarks",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/colombian-statue.svg",
      keywords: ["heritage", "landmark", "museum", "sculpture", "memorial"],
    },
  ],
  MILITARY: [
    {
      id: "battles",
      label: "Battles",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/crossed-swords.svg",
      keywords: ["battle", "clash", "skirmish", "engagement", "frontline"],
    },
    {
      id: "campaigns",
      label: "Campaigns",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/black-flag.svg",
      keywords: ["campaign", "offensive", "operation", "theater", "expedition"],
    },
    {
      id: "armies",
      label: "Armies & Legions",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/sbed/shield.svg",
      keywords: ["army", "legion", "division", "corps", "regiment", "infantry", "cavalry", "guard"],
    },
    {
      id: "naval",
      label: "Naval Fleets",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/galleon.svg",
      keywords: ["navy", "fleet", "warship", "battleship", "frigate", "submarine", "admiral"],
    },
    {
      id: "weapons",
      label: "Weapons & Siege Engines",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/cannon.svg",
      keywords: ["weapon", "cannon", "artillery", "rifle", "sword", "catapult", "missile", "armor"],
    },
    {
      id: "fortresses",
      label: "Fortresses & Defenses",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/locked-fortress.svg",
      keywords: ["fortress", "castle", "bunker", "citadel", "bastion", "wall"],
    },
    {
      id: "doctrine",
      label: "Military Doctrine",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/compass.svg",
      keywords: ["doctrine", "strategy", "tactic", "logistics", "maneuver"],
    },
  ],
  GEOGRAPHY: [
    {
      id: "mountains",
      label: "Mountains",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/mountain-cave.svg",
      keywords: ["mountain", "peak", "range", "mount", "alps", "summit"],
    },
    {
      id: "rivers",
      label: "Rivers & Streams",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/sbed/water-drop.svg",
      keywords: ["river", "stream", "tributary", "delta", "creek"],
    },
    {
      id: "seas",
      label: "Seas & Oceans",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/wave-crest.svg",
      keywords: ["sea", "ocean", "gulf", "bay", "channel", "strait"],
    },
    {
      id: "islands",
      label: "Islands & Archipelagos",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/palm-tree.svg",
      keywords: ["island", "archipelago", "atoll", "isle", "coast"],
    },
    {
      id: "biomes",
      label: "Forests & Biomes",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/pine-tree.svg",
      keywords: ["forest", "desert", "jungle", "tundra", "valley", "plain", "biome"],
    },
    {
      id: "wonders",
      label: "Natural Wonders",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/sun.svg",
      keywords: ["wonder", "canyon", "reef", "waterfall", "geyser", "cave"],
    },
  ],
  PEOPLE: [
    {
      id: "heads_of_state",
      label: "Heads of State",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/laurel-crown.svg",
      keywords: ["president", "prime minister", "chancellor", "governor", "premier"],
    },
    {
      id: "monarchs",
      label: "Monarchs",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/crown.svg",
      keywords: ["king", "queen", "emperor", "empress", "prince", "monarch"],
    },
    {
      id: "dynasties",
      label: "Dynasties & Houses",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/laurel-crown.svg",
      keywords: ["dynasty", "house", "lineage", "royal house"],
    },
    {
      id: "commanders",
      label: "Commanders & Admirals",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/skoll/rank-3.svg",
      keywords: ["general", "admiral", "marshal", "commander", "captain"],
    },
    {
      id: "scholars",
      label: "Scholars & Philosophers",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/think.svg",
      keywords: ["philosopher", "scholar", "scientist", "professor", "thinker", "inventor"],
    },
    {
      id: "artists",
      label: "Artists & Authors",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/palette.svg",
      keywords: ["artist", "painter", "poet", "musician", "author", "sculptor"],
    },
    {
      id: "explorers",
      label: "Explorers & Pioneers",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/spyglass.svg",
      keywords: ["explorer", "pioneer", "navigator", "astronaut", "voyager"],
    },
  ],
  ECONOMY: [
    {
      id: "currencies",
      label: "Currencies",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/coins.svg",
      keywords: ["currency", "coin", "dollar", "credit", "money", "token"],
    },
    {
      id: "banking",
      label: "Central Banking & Reserves",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/bank.svg",
      keywords: ["bank", "reserve", "mint", "central bank", "financial"],
    },
    {
      id: "corporations",
      label: "Corporations",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/factory.svg",
      keywords: ["corporation", "company", "firm", "enterprise", "conglomerate"],
    },
    {
      id: "industry",
      label: "Industry & Manufacturing",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/cog.svg",
      keywords: ["industry", "manufacturing", "plant", "assembly", "production"],
    },
    {
      id: "trade_guilds",
      label: "Trade Guilds",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/scales.svg",
      keywords: ["guild", "monopoly", "syndicate", "chamber", "union", "exchange"],
    },
    {
      id: "commodities",
      label: "Commodities & Resources",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/willdabeast/gold-bar.svg",
      keywords: ["gold", "oil", "grain", "timber", "coal", "iron", "commodity", "resource"],
    },
    {
      id: "trade_routes",
      label: "Trade Routes & Ports",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/cargo-ship.svg",
      keywords: ["trade route", "port", "harbor", "shipping", "canal", "export"],
    },
  ],
  DIPLOMACY: [
    {
      id: "treaties",
      label: "Treaties",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/scroll-unfurled.svg",
      keywords: ["treaty", "concord", "charter", "convention"],
    },
    {
      id: "alliances",
      label: "Alliances & Blocs",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/quill-ink.svg",
      keywords: ["alliance", "pact", "league", "bloc", "coalition"],
    },
    {
      id: "peace_accords",
      label: "Peace Accords",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/dove.svg",
      keywords: ["peace", "accord", "armistice", "ceasefire", "truce"],
    },
    {
      id: "embassies",
      label: "Embassies & Missions",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/quill-ink.svg",
      keywords: ["embassy", "ambassador", "diplomat", "consulate", "mission"],
    },
    {
      id: "councils",
      label: "International Councils",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/podium.svg",
      keywords: ["council", "summit", "assembly", "conference", "forum"],
    },
  ],
  GOVERNMENT: [
    {
      id: "parliaments",
      label: "Parliaments",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/capitol.svg",
      keywords: ["parliament", "congress", "house", "chamber"],
    },
    {
      id: "senates",
      label: "Senates",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/capitol.svg",
      keywords: ["senate", "upper house", "senator"],
    },
    {
      id: "constitutions",
      label: "Constitutions & Laws",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/justice-star.svg",
      keywords: ["constitution", "law", "statute", "charter", "code", "decree"],
    },
    {
      id: "ministries",
      label: "Ministries & Departments",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/capitol.svg",
      keywords: ["ministry", "department", "bureau", "agency", "cabinet"],
    },
    {
      id: "elections",
      label: "Elections & Voting",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/vote.svg",
      keywords: ["election", "vote", "referendum", "ballot", "campaign"],
    },
  ],
  SCIENCE: [
    {
      id: "space",
      label: "Space & Astronomy",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/skoll/orbit.svg",
      keywords: ["space", "astronomy", "orbit", "planet", "star", "telescope", "satellite"],
    },
    {
      id: "physics",
      label: "Physics",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/skull-bolt.svg",
      keywords: ["physics", "atom", "quantum", "gravity", "thermodynamics"],
    },
    {
      id: "energy",
      label: "Energy & Nuclear",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lord-berandas/power-button.svg",
      keywords: ["energy", "nuclear", "fusion", "electricity", "power", "grid"],
    },
    {
      id: "biology",
      label: "Biology & Medicine",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/dna2.svg",
      keywords: ["medicine", "biology", "dna", "genetics", "health", "organism"],
    },
    {
      id: "engineering",
      label: "Engineering",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/cog.svg",
      keywords: ["engineering", "technology", "machine", "engine", "device", "mechanism"],
    },
    {
      id: "computing",
      label: "Computing & AI",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/processor.svg",
      keywords: ["computer", "ai", "computing", "software", "network", "cyber", "algorithm"],
    },
  ],
  RELIGION: [
    {
      id: "deities",
      label: "Deities & Pantheons",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/sunken-eye.svg",
      keywords: ["god", "deity", "goddess", "pantheon", "divinity", "creator"],
    },
    {
      id: "texts",
      label: "Sacred Texts",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/spell-book.svg",
      keywords: ["scripture", "sacred text", "tome", "gospel", "canon"],
    },
    {
      id: "temples",
      label: "Temples & Shrines",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/pagoda.svg",
      keywords: ["temple", "shrine", "monastery", "sanctuary"],
    },
    {
      id: "cathedrals",
      label: "Cathedrals & Churches",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/church.svg",
      keywords: ["cathedral", "church", "basilica", "abbey"],
    },
    {
      id: "holy_orders",
      label: "Holy Orders & Clergy",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/monkey.svg",
      keywords: ["order", "monk", "priest", "clergy", "pilgrimage"],
    },
  ],
  HISTORY: [
    {
      id: "eras",
      label: "Historical Eras",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/hourglass.svg",
      keywords: ["era", "epoch", "age", "period", "century", "antiquity"],
    },
    {
      id: "revolutions",
      label: "Revolutions & Uprisings",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/torch.svg",
      keywords: ["revolution", "uprising", "rebellion", "revolt", "coup"],
    },
    {
      id: "ancient_empires",
      label: "Ancient Empires",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/ancient-ruins.svg",
      keywords: ["empire", "ancient", "civilization", "kingdom", "ruins"],
    },
  ],
  NATION: [
    {
      id: "republics",
      label: "Republics",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/relationship-bounds.svg",
      keywords: ["republic", "state", "sovereign", "nation", "commonwealth"],
    },
    {
      id: "kingdoms",
      label: "Kingdoms & Realms",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/laurel-crown.svg",
      keywords: ["realm", "kingdom", "empire", "duchy", "principality"],
    },
    {
      id: "federations",
      label: "Federations",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/globe.svg",
      keywords: ["federation", "confederation", "union", "league"],
    },
    {
      id: "city_states",
      label: "City-States",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/caravan.svg",
      keywords: ["city-state", "polis", "enclave", "free city"],
    },
  ],
  SPECIAL: [
    {
      id: "relics",
      label: "Relics & Regalia",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/holy-grail.svg",
      keywords: ["relic", "regalia", "scepter", "orb", "holy"],
    },
    {
      id: "artifacts",
      label: "Cosmic Artifacts",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/crystal-wand.svg",
      keywords: ["artifact", "cosmic", "crystal", "tome", "talisman"],
    },
    {
      id: "milestones",
      label: "System Milestones",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/lorc/medal.svg",
      keywords: ["milestone", "achievement", "record", "founders"],
    },
    {
      id: "commemoratives",
      label: "Commemorative Medals",
      iconPath: "/icons/game-icons/icons/ffffff/transparent/1x1/delapouite/ribbon-medal.svg",
      keywords: ["commemorative", "medal", "anniversary", "jubilee"],
    },
  ],
  NS_IMPORT: [],
};

/**
 * Get subcategory definitions for a given Lore category
 */
export function getCategorySubcategories(
  category?: LoreCategory | string | null
): SubcategoryDefinition[] {
  if (!category) return [];
  const safeCat = category.toUpperCase() as LoreCategory;
  return CATEGORY_SUBCATEGORIES[safeCat] ?? [];
}

/**
 * Smart auto-matcher: match title or text excerpt to closest subcategory definition
 */
export function autoMatchSubcategory(
  category?: LoreCategory | string | null,
  text?: string | null
): string {
  if (!category || !text) return "";
  const list = getCategorySubcategories(category);
  if (list.length === 0) return "";

  const lowerText = text.toLowerCase();
  for (const item of list) {
    if (item.keywords.some((kw) => lowerText.includes(kw))) {
      return item.label;
    }
  }

  return list[0]?.label ?? "";
}

/**
 * Lore Article Classifier & Cataloging Engine
 *
 * Multi-Signal Scoring Classifier for MediaWiki articles.
 * Maps articles from IxWiki and IIWiki directly into the 12 canonical LoreCategory enums.
 *
 * Signal Weights:
 *   - Tier 1 (50 pts): Infobox template type (e.g. Infobox officeholder, Infobox settlement, Infobox military conflict)
 *   - Tier 2 (10 pts/each): Category taxonomy regex patterns (e.g. Category:Rivers of..., Category:Battles of...)
 *   - Tier 3 (1-15 pts): Synonym & lead paragraph keyword scoring against CATEGORY_SYNONYMS
 *
 * Deterministic Tie-Breaking Specificity:
 *   DIPLOMACY / MILITARY / PEOPLE / RELIGION / SCIENCE / ECONOMY > GOVERNMENT / CULTURE > GEOGRAPHY / HISTORY > NATION > SPECIAL
 */

import { LoreCategory, CATEGORY_SYNONYMS, type LoreCategory as LoreCategoryType } from "./category-enums";

export interface ArticleClassificationInput {
  title?: string | null;
  text?: string | null;
  categories?: Array<string | { title: string }> | null;
  infoboxes?: string[] | null;
}

/**
 * Tier 1: Canonical mapping of MediaWiki infobox templates to LoreCategory.
 */
export const INFOBOX_CATEGORY_MAP: Record<string, LoreCategoryType> = {
  // PEOPLE
  "infobox person": LoreCategory.PEOPLE,
  "infobox officeholder": LoreCategory.PEOPLE,
  "infobox politician": LoreCategory.PEOPLE,
  "infobox monarch": LoreCategory.PEOPLE,
  "infobox prime minister": LoreCategory.PEOPLE,
  "infobox president": LoreCategory.PEOPLE,
  "infobox leader": LoreCategory.PEOPLE,
  "infobox military person": LoreCategory.PEOPLE,
  "infobox royalty": LoreCategory.PEOPLE,
  "infobox noble": LoreCategory.PEOPLE,
  "infobox biography": LoreCategory.PEOPLE,
  "infobox artist": LoreCategory.PEOPLE,
  "infobox writer": LoreCategory.PEOPLE,
  "infobox scientist": LoreCategory.PEOPLE,
  "infobox academic": LoreCategory.PEOPLE,
  "infobox chancellor": LoreCategory.PEOPLE,
  "infobox governor": LoreCategory.PEOPLE,
  "infobox mayor": LoreCategory.PEOPLE,

  // MILITARY
  "infobox military conflict": LoreCategory.MILITARY,
  "infobox war": LoreCategory.MILITARY,
  "infobox battle": LoreCategory.MILITARY,
  "infobox military unit": LoreCategory.MILITARY,
  "infobox weapon": LoreCategory.MILITARY,
  "infobox armed forces": LoreCategory.MILITARY,
  "infobox military installation": LoreCategory.MILITARY,
  "infobox military vehicle": LoreCategory.MILITARY,
  "infobox ship": LoreCategory.MILITARY,
  "infobox firearm": LoreCategory.MILITARY,
  "infobox civilian attack": LoreCategory.MILITARY,
  "infobox siege": LoreCategory.MILITARY,

  // DIPLOMACY
  "infobox treaty": LoreCategory.DIPLOMACY,
  "infobox bilateral relations": LoreCategory.DIPLOMACY,
  "infobox diplomatic mission": LoreCategory.DIPLOMACY,
  "infobox international organization": LoreCategory.DIPLOMACY,
  "infobox summit": LoreCategory.DIPLOMACY,
  "infobox accord": LoreCategory.DIPLOMACY,
  "infobox alliance": LoreCategory.DIPLOMACY,

  // GEOGRAPHY
  "infobox settlement": LoreCategory.GEOGRAPHY,
  "infobox city": LoreCategory.GEOGRAPHY,
  "infobox town": LoreCategory.GEOGRAPHY,
  "infobox village": LoreCategory.GEOGRAPHY,
  "infobox river": LoreCategory.GEOGRAPHY,
  "infobox lake": LoreCategory.GEOGRAPHY,
  "infobox mountain": LoreCategory.GEOGRAPHY,
  "infobox mountain range": LoreCategory.GEOGRAPHY,
  "infobox island": LoreCategory.GEOGRAPHY,
  "infobox archipelago": LoreCategory.GEOGRAPHY,
  "infobox sea": LoreCategory.GEOGRAPHY,
  "infobox ocean": LoreCategory.GEOGRAPHY,
  "infobox valley": LoreCategory.GEOGRAPHY,
  "infobox desert": LoreCategory.GEOGRAPHY,
  "infobox landform": LoreCategory.GEOGRAPHY,
  "infobox protected area": LoreCategory.GEOGRAPHY,
  "infobox park": LoreCategory.GEOGRAPHY,
  "infobox forest": LoreCategory.GEOGRAPHY,
  "infobox bay": LoreCategory.GEOGRAPHY,
  "infobox peninsula": LoreCategory.GEOGRAPHY,

  // RELIGION
  "infobox religious building": LoreCategory.RELIGION,
  "infobox church": LoreCategory.RELIGION,
  "infobox temple": LoreCategory.RELIGION,
  "infobox mosque": LoreCategory.RELIGION,
  "infobox deity": LoreCategory.RELIGION,
  "infobox religion": LoreCategory.RELIGION,
  "infobox religious order": LoreCategory.RELIGION,
  "infobox holy place": LoreCategory.RELIGION,
  "infobox cathedral": LoreCategory.RELIGION,
  "infobox shrine": LoreCategory.RELIGION,

  // GOVERNMENT
  "infobox government agency": LoreCategory.GOVERNMENT,
  "infobox legislature": LoreCategory.GOVERNMENT,
  "infobox parliament": LoreCategory.GOVERNMENT,
  "infobox ministry": LoreCategory.GOVERNMENT,
  "infobox court": LoreCategory.GOVERNMENT,
  "infobox supreme court": LoreCategory.GOVERNMENT,
  "infobox election": LoreCategory.GOVERNMENT,
  "infobox political party": LoreCategory.GOVERNMENT,
  "infobox constitution": LoreCategory.GOVERNMENT,
  "infobox cabinet": LoreCategory.GOVERNMENT,
  "infobox law": LoreCategory.GOVERNMENT,

  // ECONOMY
  "infobox company": LoreCategory.ECONOMY,
  "infobox corporation": LoreCategory.ECONOMY,
  "infobox bank": LoreCategory.ECONOMY,
  "infobox central bank": LoreCategory.ECONOMY,
  "infobox currency": LoreCategory.ECONOMY,
  "infobox stock exchange": LoreCategory.ECONOMY,
  "infobox enterprise": LoreCategory.ECONOMY,
  "infobox industry": LoreCategory.ECONOMY,

  // SCIENCE
  "infobox technology": LoreCategory.SCIENCE,
  "infobox railway": LoreCategory.SCIENCE,
  "infobox train": LoreCategory.SCIENCE,
  "infobox aircraft": LoreCategory.SCIENCE,
  "infobox spacecraft": LoreCategory.SCIENCE,
  "infobox observatory": LoreCategory.SCIENCE,
  "infobox laboratory": LoreCategory.SCIENCE,
  "infobox university": LoreCategory.SCIENCE,
  "infobox school": LoreCategory.SCIENCE,
  "infobox academic institution": LoreCategory.SCIENCE,

  // CULTURE
  "infobox monument": LoreCategory.CULTURE,
  "infobox building": LoreCategory.CULTURE,
  "infobox museum": LoreCategory.CULTURE,
  "infobox artwork": LoreCategory.CULTURE,
  "infobox festival": LoreCategory.CULTURE,
  "infobox national symbol": LoreCategory.CULTURE,
  "infobox regalia": LoreCategory.CULTURE,
  "infobox palace": LoreCategory.CULTURE,
  "infobox castle": LoreCategory.CULTURE,

  // HISTORY
  "infobox historical event": LoreCategory.HISTORY,
  "infobox historical era": LoreCategory.HISTORY,
  "infobox revolution": LoreCategory.HISTORY,
  "infobox crisis": LoreCategory.HISTORY,
  "infobox timeline": LoreCategory.HISTORY,
  "infobox period": LoreCategory.HISTORY,

  // NATION
  "infobox country": LoreCategory.NATION,
  "infobox nation": LoreCategory.NATION,
  "infobox former country": LoreCategory.NATION,
  "infobox sovereign state": LoreCategory.NATION,
  "infobox state": LoreCategory.NATION,
  "infobox subdivision": LoreCategory.NATION,
  "infobox realm": LoreCategory.NATION,

  // SPECIAL
  "infobox artifact": LoreCategory.SPECIAL,
  "infobox relic": LoreCategory.SPECIAL,
  "infobox wonder": LoreCategory.SPECIAL,
  "infobox anomaly": LoreCategory.SPECIAL,
  "infobox mystery": LoreCategory.SPECIAL,
};

/**
 * Tier 2: MediaWiki Category taxonomy regex patterns.
 */
export const CATEGORY_TAXONOMY_PATTERNS: Array<{
  pattern: RegExp;
  category: LoreCategoryType;
}> = [
  // PEOPLE
  { pattern: /\b(?:people|persons|biograph(?:y|ies)|births|deaths|politicians|presidents|prime ministers|monarchs|kings|queens|emperors|leaders|heads of state|generals|admirals|artists|writers|scientists|nobility|royalty)\b/i, category: LoreCategory.PEOPLE },
  
  // MILITARY
  { pattern: /\b(?:military|war(?:s|fare)?|battles?|conflicts?|sieges?|campaigns?|armed forces|arm(?:y|ies)|nav(?:y|al|ies)|air force|regiments?|divisions?|weapons?|operations?)\b/i, category: LoreCategory.MILITARY },
  
  // DIPLOMACY
  { pattern: /\b(?:treat(?:y|ies)|alliances?|diploma(?:cy|tic)|accords?|pacts?|summits?|embass(?:y|ies)|bilateral relations|foreign relations|international organizations?)\b/i, category: LoreCategory.DIPLOMACY },
  
  // GEOGRAPHY
  { pattern: /\b(?:geograph(?:y|ic)|cities|towns|villages|settlements|rivers|lakes|mountains?|ranges?|islands?|archipelago|seas|oceans|valleys|deserts|peninsulas|fjords|landforms?)\b/i, category: LoreCategory.GEOGRAPHY },
  
  // RELIGION
  { pattern: /\b(?:religions?|religious|faiths?|churches|temples?|monasteries|mosques?|cathedrals?|deities|gods|goddesses|mytholog(?:y|ies)|cults?|clergy|priesthood|sacred)\b/i, category: LoreCategory.RELIGION },
  
  // GOVERNMENT
  { pattern: /\b(?:governments?|governance|parliaments?|legislatures?|senates?|ministries|courts?|judiciar(?:y|ies)|elections?|political parties|constitutions?|laws?|statutes?|decrees?)\b/i, category: LoreCategory.GOVERNMENT },
  
  // ECONOMY
  { pattern: /\b(?:econom(?:y|ic|ics)|trade|commerce|finance|financial|banks?|banking|currencies|money|corporations?|companies|markets?|stock exchanges?|enterprises?|tariffs?|treasury)\b/i, category: LoreCategory.ECONOMY },
  
  // SCIENCE
  { pattern: /\b(?:science|scientific|technolog(?:y|ies)|innovations?|railways?|railroads?|aviation|aerospace|spaceflights?|observatories|laboratories|universities|academies|research institutes?|engineering)\b/i, category: LoreCategory.SCIENCE },
  
  // CULTURE
  { pattern: /\b(?:culture|cultural|monuments?|heritage|traditions?|arts?|architecture|palaces?|castles?|museums?|festivals?|landmarks?|folklore|literature|symbols?|regalia|relics?)\b/i, category: LoreCategory.CULTURE },
  
  // HISTORY
  { pattern: /\b(?:history|historical|eras?|epochs?|centur(?:y|ies)|decades?|antiquity|medieval|renaissance|revolutions?|rebellions?|crises|timelines?|annals|chronicles?)\b/i, category: LoreCategory.HISTORY },
  
  // NATION
  { pattern: /\b(?:countries|nations|sovereign states|former countries|realms|dominions|confederations|federations)\b/i, category: LoreCategory.NATION },
  
  // SPECIAL
  { pattern: /\b(?:artifacts?|relics?|wonders of the world|anomalies|mysteries|tomes?|masterpieces?)\b/i, category: LoreCategory.SPECIAL },
];

/**
 * Specificity rank for deterministic tie-breaking.
 * Lower number = more specific domain = wins ties.
 */
const SPECIFICITY_RANK: Record<LoreCategoryType, number> = {
  [LoreCategory.DIPLOMACY]: 1,
  [LoreCategory.MILITARY]: 2,
  [LoreCategory.PEOPLE]: 3,
  [LoreCategory.RELIGION]: 4,
  [LoreCategory.SCIENCE]: 5,
  [LoreCategory.ECONOMY]: 6,
  [LoreCategory.GOVERNMENT]: 7,
  [LoreCategory.CULTURE]: 8,
  [LoreCategory.GEOGRAPHY]: 9,
  [LoreCategory.HISTORY]: 10,
  [LoreCategory.NATION]: 11,
  [LoreCategory.SPECIAL]: 12,
  [LoreCategory.NS_IMPORT]: 99,
};

/**
 * Helper to extract template names from raw wikitext (e.g. {{Infobox person | ...}} -> "infobox person")
 */
export function extractInfoboxTemplatesFromWikitext(wikitext: string): string[] {
  if (!wikitext) return [];
  const matches = wikitext.match(/\{\{\s*([a-zA-Z0-9_\s-]+)(?:\||\}\})/g) || [];
  return matches
    .map((m) =>
      m
        .replace(/^\{\{\s*/, "")
        .replace(/[|}\s]+$/, "")
        .trim()
        .toLowerCase()
    )
    .filter((name) => name.startsWith("infobox") || name.startsWith("template:infobox"));
}

/**
 * Classifies a MediaWiki article into one of the 12 canonical LoreCategory enums.
 */
export function classifyLoreArticle(input: ArticleClassificationInput): LoreCategoryType {
  const scores: Partial<Record<LoreCategoryType, number>> = {};

  function addScore(cat: LoreCategoryType, points: number) {
    scores[cat] = (scores[cat] || 0) + points;
  }

  const rawWikitext = input.text || "";
  const rawTitle = input.title || "";
  
  // 1. Resolve Infobox Templates (Tier 1: 50 pts)
  const infoboxList = input.infoboxes && input.infoboxes.length > 0
    ? input.infoboxes
    : extractInfoboxTemplatesFromWikitext(rawWikitext);

  for (const rawInfobox of infoboxList) {
    const cleanInfobox = rawInfobox.replace(/^template:\s*/i, "").trim().toLowerCase();
    const matchedCategory = INFOBOX_CATEGORY_MAP[cleanInfobox];
    if (matchedCategory) {
      addScore(matchedCategory, 50);
    } else {
      // Check partial match for infoboxes like "infobox settlement/sandbox" or "infobox officeholder 2"
      for (const [boxKey, cat] of Object.entries(INFOBOX_CATEGORY_MAP)) {
        if (cleanInfobox.startsWith(boxKey)) {
          addScore(cat, 45);
          break;
        }
      }
    }
  }

  // 2. Resolve Categories (Tier 2: 10 pts each)
  const categories = input.categories || [];
  for (const catEntry of categories) {
    const catStr = typeof catEntry === "string" ? catEntry : catEntry?.title || "";
    const cleanCat = catStr.replace(/^Category:\s*/i, "").trim();

    for (const tax of CATEGORY_TAXONOMY_PATTERNS) {
      if (tax.pattern.test(cleanCat)) {
        addScore(tax.category, 10);
      }
    }
  }

  // 3. Synonym & NLP Scoring across Title & Lead Section (Tier 3: 1 pt each, max 15)
  const leadSection = rawWikitext.slice(0, 1500).toLowerCase();
  const normalizedTitle = rawTitle.toLowerCase();
  const combinedText = `${normalizedTitle} ${leadSection}`;

  for (const [catStr, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    const cat = catStr as LoreCategoryType;
    if (cat === LoreCategory.NS_IMPORT) continue;

    let synHits = 0;
    for (const word of synonyms) {
      // Title match gives strong weight (5 pts)
      if (normalizedTitle.includes(word)) {
        addScore(cat, 5);
      }

      // Regex whole-word search in lead text
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      const matches = combinedText.match(regex);
      if (matches) {
        synHits += Math.min(matches.length, 3);
      }
    }

    if (synHits > 0) {
      addScore(cat, Math.min(synHits, 15));
    }
  }

  // 4. Determine Winner with Specificity Arbiter
  let highestCategory: LoreCategoryType = LoreCategory.NATION;
  let highestScore = 0;

  for (const [catKey, score] of Object.entries(scores)) {
    const cat = catKey as LoreCategoryType;
    if (!score || score <= 0) continue;

    if (score > highestScore) {
      highestScore = score;
      highestCategory = cat;
    } else if (score === highestScore) {
      // Tie-break with specificity rank
      const currentRank = SPECIFICITY_RANK[highestCategory] ?? 99;
      const contenderRank = SPECIFICITY_RANK[cat] ?? 99;
      if (contenderRank < currentRank) {
        highestCategory = cat;
      }
    }
  }

  // If no signals scored at all, default to NATION
  return highestScore > 0 ? highestCategory : LoreCategory.NATION;
}

/**
 * Fast one-line classification helper from wikitext string.
 */
export function classifyFromWikitext(
  wikitext: string | null | undefined,
  title?: string | null,
  categories?: string[]
): LoreCategoryType {
  return classifyLoreArticle({
    text: wikitext,
    title,
    categories,
  });
}

/**
 * The tables from a wiki's infobox templates and categories to a lore category and subcategory (client-safe).
 *
 * The classifier (`category-classifier.ts`) scores these; the categories backfill reports what they miss. Inside one
 * lore category the first matching rule names the subcategory, so a narrower rule comes before a broader one. A
 * country is a Nation card: Geography has no country subcategory, and "Geography of X" is Geography with none.
 */

import type { CardWikiSource } from "./card-sources";
import type { LoreCategory } from "./category-enums";

export interface CategoryTarget {
  category: LoreCategory;
  subcategory?: string;
}

/** An infobox's target; `fallback` marks a subcategory it only defaults to, which any other signal's beats. */
export interface InfoboxTarget extends CategoryTarget {
  fallback?: true;
}

export interface CategoryRule extends CategoryTarget {
  pattern: RegExp;
}

const target = (category: LoreCategory, subcategory: string | null): CategoryTarget =>
  subcategory === null ? { category } : { category, subcategory };

/** `infobox <name>` keys for each name, all to one target. */
const boxes = (category: LoreCategory, subcategory: string | null, ...names: string[]) =>
  names.map((name) => [`infobox ${name}`, target(category, subcategory)] as const);

/** Boxes that serve more than their subcategory: Infobox settlement also a state, Infobox military unit a navy. */
const fallbackBoxes = (category: LoreCategory, subcategory: string, ...names: string[]) =>
  names.map((name) => [`infobox ${name}`, { category, subcategory, fallback: true }] as const);

/** Infobox template names (lower case, spaces) to their target. */
export const INFOBOX_RULES: Readonly<Record<string, InfoboxTarget>> = Object.fromEntries([
  ...boxes("PEOPLE", "politician", "officeholder", "politician", "prime minister", "president"),
  ...boxes("PEOPLE", "politician", "chancellor", "governor", "mayor"),
  ...boxes("PEOPLE", "ruler-or-royal", "monarch", "royalty", "noble"),
  ...boxes("PEOPLE", "military-figure", "military person"),
  ...boxes("PEOPLE", "artist-or-writer", "artist", "writer"),
  ...boxes("PEOPLE", "scientist", "scientist", "academic"),
  ...boxes("PEOPLE", "family-or-dynasty", "royal house"),
  ...boxes("PEOPLE", null, "person", "biography", "leader"),

  ...boxes("MILITARY", "battle-or-war", "military conflict", "war", "battle", "siege"),
  ...boxes("MILITARY", "battle-or-war", "civilian attack"),
  ...fallbackBoxes("MILITARY", "unit", "military unit"),
  ...boxes("MILITARY", "weapon-or-vehicle", "weapon", "firearm", "military vehicle", "ship"),
  ...boxes("MILITARY", "weapon-or-vehicle", "ship begin", "aircraft", "aircraft begin"),
  ...boxes("MILITARY", "weapon-or-vehicle", "aircraft type", "military aircraft"),
  ...boxes("MILITARY", "army", "army"),
  ...boxes("MILITARY", "navy", "navy"),
  ...boxes("MILITARY", "air-force", "air force"),
  ...boxes("MILITARY", null, "armed forces", "national military", "military installation"),

  ...boxes("DIPLOMACY", "treaty", "treaty", "accord"),
  ...boxes("DIPLOMACY", "alliance-or-organisation", "international organization", "alliance"),
  ...boxes("DIPLOMACY", "embassy-or-envoy", "diplomatic mission"),
  ...boxes("DIPLOMACY", "conference", "summit"),
  ...boxes("DIPLOMACY", null, "bilateral relations"),

  ...boxes("GEOGRAPHY", "region-or-province", "subdivision"),
  ...fallbackBoxes("GEOGRAPHY", "city-or-settlement", "settlement"),
  ...boxes("GEOGRAPHY", "city-or-settlement", "city", "town", "village"),
  ...boxes("GEOGRAPHY", "river-lake-or-sea", "river", "lake", "sea", "ocean", "bay"),
  ...boxes("GEOGRAPHY", "mountain-or-island", "mountain", "mountain range", "island"),
  ...boxes("GEOGRAPHY", "mountain-or-island", "archipelago", "peninsula", "landform"),
  ...boxes("GEOGRAPHY", "landmark", "protected area", "park", "national park"),
  ...boxes("GEOGRAPHY", null, "valley", "desert", "forest"),

  ...boxes("RELIGION", "faith", "religion", "deity"),
  ...boxes("RELIGION", "holy-site", "religious building", "church", "temple", "mosque"),
  ...boxes("RELIGION", "holy-site", "cathedral", "shrine", "holy place"),
  ...boxes("RELIGION", "order-or-sect", "religious order"),
  ...boxes("RELIGION", "clergy", "clergy"),

  ...boxes("GOVERNMENT", "agency-or-ministry", "government agency", "ministry"),
  ...boxes("GOVERNMENT", "agency-or-ministry", "law enforcement agency"),
  ...boxes("GOVERNMENT", "legislature-or-body", "legislature", "parliament", "cabinet"),
  ...boxes("GOVERNMENT", "legislature-or-body", "court", "supreme court"),
  ...boxes("GOVERNMENT", "party", "political party"),
  ...boxes("GOVERNMENT", "constitution-or-law", "constitution", "law", "court case"),
  ...boxes("GOVERNMENT", "office-or-post", "official post"),
  ...boxes("GOVERNMENT", null, "election"),

  ...boxes("ECONOMY", "company", "company", "corporation", "enterprise"),
  ...boxes("ECONOMY", "currency-or-bank", "bank", "central bank", "currency"),
  ...boxes("ECONOMY", "trade-route-or-market", "stock exchange"),
  ...boxes("ECONOMY", "industry", "industry"),

  ...boxes("SCIENCE", "technology", "technology", "railway", "train", "spacecraft"),
  ...boxes("SCIENCE", "institution", "observatory", "laboratory", "university", "school"),
  ...boxes("SCIENCE", "institution", "academic institution"),

  ...boxes("CULTURE", "art-or-literature", "artwork", "book"),
  ...boxes("CULTURE", "festival-or-tradition", "festival"),
  ...boxes("CULTURE", "language", "language"),
  ...boxes("CULTURE", "sport", "sports team", "football club", "national football team"),
  ...boxes("CULTURE", "sport", "olympic games"),
  ...boxes("CULTURE", "media", "newspaper", "television", "broadcasting network", "film"),
  ...boxes("CULTURE", "music", "musical artist", "album", "anthem"),
  ...boxes("CULTURE", null, "monument", "building", "museum", "national symbol", "regalia"),
  ...boxes("CULTURE", null, "palace", "castle"),

  ...boxes("HISTORY", "event", "historical event", "revolution", "crisis"),
  ...boxes("HISTORY", "era-or-period", "historical era", "period", "timeline"),
  ...boxes("HISTORY", "document", "document"),

  ...boxes("NATION", "nation", "country", "nation", "sovereign state", "realm", "state"),
  ...boxes("NATION", "former-state", "former country"),

  ...boxes("SPECIAL", null, "artifact", "relic", "wonder", "anomaly", "mystery"),
]);

const INFOBOX_ENTRIES = Object.entries(INFOBOX_RULES);
const INFOBOX_BY_KEY = new Map(INFOBOX_ENTRIES);

/** What may follow a known infobox name in a variant of it: a number, a bracket or a subpage ("/status"). */
const INFOBOX_VARIANT_SUFFIX = /^(?:\s*\d+|\s*\(.*\)|\/.*)$/;

const rule = (
  category: LoreCategory,
  subcategory: string | null,
  pattern: RegExp
): CategoryRule => ({
  ...target(category, subcategory),
  pattern,
});

/** Category rules every wiki shares, narrower before broader inside each lore category. */
export const SHARED_CATEGORY_RULES: readonly CategoryRule[] = [
  rule(
    "PEOPLE",
    "family-or-dynasty",
    /\b(?:(?:royal|noble) (?:houses?|famil(?:y|ies))|dynast(?:y|ies))\b/i
  ),
  rule(
    "PEOPLE",
    "ruler-or-royal",
    /\b(?:monarchs|kings|queens|emperors|empresses|royalty|nobility|nobles|princes|princesses|dukes|rulers)\b/i
  ),
  rule(
    "PEOPLE",
    "politician",
    /\b(?:politicians|presidents|prime ministers|chancellors|governors|mayors|officeholders|statesmen|ministers)\b/i
  ),
  rule(
    "PEOPLE",
    "military-figure",
    /\b(?:generals|admirals|military personnel|military leaders|soldiers)\b/i
  ),
  rule(
    "PEOPLE",
    "religious-figure",
    /\b(?:popes|saints|bishops|archbishops|cardinals|religious leaders)\b/i
  ),
  rule(
    "PEOPLE",
    "artist-or-writer",
    /\b(?:artists|writers|authors|poets|painters|musicians|composers|novelists|playwrights|singers|actors|dancers)\b/i
  ),
  rule(
    "PEOPLE",
    "scientist",
    /\b(?:scientists|academics|inventors|engineers|philosophers|scholars)\b/i
  ),
  rule(
    "PEOPLE",
    null,
    /\b(?:people|persons|biograph(?:y|ies)|births|deaths|leaders|heads of state|generals|admirals|royalty)\b/i
  ),

  rule(
    "MILITARY",
    "battle-or-war",
    /\b(?:battles?|wars?|conflicts?|sieges?|campaigns?|military operations|invasions?|skirmishes)\b/i
  ),
  rule(
    "MILITARY",
    "weapon-or-vehicle",
    /\b(?:weapons?|weaponry|firearms?|warships?|ships|tanks|military vehicles|missiles?|artillery|submarines?|rifles?)\b/i
  ),
  rule(
    "MILITARY",
    "unit",
    /\b(?:(?:military|army|naval) units?|regiments?|brigades?|battalions?|squadrons?|(?:army|infantry|armou?red) (?:divisions?|corps))\b/i
  ),
  rule("MILITARY", "army", /\b(?:arm(?:y|ies)|land forces|ground forces)\b/i),
  rule("MILITARY", "navy", /\b(?:nav(?:y|ies|al)|fleets?)\b/i),
  rule("MILITARY", "air-force", /\b(?:air forces?|air wings?)\b/i),
  rule("MILITARY", null, /\b(?:military|warfare|armed forces|operations?)\b/i),

  rule("DIPLOMACY", "treaty", /\b(?:treat(?:y|ies)|accords?|pacts?|agreements?)\b/i),
  rule(
    "DIPLOMACY",
    "alliance-or-organisation",
    /\b(?:alliances?|(?:international|intergovernmental) organi[sz]ations?|coalitions?)\b/i
  ),
  rule(
    "DIPLOMACY",
    "embassy-or-envoy",
    /\b(?:embass(?:y|ies)|diplomatic missions?|consulates?|ambassadors?|envoys?|diplomats)\b/i
  ),
  rule("DIPLOMACY", "conference", /\b(?:summits?|conferences?)\b/i),
  rule("DIPLOMACY", null, /\b(?:diploma(?:cy|tic)|bilateral relations|foreign relations)\b/i),

  rule(
    "GEOGRAPHY",
    "mountain-or-island",
    /\b(?:islands?|archipelagos?|mountains?|mountain ranges|ranges|peninsulas?|volcano(?:e)?s|hills|plateaus?)\b/i
  ),
  rule(
    "GEOGRAPHY",
    "river-lake-or-sea",
    /\b(?:rivers?|lakes?|seas?|oceans?|bays?|gulfs?|straits?|fjords?|waterways|canals?)\b/i
  ),
  rule(
    "GEOGRAPHY",
    "city-or-settlement",
    /\b(?:cities|towns|villages|settlements|capitals|municipalities|communes|populated places)\b/i
  ),
  rule(
    "GEOGRAPHY",
    "landmark",
    /\b(?:landmarks?|protected areas?|national parks?|parks|nature reserves?)\b/i
  ),
  rule(
    "GEOGRAPHY",
    "region-or-province",
    /\b(?:regions|provinces|administrative divisions|subdivisions|territories|counties|districts|prefectures)\b/i
  ),
  rule("GEOGRAPHY", null, /\b(?:geograph(?:y|ic)|valleys|deserts|forests|landforms?)\b/i),

  rule(
    "RELIGION",
    "holy-site",
    /\b(?:churches|cathedrals?|temples?|mosques?|shrines?|monaster(?:y|ies)|abbeys?|basilicas?|chapels?|holy (?:sites|places))\b/i
  ),
  rule(
    "RELIGION",
    "order-or-sect",
    /\b(?:(?:religious|monastic) orders?|sects?|denominations?|cults?)\b/i
  ),
  rule("RELIGION", "clergy", /\b(?:clergy|priesthood|clerics)\b/i),
  rule(
    "RELIGION",
    "faith",
    /\b(?:religions?|faiths?|deities|gods|goddesses|theology|mytholog(?:y|ies)|pantheons?)\b/i
  ),
  rule("RELIGION", null, /\b(?:religious|sacred)\b/i),

  rule("CULTURE", "language", /\b(?:languages?|dialects?|alphabets?|linguistics)\b/i),
  rule("CULTURE", "sport", /\b(?:sports?|football|soccer|clubs|athletes|olympics?|stadiums?)\b/i),
  rule(
    "CULTURE",
    "media",
    /\b(?:newspapers?|television|radio|media|broadcasters?|broadcasting|magazines?|films?|journalism)\b/i
  ),
  rule("CULTURE", "music", /\b(?:music(?:al)?|albums?|songs?|bands|anthems?)\b/i),
  rule(
    "CULTURE",
    "art-or-literature",
    /\b(?:arts?|artworks?|paintings?|sculptures?|literature|books|novels|poetry)\b/i
  ),
  rule(
    "CULTURE",
    "festival-or-tradition",
    /\b(?:festivals?|holidays?|traditions?|customs|folklore|celebrations?|ceremon(?:y|ies)|cuisine)\b/i
  ),
  rule(
    "CULTURE",
    null,
    /\b(?:culture|cultural|monuments?|heritage|architecture|palaces?|castles?|museums?|landmarks?|symbols?|regalia|relics?)\b/i
  ),

  rule("GOVERNMENT", "party", /\bpolitical (?:parties|party|movements?)\b/i),
  rule(
    "GOVERNMENT",
    "legislature-or-body",
    /\b(?:legislatures?|parliaments?|senates?|assembl(?:y|ies)|councils?|cabinets?|courts?|judiciar(?:y|ies))\b/i
  ),
  rule(
    "GOVERNMENT",
    "agency-or-ministry",
    /\b(?:ministr(?:y|ies)|government agencies|agencies|government departments|intelligence services?)\b/i
  ),
  rule(
    "GOVERNMENT",
    "constitution-or-law",
    /\b(?:constitutions?|laws?|legislation|statutes?|decrees?)\b/i
  ),
  rule(
    "GOVERNMENT",
    "office-or-post",
    /\b(?:government (?:offices|positions)|political offices|official posts)\b/i
  ),
  rule("GOVERNMENT", null, /\b(?:governments?|governance|elections?)\b/i),

  rule(
    "ECONOMY",
    "company",
    /\b(?:compan(?:y|ies)|corporations?|enterprises?|businesses|conglomerates?|manufacturers|airlines?)\b/i
  ),
  rule(
    "ECONOMY",
    "currency-or-bank",
    /\b(?:currenc(?:y|ies)|banks?|banking|money|coins|financial institutions)\b/i
  ),
  rule(
    "ECONOMY",
    "trade-route-or-market",
    /\b(?:stock exchanges?|markets?|trade routes?|trade|commerce|ports)\b/i
  ),
  rule("ECONOMY", "industry", /\b(?:industr(?:y|ies)|mining|agriculture|manufacturing)\b/i),
  rule("ECONOMY", null, /\b(?:econom(?:y|ic|ics)|finance|financial|tariffs?|treasury)\b/i),

  rule(
    "SCIENCE",
    "institution",
    /\b(?:universit(?:y|ies)|colleges?|schools?|academies|observator(?:y|ies)|laborator(?:y|ies)|research institutes?)\b/i
  ),
  rule("SCIENCE", "discovery", /\b(?:discoveries|inventions?|expeditions?)\b/i),
  rule(
    "SCIENCE",
    "technology",
    /\b(?:technolog(?:y|ies)|innovations?|railways?|railroads?|trains|aviation|aerospace|spaceflights?|spacecraft|rockets?|engineering)\b/i
  ),
  rule("SCIENCE", null, /\b(?:science|scientific)\b/i),

  rule(
    "HISTORY",
    "era-or-period",
    /\b(?:eras?|epochs?|periods?|centur(?:y|ies)|decades?|antiquity|medieval|renaissance|timelines?)\b/i
  ),
  rule(
    "HISTORY",
    "event",
    /\b(?:historical events|revolutions?|rebellions?|crises|crisis|disasters?|massacres?|coups?|uprisings?)\b/i
  ),
  rule(
    "HISTORY",
    "document",
    /\b(?:historical documents|manuscripts?|charters?|declarations?|proclamations?)\b/i
  ),
  // A historical country is a Nation card, not a History one.
  rule(
    "HISTORY",
    null,
    /\b(?:history|historical(?! (?:countries|states|nations))|annals|chronicles?)\b/i
  ),

  rule(
    "NATION",
    "former-state",
    /\b(?:(?:historical|former|defunct) (?:countries|states|nations))\b/i
  ),
  rule(
    "NATION",
    "nation",
    /\b(?:countries|nations|sovereign states|realms|dominions|confederations|federations)\b/i
  ),

  rule(
    "SPECIAL",
    null,
    /\b(?:artifacts?|relics?|wonders of the world|anomalies|mysteries|tomes?|masterpieces?)\b/i
  ),
];

/**
 * The community wikis' shared conventions: a nation's security or defence force (its whole armed forces, so no
 * subcategory: "Army of" beside it names one), its federal subjects.
 */
const COMMUNITY_RULES: readonly CategoryRule[] = [
  rule("MILITARY", null, /\b(?:security|defen[cs]e) forces?\b/i),
  rule("GEOGRAPHY", "region-or-province", /\bfederal subjects\b/i),
  rule("GOVERNMENT", null, /^politics$/i),
  rule("CULTURE", null, /^ethnic groups\b/i),
];

/** Each wiki's own category conventions, read before the shared rules. */
export const WIKI_CATEGORY_RULES: Partial<Record<CardWikiSource, readonly CategoryRule[]>> = {
  ixwiki: [
    rule("GEOGRAPHY", "region-or-province", /\b(?:subdivisions|estates|states) of\b/i),
    rule("NATION", "nation", /\bnpc countries\b/i),
    rule("ECONOMY", "company", /\bbrands\b/i),
    ...COMMUNITY_RULES,
  ],
  iiwiki: [rule("GEOGRAPHY", "region-or-province", /\bstates of\b/i), ...COMMUNITY_RULES],
  althistory: [rule("HISTORY", "era-or-period", /\btimelines\b/i)],
  commons: [rule("NATION", "nation", /\b(?:flags|coats of arms|banners) of\b/i)],
};

/** Maintenance and project categories, which say nothing about what an article is. */
export const IGNORED_CATEGORY =
  /award winning pages|incomplete articles|\bpages (?:with|using)\b|\barticles (?:with|using|needing|requiring)\b|canonical article|\bnon-?canon|graphics requested|map completion project|\bstubs?\b|cleanup|\bmiscellaneous\b|common core|hidden categories/i;

/** A template's lookup key: no `Template:`, spaces for underscores, lower case ("infobox country"). */
export function templateKey(raw: string): string {
  return raw
    .replace(/^\s*template\s*:/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** An infobox's target: by its exact name, else as a variant of a known name (`INFOBOX_VARIANT_SUFFIX`); null when none. */
export function infoboxTarget(template: string): { target: InfoboxTarget; exact: boolean } | null {
  const key = templateKey(template);
  const exact = INFOBOX_BY_KEY.get(key);
  if (exact) return { target: exact, exact: true };
  const variant = INFOBOX_ENTRIES.find(
    ([known]) => key.startsWith(known) && INFOBOX_VARIANT_SUFFIX.test(key.slice(known.length))
  );
  return variant ? { target: variant[1], exact: false } : null;
}

const categoryKey = (name: string) => name.replace(/^\s*category\s*:/i, "").trim();

/** The IxWiki maintenance category of lore its authors gave up on: such an article is not a card. */
const ABANDONED_LORE = "abandoned lore";

/** Whether an article's categories (`Category:` or not, `{ title }` or a name) include Abandoned Lore, in any case. */
export function isAbandonedLore(categories: ReadonlyArray<string | { title: string }>): boolean {
  return categories.some(
    (entry) =>
      categoryKey(typeof entry === "string" ? entry : entry.title)
        .replace(/_/g, " ")
        .toLowerCase() === ABANDONED_LORE
  );
}

/**
 * Every lore category a wiki category names, each with the subcategory of its first matching rule (the wiki's own
 * rules first); none for a maintenance category.
 */
export function categoryTargets(name: string, source: CardWikiSource | null): CategoryTarget[] {
  const key = categoryKey(name);
  if (key === "" || IGNORED_CATEGORY.test(key)) return [];
  const rules = [...((source && WIKI_CATEGORY_RULES[source]) ?? []), ...SHARED_CATEGORY_RULES];
  const byCategory = new Map<LoreCategory, CategoryTarget>();
  for (const { pattern, ...found } of rules) {
    if (!byCategory.has(found.category) && pattern.test(key)) byCategory.set(found.category, found);
  }
  return [...byCategory.values()];
}

/** The categories (without `Category:`, once each) that are neither read nor ignored: the backfill report's gaps. */
export function unmappedCategories(
  names: readonly string[],
  source: CardWikiSource | null
): string[] {
  const keys = new Set(names.map(categoryKey));
  return [...keys].filter(
    (key) => key !== "" && !IGNORED_CATEGORY.test(key) && categoryTargets(key, source).length === 0
  );
}

/** The infoboxes (by key, once each) no rule reads; other templates are not infoboxes and are left out. */
export function unmappedInfoboxes(templates: readonly string[]): string[] {
  const keys = new Set(templates.map(templateKey));
  return [...keys].filter((key) => key.startsWith("infobox") && infoboxTarget(key) === null);
}

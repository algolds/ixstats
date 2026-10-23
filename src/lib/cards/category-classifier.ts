/**
 * Lore article classifier: a wiki article's lore category, subcategory and confidence (client-safe).
 *
 * Signals, each with a strength (`SIGNAL_STRENGTH`) for its lore category:
 *   - infobox templates, from the raw wikitext and the wiki API's template list (`INFOBOX_RULES`);
 *   - the wiki's own categories (`categoryTargets`, the shared and per-wiki rules in `category-mappings.ts`);
 *   - keywords in the title and the lead (`CATEGORY_SYNONYMS`), which name no subcategory.
 *
 * A category's support is its signals combined, 1 - the product of (1 - strength). The highest support wins, ties
 * broken by specificity (DIPLOMACY / MILITARY / PEOPLE / RELIGION / SCIENCE / ECONOMY > GOVERNMENT / CULTURE >
 * GEOGRAPHY / HISTORY > NATION > SPECIAL). Nothing scored is `category: null`, never a guess: such a card waits in the
 * admin's review queue, as does one below `CATEGORY_REVIEW_THRESHOLD`.
 */

import type { CardWikiSource } from "./card-sources";
import { CATEGORY_SYNONYMS, type LoreCategory } from "./category-enums";
import {
  categoryTargets,
  infoboxTarget,
  templateKey,
  type InfoboxTarget,
} from "./category-mappings";
import { subcategoriesOf } from "./category-taxonomy";

export interface ArticleClassificationInput {
  title?: string | null;
  /** Plain article text (an extract or cleaned wikitext); its lead is read for keywords. */
  text?: string | null;
  /** The raw wikitext, read for infobox templates. */
  wikitext?: string | null;
  categories?: ReadonlyArray<string | { title: string }> | null;
  /** Template titles the wiki API lists for the page; only infoboxes count. */
  templates?: readonly string[] | null;
  source?: CardWikiSource | null;
}

export interface CategoryClassification {
  category: LoreCategory | null;
  subcategory: string | null;
  confidence: number;
}

/** How sure one signal is, on its own, that the article is its lore category (0 to 1). */
export const SIGNAL_STRENGTH = {
  infobox: 0.9,
  infoboxVariant: 0.7,
  category: 0.5,
  keywordsMax: 0.25,
} as const;

/** Keyword points: each title keyword, and each lead hit up to a cap; FULL_KEYWORD_POINTS earn `keywordsMax`. */
const KEYWORD_POINTS = { titleKeyword: 5, leadKeywordsMax: 15 } as const;
const FULL_KEYWORD_POINTS = 20;

/** Below this confidence a classification waits for review. Provisional: the backfill's dry run sets it. */
export const CATEGORY_REVIEW_THRESHOLD = 0.45;

/** How much of the text counts as its lead. */
const LEAD_CHARS = 1500;
/** Hits one keyword may add from the lead. */
const MAX_HITS_PER_KEYWORD = 3;

/** Lower wins a tie. */
const SPECIFICITY_RANK: Record<LoreCategory, number> = {
  DIPLOMACY: 1,
  MILITARY: 2,
  PEOPLE: 3,
  RELIGION: 4,
  SCIENCE: 5,
  ECONOMY: 6,
  GOVERNMENT: 7,
  CULTURE: 8,
  GEOGRAPHY: 9,
  HISTORY: 10,
  NATION: 11,
  SPECIAL: 12,
};

interface SignalHit {
  category: LoreCategory;
  subcategory: string | null;
  strength: number;
  /** The subcategory is only a default, which any other signal's beats. */
  fallback: boolean;
}

const hit = ({ category, subcategory, fallback }: InfoboxTarget, strength: number): SignalHit => ({
  category,
  subcategory: subcategory ?? null,
  strength,
  fallback: fallback === true,
});

/** Each key's signals combined: 1 - the product of (1 - strength). */
function supportBy<K>(hits: readonly SignalHit[], keyOf: (h: SignalHit) => K): Map<K, number> {
  const doubt = new Map<K, number>();
  for (const h of hits) doubt.set(keyOf(h), (doubt.get(keyOf(h)) ?? 1) * (1 - h.strength));
  return new Map([...doubt].map(([key, d]) => [key, 1 - d]));
}

const escapeRegExp = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Each category's keywords as whole-word patterns, compiled once. */
const KEYWORDS = (
  Object.entries(CATEGORY_SYNONYMS) as Array<[LoreCategory, readonly string[]]>
).map(([category, words]) => ({
  category,
  patterns: words.map((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi")),
}));

/** Template names in wikitext (`{{Infobox person | ...}}` is "Infobox person"). */
function wikitextTemplates(wikitext: string): string[] {
  return [...wikitext.matchAll(/\{\{\s*([\w\s:-]+)(?:\||\}\})/g)].map((m) => m[1] ?? "");
}

function infoboxHits(input: ArticleClassificationInput): SignalHit[] {
  const names = new Set(
    [...(input.templates ?? []), ...wikitextTemplates(input.wikitext ?? "")].map(templateKey)
  );
  return [...names].flatMap((name) => {
    const match = infoboxTarget(name);
    if (!match) return [];
    const strength = match.exact ? SIGNAL_STRENGTH.infobox : SIGNAL_STRENGTH.infoboxVariant;
    return [hit(match.target, strength)];
  });
}

function categoryHits(input: ArticleClassificationInput): SignalHit[] {
  return (input.categories ?? []).flatMap((entry) =>
    categoryTargets(typeof entry === "string" ? entry : entry.title, input.source ?? null).map(
      (found) => hit(found, SIGNAL_STRENGTH.category)
    )
  );
}

/** Whole-word keywords: each in the title scores, lead hits (title included) are capped per keyword and per category. */
function keywordHits(input: ArticleClassificationInput): SignalHit[] {
  const title = (input.title ?? "").toLowerCase();
  const combined = `${title} ${(input.text ?? "").slice(0, LEAD_CHARS).toLowerCase()}`;
  return KEYWORDS.flatMap(({ category, patterns }) => {
    let titlePoints = 0;
    let leadHits = 0;
    for (const pattern of patterns) {
      if (title.search(pattern) >= 0) titlePoints += KEYWORD_POINTS.titleKeyword;
      leadHits += Math.min(combined.match(pattern)?.length ?? 0, MAX_HITS_PER_KEYWORD);
    }
    const points = titlePoints + Math.min(leadHits, KEYWORD_POINTS.leadKeywordsMax);
    const strength = SIGNAL_STRENGTH.keywordsMax * Math.min(1, points / FULL_KEYWORD_POINTS);
    return points > 0 ? [{ category, subcategory: null, strength, fallback: false }] : [];
  });
}

/** Categories by support, highest first, ties by specificity. */
function ranked(support: Map<LoreCategory, number>): Array<[LoreCategory, number]> {
  return [...support].sort(
    ([a, scoreA], [b, scoreB]) => scoreB - scoreA || SPECIFICITY_RANK[a] - SPECIFICITY_RANK[b]
  );
}

/**
 * The winner's subcategory with the most support, ties to the first the taxonomy lists; a fallback only when no other
 * signal names one; null when none scored.
 */
function subcategoryOf(winner: LoreCategory, hits: readonly SignalHit[]): string | null {
  const named = hits.filter((h) => h.category === winner && h.subcategory !== null);
  const firm = named.filter((h) => !h.fallback);
  const support = supportBy(firm.length > 0 ? firm : named, (h) => h.subcategory);
  let best: string | null = null;
  let bestSupport = 0;
  for (const { id } of subcategoriesOf(winner)) {
    const s = support.get(id) ?? 0;
    if (s > bestSupport) [best, bestSupport] = [id, s];
  }
  return best;
}

/** The winner's support, discounted by how near the runner-up comes: a tie is 0, a distant one costs little. */
function confidenceOf(top: number, second: number): number {
  return Math.round(top * (1 - (second / top) ** 2) * 100) / 100;
}

/** An article's lore category, subcategory and confidence; `category: null` when nothing scored. */
export function classifyLoreArticle(input: ArticleClassificationInput): CategoryClassification {
  const hits = [...infoboxHits(input), ...categoryHits(input), ...keywordHits(input)];
  const [first, runnerUp] = ranked(supportBy(hits, (h) => h.category));
  if (!first) return { category: null, subcategory: null, confidence: 0 };
  const [category, top] = first;
  return {
    category,
    subcategory: subcategoryOf(category, hits),
    confidence: confidenceOf(top, runnerUp?.[1] ?? 0),
  };
}

export function needsCategoryReview(c: CategoryClassification): boolean {
  return c.category === null || c.confidence < CATEGORY_REVIEW_THRESHOLD;
}

/** The card columns a classification writes, for the importer and the backfill alike. */
export interface ClassifierColumns {
  category: LoreCategory | null;
  subcategory: string | null;
  categorySource: "CLASSIFIER";
  categoryConfidence: number;
  categoryNeedsReview: boolean;
}

export function classifierColumns(c: CategoryClassification): ClassifierColumns {
  return {
    category: c.category,
    subcategory: c.subcategory,
    categorySource: "CLASSIFIER",
    categoryConfidence: c.confidence,
    categoryNeedsReview: needsCategoryReview(c),
  };
}

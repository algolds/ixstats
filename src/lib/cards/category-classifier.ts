/**
 * Lore article classifier: a wiki article's lore category, subcategory and confidence (client-safe).
 *
 * Signals, scored per lore category (`CLASSIFIER_WEIGHTS`):
 *   - infobox templates, from the raw wikitext and the wiki API's template list (`INFOBOX_RULES`);
 *   - the wiki's own categories (`categoryTargets`, the shared and per-wiki rules in `category-mappings.ts`);
 *   - keywords in the title and the lead (`CATEGORY_SYNONYMS`), which name no subcategory.
 *
 * The highest total wins, ties broken by specificity (DIPLOMACY / MILITARY / PEOPLE / RELIGION / SCIENCE / ECONOMY >
 * GOVERNMENT / CULTURE > GEOGRAPHY / HISTORY > NATION > SPECIAL). Nothing scored is `category: null`, never a guess:
 * such a card waits in the admin's review queue, as does one below `CATEGORY_REVIEW_THRESHOLD`.
 */

import type { CardWikiSource } from "./card-sources";
import { CATEGORY_SYNONYMS, type LoreCategory } from "./category-enums";
import {
  categoryTargets,
  infoboxTarget,
  templateKey,
  type CategoryTarget,
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

export const CLASSIFIER_WEIGHTS = {
  infobox: 50,
  infoboxPrefix: 45,
  category: 10,
  titleKeyword: 5,
  leadKeywordsMax: 15,
} as const;

/** The winning total at which confidence stops rising (an infobox and one category). */
export const FULL_CONFIDENCE_SCORE = 60;

/** Below this confidence a classification waits for review. Provisional: the backfill's dry run sets it. */
export const CATEGORY_REVIEW_THRESHOLD = 0.5;

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
  points: number;
}

const hit = ({ category, subcategory }: CategoryTarget, points: number): SignalHit => ({
  category,
  subcategory: subcategory ?? null,
  points,
});

const escapeRegExp = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Each category's keywords with their whole-word pattern, compiled once. */
const KEYWORDS = (
  Object.entries(CATEGORY_SYNONYMS) as Array<[LoreCategory, readonly string[]]>
).map(([category, words]) => ({
  category,
  words: words.map((word) => ({ word, pattern: new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi") })),
}));

/** Template names in wikitext (`{{Infobox person | ...}}` is "Infobox person"). */
function wikitextTemplates(wikitext: string): string[] {
  return [...wikitext.matchAll(/\{\{\s*([\w\s:-]+)(?:\||\}\})/g)].map((m) => m[1] ?? "");
}

function infoboxHits(input: ArticleClassificationInput): SignalHit[] {
  const names = new Set(
    [...(input.templates ?? []), ...wikitextTemplates(input.wikitext ?? "")]
      .map(templateKey)
      .filter((name) => name.startsWith("infobox"))
  );
  return [...names].flatMap((name) => {
    const match = infoboxTarget(name);
    if (!match) return [];
    const points = match.exact ? CLASSIFIER_WEIGHTS.infobox : CLASSIFIER_WEIGHTS.infoboxPrefix;
    return [hit(match.target, points)];
  });
}

function categoryHits(input: ArticleClassificationInput): SignalHit[] {
  return (input.categories ?? []).flatMap((entry) =>
    categoryTargets(typeof entry === "string" ? entry : entry.title, input.source ?? null).map(
      (found) => hit(found, CLASSIFIER_WEIGHTS.category)
    )
  );
}

/** Title keywords score each; lead hits (title included) are capped per keyword and per category. */
function keywordHits(input: ArticleClassificationInput): SignalHit[] {
  const title = (input.title ?? "").toLowerCase();
  const combined = `${title} ${(input.text ?? "").slice(0, LEAD_CHARS).toLowerCase()}`;
  return KEYWORDS.flatMap(({ category, words }) => {
    let titlePoints = 0;
    let leadHits = 0;
    for (const { word, pattern } of words) {
      if (title.includes(word)) titlePoints += CLASSIFIER_WEIGHTS.titleKeyword;
      leadHits += Math.min(combined.match(pattern)?.length ?? 0, MAX_HITS_PER_KEYWORD);
    }
    const points = titlePoints + Math.min(leadHits, CLASSIFIER_WEIGHTS.leadKeywordsMax);
    return points > 0 ? [{ category, subcategory: null, points }] : [];
  });
}

function totalsOf(hits: readonly SignalHit[]): Map<LoreCategory, number> {
  const totals = new Map<LoreCategory, number>();
  for (const { category, points } of hits) {
    totals.set(category, (totals.get(category) ?? 0) + points);
  }
  return totals;
}

/** Categories by total, highest first, ties by specificity. */
function ranked(totals: Map<LoreCategory, number>): Array<[LoreCategory, number]> {
  return [...totals].sort(
    ([a, scoreA], [b, scoreB]) => scoreB - scoreA || SPECIFICITY_RANK[a] - SPECIFICITY_RANK[b]
  );
}

/** The winner's subcategory with the most points, ties to the first the taxonomy lists; null when none scored. */
function subcategoryOf(winner: LoreCategory, hits: readonly SignalHit[]): string | null {
  const points = new Map<string, number>();
  for (const { category, subcategory, points: p } of hits) {
    if (category === winner && subcategory !== null) {
      points.set(subcategory, (points.get(subcategory) ?? 0) + p);
    }
  }
  let best: string | null = null;
  let bestPoints = 0;
  for (const { id } of subcategoriesOf(winner)) {
    const p = points.get(id) ?? 0;
    if (p > bestPoints) [best, bestPoints] = [id, p];
  }
  return best;
}

/** Rises with the winning total up to FULL_CONFIDENCE_SCORE, falls as the runner-up nears it. */
function confidenceOf(top: number, second: number): number {
  if (top === 0) return 0;
  return Math.round(Math.min(1, top / FULL_CONFIDENCE_SCORE) * (1 - second / top) * 100) / 100;
}

/** An article's lore category, subcategory and confidence; `category: null` when nothing scored. */
export function classifyLoreArticle(input: ArticleClassificationInput): CategoryClassification {
  const hits = [...infoboxHits(input), ...categoryHits(input), ...keywordHits(input)];
  const [first, runnerUp] = ranked(totalsOf(hits));
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

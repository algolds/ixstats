/**
 * The categories backfill's pure half (the script is `scripts/cards/backfill-card-categories.ts`):
 *   - `collectPageSignals` reads a 50-title `prop=categories|templates` request whole, every continuation answer
 *     merged per page, each requested title found under its normalized and redirected name;
 *   - `planCardCategory` decides one card: a retired card is skipped, an admin-, realm-owner- or suggestion-set
 *     category is never planned over, a card whose wiki stopped answering waits for the next run, and the rest are
 *     classified (an article tagged Abandoned Lore never for review: the apply retires it);
 *   - `buildBackfillReport` and `renderBackfillReport` are the dry run's report, from which the owner reads the
 *     review threshold and the classifier's gaps.
 */
import { z } from "zod";

import type { CardWikiSource } from "./card-sources";
import { classifyLoreArticle, type CategoryClassification } from "./category-classifier";
import { UNCATEGORISED, type CategoryFilterValue, type LoreCategory } from "./category-enums";
import { isAbandonedLore, unmappedCategories, unmappedInfoboxes } from "./category-mappings";
import { getCategoryFilterLabel } from "./category-theme";
import { categoryLine, subcategoryLabel } from "./category-taxonomy";

/** Category sources a person set: the backfill only counts these cards. */
export const PROTECTED_SOURCES = ["ADMIN", "REALM_OWNER", "SUGGESTION"] as const;

export interface PageSignals {
  categories: string[];
  templates: string[];
  missing: boolean;
}

const rename = z.object({ from: z.string(), to: z.string() });
const titled = z.array(z.object({ title: z.string() }));

/** One `action=query&prop=categories|templates` answer (formatversion 2). */
export const PagesResponseSchema = z.object({
  continue: z.record(z.string(), z.string()).optional(),
  query: z
    .object({
      normalized: z.array(rename).optional(),
      redirects: z.array(rename).optional(),
      pages: z
        .array(
          z.object({
            title: z.string(),
            missing: z.boolean().optional(),
            invalid: z.boolean().optional(),
            categories: titled.optional(),
            templates: titled.optional(),
          })
        )
        .optional(),
    })
    .optional(),
});

export type PagesResponse = z.infer<typeof PagesResponseSchema>;
type ResponsePage = NonNullable<NonNullable<PagesResponse["query"]>["pages"]>[number];

interface MergedPage {
  categories: Set<string>;
  templates: Set<string>;
  missing: boolean;
}

function mergePage(pages: Map<string, MergedPage>, page: ResponsePage): void {
  const merged = pages.get(page.title) ?? {
    categories: new Set<string>(),
    templates: new Set<string>(),
    missing: false,
  };
  for (const { title } of page.categories ?? []) merged.categories.add(title);
  for (const { title } of page.templates ?? []) merged.templates.add(title);
  merged.missing ||= page.missing === true || page.invalid === true;
  pages.set(page.title, merged);
}

/** The title a requested one ends at, through the answer's normalizations and redirects; a cycle stops it. */
function resolveTitle(title: string, renames: ReadonlyMap<string, string>): string {
  const seen = new Set<string>();
  let current = title;
  for (let next = renames.get(current); next !== undefined && !seen.has(current);) {
    seen.add(current);
    current = next;
    next = renames.get(current);
  }
  return current;
}

const signalsOf = (page: MergedPage | undefined): PageSignals =>
  !page || page.missing
    ? { categories: [], templates: [], missing: true }
    : { categories: [...page.categories], templates: [...page.templates], missing: false };

/** Each requested title's categories and templates, from every answer of its request (continuations included). */
export function collectPageSignals(
  requested: readonly string[],
  responses: readonly PagesResponse[]
): Map<string, PageSignals> {
  const pages = new Map<string, MergedPage>();
  const renames = new Map<string, string>();
  for (const response of responses) {
    const query = response.query;
    for (const { from, to } of [...(query?.normalized ?? []), ...(query?.redirects ?? [])]) {
      renames.set(from, to);
    }
    for (const page of query?.pages ?? []) mergePage(pages, page);
  }
  return new Map(
    requested.map((title) => [title, signalsOf(pages.get(resolveTitle(title, renames)))])
  );
}

export interface BackfillCard {
  id: string;
  title: string;
  source: CardWikiSource;
  articleTitle: string | null;
  excerpt: string | null;
  category: LoreCategory | null;
  subcategory: string | null;
  categorySource: string | null;
  hasLegacyLabel: boolean;
  retired: boolean;
}

export type BackfillDecision =
  /** A retired card: the backfill neither classifies nor reports it. */
  | { kind: "retired" }
  | { kind: "protected" }
  /** A classifier category from an earlier run, left as it is without `--reclassify`. */
  | { kind: "kept" }
  | { kind: "unread" }
  | {
      kind: "write";
      classification: CategoryClassification;
      needsReview: boolean;
      changed: boolean;
    };

const isProtected = (source: string | null): boolean =>
  PROTECTED_SOURCES.some((protectedSource) => protectedSource === source);

/**
 * One card's plan. `signals` is null when its wiki was not read (it stopped answering); a card with no article
 * (the seed cards) is classified on its title and excerpt alone.
 */
export function planCardCategory(
  card: BackfillCard,
  signals: PageSignals | null,
  threshold: number,
  { reclassify = false }: { reclassify?: boolean } = {}
): BackfillDecision {
  if (card.retired) return { kind: "retired" };
  if (isProtected(card.categorySource)) return { kind: "protected" };
  if (card.categorySource === "CLASSIFIER" && !reclassify) return { kind: "kept" };
  if (card.articleTitle !== null && signals === null) return { kind: "unread" };
  const classification = classifyLoreArticle({
    title: card.title,
    text: card.excerpt,
    categories: signals?.categories,
    templates: signals?.templates,
    source: card.source,
  });
  const abandoned = isAbandonedLore(signals?.categories ?? []);
  return {
    kind: "write",
    classification,
    needsReview:
      !abandoned && (classification.category === null || classification.confidence < threshold),
    changed:
      classification.category !== card.category || classification.subcategory !== card.subcategory,
  };
}

export interface BackfillRow {
  card: BackfillCard;
  decision: BackfillDecision;
  signals: PageSignals | null;
}

/** The cards not yet retired whose article is tagged Abandoned Lore: the apply retires them. */
export const abandonedRows = (rows: readonly BackfillRow[]): BackfillRow[] =>
  rows.filter(
    ({ decision, signals }) =>
      decision.kind !== "retired" && signals !== null && isAbandonedLore(signals.categories)
  );

export interface BackfillReportMeta {
  threshold: number;
  mode: "dry-run" | "apply";
  /** Per wiki, why it stopped answering. */
  stops: Partial<Record<CardWikiSource, string>>;
}

type Counts = Partial<Record<CategoryFilterValue, number>>;

interface ReportCard {
  title: string;
  source: CardWikiSource;
}

export interface BackfillReport extends BackfillReportMeta {
  cardsPerSource: Partial<Record<CardWikiSource, number>>;
  counts: {
    /** Retired cards, skipped: every other figure leaves them out. */
    retired: number;
    abandoned: number;
    protected: number;
    kept: number;
    unread: number;
    writes: number;
    changes: number;
    /** Writes that keep the card's category and only set or change its subcategory. */
    subcategoryOnly: number;
    review: number;
    missingPages: number;
  };
  /** Each card's category after the run: the planned one where it writes, else its current one. */
  distribution: { overall: Counts; perSource: Partial<Record<CardWikiSource, Counts>> };
  /** Per category, cards by subcategory id ("none" for none). */
  subcategories: Partial<Record<LoreCategory, Record<string, number>>>;
  /** Planned writes by confidence, in tenths (the last holds 1). */
  histogram: number[];
  samples: Partial<
    Record<
      CategoryFilterValue,
      Array<{ title: string; subcategory: string | null; confidence: number }>
    >
  >;
  belowThreshold: Array<ReportCard & { line: string; confidence: number }>;
  /** Writes that move a card from one category to another (or to none). */
  changes: Array<ReportCard & { from: string; to: string }>;
  unread: ReportCard[];
  /** Cards tagged Abandoned Lore, which the apply retires (none of them waits for review). */
  abandoned: Array<ReportCard & { id: string }>;
  unmappedCategories: Array<[string, number]>;
  unmappedInfoboxes: Array<[string, number]>;
  /** The `metadata.category` labels an apply deletes: with its writes, and by the final sweep when it runs. */
  legacyLabels: { onWrites: number; bySweep: number; sweepRuns: boolean };
}

const SAMPLE_SIZE = 5;
const UNMAPPED_LIMIT = 50;
const NO_SUBCATEGORY = "none";

const bump = <K extends string>(counts: Partial<Record<K, number>>, key: K): void => {
  counts[key] = (counts[key] ?? 0) + 1;
};

const filterValue = (category: LoreCategory | null): CategoryFilterValue =>
  category ?? UNCATEGORISED;

/** The category and subcategory a card holds after the run. */
function resultOf({ card, decision }: BackfillRow): {
  category: LoreCategory | null;
  subcategory: string | null;
} {
  return decision.kind === "write" ? decision.classification : card;
}

const tenth = (confidence: number): number =>
  Math.min(9, Math.max(0, Math.floor(Math.round(confidence * 100) / 10)));

function topCounts(counts: ReadonlyMap<string, number>): Array<[string, number]> {
  return [...counts]
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .slice(0, UNMAPPED_LIMIT);
}

function distributionOf(rows: readonly BackfillRow[]) {
  const overall: Counts = {};
  const perSource: Partial<Record<CardWikiSource, Counts>> = {};
  const subcategories: Partial<Record<LoreCategory, Record<string, number>>> = {};
  for (const row of rows) {
    const { category, subcategory } = resultOf(row);
    bump(overall, filterValue(category));
    bump((perSource[row.card.source] ??= {}), filterValue(category));
    if (category !== null) bump((subcategories[category] ??= {}), subcategory ?? NO_SUBCATEGORY);
  }
  return { distribution: { overall, perSource }, subcategories };
}

type WriteRow = BackfillRow & { decision: Extract<BackfillDecision, { kind: "write" }> };

function writeListsOf(writes: readonly WriteRow[]) {
  const histogram = Array.from({ length: 10 }, () => 0);
  const samples: BackfillReport["samples"] = {};
  const belowThreshold: BackfillReport["belowThreshold"] = [];
  const changes: BackfillReport["changes"] = [];
  let subcategoryOnly = 0;
  for (const { card, decision } of writes) {
    const { category, subcategory, confidence } = decision.classification;
    histogram[tenth(confidence)]! += 1;
    const sample = (samples[filterValue(category)] ??= []);
    if (sample.length < SAMPLE_SIZE) sample.push({ title: card.title, subcategory, confidence });
    const to = categoryLine(category, subcategory);
    if (decision.needsReview) {
      belowThreshold.push({ title: card.title, source: card.source, line: to, confidence });
    }
    if (decision.changed && card.category === category) subcategoryOnly += 1;
    else if (decision.changed && card.category !== null) {
      changes.push({
        title: card.title,
        source: card.source,
        from: categoryLine(card.category, card.subcategory),
        to,
      });
    }
  }
  return { histogram, samples, belowThreshold, changes, subcategoryOnly };
}

function unmappedOf(rows: readonly BackfillRow[]) {
  const categories = new Map<string, number>();
  const infoboxes = new Map<string, number>();
  for (const { card, signals } of rows) {
    if (!signals) continue;
    for (const name of unmappedCategories(signals.categories, card.source)) {
      categories.set(name, (categories.get(name) ?? 0) + 1);
    }
    for (const name of unmappedInfoboxes(signals.templates)) {
      infoboxes.set(name, (infoboxes.get(name) ?? 0) + 1);
    }
  }
  return { unmappedCategories: topCounts(categories), unmappedInfoboxes: topCounts(infoboxes) };
}

const isWrite = (row: BackfillRow): row is WriteRow => row.decision.kind === "write";

export function buildBackfillReport(
  allRows: readonly BackfillRow[],
  meta: BackfillReportMeta
): BackfillReport {
  const rows = allRows.filter(({ decision }) => decision.kind !== "retired");
  const abandoned = abandonedRows(rows);
  const cardsPerSource: BackfillReport["cardsPerSource"] = {};
  for (const { card } of rows) bump(cardsPerSource, card.source);
  const ofKind = (kind: BackfillDecision["kind"]) =>
    rows.filter((row) => row.decision.kind === kind);
  const writes = rows.filter(isWrite);
  const unread = ofKind("unread");
  const lists = writeListsOf(writes);
  const sweepRuns = unread.length === 0 && Object.keys(meta.stops).length === 0;
  const reached = [...ofKind("protected"), ...ofKind("kept")];
  return {
    ...meta,
    cardsPerSource,
    counts: {
      retired: allRows.length - rows.length,
      abandoned: abandoned.length,
      protected: ofKind("protected").length,
      kept: ofKind("kept").length,
      unread: unread.length,
      writes: writes.length,
      changes: lists.changes.length,
      subcategoryOnly: lists.subcategoryOnly,
      review: lists.belowThreshold.length,
      missingPages: rows.filter(({ signals }) => signals?.missing).length,
    },
    ...distributionOf(rows),
    histogram: lists.histogram,
    samples: lists.samples,
    belowThreshold: lists.belowThreshold,
    changes: lists.changes,
    unread: unread.map(({ card }) => ({ title: card.title, source: card.source })),
    abandoned: abandoned.map(({ card }) => ({
      id: card.id,
      title: card.title,
      source: card.source,
    })),
    ...unmappedOf(rows),
    legacyLabels: {
      onWrites: writes.filter(({ card }) => card.hasLegacyLabel).length,
      bySweep: sweepRuns ? reached.filter(({ card }) => card.hasLegacyLabel).length : 0,
      sweepRuns,
    },
  };
}

// --- Markdown ---------------------------------------------------------------------------------------------------

const cell = (value: string | number): string =>
  String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");

function table(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number>>
): string[] {
  if (rows.length === 0) return ["None."];
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
  ];
}

const sources = (report: BackfillReport) => Object.keys(report.cardsPerSource) as CardWikiSource[];
const valuesOf = (counts: Counts) =>
  (Object.entries(counts) as Array<[CategoryFilterValue, number]>).sort(([, a], [, b]) => b - a);

function runSection(report: BackfillReport): string[] {
  const { counts } = report;
  const stops = Object.entries(report.stops).map(([wiki, why]) => `- ${wiki}: ${why}`);
  return [
    "## Run",
    `- Mode: ${report.mode === "apply" ? "apply" : "dry run (nothing written)"}`,
    `- Review threshold: ${report.threshold}`,
    `- Retired, skipped: ${counts.retired}`,
    `- Abandoned Lore (the apply retires them; none is for review): ${counts.abandoned}`,
    `- Protected (set by an admin, a realm owner or a suggestion): ${counts.protected}`,
    `- Kept (classified by an earlier run; --reclassify redoes them): ${counts.kept}`,
    `- To write: ${counts.writes} (${counts.review} for review, ${counts.changes} changing a category, ${counts.subcategoryOnly} only a subcategory)`,
    `- Not read (their wiki stopped): ${counts.unread}`,
    `- Pages missing from their wiki (classified on title and excerpt): ${counts.missingPages}`,
    "",
    ...table(
      ["Source", "Cards"],
      sources(report).map((source) => [source, report.cardsPerSource[source] ?? 0])
    ),
    "",
    "Wikis that stopped:",
    ...(stops.length > 0 ? stops : ["None."]),
  ];
}

function distributionSection(report: BackfillReport): string[] {
  const list = sources(report);
  return [
    "## Distribution",
    ...table(
      ["Category", "All", ...list],
      valuesOf(report.distribution.overall).map(([value, count]) => [
        getCategoryFilterLabel(value),
        count,
        ...list.map((source) => report.distribution.perSource[source]?.[value] ?? 0),
      ])
    ),
  ];
}

function subcategorySection(report: BackfillReport): string[] {
  const entries = Object.entries(report.subcategories) as Array<
    [LoreCategory, Record<string, number>]
  >;
  return [
    "## Subcategories",
    ...entries.flatMap(([category, counts]) => [
      `### ${getCategoryFilterLabel(category)}`,
      ...Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .map(
          ([id, count]) =>
            `- ${id === NO_SUBCATEGORY ? "No subcategory" : (subcategoryLabel(category, id) ?? id)}: ${count}`
        ),
    ]),
  ];
}

function confidenceSection(report: BackfillReport): string[] {
  return [
    "## Confidence",
    "Planned writes by confidence, to choose the review threshold.",
    "",
    ...table(
      ["Confidence", "Cards"],
      report.histogram.map((count, i) => [
        `${(i / 10).toFixed(1)} to ${((i + 1) / 10).toFixed(1)}`,
        count,
      ])
    ),
  ];
}

function sampleSection(report: BackfillReport): string[] {
  const entries = Object.entries(report.samples) as Array<
    [CategoryFilterValue, NonNullable<BackfillReport["samples"][CategoryFilterValue]>]
  >;
  return [
    "## Sample",
    ...entries.flatMap(([value, sample]) => [
      `### ${getCategoryFilterLabel(value)}`,
      ...table(
        ["Title", "Subcategory", "Confidence"],
        sample.map(({ title, subcategory, confidence }) => [title, subcategory ?? "", confidence])
      ),
    ]),
  ];
}

function listSections(report: BackfillReport): string[] {
  return [
    "## Below the threshold",
    ...table(
      ["Title", "Source", "Proposed", "Confidence"],
      report.belowThreshold.map(({ title, source, line, confidence }) => [
        title,
        source,
        line,
        confidence,
      ])
    ),
    "",
    "## Changes",
    "Cards the run moves from the category they hold to another (a new subcategory alone is not listed).",
    "",
    ...table(
      ["Title", "Source", "From", "To"],
      report.changes.map(({ title, source, from, to }) => [title, source, from, to])
    ),
    "",
    "## Abandoned Lore",
    "Cards whose article is tagged Abandoned Lore. The apply retires them; their held copies are kept.",
    "",
    ...table(
      ["Title", "Source"],
      report.abandoned.map(({ title, source }) => [title, source])
    ),
    "",
    "## Not read",
    "Left as they are for the next run.",
    "",
    ...table(
      ["Title", "Source"],
      report.unread.map(({ title, source }) => [title, source])
    ),
  ];
}

function unmappedSection(report: BackfillReport): string[] {
  return [
    "## Unmapped",
    `The ${UNMAPPED_LIMIT} commonest wiki categories and infoboxes no rule reads, by cards.`,
    "",
    "### Wiki categories",
    ...table(["Category", "Cards"], report.unmappedCategories),
    "",
    "### Infoboxes",
    ...table(["Infobox", "Cards"], report.unmappedInfoboxes),
  ];
}

function legacySection({ legacyLabels }: BackfillReport): string[] {
  const sweep = legacyLabels.sweepRuns
    ? `${legacyLabels.bySweep} more by the final sweep (at least: it reaches every card with a category source).`
    : "The final sweep does not run: a wiki stopped or a card was not read.";
  return [
    "## Legacy labels",
    `The apply deletes ${legacyLabels.onWrites} metadata.category labels with its writes. ${sweep}`,
  ];
}

export function renderBackfillReport(report: BackfillReport): string {
  return [
    "# Card categories backfill",
    runSection(report),
    distributionSection(report),
    subcategorySection(report),
    confidenceSection(report),
    sampleSection(report),
    listSections(report),
    unmappedSection(report),
    legacySection(report),
  ]
    .map((section) => (Array.isArray(section) ? section.join("\n") : section))
    .join("\n\n")
    .concat("\n");
}

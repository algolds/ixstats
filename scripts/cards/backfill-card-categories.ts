// scripts/cards/backfill-card-categories.ts
/**
 * Card categories phase: classify every Lore card from its wiki's infoboxes and categories, and its title and
 * excerpt. Each wiki is read through its api.php (`prop=categories|templates`, 50 titles a request, one request a
 * second, User-Agent IxStats-Builder), every continuation followed. A card below the review threshold, or with nothing
 * to go on, waits in the admin review queue ("Uncategorised" when no category scored). A retired card is skipped, and a
 * card whose article is tagged Abandoned Lore is retired by the apply (held copies kept, one CARD_HIDE audit row
 * each), never queued for review: that holds for an admin-, realm-owner- or suggestion-set card and one an earlier run
 * classified too, whose article is read only for that tag. The dry run writes a report
 * (the distribution, a confidence histogram to choose the threshold, a sample per category, the low-confidence list,
 * the changes, the Abandoned Lore cards and the unmapped wiki categories and infoboxes) to scripts/reports/.
 *
 *   bun scripts/cards/backfill-card-categories.ts                     # dry run: writes the report, not the cards
 *   bun scripts/cards/backfill-card-categories.ts --apply             # write the categories, then drop the labels
 *   bun scripts/cards/backfill-card-categories.ts --apply --reclassify   # also redo cards an earlier run classified
 *
 * Other flags: --source <wiki> (one wiki's cards), --threshold <0-1> (default CATEGORY_REVIEW_THRESHOLD),
 * --report <path.md> (and its .json beside it), --cache <path> (default scripts/reports/card-categories-cache.json).
 *
 * Idempotent and resumable: the wikis' answers are cached after every batch, so the apply reuses the dry run's reads,
 * and a wiki that stops answering (HTTP 403 or 429, a Cloudflare page) leaves its unread cards untouched for the next
 * run; the final `metadata.category` sweep runs only when every card was read. It never overwrites an admin-,
 * realm-owner- or suggestion-set category (the UPDATE itself guards on `categorySource`), and never writes `realmId`.
 *
 * IIWiki may answer only from the production server, which reads iiwiki.com directly. In development the wikis'
 * configured api.php is used, which for IIWiki is the maps host's relay: dev reads IIWiki through it once the relay's
 * allowlist (src/app/api/mediawiki/_config.ts, with cllimit, clshow, clcontinue, tllimit, tlnamespace and tlcontinue)
 * is deployed to maps.ixwiki.com. Set IIWIKI_DEV_PROXY_URL to try another proxy. An api.php that drops the
 * continuations repeats them, and the run stops that wiki rather than read part of each page.
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { z } from "zod";
import {
  abandonedRows,
  buildBackfillReport,
  collectPageSignals,
  planCardCategory,
  renderBackfillReport,
  PagesResponseSchema,
  type BackfillCard,
  type BackfillDecision,
  type BackfillReport,
  type BackfillRow,
  type PageSignals,
  type PagesResponse,
} from "~/lib/cards/category-backfill";
import {
  cardSourceLabel,
  parseCardWikiSource,
  type CardWikiSource,
} from "~/lib/cards/card-sources";
import { CATEGORY_REVIEW_THRESHOLD, classifierColumns } from "~/lib/cards/category-classifier";
import { isJsonObject } from "~/lib/cards/ns-facts";
import type { WikiQuery } from "~/lib/realms/lore-import";
import {
  createDiscoveryClient,
  defaultApiUrl,
  DiscoveryStopped,
} from "~/lib/realms/sources/wiki-discovery-client";
import { titleKey } from "~/lib/wiki-os/core/title";
import { recordCardAudit } from "~/server/modules/cards/cards.audit";

const TITLES_PER_REQUEST = 50;
const APPLY_BATCH = 200;
const REQUEST_DELAY_MS = 1000;
/** Far above a run's reads (about 50 requests and their continuations for 2,400 cards). */
const REQUEST_CAP = 10_000;
const DEFAULT_CACHE = "scripts/reports/card-categories-cache.json";

/** A wiki's api.php: IIWiki's dev proxy from `env` when set, else the wiki's configured one (`defaultApiUrl`). */
export function backfillApiUrl(
  source: CardWikiSource,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (source === "iiwiki" && env.IIWIKI_DEV_PROXY_URL) return env.IIWIKI_DEV_PROXY_URL;
  return defaultApiUrl(source);
}

const sameValues = (a: Record<string, string>, b: Record<string, string>): boolean =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(([key, value]) => b[key] === value);

/** Every answer of one request, following `continue` until an answer has none. */
async function readWhole(query: WikiQuery, titles: readonly string[]): Promise<PagesResponse[]> {
  const params = {
    titles: titles.join("|"),
    prop: "categories|templates",
    cllimit: "max",
    clshow: "!hidden",
    tllimit: "max",
    tlnamespace: "10",
    redirects: "1",
  };
  const answers: PagesResponse[] = [];
  let sent: Record<string, string> = {};
  for (;;) {
    const answer = await query({ ...params, ...sent }, PagesResponseSchema);
    answers.push(answer);
    const next = answer.continue ?? {};
    if (Object.keys(next).length === 0) return answers;
    if (sameValues(next, sent)) {
      throw new DiscoveryStopped({
        kind: "error",
        status: null,
        message:
          "the wiki repeated its continuation: the api.php in use drops clcontinue/tlcontinue (as a relay without them in its allowlist does)",
      });
    }
    sent = next;
  }
}

/** Each title's categories and templates, 50 titles a request, every continuation followed. */
export async function fetchSignals(
  query: WikiQuery,
  titles: readonly string[]
): Promise<Map<string, PageSignals>> {
  const signals = new Map<string, PageSignals>();
  for (let start = 0; start < titles.length; start += TITLES_PER_REQUEST) {
    const batch = titles.slice(start, start + TITLES_PER_REQUEST);
    for (const [title, read] of collectPageSignals(batch, await readWhole(query, batch))) {
      signals.set(title, read);
    }
  }
  return signals;
}

const CARD_SELECT = {
  id: true,
  title: true,
  wikiSource: true,
  wikiArticleTitle: true,
  wikiExcerpt: true,
  metadata: true,
  category: true,
  subcategory: true,
  categorySource: true,
  isRetired: true,
} satisfies Prisma.CardSelect;

type CardRow = Prisma.CardGetPayload<{ select: typeof CARD_SELECT }>;

function toBackfillCard(row: CardRow): BackfillCard {
  const metadata = isJsonObject(row.metadata) ? row.metadata : null;
  const fullExcerpt = metadata?.fullExcerpt;
  return {
    id: row.id,
    title: row.title,
    source: parseCardWikiSource(row.wikiSource) ?? "ixwiki",
    articleTitle: row.wikiArticleTitle?.trim() || null,
    excerpt: typeof fullExcerpt === "string" && fullExcerpt ? fullExcerpt : row.wikiExcerpt,
    category: row.category,
    subcategory: row.subcategory,
    categorySource: row.categorySource,
    hasLegacyLabel: metadata !== null && "category" in metadata,
    retired: row.isRetired,
  };
}

/** Every Lore card (one wiki's with `source`; a card with no source is IxWiki's). */
export async function readBackfillCards(
  db: Pick<PrismaClient, "card">,
  source: CardWikiSource | null
): Promise<BackfillCard[]> {
  const bySource: Prisma.CardWhereInput =
    source === null
      ? {}
      : source === "ixwiki"
        ? { OR: [{ wikiSource: "ixwiki" }, { wikiSource: null }] }
        : { wikiSource: source };
  const rows = await db.card.findMany({
    where: { cardType: "LORE", ...bySource },
    select: CARD_SELECT,
    orderBy: { id: "asc" },
  });
  return rows.map(toBackfillCard);
}

type DecisionRow = { card: Pick<BackfillCard, "id">; decision: BackfillDecision };

/** Writes each planned category, 200 cards a transaction; a card a person set meanwhile is left alone. */
export async function applyDecisions(
  db: PrismaClient,
  rows: readonly DecisionRow[]
): Promise<number> {
  const writes = rows.flatMap(({ card, decision }) =>
    decision.kind === "write"
      ? [
          {
            id: card.id,
            columns: {
              ...classifierColumns(decision.classification),
              categoryNeedsReview: decision.needsReview,
            },
          },
        ]
      : []
  );
  let written = 0;
  for (let start = 0; start < writes.length; start += APPLY_BATCH) {
    const batch = writes.slice(start, start + APPLY_BATCH);
    written += await db.$transaction(
      async (tx) => {
        let count = 0;
        for (const { id, columns } of batch) {
          count += await tx.$executeRaw`
            UPDATE "cards" SET
              "category" = ${columns.category}::"LoreCategory", "subcategory" = ${columns.subcategory},
              "categorySource" = 'CLASSIFIER', "categoryConfidence" = ${columns.categoryConfidence},
              "categoryNeedsReview" = ${columns.categoryNeedsReview},
              "metadata" = CASE WHEN jsonb_typeof("metadata") = 'object' THEN "metadata" - 'category' ELSE "metadata" END
            WHERE "id" = ${id} AND "cardType" = 'LORE'
              AND ("categorySource" IS NULL OR "categorySource" = 'CLASSIFIER')`;
        }
        return count;
      },
      { timeout: 60_000 }
    );
  }
  return written;
}

/** Deletes the old `metadata.category` label of every Lore card that has a category source. */
export async function dropLegacyLabels(db: PrismaClient): Promise<number> {
  return db.$executeRaw`
    UPDATE "cards" SET "metadata" = "metadata" - 'category'
    WHERE "cardType" = 'LORE' AND jsonb_typeof("metadata") = 'object' AND "metadata" ? 'category'
      AND "categorySource" IS NOT NULL`;
}

type AbandonedCard = Pick<BackfillCard, "id" | "title" | "source">;

/**
 * Retires each card tagged Abandoned Lore that is not yet retired, as `retire-seed-cards.ts` does: one CARD_HIDE audit
 * row each, held copies kept. A card already retired is left alone, so a re-run writes no second audit row.
 */
export async function retireAbandoned(
  db: Pick<PrismaClient, "$transaction">,
  cards: readonly AbandonedCard[]
): Promise<number> {
  if (cards.length === 0) return 0;
  return db.$transaction(
    async (tx) => {
      let retired = 0;
      for (const card of cards) {
        const { count } = await tx.card.updateMany({
          where: { id: card.id, cardType: "LORE", isRetired: false },
          data: { isRetired: true, retiredAt: new Date() },
        });
        if (count === 0) continue;
        retired += 1;
        await recordCardAudit(tx, {
          action: "CARD_HIDE",
          actor: null,
          target: card.id,
          details: `Retired: its ${cardSourceLabel(card.source)} article is tagged Abandoned Lore`,
        });
      }
      return retired;
    },
    { timeout: 60_000 }
  );
}

const PageSignalsSchema = z.object({
  categories: z.array(z.string()),
  templates: z.array(z.string()),
  missing: z.boolean(),
});
const SignalCacheSchema = z.object({
  version: z.literal(1),
  pages: z.record(z.string(), PageSignalsSchema),
});
export type SignalCache = z.infer<typeof SignalCacheSchema>;

const cacheKey = (source: CardWikiSource, title: string) => `${source}|${titleKey(title, source)}`;

export interface BackfillOptions {
  apply: boolean;
  source: CardWikiSource | null;
  reclassify: boolean;
  threshold: number;
}

export interface BackfillDeps {
  queryFor: (source: CardWikiSource) => WikiQuery;
  cache: SignalCache;
  saveCache: (cache: SignalCache) => void;
  log?: (line: string) => void;
}

/** Reads each wiki's uncached titles into the cache; returns why each wiki that stopped did. */
async function readWikis(
  titlesBySource: ReadonlyMap<CardWikiSource, string[]>,
  deps: BackfillDeps
): Promise<Partial<Record<CardWikiSource, string>>> {
  const stops: Partial<Record<CardWikiSource, string>> = {};
  for (const [source, titles] of titlesBySource) {
    const query = deps.queryFor(source);
    try {
      for (let start = 0; start < titles.length; start += TITLES_PER_REQUEST) {
        const batch = titles.slice(start, start + TITLES_PER_REQUEST);
        for (const [title, read] of await fetchSignals(query, batch)) {
          deps.cache.pages[cacheKey(source, title)] = read;
        }
        deps.saveCache(deps.cache);
        deps.log?.(
          `${source}: ${Math.min(start + batch.length, titles.length)}/${titles.length} titles read`
        );
      }
    } catch (error) {
      if (!(error instanceof DiscoveryStopped)) throw error;
      stops[source] = error.message;
      deps.log?.(
        `${source} stopped: ${error.message}. Its unread cards are left for the next run.`
      );
    }
  }
  return stops;
}

/**
 * Each wiki's uncached titles: first the cards the plan classifies, then the kept and protected ones, read only to
 * find an Abandoned Lore tag (their categories are never changed). A retired card is never read.
 */
function titlesToRead(rows: readonly BackfillRow[]): Map<CardWikiSource, string[]> {
  const ordered = [
    ...rows.filter(({ decision }) => decision.kind === "unread"),
    ...rows.filter(({ decision }) => decision.kind === "kept" || decision.kind === "protected"),
  ];
  const titlesBySource = new Map<CardWikiSource, string[]>();
  for (const { card, signals } of ordered) {
    if (!card.articleTitle || signals !== null) continue;
    const titles = titlesBySource.get(card.source) ?? [];
    titles.push(card.articleTitle);
    titlesBySource.set(card.source, titles);
  }
  return titlesBySource;
}

/** Plans every card, reads what the plan needs, reports, and with `apply` writes, then retires the abandoned. */
export async function runBackfill(
  db: PrismaClient,
  options: BackfillOptions,
  deps: BackfillDeps
): Promise<{ report: BackfillReport; written: number; swept: number; retired: number }> {
  const cards = await readBackfillCards(db, options.source);
  const plan = (card: BackfillCard) => {
    const signals = card.articleTitle
      ? (deps.cache.pages[cacheKey(card.source, card.articleTitle)] ?? null)
      : null;
    const decision = planCardCategory(card, signals, options.threshold, options);
    return { card, decision, signals };
  };
  const stops = await readWikis(titlesToRead(cards.map(plan)), deps);
  const rows = cards.map(plan);
  const report = buildBackfillReport(rows, {
    threshold: options.threshold,
    mode: options.apply ? "apply" : "dry-run",
    stops,
  });
  if (!options.apply) return { report, written: 0, swept: 0, retired: 0 };
  const written = await applyDecisions(db, rows);
  const swept = report.legacyLabels.sweepRuns ? await dropLegacyLabels(db) : 0;
  const retired = await retireAbandoned(
    db,
    abandonedRows(rows).map(({ card }) => card)
  );
  return { report, written, swept, retired };
}

export interface BackfillArgs extends BackfillOptions {
  report: string | null;
  cache: string;
}

function flagValue(argv: readonly string[], flag: string): string | null {
  const at = argv.indexOf(flag);
  if (at === -1) return null;
  const value = argv[at + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
  return value;
}

export function parseBackfillArgs(argv: readonly string[]): BackfillArgs {
  const sourceArg = flagValue(argv, "--source");
  const source = sourceArg === null ? null : parseCardWikiSource(sourceArg);
  if (sourceArg !== null && source === null) throw new Error(`--source: no wiki "${sourceArg}"`);
  const thresholdArg = flagValue(argv, "--threshold");
  const threshold = thresholdArg === null ? CATEGORY_REVIEW_THRESHOLD : Number(thresholdArg);
  if (!(threshold >= 0 && threshold <= 1))
    throw new Error("--threshold takes a number from 0 to 1");
  return {
    apply: argv.includes("--apply"),
    reclassify: argv.includes("--reclassify"),
    source,
    threshold,
    report: flagValue(argv, "--report"),
    cache: flagValue(argv, "--cache") ?? DEFAULT_CACHE,
  };
}

function loadCache(path: string): SignalCache {
  try {
    const parsed = SignalCacheSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
    if (parsed.success) return parsed.data;
  } catch {
    // No cache yet, or one that does not parse: start afresh.
  }
  return { version: 1, pages: {} };
}

function writeFile(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

async function main() {
  const args = parseBackfillArgs(process.argv.slice(2));
  const reportPath =
    args.report ??
    `scripts/reports/card-categories-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
  const db = new PrismaClient();
  try {
    const { report, written, swept, retired } = await runBackfill(db, args, {
      queryFor: (source) =>
        createDiscoveryClient(source, {
          apiUrl: backfillApiUrl(source),
          delayMs: REQUEST_DELAY_MS,
          maxRequests: REQUEST_CAP,
          pauseFirst: false,
        }).query,
      cache: loadCache(args.cache),
      saveCache: (cache) => writeFile(args.cache, JSON.stringify(cache)),
      log: (line) => console.log(line),
    });
    writeFile(reportPath, renderBackfillReport(report));
    writeFile(reportPath.replace(/(\.md)?$/, ".json"), JSON.stringify(report, null, 2));
    const { counts } = report;
    console.log(
      `${counts.writes} to write (${counts.review} for review, ${counts.changes} changes), ${counts.protected} protected, ${counts.kept} kept, ${counts.unread} not read, ${counts.retired} retired and skipped, ${counts.abandoned} Abandoned Lore.`
    );
    console.log(`Report: ${reportPath}`);
    if (args.apply) {
      console.log(
        `${written} cards written; ${swept} legacy labels swept; ${retired} Abandoned Lore cards retired.`
      );
    } else {
      console.log("Dry run: no card written. Re-run with --apply.");
    }
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

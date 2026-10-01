/**
 * render-service.ts — render each article once per revision, off the read path.
 *
 * MediaWiki is a private render engine: this service sends an article's Postgres wikitext to
 * `action=parse&text=`, turns the HTML into the reader's *view bundle* (transformed, sanitized
 * body / infobox / notices / TOC) and stores it on the row (`renderedView`, `htmlSyncedAt`). A
 * reader then only reads the bundle; it never waits for PHP unless the article was never rendered.
 *
 * `htmlSyncedAt` is the freshness marker: a timestamp means "the bundle matches the current
 * wikitext", NULL means "stale, render me". A writer of wikitext sets it to NULL and calls
 * `enqueueRender`; the previous bundle stays in place so readers keep seeing it meanwhile.
 *
 * The same parse tells WikiOS what the page links, transcludes and uses and which categories it is
 * in; the render stores that too (`wiki_links`, `wiki_template_links`, `wiki_image_links`, the category
 * memberships, `displayTitle`, `pageProps`), each replaced as a set, and `invalidateDependents` marks the
 * pages that transclude a changed page stale. `renderStaleBatch` renders the stale ones in the background.
 *
 * Template chips (`{{MyCountry:...}}`) are stored as inert markers (see templates/chip-markers.ts)
 * and filled in per viewer, per request, by article-view-service.
 *
 * State here is per process (single-flight map, queue, cool-down): with several processes the worst
 * case is one extra render per process.
 */

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import {
  sanitizeWikiArticleHtml,
  wikiArticleSanitizerFingerprint,
} from "~/lib/utils/sanitize-html";
import { renderArticleViaMediaWiki, type RenderMetadata } from "../adapters/mediawiki/parsoid";
import { CategoryService } from "../core/category-service";
import { LinkGraphService } from "../core/link-graph-service";
import { canonicalizeTitle } from "../core/title";
import { markTemplateChips } from "../templates/chip-markers";
import { transformArticleHtml, stripConflictingStyles } from "../transformers/html-transformer";
import { slimArticleHtml } from "../transformers/slim-html";
import { parseWikitextToHtml } from "../transformers/wikitext-parser";

/** Bump when the bundle's shape or the transform changes. */
const RENDERER_BASE_VERSION = 3;

/**
 * What a bundle was built by: the transform's version plus a fingerprint of the sanitizer (its
 * rules and DOMPurify's version). A bundle of another version is outdated: readers get it re-sanitized
 * and marked stale while `renderStaleBatch` (or the first reader's background render) replaces it, so
 * a sanitizer change reaches every stored article without anyone remembering to bump a number.
 */
export const RENDERER_VERSION = `${RENDERER_BASE_VERSION}:${wikiArticleSanitizerFingerprint()}`;

const tocEntrySchema = z.object({ id: z.string(), text: z.string(), level: z.number() });

/** The shape of `WikiArticle.renderedView`; parsed on read because the column is plain JSON. */
export const viewBundleSchema = z.object({
  bodyHtml: z.string(),
  infoboxHtml: z.string().nullable(),
  noticesHtml: z.string().nullable(),
  toc: z.array(tocEntrySchema),
  rendererVersion: z.literal(RENDERER_VERSION),
});

export type ViewBundle = z.infer<typeof viewBundleSchema>;

/** `viewBundleSchema` without the version check: the shape of a bundle some earlier renderer built. */
const outdatedViewBundleSchema = viewBundleSchema.extend({ rendererVersion: z.string() });

export interface RenderResult {
  ok: boolean;
  /** The text kept changing under every attempt; not a failure of MediaWiki. */
  superseded?: boolean;
}

/** Concurrent MediaWiki renders, for the queue and readers together: the private MW is small. */
const MAX_CONCURRENT_RENDERS = 2;
/** After a failed render, readers of that article stop retrying (and waiting) for this long. */
const FAILURE_COOLDOWN_MS = 30_000;
/** Bound for the per-article failure memory. */
const MAX_REMEMBERED_FAILURES = 5_000;
/** A save that lands while a render is running supersedes it; the render restarts on the new text. */
const MAX_RENDER_ATTEMPTS = 3;
/** Rounds of attempts (each back through the queue) before the text is called unsettled. */
const MAX_SUPERSEDED_ROUNDS = 3;
/** A render job that has not finished by then is abandoned: its slot and its flight are released. */
const RENDER_DEADLINE_MS = 60_000;

const FAILED: RenderResult = { ok: false };
const SUPERSEDED: RenderResult = { ok: false, superseded: true };

// ---------------------------------------------------------------------------
// The view bundle
// ---------------------------------------------------------------------------

/**
 * MediaWiki's HTML as the reader wants it: the transform `getArticleHtml` always applied, template
 * chips turned into markers (DOM, before sanitizing), then one sanitizer pass per part. Pure.
 */
export function buildViewBundle(rawHtml: string): ViewBundle {
  const transformed = transformArticleHtml(stripConflictingStyles(rawHtml), "", "ixwiki");
  // sanitized first, then slimmed: the slimming only removes (titles that repeat their link, classes
  // nothing uses, empty attributes, layout whitespace), so it cannot let anything through
  const clean = (html: string) => slimArticleHtml(sanitizeWikiArticleHtml(markTemplateChips(html)));
  return {
    bodyHtml: clean(transformed.contentHtml),
    infoboxHtml: transformed.infoboxHtml ? clean(transformed.infoboxHtml) : null,
    noticesHtml: transformed.noticesHtml ? clean(transformed.noticesHtml) : null,
    toc: transformed.toc,
    rendererVersion: RENDERER_VERSION,
  };
}

/** Why MediaWiki's HTML looks wrong for this wikitext (leaked markup, a missing infobox), or null. */
function describeRenderProblem(rawHtml: string, wikitext: string): string | null {
  if (/\|\d+px\|/i.test(rawHtml) || /\|\s*(?:center|left|right|thumb)\]\]/i.test(rawHtml)) {
    return "leaked wikitext markup";
  }
  const wikitextHasInfobox = /\{\{[Ii]nfobox/i.test(wikitext);
  if (wikitextHasInfobox && !rawHtml.includes("infobox") && !rawHtml.includes("aside")) {
    return "the infobox is missing";
  }
  return null;
}

/** The bundle and freshness of an article, and whether an earlier renderer version built the bundle. */
export interface LoadedViewBundle {
  bundle: ViewBundle;
  htmlSyncedAt: Date | null;
  /**
   * Built by another renderer version (or another sanitizer): worth showing, since it shows the page, but
   * it is not what a render would produce now. Its HTML has been through the current sanitizer.
   */
  outdated: boolean;
}

/** `bundle` with every HTML part (body, infobox, notices; the TOC is plain text) sanitized by the current rules. */
function resanitizeViewBundle(bundle: ViewBundle): ViewBundle {
  return {
    ...bundle,
    bodyHtml: sanitizeWikiArticleHtml(bundle.bodyHtml),
    infoboxHtml: bundle.infoboxHtml === null ? null : sanitizeWikiArticleHtml(bundle.infoboxHtml),
    noticesHtml: bundle.noticesHtml === null ? null : sanitizeWikiArticleHtml(bundle.noticesHtml),
  };
}

/**
 * The bundle and freshness of an article. A bundle of this renderer version is returned as it is. One
 * that only differs in its renderer version (an older transform or sanitizer built it) is returned
 * `outdated`, re-sanitized by the current sanitizer so an older bundle never gets past a tightened rule.
 * Null when the article has no bundle, or one whose shape is not a bundle's at all, or one the sanitizer
 * throws on.
 */
export async function loadViewBundle(articleId: string): Promise<LoadedViewBundle | null> {
  const row = await db.wikiArticle.findUnique({
    where: { id: articleId },
    select: { renderedView: true, htmlSyncedAt: true },
  });
  if (!row) return null;

  const current = viewBundleSchema.safeParse(row.renderedView);
  if (current.success) {
    return { bundle: current.data, htmlSyncedAt: row.htmlSyncedAt, outdated: false };
  }
  const outdated = outdatedViewBundleSchema.safeParse(row.renderedView);
  if (!outdated.success) return null;
  try {
    return {
      bundle: resanitizeViewBundle(outdated.data),
      htmlSyncedAt: row.htmlSyncedAt,
      outdated: true,
    };
  } catch (error) {
    // a page the sanitizer cannot take must not fail every read: it is as good as having no bundle
    console.warn(
      `[WikiOS:render] Re-sanitizing the outdated bundle of ${articleId} failed:`,
      error
    );
    return null;
  }
}

/**
 * A view built in-process for an article that has no bundle and whose render failed: the HTML
 * MediaWiki produced for an earlier revision (`contentHtml`), else the wikitext compiled locally
 * (no templates, no Lua). Sanitized like any bundle, never persisted. Null when the article has
 * neither (a stub).
 */
export async function renderFallbackView(articleId: string): Promise<ViewBundle | null> {
  const row = await db.wikiArticle.findUnique({
    where: { id: articleId },
    select: { wikitext: true, contentHtml: true },
  });
  if (!row) return null;
  const html = row.contentHtml?.trim()
    ? row.contentHtml
    : parseWikitextToHtml(row.wikitext, "ixwiki");
  return html.trim() ? buildViewBundle(html) : null;
}

// ---------------------------------------------------------------------------
// Rendering one article
// ---------------------------------------------------------------------------

/** What a render produced: the HTML, and what MediaWiki reported about the page (null for stored HTML). */
interface Rendered {
  html: string;
  metadata: RenderMetadata | null;
}

/**
 * The HTML to build the bundle from: MediaWiki's parse of the article's own wikitext, or, for an
 * HTML-only row with no wikitext, the stored HTML. Null when there is nothing or MediaWiki failed.
 */
async function renderSource(article: {
  title: string;
  wikitext: string;
  contentHtml: string | null;
}): Promise<Rendered | null> {
  if (article.wikitext.trim() === "") {
    return article.contentHtml?.trim() ? { html: article.contentHtml, metadata: null } : null;
  }
  return renderArticleViaMediaWiki(article.wikitext, article.title);
}

/** The page properties worth keeping; the rest of what MediaWiki reports is its own bookkeeping. */
const KEPT_PAGE_PROPS = [
  "defaultsort",
  "disambiguation",
  "page_image_free",
  "notoc",
  "noeditsection",
];

/** Whether the response told WikiOS anything it can store (a response without any of it is left alone). */
function reportsAnything(metadata: RenderMetadata): boolean {
  return (
    metadata.links !== null ||
    metadata.templates !== null ||
    metadata.images !== null ||
    metadata.categories !== null
  );
}

/**
 * Replace the article's derived data with what the render reported, as one transaction: a reader never
 * sees a page with the new links and the old categories. A field the response did not carry is left as
 * it is.
 */
async function persistRenderMetadata(
  articleId: string,
  source: string,
  metadata: RenderMetadata
): Promise<void> {
  const props = Object.fromEntries(
    KEPT_PAGE_PROPS.flatMap((name) => {
      const value = metadata.properties[name];
      return value === undefined ? [] : [[name, value]];
    })
  );
  const displayTitle = metadata.displayTitle ? sanitizeWikiArticleHtml(metadata.displayTitle) : "";

  await db.$transaction(
    async (tx) => {
      if (metadata.links)
        await LinkGraphService.replaceLinks(tx, articleId, source, metadata.links);
      if (metadata.templates) {
        await LinkGraphService.replaceTemplateLinks(tx, articleId, metadata.templates);
      }
      if (metadata.images) await LinkGraphService.replaceImageLinks(tx, articleId, metadata.images);
      if (metadata.categories) {
        await CategoryService.replaceArticleCategories(tx, articleId, metadata.categories);
      }
      await tx.wikiArticle.update({
        where: { id: articleId },
        data: {
          displayTitle: displayTitle || null,
          pageProps: Object.keys(props).length > 0 ? props : Prisma.DbNull,
        },
      });
    },
    { maxWait: 10_000, timeout: 30_000 }
  );
}

/**
 * Render one article now: parse its wikitext, build the bundle and store it with the raw HTML and
 * `htmlSyncedAt = now`. The write is guarded by the wikitext it rendered, so a save that lands
 * meanwhile is never overwritten; the render then restarts on the new text. On a MediaWiki failure
 * nothing is stored: the previous bundle stays and the article stays stale. When every attempt was
 * overtaken by a save the result says `superseded`, which is not a failure. What MediaWiki reported
 * about the page (links, templates, images, categories, properties) is stored after the bundle; a
 * failure to store it is logged and does not cost the page its render.
 */
export async function renderArticle(articleId: string): Promise<RenderResult> {
  for (let attempt = 0; attempt < MAX_RENDER_ATTEMPTS; attempt++) {
    const article = await db.wikiArticle.findUnique({
      where: { id: articleId },
      select: { title: true, source: true, wikitext: true, contentHtml: true },
    });
    if (!article) return FAILED;

    const rendered = await renderSource(article);
    if (!rendered) return FAILED;

    const problem = describeRenderProblem(rendered.html, article.wikitext);
    if (problem) console.warn(`[WikiOS:render] "${article.title}": ${problem}; stored anyway.`);

    const stored = await db.wikiArticle.updateMany({
      where: { id: articleId, wikitext: article.wikitext },
      data: {
        contentHtml: rendered.html,
        renderedView: buildViewBundle(rendered.html),
        htmlSyncedAt: new Date(),
      },
    });
    if (stored.count > 0) {
      if (rendered.metadata && reportsAnything(rendered.metadata)) {
        await persistRenderMetadata(articleId, article.source, rendered.metadata).catch((error) =>
          console.warn(
            `[WikiOS:render] Storing what MediaWiki reported about "${article.title}" failed:`,
            error
          )
        );
      }
      return { ok: true };
    }
  }
  return SUPERSEDED;
}

// ---------------------------------------------------------------------------
// Single-flight, priority queue, concurrency cap, failure cool-down, deadline
// ---------------------------------------------------------------------------

/** Who is waiting for the render: a reader, an editor's save, or a backlog (inbound sync, import). */
const READER = 0;
const SAVE = 1;
const BACKGROUND = 2;

interface Waiter {
  articleId: string;
  priority: number;
  grant: () => void;
}

const inFlight = new Map<string, Promise<RenderResult>>();
const failedUntil = new Map<string, number>();
const waitingForSlot: Waiter[] = [];
let activeRenders = 0;

/** Keeps the queue ordered by priority, first come first served within one. */
function enqueueWaiter(waiter: Waiter): void {
  const index = waitingForSlot.findIndex((queued) => queued.priority > waiter.priority);
  if (index === -1) waitingForSlot.push(waiter);
  else waitingForSlot.splice(index, 0, waiter);
}

function acquireSlot(articleId: string, priority: number): Promise<void> {
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    activeRenders++;
    return Promise.resolve();
  }
  return new Promise((grant) => enqueueWaiter({ articleId, priority, grant }));
}

/** Hands the slot to the next waiter (the active count stays), or frees it. */
function releaseSlot(): void {
  const next = waitingForSlot.shift();
  if (next) next.grant();
  else activeRenders--;
}

/** Someone more urgent now waits for a render that is still queued: it moves up the queue. */
function promote(articleId: string, priority: number): void {
  const index = waitingForSlot.findIndex((queued) => queued.articleId === articleId);
  const waiter = waitingForSlot[index];
  if (!waiter || waiter.priority <= priority) return;
  waitingForSlot.splice(index, 1);
  waiter.priority = priority;
  enqueueWaiter(waiter);
}

function rememberFailure(articleId: string): void {
  failedUntil.delete(articleId);
  if (failedUntil.size >= MAX_REMEMBERED_FAILURES) {
    const oldest = failedUntil.keys().next().value;
    if (oldest !== undefined) failedUntil.delete(oldest);
  }
  failedUntil.set(articleId, Date.now() + FAILURE_COOLDOWN_MS);
}

/** `task`'s result, or FAILED once `ms` have passed; `task` itself cannot be cancelled. */
function withDeadline(task: Promise<RenderResult>, ms: number): Promise<RenderResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(`[WikiOS:render] A render ran past its ${ms} ms deadline and was abandoned.`);
      resolve(FAILED);
    }, ms);
    task.then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error: Error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** One round: wait for a slot, render (at most RENDER_DEADLINE_MS), free the slot. */
async function runRender(articleId: string, priority: number): Promise<RenderResult> {
  await acquireSlot(articleId, priority);
  try {
    return await withDeadline(renderArticle(articleId), RENDER_DEADLINE_MS);
  } catch (err) {
    console.warn(`[WikiOS:render] Rendering article ${articleId} failed:`, err);
    return FAILED;
  } finally {
    releaseSlot();
  }
}

/**
 * The whole job of one article: a render, and a new round (back through the queue) while saves
 * keep overtaking it. Only a text that never settles, or a real failure, ends as a failure.
 */
async function runJob(articleId: string, priority: number): Promise<RenderResult> {
  for (let round = 0; round < MAX_SUPERSEDED_ROUNDS; round++) {
    const result = await runRender(articleId, priority);
    if (!result.superseded) return result;
  }
  return FAILED;
}

/** The render of `articleId`: the one already queued or running, else a new one. Never rejects. */
function startRender(articleId: string, priority: number): Promise<RenderResult> {
  const running = inFlight.get(articleId);
  if (running) {
    promote(articleId, priority);
    return running;
  }

  const job = runJob(articleId, priority)
    .then((result) => {
      if (result.ok) failedUntil.delete(articleId);
      else rememberFailure(articleId);
      return result;
    })
    .finally(() => {
      inFlight.delete(articleId);
    });
  inFlight.set(articleId, job);
  return job;
}

/** The last render of `articleId` failed a moment ago and none is running: nobody retries it yet. */
function coolingDown(articleId: string): boolean {
  return (failedUntil.get(articleId) ?? 0) > Date.now() && !inFlight.has(articleId);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    void promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

/**
 * Make sure a render of `articleId` is running or done, and wait for it for at most `waitMs`.
 * Concurrent callers share one render (single-flight), and a reader who waits moves a queued render
 * to the front. Resolves with its result, or with null when `waitMs` ran out first (the render
 * carries on; the caller serves what it has). An article whose last render failed is not retried
 * for a short cool-down: the failure result comes back at once.
 */
export async function ensureRendered(
  articleId: string,
  { waitMs }: { waitMs: number }
): Promise<RenderResult | null> {
  if (coolingDown(articleId)) return FAILED;

  const render = startRender(articleId, waitMs > 0 ? READER : SAVE);
  return waitMs > 0 ? withTimeout(render, waitMs) : null;
}

/**
 * Queue a render for a reader who is served the article's outdated bundle meanwhile; fire-and-forget, as
 * backlog work (it never goes before a save or a reader who waits). Joins a render already queued or
 * running, and leaves an article that just failed to render alone until its cool-down is over.
 */
export function renderInBackground(articleId: string): void {
  if (coolingDown(articleId)) return;
  void startRender(articleId, BACKGROUND);
}

/**
 * Queue a render after a write of wikitext; fire-and-forget. A save comes before a backlog
 * (`background`: inbound sync, XML import), and a render already queued for the article moves up to
 * the save's place. A new write is a new attempt, so it clears the failure cool-down. Plan 407
 * makes background jobs durable; this queue is in memory.
 */
export function enqueueRender(articleId: string, options: { background?: boolean } = {}): void {
  failedUntil.delete(articleId);
  void startRender(articleId, options.background ? BACKGROUND : SAVE);
}

/** Template (10) and Module (828): the namespaces whose pages other pages transclude. */
const TRANSCLUDED_NAMESPACES: ReadonlySet<number> = new Set([10, 828]);

/**
 * `invalidateDependents` for a page that may be a template or a Lua module: when `title` is one, every
 * article that uses it is stale (a Template or Module that was deleted, restored, moved, or whose text
 * has only now reached MediaWiki, renders its users differently); any other page has no users to mark.
 */
export async function invalidateTemplateDependents(
  title: string,
  source = "ixwiki"
): Promise<number> {
  const canon = canonicalizeTitle(title, { source });
  if (!canon || !TRANSCLUDED_NAMESPACES.has(canon.namespaceId)) return 0;
  return invalidateDependents(canon.title, source);
}

/**
 * A page's text changed: every article that transcludes it (a template, a Lua module, another page)
 * no longer matches what MediaWiki would render, so each is marked stale (`htmlSyncedAt = NULL`).
 * Readers keep seeing the previous bundle until `renderStaleBatch` or a reader's own render replaces
 * it. Best effort (a failure is logged, the save that called it already happened); resolves to the
 * number of articles marked.
 */
export async function invalidateDependents(title: string, source = "ixwiki"): Promise<number> {
  try {
    return await db.$executeRaw`
      UPDATE wiki_articles SET "htmlSyncedAt" = NULL
      WHERE source = ${source}
        AND "htmlSyncedAt" IS NOT NULL
        AND id IN (SELECT "articleId" FROM wiki_template_links WHERE "templateTitle" = ${title})`;
  } catch (error) {
    console.warn(`[WikiOS:render] Marking the dependents of "${title}" stale failed:`, error);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// The stale batch: the backlog a changed template or an import leaves behind
// ---------------------------------------------------------------------------

/** Renders the batch runs at once: the private MediaWiki is small, and readers share its slots. */
const STALE_BATCH_CONCURRENCY = 2;
/** The batch starts no new render this long after it began (its cron job is cut off at 55 s). */
const STALE_BATCH_BUDGET_MS = 45_000;
/** An article whose batch render failed is left out for this long, doubling per failure up to the cap. */
const STALE_RETRY_BASE_MS = 60_000;
const STALE_RETRY_MAX_MS = 60 * 60_000;
const MAX_REMEMBERED_STALE_FAILURES = 5_000;

const staleFailures = new Map<string, { strikes: number; retryAt: number }>();

function rememberStaleFailure(articleId: string): void {
  const strikes = (staleFailures.get(articleId)?.strikes ?? 0) + 1;
  staleFailures.delete(articleId);
  if (staleFailures.size >= MAX_REMEMBERED_STALE_FAILURES) {
    const oldest = staleFailures.keys().next().value;
    if (oldest !== undefined) staleFailures.delete(oldest);
  }
  const wait = Math.min(STALE_RETRY_BASE_MS * 2 ** (strikes - 1), STALE_RETRY_MAX_MS);
  staleFailures.set(articleId, { strikes, retryAt: Date.now() + wait });
}

export interface StaleBatchResult {
  rendered: number;
  /** MediaWiki failed, or saves kept overtaking the render (see `runJob`). */
  failed: number;
}

/**
 * Published articles with text whose bundle another renderer version built. `not` on a JSON path never
 * matches a NULL column (SQL NULL <> x is not true): a row that was never rendered belongs to the
 * unsynced query, and a legacy row (NULL view, non-NULL htmlSyncedAt) is left as it always was.
 */
const OUTDATED_BUNDLE_WHERE = {
  status: "PUBLISHED",
  wikitext: { not: "" },
  renderedView: { path: ["rendererVersion"], not: RENDERER_VERSION },
} satisfies Prisma.WikiArticleWhereInput;

/** The most outdated articles one scan lists. */
const MAX_OUTDATED_BACKLOG = 100_000;
/** A scan that came back full is followed by one more when its backlog has drained, and no further. */
const MAX_OUTDATED_SCANS = 2;
/** Candidates one check query asks about, and the check queries one batch may run. */
const OUTDATED_CHECK_CHUNK = 200;
const MAX_OUTDATED_CHECKS_PER_BATCH = 3;
/**
 * A batch with no unsynced work renders up to this many articles from the backlog (instead of `limit`),
 * so a backlog drains faster; STALE_BATCH_BUDGET_MS still ends the batch in time for the cron cut-off.
 */
const OUTDATED_DRAIN_LIMIT = 60;

interface OutdatedBacklog {
  ids: Set<string>;
  /** The scan listed MAX_OUTDATED_BACKLOG articles: there may be more. */
  capped: boolean;
}

/**
 * ponytail: `RENDERER_VERSION` is a constant of the process, so articles only turn outdated at a deploy:
 * the backlog is found by ONE scan per process, started (never awaited) by the first batch with room so
 * it cannot hold up unsynced renders, and then it only shrinks; the per-minute query never evaluates the
 * JSON path. Once it is empty it stays empty: no rescan, except that a scan that came back full
 * (MAX_OUTDATED_BACKLOG articles) is followed by one more when its backlog has drained. A second process
 * started mid-backlog scans once itself, and what is still outdated after the rescan is left to
 * readers' background renders and the next deploy's process; all of that is fine.
 */
let outdatedBacklog: OutdatedBacklog | undefined;
let outdatedScans = 0;
let outdatedScan: Promise<void> | undefined;

async function scanOutdatedBacklog(): Promise<OutdatedBacklog> {
  const rows = await db.wikiArticle.findMany({
    where: OUTDATED_BUNDLE_WHERE,
    orderBy: { updatedAt: "asc" },
    take: MAX_OUTDATED_BACKLOG,
    select: { id: true },
  });
  return { ids: new Set(rows.map((row) => row.id)), capped: rows.length === MAX_OUTDATED_BACKLOG };
}

/**
 * Starts the scan for the backlog when none was made yet (or a full one has drained and its one rescan
 * is due), and does not wait for it: `outdatedBacklog` is set when it resolves. A failed scan is logged
 * and the next batch starts it again.
 */
function kickOutdatedScan(): void {
  const drained = outdatedBacklog?.capped && outdatedBacklog.ids.size === 0;
  const due = !outdatedBacklog || (drained && outdatedScans < MAX_OUTDATED_SCANS);
  if (!due || outdatedScan) return;
  outdatedScan = scanOutdatedBacklog()
    .then((backlog) => {
      outdatedBacklog = backlog;
      outdatedScans++;
    })
    .catch((error) =>
      console.warn("[WikiOS:render] Listing the articles with an outdated bundle failed:", error)
    )
    .finally(() => {
      outdatedScan = undefined;
    });
}

/**
 * Up to `want` ids from the head of the backlog that are not in `skip` (backing off, or already in the
 * batch) and are still outdated: an article a reader's render or a save has brought up to date since the
 * scan is dropped from the backlog. Picked ids stay in it until their render succeeds. The check is at most
 * MAX_OUTDATED_CHECKS_PER_BATCH queries of OUTDATED_CHECK_CHUNK ids each; what they do not reach waits.
 */
async function pickOutdated(
  backlog: Set<string>,
  want: number,
  skip: ReadonlySet<string>
): Promise<string[]> {
  const picked: string[] = [];
  const passed = new Set(skip);
  for (let query = 0; query < MAX_OUTDATED_CHECKS_PER_BATCH && picked.length < want; query++) {
    const candidates: string[] = [];
    for (const id of backlog) {
      if (candidates.length === OUTDATED_CHECK_CHUNK) break;
      if (!passed.has(id)) candidates.push(id);
    }
    if (candidates.length === 0) break;

    const current = await db.wikiArticle.findMany({
      where: { ...OUTDATED_BUNDLE_WHERE, id: { in: candidates } },
      select: { id: true },
    });
    const stillOutdated = new Set(current.map((row) => row.id));
    for (const id of candidates) {
      passed.add(id);
      if (!stillOutdated.has(id)) backlog.delete(id);
      else if (picked.length < want) picked.push(id);
    }
  }
  return picked;
}

/** Renders `queue` in order, `STALE_BATCH_CONCURRENCY` at a time, starting no render after `deadline`. */
async function renderQueue(
  queue: string[],
  deadline: number,
  result: StaleBatchResult
): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    for (let id = queue[next++]; id !== undefined && Date.now() < deadline; id = queue[next++]) {
      const outcome = await startRender(id, BACKGROUND);
      if (outcome.ok) {
        staleFailures.delete(id);
        outdatedBacklog?.ids.delete(id);
        result.rendered++;
      } else {
        rememberStaleFailure(id);
        result.failed++;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(STALE_BATCH_CONCURRENCY, queue.length) }, worker)
  );
}

/**
 * Render up to `limit` stale articles, two at a time, as background work (a reader's or an editor's
 * render goes before them). Run every minute by the `wiki-render-stale` cron job: a changed template
 * marks every page that uses it stale (`invalidateDependents`), and this brings their views up to date
 * without a reader having to wait. Those unsynced articles (`htmlSyncedAt` NULL) come first, oldest
 * first, and are rendered at once; the room they leave goes to the outdated backlog (bundles an earlier
 * renderer version built, see `outdatedBacklog`) as soon as its scan has resolved, in this batch if
 * the unsynced renders took that long, else in the next. A batch with no unsynced work takes up to
 * OUTDATED_DRAIN_LIMIT from the backlog. A deploy that changes the version so brings every stored view
 * up to date without ever holding up an edit. The batch starts no render 45 s after it began. An
 * article that failed is left out for a while (doubling, up to an hour) so a page MediaWiki cannot
 * render never keeps the rest of the queue waiting.
 */
export async function renderStaleBatch(limit = 20): Promise<StaleBatchResult> {
  const now = Date.now();
  const backingOff = [...staleFailures].flatMap(([id, failure]) =>
    failure.retryAt > now ? [id] : []
  );
  const unsynced = await db.wikiArticle.findMany({
    where: {
      status: "PUBLISHED",
      htmlSyncedAt: null,
      wikitext: { not: "" },
      ...(backingOff.length > 0 ? { id: { notIn: backingOff } } : {}),
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const unsyncedIds = unsynced.map((row) => row.id);
  const hasRoom = unsyncedIds.length < limit;
  if (hasRoom) kickOutdatedScan();

  const result: StaleBatchResult = { rendered: 0, failed: 0 };
  const deadline = now + STALE_BATCH_BUDGET_MS;
  await renderQueue(unsyncedIds, deadline, result);

  const backlog = hasRoom && Date.now() < deadline ? outdatedBacklog?.ids : undefined;
  if (backlog) {
    const room =
      unsyncedIds.length === 0 ? Math.max(limit, OUTDATED_DRAIN_LIMIT) : limit - unsyncedIds.length;
    const outdatedIds = await pickOutdated(backlog, room, new Set([...backingOff, ...unsyncedIds]));
    await renderQueue(outdatedIds, deadline, result);
  }
  return result;
}

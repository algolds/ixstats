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
 * Template chips (`{{MyCountry:...}}`) are stored as inert markers (see templates/chip-markers.ts)
 * and filled in per viewer, per request, by article-view-service.
 *
 * State here is per process (single-flight map, queue, cool-down): with several processes the worst
 * case is one extra render per process.
 */

import { z } from "zod";
import { db } from "~/server/db";
import {
  sanitizeWikiArticleHtml,
  wikiArticleSanitizerFingerprint,
} from "~/lib/utils/sanitize-html";
import { renderArticleViaMediaWiki } from "../adapters/mediawiki/parsoid";
import { markTemplateChips } from "../templates/chip-markers";
import { transformArticleHtml, stripConflictingStyles } from "../transformers/html-transformer";
import { parseWikitextToHtml } from "../transformers/wikitext-parser";

/** Bump when the bundle's shape or the transform changes. */
const RENDERER_BASE_VERSION = 2;

/**
 * What a bundle was built by: the transform's version plus a fingerprint of the sanitizer (its
 * rules and DOMPurify's version). A bundle of another version is never served, it re-renders, so a
 * sanitizer change reaches every stored article without anyone remembering to bump a number.
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
  const clean = (html: string) => sanitizeWikiArticleHtml(markTemplateChips(html));
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

/** The bundle and freshness of an article; null when it has no valid bundle of this renderer version. */
export async function loadViewBundle(
  articleId: string
): Promise<{ bundle: ViewBundle; htmlSyncedAt: Date | null } | null> {
  const row = await db.wikiArticle.findUnique({
    where: { id: articleId },
    select: { renderedView: true, htmlSyncedAt: true },
  });
  const parsed = viewBundleSchema.safeParse(row?.renderedView);
  return row && parsed.success ? { bundle: parsed.data, htmlSyncedAt: row.htmlSyncedAt } : null;
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

/**
 * The HTML to build the bundle from: MediaWiki's parse of the article's own wikitext, or, for an
 * HTML-only row with no wikitext, the stored HTML. Null when there is nothing or MediaWiki failed.
 */
async function renderSource(article: {
  title: string;
  wikitext: string;
  contentHtml: string | null;
}): Promise<string | null> {
  if (article.wikitext.trim() === "")
    return article.contentHtml?.trim() ? article.contentHtml : null;
  return renderArticleViaMediaWiki(article.wikitext, article.title);
}

/**
 * Render one article now: parse its wikitext, build the bundle and store it with the raw HTML and
 * `htmlSyncedAt = now`. The write is guarded by the wikitext it rendered, so a save that lands
 * meanwhile is never overwritten; the render then restarts on the new text. On a MediaWiki failure
 * nothing is stored: the previous bundle stays and the article stays stale. When every attempt was
 * overtaken by a save the result says `superseded`, which is not a failure.
 */
export async function renderArticle(articleId: string): Promise<RenderResult> {
  for (let attempt = 0; attempt < MAX_RENDER_ATTEMPTS; attempt++) {
    const article = await db.wikiArticle.findUnique({
      where: { id: articleId },
      select: { title: true, wikitext: true, contentHtml: true },
    });
    if (!article) return FAILED;

    const rawHtml = await renderSource(article);
    if (!rawHtml) return FAILED;

    const problem = describeRenderProblem(rawHtml, article.wikitext);
    if (problem) console.warn(`[WikiOS:render] "${article.title}": ${problem}; stored anyway.`);

    const stored = await db.wikiArticle.updateMany({
      where: { id: articleId, wikitext: article.wikitext },
      data: {
        contentHtml: rawHtml,
        renderedView: buildViewBundle(rawHtml),
        htmlSyncedAt: new Date(),
      },
    });
    if (stored.count > 0) return { ok: true };
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
  const coolingDown = (failedUntil.get(articleId) ?? 0) > Date.now();
  if (coolingDown && !inFlight.has(articleId)) return FAILED;

  const render = startRender(articleId, waitMs > 0 ? READER : SAVE);
  return waitMs > 0 ? withTimeout(render, waitMs) : null;
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

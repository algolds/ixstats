/**
 * article-view-service.ts — the IxWiki article read path.
 *
 * Serves the view bundle that render-service built once per revision: one indexed query, a
 * per-process view cache in front of the bundle read, and no MediaWiki call, sanitizer pass or
 * authorship lookup on a fresh article. Only an article that was never rendered (or is stale and
 * has no bundle) waits, bounded, for its render; if even that fails the reader gets what there is
 * (the previous bundle, else a locally compiled fallback) marked `stale`, and asks again soon.
 * Per-viewer template chips are filled in last, per request, into the bundle's inert markers.
 */

import { ByteBoundedCache } from "~/lib/cache/byte-bounded-cache";
import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { ArticleRepository, type ArticleViewHead } from "../core/article-repository";
import { canonicalizeTitle } from "../core/title";
import { chipKeysIn, substituteChipMarkers, templateKeysOf } from "../templates/chip-markers";
import { makeChip, resolveTemplates, type ResolvedTemplate } from "../templates/template-resolver";
import type { TocEntry } from "../transformers/html-transformer";
import { syncSinglePage } from "./auto-sync-service";
import { OutboundLimiter } from "./outbound-limiter";
import {
  ensureRendered,
  loadViewBundle,
  renderFallbackView,
  type ViewBundle,
} from "./render-service";

/** How long a reader waits for the first render of an article (the MediaWiki call's own timeout). */
const RENDER_WAIT_MS = 6_000;
/** A title Postgres does not have is imported from MediaWiki at most this often. */
const IMPORT_RETRY_MS = 60_000;
const MAX_REMEMBERED_IMPORTS = 5_000;
/** A view served while its render is pending or failed is reused this long (the render cool-down). */
const PENDING_VIEW_TTL_MS = 30_000;
const VIEW_TTL_MS = 10 * 60 * 1000;
/**
 * A chip-filled view is reused this long for the same viewer country: chips show live simulation
 * numbers, so they are kept for far less than the bundle.
 */
const CHIP_VIEW_TTL_MS = 60_000;

/**
 * ponytail: per-process cache of the parts of a view that do not depend on the viewer, bounded by
 * the bytes it holds (~64 MB of HTML per process), not by entry count: an article runs from 2 KB to
 * a few MB. Move to Redis if RSS matters. Keyed by the bundle's `htmlSyncedAt`, so a re-render is
 * a new key and the old entry just ages out.
 */
const VIEW_CACHE_MAX_BYTES = 64 * 1024 * 1024;
const viewCache = new ByteBoundedCache<SharedView>({
  maxBytes: VIEW_CACHE_MAX_BYTES,
  defaultTtlMs: VIEW_TTL_MS,
});

/**
 * Forget every view kept for the article `articleId`: its bundle view, a pending view and the views
 * filled with a viewer's chips (all keys carry the id between colons). A deleted or moved page must not
 * be served from here for the rest of the cache's lifetime.
 */
export function evictArticleView(articleId: string): number {
  return viewCache.deleteWhere((key) => key.includes(`:${articleId}:`));
}

/**
 * Imports from MediaWiki: anyone can ask for a page that does not exist, and each import is an HTTP
 * call. A few in flight, and a steady rate per process; past either the request is refused as busy
 * (`ThrottledError`), never answered "not found".
 */
const importLimiter = new OutboundLimiter({
  name: "Importing pages from MediaWiki",
  maxConcurrent: 4,
  perMinute: 30,
});

/**
 * Who asked for the page: a client call (the reader in a browser: `client`), or the server render of
 * a page request (`ssr`, which anyone, crawlers and scanners included, can trigger with any URL), or
 * a server render that is not a page request (`none`, e.g. a client navigation's RSC fetch).
 * A server render imports only for a request that asks for HTML, from a budget of its own: a flood
 * of junk URLs can empty that bucket and nothing else, and never the readers' one.
 */
export type ImportSource = "client" | "ssr" | "none";

const ssrImportLimiter = new OutboundLimiter({
  name: "Importing pages from MediaWiki for page requests",
  maxConcurrent: 2,
  perMinute: 10,
});

const LIMITERS: Record<Exclude<ImportSource, "none">, OutboundLimiter> = {
  client: importLimiter,
  ssr: ssrImportLimiter,
};

/** What an import for `source` runs under; a title that is not already in canonical form is never imported. */
function mayImport(title: string, source: ImportSource): source is Exclude<ImportSource, "none"> {
  return source !== "none" && canonicalizeTitle(title)?.title === title;
}

/** The viewer-independent part of a response. */
interface SharedView {
  contentHtml: string;
  infoboxHtml: string | null;
  noticesHtml: string | null;
  toc: TocEntry[];
  /** The template chips the bundle's markers ask for; empty for nearly every article. */
  chipKeys: string[];
  renderQuality: "rendered" | "fallback";
  /** A render is pending or failed: this is an older or degraded view, and the reader should ask again. */
  stale: boolean;
  /** The cache key of this fresh view (article and render time); null for a stale one, which is not keyed. */
  cacheKey: string | null;
}

export interface ArticleView extends Omit<SharedView, "chipKeys" | "cacheKey"> {
  /** The canonical title as stored. */
  title: string;
  categories: string[];
  lastModified: string | null;
}

const recentImports = new Map<string, number>();
const importsInFlight = new Map<string, Promise<boolean>>();

function toSharedView(
  bundle: ViewBundle,
  renderQuality: SharedView["renderQuality"],
  cacheKey: string | null
): SharedView {
  return {
    contentHtml: bundle.bodyHtml,
    infoboxHtml: bundle.infoboxHtml,
    noticesHtml: bundle.noticesHtml,
    toc: bundle.toc,
    chipKeys: chipKeysIn(bundle.bodyHtml, bundle.infoboxHtml, bundle.noticesHtml),
    renderQuality,
    stale: cacheKey === null,
    cacheKey,
  };
}

/** Bytes a view takes, counting every character as two (UTF-16) to stay on the safe side. */
function sizeOf(view: SharedView): number {
  const characters =
    view.contentHtml.length + (view.infoboxHtml?.length ?? 0) + (view.noticesHtml?.length ?? 0);
  return characters * 2 + view.toc.length * 200 + 512;
}

const viewKey = (articleId: string, htmlSyncedAt: Date) =>
  `view:${articleId}:${htmlSyncedAt.getTime()}`;

/** The key of the view served while a render is pending: it changes when the article is saved again. */
const pendingViewKey = (head: ArticleViewHead) =>
  `pending:${head.id}:${head.lastModified?.getTime() ?? 0}`;

/**
 * The viewer-independent view of an article, or null when it has no content to show (a stub).
 * A fresh bundle comes from the cache or one column read; otherwise the render is awaited, and
 * whatever exists afterwards (an older bundle, else a fallback) is served as `stale`.
 */
async function readSharedView(head: ArticleViewHead): Promise<SharedView | null> {
  const cacheKey = head.htmlSyncedAt ? viewKey(head.id, head.htmlSyncedAt) : pendingViewKey(head);
  const cached = viewCache.get(cacheKey);
  if (cached) return cached;

  let loaded = head.htmlSyncedAt ? await loadViewBundle(head.id) : null;
  if (!loaded?.htmlSyncedAt) {
    await ensureRendered(head.id, { waitMs: RENDER_WAIT_MS });
    loaded = await loadViewBundle(head.id);
  }

  if (loaded?.htmlSyncedAt) {
    const key = viewKey(head.id, loaded.htmlSyncedAt);
    const fresh = toSharedView(loaded.bundle, "rendered", key);
    viewCache.set(key, fresh, sizeOf(fresh));
    return fresh;
  }

  const fallback = loaded ? null : await renderFallbackView(head.id);
  const pending = loaded
    ? toSharedView(loaded.bundle, "rendered", null)
    : fallback && toSharedView(fallback, "fallback", null);
  if (pending) viewCache.set(pendingViewKey(head), pending, sizeOf(pending), PENDING_VIEW_TTL_MS);
  return pending;
}

/** True when `title` was tried less than IMPORT_RETRY_MS ago. */
function importedRecently(title: string): boolean {
  return (recentImports.get(title) ?? 0) > Date.now();
}

/** Remember that `title` is being imported now. Bounded. */
function recordImport(title: string): void {
  const now = Date.now();
  recentImports.delete(title);
  if (recentImports.size >= MAX_REMEMBERED_IMPORTS) {
    for (const [known, until] of recentImports) {
      if (until <= now) recentImports.delete(known);
    }
  }
  if (recentImports.size >= MAX_REMEMBERED_IMPORTS) {
    const oldest = recentImports.keys().next().value;
    if (oldest !== undefined) recentImports.delete(oldest);
  }
  recentImports.set(title, now + IMPORT_RETRY_MS);
}

/**
 * Import `title` from MediaWiki: one import per title at a time (concurrent first readers await the
 * same one), at most one try per title per minute, and only while the limiter has room. Resolves
 * true when a page came of it; rejects with `ThrottledError` when it was not even tried.
 */
function importFromMediaWiki(
  title: string,
  source: Exclude<ImportSource, "none">
): Promise<boolean> {
  const running = importsInFlight.get(title);
  if (running) return running;
  if (importedRecently(title)) return Promise.resolve(false);

  const attempt = LIMITERS[source]
    .run(() => {
      recordImport(title);
      return syncSinglePage(title);
    })
    .finally(() => {
      importsInFlight.delete(title);
    });
  importsInFlight.set(title, attempt);
  return attempt;
}

/** The article and its viewer-independent view; null when there is nothing to show (a stub). */
async function readArticle(
  head: ArticleViewHead | null
): Promise<{ head: ArticleViewHead; shared: SharedView } | null> {
  const shared = head && (await readSharedView(head));
  return head && shared ? { head, shared } : null;
}

/**
 * The article for `title`. A deleted (ARCHIVED) page is "not found" for a reader `canSeeDeleted`
 * refuses, and is never imported again. When Postgres has no row (or only a stub) the page is
 * imported from MediaWiki first, then looked at once more.
 */
async function findArticle(
  title: string,
  canSeeDeleted: () => Promise<boolean>,
  importSource: ImportSource
) {
  const head = await ArticleRepository.findArticleForView(title);
  if (head?.status === "ARCHIVED" && !(await canSeeDeleted())) return null;
  const found = await readArticle(head);
  if (found || !mayImport(title, importSource)) return found;
  if (!(await importFromMediaWiki(title, importSource))) return found;
  return readArticle(await ArticleRepository.findArticleForView(title));
}

function statPlaceholder(key: string): string {
  return `<span class="wikios-stat-placeholder" data-key="${key}"></span>`;
}

/** `shared` with each chip marker replaced by the viewer's chip, or by a placeholder when its key did not resolve. */
function fillChips(shared: SharedView, resolved: Map<string, ResolvedTemplate>): SharedView {
  const chipFor = (key: string) => {
    const entry = resolved.get(key);
    return entry ? makeChip(key, entry.value) : statPlaceholder(key);
  };
  // A part that changed goes through the sanitizer once more, before anything is served or kept.
  const fill = (html: string) => {
    const filled = substituteChipMarkers(html, chipFor);
    return filled === html ? html : sanitizeWikiArticleHtml(filled);
  };
  return {
    ...shared,
    contentHtml: fill(shared.contentHtml),
    infoboxHtml: shared.infoboxHtml && fill(shared.infoboxHtml),
    noticesHtml: shared.noticesHtml && fill(shared.noticesHtml),
    chipKeys: [],
  };
}

/**
 * `shared` with the viewer's chips in it (only exact markers are touched). A fresh view is kept per
 * viewer country for a minute, so a popular chip page is filled and sanitized once per country, not
 * once per request; a view whose chips could not be resolved is never kept.
 */
async function withViewerChips(
  shared: SharedView,
  getViewerCountryId: () => Promise<string | null>
): Promise<SharedView> {
  if (shared.chipKeys.length === 0) return shared;

  let countryId: string | null;
  try {
    countryId = await getViewerCountryId();
  } catch {
    return fillChips(shared, new Map()); // the client resolves the placeholders itself
  }
  const key = shared.cacheKey && `chips:${shared.cacheKey}:${countryId ?? "-"}`;
  const cached = key ? viewCache.get(key) : undefined;
  if (cached) return cached;

  let resolved: Map<string, ResolvedTemplate>;
  try {
    resolved = await resolveTemplates(templateKeysOf(shared.chipKeys), {
      activeCountryId: countryId,
    });
  } catch {
    return fillChips(shared, new Map());
  }
  const filled = fillChips(shared, resolved);
  if (key) viewCache.set(key, filled, sizeOf(filled), CHIP_VIEW_TTL_MS);
  return filled;
}

/**
 * The reader's view of the IxWiki article `title` (already canonical, redirects already followed),
 * or null when there is no such article. `getViewerCountryId` is called only for an article that
 * carries per-viewer template chips, `canSeeDeleted` only for a deleted page. A missing article is
 * imported from MediaWiki as `importSource` allows. Rejects with `ThrottledError` when the article is
 * missing and MediaWiki could not be asked about it right now.
 */
export async function getArticleView(
  title: string,
  getViewerCountryId: () => Promise<string | null>,
  canSeeDeleted: () => Promise<boolean> = () => Promise.resolve(false),
  importSource: ImportSource = "client"
): Promise<ArticleView | null> {
  const found = await findArticle(title, canSeeDeleted, importSource);
  if (!found) return null;

  const view = await withViewerChips(found.shared, getViewerCountryId);
  return {
    contentHtml: view.contentHtml,
    infoboxHtml: view.infoboxHtml,
    noticesHtml: view.noticesHtml,
    toc: view.toc,
    renderQuality: view.renderQuality,
    stale: view.stale,
    title: found.head.title,
    categories: found.head.categories,
    lastModified: found.head.lastModified?.toISOString() ?? null,
  };
}

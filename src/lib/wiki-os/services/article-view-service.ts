/**
 * article-view-service.ts — the IxWiki article read path.
 *
 * Serves the view bundle that render-service built once per revision: one indexed query, a
 * per-process view cache in front of the bundle read, and no MediaWiki call, sanitizer pass or
 * authorship lookup on a fresh article. Only an article that was never rendered (or is stale and
 * has no bundle) waits, bounded, for its render; if even that fails the reader gets a locally
 * compiled, non-persisted fallback. Per-viewer template chips are applied last, per request.
 */

import { Cache } from "~/lib/cache/cache";
import { ArticleRepository, type ArticleViewHead } from "../core/article-repository";
import {
  applyResolvedTemplates,
  extractTemplateKeys,
  resolveTemplates,
  type TemplateKey,
} from "../templates/template-resolver";
import type { TocEntry } from "../transformers/html-transformer";
import { syncSinglePage } from "./auto-sync-service";
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
/** Imports from MediaWiki in flight at once: a crawler asking for made-up titles cannot fan out. */
const MAX_CONCURRENT_IMPORTS = 4;

/**
 * ponytail: per-process cache of the parts of a view that do not depend on the viewer. Ceiling:
 * 300 entries x a typical 100-300 KB article = at most ~90 MB of RSS per process; move to Redis if
 * RSS matters. Keyed by the bundle's `htmlSyncedAt`, so a re-render is a new key and the old entry
 * just ages out.
 */
const viewCache = new Cache<SharedView>({ maxSize: 300, defaultTtlMs: 10 * 60 * 1000 });

/** The viewer-independent part of a response. */
interface SharedView {
  contentHtml: string;
  infoboxHtml: string | null;
  noticesHtml: string | null;
  toc: TocEntry[];
  /** The template chips this article asks for; empty for nearly every article. */
  templateKeys: TemplateKey[];
  renderQuality: "rendered" | "fallback";
}

export interface ArticleView extends Omit<SharedView, "templateKeys"> {
  /** The canonical title as stored. */
  title: string;
  categories: string[];
  lastModified: string | null;
}

const recentImports = new Map<string, number>();
let importsRunning = 0;

function toSharedView(bundle: ViewBundle, renderQuality: SharedView["renderQuality"]): SharedView {
  return {
    contentHtml: bundle.bodyHtml,
    infoboxHtml: bundle.infoboxHtml,
    noticesHtml: bundle.noticesHtml,
    toc: bundle.toc,
    templateKeys: extractTemplateKeys(bundle.bodyHtml),
    renderQuality,
  };
}

const viewKey = (articleId: string, htmlSyncedAt: Date) =>
  `view:${articleId}:${htmlSyncedAt.getTime()}`;

/**
 * The viewer-independent view of an article, or null when it has no content to show (a stub).
 * A fresh bundle comes from the cache or one column read; otherwise the render is awaited, and
 * whatever bundle exists afterwards (even a stale one) is served.
 */
async function readSharedView(head: ArticleViewHead): Promise<SharedView | null> {
  if (head.htmlSyncedAt) {
    const cached = viewCache.get(viewKey(head.id, head.htmlSyncedAt));
    if (cached) return cached;
  }

  let loaded = head.htmlSyncedAt ? await loadViewBundle(head.id) : null;
  if (!loaded?.htmlSyncedAt) {
    await ensureRendered(head.id, { waitMs: RENDER_WAIT_MS });
    loaded = await loadViewBundle(head.id);
  }

  if (!loaded) {
    const fallback = await renderFallbackView(head.id);
    return fallback && toSharedView(fallback, "fallback");
  }
  const shared = toSharedView(loaded.bundle, "rendered");
  // A stale bundle (the render failed or timed out) is served but never cached under a key.
  if (loaded.htmlSyncedAt) viewCache.set(viewKey(head.id, loaded.htmlSyncedAt), shared);
  return shared;
}

/** True when `title` was imported less than IMPORT_RETRY_MS ago; records this try. Bounded. */
function importedRecently(title: string): boolean {
  const now = Date.now();
  if ((recentImports.get(title) ?? 0) > now) return true;

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
  return false;
}

/** The article and its viewer-independent view; null when there is no row or nothing to show (a stub). */
async function readArticle(
  title: string
): Promise<{ head: ArticleViewHead; shared: SharedView } | null> {
  const head = await ArticleRepository.findArticleForView(title);
  const shared = head && (await readSharedView(head));
  return head && shared ? { head, shared } : null;
}

/** Import `title` from MediaWiki: once per title per minute, and never more than a few at a time. */
async function importFromMediaWiki(title: string): Promise<boolean> {
  if (importsRunning >= MAX_CONCURRENT_IMPORTS || importedRecently(title)) return false;
  importsRunning++;
  try {
    return await syncSinglePage(title);
  } finally {
    importsRunning--;
  }
}

/**
 * The article for `title`. When Postgres has no row (or only a stub) it is imported from
 * MediaWiki first, then looked at once more.
 */
async function findArticle(title: string) {
  const found = await readArticle(title);
  if (found || !(await importFromMediaWiki(title))) return found;
  return readArticle(title);
}

async function withViewerChips(
  shared: SharedView,
  getViewerCountryId: () => Promise<string | null>
): Promise<SharedView> {
  if (shared.templateKeys.length === 0) return shared;
  try {
    const resolved = await resolveTemplates(shared.templateKeys, {
      activeCountryId: await getViewerCountryId(),
    });
    const apply = (html: string | null) => (html ? applyResolvedTemplates(html, resolved) : html);
    return {
      ...shared,
      contentHtml: applyResolvedTemplates(shared.contentHtml, resolved),
      infoboxHtml: apply(shared.infoboxHtml),
      noticesHtml: apply(shared.noticesHtml),
    };
  } catch {
    return shared;
  }
}

/**
 * The reader's view of the IxWiki article `title` (already canonical, redirects already followed),
 * or null when there is no such article. `getViewerCountryId` is called only for an article that
 * carries per-viewer template chips.
 */
export async function getArticleView(
  title: string,
  getViewerCountryId: () => Promise<string | null>
): Promise<ArticleView | null> {
  const found = await findArticle(title);
  if (!found) return null;

  const view = await withViewerChips(found.shared, getViewerCountryId);
  return {
    contentHtml: view.contentHtml,
    infoboxHtml: view.infoboxHtml,
    noticesHtml: view.noticesHtml,
    toc: view.toc,
    renderQuality: view.renderQuality,
    title: found.head.title,
    categories: found.head.categories,
    lastModified: found.head.lastModified?.toISOString() ?? null,
  };
}

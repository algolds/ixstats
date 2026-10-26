/**
 * sister-render-service.ts: the reader's HTML for a page of another wiki (`?source=iiwiki|althistory`).
 *
 * The page is rendered by **that wiki's own parser**: `action=parse&oldid=<the revision WikiOS read>` (by title
 * when the revision is unknown), so its templates, parser functions and modules resolve against its own pages,
 * never against IxWiki's (plan 415, BUG-09: they used to be posted to IxWiki's engine, which has other templates).
 * It is a GET through the wiki's configured api.php (`getMediaWikiApiUrl`): in development iiwiki's relay, which
 * passes the Cloudflare challenge this server cannot. The request carries the allow-listed `IxStats-Builder` user
 * agent and goes through the upstream guard (upstream-guard.ts: a breaker and a limiter per host), so a wiki that
 * cannot be reached throws WikiUnavailableError, which is never cached. An answer for another page (a relay that
 * drops `oldid` parses an empty page called "API") is refused. The answer is transformed for the
 * reader and sanitized by `sanitizeSisterHtml`, the trust boundary for another wiki's HTML (images only through its
 * media proxy, no off-host `url()` or fixed positioning, external links inert), and cached
 * per `(source, title, revision)` for ten minutes, 200 pages: a page that changes has a new revision, so it is never
 * served stale, and a reader who opens a sister page twice does not render it twice.
 */
import { sanitizeSisterHtml, SISTER_ID_PREFIX } from "~/lib/utils/sanitize-sister-html";
import { Cache } from "~/lib/cache";
import { readSisterJson } from "~/lib/wiki-os/adapters/mediawiki/bridge/http-reader";
import type { SisterWikiSource, WikiArticle } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";
import { getMediaWikiApiUrl } from "~/lib/wiki-os/config";
import {
  stripConflictingStyles,
  transformArticleHtml,
  type TocEntry,
} from "~/lib/wiki-os/transformers/html-transformer";

export interface SisterRender {
  contentHtml: string;
  infoboxHtml: string | null;
  noticesHtml: string | null;
  toc: TocEntry[];
}

/**
 * A sister wiki answered but did not render the page: no parse result (its own error, when it gave one), or the parse
 * of another page. A wiki that did not answer is WikiUnavailableError instead.
 */
export class SisterRenderError extends Error {
  constructor(
    readonly source: SisterWikiSource,
    message: string
  ) {
    super(`${source} could not render the page: ${message}`);
    this.name = "SisterRenderError";
  }
}

const RENDER_TIMEOUT_MS = 15_000;
/**
 * The API errors of `action=parse` that are the page's own answer (`SisterRenderError`); any other (`maxlag`, an
 * internal error) is the wiki failing to answer (WikiUnavailableError, never cached).
 */
const PAGE_REFUSALS: ReadonlySet<string> = new Set([
  "missingtitle",
  "nosuchpageid",
  "nosuchrevid",
  "invalidtitle",
  "permissiondenied",
  "pagecannotexist",
]);

const renders = new Cache<SisterRender>({ maxSize: 200, defaultTtlMs: 10 * 60 * 1000 });
/** Renders under way, so two readers of the same revision at once cost one request. */
const inFlight = new Map<string, Promise<SisterRender>>();

interface ParseAnswer {
  parse?: { title?: string; text?: string };
  error?: { info?: string };
}

/** The `action=parse` request for `article`: the revision WikiOS read, or the page by title. */
function parseUrl(source: SisterWikiSource, article: WikiArticle): string {
  const [key, value] =
    article.revId === undefined ? ["page", article.title] : ["oldid", String(article.revId)];
  const query = new URLSearchParams({
    action: "parse",
    [key]: value,
    prop: "text",
    disablelimitreport: "1",
    disableeditsection: "1",
    formatversion: "2",
    format: "json",
  });
  return `${getMediaWikiApiUrl(source)}?${query}`;
}

async function renderOnItsWiki(
  source: SisterWikiSource,
  article: WikiArticle
): Promise<SisterRender> {
  const answer = await readSisterJson<ParseAnswer>(
    parseUrl(source, article),
    RENDER_TIMEOUT_MS,
    PAGE_REFUSALS
  );
  const html = answer?.parse?.text;
  if (!html) throw new SisterRenderError(source, answer?.error?.info ?? "no parse result");
  if (answer.parse?.title !== article.title) {
    throw new SisterRenderError(
      source,
      `it parsed "${answer.parse?.title}", not "${article.title}"`
    );
  }

  const transformed = transformArticleHtml(stripConflictingStyles(html), "", source);
  const sanitize = (part: string) => sanitizeSisterHtml(part, source, { embed: false });
  return {
    contentHtml: sanitize(transformed.contentHtml),
    infoboxHtml: transformed.infoboxHtml ? sanitize(transformed.infoboxHtml) : null,
    noticesHtml: transformed.noticesHtml ? sanitize(transformed.noticesHtml) : null,
    // the sanitizer prefixes every id: the contents name the headings as the page now does
    toc: transformed.toc.map((entry) => ({ ...entry, id: `${SISTER_ID_PREFIX}${entry.id}` })),
  };
}

/** The reader's HTML of `article` (its wikitext as `source` holds it), rendered by `source` itself. */
export async function renderSisterArticle(
  source: SisterWikiSource,
  article: WikiArticle
): Promise<SisterRender> {
  // A page whose revision is unknown cannot be told from its successor: it is rendered every time.
  const key =
    article.revId === undefined ? null : `${source}\u0000${article.title}\u0000${article.revId}`;
  if (key === null) return renderOnItsWiki(source, article);

  const cached = renders.get(key);
  if (cached) return cached;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const rendering = renderOnItsWiki(source, article)
    .then((render) => {
      renders.set(key, render);
      return render;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, rendering);
  return rendering;
}

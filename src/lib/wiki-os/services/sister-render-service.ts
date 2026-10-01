/**
 * sister-render-service.ts: the reader's HTML for a page of another wiki (`?source=iiwiki|althistory`).
 *
 * The page's wikitext is rendered by **that wiki's own parser** (`action=parse&text=&title=` on its own
 * api.php), so its templates, parser functions and modules resolve against its own pages, never against
 * IxWiki's (plan 415, BUG-09: they used to be posted to IxWiki's engine, which has other templates).
 * The request carries the allow-listed `IxStats-Builder` user agent and goes through the bridge's fetch
 * helper, which keeps iiwiki's Cloudflare circuit breaker. The answer is transformed for the reader and
 * sanitized like any other article HTML (another wiki's HTML is as untrusted as a user's), and cached per
 * `(source, title, revision)` for ten minutes, 200 pages: a page that changes has a new revision, so it
 * is never served stale, and a reader who opens a sister page twice does not render it twice.
 */
import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { Cache } from "~/lib/cache";
import { fetchExternalWiki } from "~/lib/wiki-os/adapters/mediawiki/bridge/http-reader";
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

/** A sister wiki could not render a page: it was unreachable, refused, or answered without a parse. */
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

const renders = new Cache<SisterRender>({ maxSize: 200, defaultTtlMs: 10 * 60 * 1000 });
/** Renders under way, so two readers of the same revision at once cost one request. */
const inFlight = new Map<string, Promise<SisterRender>>();

interface ParseAnswer {
  parse?: { text?: string };
  error?: { info?: string };
}

/** The form `action=parse` takes to render `article`'s wikitext in the context of its own title. */
function parseForm(article: WikiArticle): URLSearchParams {
  return new URLSearchParams({
    action: "parse",
    text: article.wikitext,
    title: article.title,
    contentmodel: "wikitext",
    prop: "text",
    disablelimitreport: "1",
    disableeditsection: "1",
    formatversion: "2",
    format: "json",
  });
}

async function renderOnItsWiki(source: SisterWikiSource, article: WikiArticle): Promise<SisterRender> {
  const response = await fetchExternalWiki(
    getMediaWikiApiUrl(source),
    RENDER_TIMEOUT_MS,
    parseForm(article)
  );
  if (!response) throw new SisterRenderError(source, "it did not answer");

  const answer = (await response.json()) as ParseAnswer;
  const html = answer.parse?.text;
  if (!html) throw new SisterRenderError(source, answer.error?.info ?? "no parse result");

  const transformed = transformArticleHtml(stripConflictingStyles(html), "", source);
  return {
    contentHtml: sanitizeWikiArticleHtml(transformed.contentHtml),
    infoboxHtml: transformed.infoboxHtml ? sanitizeWikiArticleHtml(transformed.infoboxHtml) : null,
    noticesHtml: transformed.noticesHtml ? sanitizeWikiArticleHtml(transformed.noticesHtml) : null,
    toc: transformed.toc,
  };
}

/** The reader's HTML of `article` (its wikitext as `source` holds it), rendered by `source` itself. */
export async function renderSisterArticle(
  source: SisterWikiSource,
  article: WikiArticle
): Promise<SisterRender> {
  // A page whose revision is unknown cannot be told from its successor: it is rendered every time.
  const key = article.revId === undefined ? null : `${source}\u0000${article.title}\u0000${article.revId}`;
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

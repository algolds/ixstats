/**
 * revision-view-service.ts — one old revision as the reader shows it (`?oldid=<ref>`).
 *
 * The revision's own wikitext goes through the same MediaWiki parse and view-bundle transform the
 * render service uses for the current text, but nothing is stored: an old revision is rarely asked
 * for, and its HTML never changes, so a small in-process LRU (100 entries, keyed by revision
 * reference) is all the cache it needs. MediaWiki is asked at most a few times a minute
 * (`OutboundLimiter`); past that the caller gets `ThrottledError`, never a wrong answer.
 * Template chips are left as the client's stat placeholders: a revision has no per-viewer chips.
 */

import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { renderArticleViaMediaWiki } from "../adapters/mediawiki/parsoid";
import { getRevisionWikitext } from "../adapters/mediawiki/bridge";
import { CHIP_ATTRIBUTE, substituteChipMarkers } from "../templates/chip-markers";
import type { TocEntry } from "../transformers/html-transformer";
import { parseWikitextToHtml } from "../transformers/wikitext-parser";
import { OutboundLimiter } from "./outbound-limiter";
import { buildViewBundle } from "./render-service";

/** Old revisions kept rendered, least recently used out first. */
export const MAX_CACHED_REVISIONS = 100;

export interface RevisionView {
  /** The canonical title of the page the revision belongs to. */
  title: string;
  /** When the revision was saved (ISO 8601). */
  timestamp: string;
  contentHtml: string;
  infoboxHtml: string | null;
  noticesHtml: string | null;
  toc: TocEntry[];
  /** "fallback" when MediaWiki could not render it and the local compiler did (no templates, no Lua). */
  renderQuality: "rendered" | "fallback";
}

export type RevisionViewResult =
  | { status: "ok"; view: RevisionView }
  | { status: "missing" }
  /** The revision exists but its text was never imported (or was deleted): it cannot be shown. */
  | { status: "text-unavailable" };

const renderLimiter = new OutboundLimiter({
  name: "Rendering old revisions",
  maxConcurrent: 2,
  perMinute: 30,
});

const cache = new Map<string, RevisionView>();
const inFlight = new Map<string, Promise<RevisionViewResult>>();

/** Keep `ref` as the most recently used entry and drop the oldest past the bound. */
function remember(ref: string, view: RevisionView): void {
  cache.delete(ref);
  cache.set(ref, view);
  if (cache.size > MAX_CACHED_REVISIONS) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

const placeholderFor = (key: string) =>
  `<span class="wikios-stat-placeholder" data-key="${key}"></span>`;

/** `html` with each chip marker turned into the stat placeholder the client resolves; sanitized again when it changed. */
function withPlaceholders(html: string | null): string | null {
  if (!html?.includes(CHIP_ATTRIBUTE)) return html;
  return sanitizeWikiArticleHtml(substituteChipMarkers(html, placeholderFor));
}

async function renderRevision(
  ref: string,
  revision: { title: string; timestamp: string; wikitext: string }
): Promise<RevisionViewResult> {
  const { wikitext } = revision;
  const page = await renderLimiter.run(() => renderArticleViaMediaWiki(wikitext, revision.title));
  const rendered = page?.html ?? null;
  const html = rendered ?? parseWikitextToHtml(wikitext, "ixwiki");
  const bundle = buildViewBundle(html);

  const view: RevisionView = {
    title: revision.title,
    timestamp: revision.timestamp,
    contentHtml: withPlaceholders(bundle.bodyHtml) ?? "",
    infoboxHtml: withPlaceholders(bundle.infoboxHtml),
    noticesHtml: withPlaceholders(bundle.noticesHtml),
    toc: bundle.toc,
    renderQuality: rendered === null ? "fallback" : "rendered",
  };
  // A view the local compiler made is not kept: MediaWiki may well render it next time.
  if (rendered !== null) remember(ref, view);
  return { status: "ok", view };
}

/**
 * The rendered revision `ref` (a MediaWiki rev_id or a WikiOS revision id), for a caller `canSee`
 * allows the revision's page to: a revision of a deleted page is "missing" to everyone else, cached
 * or not. Concurrent requests for one revision share one render. Rejects with `ThrottledError` when
 * MediaWiki could not be asked.
 */
export async function getRevisionView(
  ref: string,
  canSee: (title: string) => Promise<boolean>
): Promise<RevisionViewResult> {
  const cached = cache.get(ref);
  if (cached) {
    if (!(await canSee(cached.title))) return { status: "missing" };
    remember(ref, cached);
    return { status: "ok", view: cached };
  }

  const revision = await getRevisionWikitext(ref);
  if (!revision || !(await canSee(revision.title))) return { status: "missing" };
  if (revision.wikitext === null) return { status: "text-unavailable" };
  const text = { ...revision, wikitext: revision.wikitext };

  const running = inFlight.get(ref);
  if (running) return running;
  const attempt = renderRevision(ref, text).finally(() => inFlight.delete(ref));
  inFlight.set(ref, attempt);
  return attempt;
}

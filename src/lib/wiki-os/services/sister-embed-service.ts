/**
 * sister-embed-service.ts: the live embed behind a `Template:Sister` box (sister-embed.ts): the whole page, one
 * section, the infobox or a card of a page on a sister wiki (IIWiki, AltHistory), for `wikios.sisterEmbed`.
 *
 * The page is read and rendered the way the reader does (`getArticleWikitext`, then `renderSisterArticle`: that wiki's
 * own parser, through the upstream guard, sanitized), and the part is sliced from that render (sister-embed-parts.ts).
 * An HTML part is cut to `MAX_EMBED_HTML_CHARS` and sanitized again for embedding (`sanitizeSisterHtml` with
 * `embed: true`: no `<style>`, no `id`, no data attribute but the allowlisted ones, so no `Template:Sister` box inside
 * it is ever hydrated).
 *
 * Amplification (plan Review Focus 5): each (wiki, title, mode, section) is read once an hour (a missing page every
 * 10 minutes), and readers asking for it at once share one read. A wiki that cannot be reached throws
 * WikiUnavailableError, which is never cached. The cache is an LRU of at most 500 embeds of at most
 * `MAX_EMBED_HTML_CHARS` each. The page cap (`MAX_SISTER_EMBEDS`) is the reader's: this server cannot tell which page
 * asks, so a client that skips it is bounded by the `sisterwiki` rate limit per caller (120 a minute), this cache and
 * single flight per embed, and the per-host guard (8 in flight, 240 a minute) on everything that leaves for the wiki.
 *
 * Server only: it calls the sister wikis.
 */
import { Cache } from "~/lib/cache";
import { sanitizeSisterHtml } from "~/lib/utils/sanitize-sister-html";
import { getArticleWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge/dispatchers";
import type { SisterEmbedRequest } from "~/lib/wiki-os/sister-embed";
import { cardOf, sectionOf, trimHtml } from "~/lib/wiki-os/sister-embed-parts";
import {
  renderSisterArticle,
  type SisterRender,
} from "~/lib/wiki-os/services/sister-render-service";

export type SisterEmbed =
  | { status: "ok"; kind: "html"; title: string; html: string }
  | { status: "ok"; kind: "card"; title: string; summary: string; imageUrl: string | null }
  | { status: "missing" }
  | { status: "no-part"; part: "section" | "infobox" };

/** The longest HTML an embed holds (before its last sanitize); a longer part keeps its first blocks. */
export const MAX_EMBED_HTML_CHARS = 100_000;
const EMBED_TTL_MS = 3_600_000;
const MISSING_TTL_MS = 600_000;

const embeds = new Cache<SisterEmbed>({
  maxSize: 500,
  defaultTtlMs: EMBED_TTL_MS,
  namespace: "sister-embed",
});
/** Embeds being read, so readers asking for one at once share its read. */
const inFlight = new Map<string, Promise<SisterEmbed>>();

/** The part of `render` the request asks for, as its HTML; null when the page has no such part. */
function htmlPart(request: SisterEmbedRequest, render: SisterRender): string | null {
  if (request.mode === "infobox") return render.infoboxHtml;
  if (request.mode === "section") return sectionOf(render.contentHtml, request.section ?? "");
  return (render.infoboxHtml ?? "") + render.contentHtml;
}

async function readEmbed(request: SisterEmbedRequest): Promise<SisterEmbed> {
  const article = await getArticleWikitext(request.title, request.wiki);
  if (!article) return { status: "missing" };
  const render = await renderSisterArticle(request.wiki, article);
  const { title } = article;
  if (request.mode === "card") {
    return { status: "ok", kind: "card", title, ...cardOf(render, request.wiki) };
  }

  const part = htmlPart(request, render);
  if (part === null) {
    return { status: "no-part", part: request.mode === "infobox" ? "infobox" : "section" };
  }
  const html = sanitizeSisterHtml(trimHtml(part, MAX_EMBED_HTML_CHARS), request.wiki, {
    embed: true,
  });
  return { status: "ok", kind: "html", title, html };
}

/**
 * The embed `request` asks for: the part as sanitized HTML, a card, `missing` (no such page) or `no-part` (no such
 * section, or no infobox). Throws WikiUnavailableError when the wiki cannot be reached (never cached).
 */
export async function getSisterEmbed(request: SisterEmbedRequest): Promise<SisterEmbed> {
  const key = [request.wiki, request.title, request.mode, request.section ?? ""].join("\u0000");
  const cached = embeds.get(key);
  if (cached) return cached;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const reading = readEmbed(request)
    .then((embed) => {
      embeds.set(key, embed, embed.status === "missing" ? MISSING_TTL_MS : EMBED_TTL_MS);
      return embed;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, reading);
  return reading;
}

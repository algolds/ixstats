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
 * A page the wiki answers for but cannot render (`SisterRenderError`: a parse error of its own) is `unrenderable`: that
 * says something about the page, not that the wiki is down, so it is kept like a missing page.
 *
 * Amplification (plan Review Focus 5): each (wiki, title, mode, section) is read once an hour (a missing or
 * unrenderable page every 10 minutes), and readers asking for it at once share one read. Every spelling of a title
 * (`canonicalOrTrimmedTitle`: `_` as space, trimmed, spaces collapsed, first letter upper-cased) and of a section
 * (`headingKey`) is one entry. A wiki that cannot be reached throws WikiUnavailableError, which is never cached. The
 * cache is an LRU bounded in bytes (`EMBED_CACHE_BYTES`, 32 MB, each entry counted at two bytes a character of its
 * JSON and key plus 256), and an HTML part holds at most `MAX_EMBED_HTML_CHARS`. The page cap (`MAX_SISTER_EMBEDS`) is the reader's: this server cannot tell which page
 * asks, so a client that skips it is bounded by the `sisterwiki` rate limit per caller (120 a minute), a lower limit
 * per caller on the embeds that are not cached (`admitRead`, the router's: the reads that cost the wiki a call),
 * this cache and single flight per embed, and the per-host guard (8 in flight, 240 a minute) on everything that
 * leaves for the wiki.
 *
 * Server only: it calls the sister wikis.
 */
import { ByteBoundedCache } from "~/lib/cache/byte-bounded-cache";
import { sanitizeSisterHtml } from "~/lib/utils/sanitize-sister-html";
import { getArticleWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge/dispatchers";
import type { WikiArticle } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";
import { canonicalOrTrimmedTitle } from "~/lib/wiki-os/core/title";
import type { SisterEmbedRequest } from "~/lib/wiki-os/sister-embed";
import { cardOf, headingKey, renderSectionOf, trimHtml } from "~/lib/wiki-os/sister-embed-parts";
import {
  renderSisterArticle,
  SisterRenderError,
  type SisterRender,
} from "~/lib/wiki-os/services/sister-render-service";

export type SisterEmbed =
  /** `truncated`: the part was longer than `MAX_EMBED_HTML_CHARS` and keeps its first blocks. */
  | { status: "ok"; kind: "html"; title: string; html: string; truncated: boolean }
  | { status: "ok"; kind: "card"; title: string; summary: string; imageUrl: string | null }
  | { status: "missing" }
  | { status: "unrenderable" }
  | { status: "no-part"; part: "section" | "infobox" };

/** The longest HTML an embed holds (before its last sanitize); a longer part keeps its first blocks. */
export const MAX_EMBED_HTML_CHARS = 100_000;
const EMBED_TTL_MS = 3_600_000;
/** How long a missing or unrenderable page is believed. */
const ABSENT_TTL_MS = 600_000;
/** What the embed cache may hold, in bytes (as `entryBytes` counts them). */
export const EMBED_CACHE_BYTES = 32 * 1024 * 1024;
const ENTRY_OVERHEAD_BYTES = 256;

const embeds = new ByteBoundedCache<SisterEmbed>({
  maxBytes: EMBED_CACHE_BYTES,
  defaultTtlMs: EMBED_TTL_MS,
});
/** What an entry takes: two bytes a character (UTF-16) of its JSON and its key, plus a fixed overhead. */
const entryBytes = (key: string, embed: SisterEmbed): number =>
  (JSON.stringify(embed).length + key.length) * 2 + ENTRY_OVERHEAD_BYTES;
/** Embeds being read, so readers asking for one at once share its read. */
const inFlight = new Map<string, Promise<SisterEmbed>>();

/** The part of `render` the request asks for, as its HTML; null when the page has no such part. */
function htmlPart(request: SisterEmbedRequest, render: SisterRender): string | null {
  if (request.mode === "infobox") return render.infoboxHtml;
  if (request.mode === "section") return renderSectionOf(render, request.section ?? "");
  return (render.infoboxHtml ?? "") + render.contentHtml;
}

/** The page rendered by its wiki; null when the wiki answered but could not render it (`SisterRenderError`). */
async function renderOrNull(
  request: SisterEmbedRequest,
  article: WikiArticle
): Promise<SisterRender | null> {
  try {
    return await renderSisterArticle(request.wiki, article);
  } catch (error) {
    if (error instanceof SisterRenderError) return null;
    throw error;
  }
}

async function readEmbed(request: SisterEmbedRequest): Promise<SisterEmbed> {
  const article = await getArticleWikitext(request.title, request.wiki);
  if (!article) return { status: "missing" };
  const render = await renderOrNull(request, article);
  if (!render) return { status: "unrenderable" };
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
  return { status: "ok", kind: "html", title, html, truncated: part.length > MAX_EMBED_HTML_CHARS };
}

/**
 * The embed `request` asks for: the part as sanitized HTML, a card, `missing` (no such page), `unrenderable` (its wiki
 * could not render it) or `no-part` (no such section, or no infobox). Throws WikiUnavailableError when the wiki cannot
 * be reached (never cached). `admitRead` runs only before a read of the wiki (an embed neither cached nor being read)
 * and refuses it by throwing.
 */
export async function getSisterEmbed(
  asked: SisterEmbedRequest,
  admitRead?: () => Promise<void>
): Promise<SisterEmbed> {
  const request = { ...asked, title: canonicalOrTrimmedTitle(asked.title, asked.wiki) };
  const section = headingKey(request.section ?? "") ?? "";
  const key = [request.wiki, request.title, request.mode, section].join("\u0000");
  const shared = () => embeds.get(key) ?? inFlight.get(key);
  const cached = shared();
  if (cached) return cached;
  if (admitRead) {
    await admitRead();
    // another reader may have started (or finished) the read meanwhile
    const meanwhile = shared();
    if (meanwhile) return meanwhile;
  }

  const reading = readEmbed(request)
    .then((embed) => {
      const absent = embed.status === "missing" || embed.status === "unrenderable";
      embeds.set(key, embed, entryBytes(key, embed), absent ? ABSENT_TTL_MS : EMBED_TTL_MS);
      return embed;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, reading);
  return reading;
}

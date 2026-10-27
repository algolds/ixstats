/**
 * parsoid.ts — the MediaWiki `action=parse` calls WikiOS makes.
 *
 * `renderArticleViaMediaWiki` is the render service's engine call (MediaWiki as a private renderer of
 * Postgres wikitext, which also reports what the page links, transcludes and is categorised in); `wikitextToHtml` renders editor previews, falling back to the in-process
 * wikitext compiler when MediaWiki is unreachable.
 */

import { z } from "zod";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import {
  DEFAULT_USER_AGENT,
  getMediaWikiApiUrl,
  loopbackRendererMissing,
} from "~/lib/wiki-os/config";

/**
 * What MediaWiki reports about a page it rendered: the same facts its own link tables are built from.
 * A field is null when the response did not carry it in a shape WikiOS can read (nothing is learned from
 * it, so the stored data is left as it is), never an empty list standing in for "unknown".
 */
export interface RenderMetadata {
  /** Pages linked from the page, as MediaWiki titles (namespace prefix included). */
  links: Array<{ ns: number; title: string }> | null;
  /** Pages transcluded: templates, and Lua modules invoked with #invoke (namespace 828). */
  templates: Array<{ ns: number; title: string }> | null;
  /** Files used, without the "File:" prefix. */
  images: string[] | null;
  /** Categories the page is in, with their sort key and whether MediaWiki hides them. */
  categories: Array<{ name: string; sortKey: string | null; hidden: boolean }> | null;
  /** `{{DISPLAYTITLE}}` as MediaWiki's HTML; null unless the page sets one. */
  displayTitle: string | null;
  /** Page properties MediaWiki reports (defaultsort, disambiguation, ...). */
  properties: Record<string, string>;
}

export interface RenderedPage {
  html: string;
  metadata: RenderMetadata;
}

const titleEntrySchema = z.array(z.looseObject({ ns: z.number(), title: z.string() }));

/** A field whose shape is not the expected one reads as absent: metadata never costs the page its HTML. */
const parseResponseSchema = z.object({
  parse: z
    .looseObject({
      text: z.string().optional(),
      links: titleEntrySchema.optional().catch(undefined),
      templates: titleEntrySchema.optional().catch(undefined),
      images: z.array(z.string()).optional().catch(undefined),
      categories: z
        .array(
          z.looseObject({
            category: z.string(),
            sortkey: z.string().optional(),
            // formatversion 2 writes a boolean; the older format an empty string when the category is hidden
            hidden: z.union([z.boolean(), z.string()]).optional(),
          })
        )
        .optional()
        .catch(undefined),
      properties: z.record(z.string(), z.json()).optional().catch(undefined),
      displaytitle: z.string().optional().catch(undefined),
    })
    .optional(),
});

function toMetadata(
  parsed: NonNullable<z.infer<typeof parseResponseSchema>["parse"]>
): RenderMetadata {
  const properties: Record<string, string> = {};
  for (const [name, value] of Object.entries(parsed.properties ?? {})) {
    if (typeof value === "string") properties[name] = value;
  }
  return {
    links: parsed.links?.map(({ ns, title }) => ({ ns, title })) ?? null,
    templates: parsed.templates?.map(({ ns, title }) => ({ ns, title })) ?? null,
    images: parsed.images ?? null,
    categories:
      parsed.categories?.map((entry) => ({
        name: entry.category,
        sortKey: entry.sortkey || null,
        hidden: entry.hidden === true || entry.hidden === "",
      })) ?? null,
    // The title MediaWiki shows is a page property only when the page sets one; otherwise it is the title itself.
    displayTitle:
      "displaytitle" in properties
        ? (parsed.displaytitle ?? properties.displaytitle ?? null)
        : null,
    properties,
  };
}

let warnedNoLoopback = false;

/**
 * Whether a render may go to MediaWiki: not in production without the private render engine (config.ts,
 * `loopbackRendererMissing`), which says so once per process.
 */
function mayRenderThroughMediaWiki(): boolean {
  if (!loopbackRendererMissing()) return true;
  if (!warnedNoLoopback) {
    warnedNoLoopback = true;
    console.warn(
      "[WikiOS:render] WIKIOS_MEDIAWIKI_INTERNAL_URL is not set: WikiOS does not render through the public MediaWiki."
    );
  }
  return false;
}

/** Render-failure lines a process writes a minute at most; the rest are counted and named by the next line. */
export const RENDER_FAILURE_LOGS_PER_MINUTE = 10;
const LOG_WINDOW_MS = 60_000;
/** How much of a body that is not MediaWiki's JSON (a Cloudflare or nginx page) a failure line quotes. */
const BODY_EXCERPT_CHARS = 160;

const renderFailureLog = { windowStart: Number.NEGATIVE_INFINITY, logged: 0, suppressed: 0 };

/**
 * One line saying why MediaWiki did not render `title`, throttled to RENDER_FAILURE_LOGS_PER_MINUTE a minute so a
 * broken classic cannot flood the log; the next line written says how many were left out.
 */
export function logRenderFailure(title: string, cause: string, now = Date.now()): void {
  if (now - renderFailureLog.windowStart >= LOG_WINDOW_MS) {
    renderFailureLog.windowStart = now;
    renderFailureLog.logged = 0;
  }
  if (renderFailureLog.logged >= RENDER_FAILURE_LOGS_PER_MINUTE) {
    renderFailureLog.suppressed++;
    return;
  }
  renderFailureLog.logged++;
  const left = renderFailureLog.suppressed;
  renderFailureLog.suppressed = 0;
  const more = left > 0 ? ` (${left} earlier failure${left === 1 ? "" : "s"} not logged)` : "";
  console.warn(`[WikiOS:render] MediaWiki did not render "${title}": ${cause}${more}`);
}

const RENDER_TIMEOUT_MS = 6000;
const jsonValue = z.json();

/** `body` as JSON, or undefined when it is not JSON (a Cloudflare or nginx page). */
function readJson(body: string): z.infer<typeof jsonValue> | undefined {
  try {
    return jsonValue.parse(JSON.parse(body));
  } catch {
    return undefined;
  }
}

const excerpt = (body: string): string =>
  JSON.stringify(body.replace(/\s+/g, " ").trim().slice(0, BODY_EXCERPT_CHARS));

/** The cause undici gives a failed fetch: a system error code (ECONNRESET, UND_ERR_SOCKET, ...) and its message. */
const errorCauseSchema = z.looseObject({
  code: z.string().optional(),
  message: z.string().optional(),
});

const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), info: z.string().optional() }),
});

/** Why a response is not a render: its status and the start of a body that is not JSON, or MediaWiki's error code. */
function describeResponse(status: number, body: string): string {
  const payload = readJson(body);
  if (payload === undefined) return `HTTP ${status}, not JSON: ${excerpt(body)}`;
  const failure = apiErrorSchema.safeParse(payload);
  if (failure.success) {
    const { code, info } = failure.data.error;
    return `HTTP ${status}, MediaWiki API error ${code}${info ? `: ${excerpt(info)}` : ""}`;
  }
  return status >= 200 && status < 300
    ? `HTTP ${status}, no page text in the response`
    : `HTTP ${status}: ${excerpt(body)}`;
}

/** A thrown fetch as a cause: the 6 s timeout, or the network error and its code (ECONNRESET, ...). */
function describeThrown(error: Error | string): string {
  if (typeof error === "string") return `network error: ${error}`;
  if (error.name === "TimeoutError" || error.name === "AbortError") {
    return `no answer within ${RENDER_TIMEOUT_MS} ms`;
  }
  const cause = errorCauseSchema.safeParse(error.cause);
  const code = cause.success ? (cause.data.code ?? cause.data.message ?? "") : "";
  return `network error: ${error.name}: ${error.message}${code ? ` (${code})` : ""}`;
}

/**
 * Render an article's Postgres wikitext through MediaWiki `action=parse` (`text=`, with the title as
 * context) so templates, parser functions and Lua expand. MediaWiki's own copy of the page is never
 * read: it is the pre-edit version until the background export lands (or forever under
 * SKIP_MEDIAWIKI_SYNC). `wikitext` must not be blank (the render service never sends a blank page).
 * The same request asks for the page's links, templates, images, categories and properties
 * (`RenderMetadata`): the render is the only place WikiOS learns them. Returns null when MediaWiki is
 * unreachable or returns nothing, and without a request in production with no private render engine; each null is
 * explained by one throttled line (`logRenderFailure`).
 */
export async function renderArticleViaMediaWiki(
  wikitext: string,
  title: string
): Promise<RenderedPage | null> {
  if (!mayRenderThroughMediaWiki()) {
    logRenderFailure(
      title,
      "refused locally: production has no private render engine (WIKIOS_MEDIAWIKI_INTERNAL_URL)"
    );
    return null;
  }
  let status: number;
  let body: string;
  try {
    const res = await fetch(getMediaWikiApiUrl("ixwiki"), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": DEFAULT_USER_AGENT,
        "Api-User-Agent": DEFAULT_USER_AGENT,
      },
      body: new URLSearchParams({
        action: "parse",
        text: wikitext,
        title,
        contentmodel: "wikitext",
        prop: "text|links|templates|images|categories|properties|displaytitle",
        disablelimitreport: "1",
        disableeditsection: "1",
        formatversion: "2",
        format: "json",
      }).toString(),
      signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
    });
    status = res.status;
    body = await res.text();
  } catch (error) {
    logRenderFailure(title, describeThrown(error instanceof Error ? error : String(error)));
    return null;
  }
  const parsed = parsedRender(status, body);
  if (parsed) return { html: parsed.text, metadata: toMetadata(parsed) };
  logRenderFailure(title, describeResponse(status, body));
  return null;
}

/** The `parse` part of a 2xx answer that carries page text, else null. */
function parsedRender(
  status: number,
  body: string
): (NonNullable<z.infer<typeof parseResponseSchema>["parse"]> & { text: string }) | null {
  if (status < 200 || status >= 300) return null;
  const data = parseResponseSchema.safeParse(readJson(body));
  const parsed = data.success ? data.data.parse : undefined;
  return parsed?.text ? { ...parsed, text: parsed.text } : null;
}

/**
 * Convert wikitext to HTML with 100% MediaWiki compliancy.
 * Queries MediaWiki Action API action=parse to expand all templates, parser functions (#if, #switch),
 * Lua Scribunto modules, and wikitables. Falls back gracefully to native AST compiler, which is all it uses in
 * production with no private render engine.
 */
export async function wikitextToHtml(wikitext: string, title = "Preview"): Promise<string> {
  if (!wikitext || !wikitext.trim()) return "";
  const cleanTitle = title.replace(/^Template:/i, "").trim() || "Preview";
  if (!mayRenderThroughMediaWiki()) return parseWikitextToHtml(wikitext, "ixwiki");

  try {
    const mwApi = getMediaWikiApiUrl("ixwiki");
    const body = new URLSearchParams({
      action: "parse",
      text: wikitext,
      title: cleanTitle,
      contentmodel: "wikitext",
      prop: "text",
      pst: "1",
      disablelimitreport: "1",
      disableeditsection: "1",
      formatversion: "2",
      format: "json",
    });
    const res = await fetch(mwApi, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": DEFAULT_USER_AGENT,
        "Api-User-Agent": DEFAULT_USER_AGENT,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = (await res.json()) as { parse?: { text?: string } };
      if (data?.parse?.text) {
        return data.parse.text;
      }
    }
  } catch {
    // Network unavailable or offline: fall back to local in-process compiler
  }

  return parseWikitextToHtml(wikitext, "ixwiki");
}

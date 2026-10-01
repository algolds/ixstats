/**
 * parsoid.ts — the MediaWiki `action=parse` calls WikiOS makes.
 *
 * `renderArticleViaMediaWiki` is the render service's engine call (MediaWiki as a private renderer of
 * Postgres wikitext, which also reports what the page links, transcludes and is categorised in); `wikitextToHtml` renders editor previews, falling back to the in-process
 * wikitext compiler when MediaWiki is unreachable.
 */

import { z } from "zod";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";

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

function toMetadata(parsed: NonNullable<z.infer<typeof parseResponseSchema>["parse"]>): RenderMetadata {
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
    displayTitle: "displaytitle" in properties ? (parsed.displaytitle ?? properties.displaytitle ?? null) : null,
    properties,
  };
}

/**
 * Render an article's Postgres wikitext through MediaWiki `action=parse` (`text=`, with the title as
 * context) so templates, parser functions and Lua expand. MediaWiki's own copy of the page is never
 * read: it is the pre-edit version until the background export lands (or forever under
 * SKIP_MEDIAWIKI_SYNC). `wikitext` must not be blank (the render service never sends a blank page).
 * The same request asks for the page's links, templates, images, categories and properties
 * (`RenderMetadata`): the render is the only place WikiOS learns them. Returns null when MediaWiki is
 * unreachable or returns nothing.
 */
export async function renderArticleViaMediaWiki(
  wikitext: string,
  title: string
): Promise<RenderedPage | null> {
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
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = parseResponseSchema.safeParse(await res.json());
    const parsed = data.success ? data.data.parse : undefined;
    return parsed?.text ? { html: parsed.text, metadata: toMetadata(parsed) } : null;
  } catch {
    return null;
  }
}

/**
 * Convert wikitext to HTML with 100% MediaWiki compliancy.
 * Queries MediaWiki Action API action=parse to expand all templates, parser functions (#if, #switch),
 * Lua Scribunto modules, and wikitables. Falls back gracefully to native AST compiler.
 */
export async function wikitextToHtml(wikitext: string, title = "Preview"): Promise<string> {
  if (!wikitext || !wikitext.trim()) return "";
  const cleanTitle = title.replace(/^Template:/i, "").trim() || "Preview";

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


/**
 * template-registry.ts — WikiOS Template Registry.
 *
 * Syncs TemplateData schemas from MediaWiki, caches them in Prisma,
 * and provides lookup/search for the editor's template inserter.
 */

import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateParam {
  label?: string;
  description?: string;
  type?: string; // string, number, boolean, date, wiki-page-name, etc.
  default?: string;
  required?: boolean;
  suggested?: boolean;
  example?: string;
  autovalue?: string;
  aliases?: string[];
}

export interface TemplateDataInfo {
  title: string;
  description?: string;
  params: Record<string, TemplateParam>;
  paramOrder?: string[];
  format?: string; // inline, block
  sets?: Array<{ label: string; params: string[] }>;
}

// ---------------------------------------------------------------------------
// Fetch from MediaWiki
// ---------------------------------------------------------------------------

/**
 * Fetch TemplateData for one or more templates from MediaWiki.
 * Uses the templatedata API action.
 */
export async function fetchTemplateData(titles: string[]): Promise<Map<string, TemplateDataInfo>> {
  const result = new Map<string, TemplateDataInfo>();
  if (titles.length === 0) return result;

  // MediaWiki API accepts up to 50 titles at once
  const batches: string[][] = [];
  for (let i = 0; i < titles.length; i += 50) {
    batches.push(titles.slice(i, i + 50));
  }

  for (const batch of batches) {
    const normalizedTitles = batch.map((t) => (t.startsWith("Template:") ? t : `Template:${t}`));
    const params = new URLSearchParams({
      action: "templatedata",
      titles: normalizedTitles.join("|"),
      formatversion: "2",
      format: "json",
    });

    try {
      const mwApi = getMediaWikiApiUrl("ixwiki");
      const res = await fetch(`${mwApi}?${params}`, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          "Api-User-Agent": DEFAULT_USER_AGENT,
        },
        signal: AbortSignal.timeout(15000),
      });
      const data = (await res.json()) as {
        pages?: Record<
          string,
          {
            title?: string;
            description?: string;
            params?: Record<string, TemplateParam>;
            paramOrder?: string[];
            format?: string;
            sets?: Array<{ label: string; params: string[] }>;
            notemplatedata?: boolean;
          }
        >;
      };

      if (data.pages) {
        for (const [, page] of Object.entries(data.pages)) {
          if (!page.title || page.notemplatedata) continue;
          // Strip "Template:" prefix for storage
          const cleanName = page.title.replace(/^Template:/, "");
          result.set(cleanName, {
            title: cleanName,
            description: page.description ?? undefined,
            params: page.params ?? {},
            paramOrder: page.paramOrder,
            format: page.format,
            sets: page.sets,
          });
        }
      }
    } catch (err) {
      console.error(`[WikiOS] Failed to fetch TemplateData for batch:`, err);
    }
  }

  return result;
}

/**
 * Search for templates by name prefix using MediaWiki's prefix search.
 */
export async function searchTemplatesFromWiki(
  query: string,
  limit = 20
): Promise<Array<{ title: string; ns: number }>> {
  const params = new URLSearchParams({
    action: "query",
    list: "prefixsearch",
    pssearch: query,
    psnamespace: "10", // Template namespace
    pslimit: String(limit),
    formatversion: "2",
    format: "json",
  });

  try {
    const mwApi = getMediaWikiApiUrl("ixwiki");
    const res = await fetch(`${mwApi}?${params}`, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Api-User-Agent": DEFAULT_USER_AGENT,
      },
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json()) as {
      query?: {
        prefixsearch?: Array<{ ns: number; title: string; pageid: number }>;
      };
    };
    return (data.query?.prefixsearch ?? []).map((p) => ({
      title: p.title.replace(/^Template:/, ""),
      ns: p.ns,
    }));
  } catch {
    return [];
  }
}

/**
 * Get a rendered preview of a template with given parameters.
 */
export async function getTemplatePreview(
  templateName: string,
  params: Record<string, string>
): Promise<string> {
  // Build wikitext from template name + params
  const paramParts = Object.entries(params)
    .filter(([, v]) => v.trim() !== "")
    .map(([k, v]) => `|${k}=${v}`);
  const wikitext = `{{${templateName}${paramParts.join("")}}}`;

  const apiParams = new URLSearchParams({
    action: "parse",
    text: wikitext,
    contentmodel: "wikitext",
    prop: "text",
    disablelimitreport: "1",
    formatversion: "2",
    format: "json",
  });

  try {
    const mwApi = getMediaWikiApiUrl("ixwiki");
    const res = await fetch(`${mwApi}?${apiParams}`, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Api-User-Agent": DEFAULT_USER_AGENT,
      },
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json()) as {
      parse?: { text?: string };
    };
    return data.parse?.text ?? "";
  } catch {
    return `<p class="error">Failed to render template preview</p>`;
  }
}

/**
 * Categorize a template based on its name/description.
 */
export function categorizeTemplate(name: string, description?: string): string {
  const lower = (name + " " + (description ?? "")).toLowerCase();
  if (lower.includes("infobox")) return "infobox";
  if (lower.includes("navbox") || lower.includes("navigation")) return "navigation";
  if (lower.includes("citation") || lower.includes("cite") || lower.includes("ref"))
    return "citation";
  if (lower.includes("stub") || lower.includes("maintenance") || lower.includes("cleanup"))
    return "maintenance";
  if (lower.includes("flag") || lower.includes("icon")) return "icon";
  if (lower.includes("sidebar")) return "sidebar";
  if (lower.includes("hatnote") || lower.includes("about") || lower.includes("redirect"))
    return "hatnote";
  if (lower.includes("map") || lower.includes("coord") || lower.includes("location"))
    return "geographic";
  return "general";
}

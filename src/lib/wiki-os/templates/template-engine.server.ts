/**
 * template-engine.server.ts — the two calls WikiOS makes to MediaWiki about templates.
 *
 * SERVER-ONLY (`server-only` fails a client bundle that imports it): a browser must never ask MediaWiki
 * anything. The editor's template preview reaches `getTemplatePreview` through `wikios.getTemplatePreview`.
 *
 *   - `getTemplatePreview`: MediaWiki renders `{{name|k=v}}` as a private engine (the render service's own
 *     non-persisting call, which uses the internal URL when one is configured).
 *   - `fetchTemplateData`: the admin template sync's refresh (`action=templatedata`); a reader's TemplateData
 *     comes from Postgres (`template-data-reader.ts`).
 */

import "server-only";
import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";
import { renderArticleViaMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { transformWikiLinks } from "~/lib/wiki-os/transformers/url-compat";
import { transformImages, stripConflictingStyles } from "~/lib/wiki-os/transformers/html-transformer";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import {
  normalizeString,
  type TemplateDataInfo,
  type TemplateParam,
} from "~/lib/wiki-os/templates/template-registry";

// ---------------------------------------------------------------------------
// Admin refresh from MediaWiki
// ---------------------------------------------------------------------------

/**
 * Fetch TemplateData for one or more templates from MediaWiki (the `templatedata` API action).
 * ADMIN-TRIGGERED REFRESH ONLY (the admin template sync): a reader's TemplateData comes from Postgres.
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
      if (!res.ok) continue;

      const rawText = await res.text();
      if (!rawText.trim().startsWith("{")) continue;

      const data = JSON.parse(rawText) as {
        pages?: Record<
          string,
          {
            title?: string;
            description?: unknown;
            params?: Record<string, any>;
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
          const normalizedParams: Record<string, TemplateParam> = {};

          if (page.params) {
            for (const [pKey, pVal] of Object.entries(page.params)) {
              normalizedParams[pKey] = {
                ...pVal,
                label: normalizeString(pVal?.label),
                description: normalizeString(pVal?.description),
              };
            }
          }

          result.set(cleanName, {
            title: cleanName,
            description: normalizeString(page.description),
            params: normalizedParams,
            paramOrder: page.paramOrder,
            format: page.format,
            sets: page.sets,
          });
        }
      }
    } catch {
      // Continue next batch
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

const INVALID_PARAMETER_PREVIEW = "Invalid parameter";
/** A key containing these could end the parameter name early or open a second parameter. */
const UNSAFE_PARAM_KEY = /[|={}\n\r]/;

/**
 * A parameter value made safe to place inside `{{name|key=<value>}}`, or null when it could break out.
 * Balanced nested `{{…}}` and `[[…]]` are kept as written (a nested `{{flag|X}}` previews); braces or
 * brackets that do not pair up are refused, since they would close or open a call around the value.
 * A `|` is escaped as `{{!}}` only at nesting depth 0; inside a nested call or link it is that
 * construct's own separator.
 */
function escapeParamValue(value: string): string | null {
  const closers: string[] = [];
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const pair = value.slice(i, i + 2);
    if (pair === "{{" || pair === "[[") {
      closers.push(pair === "{{" ? "}}" : "]]");
    } else if (pair === "}}" || pair === "]]") {
      if (closers.pop() !== pair) return null;
    } else {
      out += value[i] === "|" && closers.length === 0 ? "{{!}}" : value[i];
      continue;
    }
    out += pair;
    i++;
  }
  return closers.length === 0 ? out : null;
}

/**
 * `{{name|k=v}}` for the given params, or null when a key or value could break out of the call.
 * Empty values are skipped.
 */
function buildTemplateInvocation(
  templateName: string,
  params: Record<string, string>
): string | null {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value.trim() === "") continue;
    const safeValue = escapeParamValue(value);
    if (safeValue === null || UNSAFE_PARAM_KEY.test(key)) return null;
    parts.push(`|${key}=${safeValue}`);
  }
  return `{{${templateName}${parts.join("")}}}`;
}

/** The page a template preview is rendered as (the parse context: `{{PAGENAME}}` and the like). */
const PREVIEW_PAGE_TITLE = "Template preview";

/**
 * Get a rendered preview of a template with given parameters. MediaWiki renders it as a private engine
 * (the render service's own non-persisting call, which uses the internal URL when one is configured);
 * when it cannot, the in-process compiler does.
 */
export async function getTemplatePreview(
  templateName: string,
  params: Record<string, string>
): Promise<string> {
  const wikitext = buildTemplateInvocation(templateName, params);
  if (wikitext === null) return INVALID_PARAMETER_PREVIEW;

  const rendered = await renderArticleViaMediaWiki(wikitext, PREVIEW_PAGE_TITLE);
  if (rendered) {
    return transformWikiLinks(transformImages(stripConflictingStyles(rendered.html), "ixwiki"));
  }

  const localHtml = parseWikitextToHtml(wikitext, "ixwiki");
  return transformWikiLinks(transformImages(localHtml, "ixwiki"));
}

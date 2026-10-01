/**
 * template-data-reader.ts — TemplateData read from Postgres.
 *
 * A template's TemplateData is the JSON in a `<templatedata>` block of its own wikitext or of its
 * `/doc` subpage (where MediaWiki's convention puts it). WikiOS holds that wikitext, so a reader never
 * needs MediaWiki's `action=templatedata` (that stays the admin sync's refresh, `fetchTemplateData`).
 *
 * SERVER-ONLY: it reads the database; `template-registry.ts` (client-safe) holds the types.
 */

import { z } from "zod";
import { db } from "~/server/db";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import {
  normalizeString,
  type TemplateDataInfo,
  type TemplateParam,
} from "~/lib/wiki-os/templates/template-registry";

const OPEN_TAG = "<templatedata>";
const CLOSE_TAG = "</templatedata>";

/** TemplateData text: a string, or one string per language. */
const localized = z.union([z.string(), z.record(z.string(), z.string())]);

const paramSchema = z.looseObject({
  label: localized.optional().catch(undefined),
  description: localized.optional().catch(undefined),
  type: z.string().optional().catch(undefined),
  default: z.string().optional().catch(undefined),
  required: z.boolean().optional().catch(undefined),
  suggested: z.boolean().optional().catch(undefined),
  example: z.string().optional().catch(undefined),
  autovalue: z.string().optional().catch(undefined),
  aliases: z.array(z.string()).optional().catch(undefined),
});

const templateDataSchema = z.looseObject({
  description: localized.optional().catch(undefined),
  params: z.record(z.string(), paramSchema).optional().catch(undefined),
  paramOrder: z.array(z.string()).optional().catch(undefined),
  format: z.string().optional().catch(undefined),
  sets: z
    .array(z.object({ label: z.string(), params: z.array(z.string()) }))
    .optional()
    .catch(undefined),
});

/**
 * The JSON inside the first `<templatedata>` block of `wikitext`, or null when it has none (or the block
 * never closes). Found by index, never by backtracking pattern: linear in the text, whatever it holds.
 */
export function extractTemplateDataJson(wikitext: string): string | null {
  const lower = wikitext.toLowerCase();
  const open = lower.indexOf(OPEN_TAG);
  if (open === -1) return null;
  const close = lower.indexOf(CLOSE_TAG, open + OPEN_TAG.length);
  return close === -1 ? null : wikitext.slice(open + OPEN_TAG.length, close);
}

function toParam(raw: z.infer<typeof paramSchema>): TemplateParam {
  return {
    label: normalizeString(raw.label),
    description: normalizeString(raw.description),
    type: raw.type,
    default: raw.default,
    required: raw.required,
    suggested: raw.suggested,
    example: raw.example,
    autovalue: raw.autovalue,
    aliases: raw.aliases,
  };
}

/** The TemplateData `json` describes for the template `name`, or null when it is not valid TemplateData JSON. */
export function parseTemplateData(name: string, json: string): TemplateDataInfo | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = templateDataSchema.safeParse(data);
  if (!parsed.success) return null;

  const params: Record<string, TemplateParam> = {};
  for (const [key, raw] of Object.entries(parsed.data.params ?? {})) params[key] = toParam(raw);
  return {
    title: name,
    description: normalizeString(parsed.data.description),
    params,
    paramOrder: parsed.data.paramOrder,
    format: parsed.data.format,
    sets: parsed.data.sets,
  };
}

/** The canonical title of a template's page and of its documentation subpage. */
function templateTitles(name: string): { page: string; doc: string } | null {
  const canon = canonicalizeTitle(`Template:${name}`);
  return canon ? { page: canon.title, doc: `${canon.title}/doc` } : null;
}

/**
 * TemplateData of the templates `names` (with or without "Template:"), keyed by name without the prefix, from
 * the stored wikitext of each template's page, else of its `/doc` subpage. A template with no (valid)
 * TemplateData is absent from the result. A deleted page is not read.
 */
export async function readTemplateData(
  names: readonly string[]
): Promise<Map<string, TemplateDataInfo>> {
  const result = new Map<string, TemplateDataInfo>();
  const wanted = names.flatMap((given) => {
    const name = given.replace(/^Template:/i, "").trim();
    const titles = templateTitles(name);
    return titles ? [{ name, ...titles }] : [];
  });
  if (wanted.length === 0) return result;

  const pages = await db.wikiArticle.findMany({
    where: {
      source: "ixwiki",
      status: "PUBLISHED",
      title: { in: wanted.flatMap((entry) => [entry.page, entry.doc]) },
    },
    select: { title: true, wikitext: true },
    take: wanted.length * 2, // the page and its /doc, for each template
  });
  const wikitextOf = new Map(pages.map((page) => [page.title, page.wikitext]));

  for (const { name, page, doc } of wanted) {
    for (const title of [page, doc]) {
      const json = extractTemplateDataJson(wikitextOf.get(title) ?? "");
      const info = json === null ? null : parseTemplateData(name, json);
      if (info) {
        result.set(name, info);
        break;
      }
    }
  }
  return result;
}

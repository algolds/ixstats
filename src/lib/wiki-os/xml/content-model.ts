/**
 * content-model.ts — the MediaWiki content model a page title implies.
 *
 * A dump says what each revision's text is (`<model>`, `<format>`). WikiOS stores only text, so
 * the model comes from the title the way MediaWiki's defaults decide it: Lua modules in the
 * Module: namespace (Scribunto, except their /doc subpages, which are wikitext), and CSS, JS and
 * JSON pages by suffix in the MediaWiki: namespace and in User: subpages. A main-namespace page
 * that merely ends in ".js" (Node.js) is an ordinary wikitext page.
 */

import { canonicalizeTitle } from "../core/title";

export interface ContentModel {
  model: string;
  format: string;
}

const WIKITEXT: ContentModel = { model: "wikitext", format: "text/x-wiki" };
const SCRIBUNTO: ContentModel = { model: "Scribunto", format: "text/plain" };
const BY_SUFFIX: ReadonlyArray<readonly [string, ContentModel]> = [
  [".css", { model: "css", format: "text/css" }],
  [".js", { model: "javascript", format: "text/javascript" }],
  [".json", { model: "json", format: "application/json" }],
];

const NS_USER = 2;
const NS_MEDIAWIKI = 8;
const NS_MODULE = 828;

/** The model of a CSS/JS/JSON page by the suffix of its name, or null when it has none. */
function modelBySuffix(name: string): ContentModel | null {
  const lower = name.toLowerCase();
  return BY_SUFFIX.find(([suffix]) => lower.endsWith(suffix))?.[1] ?? null;
}

/** The content model and format of the page `title` (any spelling; an invalid title is wikitext). */
export function contentModelFor(title: string): ContentModel {
  const canon = canonicalizeTitle(title);
  if (!canon) return WIKITEXT;

  if (canon.namespaceId === NS_MODULE) return canon.base.endsWith("/doc") ? WIKITEXT : SCRIBUNTO;
  if (canon.namespaceId === NS_MEDIAWIKI) return modelBySuffix(canon.base) ?? WIKITEXT;
  // User:Jane.css is not a page of code; User:Jane/common.css is.
  if (canon.namespaceId === NS_USER && canon.base.includes("/")) {
    return modelBySuffix(canon.base) ?? WIKITEXT;
  }
  return WIKITEXT;
}

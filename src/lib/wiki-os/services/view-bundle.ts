// The reader's view bundle (split out of render-service.ts): its shape and renderer version, building one from
// MediaWiki's HTML, loading a stored one (re-sanitizing an outdated one) and the in-process fallback view.

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import {
  sanitizeWikiArticleHtml,
  wikiArticleSanitizerFingerprint,
} from "~/lib/utils/sanitize-html";
import { markTemplateChips } from "../templates/chip-markers";
import { transformArticleHtml, stripConflictingStyles } from "../transformers/html-transformer";
import { leavesAlone } from "../transformers/dom-depth";
import { slimArticleHtml, templateStyleIdentifiers } from "../transformers/slim-html";
import { parseWikitextToHtml } from "../transformers/wikitext-parser";

/** Bump when the bundle's shape or the transform changes. */
const RENDERER_BASE_VERSION = 3;

/**
 * What a bundle was built by: the transform's version plus a fingerprint of the sanitizer (its
 * rules and DOMPurify's version). A bundle of another version is outdated: readers get it re-sanitized
 * and marked stale while `renderStaleBatch` (or the first reader's background render) replaces it, so
 * a sanitizer change reaches every stored article without anyone remembering to bump a number.
 */
export const RENDERER_VERSION = `${RENDERER_BASE_VERSION}:${wikiArticleSanitizerFingerprint()}`;

const tocEntrySchema = z.object({ id: z.string(), text: z.string(), level: z.number() });

/** The shape of `WikiArticle.renderedView`; parsed on read because the column is plain JSON. */
export const viewBundleSchema = z.object({
  bodyHtml: z.string(),
  infoboxHtml: z.string().nullable(),
  noticesHtml: z.string().nullable(),
  toc: z.array(tocEntrySchema),
  rendererVersion: z.literal(RENDERER_VERSION),
});

export type ViewBundle = z.infer<typeof viewBundleSchema>;

/** `viewBundleSchema` without the version check: the shape of a bundle some earlier renderer built. */
const outdatedViewBundleSchema = viewBundleSchema.extend({ rendererVersion: z.string() });

// ---------------------------------------------------------------------------
// The view bundle
// ---------------------------------------------------------------------------

/**
 * MediaWiki's HTML as the reader wants it: the transform `getArticleHtml` always applied, template
 * chips turned into markers (DOM, before sanitizing), then one sanitizer pass per part. Pure.
 */
export function buildViewBundle(rawHtml: string): ViewBundle {
  const transformed = transformArticleHtml(stripConflictingStyles(rawHtml), "", "ixwiki");
  // sanitized first, then slimmed: the slimming only removes (titles that repeat their link, classes
  // nothing uses, empty attributes, layout whitespace), so it cannot let anything through. A class a kept
  // TemplateStyles block styles is not "nothing uses": the sheet of one part styles the others too.
  const sanitize = (html: string) => sanitizeWikiArticleHtml(markTemplateChips(html));
  const body = sanitize(transformed.contentHtml);
  const infobox = transformed.infoboxHtml ? sanitize(transformed.infoboxHtml) : null;
  const notices = transformed.noticesHtml ? sanitize(transformed.noticesHtml) : null;
  const styled = templateStyleIdentifiers(body, infobox ?? "", notices ?? "");
  return {
    bodyHtml: slimArticleHtml(body, styled),
    infoboxHtml: infobox === null ? null : slimArticleHtml(infobox, styled),
    noticesHtml: notices === null ? null : slimArticleHtml(notices, styled),
    toc: transformed.toc,
    rendererVersion: RENDERER_VERSION,
  };
}

/** Why MediaWiki's HTML looks wrong for this wikitext (leaked markup, a missing infobox), or null. */
export function describeRenderProblem(rawHtml: string, wikitext: string): string | null {
  if (/\|\d+px\|/i.test(rawHtml) || /\|\s*(?:center|left|right|thumb)\]\]/i.test(rawHtml)) {
    return "leaked wikitext markup";
  }
  const wikitextHasInfobox = /\{\{[Ii]nfobox/i.test(wikitext);
  if (wikitextHasInfobox && !rawHtml.includes("infobox") && !rawHtml.includes("aside")) {
    return "the infobox is missing";
  }
  return null;
}

/** The bundle and freshness of an article, and whether an earlier renderer version built the bundle. */
export interface LoadedViewBundle {
  bundle: ViewBundle;
  htmlSyncedAt: Date | null;
  /**
   * Built by another renderer version (or another sanitizer): worth showing, since it shows the page, but
   * it is not what a render would produce now. Its HTML has been through the current sanitizer.
   */
  outdated: boolean;
}

/**
 * `bundle` with every HTML part (body, infobox, notices; the TOC is plain text) sanitized by the current rules.
 * Null for a bundle with a part over the DOM ceilings of inert-dom.ts (too long, or nested too deep): sanitizing is a
 * DOM pass, and an anonymous reader's request would pay for it; the page is rendered again instead, as one with no
 * bundle is.
 */
function resanitizeViewBundle(bundle: ViewBundle): ViewBundle | null {
  const parts = [bundle.bodyHtml, bundle.infoboxHtml, bundle.noticesHtml];
  if (parts.some((html) => html !== null && leavesAlone(html))) return null;
  return {
    ...bundle,
    bodyHtml: sanitizeWikiArticleHtml(bundle.bodyHtml),
    infoboxHtml: bundle.infoboxHtml === null ? null : sanitizeWikiArticleHtml(bundle.infoboxHtml),
    noticesHtml: bundle.noticesHtml === null ? null : sanitizeWikiArticleHtml(bundle.noticesHtml),
  };
}

/**
 * The bundle and freshness of an article. A bundle of this renderer version is returned as it is. One
 * that only differs in its renderer version (an older transform or sanitizer built it) is returned
 * `outdated`, re-sanitized by the current sanitizer so an older bundle never gets past a tightened rule.
 * Null when the article has no bundle, or one whose shape is not a bundle's at all, or one the sanitizer
 * throws on, or one too big or too deep to sanitize on a read (resanitizeViewBundle).
 */
export async function loadViewBundle(articleId: string): Promise<LoadedViewBundle | null> {
  const row = await db.wikiArticle.findUnique({
    where: { id: articleId },
    select: { renderedView: true, htmlSyncedAt: true },
  });
  if (!row) return null;

  const current = viewBundleSchema.safeParse(row.renderedView);
  if (current.success) {
    return { bundle: current.data, htmlSyncedAt: row.htmlSyncedAt, outdated: false };
  }
  const outdated = outdatedViewBundleSchema.safeParse(row.renderedView);
  if (!outdated.success) return null;
  try {
    const bundle = resanitizeViewBundle(outdated.data);
    return bundle ? { bundle, htmlSyncedAt: row.htmlSyncedAt, outdated: true } : null;
  } catch (error) {
    // a page the sanitizer cannot take must not fail every read: it is as good as having no bundle
    console.warn(
      `[WikiOS:render] Re-sanitizing the outdated bundle of ${articleId} failed:`,
      error
    );
    return null;
  }
}

/** The page's current revision as the blank check needs it: size and whether its text is hidden (see `isBlanked`). */
export const CURRENT_REVISION = {
  where: { parked: false },
  orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
  take: 1,
  select: { byteSize: true, textDeleted: true },
} satisfies Prisma.WikiArticle$revisionsArgs;

/**
 * Whether the page's current live revision IS its blank text: an edit blanked it (the revision is as long as the text,
 * and its text is not hidden). An HTML-only row has no revision, and a stub whose text was never imported has one that
 * only holds a size, or a hidden one: for those the stored HTML is all the page has.
 */
export function isBlanked(article: {
  wikitext: string;
  revisions: Array<{ byteSize: number; textDeleted: boolean }>;
}): boolean {
  const [current] = article.revisions;
  return (
    current !== undefined &&
    !current.textDeleted &&
    current.byteSize === Buffer.byteLength(article.wikitext, "utf8")
  );
}

/**
 * A view built in-process for an article that has no bundle and whose render failed: the HTML
 * MediaWiki produced for an earlier revision (`contentHtml`), else the wikitext compiled locally
 * (no templates, no Lua). Sanitized like any bundle, never persisted. An empty bundle for a page an edit blanked
 * (see `isBlanked`). Null when the article has nothing (a stub).
 */
export async function renderFallbackView(articleId: string): Promise<ViewBundle | null> {
  const row = await db.wikiArticle.findUnique({
    where: { id: articleId },
    select: { wikitext: true, contentHtml: true, revisions: CURRENT_REVISION },
  });
  if (!row) return null;
  // A page an edit blanked shows nothing: the HTML kept from its earlier text is not its content.
  if (row.wikitext.trim() === "" && isBlanked(row)) return buildViewBundle("");
  const html = row.contentHtml?.trim()
    ? row.contentHtml
    : parseWikitextToHtml(row.wikitext, "ixwiki");
  return html.trim() ? buildViewBundle(html) : null;
}

// The reader's view bundle (split out of render-service.ts): its shape and renderer version, building one from
// MediaWiki's HTML, loading a stored one (re-sanitizing an outdated one, with its profile links made current) and the
// in-process fallback view.

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import {
  sanitizeWikiArticleHtml,
  wikiArticleSanitizerFingerprint,
} from "~/lib/utils/sanitize-html";
import { currentProfileLinks } from "../legacy-profile-links";
import { markTemplateChips } from "../templates/chip-markers";
import { transformArticleHtml, stripConflictingStyles } from "../transformers/html-transformer";
import { leavesAlone } from "../transformers/dom-depth";
import { slimArticleHtml, templateStyleIdentifiers } from "../transformers/slim-html";
import { parseWikitextToHtml } from "../transformers/wikitext-parser";

/** Bump when the bundle's shape or the transform changes. */
const RENDERER_BASE_VERSION = 6;

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

/**
 * A file MediaWiki could not show when it rendered: `mw:Error` in a media element's `typeof` (a missing file, whose
 * link's `href` goes to `Special:Upload&wpDestFile=`, or "Error creating thumbnail"). Classic's lookup of a Commons file
 * can fail for one render and work for the next, while its own page keeps the images. Markup only: each is looked for
 * inside a tag's attribute, so page text that quotes `wpDestFile=` or `mw:Error` never matches (the text's `<` is
 * escaped).
 */
const MEDIA_ERROR = /<[a-z][^>]*\s(?:typeof="[^"]*\bmw:Error\b|href="[^"]*[?&;]wpDestFile=)/i;

const DAY_MS = 24 * 60 * 60 * 1000;
/** A first render with a media error (made within a day of its revision) is rendered again after this long. */
export const MEDIA_ERROR_RERENDER_MS = DAY_MS;
/** A render with a media error that was already a later render is rendered again after this long. */
export const MEDIA_ERROR_BACKOFF_MS = 7 * DAY_MS;

/**
 * Whether a current bundle with a media error (`MEDIA_ERROR`) is due another render. A render made within a day of the
 * revision it renders (`revisionAt`) is the page's first: a failed Commons lookup is likely passing, so it is due a
 * day after it was made. A later render that still could not show the file (or one whose revision time is unknown) is
 * likely a file that is really missing: due a week after it was made. The new render resets `htmlSyncedAt`, so a
 * missing file costs one render a week, never a loop.
 */
export function mediaErrorRerenderDue(
  bundle: ViewBundle,
  htmlSyncedAt: Date | null,
  revisionAt: Date | null,
  now = Date.now()
): boolean {
  if (!htmlSyncedAt) return false;
  const renderedAt = htmlSyncedAt.getTime();
  const firstRender = revisionAt !== null && renderedAt - revisionAt.getTime() <= DAY_MS;
  const wait = firstRender ? MEDIA_ERROR_RERENDER_MS : MEDIA_ERROR_BACKOFF_MS;
  if (now - renderedAt < wait) return false;
  return [bundle.bodyHtml, bundle.infoboxHtml, bundle.noticesHtml].some(
    (html) => html !== null && MEDIA_ERROR.test(html)
  );
}

/** The bundle and freshness of an article, and whether an earlier renderer version built the bundle. */
export interface LoadedViewBundle {
  bundle: ViewBundle;
  htmlSyncedAt: Date | null;
  /**
   * Built by another renderer version (or another sanitizer): worth showing, since it shows the page, but
   * it is not what a render would produce now. Its HTML has been through the current sanitizer. A current
   * bundle whose render could not show a file is outdated too once `mediaErrorRerenderDue` says it is due.
   */
  outdated: boolean;
}

/**
 * One HTML part of an outdated bundle as a render would leave it now: old profile and passport links pointed at the
 * current pages (`currentProfileLinks`, with its early-out, as the link transform does), then sanitized by the current
 * rules, which have the last word.
 */
const resanitizePart = (html: string) => sanitizeWikiArticleHtml(currentProfileLinks(html));

/**
 * `bundle` with every HTML part (body, infobox, notices; the TOC is plain text) brought current by `resanitizePart`.
 * Null for a bundle with a part over the DOM ceilings of inert-dom.ts (too long, or nested too deep): sanitizing is a
 * DOM pass, and an anonymous reader's request would pay for it; the page is rendered again instead, as one with no
 * bundle is.
 */
function resanitizeViewBundle(bundle: ViewBundle): ViewBundle | null {
  const parts = [bundle.bodyHtml, bundle.infoboxHtml, bundle.noticesHtml];
  if (parts.some((html) => html !== null && leavesAlone(html))) return null;
  return {
    ...bundle,
    bodyHtml: resanitizePart(bundle.bodyHtml),
    infoboxHtml: bundle.infoboxHtml === null ? null : resanitizePart(bundle.infoboxHtml),
    noticesHtml: bundle.noticesHtml === null ? null : resanitizePart(bundle.noticesHtml),
  };
}

/**
 * The bundle and freshness of an article. A bundle of this renderer version is returned as it is (`outdated` when
 * `mediaErrorRerenderDue`, given `revisionAt`, the time of the page's current revision). One
 * that only differs in its renderer version (an older transform or sanitizer built it) is returned
 * `outdated`, re-sanitized by the current sanitizer so an older bundle never gets past a tightened rule, and with
 * its old profile links already pointing at the current pages while the page waits to be rendered again.
 * Null when the article has no bundle, or one whose shape is not a bundle's at all, or one the sanitizer
 * throws on, or one too big or too deep to sanitize on a read (resanitizeViewBundle).
 */
export async function loadViewBundle(
  articleId: string,
  revisionAt: Date | null
): Promise<LoadedViewBundle | null> {
  const row = await db.wikiArticle.findUnique({
    where: { id: articleId },
    select: { renderedView: true, htmlSyncedAt: true },
  });
  if (!row) return null;

  const current = viewBundleSchema.safeParse(row.renderedView);
  if (current.success) {
    const outdated = mediaErrorRerenderDue(current.data, row.htmlSyncedAt, revisionAt);
    return { bundle: current.data, htmlSyncedAt: row.htmlSyncedAt, outdated };
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

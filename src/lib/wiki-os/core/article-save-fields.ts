/**
 * article-save-fields.ts — the pure half of `ArticleRepository.saveArticle`: what a save derives from its text, the
 * columns it reads of the page's locked row, and the entity it answers with.
 */

import {
  toArticleSlug,
  toArticleId,
  type SaveArticleInput,
  type WikiArticleEntity,
} from "./domain-types";
import { parseRedirect } from "./redirect";
import { cleanWikitextExcerpt } from "../transformers/wikitext-parser";

/** `WikiArticle.summary` is a VarChar(500); the excerpt stays under it. */
const MAX_EXCERPT_LENGTH = 480;
/** The excerpt is the lead of the article: cleaning more than this is wasted work on a 2 MB page. */
const EXCERPT_SOURCE_LENGTH = 20_000;

/**
 * What a save derives from its text alone: the excerpt (search snippets, link previews; from the
 * text, never the edit summary), the redirect target, the word count and the reading time.
 */
export function deriveSaveFields(input: SaveArticleInput, wikitext: string, providedHtml?: string) {
  const excerpt =
    input.excerpt?.slice(0, MAX_EXCERPT_LENGTH) ??
    (cleanWikitextExcerpt(wikitext.slice(0, EXCERPT_SOURCE_LENGTH), 300).slice(
      0,
      MAX_EXCERPT_LENGTH
    ) ||
      null);
  const redirect = parseRedirect(wikitext);
  const words = (wikitext || providedHtml || "").split(/\s+/).filter(Boolean).length;
  return {
    excerpt,
    redirectTargetSlug: redirect?.title ?? null,
    redirectTargetFragment: redirect?.fragment ?? null,
    words,
    readingTime: Math.max(1, Math.ceil(words / 200)),
  };
}

type SaveFields = ReturnType<typeof deriveSaveFields>;

/**
 * What a save reads of the page's row once it holds the lock: the status (a deleted page is refused) and the columns a
 * null edit answers with. Never the text: the save compares that in the database.
 */
export const LOCKED_ROW_SELECT = {
  id: true,
  title: true,
  source: true,
  status: true,
  namespace: true,
  namespacePrefix: true,
  protectionLevel: true,
  protectionExpiry: true,
  syncedAt: true,
  updatedAt: true,
} as const;

interface SavedRow {
  id: string;
  title: string;
  source: string;
  wikitext: string;
  namespace: number;
  namespacePrefix: string | null;
  protectionLevel: string;
  protectionExpiry: Date | null;
  syncedAt: Date;
  updatedAt: Date;
}

/** The entity `saveArticle` answers with: the saved row plus what the save derived. */
export function toSavedEntity(
  row: SavedRow,
  fields: SaveFields,
  providedHtml: string | undefined,
  authorId: string | undefined
): WikiArticleEntity {
  return {
    id: toArticleId(row.id),
    slug: toArticleSlug(row.title),
    title: row.title,
    source: row.source,
    status: "PUBLISHED",
    format: "STRUCTURED_JSON",
    contentHtml: providedHtml ?? "",
    contentJson: null,
    wikitext: row.wikitext,
    summary: fields.excerpt,
    namespace: row.namespace,
    namespacePrefix: row.namespacePrefix,
    protectionLevel: row.protectionLevel,
    protectionExpiry: row.protectionExpiry,
    infoboxData: null,
    readingTime: fields.readingTime,
    wordCount: fields.words,
    viewCount: 0,
    leadImageUrl: null,
    redirectTargetSlug: fields.redirectTargetSlug,
    redirectTargetFragment: fields.redirectTargetFragment,
    authorId: authorId ?? null,
    lastEditorId: authorId ?? null,
    createdAt: row.syncedAt,
    updatedAt: row.updatedAt,
  };
}

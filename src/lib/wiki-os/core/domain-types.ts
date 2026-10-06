/**
 * domain-types.ts — WikiOS Core Domain Models & Branded Types
 *
 * Provides strongly-typed, nominal identifiers and structured AST definitions
 * for WikiOS articles, revisions, links, and rich-text blocks.
 */

// ---------------------------------------------------------------------------
// Branded Nominal Types
// ---------------------------------------------------------------------------

export type ArticleId = string & { readonly __brand: unique symbol };
export type RevisionId = string & { readonly __brand: unique symbol };
export type ArticleSlug = string & { readonly __brand: unique symbol };
export const toArticleSlug = (slug: string): ArticleSlug =>
  slug.trim().toLowerCase().replace(/ /g, "_").replace(/_{2,}/g, "_") as ArticleSlug;

export const toArticleId = (id: string): ArticleId => id as ArticleId;
export const toRevisionId = (id: string): RevisionId => id as RevisionId;
/**
 * Public revision reference shared by history, diff and undo: the MediaWiki rev_id for
 * revisions synced from MediaWiki, else the WikiOS revision row id (native edits have no
 * rev_id). Row ids are cuids, so an all-digit reference is always a rev_id.
 */
export const toRevisionRef = (rev: { id: string; mwRevId?: number | null }): string =>
  rev.mwRevId ? String(rev.mwRevId) : rev.id;

/** Inverse of `toRevisionRef`: the lookup key for a revision reference. */
export const parseRevisionRef = (ref: string): { mwRevId: number } | { id: string } =>
  /^\d+$/.test(ref) ? { mwRevId: Number(ref) } : { id: ref };

/** MediaWiki's `rev_id` is a 32-bit integer column: a larger number cannot name a revision. */
const MAX_MW_REV_ID = 2_147_483_647;

/** Whether `ref` can be a revision reference: a `rev_id` that fits the column, or a row id. */
export const isRevisionRef = (ref: string): boolean =>
  /^\d+$/.test(ref)
    ? ref.length <= 10 && Number(ref) <= MAX_MW_REV_ID
    : /^[A-Za-z0-9_-]{1,64}$/.test(ref);

// ---------------------------------------------------------------------------
// Structured Block AST
// ---------------------------------------------------------------------------

type WikiBlock =
  | ParagraphBlock
  | HeadingBlock
  | InfoboxBlock
  | StatPlaceholderBlock
  | MapEmbedBlock
  | CalloutBlock
  | TableBlock
  | ImageBlock;

interface ParagraphBlock {
  type: "paragraph";
  id: string;
  children: Array<TextNode | WikilinkInline | ExternalLinkInline>;
}

interface HeadingBlock {
  type: "heading";
  id: string;
  level: 2 | 3 | 4 | 5 | 6;
  text: string;
}

interface InfoboxBlock {
  type: "infobox";
  id: string;
  templateName: string;
  fields: Record<string, string | number>;
  mapCoordinates?: { lat: number; lng: number; zoom?: number };
}

interface StatPlaceholderBlock {
  type: "stat_placeholder";
  id: string;
  key: string; // e.g. "CountryData:Vesper|gdp"
  fallbackValue?: string;
}

interface MapEmbedBlock {
  type: "map_embed";
  id: string;
  lat: number;
  lng: number;
  zoom: number;
  title?: string;
  pinType?: string;
}

interface CalloutBlock {
  type: "callout";
  id: string;
  tone: "info" | "warning" | "success" | "neutral";
  text: string;
  title?: string;
}

interface TableBlock {
  type: "table";
  id: string;
  headers: string[];
  rows: string[][];
  caption?: string;
}

interface ImageBlock {
  type: "image";
  id: string;
  url: string;
  caption?: string;
  altText?: string;
  width?: number;
  height?: number;
}

interface TextNode {
  type: "text";
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
}

interface WikilinkInline {
  type: "wikilink";
  targetSlug: ArticleSlug;
  displayText: string;
  sectionAnchor?: string;
  isBroken?: boolean;
}

interface ExternalLinkInline {
  type: "external_link";
  url: string;
  displayText: string;
}

// ---------------------------------------------------------------------------
// Article Payloads & Entities
// ---------------------------------------------------------------------------

type WikiContentFormat = "STRUCTURED_JSON" | "MARKDOWN" | "WIKITEXT" | "HTML";
type WikiArticleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "PROTECTED";

export interface SaveArticleInput {
  slug: string;
  title: string;
  source?: string;
  format?: WikiContentFormat;
  contentJson?: WikiBlock[];
  contentHtml?: string;
  wikitext?: string;
  /** The edit summary ("fixed typo"): stored on the revision only, never as the article's excerpt. */
  editSummary?: string;
  /** Overrides the article's excerpt (`WikiArticle.summary`); default: derived from the wikitext. */
  excerpt?: string;
  minor?: boolean;
  /**
   * The edit-conflict check, made atomically inside the save's transaction (under the article's row lock): the
   * reference (`toRevisionRef`) of the revision the editor based this save on, or null when the editor believes the
   * page does not exist yet. The save throws `EditConflictError` unless that is the page's latest live (not parked)
   * revision. Omitted: no check (a revert, a rollback, an upload's description page).
   */
  expectedHeadRef?: string | null;
  namespace?: number;
  namespacePrefix?: string | null;
  protectionLevel?: string;
  protectionExpiry?: Date | null;
  infoboxData?: Record<string, unknown>;
  leadImageUrl?: string;
}

export interface WikiArticleEntity {
  id: ArticleId;
  slug: ArticleSlug;
  title: string;
  source: string;
  status: WikiArticleStatus;
  format: WikiContentFormat;
  contentHtml: string;
  contentJson: WikiBlock[] | null;
  wikitext: string;
  summary: string | null;
  namespace: number;
  namespacePrefix: string | null;
  protectionLevel: string;
  protectionExpiry: Date | null;
  infoboxData: Record<string, unknown> | null;
  readingTime: number;
  wordCount: number;
  viewCount: number;
  leadImageUrl: string | null;
  redirectTargetSlug: string | null;
  redirectTargetFragment: string | null;
  authorId: string | null;
  lastEditorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One row of a page's history: everything but the revision's text. */
export interface WikiRevisionSummary {
  id: RevisionId;
  /** MediaWiki rev_id; null for native WikiOS edits. */
  mwRevId: number | null;
  articleId: ArticleId;
  summary: string | null;
  minor: boolean;
  author: string | null;
  createdAt: Date;
  byteSize: number;
  byteDelta: number;
  /** MediaWiki's rev_sha1 of the text; null on rows that predate it. */
  sha1: string | null;
  /** A MediaWiki edit that was not made on top of the page's head: in the history, never the current text. */
  parked: boolean;
  /** MediaWiki revision deletion: what a public reader of the history must not be shown. */
  textDeleted: boolean;
  commentDeleted: boolean;
  userDeleted: boolean;
}

/**
 * Where a page of history starts, by revision reference (see `toRevisionRef`): right after the
 * revision (`before`, the next page of older ones) or at the revision itself (`from`).
 */
export type HistoryPosition = { before: string } | { from: string };

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
export type CategoryId = string & { readonly __brand: unique symbol };
export type UserId = string & { readonly __brand: unique symbol };
export type AssetId = string & { readonly __brand: unique symbol };

export const toArticleSlug = (slug: string): ArticleSlug =>
  slug.trim().toLowerCase().replace(/ /g, "_").replace(/_{2,}/g, "_") as ArticleSlug;

export const toArticleId = (id: string): ArticleId => id as ArticleId;
export const toRevisionId = (id: string): RevisionId => id as RevisionId;
export const toUserId = (id: string): UserId => id as UserId;

// ---------------------------------------------------------------------------
// Structured Block AST
// ---------------------------------------------------------------------------

export type WikiBlock =
  | ParagraphBlock
  | HeadingBlock
  | InfoboxBlock
  | StatPlaceholderBlock
  | MapEmbedBlock
  | CalloutBlock
  | TableBlock
  | ImageBlock;

export interface ParagraphBlock {
  type: "paragraph";
  id: string;
  children: Array<TextNode | WikilinkInline | ExternalLinkInline>;
}

export interface HeadingBlock {
  type: "heading";
  id: string;
  level: 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface InfoboxBlock {
  type: "infobox";
  id: string;
  templateName: string;
  fields: Record<string, string | number>;
  mapCoordinates?: { lat: number; lng: number; zoom?: number };
}

export interface StatPlaceholderBlock {
  type: "stat_placeholder";
  id: string;
  key: string; // e.g. "CountryData:Vesper|gdp"
  fallbackValue?: string;
}

export interface MapEmbedBlock {
  type: "map_embed";
  id: string;
  lat: number;
  lng: number;
  zoom: number;
  title?: string;
  pinType?: string;
}

export interface CalloutBlock {
  type: "callout";
  id: string;
  tone: "info" | "warning" | "success" | "neutral";
  text: string;
  title?: string;
}

export interface TableBlock {
  type: "table";
  id: string;
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface ImageBlock {
  type: "image";
  id: string;
  url: string;
  caption?: string;
  altText?: string;
  width?: number;
  height?: number;
}

export interface TextNode {
  type: "text";
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
}

export interface WikilinkInline {
  type: "wikilink";
  targetSlug: ArticleSlug;
  displayText: string;
  sectionAnchor?: string;
  isBroken?: boolean;
}

export interface ExternalLinkInline {
  type: "external_link";
  url: string;
  displayText: string;
}

// ---------------------------------------------------------------------------
// Article Payloads & Entities
// ---------------------------------------------------------------------------

export type WikiContentFormat = "STRUCTURED_JSON" | "MARKDOWN" | "WIKITEXT" | "HTML";
export type WikiArticleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "PROTECTED";

export interface SaveArticleInput {
  slug: string;
  title: string;
  source?: string;
  format?: WikiContentFormat;
  contentJson?: WikiBlock[];
  contentHtml?: string;
  wikitext?: string;
  summary?: string;
  minor?: boolean;
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
  infoboxData: Record<string, unknown> | null;
  readingTime: number;
  wordCount: number;
  viewCount: number;
  leadImageUrl: string | null;
  redirectTargetSlug: string | null;
  authorId: string | null;
  lastEditorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WikiRevisionSummary {
  id: RevisionId;
  articleId: ArticleId;
  format: WikiContentFormat;
  summary: string | null;
  minor: boolean;
  author: string | null;
  authorId: string | null;
  createdAt: Date;
  byteSize: number;
}

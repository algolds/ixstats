/** Element and text node shapes of the WikiOS visual editor's Plate value (see wiki-html.ts). */

import type { Descendant } from "slate";

export type WikiText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  sup?: boolean;
  sub?: boolean;
  codeMark?: boolean;
};

export interface BaseEl {
  id?: string;
  children: Descendant[];
}
export interface PEl extends BaseEl {
  type: "p";
}
export interface HeadingEl extends BaseEl {
  type: "h2" | "h3" | "h4";
}
export interface QuoteEl extends BaseEl {
  type: "blockquote";
}
export interface ListEl extends BaseEl {
  type: "ul" | "ol";
}
export interface ListItemEl extends BaseEl {
  type: "li";
  level?: number;
  prefix?: string;
}
export interface CodeBlockEl extends BaseEl {
  type: "code-block";
}
export interface TableEl extends BaseEl {
  type: "table";
  caption?: string;
  attributes?: string;
}
export interface RowEl extends BaseEl {
  type: "tr";
  attributes?: string;
}
export interface CellEl extends BaseEl {
  type: "td" | "th";
  attributes?: string;
  isHeader?: boolean;
}
export interface HrEl extends BaseEl {
  type: "hr";
}
export interface LinkEl extends BaseEl {
  type: "link";
  url: string;
  internal?: boolean;
}
export interface TemplateEl extends BaseEl {
  type: "template";
  name: string;
  params: Record<string, string>;
  dataMw: string;
  html: string;
  /** Canonical MediaWiki invocation — emitted verbatim by serializePlateToWikitext. */ wikitext?: string;
}
export interface ChipEngineEl extends BaseEl {
  type: "chip-engine";
  name: string;
  params: Record<string, string>;
  dataMw: string;
  label: string;
}
export interface ChipCoordEl extends BaseEl {
  type: "chip-coord";
  href: string;
  title: string;
  label: string;
}
export interface ChipMapEmbedEl extends BaseEl {
  type: "chip-mapembed";
  href: string;
  title: string;
}
export interface MediaEl extends BaseEl {
  type: "media";
  html: string;
  filename?: string;
}
export interface RawHtmlEl extends BaseEl {
  type: "raw-html";
  html: string;
  kind?: "infobox" | "generic";
  name?: string;
  params?: Record<string, string>;
  dataMw?: string;
  /** Canonical MediaWiki invocation — emitted verbatim by serializePlateToWikitext. */ wikitext?: string;
}
export interface RefEl extends BaseEl {
  type: "ref";
  label: string;
}
export interface InfoboxBoxEl extends BaseEl {
  type: "infobox-box";
  title?: string;
  fields: Array<{ label: string; value: string }>;
  html: string;
  edited?: boolean;
  /** Canonical MediaWiki invocation — emitted verbatim by serializePlateToWikitext. */ wikitext?: string;
}

export type WikiElement =
  | PEl
  | HeadingEl
  | QuoteEl
  | ListEl
  | ListItemEl
  | CodeBlockEl
  | TableEl
  | RowEl
  | CellEl
  | HrEl
  | LinkEl
  | TemplateEl
  | ChipEngineEl
  | ChipCoordEl
  | ChipMapEmbedEl
  | MediaEl
  | RawHtmlEl
  | RefEl
  | InfoboxBoxEl;

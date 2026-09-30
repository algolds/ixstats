/**
 * plate-node.ts — the shape of a Plate/Slate node as the WikiOS wikitext code reads it.
 *
 * Slate's own `Descendant` is opaque to the wikitext code (every element type adds its own
 * properties), so the properties the converter and the serializer read are listed here, all
 * optional. The `wiki*` properties are the provenance a block gets when a page is loaded
 * (plan 414, selective serialisation) and are never part of the content.
 */

import type { WikiParameter } from "../core/wiki-ast";

export interface PlateNode {
  type?: string;
  text?: string;
  children?: PlateNode[];

  // Text marks
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  codeMark?: boolean;
  sup?: boolean;
  superscript?: boolean;
  sub?: boolean;
  subscript?: boolean;

  // Elements
  id?: string;
  url?: string;
  target?: string;
  internal?: boolean;
  label?: string;
  name?: string;
  templateName?: string;
  params?: Record<string, string>;
  positional?: string[];
  paramList?: WikiParameter[];
  wikitext?: string;
  rawWikitext?: string;
  html?: string;
  level?: number;
  prefix?: string;
  attributes?: string;
  caption?: string;
  filename?: string;
  align?: string;
  connector?: string;
  slug?: string;
  metric?: string;
  lat?: number;
  lng?: number;
  /** The template was changed through its form (`params`); its wikitext is rebuilt from them, keeping what was not changed. */
  edited?: boolean;
  /** Every pipe parameter of a `wiki-file` element, verbatim and in order. */
  fileParams?: string[];
  /** Why a `raw-wikitext` element is read-only (`redirect`, `comment`, `tag`, …). */
  construct?: string;
  tag?: string;

  // Provenance (plan 414)
  /** The block or inline construct exactly as it was written. */
  wikiRaw?: string;
  /**
   * On a link: the bold/italic that was written around it when it was loaded. `wikiRaw` does not
   * include it, and the link's leaves carry it together with the marks inside the label.
   */
  wikiOuter?: { bold?: boolean; italic?: boolean };
  /** Fingerprint of the node's content when it was loaded; `wikiRaw` is only valid while it still matches. */
  wikiFp?: string;
  /** Offset of the block in the loaded page; identifies the original block even after Slate splits it. */
  wikiSrc?: number;
  /** The text between the previous block and this one. */
  wikiSep?: string;
  /** On the first block: the text before it. */
  wikiLead?: string;
  /** On the last block: the text after it. */
  wikiTrail?: string;
  /** On a table: its `{|` line and caption lines, exactly as written. */
  wikiTableHead?: string;
  /** Fingerprint of the table's attributes and caption when it was loaded; `wikiTableHead` is valid while it matches. */
  wikiTableHeadFp?: string;
  /** On a table: what follows its last row (empty rows, the `|}` line), exactly as written. */
  wikiTableTail?: string;
}

/**
 * wiki-wikitext.ts — Canonical wikitext serialization for the Plate canvas.
 *
 * Selective serialisation (plan 414): a block loaded from wikitext whose content is unchanged is
 * written back exactly as it was loaded, with the separator it had; only blocks the user edited or
 * inserted are generated from the Plate node. Atomic and interactive template nodes emit their
 * stored wikitext or canonical representation; structural blocks map to standard MediaWiki markup.
 */

import type { Descendant } from "slate";
import type { PlateNode } from "~/lib/wiki-os/transformers/plate-node";
import { isUnmodified, serializeInline } from "./wiki-inline-wikitext";
import {
  headingWikitext,
  listWikitext,
  tableWikitext,
  templateWikitext,
} from "./wiki-structure-wikitext";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface WikitextSerializeResult {
  wikitext: string;
  complete: boolean;
  /** Things the author should be told after a save: an edit that could not be applied, a block that was moved. */
  notices: string[];
}

function mediaWikitext(el: PlateNode): string {
  if (el.wikitext) return el.wikitext;
  if (!el.filename) return el.rawWikitext || "";
  return `[[File:${el.filename}${el.align ? `|${el.align}` : "|thumb"}${el.caption ? `|${el.caption}` : ""}]]`;
}

interface SerializeState {
  complete: boolean;
  notices: string[];
}

type BlockSerializer = (el: PlateNode, state: SerializeState) => string;

const headingSerializer =
  (level: number): BlockSerializer =>
  (el) =>
    headingWikitext(el, level);

/** A paragraph that holds only whitespace writes nothing. */
const paragraphWikitext: BlockSerializer = (el) => {
  const inner = serializeInline(el.children);
  return inner.trim() ? inner : "";
};

const BLOCKQUOTE_CLOSE = "</blockquote>";

/**
 * A blockquote with its text as edited, inside the tags it was written with: the opening tag keeps its attributes,
 * and the blanks and line breaks just inside the tags stay (`<blockquote>\n:* item` must keep its line break, or the
 * item stops being a list).
 */
const blockquoteWikitext: BlockSerializer = (el) => {
  const inner = serializeInline(el.children).trim();
  const raw = el.wikiRaw ?? "";
  const tagEnd = /^<blockquote\b/i.test(raw) ? raw.indexOf(">") : -1;
  const closeAt = tagEnd === -1 ? -1 : raw.toLowerCase().indexOf(BLOCKQUOTE_CLOSE, tagEnd);
  if (closeAt === -1) return `<blockquote>${inner}</blockquote>`;
  const body = raw.slice(tagEnd + 1, closeAt);
  const lead = body.slice(0, body.length - body.trimStart().length);
  const trail = body.trim() === "" ? "" : body.slice(body.trimEnd().length);
  return `${raw.slice(0, tagEnd + 1)}${lead}${inner}${trail}${raw.slice(closeAt)}`;
};

const rawHtmlWikitext: BlockSerializer = (el, state) => {
  const wt = el.rawWikitext || el.wikitext;
  if (!wt) state.complete = false;
  return wt || el.html || "";
};

const BLOCK_SERIALIZERS: ReadonlyMap<string, BlockSerializer> = new Map<string, BlockSerializer>([
  ["h1", headingSerializer(1)],
  ["h2", headingSerializer(2)],
  ["h3", headingSerializer(3)],
  ["h4", headingSerializer(4)],
  ["h5", headingSerializer(5)],
  ["h6", headingSerializer(6)],
  ["p", paragraphWikitext],
  ["lic", paragraphWikitext],
  ["blockquote", blockquoteWikitext],
  [
    "code-block",
    (el) => `<pre>${esc((el.children ?? []).map((c) => c.text ?? "").join(""))}</pre>`,
  ],
  ["ul", listWikitext],
  ["ol", listWikitext],
  ["table", tableWikitext],
  ["hr", () => "----"],
  ["infobox-block", (el, state) => templateWikitext(el, "Infobox", state.notices)],
  ["infobox", (el, state) => templateWikitext(el, "Infobox", state.notices)],
  ["infobox-box", (el, state) => templateWikitext(el, "Infobox", state.notices)],
  ["template-block", (el, state) => templateWikitext(el, "Template", state.notices)],
  ["template", (el, state) => templateWikitext(el, "Template", state.notices)],
  ["media", mediaWikitext],
  ["raw-wikitext", (el) => el.rawWikitext ?? ""],
  ["raw-html", rawHtmlWikitext],
]);

/** The wikitext of one generated block, without its separator; "" for a block that writes nothing. */
function blockWikitext(el: PlateNode, state: SerializeState): string {
  const serialize = el.type === undefined ? undefined : BLOCK_SERIALIZERS.get(el.type);
  return serialize ? serialize(el, state) : el.rawWikitext || el.wikitext || "";
}

const newlineCount = (text: string): number => text.split("\n").length - 1;

/** What the previous block written to the output tells the next one about its separator. */
interface Written {
  /** End offset of the previous block in the loaded page, when it is an original block. */
  srcEnd: number | null;
}

/**
 * The separator to write before `el`. Between two blocks that were neighbours and still are, it is
 * the one they had, edited or not: a block that shared its line with the one before it (an infobox
 * followed by text) stays on that line, and blocks one line break apart stay one line break apart.
 * Otherwise an original block keeps a blank-line separator, and everything else gets a blank line
 * (a single line break could merge a paragraph into the block before it).
 */
function separatorBefore(el: PlateNode, isOriginal: boolean, prev: Written): string {
  const recorded = isOriginal ? el.wikiSep : undefined;
  if (recorded === undefined) return "\n\n";
  const adjacent = prev.srcEnd !== null && prev.srcEnd === (el.wikiSrc ?? 0) - recorded.length;
  // Neighbours that still are neighbours keep what was between them: two paragraphs one line break apart were
  // written that way (MediaWiki reads them as one), and an edit to either must not split them.
  if (adjacent) return recorded;
  if (newlineCount(recorded) >= 2) return recorded;
  return "\n\n";
}

/**
 * For each original block (by offset in the loaded page) the index of the node that still is that
 * block. Slate copies a block's properties when it splits it, so an offset can appear twice: the
 * unmodified node owns it, else the first one.
 */
function originalOwners(nodes: readonly PlateNode[]): Map<number, number> {
  const owners = new Map<number, number>();
  nodes.forEach((node, index) => {
    if (node.wikiSrc !== undefined && isUnmodified(node) && !owners.has(node.wikiSrc)) {
      owners.set(node.wikiSrc, index);
    }
  });
  nodes.forEach((node, index) => {
    if (node.wikiSrc !== undefined && !owners.has(node.wikiSrc)) owners.set(node.wikiSrc, index);
  });
  return owners;
}

/** A block the output will contain, with how it is written. */
interface Planned {
  el: PlateNode;
  isOriginal: boolean;
  body: string;
}

const isRedirect = (el: PlateNode): boolean =>
  el.type === "raw-wikitext" && el.construct === "redirect";

/**
 * MediaWiki honours `#REDIRECT` only on the first line of a page. A redirect block that is not first
 * (the author added blocks above it) is moved to the top, and the author is told.
 */
function redirectFirst(planned: Planned[], state: SerializeState): Planned[] {
  const at = planned.findIndex((block) => isRedirect(block.el));
  if (at <= 0) return planned;
  state.notices.push(
    "The #REDIRECT line was moved to the top of the page: MediaWiki only honours a redirect on the first line."
  );
  return [planned[at]!, ...planned.slice(0, at), ...planned.slice(at + 1)];
}

/**
 * Serialize the Plate value to MediaWiki wikitext. Blocks loaded from wikitext and not edited are
 * written back byte for byte, separators included; the leading text of the page is kept with its
 * first block and the trailing text with its last.
 */
export function serializePlateToWikitext(value: readonly Descendant[]): WikitextSerializeResult {
  const nodes = value as readonly PlateNode[];
  const owners = originalOwners(nodes);
  const state: SerializeState = { complete: true, notices: [] };

  const planned: Planned[] = [];
  for (const [index, el] of nodes.entries()) {
    const isOriginal = el.wikiSrc !== undefined && owners.get(el.wikiSrc) === index;
    const verbatimRaw = isOriginal && isUnmodified(el) ? el.wikiRaw : undefined;
    const body = verbatimRaw ?? blockWikitext(el, state);
    if (body !== "") planned.push({ el, isOriginal, body });
  }

  let out = "";
  let prev: Written | null = null;
  for (const { el, isOriginal, body } of redirectFirst(planned, state)) {
    const lead = isOriginal ? (el.wikiLead ?? "") : "";
    out += (prev === null ? lead : separatorBefore(el, isOriginal, prev)) + body;
    prev = {
      srcEnd: isOriginal && el.wikiRaw !== undefined ? (el.wikiSrc ?? 0) + el.wikiRaw.length : null,
    };
  }

  out += nodes[nodes.length - 1]?.wikiTrail ?? "";
  return { wikitext: out, complete: state.complete, notices: state.notices };
}

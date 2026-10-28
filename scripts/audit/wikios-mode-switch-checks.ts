/**
 * scripts/audit/wikios-mode-switch-checks.ts — the editor's mode switches and one-keystroke edits, as pure checks.
 *
 * What the real editor does (WikiEditBridge.tsx, WikiVisualEditor.tsx, PlateWikiEditor.tsx):
 *   - Source -> visual remounts the visual editor on the source text: `wikitextToAst` -> `astToPlateNodes`, then Plate's
 *     NodeIdPlugin gives every block element an `id` (no full normalisation on load: `shouldNormalizeEditor` is off).
 *   - The visual editor serializes with `serializePlateToWikitext` after every change; visual -> source hands that text
 *     to the source editor when the document is dirty (and keeps the previous text when it is not).
 *   - An edit is a Slate operation: Slate normalises the paths it touched, with the plugins' `isInline`/`isVoid` and the
 *     empty-link normaliser.
 * These checks model that path: `loadInEditor` is a mount, `saveFromEditor` the serialization, and an edit is typed into
 * a real Slate editor configured like the Plate one. The switch back to source is modelled as always taking the
 * serialized text (the dirty case), which is the stricter of the two.
 */

import { createEditor, Editor, Node, type Descendant, type Path, Transforms } from "slate";
import {
  INLINE_ELEMENTS,
  VOID_BLOCK_ELEMENTS,
  VOID_INLINE_ELEMENTS,
} from "../../src/components/wiki-os/editor/plate/element-kinds";
import { removeEmptyLink } from "../../src/components/wiki-os/editor/plate/link-normalizer";
import { serializePlateToWikitext } from "../../src/components/wiki-os/editor/plate/wiki-wikitext";
import { plateFingerprint } from "../../src/lib/wiki-os/transformers/plate-fingerprint";
import type { PlateNode } from "../../src/lib/wiki-os/transformers/plate-node";
import {
  astToPlateNodes,
  wikitextToAst,
} from "../../src/lib/wiki-os/transformers/wiki-ast-converter";

const VOID_TYPES = new Set<string>([...VOID_BLOCK_ELEMENTS, ...VOID_INLINE_ELEMENTS]);
const INLINE_TYPES = new Set<string>([...VOID_INLINE_ELEMENTS, ...INLINE_ELEMENTS]);

/** A character no page holds, typed as the edit so that it can be found and taken out again. */
export const EDIT_MARK = "";

const isElement = (node: PlateNode): boolean => Array.isArray(node.children);
const isInlineType = (type: string | undefined): boolean =>
  type !== undefined && INLINE_TYPES.has(type);

let idCounter = 0;

/** Plate's NodeIdPlugin on mount: an `id` on every block element (not on text, not on inline elements). */
function withBlockIds(nodes: PlateNode[]): PlateNode[] {
  for (const node of nodes) {
    if (!isElement(node) || isInlineType(node.type)) continue;
    node.id ??= `n${(idCounter++).toString(36)}`;
    withBlockIds(node.children ?? []);
  }
  return nodes;
}

/** What the visual editor holds after it mounts on `wikitext`. */
export function loadInEditor(wikitext: string): PlateNode[] {
  return withBlockIds(astToPlateNodes(wikitextToAst(wikitext)) as PlateNode[]);
}

/** What the visual editor hands on (to a save, or to the source editor on a dirty switch). */
export function saveFromEditor(nodes: readonly PlateNode[]): string {
  return serializePlateToWikitext(nodes as Descendant[]).wikitext;
}

/** One stable string for a whole Plate value: each block's content fingerprint. */
export function valueFingerprint(nodes: readonly PlateNode[]): string {
  return nodes.map((node) => plateFingerprint(node)).join("\n");
}

/** A Slate editor configured as the Plate one is: inline and void element types, and the empty-link normaliser. */
export function slateEditor(value: readonly PlateNode[]): Editor {
  const editor = createEditor();
  editor.isInline = (el) => isInlineType((el as PlateNode).type);
  editor.isVoid = (el) => VOID_TYPES.has((el as PlateNode).type ?? "");
  const { normalizeNode } = editor;
  editor.normalizeNode = (entry, options) => {
    if (removeEmptyLink(editor, entry)) return;
    normalizeNode(entry, options);
  };
  editor.children = structuredClone(value) as Descendant[];
  return editor;
}

export interface CycleResult {
  /** Every cycle wrote back the original text. */
  fixedPoint: boolean;
  /** Every cycle loaded the same Plate content. */
  stableTree: boolean;
  /** The first text that differed from the original, when one did. */
  firstDifferent: string | null;
}

/** `cycles` round trips source -> visual -> source, each starting from what the last one wrote. */
export function checkCycles(original: string, cycles: number): CycleResult {
  let text = original;
  let firstFingerprint: string | null = null;
  let stableTree = true;
  let firstDifferent: string | null = null;
  for (let cycle = 0; cycle < cycles; cycle++) {
    const nodes = loadInEditor(text);
    const fingerprint = valueFingerprint(nodes);
    firstFingerprint ??= fingerprint;
    if (fingerprint !== firstFingerprint) stableTree = false;
    text = saveFromEditor(nodes);
    if (text !== original && firstDifferent === null) firstDifferent = text;
  }
  return { fixedPoint: firstDifferent === null, stableTree, firstDifferent };
}

/** Whether Slate's full normalisation of the loaded page (what edits trigger on the paths they touch) changes nothing. */
export function normalisedSave(original: string): string {
  const editor = slateEditor(loadInEditor(original));
  Editor.normalize(editor, { force: true });
  return saveFromEditor(editor.children as PlateNode[]);
}

/** A place a writer can type: the end of the last plain text leaf of a block, list item or table cell. */
export interface EditableUnit {
  kind: string;
  /** Path of the text leaf the edit is typed into. */
  path: Path;
}

const TEXT_BLOCKS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code-block"]);

/**
 * The last direct text child of `node` at `path` that shows something (else the last text child at all), as a unit;
 * null when it has none. A leaf of blanks after the text (a cell's trailing blank line) is not where a writer types.
 */
function lastTextUnit(node: PlateNode, path: Path, kind: string): EditableUnit | null {
  const children = node.children ?? [];
  let fallback: number | null = null;
  for (let index = children.length - 1; index >= 0; index--) {
    const text = children[index]!.text;
    if (typeof text !== "string") continue;
    if (text.trim() !== "") return { kind, path: [...path, index] };
    fallback ??= index;
  }
  return fallback === null ? null : { kind, path: [...path, fallback] };
}

/** A unit for each child of `node` (list items, table cells) that has a text leaf. */
function childUnits(
  node: PlateNode,
  path: Path,
  kindOf: (child: PlateNode) => string
): EditableUnit[] {
  return (node.children ?? []).flatMap(
    (child, index) => lastTextUnit(child, [...path, index], kindOf(child)) ?? []
  );
}

function unitsOfBlock(node: PlateNode, path: Path): EditableUnit[] {
  const type = node.type ?? "";
  if (TEXT_BLOCKS.has(type)) {
    const unit = lastTextUnit(node, path, type);
    return unit ? [unit] : [];
  }
  if (type === "ul" || type === "ol") return childUnits(node, path, () => "li");
  if (type !== "table") return [];
  return (node.children ?? []).flatMap((row, index) =>
    childUnits(row, [...path, index], (cell) => cell.type ?? "td")
  );
}

/** Every place of the page a writer can type at the end of. */
export function editableUnits(nodes: readonly PlateNode[]): EditableUnit[] {
  return nodes.flatMap((node, index) => unitsOfBlock(node, [index]));
}

/** `count` items spread evenly over `items`. */
export function spread<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  return Array.from({ length: count }, (_, i) => items[Math.floor((i * items.length) / count)]!);
}

export interface EditOutcome {
  kind: string;
  /** Taking the typed character out of the output gives back the original, byte for byte. */
  local: boolean;
  /** Everything outside the top-level block that was edited is byte-identical. */
  confined: boolean;
  /** The output without the typed character loads to the same Plate content as the original (the parser, which reads
   * quote marks, links and templates as MediaWiki does, sees no difference). */
  equivalent: boolean;
  /** The typed character is in the output exactly once. */
  markOnce: boolean;
  /** Loading the edited output and writing it again gives the same text (a switch to source and back). */
  stableAfter: boolean;
  /** The output with the typed character taken out (for a report). */
  output: string;
}

/**
 * Types one character at the end of the visible text of `unit` (before blanks that end its leaf, which the canvas does
 * not show and which belong to the markup around a cell or item) in a Slate editor on `nodes`, and saves.
 */
export function typeAt(nodes: readonly PlateNode[], unit: EditableUnit, text = EDIT_MARK): string {
  const editor = slateEditor(nodes);
  const leafText = (Node.get(editor, unit.path) as PlateNode).text ?? "";
  const offset = leafText.trimEnd().length;
  Transforms.insertText(editor, text, { at: { path: unit.path, offset } });
  return saveFromEditor(editor.children as PlateNode[]);
}

/** Whether `output` equals `original` outside `[start, end)` of the original. */
function sameOutside(original: string, output: string, start: number, end: number): boolean {
  const tail = original.length - end;
  return (
    output.length >= start + tail &&
    output.startsWith(original.slice(0, start)) &&
    output.endsWith(original.slice(end))
  );
}

export function checkEdit(
  original: string,
  nodes: readonly PlateNode[],
  unit: EditableUnit
): EditOutcome {
  const edited = typeAt(nodes, unit);
  const output = edited.split(EDIT_MARK).join("");
  const block = nodes[unit.path[0]!]!;
  const start = block.wikiSrc ?? 0;
  const local = output === original;
  return {
    kind: unit.kind,
    local,
    confined: local || sameOutside(original, output, start, start + (block.wikiRaw ?? "").length),
    equivalent:
      local || valueFingerprint(loadInEditor(output)) === valueFingerprint(loadInEditor(original)),
    markOnce: edited.split(EDIT_MARK).length === 2,
    stableAfter: saveFromEditor(loadInEditor(edited)) === edited,
    output,
  };
}

/** The first difference between two texts, with some context, for a report. */
export function diffWindow(
  expected: string,
  actual: string,
  context = 40
): { at: number; expected: string; actual: string } {
  let at = 0;
  while (at < expected.length && expected[at] === actual[at]) at++;
  let tail = 0;
  while (
    tail < expected.length - at &&
    tail < actual.length - at &&
    expected[expected.length - 1 - tail] === actual[actual.length - 1 - tail]
  )
    tail++;
  const from = Math.max(0, at - context);
  return {
    at,
    expected: expected.slice(from, Math.min(expected.length, expected.length - tail + context)),
    actual: actual.slice(from, Math.min(actual.length, actual.length - tail + context)),
  };
}

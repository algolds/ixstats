/** @jest-environment node */
/**
 * editor-normalisation.test.ts — Slate's normaliser must not change what the visual editor loads.
 *
 * The editor saves an untouched block from its recorded source only while the block's fingerprint
 * still matches the one taken at load time, so the value Slate holds after normalising must have
 * the same fingerprints as the value the converter produced. Runs Slate's own normaliser with the
 * inline/void element kinds the plugin registry declares (`element-kinds.ts`); platejs itself is
 * ESM-only and not loadable here. (Checked against the real Plate editor with
 * `createPlateEditor({ plugins: createIxWikiPlugins(), value })`: 0 of 211 fixture blocks differ.)
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createEditor, Editor, type Descendant } from "slate";
import { serializePlateToWikitext } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import {
  INLINE_ELEMENTS,
  VOID_BLOCK_ELEMENTS,
  VOID_INLINE_ELEMENTS,
} from "~/components/wiki-os/editor/plate/element-kinds";
import { plateFingerprint } from "~/lib/wiki-os/transformers/plate-fingerprint";
import type { PlateNode } from "~/lib/wiki-os/transformers/plate-node";
import { astToPlateNodes, wikitextToAst } from "~/lib/wiki-os/transformers/wiki-ast-converter";

const VOID_TYPES = new Set<string>([...VOID_BLOCK_ELEMENTS, ...VOID_INLINE_ELEMENTS]);
const INLINE_TYPES = new Set<string>([...VOID_INLINE_ELEMENTS, ...INLINE_ELEMENTS]);
const isInlineType = (type: string | undefined): boolean => type !== undefined && INLINE_TYPES.has(type);

const FIXTURE_DIR = join(__dirname, "../../fixtures/wikitext");
const fixtures = readdirSync(FIXTURE_DIR)
  .filter((name) => name.endsWith(".wiki"))
  .sort();

function normalise(value: Descendant[], inline: (type: string | undefined) => boolean): PlateNode[] {
  const editor = createEditor();
  editor.isInline = (el) => inline((el as PlateNode).type);
  editor.isVoid = (el) => VOID_TYPES.has((el as PlateNode).type ?? "");
  editor.children = structuredClone(value);
  Editor.normalize(editor, { force: true });
  return editor.children as PlateNode[];
}

describe("Slate normalisation of a freshly loaded page", () => {
  it.each(fixtures)("%s keeps every block's fingerprint and saves byte-identical", (name) => {
    const input = readFileSync(join(FIXTURE_DIR, name), "utf8");
    const loaded = astToPlateNodes(wikitextToAst(input)) as Descendant[];
    const normalised = normalise(loaded, isInlineType);

    expect(normalised).toHaveLength(loaded.length);
    normalised.forEach((node, index) => {
      expect(plateFingerprint(node)).toBe((loaded[index] as PlateNode).wikiFp);
    });
    expect(serializePlateToWikitext(normalised as Descendant[]).wikitext).toBe(input);
  });

  it("would unwrap a link in a paragraph if links were not registered as inline elements", () => {
    const loaded = astToPlateNodes(wikitextToAst("See [[Vilena]] today.")) as Descendant[];
    const unregistered = normalise(loaded, (type) => type !== "link" && isInlineType(type));
    expect(plateFingerprint(unregistered[0]!)).not.toBe((loaded[0] as PlateNode).wikiFp);
  });
});

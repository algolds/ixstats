/**
 * A registered Plate plugin renders through `components`, never `renderElement`: every void or inline element type
 * needs a component, or Plate draws an empty div (a file loaded from wikitext was invisible in the canvas).
 */
jest.mock("platejs/react", () => ({
  createPlatePlugin: () => ({ extend: () => ({ overrideEditor: () => ({}) }) }),
  useElement: jest.fn(),
  usePath: jest.fn(),
  useReadOnly: jest.fn(),
  useEditorRef: jest.fn(),
}));

import { getIxWikiComponents } from "~/components/wiki-os/editor/plate/plugins/createIxWikiPlugins";
import { PlateMediaElement } from "~/components/wiki-os/editor/plate/elements/PlateMediaElement";
import {
  INLINE_ELEMENTS,
  VOID_BLOCK_ELEMENTS,
  VOID_INLINE_ELEMENTS,
} from "~/components/wiki-os/editor/plate/element-kinds";

describe("getIxWikiComponents", () => {
  const fallback = () => null;
  const components: Record<string, unknown> = getIxWikiComponents(fallback);

  it("gives every registered element type a component", () => {
    for (const key of [...VOID_BLOCK_ELEMENTS, ...VOID_INLINE_ELEMENTS, ...INLINE_ELEMENTS]) {
      expect(components[key]).toBeDefined();
    }
  });

  it("renders files, refs and links with the fallback, and keeps the dedicated components", () => {
    expect(components["wiki-file"]).toBe(fallback);
    expect(components["citation-ref"]).toBe(fallback);
    expect(components.link).toBe(fallback);
    expect(components.media).toBe(PlateMediaElement);
  });
});

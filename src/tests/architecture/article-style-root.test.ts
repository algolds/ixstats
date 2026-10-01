/** @jest-environment node */
/**
 * Plan 415 review (m4, m5): a TemplateStyles sheet is confined to `.mw-parser-output`, so every element whose
 * innerHTML is a part of an article (the body, the infobox, the page-top notices, the editors' previews, the
 * Main Page's featured card) must carry that class, or the sheet's rules do not reach it, and nothing else may:
 * the reader's own chrome stays outside every root.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

/** [file, the markup object its element takes as dangerouslySetInnerHTML]. */
const PARTS: ReadonlyArray<readonly [string, string]> = [
  ["src/components/wiki-os/reader/ArticleRenderer.tsx", "bodyMarkup"],
  ["src/components/wiki-os/reader/ArticleRenderer.tsx", "noticesMarkup"],
  ["src/components/wiki-os/reader/InfoboxWithMap.tsx", "infoboxMarkup"],
  ["src/components/wiki-os/editor/WikiSourceEditor.tsx", "previewMarkup"],
  ["src/components/wiki-os/editor/plate/elements/PlateInteractiveTemplateElement.tsx", "previewMarkup"],
  ["src/components/wiki-os/editor/components/WikiEditorModalHost.tsx", "previewMarkup"],
  ["src/components/wiki-os/reader/hero/SculptedEmblemHero.tsx", "featuredMarkup"],
];

/** The JSX opening tag that holds `dangerouslySetInnerHTML={markup}`. */
function openingTag(source: string, markup: string): string {
  const at = source.indexOf(`dangerouslySetInnerHTML={${markup}}`);
  if (at === -1) throw new Error(`no element takes ${markup}`);
  return source.slice(source.lastIndexOf("<", at), at);
}

describe("the elements an article's HTML is written into", () => {
  it.each(PARTS)("%s: the element of %s has the root class", (file, markup) => {
    const tag = openingTag(fs.readFileSync(path.join(ROOT, file), "utf8"), markup);

    expect(tag).toContain("ARTICLE_STYLE_ROOT_CLASS");
  });

  it("the root class is the one the scoper confines a sheet to", () => {
    const { ARTICLE_STYLE_ROOT_CLASS, ARTICLE_STYLE_SCOPE } =
      jest.requireActual<typeof import("~/lib/utils/scope-template-styles")>("~/lib/utils/scope-template-styles");

    expect(ARTICLE_STYLE_ROOT_CLASS).toBe("mw-parser-output");
    expect(ARTICLE_STYLE_SCOPE).toBe(".mw-parser-output");
  });
});

/**
 * editor-roundtrip.test.ts — the lossless-editor gate (plan 414, owner gate D4).
 *
 * Every fixture in src/tests/fixtures/wikitext is loaded the way the visual editor loads a page
 * (`wikitextToAst` -> `astToPlateNodes`) and saved the way it saves (`serializePlateToWikitext`)
 * with NO edit in between. The output must equal the input byte for byte.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serializePlateToWikitext } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import { astToPlateNodes, wikitextToAst } from "~/lib/wiki-os/transformers/wiki-ast-converter";

const FIXTURE_DIR = join(__dirname, "../../fixtures/wikitext");
const fixtures = readdirSync(FIXTURE_DIR)
  .filter((name) => name.endsWith(".wiki"))
  .sort();

function loadAndSave(wikitext: string): string {
  return serializePlateToWikitext(astToPlateNodes(wikitextToAst(wikitext))).wikitext;
}

describe("visual editor round trip without edits", () => {
  it("has the fixture corpus the plan asks for", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(15);
    expect(fixtures.filter((name) => name.startsWith("real-")).length).toBeGreaterThanOrEqual(5);
  });

  it.each(fixtures)("%s saves byte-identical wikitext", (name) => {
    const input = readFileSync(join(FIXTURE_DIR, name), "utf8");
    expect(loadAndSave(input)).toBe(input);
  });

  it("keeps #REDIRECT a redirect instead of turning it into a numbered list", () => {
    const input = "#REDIRECT [[Republic of Vesperia]]\n";
    const plate = astToPlateNodes(wikitextToAst(input));
    expect(plate.map((node: { type: string }) => node.type)).not.toContain("ol");
    expect(serializePlateToWikitext(plate).wikitext).toBe(input);
  });
});

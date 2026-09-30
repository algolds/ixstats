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

  it("keeps malformed wikitext byte-identical: 600 seeded mutations of the fixtures", () => {
    // Stray braces, brackets, quote runs, unclosed tags and comments, odd whitespace, cut-off text.
    const pieces = [
      "{{", "}}", "[[", "]]", "{|", "|}", "|-", "'''", "''", "'''''", "<ref>", "</ref>", "<ref name=a />",
      "<!--", "-->", "<nowiki>", "</nowiki>", "<pre>", "</pre>", "\n", "\n\n", "\r\n", " ", "\t", "* ", "# ",
      ": ", "; ", "==", "----", "__NOTOC__", "<gallery>", "</blockquote>", "<blockquote>", "|", "!", "\u00a0",
      "#REDIRECT [[X]]", "[[File:a.png|thumb|x]]", "\ud83d", "\ude00", "\u00e9",
    ];
    const corpus = fixtures.map((name) => readFileSync(join(FIXTURE_DIR, name), "utf8"));
    let state = 20260930;
    const random = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
    const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]!;

    for (let round = 0; round < 600; round++) {
      let doc = pick(corpus);
      for (let edit = 0, count = 1 + Math.floor(random() * 5); edit < count; edit++) {
        const at = Math.floor(random() * (doc.length + 1));
        doc =
          random() < 0.6
            ? doc.slice(0, at) + pick(pieces) + doc.slice(at)
            : doc.slice(0, at) + doc.slice(at + Math.floor(random() * 40));
      }
      expect(loadAndSave(doc)).toBe(doc.trim() === "" ? "" : doc);
    }
  });
});

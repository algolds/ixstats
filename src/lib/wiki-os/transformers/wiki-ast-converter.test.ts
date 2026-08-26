import { wikitextToAst, astToWikitext } from "./wiki-ast-converter";
import type { WikiDocument } from "../core/wiki-ast";

function blocks(doc: WikiDocument): WikiDocument["nodes"] {
  return doc.nodes;
}

describe("wiki-ast-converter", () => {
  it("parses plain paragraphs with bold, italic, and links", () => {
    const doc = wikitextToAst(
      "Hello '''world''' with ''style'' and a [[Main Page|link]]."
    );
    const [para] = blocks(doc);
    expect(para?.type).toBe("paragraph");
    const children = (para as { children: Array<Record<string, unknown>> }).children;
    expect(children.some((c) => c.bold === true && String(c.text).includes("world"))).toBe(true);
    expect(children.some((c) => c.italic === true)).toBe(true);
    expect(children.some((c) => c.type === "wiki-link")).toBe(true);
  });

  it("roundtrips bold/italic/links losslessly", () => {
    const wt = "A '''bold''' and ''italic'' and [[Target|label]] end.";
    const doc = wikitextToAst(wt);
    const out = astToWikitext(doc);
    expect(out).toContain("'''bold'''");
    expect(out).toContain("''italic''");
    expect(out).toContain("[[Target|label]]");
  });

  it("parses and serializes headings", () => {
    const doc = wikitextToAst("Intro\n\n== History ==\n\n=== Ancient ===\n\nAfter.");
    const hs = blocks(doc).filter((n) => n.type === "heading");
    expect(hs.map((h) => (h as { level: number }).level)).toEqual([2, 3]);
    const out = astToWikitext(doc);
    expect(out).toContain("== History ==");
    expect(out).toContain("=== Ancient ===");
  });

  it("roundtrips an infobox with custom parameters", () => {
    const wt = "{{Infobox country\n| capital = Vilena\n| motto = Liberté, Ordre, Concorde\n}}\n\nBody text.";
    const doc = wikitextToAst(wt);
    const infobox = blocks(doc).find((n) => n.type === "infobox") as
      | { templateName: string; params: Record<string, string> }
      | undefined;
    expect(infobox).toBeDefined();
    expect(infobox!.templateName).toBe("Infobox country");
    expect(infobox!.params.capital).toBe("Vilena");

    const out = astToWikitext(doc);
    expect(out).toContain("{{Infobox country");
    expect(out).toContain("| capital = Vilena");
    // second roundtrip is stable
    const doc2 = wikitextToAst(out);
    const infobox2 = blocks(doc2).find((n) => n.type === "infobox") as { params: Record<string, string> };
    expect(infobox2.params.motto).toBe("Liberté, Ordre, Concorde");
  });

  it("roundtrips lists and dividers", () => {
    const wt = "* alpha\n* beta\n\n# one\n# two\n\n----";
    const out = astToWikitext(wikitextToAst(wt));
    expect(out).toContain("* alpha");
    expect(out).toContain("# one");
    expect(out).toContain("----");
  });

  it("roundtrips media syntax", () => {
    const wt = "[[File:Example.svg|thumb|A caption]]";
    const doc = wikitextToAst(wt);
    const media = blocks(doc).find((n) => n.type === "media") as { filename: string; caption?: string };
    expect(media.filename).toBe("File:Example.svg");
    expect(media.caption).toBe("A caption");
    expect(astToWikitext(doc)).toContain("[[File:Example.svg|thumb|A caption]]");
  });

  it("roundtrips tables with headers and rows", () => {
    const wt = [
      '{| class="wikitable"',
      "! Name !! Capital",
      "|-",
      "| Burgundie || Vilena",
      "|-",
      "| Yerli || Arvand",
      "|}",
    ].join("\n");
    const doc = wikitextToAst(wt);
    const table = blocks(doc).find((n) => n.type === "table") as unknown as {
      children: Array<{ children: Array<{ isHeader?: boolean; children: Array<{ text: string }> }> }>;
    };
    expect(table.children.length).toBe(3); // header row + 2 body rows
    const out = astToWikitext(doc);
    expect(out).toContain('{| class="wikitable"');
    expect(out).toContain("! Name");
    expect(out).toContain("| Burgundie");
    expect(out).toContain("| Vilena");
  });

  it("flags parser functions and refs as partial confidence", () => {
    const doc = wikitextToAst("Text with {{#ifexpr:1|a|b}} magic.");
    expect(doc.parseConfidence).toBe("partial");
  });
});

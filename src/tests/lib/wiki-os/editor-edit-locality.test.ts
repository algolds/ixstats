/**
 * editor-edit-locality.test.ts — one edit changes one block (plan 414, steps 4 and 5).
 *
 * The edit is made on the Plate node tree exactly as Slate makes it: new node objects along the
 * edited path, every other node untouched. Everything before and after the edited block must be
 * byte-identical in the saved wikitext, including atomic raw blocks (<pre>, comments, nested
 * tables, …) next to it.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Descendant } from "slate";
import { serializePlateToWikitext } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import type { PlateNode } from "~/lib/wiki-os/transformers/plate-node";
import { astToPlateNodes, wikitextToAst } from "~/lib/wiki-os/transformers/wiki-ast-converter";

const FIXTURE_DIR = join(__dirname, "../../fixtures/wikitext");
const fixtures = readdirSync(FIXTURE_DIR)
  .filter((name) => name.endsWith(".wiki"))
  .sort();

const load = (wikitext: string): PlateNode[] =>
  astToPlateNodes(wikitextToAst(wikitext)) as PlateNode[];
const save = (nodes: PlateNode[]): string =>
  serializePlateToWikitext(nodes as Descendant[]).wikitext;

/** The first plain word of a text leaf that a rename cannot confuse with markup. */
const WORD = /(?<![\w[{<'|=&#/:.-])[A-Za-z]{5,}(?![\w\]}>'|=;:.-])/;

interface Edit {
  index: number;
  value: PlateNode[];
  before: string;
  after: string;
}

/** Renames one word inside one text leaf of the first editable paragraph; null when there is none. */
function editFirstParagraph(nodes: PlateNode[]): Edit | null {
  for (const [index, node] of nodes.entries()) {
    if (node.type !== "p") continue;
    const leafIndex = (node.children ?? []).findIndex(
      (leaf) => typeof leaf.text === "string" && WORD.test(leaf.text)
    );
    if (leafIndex === -1) continue;
    const leaf = node.children![leafIndex]!;
    const before = leaf.text!;
    const after = before.replace(WORD, "Replaced");
    const children = [...node.children!];
    children[leafIndex] = { ...leaf, text: after };
    const value = [...nodes];
    value[index] = { ...node, children };
    return { index, value, before, after };
  }
  return null;
}

describe("editing one paragraph changes only that paragraph", () => {
  let exercised = 0;

  it.each(fixtures)("%s", (name) => {
    const input = readFileSync(join(FIXTURE_DIR, name), "utf8");
    const nodes = load(input);
    const edit = editFirstParagraph(nodes);
    if (!edit) return;
    exercised++;

    const block = nodes[edit.index]!;
    const start = block.wikiSrc!;
    const end = start + block.wikiRaw!.length;
    const output = save(edit.value);

    // (a) everything outside the edited block is byte-identical, separators included
    expect(output.startsWith(input.slice(0, start))).toBe(true);
    expect(output.endsWith(input.slice(end))).toBe(true);
    // and the block itself is its old text with the one word renamed
    const expectedBlock = block.wikiRaw!.replace(edit.before, edit.after);
    expect(output).toBe(input.slice(0, start) + expectedBlock + input.slice(end));
  });

  afterAll(() => {
    expect(exercised).toBeGreaterThanOrEqual(15);
  });
});

describe("bold and italic survive an edit next to a link", () => {
  it("keeps bold across a link", () => {
    const nodes = load("'''[[Foo]] bar''' is a thing.\n");
    const p = nodes[0]!;
    const leaves = p.children!.map((leaf) => (leaf.text === " bar" ? { ...leaf, text: " baz" } : leaf));
    expect(save([{ ...p, children: leaves }])).toBe("'''[[Foo]] baz''' is a thing.\n");
  });

  it("keeps bold that starts before a link and ends after it", () => {
    const nodes = load("'''The [[Foo]] Treaty''' was signed in [[1812]].");
    const p = nodes[0]!;
    const leaves = p.children!.map((leaf) =>
      leaf.text === " Treaty" ? { ...leaf, text: " Pact" } : leaf
    );
    expect(save([{ ...p, children: leaves }])).toBe(
      "'''The [[Foo]] Pact''' was signed in [[1812]]."
    );
  });

  it("keeps a bold link, an italic link and bold+italic text", () => {
    const input = "The '''[[Vilena|capital city]]''' and ''[[Ostrava]]'' meet '''''both''''' today.";
    const p = load(input)[0]!;
    const leaves = p.children!.map((leaf) => (leaf.text === " today." ? { ...leaf, text: " now." } : leaf));
    expect(save([{ ...p, children: leaves }])).toBe(input.replace(" today.", " now."));
  });

  it("rewrites a link whose label was edited, inside the bold run", () => {
    const p = load("'''[[Foo|old label]] bar'''")[0]!;
    const leaves = p.children!.map((leaf) =>
      leaf.type === "link" ? { ...leaf, children: [{ ...leaf.children![0]!, text: "new label" }] } : leaf
    );
    expect(save([{ ...p, children: leaves }])).toBe("'''[[Foo|new label]] bar'''");
  });

  it("does not let a quote mark cross a line break", () => {
    const input = "'''Unclosed bold on this line\nand a second line.";
    const p = load(input)[0]!;
    const leaves = p.children!.map((leaf) => ({ ...leaf, text: leaf.text?.replace("second", "next") }));
    expect(save([{ ...p, children: leaves }])).toBe("'''Unclosed bold on this line'''\nand a next line.");
  });
});

describe("editing an image caption", () => {
  const fileOf = (p: PlateNode): PlateNode => p.children!.find((leaf) => leaf.type === "wiki-file")!;
  const withCaption = (p: PlateNode, caption: string): PlateNode => ({
    ...p,
    children: p.children!.map((leaf) => (leaf.type === "wiki-file" ? { ...leaf, caption } : leaf)),
  });

  it("loads every pipe parameter, in order, and the caption", () => {
    const p = load("[[File:x.png|thumb|upright=1.2|left|alt=A|link=B|Caption with [[link]]]]")[0]!;
    const file = fileOf(p);
    expect(file.target).toBe("File:x.png");
    expect(file.fileParams).toEqual([
      "thumb",
      "upright=1.2",
      "left",
      "alt=A",
      "link=B",
      "Caption with [[link]]",
    ]);
    expect(file.caption).toBe("Caption with [[link]]");
  });

  it("replaces only the caption and keeps the other parameters in order", () => {
    const input = "[[File:x.png|thumb|upright=1.2|left|alt=A|link=B|Caption with [[link]]]]";
    const p = load(input)[0]!;
    expect(save([withCaption(p, "A new caption")])).toBe(
      "[[File:x.png|thumb|upright=1.2|left|alt=A|link=B|A new caption]]"
    );
  });

  it("writes an untouched image back exactly, whatever its spacing", () => {
    const input = "Before [[ File:x.png | thumb |  Cap ]] after.";
    expect(save(load(input))).toBe(input);
  });

  it("gives a captionless image no caption, and adds one only when the user does", () => {
    const p = load("A flag: [[File:Flag.svg|40px]] follows.")[0]!;
    expect(fileOf(p).caption).toBe("");
    expect(save([{ ...p, children: p.children!.map((l) => (l.text === " follows." ? { ...l, text: " ends." } : l)) }])).toBe(
      "A flag: [[File:Flag.svg|40px]] ends."
    );
    expect(save([withCaption(p, "The flag")])).toBe("A flag: [[File:Flag.svg|40px|The flag]] follows.");
  });

  it("removes the caption parameter when it is emptied", () => {
    const p = load("[[File:x.png|thumb|left|Gone]]")[0]!;
    expect(save([withCaption(p, "")])).toBe("[[File:x.png|thumb|left]]");
  });

  it("treats File:, Image: and lower-case aliases as images but not [[:File:…]] or [[Media:…]]", () => {
    const p = load("[[Image:A.png|x]] [[file:b.png]] [[:File:C.png]] [[Media:d.ogg]]")[0]!;
    expect(p.children!.filter((leaf) => leaf.type === "wiki-file")).toHaveLength(2);
    expect(p.children!.filter((leaf) => leaf.type === "link")).toHaveLength(2);
  });
});

describe("structure edits keep separators safe", () => {
  it("does not merge a new paragraph into the paragraph after a heading", () => {
    const nodes = load("== Head ==\nFirst paragraph.\n\nSecond.\n");
    expect(nodes.map((n) => n.type)).toEqual(["h2", "p", "p"]);
    const inserted: PlateNode = { type: "p", children: [{ text: "Inserted." }] };
    const out = save([nodes[0]!, inserted, nodes[1]!, nodes[2]!]);
    expect(out).toBe("== Head ==\n\nInserted.\n\nFirst paragraph.\n\nSecond.\n");
  });

  it("keeps the single line break between a heading and its paragraph when neither moved", () => {
    const nodes = load("== Head ==\nFirst paragraph.\n\nSecond.\n");
    const edited = { ...nodes[2]!, children: [{ text: "Second, edited." }] };
    expect(save([nodes[0]!, nodes[1]!, edited])).toBe("== Head ==\nFirst paragraph.\n\nSecond, edited.\n");
  });

  it("treats the second half of a split paragraph as a new block", () => {
    const nodes = load("Alpha beta.\n\n== Next ==\n");
    const [p, h] = nodes as [PlateNode, PlateNode];
    // Slate copies the properties of a split node, provenance included.
    const first = { ...p, children: [{ text: "Alpha " }] };
    const second = { ...p, children: [{ text: "beta." }] };
    expect(save([first, second, h])).toBe("Alpha \n\nbeta.\n\n== Next ==\n");
  });

  it("keeps text that follows an infobox on the infobox's closing line when it is edited", () => {
    const input = "{{Infobox company\n| name = X\n}}'''X''' is a company.\n\nNext.\n";
    const nodes = load(input);
    expect(nodes.map((n) => n.type)).toEqual(["infobox-block", "p", "p"]);
    expect(save(nodes)).toBe(input);
    const edited = {
      ...nodes[1]!,
      children: nodes[1]!.children!.map((l) => (l.text === " is a company." ? { ...l, text: " is a firm." } : l)),
    };
    expect(save([nodes[0]!, edited, nodes[2]!])).toBe(
      "{{Infobox company\n| name = X\n}}'''X''' is a firm.\n\nNext.\n"
    );
  });

  it("drops a deleted block with its separator and keeps the rest verbatim", () => {
    const input = "One.\n\n\nTwo.\n\nThree.\n";
    const nodes = load(input);
    expect(save([nodes[0]!, nodes[2]!])).toBe("One.\n\nThree.\n");
  });

  it("keeps the leading and trailing text of the page with its first and last block", () => {
    const input = "\n\n  \nFirst.\n\nLast.  \n\n\n";
    const nodes = load(input);
    expect(save(nodes)).toBe(input);
    const edited = { ...nodes[1]!, children: [{ text: "Final." }] };
    // The whitespace after the last block is page text, not block text: it stays as it was.
    expect(save([nodes[0]!, edited])).toBe("\n\n  \nFirst.\n\nFinal.  \n\n\n");
  });

  it("generates wikitext for a page of new blocks only, without a leading or trailing break", () => {
    const out = save([
      { type: "h2", children: [{ text: "New" }] },
      { type: "p", children: [{ text: "Body." }] },
      { type: "ul", children: [{ type: "li", level: 1, children: [{ text: "a" }] }, { type: "li", level: 1, children: [{ text: "b" }] }] },
    ]);
    expect(out).toBe("== New ==\n\nBody.\n\n* a\n* b");
  });
});

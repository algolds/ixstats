/**
 * editor-reverification-fixes.test.ts — plan 414, re-verification items 2, 4, 5, 6, 7 and 8:
 * list type toggles, table row positions, the template rebuilder, headings with inline content,
 * a redirect that must stay first, and links with no target.
 */

import type { Descendant } from "slate";
import { serializePlateToWikitext } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import type { PlateNode } from "~/lib/wiki-os/transformers/plate-node";
import { astToPlateNodes, wikitextToAst } from "~/lib/wiki-os/transformers/wiki-ast-converter";
import { parse } from "~/lib/wiki-os/wikitext/parser";
import { escapeParamValue, rewriteTemplateParams } from "~/lib/wiki-os/wikitext/template-edit";

const load = (wikitext: string): PlateNode[] =>
  astToPlateNodes(wikitextToAst(wikitext)) as PlateNode[];
const result = (nodes: PlateNode[]) => serializePlateToWikitext(nodes as Descendant[]);
const save = (nodes: PlateNode[]): string => result(nodes).wikitext;

describe("list type toggle (item 2)", () => {
  const retype = (nodes: PlateNode[], index: number, type: string): PlateNode[] =>
    nodes.map((n, i) => (i === index ? { ...n, type } : n));

  it("re-marks every untouched item when a bulleted list becomes numbered, keeping depth and spacing", () => {
    const nodes = load("*foo\n*  bar\n** nested\n*: indent\n");
    expect(save(retype(nodes, 0, "ol"))).toBe("#foo\n#  bar\n## nested\n#: indent\n");
  });

  it("re-marks a numbered list back to bullets", () => {
    const nodes = load("# one\n## two\n#* three\n");
    expect(save(retype(nodes, 0, "ul"))).toBe("* one\n** two\n** three\n");
  });

  it("re-marks an item moved or pasted into a list of the other kind, edited or not", () => {
    const [ul, ol] = load("* a\n\n#  z\n# y\n") as [PlateNode, PlateNode];
    const moved = ol.children![0]!;
    const withMoved = { ...ul, children: [...ul.children!, moved] };
    expect(save([withMoved])).toBe("* a\n*  z");

    const edited = { ...moved, children: [{ text: "zz" }] };
    expect(save([{ ...ul, children: [...ul.children!, edited] }])).toBe("* a\n*  zz");
    // and the other way: a bullet item pasted into a numbered list
    const bullet = ul.children![0]!;
    expect(save([{ ...ol, children: [...ol.children!, bullet] }])).toBe("#  z\n# y\n# a\n");
  });

  it("leaves mixed nested lists and : ; lists alone while their type is unchanged", () => {
    const source = "* a\n*# nested numbered\n** nested bullet\n";
    expect(save(load(source))).toBe(source);
    const indent = ":one\n#two\n;term\n";
    expect(save(load(indent))).toBe(indent);
    // an indent list makes no claim about its items, so a type change does not re-mark them either
    const nodes = load(":one\n:two");
    expect(save(nodes.map((n) => ({ ...n, type: "ol" })))).toBe(":one\n:two");
  });

  it("writes new items of a new numbered list with #", () => {
    expect(
      save([
        {
          type: "ol",
          children: [{ type: "li", level: 2, prefix: "**", children: [{ text: "x" }] }],
        },
      ])
    ).toBe("## x");
  });
});

describe("table rows keep a |- when they are not first (item 4)", () => {
  const table = "{|\n| a\n|-\n| b\n|-\n| c\n|}";
  const tableOf = (nodes: PlateNode[]): PlateNode => nodes[0]!;
  const reorder = (order: number[]): string => {
    const t = tableOf(load(table));
    return save([{ ...t, children: order.map((i) => t.children![i]!) }]);
  };
  const cellTexts = (wikitext: string): string[] =>
    (
      parse(wikitext).ast.nodes[0] as {
        children: Array<{ children: Array<{ children: Array<{ text?: string }> }> }>;
      }
    ).children.map((row) =>
      row.children.map((cell) => cell.children.map((leaf) => leaf.text ?? "").join("")).join("|")
    );

  it("moving row 1 (which had no |-) to the end writes the |- it needs", () => {
    const out = reorder([1, 2, 0]);
    expect(out).toBe("{|\n|-\n| b\n|-\n| c\n|-\n| a\n|}");
    expect(cellTexts(out)).toEqual(["b", "c", "a"]);
  });

  it("moving row 3 to the front and swapping rows 1 and 2 keep every row a row of its own", () => {
    const front = reorder([2, 0, 1]);
    expect(front).toBe("{|\n|-\n| c\n|-\n| a\n|-\n| b\n|}");
    expect(cellTexts(front)).toEqual(["c", "a", "b"]);

    const swapped = reorder([1, 0, 2]);
    expect(swapped).toBe("{|\n|-\n| b\n|-\n| a\n|-\n| c\n|}");
    expect(cellTexts(swapped)).toEqual(["b", "a", "c"]);
  });

  it("an unmoved table is written back unchanged, first row without |- included", () => {
    expect(reorder([0, 1, 2])).toBe(table);
  });

  it("rows with |- keep it wherever they go", () => {
    const t = tableOf(load("{|\n|-\n| a\n|-\n| b\n|}"));
    expect(save([{ ...t, children: [t.children![1]!, t.children![0]!] }])).toBe(
      "{|\n|-\n| b\n|-\n| a\n|}"
    );
  });
});

describe("the template rebuilder (item 5)", () => {
  const rewrite = (raw: string, values: Record<string, string>): string | null =>
    rewriteTemplateParams(raw, values);

  it("escapes a top-level | as {{!}} and keeps balanced templates and links as they are", () => {
    expect(escapeParamValue("a|b")).toBe("a{{!}}b");
    expect(escapeParamValue("a {{x|1|2}} b [[T|label]] c|d")).toBe(
      "a {{x|1|2}} b [[T|label]] c{{!}}d"
    );
    expect(escapeParamValue("<nowiki>|</nowiki> <!-- | --> |")).toBe(
      "<nowiki>|</nowiki> <!-- | --> {{!}}"
    );
    expect(rewrite("{{T|a=1}}", { a: "x|y" })).toBe("{{T|a=x{{!}}y}}");
  });

  it("wraps a }} or {{ that pairs with nothing so it cannot end or open a template", () => {
    expect(escapeParamValue("a }} b")).toBe("a <nowiki>}}</nowiki> b");
    expect(escapeParamValue("a {{ b")).toBe("a <nowiki>{{</nowiki> b");
    expect(escapeParamValue("{{ok}} }}")).toBe("{{ok}} <nowiki>}}</nowiki>");
    const out = rewrite("{{T|a=1|b=2}}", { a: "x }} y", b: "2" })!;
    expect(out).toBe("{{T|a=x <nowiki>}}</nowiki> y|b=2}}");
    expect(parse(out).ast.nodes).toHaveLength(1);
  });

  it("writes a positional value that contains = as N=value", () => {
    expect(rewrite("{{T|first|second}}", { "1": "x=y", "2": "second" })).toBe("{{T|1=x=y|second}}");
    expect(rewrite("{{T|first|second}}", { "1": "first", "2": "a=b" })).toBe("{{T|first|2=a=b}}");
    // an = inside a nested template or link does not make it a name
    expect(rewrite("{{T|first}}", { "1": "{{x|a=b}} [[L|k=v]]" })).toBe(
      "{{T|{{x|a=b}} [[L|k=v]]}}"
    );
  });

  it("edits the LAST occurrence of a repeated name and never rewrites the others", () => {
    expect(rewrite("{{T|k=one|k=two|z=3}}", { k: "changed", z: "3" })).toBe(
      "{{T|k=one|k=changed|z=3}}"
    );
    expect(rewrite("{{T| k = one |z=3| k = two }}", { k: "changed", z: "3" })).toBe(
      "{{T| k = one |z=3| k = changed }}"
    );
    // a value equal to the last one's (MediaWiki's) is no edit at all
    expect(rewrite("{{T|k=one|k=two}}", { k: "two" })).toBe("{{T|k=one|k=two}}");
    // removing the name removes every occurrence
    expect(rewrite("{{T|k=one|k=two|z=3}}", { z: "3" })).toBe("{{T|z=3}}");
  });

  it("editing k in {{T|x|1=y|k=v}} does not touch x or 1=y", () => {
    const raw = "{{T|x|1=y|k=v}}";
    expect(rewrite(raw, { "1": "y", k: "w" })).toBe("{{T|x|1=y|k=w}}");
    // editing 1 edits the last `1` (the named one), and leaves the positional x alone
    expect(rewrite(raw, { "1": "Y", k: "v" })).toBe("{{T|x|1=Y|k=v}}");
  });

  it("keeps the comments next to a replaced value", () => {
    expect(rewrite("{{T|a = <!-- lead --> old <!-- trail --> |b=2}}", { a: "new", b: "2" })).toBe(
      "{{T|a = <!-- lead --> new <!-- trail --> |b=2}}"
    );
    expect(rewrite("{{T\n| a = old <!-- why -->\n| b = 2\n}}", { a: "new", b: "2" })).toBe(
      "{{T\n| a = new <!-- why -->\n| b = 2\n}}"
    );
    expect(rewrite("{{T|old <!-- c -->}}", { "1": "new" })).toBe("{{T|new <!-- c -->}}");
  });

  it("does not treat an unclosed template as rewritable", () => {
    expect(rewrite("{{T|a=1", { a: "2" })).toBeNull();
  });
});

describe("a form edit goes through the rebuilder, and an unclosed template is told about (item 5)", () => {
  it("rebuilds an edited template from its own wikitext and a missing close is a notice, never a silent drop", () => {
    const [ok] = load("{{Infobox x\n| a = 1 <!-- keep -->\n| b = 2\n}}");
    const edited = { ...ok!, params: { ...ok!.params, a: "9" }, edited: true };
    expect(result([edited]).wikitext).toBe("{{Infobox x\n| a = 9 <!-- keep -->\n| b = 2\n}}");
    expect(result([edited]).notices).toEqual([]);

    const [open] = load("{{Infobox x\n| a = 1\n| b = 2");
    expect((open as { parseState?: string }).parseState).toBe("incomplete");
    const brokenEdit = { ...open!, params: { ...open!.params, a: "9" }, edited: true };
    const out = result([brokenEdit]);
    expect(out.wikitext).toBe("{{Infobox x\n| a = 1\n| b = 2");
    expect(out.notices).toHaveLength(1);
    expect(out.notices[0]).toMatch(/not closed/);
    expect(out.notices[0]).toContain("Infobox x");
  });
});

describe("headings keep inline content intact (item 6)", () => {
  it("joins only the line breaks of text leaves", () => {
    const heading: PlateNode = {
      type: "h2",
      children: [
        { text: "First\nsecond " },
        { type: "chip-template", rawWikitext: "{{flag|a\n|b}}", children: [{ text: "" }] },
        { text: " <nowiki>keep\nthis</nowiki> end\n  tail" },
      ],
    };
    expect(save([heading])).toBe(
      "== First second {{flag|a\n|b}} <nowiki>keep\nthis</nowiki> end tail =="
    );
  });

  it("joins the lines inside a link label but not inside a comment", () => {
    const heading: PlateNode = {
      type: "h3",
      children: [
        { type: "link", target: "T", internal: true, children: [{ text: "a\nb" }] },
        { text: " <!-- x\ny -->" },
      ],
    };
    expect(save([heading])).toBe("=== [[T|a b]] <!-- x\ny --> ===");
  });
});

describe("a redirect stays first (item 7)", () => {
  it("moves a #REDIRECT block that is not first to the top, with a notice", () => {
    const [redirect, rest] = load("#REDIRECT [[Target]]\n\n[[Category:Redirects]]") as [
      PlateNode,
      PlateNode,
    ];
    const above: PlateNode = { type: "p", children: [{ text: "Inserted above." }] };
    const out = result([above, redirect, rest]);
    expect(out.wikitext.startsWith("#REDIRECT [[Target]]")).toBe(true);
    expect(out.wikitext).toContain("Inserted above.");
    expect(out.wikitext.split("\n")[0]).toBe("#REDIRECT [[Target]]");
    expect(out.notices).toHaveLength(1);
    expect(out.notices[0]).toMatch(/#REDIRECT/);
    expect(out.notices[0]).toMatch(/first line/);
  });

  it("says nothing when the redirect is first, or when an empty block stands above it", () => {
    const [redirect, rest] = load("#REDIRECT [[Target]]\n\n[[Category:Redirects]]") as [
      PlateNode,
      PlateNode,
    ];
    expect(result([redirect, rest]).notices).toEqual([]);
    expect(result([redirect, rest]).wikitext).toBe(
      "#REDIRECT [[Target]]\n\n[[Category:Redirects]]"
    );
    expect(result([{ type: "p", children: [{ text: "" }] }, redirect, rest]).notices).toEqual([]);
  });
});

describe("a link with no target is kept as the text it is (item 8)", () => {
  it("does not make [[|120px|center]] a link, so regenerating its block keeps the brackets", () => {
    const source = "Before [[|120px|center]] after.";
    const nodes = load(source);
    expect(nodes[0]!.children!.some((leaf) => leaf.type === "link")).toBe(false);
    expect(save(nodes)).toBe(source);
    const edited = {
      ...nodes[0]!,
      children: nodes[0]!.children!.map((leaf) =>
        leaf.text ? { ...leaf, text: leaf.text.replace("Before", "Earlier") } : leaf
      ),
    };
    expect(save([edited])).toBe("Earlier [[|120px|center]] after.");
  });

  it("keeps it in a table row that is regenerated", () => {
    const table = "{|\n|-\n| a || [[|120px|center]]\n|-\n| c\n|}";
    const nodes = load(table);
    const t = nodes[0]!;
    const row = t.children![0]!;
    const editedRow = {
      ...row,
      children: row.children!.map((cell, i) =>
        i === 0 ? { ...cell, children: [{ text: "A" }] } : cell
      ),
    };
    expect(save([{ ...t, children: [editedRow, t.children![1]!] }])).toBe(
      "{|\n|-\n| A\n| [[|120px|center]]\n|-\n| c\n|}"
    );
  });

  it("still reads [[ ]] with only spaces as text, and real links as links", () => {
    expect(
      load("[[ ]] and [[Foo]]")[0]!.children!.filter((leaf) => leaf.type === "link")
    ).toHaveLength(1);
  });
});

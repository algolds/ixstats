/**
 * editor-structure-edits.test.ts — selective serialisation below block level, exact table cells,
 * lost edits and junk wikitext (plan 414 review fixes 3-6 and 10).
 */

import type { Descendant } from "slate";
import { serializePlateToWikitext } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import type { PlateNode } from "~/lib/wiki-os/transformers/plate-node";
import { astToPlateNodes, wikitextToAst } from "~/lib/wiki-os/transformers/wiki-ast-converter";

const load = (wikitext: string): PlateNode[] => astToPlateNodes(wikitextToAst(wikitext)) as PlateNode[];
const save = (nodes: PlateNode[]): string => serializePlateToWikitext(nodes as Descendant[]).wikitext;
const roundTrip = (wikitext: string): string => save(load(wikitext));

/** A copy of `node` with the text of the first text leaf that equals `from` replaced by `to`, at any depth. */
function renameText(node: PlateNode, from: string, to: string): PlateNode {
  if (typeof node.text === "string") return node.text === from ? { ...node, text: to } : node;
  return { ...node, children: node.children?.map((child) => renameText(child, from, to)) };
}
const edit = (nodes: PlateNode[], from: string, to: string): PlateNode[] => nodes.map((n) => renameText(n, from, to));

describe("table cells survive edits exactly (review fix 3)", () => {
  const table = [
    '{| class="wikitable"',
    "|-",
    "! Name !! Notes",
    "|-",
    "| Alpha",
    "| First paragraph.",
    "",
    "Second paragraph after a blank line.",
    "",
    "Third, after two blank lines.",
    "|-",
    "| Beta || [[Link|B]]",
    "|}",
  ].join("\n");

  it("round-trips a table with blank lines inside a cell unchanged", () => {
    expect(roundTrip(table)).toBe(table);
  });

  it("keeps a multi-paragraph cell unchanged through 4 edit-save-reload cycles", () => {
    let text = table;
    for (const [from, to] of [
      ["Alpha", "Alpha 1"],
      ["Alpha 1", "Alpha 2"],
      ["Alpha 2", "Alpha 3"],
      ["Alpha 3", "Alpha 4"],
    ] as const) {
      text = save(edit(load(text), from, to));
    }
    expect(text).toBe(table.replace("| Alpha\n", "| Alpha 4\n"));
    expect(text).toContain("First paragraph.\n\nSecond paragraph after a blank line.\n\nThird, after two blank lines.");
  });

  it("keeps a multi-paragraph cell unchanged when that cell's own text is edited, through 4 cycles", () => {
    let text = table;
    for (let cycle = 1; cycle <= 4; cycle++) {
      text = save(edit(load(text), cycle === 1 ? "Third, after two blank lines." : `Third ${cycle - 1}`, `Third ${cycle}`));
    }
    expect(text).toBe(table.replace("Third, after two blank lines.", "Third 4"));
  });

  it("reads blank lines in a cell as one line break each", () => {
    const { ast } = { ast: wikitextToAst("{|\n| a\n\nb\n|}") };
    const table = ast.nodes[0] as { children: Array<{ children: Array<{ children: Array<{ text?: string }> }> }> };
    const text = table.children[0]!.children[0]!.children.map((leaf) => leaf.text ?? "").join("");
    expect(text).toBe("a\n\nb");
  });

  it.each([
    ["<poem>", "| Verse\n<poem>\nRoses are red\n| not a cell\n! not a header\n  Violets are blue\n</poem>"],
    ["<pre>", "| Code\n<pre>\n|-\nline two\n|}\n</pre>"],
    ["a multi-line template whose last line starts with |}", "| Cited {{cite web\n|url=https://example.org\n|}} after"],
  ])("keeps a cell holding %s exact when a neighbouring cell is edited, 4 times", (_name, cell) => {
    const source = `{| class="wikitable"\n|-\n| Name\n${cell}\n|-\n| End\n|}`;
    expect(roundTrip(source)).toBe(source);
    let text = source;
    for (let cycle = 0; cycle < 4; cycle++) {
      text = save(edit(load(text), cycle === 0 ? "Name" : `Name ${cycle}`, `Name ${cycle + 1}`));
    }
    expect(text).toBe(source.replace("| Name\n", "| Name 4\n"));
  });
});

describe("selective serialisation below block level (review fix 4)", () => {
  it("editing one list item changes only that item's line", () => {
    const list = "*foo\n*  bar\n** nested\n*baz\n#one\n";
    const nodes = load(list);
    expect(nodes.map((n) => n.type)).toEqual(["ul", "ol"]);
    expect(save(nodes)).toBe(list);
    expect(save(edit(nodes, "bar", "BAR"))).toBe("*foo\n*  BAR\n** nested\n*baz\n#one\n");
    expect(save(edit(nodes, "foo", "FOO"))).toBe("*FOO\n*  bar\n** nested\n*baz\n#one\n");
    expect(save(edit(nodes, "one", "uno"))).toBe("*foo\n*  bar\n** nested\n*baz\n#uno\n");
  });

  it("keeps the marker of an edited item and its spacing, and leaves the whitespace after the list alone", () => {
    const list = "*:First\n*:Second  \n\nText";
    expect(save(edit(load(list), "First", "Uno"))).toBe("*:Uno\n*:Second  \n\nText");
  });

  it("editing one table cell changes only that row; the header, footer and other rows are verbatim", () => {
    const table = [
      '{| class="wikitable sortable" style="width:50%"',
      "|+Caption",
      "!A!!B",
      "|-",
      "|1||2",
      "|- style=\"color:red\"",
      "|3 || 4",
      "|-",
      "|5",
      "|6",
      "|}",
    ].join("\n");
    const nodes = load(table);
    expect(save(nodes)).toBe(table);
    expect(save(edit(nodes, "4", "four"))).toBe(table.replace("|3 || 4", "|-\n| 3\n| four").replace('|- style="color:red"\n|-\n', '|- style="color:red"\n'));
  });

  it("an edited row is regenerated with its own |- line and the rows around it are untouched", () => {
    const table = "{|\n|-\n|a||b\n|-\n|c||d\n|-\n|e||f\n|}";
    const out = save(edit(load(table), "d", "D"));
    expect(out.split("\n")).toEqual(["{|", "|-", "|a||b", "|-", "| c", "| D", "|-", "|e||f", "|}"]);
  });

  it("keeps the trailing empty rows and footer of a table", () => {
    const table = "{| class=\"x\"\n|-\n| a\n|-\n|-\n|}";
    expect(roundTrip(table)).toBe(table);
    expect(save(edit(load(table), "a", "A"))).toBe('{| class="x"\n|-\n| A\n|-\n|-\n|}');
  });

  it("a table with no attributes stays without when a row is edited", () => {
    expect(save(edit(load("{|\n|-\n| a\n|}"), "a", "b"))).toBe("{|\n|-\n| b\n|}");
  });

  it("keeps the spacing of a heading when only its text changes, and through a level change", () => {
    expect(save(edit(load("==Foo=="), "Foo", "Bar"))).toBe("==Bar==");
    expect(save(edit(load("===  Foo  ==="), "Foo", "Bar"))).toBe("===  Bar  ===");
    expect(save(edit(load("== Foo =="), "Foo", "Bar"))).toBe("== Bar ==");
    const [h] = load("==Foo==");
    expect(save([{ ...h!, type: "h3", children: [{ text: "Foo" }] }])).toBe("===Foo===");
  });
});

describe("lists: indent and outdent win over the stored prefix (review fix 5a)", () => {
  const item = (level: number, prefix?: string): PlateNode => ({
    type: "li",
    level,
    ...(prefix ? { prefix } : {}),
    children: [{ text: "x" }],
  });
  const listOf = (li: PlateNode, type = "ul"): string => save([{ type, children: [li] }]);

  it("follows `level` when it no longer matches the prefix length", () => {
    expect(listOf(item(1, "**"))).toBe("* x");
    expect(listOf(item(3, "*"))).toBe("*** x");
    expect(listOf(item(1, "*#"))).toBe("* x");
    expect(listOf(item(3, "*#"))).toBe("*## x");
    expect(listOf(item(2, "##"), "ol")).toBe("## x");
  });

  it("keeps the prefix as it is while level and prefix agree, and outdents a loaded item", () => {
    expect(listOf(item(2, "*#"))).toBe("*# x");
    const nodes = load("* a\n** b");
    const list = nodes[0]!;
    const outdented = { ...list, children: list.children!.map((li) => (li.level === 2 ? { ...li, level: 1 } : li)) };
    expect(save([outdented])).toBe("* a\n* b");
  });
});

describe("edited templates and infoboxes are serialised (review fix 5b)", () => {
  const infobox = "{{Infobox country\n| name = Urcea\n| capital = [[Urceopolis]]\n| population = 54,000,000\n}}";
  const page = `${infobox}\n\nText.`;

  it("emits the stored wikitext for an unedited template", () => {
    expect(roundTrip(page)).toBe(page);
  });

  it("rebuilds from the edited params: the changed value only, every other parameter as written", () => {
    const nodes = load(page);
    expect(nodes[0]!.type).toBe("infobox-block");
    const edited = { ...nodes[0]!, params: { ...nodes[0]!.params, capital: "Vilena" }, edited: true };
    expect(save([edited, nodes[1]!])).toBe(
      "{{Infobox country\n| name = Urcea\n| capital = Vilena\n| population = 54,000,000\n}}\n\nText."
    );
  });

  it("appends a new parameter in the style of the last", () => {
    const nodes = load(page);
    const edited = { ...nodes[0]!, params: { ...nodes[0]!.params, population: "55", "gdp nominal": "$1" }, edited: true };
    expect(save([edited])).toBe(
      "{{Infobox country\n| name = Urcea\n| capital = [[Urceopolis]]\n| population = 55\n| gdp nominal = $1\n}}"
    );
  });

  it("rebuilds from edited params, dropping a parameter that is gone and keeping the order of the rest", () => {
    const nodes = load(page);
    const params = { ...nodes[0]!.params };
    delete params["capital"];
    params["name"] = "Republic of Urcea";
    expect(save([{ ...nodes[0]!, params, edited: true }])).toBe(
      "{{Infobox country\n| name = Republic of Urcea\n| population = 54,000,000\n}}"
    );
  });

  it("keeps positional parameters and comments of the untouched ones", () => {
    const source = "{{Quote|A text <!-- note --> here|Someone |source = Book}}";
    const nodes = load(source);
    const edited = { ...nodes[0]!, params: { ...nodes[0]!.params, "2": "Somebody" }, edited: true };
    expect(save([edited])).toBe("{{Quote|A text <!-- note --> here|Somebody |source = Book}}");
  });

  it("does not touch a parser function or a template that was not flagged edited", () => {
    const fn = "{{#if: {{{x|}}} | yes | no }}";
    expect(roundTrip(fn)).toBe(fn);
    const nodes = load(infobox);
    expect(save([{ ...nodes[0]!, params: { ...nodes[0]!.params, capital: "Vilena" } }])).toBe(infobox);
  });
});

describe("no junk wikitext (review fix 6)", () => {
  it("saves no heading for an emptied heading", () => {
    const nodes = load("== Old ==\n\nText.");
    expect(save([{ ...nodes[0]!, children: [{ text: "" }] }, nodes[1]!])).toBe("Text.");
    expect(save([{ ...nodes[0]!, children: [{ text: "   " }] }])).toBe("");
  });

  it("joins the lines of text turned into a heading with a space", () => {
    expect(save([{ type: "h2", children: [{ text: "First line\nsecond line" }] }])).toBe("== First line second line ==");
    expect(save([{ type: "h3", children: [{ text: "a  \n  b\n\nc" }] }])).toBe("=== a b c ===");
  });

  it("writes no link at all for a link whose label was emptied: never [[Target]], never [[Target|]]", () => {
    const [p] = load("See [[Vilena|the city]] today.");
    const emptied = {
      ...p!,
      children: p!.children!.map((leaf) => (leaf.type === "link" ? { ...leaf, children: [{ text: "" }] } : leaf)),
    };
    expect(save([emptied])).toBe("See  today.");
    expect(save([emptied])).not.toContain("[[");
  });

  it("writes no external link for an emptied label either", () => {
    const [p] = load("Go [https://example.org the site] now.");
    const emptied = {
      ...p!,
      children: p!.children!.map((leaf) => (leaf.type === "link" ? { ...leaf, children: [{ text: "" }] } : leaf)),
    };
    expect(save([emptied])).toBe("Go  now.");
  });
});

describe("quote marks inside link labels are marks, not literal apostrophes (review fix 10)", () => {
  it("loads [[Foo|''x'' y]] with an italic leaf and no apostrophes", () => {
    const [p] = load("See [[Foo|''x'' y]] now.");
    const link = p!.children!.find((leaf) => leaf.type === "link")!;
    expect(link.children).toEqual([{ text: "x", italic: true }, { text: " y" }]);
    expect(JSON.stringify(link.children)).not.toContain("'");
  });

  it("round-trips untouched, and keeps the marks inside the label when the label is edited", () => {
    const source = "See [[Foo|''x'' y]] and [[Bar|'''b''' c]] and [http://a.example ''e''] now.";
    expect(roundTrip(source)).toBe(source);
    const out = save(edit(load(source), "x", "z"));
    expect(out).toBe("See [[Foo|''z'' y]] and [[Bar|'''b''' c]] and [http://a.example ''e''] now.");
  });

  it("puts the marks around a link on its label's leaves, where toggling them off can reach", () => {
    const source = "'''[[Foo|''x'']]''' end";
    expect(roundTrip(source)).toBe(source);
    const [p] = load(source);
    const link = p!.children!.find((leaf) => leaf.type === "link")!;
    expect(link.bold).toBeUndefined();
    expect(link.children).toEqual([{ text: "x", bold: true, italic: true }]);
    // edited, every leaf is bold and italic, so the marks are written around the link
    expect(save(edit([p!], "x", "y"))).toBe("'''''[[Foo|y]]''''' end");
  });

  it("does not read ticks in a link target or in a template inside a label", () => {
    const source = "[[Foo|{{bar|''x''}}]] and [[O'Brien]]";
    expect(roundTrip(source)).toBe(source);
  });
});

/**
 * wiki-ast-converter.test.ts — WikiAST ⇄ Wikitext & Plate Node Roundtrip Tests.
 */

import {
  wikitextToAst,
  astToWikitext,
  astToPlateNodes,
  plateNodesToAst,
} from "~/lib/wiki-os/transformers/wiki-ast-converter";

describe("WikiAST ⇄ Plate Nodes & Wikitext Roundtrip Converter", () => {
  it("converts wikitext to AST and then to Plate nodes without HTML intermediary", () => {
    const wikitext = `{{Infobox country
| name = Urcea
| capital = [[Urceopolis]]
| population = 54,000,000
}}

== History ==

The Kingdom of Urcea is located near [[Coords:40.5,-79.8|40.5 N, 79.8 W]].

* Point A
* Point B`;

    const ast = wikitextToAst(wikitext, "Urcea", "urcea");
    expect(ast.nodes).toHaveLength(4);

    const plateNodes = astToPlateNodes(ast);
    expect(plateNodes).toHaveLength(4);

    expect(plateNodes[0].type).toBe("infobox-block");
    expect(plateNodes[0].templateName).toBe("Infobox country");
    expect(plateNodes[0].params["name"]).toBe("Urcea");

    expect(plateNodes[1].type).toBe("h2");
    expect(plateNodes[2].type).toBe("p");
    expect(plateNodes[3].type).toBe("ul");

    // Convert Plate nodes back to AST
    const reconstructedAst = plateNodesToAst(plateNodes, "Urcea", "urcea");
    expect(reconstructedAst.nodes).toHaveLength(4);

    const roundtripWikitext = astToWikitext(reconstructedAst);
    expect(roundtripWikitext).toContain("{{Infobox country");
    expect(roundtripWikitext).toContain("Urcea");
    expect(roundtripWikitext).toContain("== History ==");
    expect(roundtripWikitext).toContain("* Point A");
  });

  it("converts inline templates to Plate chip nodes and roundtrips without losing structure", () => {
    const wikitext = "Urcea ({{lang-la|Urceum}}) is a sovereign nation in the world.";

    const ast = wikitextToAst(wikitext, "Urcea", "urcea");
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0].type).toBe("paragraph");

    const plateNodes = astToPlateNodes(ast);
    expect(plateNodes).toHaveLength(1);
    expect(plateNodes[0].type).toBe("p");

    const leaves = plateNodes[0].children;
    const templateChip = leaves.find((l: any) => l.type === "chip-template");
    expect(templateChip).toBeDefined();
    expect(templateChip.templateName).toBe("lang-la");

    const reconstructedAst = plateNodesToAst(plateNodes, "Urcea", "urcea");
    expect(reconstructedAst.nodes).toHaveLength(1);

    const roundtripWikitext = astToWikitext(reconstructedAst);
    expect(roundtripWikitext.trim()).toBe(wikitext);
  });

  it("converts wikitables to Plate table nodes and roundtrips without losing links or columns", () => {
    const wikitext = `{| class="wikitable"
|-
! Country !! Capital !! Population
|-
| [[Urcea]] || [[Urceopolis]] || 54,000,000
|}`;

    const ast = wikitextToAst(wikitext, "TableTest");
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0].type).toBe("table");

    const plateNodes = astToPlateNodes(ast);
    expect(plateNodes).toHaveLength(1);
    expect(plateNodes[0].type).toBe("table");
    expect(plateNodes[0].children).toHaveLength(2); // 2 rows

    // Header row
    expect(plateNodes[0].children[0].type).toBe("tr");
    expect(plateNodes[0].children[0].children[0].type).toBe("th");

    // Data row with link
    const dataRow = plateNodes[0].children[1];
    expect(dataRow.children[0].type).toBe("td");
    const cellChildren = dataRow.children[0].children;
    const linkChild = cellChildren.find((c: any) => c.type === "link" || c.type === "a");
    expect(linkChild).toBeDefined();
    expect(linkChild.target).toBe("Urcea");

    // Convert Plate table back to AST
    const reconstructedAst = plateNodesToAst(plateNodes);
    expect(reconstructedAst.nodes).toHaveLength(1);
    expect(reconstructedAst.nodes[0].type).toBe("table");

    const roundtrip = astToWikitext(reconstructedAst);
    expect(roundtrip).toContain("Urcea");
    expect(roundtrip).toContain("Urceopolis");
    expect(roundtrip).toContain("54,000,000");
  });

  it("converts headings, blockquotes, and lists faithfully between AST and Plate nodes", () => {
    const wikitext = `== Section Heading ==
=== Subsection Heading ===
==== Sub-subsection Heading ====

<blockquote>A famous quotation from historical annals.</blockquote>

* Bullet 1
* Bullet 2

# Step 1
# Step 2`;

    const ast = wikitextToAst(wikitext, "HeadingsAndListsTest");
    const plateNodes = astToPlateNodes(ast);

    expect(plateNodes.some((n: any) => n.type === "h2")).toBe(true);
    expect(plateNodes.some((n: any) => n.type === "h3")).toBe(true);
    expect(plateNodes.some((n: any) => n.type === "h4")).toBe(true);
    expect(plateNodes.some((n: any) => n.type === "blockquote")).toBe(true);
    expect(plateNodes.some((n: any) => n.type === "ul")).toBe(true);
    expect(plateNodes.some((n: any) => n.type === "ol")).toBe(true);

    const reconstructedAst = plateNodesToAst(plateNodes);
    const roundtrip = astToWikitext(reconstructedAst);

    expect(roundtrip).toContain("== Section Heading ==");
    expect(roundtrip).toContain("=== Subsection Heading ===");
    expect(roundtrip).toContain("==== Sub-subsection Heading ====");
    expect(roundtrip).toContain("<blockquote>A famous quotation");
    expect(roundtrip).toContain("* Bullet 1");
    expect(roundtrip).toContain("# Step 1");
  });

  it("preserves multiline table cells and cell attributes across parse and Plate conversion", () => {
    const wikitext = `{| class="wikitable" style="width: 100%;"
|-
! Name !! Description
|-
| colspan="2" | Merged summary header
|-
| Item 1
| Multiline details
continued on second line.
|}`;

    const ast = wikitextToAst(wikitext, "MultilineTableTest");
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0].type).toBe("table");

    const plateNodes = astToPlateNodes(ast);
    expect(plateNodes).toHaveLength(1);
    const tableNode = plateNodes[0];
    expect(tableNode.children).toHaveLength(3); // 3 rows

    // Row 2: colspan="2"
    const row2Cell = tableNode.children[1].children[0];
    expect(row2Cell.attributes).toContain('colspan="2"');

    // Row 3: cell 2 has multiline text
    const row3Cell2 = tableNode.children[2].children[1];
    const cellText = row3Cell2.children.map((c: any) => c.text || "").join("");
    expect(cellText).toContain("Multiline details");
    expect(cellText).toContain("continued on second line.");

    // Roundtrip back to AST
    const reconstructed = plateNodesToAst(plateNodes);
    const roundtrip = astToWikitext(reconstructed);
    expect(roundtrip).toContain("Merged summary header");
    expect(roundtrip).toContain("Multiline details");
    expect(roundtrip).toContain("continued on second line.");
  });

  it("handles nested lists (**, ***) preserving indentation levels across AST and Plate", () => {
    const wikitext = `* Top level item 1
** Nested sub-bullet 1.1
*** Deep nested bullet 1.1.1
* Top level item 2`;

    const ast = wikitextToAst(wikitext, "NestedListTest");
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0].type).toBe("list");

    const listNode = ast.nodes[0] as any;
    expect(listNode.children[0].level).toBe(1);
    expect(listNode.children[1].level).toBe(2);
    expect(listNode.children[2].level).toBe(3);
    expect(listNode.children[3].level).toBe(1);

    const plateNodes = astToPlateNodes(ast);
    const ul = plateNodes[0] as any;
    expect(ul.children[1].level).toBe(2);
    expect(ul.children[2].level).toBe(3);

    const reconstructed = plateNodesToAst(plateNodes);
    const roundtrip = astToWikitext(reconstructed);
    expect(roundtrip).toContain("* Top level item 1");
    expect(roundtrip).toContain("** Nested sub-bullet 1.1");
    expect(roundtrip).toContain("*** Deep nested bullet 1.1.1");
    expect(roundtrip).toContain("* Top level item 2");
  });

  it("preserves row attributes and captions on wikitables", () => {
    const wikitext = `{| class="wikitable"
|+ Table Title
|- style="background: yellow;"
! Header 1 !! Header 2
|- class="highlight"
| Val 1 || Val 2
|}`;

    const ast = wikitextToAst(wikitext, "RowAttrsTest");
    expect(ast.nodes).toHaveLength(1);
    const table = ast.nodes[0] as any;
    expect(table.caption).toBe("Table Title");
    expect(table.children[0].attributes).toContain("background: yellow;");
    expect(table.children[1].attributes).toContain("class=\"highlight\"");

    const plateNodes = astToPlateNodes(ast);
    const plateTable = plateNodes[0] as any;
    expect(plateTable.children[0].attributes).toContain("background: yellow;");

    const reconstructed = plateNodesToAst(plateNodes);
    const roundtrip = astToWikitext(reconstructed);
    expect(roundtrip).toContain("Table Title");
    expect(roundtrip).toContain("Val 1");
    expect(roundtrip).toContain("Val 2");
  });

  it("cleanly separates mixed bullet and numbered lists without blank lines", () => {
    const wikitext = `* Bullet 1
* Bullet 2
# Number 1
# Number 2`;

    const ast = wikitextToAst(wikitext, "MixedListTest");
    expect(ast.nodes).toHaveLength(2);
    expect((ast.nodes[0] as any).ordered).toBe(false);
    expect((ast.nodes[1] as any).ordered).toBe(true);

    const plateNodes = astToPlateNodes(ast);
    expect(plateNodes[0].type).toBe("ul");
    expect(plateNodes[1].type).toBe("ol");
  });

  it("handles lists containing links, bold, and typed text leaves without dropping content", () => {
    const wikitext = `* Item with [[Urcea]] and '''bold item'''
* Second item with [https://example.com Link]`;

    const ast = wikitextToAst(wikitext, "ListWithLinksTest");
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0].type).toBe("list");

    const plateNodes = astToPlateNodes(ast);
    expect(plateNodes).toHaveLength(1);
    expect(plateNodes[0].type).toBe("ul");
    const li1 = plateNodes[0].children[0];
    expect(li1.children.some((c: any) => c.type === "link" && c.target === "Urcea")).toBe(true);

    const reconstructed = plateNodesToAst(plateNodes);
    const roundtrip = astToWikitext(reconstructed);
    expect(roundtrip).toContain("[[Urcea]]");
    expect(roundtrip).toContain("'''bold item'''");
    expect(roundtrip).toContain("[https://example.com Link]");
  });

  it("preserves typed text leaves ({ type: 'text' }) during Plate conversion", () => {
    const doc = {
      nodes: [
        {
          type: "list",
          ordered: false,
          children: [
            {
              type: "list-item",
              level: 1,
              prefix: "*",
              children: [
                { type: "text", text: "Typed bullet item" },
                { text: " normal bullet" },
              ],
            },
          ],
        },
      ],
    };

    const plateNodes = astToPlateNodes(doc as any);
    expect(plateNodes).toHaveLength(1);
    const li = plateNodes[0].children[0];
    const combined = li.children.map((c: any) => c.text || "").join("");
    expect(combined).toContain("Typed bullet item normal bullet");
  });
});


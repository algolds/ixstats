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
});

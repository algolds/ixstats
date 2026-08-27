/**
 * wikitext-parser.test.ts — Unit and Delimiter-Interaction Test Suite.
 */

import { parse } from "~/lib/wiki-os/wikitext/parser";
import { astToWikitext, serializeTemplateToWikitext } from "~/lib/wiki-os/wikitext/serializer";
import { scanTemplates } from "~/lib/wiki-os/wikitext/template-parser";
import { splitBalancedPipes } from "~/lib/wiki-os/wikitext/parameter-parser";
import { classifyTemplate } from "~/lib/wiki-os/wikitext/resolver";

describe("WikiOS Native Wikitext Parser & Engine", () => {
  describe("1. Template & Parameter Parsing", () => {
    it("parses single-line and multiline templates with named and positional parameters", () => {
      const input = `{{Infobox country
| name = Urcea
| capital = [[Urceopolis]]
| population = 54,000,000
| motto = "Concordia et Fidelitas"
}}`;

      const { ast, diagnostics } = parse(input);
      expect(diagnostics).toHaveLength(0);
      expect(ast.nodes).toHaveLength(1);

      const node = ast.nodes[0] as any;
      expect(node.type).toBe("infobox");
      expect(node.templateName).toBe("Infobox country");
      expect(node.params["name"]).toBe("Urcea");
      expect(node.params["capital"]).toBe("[[Urceopolis]]");
      expect(node.params["population"]).toBe("54,000,000");
    });

    it("parses custom / unknown templates as classification: 'custom'", () => {
      const input = `{{SomeCustomThing | foo = bar | 123 }}`;
      const { ast } = parse(input);
      expect(ast.nodes).toHaveLength(1);

      const node = ast.nodes[0] as any;
      expect(node.type).toBe("template");
      expect(node.templateName).toBe("SomeCustomThing");
      expect(node.classification).toBe("custom");
      expect(node.params["foo"]).toBe("bar");
      expect(node.params["1"]).toBe("123");
    });

    it("correctly classifies engine data chips and coord chips", () => {
      expect(classifyTemplate("CountryData:Urcea")).toBe("chip-engine");
      expect(classifyTemplate("BusinessData:Corp")).toBe("chip-engine");
      expect(classifyTemplate("Coord")).toBe("chip-coord");
      expect(classifyTemplate("Infobox country")).toBe("infobox");
      expect(classifyTemplate("Quote")).toBe("standard");
      expect(classifyTemplate("CustomWidget")).toBe("custom");
    });
  });

  describe("2. Delimiter Interactions (Nested Templates, Links, & Equals)", () => {
    it("handles nested templates: {{A|foo={{B|x=[[Foo|Bar]]}}|bar=x=y}}", () => {
      const input = `{{A|foo={{B|x=[[Foo|Bar]]}}|bar=x=y}}`;
      const { ast, diagnostics } = parse(input);
      expect(diagnostics).toHaveLength(0);

      const node = ast.nodes[0] as any;
      expect(node.templateName).toBe("A");
      expect(node.params["foo"]).toBe("{{B|x=[[Foo|Bar]]}}");
      expect(node.params["bar"]).toBe("x=y");
    });

    it("handles nested links with inner templates: {{A|foo=[[Foo|{{B|x=y}}]]}}", () => {
      const input = `{{A|foo=[[Foo|{{B|x=y}}]]}}`;
      const { ast } = parse(input);
      const node = ast.nodes[0] as any;
      expect(node.params["foo"]).toBe("[[Foo|{{B|x=y}}]]");
    });

    it("handles equals signs in parameter values without misinterpreting keys", () => {
      const input = `{{Query|query=SELECT * FROM table WHERE a = 1 AND b = 2}}`;
      const { ast } = parse(input);
      const node = ast.nodes[0] as any;
      expect(node.params["query"]).toBe("SELECT * FROM table WHERE a = 1 AND b = 2");
    });

    it("splits balanced pipes respecting comments", () => {
      const parts = splitBalancedPipes(`param1|param2=<!-- comment with | inside -->val|param3`);
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe("param1");
      expect(parts[1]).toBe("param2=<!-- comment with | inside -->val");
      expect(parts[2]).toBe("param3");
    });
  });

  describe("3. Parser Functions (Structure Only, No Lua/Evaluation)", () => {
    it("parses {{#if: condition | then | else }}", () => {
      const input = `{{#if: {{{capital|}}} | Capital: {{{capital}}} | No capital provided }}`;
      const { ast } = parse(input);
      expect(ast.nodes).toHaveLength(1);

      const node = ast.nodes[0] as any;
      expect(node.type).toBe("parser-function");
      expect(node.functionName).toBe("#if");
      expect(node.expression).toBe("{{{capital|}}}");
      expect(node.branches).toHaveLength(2);
      expect(node.branches[0].trim()).toBe("Capital: {{{capital}}}");
      expect(node.branches[1].trim()).toBe("No capital provided");
    });

    it("parses magic words like {{formatnum: 1234567}}", () => {
      const input = `{{formatnum: 1234567}}`;
      const { ast } = parse(input);
      const node = ast.nodes[0] as any;
      expect(node.type).toBe("parser-function");
      expect(node.functionName).toBe("formatnum");
      expect(node.expression).toBe("1234567");
    });
  });

  describe("4. Tolerant Parsing & Malformed Input Handling (Invariants 5 & 6)", () => {
    it("handles unclosed {{Infobox without crashing and reports warning diagnostic", () => {
      const input = `{{Infobox country\n| name = Urcea\n| capital =`;
      const { ast, diagnostics } = parse(input);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.code).toBe("UNCLOSED_TEMPLATE");
      expect(ast.nodes).toHaveLength(1);

      const node = ast.nodes[0] as any;
      expect(node.type).toBe("infobox");
      expect(node.parseState).toBe("incomplete");
      expect(node.params["name"]).toBe("Urcea");
    });

    it("handles unclosed [[Foo without dropping surrounding text", () => {
      const input = `This is before [[UnclosedLink and this is after.`;
      const { ast } = parse(input);
      expect(ast.nodes).toHaveLength(1);
      expect(ast.nodes[0]?.type).toBe("paragraph");
    });
  });

  describe("5. Structural Nodes: Headings, Tables, Lists, & Inlines", () => {
    it("parses headings of levels 1 through 6", () => {
      const input = `== Level 2 Heading ==\n\n=== Level 3 Heading ===\n\n==== Level 4 Heading ====`;
      const { ast } = parse(input);
      expect(ast.nodes).toHaveLength(3);
      expect(ast.nodes[0]?.type).toBe("heading");
      expect((ast.nodes[0] as any).level).toBe(2);
      expect((ast.nodes[1] as any).level).toBe(3);
      expect((ast.nodes[2] as any).level).toBe(4);
    });

    it("parses wikitables into row and cell nodes", () => {
      const input = `{| class="wikitable"
|+ Country Data
|-
! Name !! Population
|-
| Urcea || 54M
|}`;
      const { ast } = parse(input);
      expect(ast.nodes).toHaveLength(1);
      const table = ast.nodes[0] as any;
      expect(table.type).toBe("table");
      expect(table.caption).toBe("Country Data");
      expect(table.children).toHaveLength(2); // 2 rows
      expect(table.children[0].children[0].isHeader).toBe(true);
      expect(table.children[1].children[0].isHeader).toBe(false);
    });

    it("parses unordered and ordered lists", () => {
      const input = `* First bullet\n* Second bullet\n* Third bullet`;
      const { ast } = parse(input);
      expect(ast.nodes).toHaveLength(1);
      const list = ast.nodes[0] as any;
      expect(list.type).toBe("list");
      expect(list.ordered).toBe(false);
      expect(list.children).toHaveLength(3);
    });

    it("parses inline chips and wiki links", () => {
      const input = `Here is [[Urcea|The Kingdom of Urcea]] and [[Coords:40.5,-79.8|Capital Coords]] and [[CountryData:urcea|gdp]].`;
      const { ast } = parse(input);
      expect(ast.nodes).toHaveLength(1);
      const p = ast.nodes[0] as any;
      expect(p.type).toBe("paragraph");

      const link = p.children.find((c: any) => c.type === "wiki-link");
      expect(link).toBeDefined();
      expect(link.target).toBe("Urcea");
      expect(link.label).toBe("The Kingdom of Urcea");

      const coord = p.children.find((c: any) => c.type === "chip-coord");
      expect(coord).toBeDefined();
      expect(coord.lat).toBe(40.5);
      expect(coord.lng).toBe(-79.8);

      const engine = p.children.find((c: any) => c.type === "chip-engine-data");
      expect(engine).toBeDefined();
      expect(engine.connector).toBe("CountryData");
      expect(engine.slug).toBe("urcea");
      expect(engine.metric).toBe("gdp");
    });
  });

  describe("6. Roundtrip Serialization (astToWikitext)", () => {
    it("roundtrips complex articles with zero parameter loss", () => {
      const original = `{{Infobox country
| name = Urcea
| capital = [[Urceopolis]]
| population = 54,000,000
}}

== Overview ==

Urcea is an ancient nation located at [[Coords:40.5,-79.8|40.5 N, 79.8 W]].

* Item 1
* Item 2

{| class="wikitable"
|-
! Header 1
|-
| Data 1
|}`;

      const { ast } = parse(original);
      const serialized = astToWikitext(ast);

      const { ast: reAst } = parse(serialized);
      expect(reAst.nodes).toHaveLength(ast.nodes.length);

      const origInfobox = ast.nodes[0] as any;
      const reInfobox = reAst.nodes[0] as any;
      expect(reInfobox.params["name"]).toBe(origInfobox.params["name"]);
      expect(reInfobox.params["capital"]).toBe(origInfobox.params["capital"]);
      expect(reInfobox.params["population"]).toBe(origInfobox.params["population"]);
    });
  });
});

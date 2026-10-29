/** @jest-environment jsdom */
/**
 * The wikitext parser on hostile and real text: nested templates and links, equals in values, unclosed templates and
 * links kept, source ranges that rebuild the input exactly (redirects, nowiki/pre/comments, unclosed tags, tables), and
 * the template form's parameter parser keeping pipes inside nested links and templates.
 */

import { parse } from "~/lib/wiki-os/wikitext/parser";
import { astToWikitext } from "~/lib/wiki-os/wikitext/serializer";
import { parseMediaLink } from "~/lib/wiki-os/wikitext/link-parser";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { WikiRawNode } from "~/lib/wiki-os/wikitext/types";
import { parseTemplateWikitext } from "~/lib/wiki-os/editor/parse-template-wikitext";

describe("WikiOS Native Wikitext Parser & Engine", () => {
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

  describe("7. Media Link Bracket Balancing & Nested Links", () => {
    it("parses media link with nested wikilink caption correctly", () => {
      const raw = "[[File:Urcea_Arms.svg|thumb|Coat of arms of the [[Kingdom of Urcea|Crown of Urcea]]|250px]]";
      const media = parseMediaLink(raw);
      expect(media).not.toBeNull();
      expect(media?.filename).toBe("Urcea_Arms.svg");
      expect(media?.align).toBe("thumb");
      expect(media?.width).toBe(250);
      expect(media?.caption).toBe("Coat of arms of the [[Kingdom of Urcea|Crown of Urcea]]");
    });
  });

  describe("8. Inline vs Block Template Parsing", () => {
    it("keeps inline templates inside running text without fragmenting paragraphs", () => {
      const input = "Urcea ({{lang-la|Urceum}}) is a sovereign nation in the world.";
      const { ast } = parse(input);

      // Must NOT be split into 3 blocks (p, template, p). Must be 1 paragraph!
      expect(ast.nodes).toHaveLength(1);
      const p = ast.nodes[0] as any;
      expect(p.type).toBe("paragraph");

      // Children: "Urcea (", inline-template, ") is a sovereign nation in the world."
      expect(p.children).toHaveLength(3);
      expect(p.children[0].text).toBe("Urcea (");
      expect(p.children[1].type).toBe("inline-template");
      expect(p.children[1].templateName).toBe("lang-la");
      expect(p.children[1].params["1"]).toBe("Urceum");
      expect(p.children[2].text).toBe(") is a sovereign nation in the world.");

      // Serialization roundtrips cleanly without unwanted newlines
      const serialized = astToWikitext(ast);
      expect(serialized.trim()).toBe(input);
    });
  });
});

describe("source ranges", () => {
  const FIXTURE_DIR = join(__dirname, "../../fixtures/wikitext");
  const fixtures = readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith(".wiki"))
    .sort();

  function rebuild(input: string): string {
    const { ast } = parse(input);
    return ast.nodes.map((node) => `${node.sepBefore}${node.raw}`).join("") + (ast.trailing ?? "");
  }

  const types = (input: string): string[] => parse(input).ast.nodes.map((node) => node.type);
  const rawNodes = (input: string): WikiRawNode[] =>
    parse(input).ast.nodes.filter((node): node is WikiRawNode => node.type === "raw");

  describe("parser block source ranges", () => {
    it.each(fixtures)("%s: separators and raw slices rebuild the input", (name) => {
      const input = readFileSync(join(FIXTURE_DIR, name), "utf8");
      const { ast } = parse(input);

      let cursor = 0;
      for (const node of ast.nodes) {
        const { src } = node;
        expect(src).toBeDefined();
        expect(src!.start).toBeGreaterThanOrEqual(cursor);
        expect(node.raw).toBe(input.slice(src!.start, src!.end));
        expect(node.sepBefore).toBe(input.slice(cursor, src!.start));
        // A block starts at its text, except preformatted lines, whose indent is part of them.
        const indented = node.type === "raw" && node.construct === "preformatted";
        expect(indented ? node.raw!.trimEnd() : node.raw!.trim()).toBe(node.raw);
        cursor = src!.end;
      }
      expect(ast.trailing).toBe(input.slice(cursor));
      expect(rebuild(input)).toBe(input);
    });
  });

  describe("blocks the visual editor cannot hold become atomic raw blocks", () => {
    it("keeps #REDIRECT a redirect, never a numbered list", () => {
      const [node] = rawNodes("#REDIRECT [[Foo]]\n");
      expect(node?.construct).toBe("redirect");
      expect(types("#redirect [[Foo#Bar]] {{R to section}}")).toEqual(["raw"]);
      // Only at the start of the page: elsewhere it is an ordinary numbered item.
      expect(types("Intro\n\n#REDIRECT [[Foo]]")).toEqual(["paragraph", "list"]);
    });

    it("does not parse {{ inside <pre>, <nowiki> or a comment as a template", () => {
      const pre = "<pre>\n{{Infobox country\n| name = X\n}}\n</pre>";
      expect(types(pre)).toEqual(["raw"]);
      expect(rawNodes(pre)[0]?.tag).toBe("pre");

      expect(types("<nowiki>\n{{Not a template}}\n</nowiki>")).toEqual(["raw"]);
      expect(types("<!--\n{{Not a template}}\n\nstill the comment\n-->")).toEqual(["raw"]);

      const inline = parse("Use <nowiki>{{Infobox country}}</nowiki> here.").ast.nodes;
      expect(inline).toHaveLength(1);
      expect(inline[0]!.type).toBe("paragraph");
    });
    it("does not end a table at |} inside a multi-line template", () => {
      const input = "{| class=\"wikitable\"\n|-\n| {{cite\n|a=b\n|}}\n|-\n| next\n|}\n\nAfter";
      expect(types(input)).toEqual(["table", "paragraph"]);
    });

    it("keeps an unclosed tag, comment or table atomic and reports it", () => {
      for (const [input, code] of [
        ["<pre>\nnever closed", "UNCLOSED_TAG"],
        ["<!-- never closed\ntext", "UNCLOSED_COMMENT"],
        ["{| class=\"wikitable\"\n| a", "UNCLOSED_TABLE"],
      ] as const) {
        const { ast, diagnostics } = parse(input);
        expect(ast.nodes).toHaveLength(1);
        expect((ast.nodes[0] as WikiRawNode).reason).toBe("malformed");
        expect(diagnostics.map((d) => d.code)).toContain(code);
      }
    });
  });

  describe("blocks split the way MediaWiki reads them", () => {
    it("keeps a multi-line template with a blank line inside in one block", () => {
      expect(types("{{Cite book\n| last = Holst\n\n| title = X\n}}\n\nText")).toEqual([
        "template",
        "paragraph",
      ]);
    });
    it("keeps an infobox a block when text follows it on its line; the text is the next block", () => {
      const input = "{{Infobox company\n| name = X\n}}'''X''' is a company.\n\nNext.";
      const { ast } = parse(input);
      expect(ast.nodes.map((n) => n.type)).toEqual(["infobox", "paragraph", "paragraph"]);
      expect(ast.nodes[1]!.sepBefore).toBe("");
      expect(ast.nodes[1]!.raw).toBe("'''X''' is a company.");
      expect(rebuild(input)).toBe(input);
    });
  });
});

describe("the template form's parameters", () => {
  describe("parseTemplateWikitext", () => {
    it("preserves pipes inside values (splits on first = only)", () => {
      expect(parseTemplateWikitext("{{Infobox|motto=Liberté, Ordre, Concorde}}")).toEqual({
        name: "Infobox",
        params: { motto: "Liberté, Ordre, Concorde" },
      });
    });

    it("handles nested links with pipes inside parameters without corruption", () => {
      expect(
        parseTemplateWikitext("{{Infobox country|capital=[[Vilena|Vilena City]]|leader=John}}")
      ).toEqual({
        name: "Infobox country",
        params: {
          capital: "[[Vilena|Vilena City]]",
          leader: "John",
        },
      });
    });

    it("handles nested templates with pipes inside parameters without corruption", () => {
      expect(
        parseTemplateWikitext("{{Infobox country|name=Urcea|flag={{flag|Urcea|civil}}|motto=Truth}}")
      ).toEqual({
        name: "Infobox country",
        params: {
          name: "Urcea",
          flag: "{{flag|Urcea|civil}}",
          motto: "Truth",
        },
      });
    });
  });
});

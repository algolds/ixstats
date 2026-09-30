/**
 * wikitext-source-ranges.test.ts — the parser records where every top-level block came from
 * (plan 414, step 2): `sepBefore + raw` over all blocks, plus `trailing`, rebuilds the input.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "~/lib/wiki-os/wikitext/parser";
import type { WikiBlockNode, WikiRawNode } from "~/lib/wiki-os/wikitext/types";

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
      expect(node.raw!.trim()).toBe(node.raw);
      cursor = src!.end;
    }
    expect(ast.trailing).toBe(input.slice(cursor));
    expect(rebuild(input)).toBe(input);
  });

  it("separates consecutive blocks by at least one line break", () => {
    const input = readFileSync(join(FIXTURE_DIR, "infobox-country.wiki"), "utf8");
    const { ast } = parse(input);
    for (const node of ast.nodes.slice(1)) expect(node.sepBefore).toContain("\n");
  });

  it("keeps leading blank lines in the first separator and the trailing whitespace apart", () => {
    const { ast } = parse("\n\n  \n{{Stub}}\n\n\nBody\n\n");
    expect(ast.nodes[0]!.sepBefore).toBe("\n\n  \n");
    expect(ast.nodes[1]!.sepBefore).toBe("\n\n\n");
    expect(ast.trailing).toBe("\n\n");
  });

  it("keeps a whitespace-only page as trailing text", () => {
    const { ast } = parse(" \n\n");
    expect(ast.nodes).toHaveLength(0);
    expect(ast.trailing).toBe(" \n\n");
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

  it("makes top-level comments and magic words raw blocks and keeps a blank line inside a comment", () => {
    const input = "<!-- a -->\n<!--\nb\n\nc\n-->\n__NOTOC__\n__TOC__ __NOEDITSECTION__\nText";
    const { ast } = parse(input);
    expect(ast.nodes.map((n) => (n as WikiRawNode).construct ?? n.type)).toEqual([
      "comment",
      "comment",
      "magic-word",
      "magic-word",
      "paragraph",
    ]);
  });

  it("keeps <gallery>, <math>, <poem>, <syntaxhighlight> and <references> with content atomic", () => {
    for (const tag of ["gallery", "math", "poem", "syntaxhighlight", "references"]) {
      const nodes = rawNodes(`<${tag}>\nsome {{x}} content\n</${tag}>`);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]!.tag).toBe(tag);
    }
    // A self-closing <references /> is ordinary text.
    expect(types("<references />")).toEqual(["paragraph"]);
  });

  it("keeps nested tables and tables with a template on its own line atomic", () => {
    const nested = "{| class=\"wikitable\"\n|-\n| a\n| {|\n  |-\n  | b\n  |}\n|}";
    expect(rawNodes(nested)[0]?.construct).toBe("nested-table");

    const templated = "{| class=\"wikitable\"\n! A\n{{Row|1|2}}\n|-\n| x\n|}";
    expect(rawNodes(templated)[0]?.construct).toBe("table-template");

    const orphan = "{| class=\"wikitable\"\nstray text\n|-\n| x\n|}";
    expect(rawNodes(orphan)[0]?.construct).toBe("table-orphan-line");

    const plain = "{| class=\"wikitable\"\n|-\n! A\n|-\n| 1\n|}";
    expect(types(plain)).toEqual(["table"]);
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

  it("still treats an unclosed template as an incomplete template block", () => {
    const { ast, diagnostics } = parse("{{Infobox country\n| name = Urcea\n| capital =");
    expect(ast.nodes[0]!.type).toBe("infobox");
    expect(diagnostics[0]?.code).toBe("UNCLOSED_TEMPLATE");
    const node = ast.nodes[0] as WikiBlockNode & { parseState?: string };
    expect(node.parseState).toBe("incomplete");
  });
});

describe("blocks split the way MediaWiki reads them", () => {
  it("keeps a multi-line template with a blank line inside in one block", () => {
    expect(types("{{Cite book\n| last = Holst\n\n| title = X\n}}\n\nText")).toEqual([
      "template",
      "paragraph",
    ]);
  });

  it("keeps a reference with a blank line inside in its paragraph", () => {
    expect(types("Claim.<ref>One\n\nTwo</ref> More.\n\nNext")).toEqual(["paragraph", "paragraph"]);
  });

  it("keeps a multi-line list item template inside its list", () => {
    const { ast } = parse("* {{flag|X\n|y}} one\n* two");
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]!.type).toBe("list");
  });

  it("starts a heading that has no space after the marks", () => {
    expect(types("Text\n==Heading==\nMore")).toEqual(["paragraph", "heading", "paragraph"]);
  });

  it("keeps a template on its own line between text lines as its own block", () => {
    expect(types("one\n{{Citation needed}}\ntwo")).toEqual(["paragraph", "template", "paragraph"]);
  });

  it("treats a template followed by text on its line as part of a paragraph", () => {
    expect(types("{{flag|X}} Vilena is a city.")).toEqual(["paragraph"]);
  });
});

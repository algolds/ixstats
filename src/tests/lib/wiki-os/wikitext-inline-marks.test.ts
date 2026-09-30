/**
 * wikitext-inline-marks.test.ts — bold/italic quote runs over a whole inline sequence, inline
 * constructs that must stay literal, and [[File:]] parameters (plan 414, inline fixes).
 */

import { parseInlineLinksAndFormatting } from "~/lib/wiki-os/wikitext/link-parser";
import { parse } from "~/lib/wiki-os/wikitext/parser";
import { astToWikitext } from "~/lib/wiki-os/wikitext/serializer";
import type { WikiInlineNode } from "~/lib/wiki-os/wikitext/types";

/** Compact view of an inline sequence: `b` bold, `i` italic, `[[…]]` for a link, `{…}` otherwise. */
function show(nodes: WikiInlineNode[]): string[] {
  return nodes.map((node) => {
    const marks = `${"bold" in node && node.bold ? "b" : ""}${"italic" in node && node.italic ? "i" : ""}`;
    const body =
      "type" in node
        ? node.type === "wiki-link"
          ? `[[${node.target}]]`
          : `{${node.type}}`
        : JSON.stringify(node.text);
    return marks ? `${marks}:${body}` : body;
  });
}

describe("quote marks over an inline sequence", () => {
  it("spans a link: '''[[Foo]] bar'''", () => {
    expect(show(parseInlineLinksAndFormatting("'''[[Foo]] bar''' baz"))).toEqual([
      "b:[[Foo]]",
      'b:" bar"',
      '" baz"',
    ]);
  });

  it("starts before a link and ends after it: '''The [[Foo]] Treaty'''", () => {
    expect(show(parseInlineLinksAndFormatting("'''The [[Foo]] Treaty''' was"))).toEqual([
      'b:"The "',
      "b:[[Foo]]",
      'b:" Treaty"',
      '" was"',
    ]);
  });

  it("toggles italic and bold independently and handles five quotes", () => {
    expect(show(parseInlineLinksAndFormatting("''a'''b'''c'' '''''d'''''"))).toEqual([
      'i:"a"',
      'bi:"b"',
      'i:"c"',
      '" "',
      'bi:"d"',
    ]);
    expect(show(parseInlineLinksAndFormatting("'''''x''' y''"))).toEqual(['bi:"x"', 'i:" y"']);
  });

  it("reads four quotes as an apostrophe and bold, and six as apostrophe(s) and both", () => {
    expect(show(parseInlineLinksAndFormatting("rock''''n'''"))).toEqual(["\"rock'\"", 'b:"n"']);
    expect(show(parseInlineLinksAndFormatting("a''''''b''''''"))).toEqual(["\"a'\"", "bi:\"b'\""]);
  });

  it("ends every mark at a line break", () => {
    expect(show(parseInlineLinksAndFormatting("'''bold\nplain"))).toEqual(['b:"bold"', '"\\nplain"']);
  });

  it("puts the marks on chips, templates and references too", () => {
    const nodes = parseInlineLinksAndFormatting("''see {{flag|X}}<ref>r</ref> [[A]]'' end");
    expect(show(nodes)).toEqual([
      'i:"see "',
      "i:{inline-template}",
      "i:{citation-ref}",
      'i:" "',
      "i:[[A]]",
      '" end"',
    ]);
  });

  it("does not read quote marks inside comments, <nowiki> or links", () => {
    expect(show(parseInlineLinksAndFormatting("a <!-- '' --> b <nowiki>'''x'''</nowiki> c"))).toEqual([
      '"a <!-- \'\' --> b <nowiki>\'\'\'x\'\'\'</nowiki> c"',
    ]);
    expect(show(parseInlineLinksAndFormatting("[[Foo|''x'']] y"))).toEqual(["[[Foo]]", '" y"']);
  });

  it("does not read {{ or [[ inside <nowiki> or a comment as markup", () => {
    const nodes = parseInlineLinksAndFormatting("x <nowiki>{{Infobox}}[[Foo]]</nowiki> <!-- {{y}} --> z");
    expect(nodes.every((node) => !("type" in node))).toBe(true);
  });
});

describe("<ref> parsing", () => {
  it("keeps a reference whose content holds a self-closing tag in one node", () => {
    const nodes = parseInlineLinksAndFormatting('A<ref name=a>See <br/> this</ref> B<ref name="b" />');
    expect(nodes.filter((node) => "type" in node && node.type === "citation-ref")).toHaveLength(2);
    const [, first, , second] = nodes;
    expect(first).toMatchObject({ name: "a", rawWikitext: "<ref name=a>See <br/> this</ref>" });
    expect(second).toMatchObject({ name: "b", rawWikitext: '<ref name="b" />' });
  });

  it("leaves an unclosed <ref> as text", () => {
    const nodes = parseInlineLinksAndFormatting("A <ref>never closed");
    expect(nodes.every((node) => !("type" in node))).toBe(true);
  });
});

describe("the AST serializer writes marks across a run and the new inline nodes", () => {
  const roundTrip = (input: string): string => astToWikitext(parse(input).ast);

  it("round-trips bold and italic runs that span links", () => {
    expect(roundTrip("'''[[Foo]] bar''' and ''[[Ostrava]]'' meet '''''both''''' today.")).toBe(
      "'''[[Foo]] bar''' and ''[[Ostrava]]'' meet '''''both''''' today."
    );
  });

  it("does not write two adjacent bold chunks as six quotes", () => {
    const { ast } = parse("'''a'''");
    const p = ast.nodes[0] as { children: WikiInlineNode[] };
    const split = { ...ast, nodes: [{ ...p, type: "paragraph" as const, children: [{ text: "a", bold: true }, { text: "b", bold: true }] }] };
    expect(astToWikitext(split)).toBe("'''ab'''");
  });

  it("writes a file with all its parameters", () => {
    const input = "[[File:x.png|thumb|upright=1.2|left|alt=A|link=B|Caption with [[link]]]]";
    expect(roundTrip(input)).toBe(input);
  });

  it("writes a multi-line list item template and a quote with inline children without extra breaks", () => {
    expect(roundTrip("* {{flag|X\n|y}} one\n* two")).toBe("* {{flag|X\n|y}} one\n* two");
    expect(roundTrip("<blockquote>A [[B]] quote</blockquote>")).toBe(
      "<blockquote>\nA [[B]] quote\n</blockquote>"
    );
  });
});

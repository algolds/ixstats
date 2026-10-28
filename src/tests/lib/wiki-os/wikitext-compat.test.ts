/** @jest-environment jsdom */
/**
 * MediaWiki compatibility of the visual editor, construct by construct: for every fixture page (and the
 * whitespace and line-ending cases below), switching modes back and forth writes the page back byte for byte with the
 * same Plate content each time, Slate's normaliser changes nothing, and one character typed at the end of any block,
 * list item or table cell changes the page by exactly that character and survives a switch to source and back.
 * The checks are the ones the corpus audit runs (scripts/audit/wikios-mode-switch.ts).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkCycles,
  checkEdit,
  diffWindow,
  editableUnits,
  loadInEditor,
  normalisedSave,
  typeAt,
} from "../../../../scripts/audit/wikios-mode-switch-checks";
import { parseInlineLinksAndFormatting } from "~/lib/wiki-os/wikitext/link-parser";

const FIXTURE_DIR = join(__dirname, "../../fixtures/wikitext");
const fixtures = readdirSync(FIXTURE_DIR)
  .filter((name) => name.endsWith(".wiki"))
  .sort();
const read = (name: string): string => readFileSync(join(FIXTURE_DIR, name), "utf8");

/** Documents a fixture file cannot hold reliably (an editor or git would change their line endings or ends). */
const WHITESPACE_CASES: ReadonlyArray<readonly [string, string]> = [
  [
    "CRLF line endings",
    "== Head ==\r\nText with [[link]].\r\n\r\n* item\r\n* item two\r\n\r\n{|\r\n| a || b\r\n|}\r\n",
  ],
  ["lone CR", "First line\rsecond line\r\n\r\nNext."],
  ["no trailing newline", "== Head ==\nLast paragraph without a newline"],
  ["trailing spaces and tabs", "Text  \t\n\n* item \n* two\t\n\n== H ==  \n"],
  ["leading blank lines and spaces", "\n\n  \nText after blank lines.\n"],
  ["only a comment", "<!-- nothing else -->"],
  ["non-breaking and odd spaces", "a b c d　e​f\n\n \n\n*  item\n"],
  ["form feed and vertical tab", "Text\f more\vtext.\n"],
];

describe("mode switches write every page back unchanged", () => {
  it.each(fixtures)("%s: 3 source -> visual -> source cycles", (name) => {
    const input = read(name);
    const result = checkCycles(input, 3);
    expect(result.firstDifferent ?? input).toBe(input);
    expect(result.stableTree).toBe(true);
  });

  it.each(WHITESPACE_CASES)("%s: 3 cycles", (_label, input) => {
    const result = checkCycles(input, 3);
    expect(result.firstDifferent ?? input).toBe(input);
    expect(result.stableTree).toBe(true);
  });
});

describe("Slate's full normalisation changes nothing", () => {
  it.each(fixtures)("%s", (name) => {
    const input = read(name);
    expect(normalisedSave(input)).toBe(input);
  });

  it.each(WHITESPACE_CASES)("%s", (_label, input) => {
    expect(normalisedSave(input)).toBe(input);
  });
});

/**
 * Byte for byte where the block's markup allows it; where it does not (a quote mark left open at the end of a line is
 * written closed) the page must still read the same, and nothing outside the edited block may change.
 */
describe("one character typed anywhere changes the page by that character", () => {
  const cases = [...fixtures.map((name) => [name, read(name)] as const), ...WHITESPACE_CASES];

  it.each(cases)("%s: every block, list item and table cell", (_label, input) => {
    const nodes = loadInEditor(input);
    const failures = editableUnits(nodes)
      .map((unit) => checkEdit(input, nodes, unit))
      .filter((o) => !(o.markOnce && o.stableAfter && o.confined && (o.local || o.equivalent)))
      .map((o) => ({
        kind: o.kind,
        confined: o.confined,
        equivalent: o.equivalent,
        stable: o.stableAfter,
        ...diffWindow(input, o.output),
      }));
    expect(failures).toEqual([]);
  });
});

describe("constructs that must stay what they are when their block is edited", () => {
  /** Types `x` at the end of the first editable place of `input` and returns the saved page. */
  const typeFirst = (input: string, at = 0): string => {
    const nodes = loadInEditor(input);
    return typeAt(nodes, editableUnits(nodes)[at]!, "x");
  };

  it("keeps a category sort key of one space when the paragraph holding it is edited", () => {
    const input = "Text [[Category:Arcadia| ]]";
    expect(normalisedSave(input)).toBe(input);
    expect(typeFirst(input)).toBe("Textx [[Category:Arcadia| ]]");
  });

  it("keeps a link with an empty label (an unexpanded pipe trick) when its paragraph is edited", () => {
    const input = "<ref>[[Foo (bar)|]]</ref> and [[Baz|]]";
    expect(normalisedSave(input)).toBe(input);
    expect(typeFirst(input)).toBe("<ref>[[Foo (bar)|]]</ref> andx [[Baz|]]");
  });

  it("keeps the trailing whitespace of an edited list item", () => {
    expect(typeFirst("* one; \n* two")).toBe("* one;x \n* two");
  });

  it("changes only the edited cell of a row: the other cells keep their markup", () => {
    const input = '{|\n|style="text-align:right"|2\n|align=center| two || three\n|}';
    expect(typeFirst(input, 1)).toBe(
      '{|\n|style="text-align:right"|2\n|align=center| twox || three\n|}'
    );
    expect(typeFirst(input, 2)).toBe(
      '{|\n|style="text-align:right"|2\n|align=center| two || threex\n|}'
    );
  });

  it("writes no |- before a first row that had none when one of its cells is edited", () => {
    expect(typeFirst("{|\n| a\n| b\n|}", 0)).toBe("{|\n| ax\n| b\n|}");
  });

  it("keeps a possessive after italics (''Name'''s) as MediaWiki reads it when the paragraph is edited", () => {
    const input = "In 1962, ''Unicorn'''s original name was restored.";
    expect(typeFirst(input)).toBe(`${input}x`);
  });

  it("keeps a bold run that continues across a comment holding a line break", () => {
    const input = "}}\">'''(<!--\n-->{{x}} text''' end";
    expect(typeFirst(input)).toBe(`${input}x`);
  });

  it("keeps two neighbouring paragraphs that were one line break apart one line break apart", () => {
    // A `<blockquote>` that never closes starts a new paragraph block, but MediaWiki reads both lines as one paragraph.
    const input = "Intro line\n<blockquote>never closed";
    expect(typeFirst(input, 0)).toBe("Intro linex\n<blockquote>never closed");
    expect(typeFirst(input, 1)).toBe(`${input}x`);
  });

  it("keeps a blockquote's attributes and line structure when its text is edited", () => {
    const listed = '<blockquote class="toccolours">\n* one\n* two\n</blockquote>';
    expect(typeFirst(listed)).toBe('<blockquote class="toccolours">\n* one\n* twox\n</blockquote>');
    expect(typeFirst("<blockquote>\nA quote. </blockquote>")).toBe(
      "<blockquote>\nA quote.x </blockquote>"
    );
  });
});

describe("indented lines are kept as MediaWiki reads them", () => {
  const kinds = (input: string): string[] =>
    loadInEditor(input).map((node) =>
      node.type === "raw-wikitext" ? `raw:${node.construct}` : (node.type ?? "")
    );

  it("reads a line that starts with a space as preformatted text, not as the list or heading it looks like", () => {
    expect(kinds(" Preformatted.\n * not a list\n == not a heading ==\n\nText.")).toEqual([
      "raw:preformatted",
      "p",
    ]);
    expect(kinds("* item\n * pre, not an item\n* item")).toEqual(["ul", "raw:preformatted", "ul"]);
    expect(kinds("Text.\n pre after text")).toEqual(["p", "raw:preformatted"]);
    expect(kinds("\t== tab, not a heading ==")).toEqual(["raw:preformatted"]);
  });

  it("keeps indented templates, tables, tags and magic words editable as before", () => {
    expect(kinds(" {{Infobox x\n| a = b\n}}")).toEqual(["infobox-block"]);
    expect(kinds(" {|\n| a\n|}")).toEqual(["table"]);
    expect(kinds(" <!-- note -->")).toEqual(["raw:comment"]);
  });

  it("an edit next to an indented line keeps its indent", () => {
    const input = "* item\n * pre, not an item";
    const nodes = loadInEditor(input);
    expect(typeAt(nodes, editableUnits(nodes)[0]!, "x")).toBe("* itemx\n * pre, not an item");
  });

  it("keeps a non-breaking space after a list marker", () => {
    const input = "* {{flag|A}}\n* B";
    const nodes = loadInEditor(input);
    expect(typeAt(nodes, editableUnits(nodes)[1]!, "x")).toBe("* {{flag|A}}\n* Bx");
  });
});

describe("quote marks are read as MediaWiki reads them (doQuotes)", () => {
  type Seg = [text: string, bold: boolean, italic: boolean];
  const segments = (text: string): Seg[] =>
    parseInlineLinksAndFormatting(text).flatMap((node): Seg[] =>
      "type" in node ? [] : [[node.text, Boolean(node.bold), Boolean(node.italic)]]
    );

  it("turns the bold run after a multi-letter word into an apostrophe and italics when both counts are odd", () => {
    expect(segments("''Foo'''s bar")).toEqual([
      ["Foo'", false, true],
      ["s bar", false, false],
    ]);
  });

  it("prefers a bold run after a single-letter word", () => {
    expect(segments("''x a'''b cd'''e '''f")).toEqual([
      ["x a'", false, true],
      ["b cd", false, false],
      ["e ", true, false],
      ["f", false, false],
    ]);
  });

  it("falls back to a bold run after a space", () => {
    expect(segments("''x '''y")).toEqual([
      ["x '", false, true],
      ["y", false, false],
    ]);
  });

  it("balances each line on its own", () => {
    expect(segments("''a'''b\n'''c'''")).toEqual([
      ["a'", false, true],
      ["b\n", false, false],
      ["c", true, false],
    ]);
  });
});

describe("a template ends where MediaWiki ends it", () => {
  const kinds = (input: string): string[] => loadInEditor(input).map((node) => node.type ?? "");

  it("closes a template whose last parameter is empty (`|}}`), so the page after it stays editable", () => {
    // `|}` is a table close only at the start of a line; mid-line it is a pipe and a brace.
    expect(kinds("{{Further|a|}}\n\nAfter one.\n\nAfter two.")).toEqual(["template-block", "p", "p"]);
    expect(kinds("Text {{x|}} more.\n\nNext.")).toEqual(["p", "p"]);
    const cycles = checkCycles("{{Further|a|label3=Energy|}}\n\nAfter.\n", 3);
    expect(cycles.fixedPoint && cycles.stableTree).toBe(true);
  });

  it("still skips a table inside a template, closed at the start of a line", () => {
    expect(kinds("{{Box|\n{|\n| a\n|}}}\n\nAfter.")).toEqual(["template-block", "p"]);
  });
});

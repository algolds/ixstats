/** @jest-environment jsdom */
/**
 * The lossless visual editor (plan 414, owner gate D4): every fixture page loads, normalises (Slate's own normaliser,
 * fingerprints kept) and saves byte for byte, and so do 600 seeded mutations of them; one edit changes one block of every
 * fixture; structure edits (tables, lists, headings, templates, links, marks, files) change only what was edited and
 * never write a template, link or quote run that MediaWiki would read differently; a block that lost its wikitext is
 * reported incomplete, never saved.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serializePlateToWikitext } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import { astToPlateNodes, astToWikitext, plateNodesToAst, wikitextToAst } from "~/lib/wiki-os/transformers/wiki-ast-converter";
import { createEditor, type Descendant, Editor, type Point, Transforms } from "slate";
import { INLINE_ELEMENTS, VOID_BLOCK_ELEMENTS, VOID_INLINE_ELEMENTS } from "~/components/wiki-os/editor/plate/element-kinds";
import { plateFingerprint } from "~/lib/wiki-os/transformers/plate-fingerprint";
import type { PlateNode } from "~/lib/wiki-os/transformers/plate-node";
import { parse } from "~/lib/wiki-os/wikitext/parser";
import { escapeParamValue, rewriteTemplateParams } from "~/lib/wiki-os/wikitext/template-edit";
import { removeEmptyLink } from "~/components/wiki-os/editor/plate/link-normalizer";
import { parseInlineLinksAndFormatting } from "~/lib/wiki-os/wikitext/link-parser";
import type { WikiInlineNode } from "~/lib/wiki-os/wikitext/types";
import { deserializeParsoidHtml } from "~/components/wiki-os/editor/plate/wiki-html";

describe("round trip without edits", () => {
  const FIXTURE_DIR = join(__dirname, "../../fixtures/wikitext");
  const fixtures = readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith(".wiki"))
    .sort();

  function loadAndSave(wikitext: string): string {
    return serializePlateToWikitext(astToPlateNodes(wikitextToAst(wikitext))).wikitext;
  }

  describe("visual editor round trip without edits", () => {
    it("has the fixture corpus the plan asks for", () => {
      expect(fixtures.length).toBeGreaterThanOrEqual(15);
      expect(fixtures.filter((name) => name.startsWith("real-")).length).toBeGreaterThanOrEqual(5);
    });
    it("keeps #REDIRECT a redirect instead of turning it into a numbered list", () => {
      const input = "#REDIRECT [[Republic of Vesperia]]\n";
      const plate = astToPlateNodes(wikitextToAst(input));
      expect(plate.map((node: { type: string }) => node.type)).not.toContain("ol");
      expect(serializePlateToWikitext(plate).wikitext).toBe(input);
    });

    it("keeps malformed wikitext byte-identical: 600 seeded mutations of the fixtures", () => {
      // Stray braces, brackets, quote runs, unclosed tags and comments, odd whitespace, cut-off text.
      const pieces = [
        "{{", "}}", "[[", "]]", "{|", "|}", "|-", "'''", "''", "'''''", "<ref>", "</ref>", "<ref name=a />",
        "<!--", "-->", "<nowiki>", "</nowiki>", "<pre>", "</pre>", "\n", "\n\n", "\r\n", " ", "\t", "* ", "# ",
        ": ", "; ", "==", "----", "__NOTOC__", "<gallery>", "</blockquote>", "<blockquote>", "|", "!", "\u00a0",
        "#REDIRECT [[X]]", "[[File:a.png|thumb|x]]", "\ud83d", "\ude00", "\u00e9",
      ];
      const corpus = fixtures.map((name) => readFileSync(join(FIXTURE_DIR, name), "utf8"));
      let state = 20260930;
      const random = (): number => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 2 ** 32;
      };
      const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]!;

      for (let round = 0; round < 600; round++) {
        let doc = pick(corpus);
        for (let edit = 0, count = 1 + Math.floor(random() * 5); edit < count; edit++) {
          const at = Math.floor(random() * (doc.length + 1));
          doc =
            random() < 0.6
              ? doc.slice(0, at) + pick(pieces) + doc.slice(at)
              : doc.slice(0, at) + doc.slice(at + Math.floor(random() * 40));
        }
        expect(loadAndSave(doc)).toBe(doc.trim() === "" ? "" : doc);
      }
    });
  });
});

describe("Slate's normaliser", () => {
  const VOID_TYPES = new Set<string>([...VOID_BLOCK_ELEMENTS, ...VOID_INLINE_ELEMENTS]);
  const INLINE_TYPES = new Set<string>([...VOID_INLINE_ELEMENTS, ...INLINE_ELEMENTS]);
  const isInlineType = (type: string | undefined): boolean => type !== undefined && INLINE_TYPES.has(type);

  const FIXTURE_DIR = join(__dirname, "../../fixtures/wikitext");
  const fixtures = readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith(".wiki"))
    .sort();

  function normalise(value: Descendant[], inline: (type: string | undefined) => boolean): PlateNode[] {
    const editor = createEditor();
    editor.isInline = (el) => inline((el as PlateNode).type);
    editor.isVoid = (el) => VOID_TYPES.has((el as PlateNode).type ?? "");
    editor.children = structuredClone(value);
    Editor.normalize(editor, { force: true });
    return editor.children as PlateNode[];
  }

  /** Every list item, table row and link that carries a fingerprint still matches it after normalising. */
  function expectNestedFingerprints(after: PlateNode, before: PlateNode): void {
    const afterChildren = after.children ?? [];
    const beforeChildren = before.children ?? [];
    beforeChildren.forEach((child, index) => {
      const twin = afterChildren.find((candidate, at) => at === index && candidate.type === child.type) ?? afterChildren[index];
      if (child.wikiFp !== undefined && twin) expect(plateFingerprint(twin)).toBe(child.wikiFp);
      if (twin && child.children) expectNestedFingerprints(twin, child);
    });
  }

  describe("Slate normalisation of a freshly loaded page", () => {
    it.each(fixtures)("%s keeps every block's fingerprint and saves byte-identical", (name) => {
      const input = readFileSync(join(FIXTURE_DIR, name), "utf8");
      const loaded = astToPlateNodes(wikitextToAst(input)) as Descendant[];
      const normalised = normalise(loaded, isInlineType);

      expect(normalised).toHaveLength(loaded.length);
      normalised.forEach((node, index) => {
        expect(plateFingerprint(node)).toBe((loaded[index] as PlateNode).wikiFp);
        expectNestedFingerprints(node, (loaded[index] as PlateNode));
      });
      expect(serializePlateToWikitext(normalised as Descendant[]).wikitext).toBe(input);
    });

    it("would unwrap a link in a paragraph if links were not registered as inline elements", () => {
      const loaded = astToPlateNodes(wikitextToAst("See [[Vilena]] today.")) as Descendant[];
      const unregistered = normalise(loaded, (type) => type !== "link" && isInlineType(type));
      expect(plateFingerprint(unregistered[0]!)).not.toBe((loaded[0] as PlateNode).wikiFp);
    });
  });
});

describe("one edit, one block", () => {
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
    const withCaption = (p: PlateNode, caption: string): PlateNode => ({
      ...p,
      children: p.children!.map((leaf) => (leaf.type === "wiki-file" ? { ...leaf, caption } : leaf)),
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
  });

  describe("structure edits keep separators safe", () => {
    it("does not merge a new paragraph into the paragraph after a heading", () => {
      const nodes = load("== Head ==\nFirst paragraph.\n\nSecond.\n");
      expect(nodes.map((n) => n.type)).toEqual(["h2", "p", "p"]);
      const inserted: PlateNode = { type: "p", children: [{ text: "Inserted." }] };
      const out = save([nodes[0]!, inserted, nodes[1]!, nodes[2]!]);
      expect(out).toBe("== Head ==\n\nInserted.\n\nFirst paragraph.\n\nSecond.\n");
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
  });
});

describe("structure edits", () => {
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
      expect(save(edit(nodes, "4", "four"))).toBe(table.replace("|3 || 4", "|3 || four"));
    });
    it("keeps the spacing of a heading when only its text changes, and through a level change", () => {
      expect(save(edit(load("==Foo=="), "Foo", "Bar"))).toBe("==Bar==");
      expect(save(edit(load("===  Foo  ==="), "Foo", "Bar"))).toBe("===  Bar  ===");
      expect(save(edit(load("== Foo =="), "Foo", "Bar"))).toBe("== Bar ==");
      const [h] = load("==Foo==");
      expect(save([{ ...h!, type: "h3", children: [{ text: "Foo" }] }])).toBe("===Foo===");
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
    it("keeps positional parameters and comments of the untouched ones", () => {
      const source = "{{Quote|A text <!-- note --> here|Someone |source = Book}}";
      const nodes = load(source);
      const edited = { ...nodes[0]!, params: { ...nodes[0]!.params, "2": "Somebody" }, edited: true };
      expect(save([edited])).toBe("{{Quote|A text <!-- note --> here|Somebody |source = Book}}");
    });
  });

  describe("no junk wikitext (review fix 6)", () => {
    it("writes no link at all for a link whose label was emptied: never [[Target]], never [[Target|]]", () => {
      const [p] = load("See [[Vilena|the city]] today.");
      const emptied = {
        ...p!,
        children: p!.children!.map((leaf) => (leaf.type === "link" ? { ...leaf, children: [{ text: "" }] } : leaf)),
      };
      expect(save([emptied])).toBe("See  today.");
      expect(save([emptied])).not.toContain("[[");
    });
  });

  describe("quote marks inside link labels are marks, not literal apostrophes (review fix 10)", () => {
    it("round-trips untouched, and keeps the marks inside the label when the label is edited", () => {
      const source = "See [[Foo|''x'' y]] and [[Bar|'''b''' c]] and [http://a.example ''e''] now.";
      expect(roundTrip(source)).toBe(source);
      const out = save(edit(load(source), "x", "z"));
      expect(out).toBe("See [[Foo|''z'' y]] and [[Bar|'''b''' c]] and [http://a.example ''e''] now.");
    });
  });
});

describe("the re-verification fixes", () => {
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
  });
});

describe("link and mark edits", () => {
  const VOID = new Set<string>([...VOID_BLOCK_ELEMENTS, ...VOID_INLINE_ELEMENTS]);
  const INLINE = new Set<string>([...VOID_INLINE_ELEMENTS, ...INLINE_ELEMENTS]);
  const MARKABLE = new Set<string>(VOID_INLINE_ELEMENTS);
  const typeOf = (el: object): string => (el as PlateNode).type ?? "";

  function open(wikitext: string, { normalizeLinks = true } = {}): Editor {
    const editor = createEditor();
    editor.isInline = (el) => INLINE.has(typeOf(el));
    editor.isVoid = (el) => VOID.has(typeOf(el));
    editor.markableVoid = (el) => MARKABLE.has(typeOf(el));
    if (normalizeLinks) {
      const { normalizeNode } = editor;
      editor.normalizeNode = (entry, options) => {
        if (removeEmptyLink(editor, entry)) return;
        normalizeNode(entry, options);
      };
    }
    editor.children = structuredClone(astToPlateNodes(wikitextToAst(wikitext))) as Descendant[];
    Editor.normalize(editor, { force: true });
    return editor;
  }

  const save = (editor: Editor): string => serializePlateToWikitext(editor.children).wikitext;
  const point = (path: number[], offset: number): Point => ({ path, offset });
  const selectAll = (editor: Editor): void => Transforms.select(editor, Editor.range(editor, []));

  /** Path of the first node of `type` in the editor. */
  function pathOf(editor: Editor, type: string): number[] {
    const [entry] = Editor.nodes(editor, { at: [], match: (n) => typeOf(n) === type, voids: true });
    if (!entry) throw new Error(`no ${type} in the editor`);
    return entry[1];
  }

  describe("an empty link is not a link (phantom links)", () => {
    it("Enter in the middle of a link splits it into two links", () => {
      const editor = open("[[Foo|foobar]]");
      Transforms.select(editor, point([...pathOf(editor, "link"), 0], 3));
      Transforms.splitNodes(editor, { always: true });
      expect(save(editor)).toBe("[[Foo|foo]]\n\n[[Foo|bar]]");
    });

    it("deleting all of a link's text removes the link", () => {
      const editor = open("A [[Foo]] b");
      const text = [...pathOf(editor, "link"), 0];
      Transforms.select(editor, { anchor: point(text, 0), focus: point(text, 3) });
      Transforms.delete(editor);

      expect(save(editor)).toBe("A  b");
      expect([...Editor.nodes(editor, { at: [], match: (n) => typeOf(n) === "link" })]).toHaveLength(0);
    });

    it("select-all then Delete leaves an empty page, not [[Foo]]", () => {
      const editor = open("[[Foo]]");
      selectAll(editor);
      Transforms.delete(editor);
      expect(save(editor)).toBe("");
    });
    it("an empty link element that got through is written as nothing", () => {
      // Without the normaliser, as in a value loaded from a draft or produced by a transform that skips it.
      const editor = open("A [[Foo]] b", { normalizeLinks: false });
      Transforms.select(editor, point([...pathOf(editor, "link"), 0], 0));
      Transforms.splitNodes(editor, { always: true });

      // the split does leave an empty link element when nothing normalises it ...
      expect([...Editor.nodes(editor, { at: [], match: (n) => typeOf(n) === "link" })]).toHaveLength(2);
      // ... and it is written as nothing
      expect(save(editor)).not.toContain("[[Foo]]\n\n[[Foo]]");
      expect(save(editor).match(/\[\[Foo\]\]/g)).toHaveLength(1);
    });
  });

  describe("bold and italic around a link can be removed, and a bold paragraph is one run (marks)", () => {
    it("bolding a whole paragraph with a link writes one run across the link", () => {
      const editor = open("Hello [[Foo]] world");
      selectAll(editor);
      Editor.addMark(editor, "bold", true);
      expect(save(editor)).toBe("'''Hello [[Foo]] world'''");
    });
    it("removes bold from the link text only: the bold run is cut around the link", () => {
      const editor = open("'''a [[Foo]] b'''");
      const text = [...pathOf(editor, "link"), 0];
      Transforms.select(editor, { anchor: point(text, 0), focus: point(text, 3) });
      Editor.removeMark(editor, "bold");
      expect(save(editor)).toBe("'''a '''[[Foo]]''' b'''");
    });
    it("round-trips untouched links with marks inside and around, unchanged", () => {
      const source = "'''[[Foo|''x'']]''' and ''[http://a.example ''e'']'' and [[Bar|'''b''' c]]";
      expect(save(open(source))).toBe(source);
    });
  });

  describe("bold and italic around a [[File:]] (markable void) can be added and removed", () => {
    it("an untouched file with marks around it is written back unchanged", () => {
      const source = "''a [[File:x.png|thumb]] b'' and '''[[File:y.png]]'''";
      expect(save(open(source))).toBe(source);
    });
  });
});

describe("inline marks", () => {
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
    it("reads four quotes as an apostrophe and bold, and six as apostrophe(s) and both", () => {
      expect(show(parseInlineLinksAndFormatting("rock''''n'''"))).toEqual(["\"rock'\"", 'b:"n"']);
      expect(show(parseInlineLinksAndFormatting("a''''''b''''''"))).toEqual(["\"a'\"", "bi:\"b'\""]);
    });

    it("ends every mark at a line break", () => {
      expect(show(parseInlineLinksAndFormatting("'''bold\nplain"))).toEqual(['b:"bold"', '"\\nplain"']);
    });
    it("does not read quote marks inside comments, <nowiki> or links", () => {
      expect(show(parseInlineLinksAndFormatting("a <!-- '' --> b <nowiki>'''x'''</nowiki> c"))).toEqual([
        '"a <!-- \'\' --> b <nowiki>\'\'\'x\'\'\'</nowiki> c"',
      ]);
      expect(show(parseInlineLinksAndFormatting("[[Foo|''x'']] y"))).toEqual(["[[Foo]]", '" y"']);
    });
  });

  describe("<ref> parsing", () => {
    it("leaves an unclosed <ref> as text", () => {
      const nodes = parseInlineLinksAndFormatting("A <ref>never closed");
      expect(nodes.every((node) => !("type" in node))).toBe(true);
    });
  });

  describe("the AST serializer writes marks across a run and the new inline nodes", () => {
    it("does not write two adjacent bold chunks as six quotes", () => {
      const { ast } = parse("'''a'''");
      const p = ast.nodes[0] as { children: WikiInlineNode[] };
      const split = { ...ast, nodes: [{ ...p, type: "paragraph" as const, children: [{ text: "a", bold: true }, { text: "b", bold: true }] }] };
      expect(astToWikitext(split)).toBe("'''ab'''");
    });
  });
});

describe("the AST converter", () => {
  describe("WikiAST ⇄ Plate Nodes & Wikitext Roundtrip Converter", () => {
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
    it("handles lists containing links, bold, and typed text leaves without dropping content", () => {
      // No indent before the second item: MediaWiki reads an indented `*` line as preformatted text, not a list item.
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
  });
});

describe("the HTML serialiser", () => {
  /** Build nodes via the real deserializer so structure matches production. */
  function fromHtml(html: string): Descendant[] {
    return deserializeParsoidHtml(`<body>${html}</body>`);
  }

  describe("serializePlateToWikitext", () => {
    it("reports incomplete when an atomic node lacks wikitext", () => {
      const value = fromHtml("<p>x</p>");
      value.push({
        type: "raw-html",
        id: "t2",
        kind: "generic",
        html: '<div class="navbox">old render</div>',
        children: [{ text: "" }],
      } as never);
      const { complete } = serializePlateToWikitext(value);
      expect(complete).toBe(false);
    });
    it("keeps list items on consecutive lines (a blank line would split the list in MediaWiki)", () => {
      const { wikitext } = serializePlateToWikitext(fromHtml("<ul><li>a</li><li>b</li></ul>"));
      expect(wikitext).toBe("* a\n* b");
    });
  });
});

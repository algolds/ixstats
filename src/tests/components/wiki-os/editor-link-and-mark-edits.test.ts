/** @jest-environment node */
/**
 * editor-link-and-mark-edits.test.ts — phantom links and bold/italic around links and files
 * (plan 414 re-verification, items 1 and 3), driven through Slate's own transforms with the inline
 * and markable-void kinds and the empty-link normaliser the plugin registry declares.
 */

import { createEditor, Editor, Range, Transforms, type Descendant, type Point } from "slate";
import { removeEmptyLink } from "~/components/wiki-os/editor/plate/link-normalizer";
import { INLINE_ELEMENTS, VOID_BLOCK_ELEMENTS, VOID_INLINE_ELEMENTS } from "~/components/wiki-os/editor/plate/element-kinds";
import { serializePlateToWikitext } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import type { PlateNode } from "~/lib/wiki-os/transformers/plate-node";
import { astToPlateNodes, wikitextToAst } from "~/lib/wiki-os/transformers/wiki-ast-converter";

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
  it("Enter at the start of a link leaves no empty link behind", () => {
    const editor = open("A [[Foo]] b");
    Transforms.select(editor, point([...pathOf(editor, "link"), 0], 0));
    Transforms.splitNodes(editor, { always: true });

    expect(save(editor)).toBe("A \n\n[[Foo]] b");
    expect([...Editor.nodes(editor, { at: [], match: (n) => typeOf(n) === "link" })]).toHaveLength(1);
  });

  it("Enter at the end of a link leaves no empty link behind", () => {
    const editor = open("A [[Foo]] b");
    Transforms.select(editor, point([...pathOf(editor, "link"), 0], 3));
    Transforms.splitNodes(editor, { always: true });

    expect(save(editor)).toBe("A [[Foo]]\n\n b");
    expect([...Editor.nodes(editor, { at: [], match: (n) => typeOf(n) === "link" })]).toHaveLength(1);
  });

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

  it("Enter at the end of a list item that ends in a link starts an empty item, not a second link", () => {
    const editor = open("* [[B|bee]]\n* c");
    Transforms.select(editor, point([...pathOf(editor, "link"), 0], 3));
    Transforms.splitNodes(editor, { always: true });

    const out = save(editor);
    expect(out).toBe("* [[B|bee]]\n* \n* c");
    expect(out.match(/\[\[B/g)).toHaveLength(1);
  });

  it("Enter at the start of a list item that starts with a link moves the link down whole", () => {
    const editor = open("* [[B|bee]] flies\n* c");
    Transforms.select(editor, point([...pathOf(editor, "link"), 0], 0));
    Transforms.splitNodes(editor, { always: true });

    const out = save(editor);
    expect(out.match(/\[\[B/g)).toHaveLength(1);
    expect(out).toBe("* \n* [[B|bee]] flies\n* c");
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

  it("does not remove a link that has text, nor a void chip", () => {
    const editor = open("A [[Foo]] {{flag|X}} [[File:x.png]] b");
    Editor.normalize(editor, { force: true });
    expect(save(editor)).toBe("A [[Foo]] {{flag|X}} [[File:x.png]] b");
  });
});

describe("bold and italic around a link can be removed, and a bold paragraph is one run (marks)", () => {
  it("bolding a whole paragraph with a link writes one run across the link", () => {
    const editor = open("Hello [[Foo]] world");
    selectAll(editor);
    Editor.addMark(editor, "bold", true);
    expect(save(editor)).toBe("'''Hello [[Foo]] world'''");
  });

  it("bolding a whole paragraph with a piped link and an unrelated link keeps it tidy", () => {
    const editor = open("See [[Foo|the foo]] and [[Bar]] now.");
    selectAll(editor);
    Editor.addMark(editor, "bold", true);
    expect(save(editor)).toBe("'''See [[Foo|the foo]] and [[Bar]] now.'''");
  });

  it("removes bold from the whole of a bold paragraph, link included", () => {
    const editor = open("'''Hello [[Foo]] world'''");
    selectAll(editor);
    Editor.removeMark(editor, "bold");
    expect(save(editor)).toBe("Hello [[Foo]] world");
  });

  it("removes bold from the link text only: the bold run is cut around the link", () => {
    const editor = open("'''a [[Foo]] b'''");
    const text = [...pathOf(editor, "link"), 0];
    Transforms.select(editor, { anchor: point(text, 0), focus: point(text, 3) });
    Editor.removeMark(editor, "bold");
    expect(save(editor)).toBe("'''a '''[[Foo]]''' b'''");
  });

  it("removes bold from a bold link loaded from source", () => {
    const editor = open("x '''[[Foo]]''' y");
    const text = [...pathOf(editor, "link"), 0];
    Transforms.select(editor, { anchor: point(text, 0), focus: point(text, 3) });
    Editor.removeMark(editor, "bold");
    expect(save(editor)).toBe("x [[Foo]] y");
  });

  it("adds italic to a link alone, and removes it again", () => {
    const editor = open("x [[Foo]] y");
    const text = [...pathOf(editor, "link"), 0];
    Transforms.select(editor, { anchor: point(text, 0), focus: point(text, 3) });
    Editor.addMark(editor, "italic", true);
    expect(save(editor)).toBe("x ''[[Foo]]'' y");
    Editor.removeMark(editor, "italic");
    expect(save(editor)).toBe("x [[Foo]] y");
  });

  it("keeps the marks inside a label that are not on the whole label", () => {
    const editor = open("[[Foo|a ''b'' c]]");
    selectAll(editor);
    Editor.addMark(editor, "bold", true);
    expect(save(editor)).toBe("'''[[Foo|a ''b'' c]]'''");
  });

  it("round-trips untouched links with marks inside and around, unchanged", () => {
    const source = "'''[[Foo|''x'']]''' and ''[http://a.example ''e'']'' and [[Bar|'''b''' c]]";
    expect(save(open(source))).toBe(source);
  });
});

describe("bold and italic around a [[File:]] (markable void) can be added and removed", () => {
  it("italic around a file is removed together with the italic text around it", () => {
    const editor = open("''a [[File:x.png|thumb]] b''");
    selectAll(editor);
    Editor.removeMark(editor, "italic");
    expect(save(editor)).toBe("a [[File:x.png|thumb]] b");
  });

  it("italicising a whole paragraph with a file writes one run across it", () => {
    const editor = open("a [[File:x.png|thumb|Cap]] b");
    selectAll(editor);
    Editor.addMark(editor, "italic", true);
    expect(save(editor)).toBe("''a [[File:x.png|thumb|Cap]] b''");
  });

  it("removes bold from a chip and a reference too", () => {
    const editor = open("'''a {{flag|X}}<ref>r</ref> b'''");
    selectAll(editor);
    Editor.removeMark(editor, "bold");
    expect(save(editor)).toBe("a {{flag|X}}<ref>r</ref> b");
  });

  it("an untouched file with marks around it is written back unchanged", () => {
    const source = "''a [[File:x.png|thumb]] b'' and '''[[File:y.png]]'''";
    expect(save(open(source))).toBe(source);
  });
});

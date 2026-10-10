import { createEditor, Editor, Transforms, type Descendant } from "slate";
import type { TSlateEditor } from "platejs";
import { serializePlateToWikitext } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import { appendQuote, insertAtCaret } from "~/components/thinkpages-forum/composer/canvas-ops";
import { quoteWikitext } from "~/components/thinkpages-forum/composer/QuoteInsert";

// platejs is ESM-only and not loadable here: a Slate editor with the slice of Plate's `tf` and `api` that canvas-ops
// uses, each a thin pass to the Slate function of the same name.
function editorWith(...children: Descendant[]): TSlateEditor {
  const editor = createEditor();
  editor.isVoid = (el) => (el as { type?: string }).type === "raw-wikitext";
  editor.children = children;
  const plate = {
    tf: {
      insertText: (text: string) => Transforms.insertText(editor, text),
      insertNodes: (nodes: Descendant[], options: { at: number[] }) =>
        Transforms.insertNodes(editor, nodes, options),
      removeNodes: (options: { at: number[] }) => Transforms.removeNodes(editor, options),
      select: (at: Parameters<typeof Transforms.select>[1]) => Transforms.select(editor, at),
      withoutNormalizing: (run: () => void) => Editor.withoutNormalizing(editor, run),
      focus: () => {
        throw new Error("not mounted");
      },
    },
    api: {
      end: (at: number[]) => Editor.end(editor, at),
      string: (at: number[]) => Editor.string(editor, at),
    },
  };
  return Object.assign(editor, plate) as never;
}

const para = (text: string): Descendant => ({ type: "p", children: [{ text }] }) as never;
const wikitextOf = (editor: TSlateEditor) =>
  serializePlateToWikitext(editor.children as never).wikitext;
const typesOf = (editor: TSlateEditor) =>
  editor.children.map((node) => ("type" in node ? String(node.type) : "text"));

describe("insertAtCaret", () => {
  it("puts the text at the caret", () => {
    const editor = editorWith(para("ab"));
    editor.tf.select({ anchor: { path: [0, 0], offset: 1 }, focus: { path: [0, 0], offset: 1 } });
    insertAtCaret(editor, "[ixaction=a1]");
    expect(wikitextOf(editor)).toBe("a[ixaction=a1]b");
  });

  it("puts the text at the end when nothing is selected", () => {
    const editor = editorWith(para("one"), para("two"));
    insertAtCaret(editor, "[ixaction=a1]");
    expect(wikitextOf(editor)).toContain("two[ixaction=a1]");
  });
});

describe("appendQuote", () => {
  const quote = { postId: "p1", author: "Heku", text: "Hello there" };
  const block = quoteWikitext(quote).trimEnd();

  it("replaces an empty document with the quote and leaves a paragraph to write in", () => {
    const editor = editorWith(para(""));
    appendQuote(editor, quote);
    expect(typesOf(editor)).toEqual(["raw-wikitext", "p"]);
    expect(wikitextOf(editor)).toContain(block);
    expect(editor.api.string([1])).toBe("");
    expect(editor.selection?.focus.path[0]).toBe(1);
  });

  it("adds the quote after what is written and keeps that text", () => {
    const editor = editorWith(para("My thoughts"));
    appendQuote(editor, quote);
    expect(typesOf(editor)).toEqual(["p", "raw-wikitext", "p"]);
    expect(wikitextOf(editor).startsWith("My thoughts")).toBe(true);
  });

  it("saves the quote byte for byte whatever is typed before and after it", () => {
    const editor = editorWith(para("Intro"));
    appendQuote(editor, quote);
    editor.tf.insertText(" and my reply");
    editor.tf.select({ anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 0 } });
    editor.tf.insertText("Edited: ");
    const saved = wikitextOf(editor);
    expect(saved).toContain(block);
    expect(saved).toBe(`Edited: Intro\n\n${block}\n\n and my reply`);
  });

  it("holds the quote as one block with no text of its own, so no tags show as text", () => {
    const editor = editorWith(para(""));
    appendQuote(editor, quote);
    const texts = editor.api.string([0]);
    expect(texts).toBe("");
    expect(JSON.stringify(editor.children.slice(1))).not.toContain("<");
    expect(editor.children[0]).toMatchObject({
      type: "raw-wikitext",
      construct: "forum-quote",
      label: "Heku",
      caption: "Hello there",
    });
  });
});

import { createEditor, Editor, type Descendant } from "slate";
import { serializePlateToWikitext } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import { appendWikitext, insertAtCaret } from "~/components/thinkpages-forum/composer/canvas-ops";
import { quoteWikitext } from "~/components/thinkpages-forum/composer/QuoteInsert";

function editorWith(children: Descendant[]) {
  const editor = createEditor();
  editor.children = children;
  return editor;
}
const para = (text: string): Descendant => ({ type: "p", children: [{ text }] }) as never;
const wikitextOf = (editor: Editor) => serializePlateToWikitext(editor.children as never).wikitext;

describe("insertAtCaret", () => {
  it("puts the text at the caret", () => {
    const editor = editorWith([para("ab")]);
    editor.selection = { anchor: { path: [0, 0], offset: 1 }, focus: { path: [0, 0], offset: 1 } };
    insertAtCaret(editor, "[ixaction=a1]");
    expect(wikitextOf(editor)).toBe("a[ixaction=a1]b");
  });

  it("puts the text at the end when nothing is selected", () => {
    const editor = editorWith([para("one"), para("two")]);
    insertAtCaret(editor, "[ixaction=a1]");
    expect(wikitextOf(editor)).toContain("two[ixaction=a1]");
  });
});

describe("appendWikitext", () => {
  const quote = quoteWikitext({ postId: "p1", author: "Heku", text: "Hello there" });

  it("replaces an empty document with the block and leaves a paragraph to write in", () => {
    const editor = editorWith([para("")]);
    appendWikitext(editor, quote);
    const types = editor.children.map((n) => (n as { type: string }).type);
    expect(types).toEqual(["blockquote", "p"]);
    expect(wikitextOf(editor)).toContain('<blockquote class="forum-quote" data-post="p1">');
    expect(Editor.string(editor, [1])).toBe("");
    expect(editor.selection?.focus.path[0]).toBe(1);
  });

  it("adds the block after what is written and keeps it", () => {
    const editor = editorWith([para("My thoughts")]);
    appendWikitext(editor, quote);
    expect(editor.children.map((n) => (n as { type: string }).type)).toEqual([
      "p",
      "blockquote",
      "p",
    ]);
    expect(wikitextOf(editor).startsWith("My thoughts")).toBe(true);
  });
});

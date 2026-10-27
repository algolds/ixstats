/**
 * Inserting a stashed image (or a wiki embed) leaves the caret in a text block after it, not inside
 * the void image where typing does nothing.
 */
import { createEditor, Editor, Node, Transforms, type Descendant } from "slate";
import { insertVoidBlock } from "~/components/shared/editor/SlateSerializer";

function editorWith(children: Descendant[]) {
  const editor = createEditor();
  const { isVoid } = editor;
  editor.isVoid = (el: any) => el.type === "img" || isVoid(el);
  editor.children = children;
  return editor;
}

const p = (text: string) => ({ type: "p", children: [{ text }] }) as any;
const img = { type: "img", src: "x.png", alt: "x", children: [{ text: "" }] } as any;

describe("insertVoidBlock", () => {
  it("adds an empty paragraph after an image inserted at the end and puts the caret there", () => {
    const editor = editorWith([p("hello")]);
    Transforms.select(editor, Editor.end(editor, []));
    insertVoidBlock(editor, img);
    expect(editor.children.map((n: any) => n.type)).toEqual(["p", "img", "p"]);
    expect(editor.selection?.anchor.path).toEqual([2, 0]);
    Transforms.insertText(editor, "more");
    expect(Node.string(editor.children[2]!)).toBe("more");
  });

  it("puts the caret at the start of the text the image split off", () => {
    const editor = editorWith([p("helloworld")]);
    Transforms.select(editor, { path: [0, 0], offset: 5 });
    insertVoidBlock(editor, img);
    expect(editor.children.map((n: any) => n.type)).toEqual(["p", "img", "p"]);
    expect(editor.selection?.anchor).toEqual({ path: [2, 0], offset: 0 });
    expect(Node.string(editor.children[2]!)).toBe("world");
  });

  it("adds a paragraph between two images", () => {
    const editor = editorWith([p(""), { ...img }]);
    Transforms.select(editor, Editor.start(editor, [0]));
    insertVoidBlock(editor, img);
    const types = editor.children.map((n: any) => n.type);
    const at = editor.selection!.anchor.path[0]!;
    expect(types[at]).toBe("p");
    expect(types[at - 1]).toBe("img");
  });
});

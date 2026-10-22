import { htmlToQuoteText, quoteWikitext } from "~/components/thinkpages-forum/composer/QuoteInsert";
import { serializePlateToWikitext } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import { astToPlateNodes, wikitextToAst } from "~/lib/wiki-os/transformers/wiki-ast-converter";
import { createEditor, Editor, Transforms, type Descendant } from "slate";
import type { TSlateEditor } from "platejs";
import { appendQuote } from "~/components/thinkpages-forum/composer/canvas-ops";
describe("quoteWikitext", () => {
  it("strips markup that could open a template, link or tag from the author and the text", () => {
    const out = quoteWikitext({
      postId: "p1",
      author: "<b>Eve</b> {{x}} [[y]]",
      text: "a <script>alert(1)</script> {{subst:z}} [[Cat]] b",
    });
    expect(out).not.toMatch(/\{\{|\}\}|\[\[|\]\]/);
    expect(out).not.toContain("<script");
    expect(out).toContain("'''bEve/b x y''' wrote:");
    expect(out.match(/</g)).toHaveLength(6);
  });
  // Taking out the `<>` (or an inner token) must not join what was around it into a new token.
  it("holds for another member's post, whose entity-encoded markup is decoded first", () => {
    const html = "<p>{&lt;&gt;{subst:x}&lt;&gt;} [&lt;&gt;[Category:X]&lt;&gt;] ~~&lt;&gt;~</p>";
    const out = quoteWikitext({ postId: "p1", author: "A", text: htmlToQuoteText(html) });
    expect(out).not.toMatch(/\{\{|\}\}|\[\[|\]\]|~~~/);
    expect(out).toContain("subst:x");
  });

  it("never lets a signature through (the server refuses them)", () => {
    expect(quoteWikitext({ postId: "p1", author: "A", text: "x ~~~~ y" })).not.toContain("~~~");
  });

  it("drops an unusable post id rather than writing it into an attribute", () => {
    expect(quoteWikitext({ postId: 'x" onclick="y', author: "A", text: "t" })).not.toContain(
      "onclick"
    );
  });
});

describe("a quote in a post opened for editing", () => {
  const load = (src: string) => astToPlateNodes(wikitextToAst(src));
  const save = (nodes: unknown[]) => serializePlateToWikitext(nodes as never).wikitext;
  const quote = { postId: "ckabcdefghijklmnopqrstuvw", author: "Heku", text: "Hello there" };
  const block = quoteWikitext(quote).trimEnd();
  describe("a forum quote in a post that is opened for editing", () => {
    it("loads as one atomic forum-quote block that saves byte for byte", () => {
      const src = `${block}\n\nMy reply.`;
      const nodes = load(src);
      expect(nodes.map((n: { type: string }) => n.type)).toEqual(["raw-wikitext", "p"]);
      expect(nodes[0]).toMatchObject({
        construct: "forum-quote",
        rawWikitext: block,
        label: "Heku",
        caption: "Hello there",
        children: [{ text: "" }],
      });
      expect(save(nodes)).toBe(src);
    });
  });
});

describe("a quote added in Canvas", () => {
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
  describe("appendQuote", () => {
    const quote = { postId: "p1", author: "Heku", text: "Hello there" };
    const block = quoteWikitext(quote).trimEnd();
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
  });
});

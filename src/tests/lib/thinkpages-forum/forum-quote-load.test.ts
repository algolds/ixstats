import { quoteWikitext } from "~/components/thinkpages-forum/composer/QuoteInsert";
import { serializePlateToWikitext } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import { forumQuoteBlock } from "~/lib/thinkpages-forum/forum-quote";
import { astToPlateNodes, wikitextToAst } from "~/lib/wiki-os/transformers/wiki-ast-converter";

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

  it("round-trips a quote alone, with a trailing newline, and with attributes in the other order", () => {
    const swapped = block.replace(
      `class="forum-quote" data-post="${quote.postId}"`,
      `data-post="${quote.postId}" class="forum-quote"`
    );
    expect(swapped).not.toBe(block);
    for (const src of [block, `${block}\n`, swapped, `${swapped}\n\nAfter`]) {
      const nodes = load(src);
      expect(nodes[0]).toMatchObject({ type: "raw-wikitext", construct: "forum-quote" });
      expect(save(nodes)).toBe(src);
    }
  });

  it("loads a quote without a post id", () => {
    const src = quoteWikitext({ ...quote, postId: "not an id" }).trimEnd();
    expect(src).not.toContain("data-post");
    const nodes = load(src);
    expect(nodes[0]).toMatchObject({ construct: "forum-quote", label: "Heku" });
    expect(save(nodes)).toBe(src);
  });

  it("keeps the quote block byte-identical when a paragraph is typed after it", () => {
    const nodes = load(`${block}\n\nFirst.`);
    const edited = nodes.map((n: { type: string; children: { text: string }[] }) =>
      n.type === "p" ? { ...n, children: [{ text: "First. And more." }] } : n
    );
    const out = save(edited);
    expect(out.startsWith(block)).toBe(true);
    expect(out).toContain("First. And more.");
    expect(save([...nodes, { type: "p", children: [{ text: "Typed after." }] }])).toBe(
      `${block}\n\nFirst.\n\nTyped after.`
    );
  });

  it("is the same block the Quote button adds", () => {
    expect(load(block)[0]).toMatchObject(forumQuoteBlock(block, quote.author, quote.text));
  });

  it("leaves a plain blockquote exactly as before", () => {
    const nodes = load("<blockquote>x</blockquote>");
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: "blockquote", children: [{ text: "x" }] });
    expect(nodes[0].construct).toBeUndefined();
  });

  it("leaves a blockquote with another class, or a look-alike class, exactly as before", () => {
    for (const open of [
      '<blockquote class="pull-quote">',
      '<blockquote class="my-forum-quote">',
      '<blockquote class="forum-quotes">',
      '<blockquote data-forum-quote="1">',
    ]) {
      const nodes = load(`${open}x</blockquote>`);
      expect(nodes[0]).toMatchObject({ type: "blockquote" });
      expect(nodes[0].construct).toBeUndefined();
    }
  });

  it("leaves a forum-quote blockquote of another shape as an ordinary blockquote", () => {
    for (const src of [
      '<blockquote class="forum-quote">just text</blockquote>',
      '<blockquote class="forum-quote" onclick="x"><div class="forum-quote-author">\'\'\'A\'\'\' wrote:</div><div class="forum-quote-body">b</div></blockquote>',
      '<blockquote class="forum-quote" data-post="bad id"><div class="forum-quote-author">\'\'\'A\'\'\' wrote:</div><div class="forum-quote-body">b</div></blockquote>',
    ]) {
      const nodes = load(src);
      expect(nodes[0]).toMatchObject({ type: "blockquote" });
      expect(save(nodes)).toBe(src);
    }
  });
});

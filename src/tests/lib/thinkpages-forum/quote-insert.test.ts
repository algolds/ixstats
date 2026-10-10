import { htmlToQuoteText, quoteWikitext } from "~/components/thinkpages-forum/composer/QuoteInsert";
import { linkQuoteSources } from "~/lib/thinkpages-forum/post-html";

describe("quoteWikitext", () => {
  it("emits the importer-compatible quote block", () => {
    expect(quoteWikitext({ postId: "p1", author: "Heku", text: "Hello there" })).toBe(
      `<blockquote class="forum-quote" data-post="p1"><div class="forum-quote-author">'''Heku''' wrote:</div><div class="forum-quote-body">Hello there</div></blockquote>\n`
    );
  });

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

  it("collapses newlines in the author and in the text, so the block stays one paragraph", () => {
    const out = quoteWikitext({ postId: "p1", author: "Two\nLines", text: "one\n\ntwo\nthree" });
    expect(out).toContain("'''Two Lines'''");
    expect(out).toContain('<div class="forum-quote-body">one two three</div>');
  });

  // Taking out the `<>` (or an inner token) must not join what was around it into a new token.
  it.each([
    ["{<>{subst:x}<>}", /\{\{|\}\}/],
    ["[<>[Category:X]<>]", /\[\[|\]\]/],
    ["~~<>~ and ~<>~<>~~", /~~~/],
    ["<<>script>x<</>/script>", /[<>]/],
  ])("strips %p to a fixed point, in the text and in the author", (hostile, bad) => {
    const out = quoteWikitext({ postId: "p1", author: hostile, text: hostile });
    const author = /<div class="forum-quote-author">'''(.*)''' wrote:/.exec(out)?.[1] ?? "";
    const body = /<div class="forum-quote-body">(.*)<\/div><\/blockquote>/.exec(out)?.[1] ?? "";
    expect(author).not.toBe("");
    expect(author).not.toMatch(bad);
    expect(body).not.toMatch(bad);
  });

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

  it("is linked back to its source by the thread page", () => {
    const linked = linkQuoteSources(quoteWikitext({ postId: "p_1", author: "A", text: "t" }));
    expect(linked).toContain("forum-quote-source");
  });
});

describe("htmlToQuoteText", () => {
  it("reads a post's visible text without markup, action tokens or nested quotes", () => {
    const html =
      '<div class="mw-parser-output"><blockquote class="forum-quote"><div>Old</div></blockquote><p>Hello &amp; welcome</p><p>[ixaction=abc] Second</p></div>';
    expect(htmlToQuoteText(html)).toBe("Hello & welcome Second");
  });

  it("shortens a long post", () => {
    const text = htmlToQuoteText(`<p>${"word ".repeat(400)}</p>`);
    expect(text.length).toBeLessThanOrEqual(600);
    expect(text.endsWith("...")).toBe(true);
  });
});

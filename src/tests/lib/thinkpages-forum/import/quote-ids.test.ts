/** @jest-environment node */
import { quotedXenforoPostIds, remapQuotePostIds } from "~/lib/thinkpages-forum/import/quote-ids";

const quote = (attr: string, body = "x") =>
  `<blockquote class="forum-quote"${attr}><div class="forum-quote-body">${body}</div></blockquote>`;
const NATIVE = new Map([
  [12, "cnative12"],
  [13, "cnative13"],
]);
const nativeIdOf = (id: number) => NATIVE.get(id);

describe("quotedXenforoPostIds", () => {
  it("lists the numeric data-post ids of the blockquotes, each once", () => {
    const html = quote(' data-post="12"') + quote(' data-post="13"') + quote(' data-post="12"');
    expect(quotedXenforoPostIds(html)).toEqual([12, 13]);
  });

  it("ignores native ids, quotes without an id and data-post outside a blockquote", () => {
    const html =
      quote(' data-post="cnative12"') + quote("") + '<div data-post="99">data-post="77"</div>';
    expect(quotedXenforoPostIds(html)).toEqual([]);
  });
});

describe("remapQuotePostIds", () => {
  it("replaces a mapped XenForo id with the native post id", () => {
    expect(remapQuotePostIds(quote(' data-post="12"'), nativeIdOf, "drop")).toBe(
      quote(' data-post="cnative12"')
    );
  });

  it("drops the attribute of an unmapped id, or keeps it for a later run", () => {
    expect(remapQuotePostIds(quote(' data-post="999"'), nativeIdOf, "drop")).toBe(quote(""));
    expect(remapQuotePostIds(quote(' data-post="999"'), nativeIdOf, "keep")).toBe(
      quote(' data-post="999"')
    );
  });

  it("handles every quote of a post, nested ones included, and leaves the rest alone", () => {
    const html = `<p>a</p>${quote(' data-post="12"', quote(' data-post="13"'))}${quote(' data-post="999"')}`;
    expect(remapQuotePostIds(html, nativeIdOf, "drop")).toBe(
      `<p>a</p>${quote(' data-post="cnative12"', quote(' data-post="cnative13"'))}${quote("")}`
    );
  });

  it("is idempotent: a native id is never read as a XenForo id", () => {
    const once = remapQuotePostIds(quote(' data-post="12"'), nativeIdOf, "drop");
    expect(remapQuotePostIds(once, nativeIdOf, "drop")).toBe(once);
  });

  it("works on a data-post that is not the first attribute", () => {
    expect(
      remapQuotePostIds(
        '<blockquote data-post="13" class="forum-quote">q</blockquote>',
        nativeIdOf,
        "drop"
      )
    ).toBe('<blockquote data-post="cnative13" class="forum-quote">q</blockquote>');
  });
});

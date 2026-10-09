/** @jest-environment node */
import { withBasePath } from "~/lib/base-path";
import { hasImageSrc, rebaseRootRelativeUrls } from "~/lib/thinkpages-forum/html-urls";

const prefix = (path: string) => `/p${path}`;

describe("rebaseRootRelativeUrls", () => {
  it("rebases root-relative src and href", () => {
    expect(
      rebaseRootRelativeUrls(
        '<p><a href="/images/x">x</a><img src="/images/y" alt="y"></p>',
        prefix
      )
    ).toBe('<p><a href="/p/images/x">x</a><img src="/p/images/y" alt="y"></p>');
  });

  it("leaves absolute, protocol-relative, anchor, mailto and relative URLs alone", () => {
    const html =
      '<p><a href="https://e.com/a">a</a><img src="//cdn.e.com/b.png"><a href="#top">t</a>' +
      '<a href="mailto:a@e.com">m</a><img src="http://e.com/c.png"><a href="x/y">r</a></p>';
    expect(rebaseRootRelativeUrls(html, prefix)).toBe(html);
  });

  it("never touches text, other attributes or quoted look-alikes", () => {
    const html =
      '<p>see src="/images/x" and href="/y"</p><img alt="/images/z" title="a src=&quot;/q&quot;" src="https://e.com/i.png">';
    expect(rebaseRootRelativeUrls(html, prefix)).toBe(html);
  });

  it("rebases each attribute of a tag and keeps entities", () => {
    expect(rebaseRootRelativeUrls('<a href="/a?x=1&amp;y=2" title="t">a</a>', prefix)).toBe(
      '<a href="/p/a?x=1&amp;y=2" title="t">a</a>'
    );
  });

  describe("with withBasePath under /projects/ixstates", () => {
    const saved = { ...process.env };
    beforeEach(() => {
      process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
      delete process.env.NEXT_PUBLIC_IXWORLD_STANDALONE;
    });
    afterEach(() => {
      process.env = { ...saved };
    });

    it.each([
      ["/images/uploads/a.png", "/projects/ixstates/images/uploads/a.png"],
      [
        "/images/uploads/forum/55-abc-x.png",
        "/projects/ixstates/images/uploads/forum/55-abc-x.png",
      ],
      ["/images/downloaded/b.png", "/projects/ixstates/images/downloaded/b.png"],
      ["/projects/ixstates/images/downloaded/x.png", "/projects/ixstates/images/downloaded/x.png"],
      ["https://e.com/c.png", "https://e.com/c.png"],
      ["//host/d.png", "//host/d.png"],
    ])("src %s becomes %s", (src, expected) => {
      expect(rebaseRootRelativeUrls(`<img src="${src}" alt="">`, withBasePath)).toBe(
        `<img src="${expected}" alt="">`
      );
    });

    it("is idempotent", () => {
      const once = rebaseRootRelativeUrls(
        '<img src="/images/uploads/a.png"><a href="/thinkpages/t/1">t</a>',
        withBasePath
      );
      expect(rebaseRootRelativeUrls(once, withBasePath)).toBe(once);
    });
  });
});

describe("hasImageSrc", () => {
  it("is true only for an img with a non-empty src", () => {
    expect(hasImageSrc('<p><img src="/images/uploads/a.png" alt=""></p>')).toBe(true);
    expect(hasImageSrc('<img alt="" src="https://e.com/a.png">')).toBe(true);
    expect(hasImageSrc('<img src="" alt="">')).toBe(false);
    expect(hasImageSrc('<img src="  " alt="">')).toBe(false);
    expect(hasImageSrc("<img alt=x>")).toBe(false);
    expect(hasImageSrc('<p>&lt;img src="x"&gt;</p>')).toBe(false);
    expect(hasImageSrc("<p></p>")).toBe(false);
  });
});

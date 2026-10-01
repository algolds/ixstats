/** @jest-environment node */
// Plan 415 (F17): the srcset rewrite of `transformImages` used global replacements, so a URL that was already
// absolute got the origin put in front of it a second time ("https://ixwiki.com/imageshttps://...") and every
// high-DPR candidate was broken. The list is now rewritten one candidate at a time.
import { mapSrcsetUrls } from "~/lib/wiki-os/transformers/srcset";
import { transformImages } from "~/lib/wiki-os/transformers/html-transformer";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";

const ORIGIN = mediaWikiOrigin();
const shout = (url: string) => `<${url}>`;

describe("mapSrcsetUrls", () => {
  it.each([
    ["a.png 1x, b.png 2x", "<a.png> 1x, <b.png> 2x"],
    ["a.png 1.5x,b.png 2x", "<a.png> 1.5x,<b.png> 2x"],
    ["a.png 300w, b.png 600w", "<a.png> 300w, <b.png> 600w"],
    ["a.png", "<a.png>"],
    ["a.png,b.png", "<a.png,b.png>"],
    ["a.png, b.png", "<a.png>, <b.png>"],
    ["  a.png  1x ,  b.png 2x  ", "  <a.png>  1x ,  <b.png> 2x  "],
    ["a.png,\n b.png 2x", "<a.png>,\n <b.png> 2x"],
    ["", ""],
    ["   ", "   "],
    [",,", ",,"],
  ])("maps the URLs of %p and keeps the rest", (srcset, expected) => {
    expect(mapSrcsetUrls(srcset, shout)).toBe(expected);
  });

  it("reads a comma inside a URL as part of it (MediaWiki leaves commas in file names)", () => {
    expect(mapSrcsetUrls("/images/a/ab/Foo,_Bar.png 1x, /images/c/cd/Baz.png 2x", shout)).toBe(
      "</images/a/ab/Foo,_Bar.png> 1x, </images/c/cd/Baz.png> 2x"
    );
  });

  it("hands each URL to the mapper once, with no descriptor and no trailing comma", () => {
    const seen: string[] = [];

    mapSrcsetUrls("/a.png 1x, /b.png 2x,/c.png, /d.png 3x", (url) => {
      seen.push(url);
      return url;
    });

    expect(seen).toEqual(["/a.png", "/b.png", "/c.png", "/d.png"]);
  });
});

describe("transformImages: srcset of an IxWiki page", () => {
  const html = (srcset: string) => `<p><img src="/images/a/ab/F.png" srcset="${srcset}" width="300"></p>`;
  const srcsetOf = (out: string) => /srcset="([^"]*)"/.exec(out)?.[1];

  it("makes root-relative candidates absolute, once", () => {
    const out = transformImages(
      html("/images/thumb/a/ab/F.png/450px-F.png 1.5x, /images/thumb/a/ab/F.png/600px-F.png 2x"),
      "ixwiki"
    );

    expect(srcsetOf(out)).toBe(
      `${ORIGIN}/images/thumb/a/ab/F.png/450px-F.png 1.5x, ${ORIGIN}/images/thumb/a/ab/F.png/600px-F.png 2x`
    );
  });

  it("maps /thumb/ and /data/ like the src does", () => {
    const out = transformImages(html("/thumb/a/ab/F.png/300px-F.png 1x, /data/x.png 2x"), "ixwiki");

    expect(srcsetOf(out)).toBe(`${ORIGIN}/images/thumb/a/ab/F.png/300px-F.png 1x, ${ORIGIN}/data/x.png 2x`);
  });

  it("leaves a candidate that is already absolute exactly as it is (the bug: it was prefixed again)", () => {
    const srcset = `${ORIGIN}/images/thumb/a/ab/F.png/450px-F.png 1.5x, ${ORIGIN}/images/thumb/a/ab/F.png/600px-F.png 2x`;

    const out = transformImages(html(srcset), "ixwiki");

    expect(srcsetOf(out)).toBe(srcset);
    expect(out).not.toMatch(/images\/?https?:/);
    expect(out).not.toContain(`${ORIGIN}${ORIGIN}`);
  });

  it("is idempotent: a second pass changes nothing", () => {
    const once = transformImages(html("/images/a/ab/F.png 1x, /thumb/a/ab/F.png/600px-F.png 2x"), "ixwiki");

    expect(transformImages(once, "ixwiki")).toBe(once);
  });

  it("mixes relative and absolute candidates", () => {
    const out = transformImages(
      html(`/images/a/ab/F.png 1x, ${ORIGIN}/images/c/cd/G.png 2x, //www.ixwiki.test/ignored 3x`),
      "ixwiki"
    );

    expect(srcsetOf(out)).toBe(`${ORIGIN}/images/a/ab/F.png 1x, ${ORIGIN}/images/c/cd/G.png 2x, //www.ixwiki.test/ignored 3x`);
  });

  it("turns an http or protocol-relative spelling of the wiki's own host into its origin", () => {
    const host = new URL(ORIGIN).host;
    const out = transformImages(html(`http://${host}/images/a.png 1x, //${host}/images/b.png 2x, //www.${host}/images/c.png 3x`), "ixwiki");

    expect(srcsetOf(out)).toBe(`${ORIGIN}/images/a.png 1x, ${ORIGIN}/images/b.png 2x, ${ORIGIN}/images/c.png 3x`);
  });

  it("does not touch another host's URL, even one whose path has /images/ in it", () => {
    const srcset = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/F.png/300px-F.png 1x, https://cdn.example/images/x.png 2x";

    expect(srcsetOf(transformImages(html(srcset), "ixwiki"))).toBe(srcset);
  });
});

describe("transformImages: srcset of another wiki's page", () => {
  const html = (srcset: string) => `<p><img src="/images/a/ab/F.png" srcset="${srcset}"></p>`;
  const srcsetOf = (out: string) => /srcset="([^"]*)"/.exec(out)?.[1];

  it("routes relative and iiwiki-absolute candidates through the media proxy, once", () => {
    const out = transformImages(
      html("/images/thumb/a/ab/F.png/450px-F.png 1.5x, https://iiwiki.com/images/thumb/a/ab/F.png/600px-F.png 2x, /thumb/c/cd/G.png/300px-G.png 3x"),
      "iiwiki"
    );

    expect(srcsetOf(out)).toBe(
      "/api/mediawiki/iiwiki/images/thumb/a/ab/F.png/450px-F.png 1.5x, " +
        "/api/mediawiki/iiwiki/images/thumb/a/ab/F.png/600px-F.png 2x, " +
        "/api/mediawiki/iiwiki/images/thumb/c/cd/G.png/300px-G.png 3x"
    );
  });

  it("leaves a candidate that is already proxied, or on a CDN, alone", () => {
    const srcset = "/api/mediawiki/iiwiki/images/a/ab/F.png 1x, https://static.wikia.nocookie.net/althistory/images/a/ab/F.png 2x";

    expect(srcsetOf(transformImages(html(srcset), "althistory"))).toBe(srcset);
  });

  it("is idempotent", () => {
    const once = transformImages(html("/images/a/ab/F.png 1x, https://iiwiki.com/images/c/cd/G.png 2x"), "iiwiki");

    expect(transformImages(once, "iiwiki")).toBe(once);
  });
});

/**
 * Plan 404 review: fixEditorImageUrls rewrote URLs with regexes over HTML strings, and its
 * `<img` rule put `referrerpolicy="no-referrer"` (with quotes) inside an attribute value that
 * contained `<img`, which ended that attribute early and turned the rest of it into real
 * attributes. It works on the DOM now.
 */
import { fixEditorImageUrls } from "~/lib/wiki-os/transformers/fix-editor-images";
import { getWikiBaseUrl } from "~/lib/wiki-os/config";

const origin = getWikiBaseUrl("ixwiki");

function mount(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

describe("fixEditorImageUrls", () => {
  it("returns an empty string for nothing and HTML without asset paths untouched", () => {
    expect(fixEditorImageUrls("")).toBe("");
    const plain = '<p class="x">Plain &amp; <a href="/wiki/Foo">simple</a></p>';
    expect(fixEditorImageUrls(plain)).toBe(plain);
  });

  it("makes relative src, srcset, css url() and stylesheet hrefs absolute", () => {
    const out = mount(
      fixEditorImageUrls(
        '<img src="/images/a.png" srcset="/images/a.png 1x, /images/a2.png 2x, https://cdn.example/images/x.png 3x">' +
          '<video src="/data/clip.webm"></video><img src="/wiki/Special:FilePath/B.png">' +
          '<div style="background:url(/images/bg.png) no-repeat"></div>' +
          '<link rel="stylesheet" href="/load.php?m=x"><a href="/wiki/Foo">keep</a>'
      )
    );

    const [first, second] = Array.from(out.querySelectorAll("img"));
    expect(first?.getAttribute("src")).toBe(`${origin}/images/a.png`);
    expect(first?.getAttribute("srcset")).toBe(
      `${origin}/images/a.png 1x, ${origin}/images/a2.png 2x, https://cdn.example/images/x.png 3x`
    );
    expect(second?.getAttribute("src")).toBe(`${origin}/wiki/Special:FilePath/B.png`);
    expect(out.querySelector("video")?.getAttribute("src")).toBe(`${origin}/data/clip.webm`);
    expect(out.querySelector("div")?.getAttribute("style")).toBe(
      `background:url("${origin}/images/bg.png") no-repeat`
    );
    expect(out.querySelector("link")?.getAttribute("href")).toBe(`${origin}/load.php?m=x`);
    expect(out.querySelector("a")?.getAttribute("href")).toBe("/wiki/Foo");
  });

  it("rewrites css url() inside a style element too", () => {
    const out = mount(
      fixEditorImageUrls("<style>.x{background:url('/data/bg.png')}</style><p>x</p>")
    );

    expect(out.querySelector("style")?.textContent).toBe(
      `.x{background:url("${origin}/data/bg.png")}`
    );
  });

  it("adds no-referrer to every image that has no referrer policy, and leaves one that has", () => {
    const out = mount(
      fixEditorImageUrls('<img src="a.png"><img src="b.png" referrerpolicy="origin">')
    );

    expect(
      Array.from(out.querySelectorAll("img")).map((i) => i.getAttribute("referrerpolicy"))
    ).toEqual(["no-referrer", "origin"]);
  });

  it("keeps the Parsoid metadata attributes", () => {
    const out = mount(
      fixEditorImageUrls(
        '<div typeof="mw:Transclusion" data-mw=\'{"parts":[{"template":{}}]}\'><img src="/images/a.png"></div>'
      )
    );

    expect(out.querySelector("div")?.getAttribute("data-mw")).toBe('{"parts":[{"template":{}}]}');
    expect(out.querySelector("div")?.getAttribute("typeof")).toBe("mw:Transclusion");
  });

  it("does not turn text inside an attribute value into attributes (the same class of bug)", () => {
    const out = mount(
      fixEditorImageUrls(
        '<span title="<img src=x onerror=alert(1) x=">hover</span><img src="/images/a.png">'
      )
    );

    expect(out.querySelectorAll("[onerror]")).toHaveLength(0);
    expect(out.querySelectorAll("img")).toHaveLength(1);
    expect(out.querySelector("span")?.getAttribute("title")).toBe("<img src=x onerror=alert(1) x=");
    expect(out.querySelector("span")?.attributes).toHaveLength(1);
  });

  it("does not load or run anything while it parses", () => {
    const before = document.querySelectorAll("img").length;

    fixEditorImageUrls('<img src="/images/a.png" onerror="alert(1)">');

    expect(document.querySelectorAll("img")).toHaveLength(before);
  });
});

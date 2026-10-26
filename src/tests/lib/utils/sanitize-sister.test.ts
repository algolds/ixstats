/** @jest-environment node */
/**
 * sanitizeSisterHtml: the trust boundary for HTML another wiki (IIWiki, AltHistory) rendered. Whatever that wiki's
 * editors wrote, a reader's browser runs no script from it, loads nothing from another host (images only through the
 * wiki's media proxy, a Fandom CDN file as Special:FilePath of its name), and no element of it can cover the page
 * (no fixed or sticky positioning, in a style or a class). Its external links are inert (noopener noreferrer
 * nofollow, no target). An embed also loses its `<style>` and every `id`.
 */
import { describe, expect, it } from "@jest/globals";
import { JSDOM } from "jsdom";
import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { sanitizeSisterHtml } from "~/lib/utils/sanitize-sister-html";

const reader = (html: string, wiki: "iiwiki" | "althistory" = "iiwiki") =>
  sanitizeSisterHtml(html, wiki, { embed: false });
const embed = (html: string, wiki: "iiwiki" | "althistory" = "iiwiki") =>
  sanitizeSisterHtml(html, wiki, { embed: true });

/** The sanitized HTML as a DOM, to ask what is in it. */
const dom = (html: string) => JSDOM.fragment(`<div>${html}</div>`).firstElementChild as Element;

/** Every URL a browser could fetch from `html`: src, srcset candidates, href of non-links and url() in CSS. */
function loadedUrls(html: string): string[] {
  const root = dom(html);
  const urls: string[] = [];
  for (const el of Array.from(root.querySelectorAll("*"))) {
    for (const name of [
      "src",
      "poster",
      "background",
      "data",
      "xlink:href",
      "action",
      "formaction",
    ]) {
      const value = el.getAttribute(name);
      if (value !== null) urls.push(value);
    }
    const srcset = el.getAttribute("srcset");
    if (srcset) urls.push(...srcset.split(",").map((c) => c.trim().split(/\s+/)[0] ?? ""));
    if (el.tagName !== "A" && el.hasAttribute("href")) urls.push(el.getAttribute("href") ?? "");
  }
  for (const match of html.matchAll(/url\(\s*["']?([^"')\s]*)/gi)) urls.push(match[1] ?? "");
  return urls;
}

const PROXY = "/api/mediawiki/iiwiki/";
const offHost = (html: string) => loadedUrls(html).filter((url) => !url.startsWith(PROXY));

describe("sanitizeSisterHtml: script and active content", () => {
  it("a script, an event handler, a javascript: link, an iframe, a form and an svg are removed", () => {
    const out = reader(
      '<p onclick="alert(1)">Text<script>alert(2)</script></p>' +
        '<a href="javascript:alert(3)">x</a>' +
        '<iframe src="https://evil.test/"></iframe>' +
        '<form action="https://evil.test/"><input name="q"><button formaction="https://evil.test/">go</button></form>' +
        '<svg><script>alert(4)</script><image xlink:href="https://evil.test/a.png"/></svg>'
    );
    const root = dom(out);
    expect(root.querySelector("script, iframe, form, input, button, svg, image")).toBeNull();
    expect(out).not.toMatch(/onclick|alert|javascript:|evil\.test/i);
    expect(root.textContent).toContain("Text");
  });

  it("an object, an embed, a meta refresh, a base and a link are removed", () => {
    const out = reader(
      '<object data="https://evil.test/x.swf"></object><embed src="https://evil.test/x.swf">' +
        '<meta http-equiv="refresh" content="0;url=https://evil.test/"><base href="https://evil.test/">' +
        '<link rel="stylesheet" href="https://evil.test/x.css"><p>kept</p>'
    );
    expect(dom(out).querySelector("object, embed, meta, base, link")).toBeNull();
    expect(out).not.toContain("evil.test");
    expect(out).toContain("<p>kept</p>");
  });

  it("a data: link, an event handler of any name and a srcdoc are removed", () => {
    const out = reader(
      '<a href="data:text/html,<script>alert(1)</script>">d</a>' +
        '<details open ontoggle="alert(1)"><summary onmouseenter="alert(2)">s</summary></details>' +
        '<img src="/images/a/ab/A.png" onerror="alert(3)" srcdoc="<b>x</b>">'
    );
    expect(out).not.toMatch(/data:|ontoggle|onmouseenter|onerror|srcdoc|alert/);
  });
});

describe("sanitizeSisterHtml: images", () => {
  it("an image on another host is removed; one on the wiki's own host goes through its media proxy", () => {
    const out = reader(
      '<p><img src="https://evil.test/track.gif" alt="t"><img src="//evil.test/b.gif">' +
        '<img src="https://iiwiki.com/images/a/ab/Flag.png" alt="flag"></p>'
    );
    const images = Array.from(dom(out).querySelectorAll("img"));
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      "/api/mediawiki/iiwiki/images/a/ab/Flag.png",
    ]);
    expect(images[0]!.getAttribute("alt")).toBe("flag");
  });

  it("an image with no source, an empty one or a data: one is removed", () => {
    const out = reader(
      '<img alt="a"><img src="" alt="b"><img src="data:image/gif;base64,R0lGOD" alt="c">'
    );
    expect(dom(out).querySelector("img")).toBeNull();
  });

  it("a lazy Fandom image's data-src is used, through the proxy", () => {
    const out = reader(
      '<img src="data:image/gif;base64,R0lGODlhAQABAIABAAAAAP///yH5BAEAAAEALAAAAAABAAEAQAICTAEAOw%3D%3D" ' +
        'data-src="https://static.wikia.nocookie.net/althistory/images/a/ab/Flag.png/revision/latest?cb=1" ' +
        'data-srcset="https://static.wikia.nocookie.net/althistory/images/a/ab/Flag.png/revision/latest 2x" ' +
        'class="lazyload" alt="flag">',
      "althistory"
    );
    const img = dom(out).querySelector("img");
    expect(img?.getAttribute("src")).toBe(
      "/api/mediawiki/althistory/wiki/Special:FilePath/Flag.png"
    );
    expect(img?.getAttribute("srcset")).toBe(
      "/api/mediawiki/althistory/wiki/Special:FilePath/Flag.png 2x"
    );
    expect(img?.hasAttribute("data-src")).toBe(false);
    expect(img?.hasAttribute("data-srcset")).toBe(false);
  });

  it("a data-src never replaces a real source, and is dropped from any element", () => {
    const out = reader(
      '<img src="/images/a/ab/A.png" data-src="https://iiwiki.com/images/b/bc/B.png">' +
        '<div data-src="https://evil.test/x.png" data-srcset="https://evil.test/x.png 2x">d</div>'
    );
    const root = dom(out);
    expect(root.querySelector("img")?.getAttribute("src")).toBe(
      "/api/mediawiki/iiwiki/images/a/ab/A.png"
    );
    expect(out).not.toMatch(/data-src|evil\.test/);
  });

  it("an empty source gives way to data-src too", () => {
    const out = reader('<img src="" data-src="/images/a/ab/A.png" alt="a">');
    expect(dom(out).querySelector("img")?.getAttribute("src")).toBe(
      "/api/mediawiki/iiwiki/images/a/ab/A.png"
    );
  });

  it("a lazy image whose data-src is on another host is removed", () => {
    const out = reader('<img src="" data-src="https://evil.test/x.png" alt="x">');
    expect(dom(out).querySelector("img")).toBeNull();
  });

  it("srcset keeps only proxied candidates", () => {
    const out = reader(
      '<img src="/images/a/ab/A.png" srcset="https://evil.test/a.png 1.5x, /images/a/ab/A2.png 2x , //iiwiki.com/images/a/ab/A3.png 3x">' +
        '<img src="/images/b/bc/B.png" srcset="https://evil.test/b.png 2x">'
    );
    const [first, second] = Array.from(dom(out).querySelectorAll("img"));
    expect(first!.getAttribute("srcset")).toBe(
      "/api/mediawiki/iiwiki/images/a/ab/A2.png 2x, /api/mediawiki/iiwiki/images/a/ab/A3.png 3x"
    );
    expect(second!.hasAttribute("srcset")).toBe(false);
  });

  it("a picture's source, a video poster and an audio source never load from another host", () => {
    const out = reader(
      '<picture><source srcset="https://evil.test/a.webp"><img src="/images/a/ab/A.png"></picture>' +
        '<video poster="https://evil.test/p.png" src="https://evil.test/v.mp4"><source src="https://evil.test/v.webm"></video>' +
        '<audio src="https://evil.test/a.mp3"></audio><table background="https://evil.test/bg.png"><tr><td background="//evil.test/x">c</td></tr></table>'
    );
    expect(offHost(out)).toEqual([]);
    expect(out).not.toContain("evil.test");
  });
});

describe("sanitizeSisterHtml: styles", () => {
  it("a style with url() to another host, expression() or position: fixed loses that declaration and keeps the rest", () => {
    const out = reader(
      '<div style="color: red; background: url(//evil.test/a.png); width: 10px">a</div>' +
        '<div style="width: expression(alert(1)); margin: 2px">b</div>' +
        '<div style="position: fixed; inset: 0; z-index: 9999; padding: 1px">c</div>' +
        '<div style="position:sticky;top:0">d</div>' +
        '<div style="position: -webkit-sticky; color: blue">e</div>' +
        '<div style="background-image: url(/api/mediawiki/iiwiki/images/a/ab/Bg.png); position: relative">f</div>' +
        '<div style="position: absolute !important; top: 0">g</div>'
    );
    const styles = Array.from(dom(out).querySelectorAll("div")).map((d) => d.getAttribute("style"));
    expect(styles[0]).toMatch(/^color: ?red; ?width: ?10px$/);
    expect(styles[1]).toMatch(/^margin: ?2px$/);
    expect(styles[2]).not.toMatch(/position/);
    expect(styles[2]).toMatch(/padding: ?1px/);
    expect(styles[3] ?? "").not.toMatch(/position|sticky/);
    expect(styles[4]).toMatch(/^color: ?blue$/);
    expect(styles[5]).toContain("url(/api/mediawiki/iiwiki/images/a/ab/Bg.png)");
    expect(styles[5]).toMatch(/position: ?relative/);
    expect(styles[6]).toMatch(/^position: ?absolute !important; ?top: ?0$/);
    expect(out).not.toMatch(/evil|expression|fixed|sticky/);
  });

  it("behavior, -moz-binding, image-set(), @import and a url spelled with escapes or comments are dropped", () => {
    const out = reader(
      '<div style="behavior: url(x.htc); color: red">a</div>' +
        '<div style="-moz-binding: url(//evil.test/x.xml#x); color: red">b</div>' +
        '<div style="background-image: image-set(&quot;//evil.test/a.png&quot; 1x); color: red">c</div>' +
        '<div style="@import url(//evil.test/x.css); color: red">d</div>' +
        '<div style="background: \\75 rl(//evil.test/a.png); color: red">e</div>' +
        '<div style="position:/**/fixed; color: red">f</div>' +
        '<div style="POSITION: FIXED !important; color: red">g</div>' +
        '<div style="--p: fixed; position: var(--p); color: red">h</div>' +
        '<div style="--q: STICKY !important; --r: -webkit-sticky; --c: blue; color: red">i</div>' +
        '<div style="table-layout: fixed; color: red">j</div>'
    );
    // a property that is not a position keeps a value that happens to read `fixed`
    expect(out).toContain("table-layout: fixed");
    expect(out.replace("table-layout: fixed", "")).not.toMatch(
      /evil|behavior|binding|image-set|@import|position|var\(|\\75|fixed|sticky|--[pqr]/i
    );
    expect(out).toMatch(/--c: ?blue/);
    for (const div of Array.from(dom(out).querySelectorAll("div"))) {
      expect(div.getAttribute("style")).toMatch(/color: ?red/);
    }
  });

  it("a style that cannot be read with certainty, or is too long to read, is dropped whole", () => {
    const out = reader('<div style="color: red; content: &quot;x; position: fixed">a</div>');
    expect(dom(out).querySelector("div")?.hasAttribute("style")).toBe(false);
    const long = reader(`<div style="${"color: red;".repeat(20_000)}">a</div>`);
    expect(dom(long).querySelector("div")?.hasAttribute("style")).toBe(false);
  });

  it("the classes that position an element over the page are removed; the wiki's own stay", () => {
    const out = reader('<div class="infobox fixed inset-0 z-50 sticky md:fixed wikitable">x</div>');
    expect(dom(out).querySelector("div")?.getAttribute("class")).toBe("infobox wikitable");
  });

  it("the app's own classes are removed: a sister page cannot borrow a fixed popover or a viewport-sized utility", () => {
    const out = reader(
      '<div class="wikios-annotation-popover hover:facet-glow" style="top:0;left:0;width:100vw;height:100vh;z-index:99999">o</div>' +
        '<div class="facet-sheet h-screen w-screen md:w-dvw !h-dvh min-h-screen max-h-svh size-lvh cl-modal forum-post navbox">n</div>' +
        '<a class="new wikios-redlink" href="/wiki/X?source=iiwiki">r</a>' +
        '<span class="mw-editsection wikios-edit-section">e</span>' +
        '<div class="infobox thumb tright gallery mw-file-element wikitable sortable hlist flagicon">k</div>' +
        '<div class="fixed inset-0">f</div>'
    );
    const [popover, utilities] = Array.from(dom(out).querySelectorAll("div"));
    expect(popover!.hasAttribute("class")).toBe(false);
    expect(utilities!.getAttribute("class")).toBe("navbox");
    expect(dom(out).querySelector("a")?.getAttribute("class")).toBe("new wikios-redlink");
    expect(dom(out).querySelector("span")?.getAttribute("class")).toBe(
      "mw-editsection wikios-edit-section"
    );
    expect(dom(out).querySelectorAll("div")[3]!.hasAttribute("class")).toBe(false);
    expect(dom(out).querySelectorAll("div")[2]!.getAttribute("class")).toBe(
      "infobox thumb tright gallery mw-file-element wikitable sortable hlist flagicon"
    );
  });

  it("only the wiki's own data attributes stay: none can switch on the app's page-wide styles", () => {
    const out = reader(
      '<div data-maps-page="1" data-shell-page-header data-slot="sidebar" data-app="maps" data-theme="dark">a</div>' +
        '<span data-wikiembed="1" data-source="iiwiki" data-title="X" data-image-name="A.png" data-image-key="A.png" data-relevant="1">b</span>' +
        '<table class="sortable"><tr><td data-sort-value="10" data-sort-type="number">ten</td></tr></table>'
    );
    expect(out).not.toMatch(/data-(?!sort-)/);
    const cell = dom(out).querySelector("td");
    expect(cell?.getAttribute("data-sort-value")).toBe("10");
    expect(cell?.getAttribute("data-sort-type")).toBe("number");
  });

  it("a TemplateStyles block keeps no off-host url() and no fixed position", () => {
    const out = reader(
      '<style data-mw-deduplicate="TemplateStyles:r1">.box{color:red;background:url(https://evil.test/a.png)}' +
        ".cover{position:fixed;inset:0}@import url(//evil.test/x.css);.ok{background:url(/api/mediawiki/iiwiki/images/a/ab/B.png)}</style><p>x</p>"
    );
    const css = dom(out).querySelector("style")?.textContent ?? "";
    expect(css).toContain(".mw-parser-output .box{color:red}");
    expect(css).toContain("url(/api/mediawiki/iiwiki/images/a/ab/B.png)");
    expect(css).not.toMatch(/evil|fixed|@import/);
  });
});

describe("sanitizeSisterHtml: links", () => {
  it("external links get noopener noreferrer nofollow and no target", () => {
    const out = reader(
      '<a href="https://evil.test/" target="_blank" rel="opener">e</a>' +
        '<a href="//evil.test/x" target="_top">p</a>' +
        '<a href="https://iiwiki.com/wiki/Eurth" target="_self">i</a>' +
        '<a href="/wiki/Eurth?source=iiwiki" target="_self">r</a><a href="#cite_note-1">n</a>'
    );
    const links = Array.from(dom(out).querySelectorAll("a"));
    for (const link of links.slice(0, 3)) {
      expect(link.getAttribute("rel")).toBe("noopener noreferrer nofollow");
      expect(link.hasAttribute("target")).toBe(false);
    }
    expect(links[3]!.hasAttribute("rel")).toBe(false);
    expect(links[3]!.getAttribute("target")).toBe("_self");
    expect(links[4]!.hasAttribute("rel")).toBe(false);
  });

  it("a link written to read as a path but resolving to another host is external too", () => {
    const out = reader('<a href="/\\evil.test/x">b</a>');
    expect(dom(out).querySelector("a")?.getAttribute("rel")).toBe("noopener noreferrer nofollow");
  });
});

describe("sanitizeSisterHtml: ids", () => {
  it("a reader page's ids are prefixed, and the fragment links and id references that name them follow", () => {
    const out = reader(
      '<div id="__next"><h2 id="History">History</h2><sup><a href="#cite_note-1">[1]</a></sup>' +
        '<table><tr><th id="h1">H</th><td headers="h1 h2" aria-describedby="cite_note-1">c</td></tr></table>' +
        '<a href="/wiki/Eurth?source=iiwiki#History">elsewhere</a><a href="#">top</a></div>'
    );
    const root = dom(out);
    expect(root.querySelector("#__next")).toBeNull();
    expect(root.querySelector("div")?.id).toBe("sister-__next");
    expect(root.querySelector("h2")?.id).toBe("sister-History");
    const links = Array.from(root.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).toEqual(["#sister-cite_note-1", "/wiki/Eurth?source=iiwiki#History", "#"]);
    const cell = root.querySelector("td");
    expect(cell?.getAttribute("headers")).toBe("sister-h1 sister-h2");
    expect(cell?.getAttribute("aria-describedby")).toBe("sister-cite_note-1");
  });
});

describe("sanitizeSisterHtml: embeds and reader pages", () => {
  const STYLED =
    '<style data-mw-deduplicate="TemplateStyles:r9">.box{color:red}</style>' +
    '<div id="top" class="box"><h2 id="History">History</h2><span id="cite_note-1">n</span></div>';

  it("an embed has no style element and no id; a reader page keeps its scoped TemplateStyles", () => {
    const embedded = dom(embed(STYLED));
    expect(embedded.querySelector("style")).toBeNull();
    expect(embedded.querySelector("[id]")).toBeNull();
    expect(embedded.querySelector("h2")?.textContent).toBe("History");

    const page = dom(reader(STYLED));
    expect(page.querySelector("style")?.textContent).toBe(".mw-parser-output .box{color:red}");
    expect(page.querySelector("h2")?.id).toBe("sister-History");
  });

  it("nesting past the ceiling is shown as its escaped source, as for an article", () => {
    const deep = "<div>".repeat(500) + "<img src=//evil.test/x>" + "</div>".repeat(500);
    const out = reader(deep);
    expect(out.startsWith('<pre class="wikios-fallback-plain">')).toBe(true);
    expect(dom(out).querySelector("img, div")).toBeNull();
  });

  it("an empty page is empty", () => {
    expect(reader("")).toBe("");
  });

  it("leaves IxWiki's article sanitizer as it was: an off-host image and a fixed style stay there", () => {
    const html =
      '<img src="https://upload.wikimedia.org/a.png"><div style="position: fixed">x</div>';
    const out = sanitizeWikiArticleHtml(html);
    expect(out).toContain('src="https://upload.wikimedia.org/a.png"');
    expect(out).toContain("position: fixed");
  });
});

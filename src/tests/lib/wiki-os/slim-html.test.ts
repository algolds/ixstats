/** @jest-environment node */
/**
 * Plan 413 (item 8b): the view bundle's HTML loses its dead weight at render time, and only that.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { UNUSED_MEDIAWIKI_CLASSES, slimArticleHtml } from "~/lib/wiki-os/transformers/slim-html";
import { buildViewBundle } from "~/lib/wiki-os/services/render-service";
import { chipKeysIn, chipMarker } from "~/lib/wiki-os/templates/chip-markers";

describe("slimArticleHtml", () => {
  it("drops a link's title only when it repeats the link's own text", () => {
    const out = slimArticleHtml(
      '<p><a href="/wiki/Foo" title="Foo">Foo</a> <a href="/wiki/Foo" title="Foo">the foo</a> ' +
        '<a href="/wiki/Bar" title="Bar"><b>Bar</b></a> <abbr title="Abbr">Abbr</abbr></p>'
    );

    expect(out).toContain('<a href="/wiki/Foo">Foo</a>');
    expect(out).toContain('<a href="/wiki/Foo" title="Foo">the foo</a>');
    expect(out).toContain('<a href="/wiki/Bar"><b>Bar</b></a>');
    expect(out).toContain('<abbr title="Abbr">Abbr</abbr>'); // only links
  });

  it("drops classes nobody styles, keeps the others, and the attribute when none is left", () => {
    const out = slimArticleHtml(
      '<a class="mw-redirect extiw" href="/wiki/A">A</a>' +
        '<a class="mw-redirect" href="/wiki/B">B</a>' +
        '<div class="infobox mergedrow">x</div>'
    );

    expect(out).toContain('<a href="/wiki/A">A</a>'.replace("<a ", "<a ").replace("href", "href"));
    expect(out).toContain('<a href="/wiki/B">B</a>');
    expect(out).toContain('<div class="infobox">x</div>');
  });

  it("every class it drops is one no stylesheet and no code in src refers to", () => {
    const root = process.cwd();
    const text: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(root, dir))) {
        const path = `${dir}/${name}`;
        if (path.startsWith("src/tests") || path === "src/lib/wiki-os/transformers/slim-html.ts")
          continue;
        if (statSync(join(root, path)).isDirectory()) walk(path);
        else if (/\.(css|tsx?)$/.test(name)) text.push(readFileSync(join(root, path), "utf8"));
      }
    };
    walk("src");
    const everything = text.join("\n");

    const referenced = [...UNUSED_MEDIAWIKI_CLASSES].filter((name) =>
      new RegExp(`(?<![\\w-])${name.replace(/-/g, "\\-")}(?![\\w-])`).test(everything)
    );

    expect(referenced).toEqual([]);
  });

  it("removes empty class, style and title attributes, and leaves empty alt alone", () => {
    const out = slimArticleHtml('<p class="" style=" " title="">x</p><img alt="" src="/a.png">');
    expect(out).toBe('<p>x</p><img alt="" src="/a.png">');
  });

  it("removes whitespace between blocks and in tables and lists, never between inline elements", () => {
    const out = slimArticleHtml(
      "<div>\n  <p>a</p>\n  <p>b</p>\n</div>\n" +
        "<ul>\n  <li>one</li>\n  <li>two</li>\n</ul>\n" +
        "<table>\n <tbody>\n  <tr>\n   <td>x</td>\n   <td>y</td>\n  </tr>\n </tbody>\n</table>\n" +
        "<p><b>bold</b> <i>italic</i> <span> </span><a href='/wiki/X'>x</a></p>"
    );

    expect(out).toContain("<div><p>a</p><p>b</p></div>");
    expect(out).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(out).toContain("<table><tbody><tr><td>x</td><td>y</td></tr></tbody></table>");
    // the spaces between words survive
    expect(out).toContain("<p><b>bold</b> <i>italic</i> <span> </span>");
  });

  it("keeps whitespace in <pre> and where the author asked for it", () => {
    const out = slimArticleHtml(
      '<div><pre>\n  <b>a</b>\n  <b>b</b>\n</pre></div><div style="white-space:pre-wrap"><p>a</p>\n<p>b</p></div>'
    );

    // (the parser itself drops the newline that follows <pre>)
    expect(out).toContain("<pre>  <b>a</b>\n  <b>b</b>\n</pre>");
    expect(out).toContain('<div style="white-space:pre-wrap"><p>a</p>\n<p>b</p></div>');
  });

  it("is idempotent, changes nothing else, and leaves a chip marker byte for byte", () => {
    const marker = chipMarker("MyCountry:gdp");
    const html = `<p>GDP ${marker} <a href="/wiki/Foo" title="Foo">Foo</a> &amp; more<br>text</p>`;

    const once = slimArticleHtml(html);

    expect(once).toContain(marker);
    expect(chipKeysIn(once)).toEqual(["MyCountry:gdp"]);
    expect(once).toBe(`<p>GDP ${marker} <a href="/wiki/Foo">Foo</a> &amp; more<br>text</p>`);
    expect(slimArticleHtml(once)).toBe(once);
    expect(slimArticleHtml("")).toBe("");
  });
});

describe("the view bundle", () => {
  it("is built from slimmed HTML: body, infobox and notices", () => {
    const raw =
      '<div class="mw-parser-output">' +
      '<table class="infobox"><tbody><tr><td><a class="mw-redirect" href="/wiki/Eurth" title="Eurth">Eurth</a></td></tr></tbody></table>\n' +
      '<div class="mw-heading mw-heading2"><h2 id="History">History</h2></div>\n' +
      '<p>Text <a href="/wiki/Urcea" title="Urcea">Urcea</a>.</p>\n</div>';

    const bundle = buildViewBundle(raw);

    expect(bundle.infoboxHtml).toContain('<a href="/wiki/Eurth">Eurth</a>');
    expect(bundle.bodyHtml).toContain(
      '<div class="mw-heading"><h2 id="History">History</h2></div>'
    );
    expect(bundle.bodyHtml).toContain('<a href="/wiki/Urcea">Urcea</a>');
    expect(bundle.bodyHtml).not.toMatch(/>\s+</);
  });
});

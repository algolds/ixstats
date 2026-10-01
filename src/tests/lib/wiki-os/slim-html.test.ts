/** @jest-environment node */
/**
 * Plan 413 (item 8b): the view bundle's HTML loses its dead weight at render time, and only that.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  UNUSED_MEDIAWIKI_CLASSES,
  slimArticleHtml,
  templateStyleIdentifiers,
} from "~/lib/wiki-os/transformers/slim-html";
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

  it("keeps a no-break space: an &nbsp; spacer is content, not collapsible whitespace", () => {
    const spacer = '<div style="float:right;width:6em;height:2.6em">&nbsp;</div>';
    const out = slimArticleHtml(`<div>${spacer}<p>a</p>&nbsp;<p>b</p>\u00a0\u2003</div>`);

    expect(out).toContain(spacer);
    // between blocks too, and the other Unicode spaces (em space) that String.trim also strips
    expect(out).toContain("<p>a</p>&nbsp;<p>b</p>&nbsp;\u2003");
    // …while a plain run of space, tab, newline, CR and form feed is still removed
    expect(slimArticleHtml("<div>\n\t \r\f<p>a</p> \n <p>b</p></div>")).toBe(
      "<div><p>a</p><p>b</p></div>"
    );
  });

  it("keeps the space beside a block laid out inline by its style", () => {
    const out = slimArticleHtml(
      '<div><div style="display:inline-block">a</div> <div style="display: inline-block">b</div>' +
        ' <p style="display:inline">c</p> <p>d</p></div>'
    );

    // inline-block siblings keep the gap between them, and so does the one before the inline <p>
    expect(out).toContain(
      '<div style="display:inline-block">a</div> <div style="display: inline-block">b</div>' +
        ' <p style="display:inline">c</p>'
    );
    // a plain block next to the inline one: that space is still next to an inline sibling, so it stays
    expect(out).toContain("</p> <p>d</p>");
    // two ordinary blocks lose theirs
    expect(slimArticleHtml("<div><p>x</p> <p>y</p></div>")).toBe("<div><p>x</p><p>y</p></div>");
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

describe("classes a kept TemplateStyles block styles (plan 415 review, m3)", () => {
  const STYLE = (css: string) => `<style data-mw-deduplicate="TemplateStyles:r1">${css}</style>`;

  it("stay, though MediaWiki's own markup carries them everywhere and WikiOS styles none of them", () => {
    const out = slimArticleHtml(
      STYLE(".mw-parser-output .infobox-caption{font-weight:bold}.mw-parser-output .plainlinks a{color:red}") +
        '<div class="infobox-caption">cap</div><div class="plainlinks mw-redirect"><a href="/wiki/X">x</a></div>'
    );

    expect(out).toContain('<div class="infobox-caption">cap</div>');
    // only the class the sheet names is kept; the one it does not name is still dead weight
    expect(out).toContain('<div class="plainlinks"><a href="/wiki/X">x</a></div>');
  });

  it("are dropped as before when no sheet names them, or when the style is not TemplateStyles'", () => {
    expect(slimArticleHtml('<div class="infobox-caption treeview">x</div>')).toBe("<div>x</div>");
    expect(slimArticleHtml(`<style>.infobox-caption{color:red}</style><div class="infobox-caption">x</div>`)).toBe(
      '<style>.infobox-caption{color:red}</style><div>x</div>'
    );
    expect(
      slimArticleHtml(STYLE(".mw-parser-output .other{color:red}") + '<div class="infobox-caption other">x</div>')
    ).toContain('<div class="other">x</div>');
  });

  it("are found however the sheet names them: escapes, :is(), an attribute selector", () => {
    const out = slimArticleHtml(
      STYLE(".mw-parser-output .plain\\6c inks{a:b}.mw-parser-output :is(.treeview, .nv-view){a:b}.mw-parser-output [class~=infobox-below]{a:b}") +
        '<div class="plainlinks">a</div><div class="treeview">b</div><div class="nv-view">c</div><div class="infobox-below">d</div><div class="nv-edit">e</div>'
    );

    for (const kept of ["plainlinks", "treeview", "nv-view", "infobox-below"]) expect(out).toContain(`class="${kept}"`);
    expect(out).not.toContain("nv-edit");
  });

  it("stay in another part of the page than the sheet: the body's sheet styles the infobox", () => {
    const raw =
      '<div class="mw-parser-output">' +
      '<style data-mw-deduplicate="TemplateStyles:r1">.mw-parser-output .infobox-caption{font-weight:bold}</style>' +
      '<table class="infobox"><tbody><tr><td><div class="infobox-caption">Caption</div></td></tr></tbody></table>' +
      '<p>Body <span class="plainlinks">text</span></p></div>';

    const bundle = buildViewBundle(raw);

    expect(bundle.infoboxHtml).toContain('class="infobox-caption"');
    expect(bundle.bodyHtml).toContain("<span>text</span>"); // plainlinks is named by no sheet
  });

  it("templateStyleIdentifiers reads TemplateStyles blocks only, in one pass", () => {
    expect(
      [
        ...templateStyleIdentifiers(
          `${STYLE(".a-b .c{x:y}")}<style>.not-this{x:y}</style>`,
          `<p>x</p>${STYLE(".d{x:y}")}`
        ),
      ].sort()
    ).toEqual(["a-b", "c", "d", "x", "y"]);
    // a block that never closes ends the search; many of them cost no more than their length
    const hostile = '<style data-mw-deduplicate="x">'.repeat(20_000);
    const started = performance.now();
    expect(templateStyleIdentifiers(hostile).size).toBe(0);
    expect(performance.now() - started).toBeLessThan(250);
  });
});

/** @jest-environment node */
/**
 * The renderer's corpus: realistic snippets of what WikiOS renders (MediaWiki's HTML of an IxWiki article and of a
 * sister wiki's page, the wikitext the fallback compiler draws) run through the real transform, slimming, chip marking,
 * view bundle and page facts, and what each one must come out as: one row per behaviour.
 *
 * Replaces html-transformer-redlinks (plan 415 F16), source-links (ruling E-l), srcset-transform (plan 415 F17: an
 * absolute candidate was prefixed again), lcp-images (plan 413), slim-html (plan 413, plan 415 m3), legacy-profile-links,
 * article-seo (plan 412), chip-markers (plan 404 review) and wikitext-html-parser.
 */
import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
import { transformArticleHtml, transformImages } from "~/lib/wiki-os/transformers/html-transformer";
import { mapSrcsetUrls } from "~/lib/wiki-os/transformers/srcset";
import { slimArticleHtml, templateStyleIdentifiers } from "~/lib/wiki-os/transformers/slim-html";
import { buildViewBundle } from "~/lib/wiki-os/services/render-service";
import { HERO_IMAGE_WIDTH, extractLeadImage, extractLeadImageFromHtml, heroImage } from "~/lib/wiki-os/transformers/image-url";
import { currentProfileHref, currentProfileLinks } from "~/lib/wiki-os/legacy-profile-links";
import { articleSeo, descriptionFromHtml, leadImageUrl } from "~/lib/wiki-os/article-seo";
import {
  chipKeysIn,
  chipMarker,
  isMarkableKey,
  markTemplateChips,
  substituteChipMarkers,
  templateKeysOf,
} from "~/lib/wiki-os/templates/chip-markers";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { proxiedFileUrl } from "~/lib/realms/sources/wiki-file-info";
import { IIWIKI_EXCERPT } from "~/tests/fixtures/cards/iiwiki-excerpt";

const ORIGIN = mediaWikiOrigin();
const HOST = new URL(ORIGIN).host;
type Part = "content" | "infobox" | "notices";
/** `[part, "+" contains | "-" lacks, text]`. */
type Expectation = [Part, "+" | "-", string];

const parts = (out: ReturnType<typeof transformArticleHtml>): Record<Part, string> => ({
  content: out.contentHtml,
  infobox: out.infoboxHtml ?? "",
  notices: out.noticesHtml ?? "",
});

function check(out: Record<Part, string>, expectations: Expectation[]) {
  for (const [part, sign, text] of expectations) {
    if (sign === "+") expect(out[part]).toContain(text);
    else expect(out[part]).not.toContain(text);
  }
}

const redLink = (title: string, label = title.replace(/_/g, " ")) =>
  `<a href="/index.php?title=${title}&amp;action=edit&amp;redlink=1" class="new" title="${label} (page does not exist)">${label}</a>`;

// ---------------------------------------------------------------------------------------------------------------
// MediaWiki's HTML of an IxWiki page, as the reader gets it (transformArticleHtml)
// ---------------------------------------------------------------------------------------------------------------

/** An IxWiki article as action=parse renders it: a hatnote, an infobox, red links of every spelling, wiki links. */
const IXWIKI_ARTICLE =
  '<div class="mw-parser-output">' +
  `<div class="hatnote">See ${redLink("Hat")}</div>` +
  `<table class="infobox"><tr><td>${redLink("Box")} <a href="/id/@ada/work">Ada</a></td></tr></table>` +
  "<p>" +
  [
    redLink("Aurelian_Empire"),
    redLink("Template%3AInfobox_x", "Template:Infobox x"),
    redLink("Caf%C3%A9_Royale"),
    redLink("aurelia"),
    redLink("User_talk:Kir"),
    redLink("A%26B", "A&amp;B"),
    '<a class="new" title="Foo (page does not exist)" href="/index.php?title=Foo&amp;action=edit&amp;redlink=1">Foo</a>',
    '<a href="/wiki/Bar" title="Bar">Bar</a> <abbr title="Baz (page does not exist)">Baz</abbr>',
    '<a href="/index.php?title=Foo&amp;action=history">history</a>',
    '<a href="/index.php?title=Foo&amp;oldid=12">old</a>',
    '<a href="/index.php?title=Foo&amp;action=edit">edit</a>',
    '<a href="/index.php?title=Special:Upload&amp;wpDestFile=Flag.png" class="new" title="File:Flag.png">File:Flag.png</a>',
    '<a href="/index.php?title=Qux&amp;action=edit&amp;redlink=1">no class</a>',
    '<a href="/index.php?title=Foo%7CBar&amp;action=edit&amp;redlink=1" class="new" title="Foo|Bar (page does not exist)">x</a>',
    '<a href="/index.php?action=edit&amp;redlink=1" class="new">y</a>',
    '<a href="/wiki/Gallambria" title="Gallambria">Gallambria</a> <a href="/wiki/Gallambria#History" title="Gallambria">history</a>',
    '<a href="/wiki/File:Map.png" class="mw-file-description">map</a> <a href="/wiki/Special:Random">random</a>',
    '<a href="/wiki/User:Kir" title="User:Kir">Kir</a>',
    '<a href="/thinkpages/profile/jane">Jane</a>',
  ].join(" ") +
  "</p></div>";

const IXWIKI_ARTICLE_EXPECTED: Array<[string, Expectation[]]> = [
  [
    "a red link opens WikiOS's editor as a relative /wiki link, keeps the red class and loses the tooltip (F16)",
    [
      ["content", "+", '<a href="/wiki/Aurelian_Empire?action=edit&amp;redlink=1" class="new wikios-redlink">Aurelian Empire</a>'],
      ["content", "-", "index.php?title=Aurelian_Empire"],
      ["content", "-", '"Aurelian Empire (page does not exist)"'],
    ],
  ],
  [
    "a red link's title is read through the canonical title helper: namespaces, accents, percent escapes, case",
    [
      ["content", "+", 'href="/wiki/Template:Infobox_x?action=edit&amp;redlink=1"'],
      ["content", "+", 'href="/wiki/Caf%C3%A9_Royale?action=edit&amp;redlink=1"'],
      ["content", "+", 'href="/wiki/Aurelia?action=edit&amp;redlink=1"'],
      ["content", "+", 'href="/wiki/User_talk:Kir?action=edit&amp;redlink=1"'],
      ["content", "+", 'href="/wiki/A%26B?action=edit&amp;redlink=1"'],
    ],
  ],
  [
    "a red link does not depend on the order of its attributes, and only its own tooltip goes",
    [
      ["content", "+", '<a class="new wikios-redlink" href="/wiki/Foo?action=edit&amp;redlink=1">Foo</a>'],
      ["content", "+", '<a href="/wiki/Bar" title="Bar">Bar</a>'],
      ["content", "+", '<abbr title="Baz (page does not exist)">'],
    ],
  ],
  [
    "red links in the infobox and the notices open the editor too",
    [
      ["infobox", "+", 'href="/wiki/Box?action=edit&amp;redlink=1"'],
      ["notices", "+", 'href="/wiki/Hat?action=edit&amp;redlink=1"'],
      ["infobox", "-", "index.php"],
      ["notices", "-", "index.php"],
    ],
  ],
  [
    "every other index.php link stays on the wiki, an upload link included; a red link without the class is still one",
    [
      ["content", "+", `href="${ORIGIN}/index.php?title=Foo&amp;action=history" rel="noreferrer"`],
      ["content", "+", `href="${ORIGIN}/index.php?title=Foo&amp;oldid=12" rel="noreferrer"`],
      ["content", "+", `href="${ORIGIN}/index.php?title=Foo&amp;action=edit" rel="noreferrer"`],
      ["content", "+", `href="${ORIGIN}/index.php?title=Special:Upload&amp;wpDestFile=Flag.png" rel="noreferrer"`],
      ["content", "+", 'href="/wiki/Qux?action=edit&amp;redlink=1"'],
    ],
  ],
  [
    "a red link whose title WikiOS cannot read stays on the wiki",
    [
      ["content", "+", `href="${ORIGIN}/index.php?title=Foo%7CBar&amp;action=edit&amp;redlink=1" rel="noreferrer"`],
      ["content", "+", `href="${ORIGIN}/index.php?action=edit&amp;redlink=1" rel="noreferrer"`],
    ],
  ],
  [
    "articles and user pages are read in-app; files and special pages open on IxWiki; no source parameter",
    [
      ["content", "+", 'href="/wiki/Gallambria"'],
      ["content", "+", 'href="/wiki/Gallambria#History"'],
      ["content", "+", 'href="/wiki/User:Kir"'],
      ["content", "+", `href="${ORIGIN}/wiki/File:Map.png" rel="noreferrer"`],
      ["content", "+", `href="${ORIGIN}/wiki/Special:Random" rel="noreferrer"`],
      ["content", "-", "source="],
    ],
  ],
  [
    "old profile and passport links point at the current pages, in the body and the infobox",
    [
      ["content", "+", 'href="/dashboard/profile/jane"'],
      ["content", "-", "/thinkpages/profile/"],
      ["infobox", "+", 'href="/@ada?tab=work"'],
    ],
  ],
];

describe("MediaWiki's HTML of an IxWiki article", () => {
  const out = parts(transformArticleHtml(IXWIKI_ARTICLE, "", "ixwiki"));
  it.each(IXWIKI_ARTICLE_EXPECTED)("%s", (_behaviour, expectations) => check(out, expectations));
});

// ---------------------------------------------------------------------------------------------------------------
// Another wiki's page (rendered by that wiki's parser, read in WikiOS)
// ---------------------------------------------------------------------------------------------------------------

const SISTER_PAGE =
  '<div class="mw-parser-output">' +
  '<table class="infobox"><tr><td><a href="/wiki/Gallambria">G</a></td></tr></table>' +
  '<p><a href="/wiki/Gallambria" title="Gallambria">Gallambria</a> ' +
  '<a href="/wiki/Gallambria#History" title="Gallambria">history</a> ' +
  '<a href="/wiki/Portal:Eurth" title="Portal:Eurth">portal</a> ' +
  redLink("Aurelian_Empire") +
  ' <a href="/index.php?title=Special:Upload&amp;wpDestFile=Flag_of_Aurelia.png" class="new" title="File:Flag of Aurelia.png">File:Flag of Aurelia.png</a> ' +
  '<a href="/wiki/File:Map.png" class="mw-file-description">map</a> <a href="/wiki/Special:Random">random</a> ' +
  '<a href="/wiki/User:Kir" title="User:Kir">Kir</a> <a href="/wiki/Category:Eurth" title="Category:Eurth">cat</a> ' +
  '<a rel="nofollow" class="external text" href="https://eurth.org/">forum</a> <a href="/@jane/work">J</a></p></div>';

describe("another wiki's page", () => {
  const out = parts(transformArticleHtml(SISTER_PAGE, "", "iiwiki"));

  it.each<[string, Expectation[]]>([
    [
      "keeps article links in the WikiOS reader for that wiki, fragment last, the infobox's too",
      [
        ["content", "+", 'href="/wiki/Gallambria?source=iiwiki"'],
        ["content", "+", 'href="/wiki/Gallambria?source=iiwiki#History"'],
        ["content", "+", 'href="/wiki/Portal:Eurth?source=iiwiki"'],
        ["infobox", "+", 'href="/wiki/Gallambria?source=iiwiki"'],
      ],
    ],
    [
      "sends a red link to that wiki's reader, still red, never to a create form",
      [
        ["content", "+", 'href="/wiki/Aurelian_Empire?source=iiwiki" class="new" title="Aurelian Empire (page does not exist)"'],
        ["content", "-", "index.php"],
        ["content", "-", "redlink"],
      ],
    ],
    [
      "opens files, special, user and category pages on that wiki, and leaves external and relative profile links alone",
      [
        ["content", "+", 'href="https://iiwiki.com/wiki/File:Flag_of_Aurelia.png" rel="noreferrer"'],
        ["content", "+", 'href="https://iiwiki.com/wiki/File:Map.png" rel="noreferrer"'],
        ["content", "+", 'href="https://iiwiki.com/wiki/Special:Random" rel="noreferrer"'],
        ["content", "+", 'href="https://iiwiki.com/wiki/User:Kir" rel="noreferrer"'],
        ["content", "+", 'href="https://iiwiki.com/wiki/Category:Eurth" rel="noreferrer"'],
        ["content", "+", 'href="https://eurth.org/"'],
        ["content", "+", 'href="/@jane/work"'],
      ],
    ],
  ])("%s", (_behaviour, expectations) => check(out, expectations));

  it("reads Fandom's red link form (/wiki/Title?action=edit&redlink=1) the same way", () => {
    const fandom = transformArticleHtml(
      '<div class="mw-parser-output"><p><a href="/wiki/Gallambria?action=edit&amp;redlink=1" class="new" title="Gallambria (page does not exist)">G</a> ' +
        '<a href="/wiki/Gallambria?action=history#Top">h</a> <a href="/wiki/Special:Search?search=x">s</a></p></div>',
      "",
      "althistory"
    ).contentHtml;

    expect(fandom).toContain('href="/wiki/Gallambria?source=althistory" class="new"');
    expect(fandom).toContain('href="/wiki/Gallambria?source=althistory#Top"');
    expect(fandom).toContain('href="https://althistory.fandom.com/wiki/Special:Search?search=x" rel="noreferrer"');
    expect(fandom).not.toContain("redlink");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Pictures: srcset, the eager first picture, the lead image and the hero
// ---------------------------------------------------------------------------------------------------------------

describe("pictures", () => {
  const shout = (url: string) => `<${url}>`;
  it.each([
    ["a.png 1x, b.png 2x", "<a.png> 1x, <b.png> 2x"],
    ["a.png 1.5x,b.png 2x", "<a.png> 1.5x,<b.png> 2x"],
    ["a.png 300w, b.png 600w", "<a.png> 300w, <b.png> 600w"],
    ["a.png", "<a.png>"],
    ["a.png,b.png", "<a.png,b.png>"],
    ["a.png, b.png", "<a.png>, <b.png>"],
    ["  a.png  1x ,  b.png 2x  ", "  <a.png>  1x ,  <b.png> 2x  "],
    ["a.png,\n b.png 2x", "<a.png>,\n <b.png> 2x"],
    ["/images/a/ab/Foo,_Bar.png 1x, /images/c/cd/Baz.png 2x", "</images/a/ab/Foo,_Bar.png> 1x, </images/c/cd/Baz.png> 2x"],
    ["", ""],
    ["   ", "   "],
    [",,", ",,"],
  ])("mapSrcsetUrls maps the URLs of %p and keeps the rest", (srcset, expected) => {
    expect(mapSrcsetUrls(srcset, shout)).toBe(expected);
  });

  it("mapSrcsetUrls hands each URL to the mapper once, with no descriptor and no trailing comma", () => {
    const seen: string[] = [];
    mapSrcsetUrls("/a.png 1x, /b.png 2x,/c.png, /d.png 3x", (url) => (seen.push(url), url));
    expect(seen).toEqual(["/a.png", "/b.png", "/c.png", "/d.png"]);
  });

  const srcsetOf = (out: string) => /srcset="([^"]*)"/.exec(out)?.[1];
  const withSrcset = (srcset: string) => `<p><img src="/images/a/ab/F.png" srcset="${srcset}" width="300"></p>`;
  it.each<[string, "ixwiki" | "iiwiki" | "althistory", string, string]>([
    [
      "root-relative candidates become absolute, once",
      "ixwiki",
      "/images/thumb/a/ab/F.png/450px-F.png 1.5x, /images/thumb/a/ab/F.png/600px-F.png 2x",
      `${ORIGIN}/images/thumb/a/ab/F.png/450px-F.png 1.5x, ${ORIGIN}/images/thumb/a/ab/F.png/600px-F.png 2x`,
    ],
    ["/thumb/ and /data/ map like the src", "ixwiki", "/thumb/a/ab/F.png/300px-F.png 1x, /data/x.png 2x", `${ORIGIN}/images/thumb/a/ab/F.png/300px-F.png 1x, ${ORIGIN}/data/x.png 2x`],
    [
      "an absolute candidate stays exactly as it is (F17: it was prefixed again)",
      "ixwiki",
      `${ORIGIN}/images/thumb/a/ab/F.png/450px-F.png 1.5x, ${ORIGIN}/images/thumb/a/ab/F.png/600px-F.png 2x`,
      `${ORIGIN}/images/thumb/a/ab/F.png/450px-F.png 1.5x, ${ORIGIN}/images/thumb/a/ab/F.png/600px-F.png 2x`,
    ],
    [
      "relative and absolute candidates mix",
      "ixwiki",
      `/images/a/ab/F.png 1x, ${ORIGIN}/images/c/cd/G.png 2x, //www.ixwiki.test/ignored 3x`,
      `${ORIGIN}/images/a/ab/F.png 1x, ${ORIGIN}/images/c/cd/G.png 2x, //www.ixwiki.test/ignored 3x`,
    ],
    [
      "an http or protocol-relative spelling of the wiki's own host becomes its origin",
      "ixwiki",
      `http://${HOST}/images/a.png 1x, //${HOST}/images/b.png 2x, //www.${HOST}/images/c.png 3x`,
      `${ORIGIN}/images/a.png 1x, ${ORIGIN}/images/b.png 2x, ${ORIGIN}/images/c.png 3x`,
    ],
    [
      "another host's URL is not touched, even with /images/ in its path",
      "ixwiki",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/F.png/300px-F.png 1x, https://cdn.example/images/x.png 2x",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/F.png/300px-F.png 1x, https://cdn.example/images/x.png 2x",
    ],
    [
      "another wiki's relative and own-host candidates go through the media proxy, once",
      "iiwiki",
      "/images/thumb/a/ab/F.png/450px-F.png 1.5x, https://iiwiki.com/images/thumb/a/ab/F.png/600px-F.png 2x, /thumb/c/cd/G.png/300px-G.png 3x",
      "/api/mediawiki/iiwiki/images/thumb/a/ab/F.png/450px-F.png 1.5x, /api/mediawiki/iiwiki/images/thumb/a/ab/F.png/600px-F.png 2x, /api/mediawiki/iiwiki/images/thumb/c/cd/G.png/300px-G.png 3x",
    ],
    [
      "a candidate already proxied, or on a CDN, is left alone",
      "althistory",
      "/api/mediawiki/iiwiki/images/a/ab/F.png 1x, https://static.wikia.nocookie.net/althistory/images/a/ab/F.png 2x",
      "/api/mediawiki/iiwiki/images/a/ab/F.png 1x, https://static.wikia.nocookie.net/althistory/images/a/ab/F.png 2x",
    ],
  ])("srcset: %s", (_behaviour, wiki, srcset, expected) => {
    const out = transformImages(withSrcset(srcset), wiki);
    expect(srcsetOf(out)).toBe(expected);
    expect(out).not.toMatch(/images\/?https?:/);
    expect(out).not.toContain(`${ORIGIN}${ORIGIN}`);
    expect(transformImages(out, wiki)).toBe(out); // idempotent
  });

  const img = (name: string, attrs = "") => `<img src="https://ixwiki.com/images/a/ab/${name}" ${attrs}>`;
  const loading = (html: string) => (html.match(/<img[^>]*>/g) ?? []).map((tag) => /loading="(\w+)"/.exec(tag)?.[1]);
  it.each([
    ["the first picture is eager, the rest lazy", `${img("A.png")}<p>text</p>${img("B.png")}${img("C.png")}`, ["eager", "lazy", "lazy"]],
    [
      "a tiny icon is not the first picture, and a loading attribute already there is respected",
      `${img("Icon.png", 'width="16" height="16"')}${img("Photo.png", 'width="300"')}${img("Own.png", 'loading="lazy"')}`,
      ["lazy", "eager", "lazy"],
    ],
  ])("transformImages: %s", (_behaviour, html, expected) => {
    expect(loading(transformImages(html, "ixwiki", { eagerFirst: true }))).toEqual(expected);
  });

  it("an article's infobox picture is the eager one; the body's first is eager only without an infobox", () => {
    const withInfobox = transformArticleHtml(
      `<table class="infobox"><tr><td>${img("Info.png", 'width="300"')}</td></tr></table><p>Lead</p>${img("Body.png", 'width="300"')}`,
      "/wiki"
    );
    expect(loading(withInfobox.infoboxHtml ?? "")).toEqual(["eager"]);
    expect(loading(withInfobox.contentHtml)).toEqual(["lazy"]);
    expect(loading(transformArticleHtml(`<p>Lead</p>${img("Body.png", 'width="300"')}`, "/wiki").contentHtml)).toEqual(["eager"]);
  });

  const INFOBOX_FLAG =
    '<table class="infobox"><tr><td><img src="https://ixwiki.com/images/thumb/a/ab/Flag.png/330px-Flag.png" ' +
    'width="330" height="220" data-file-width="3000" data-file-height="2000"></td></tr></table>';
  it("extractLeadImage gives the infobox picture with its file's size, else no size, and null without one", () => {
    const lead = extractLeadImage(INFOBOX_FLAG);
    expect(lead).toEqual({ url: extractLeadImageFromHtml(INFOBOX_FLAG), fileWidth: 3000, fileHeight: 2000 });
    expect(lead!.url).toContain("/api/mediawiki/ixwiki/images/thumb/a/ab/Flag.png/330px-Flag.png");
    expect(extractLeadImage('<table class="infobox"><tr><td><img src="https://ixwiki.com/images/a/ab/X.png"></td></tr></table>')).toMatchObject({
      fileWidth: null,
      fileHeight: null,
    });
    expect(extractLeadImage("<p>none</p>")).toBeNull();
    expect(extractLeadImage(null)).toBeNull();
  });

  const thumb = "/api/mediawiki/ixwiki/images/thumb/a/ab/Flag.png/330px-Flag.png";
  const original = "/api/mediawiki/ixwiki/images/a/ab/Flag.png";
  it.each<[string, string, number | null, number | null, Partial<ReturnType<typeof heroImage>>]>([
    [
      "a photo wider than the hero gets a 1280 px thumbnail, with its size",
      thumb,
      3000,
      2000,
      { src: "/api/mediawiki/ixwiki/images/thumb/a/ab/Flag.png/1280px-Flag.png", original, width: HERO_IMAGE_WIDTH, height: 853 },
    ],
    ["the same from the file's own URL", original, 3000, 2000, { src: "/api/mediawiki/ixwiki/images/thumb/a/ab/Flag.png/1280px-Flag.png" }],
    ["a file no wider than the hero is served itself", thumb, 1200, 800, { src: original, original, width: 1200, height: 800 }],
    ["a vector is served itself", "/api/mediawiki/ixwiki/images/thumb/a/ab/Seal.svg/330px-Seal.svg.png", 5000, 5000, { src: "/api/mediawiki/ixwiki/images/a/ab/Seal.svg" }],
    ["a file of unknown size is served itself", thumb, null, null, { src: original, original, width: null, height: null }],
    ["an address that is not a hashed /images/ path is left alone", "https://example.com/pictures/flag.png", 4000, 3000, { src: "https://example.com/pictures/flag.png" }],
  ])("heroImage: %s", (_behaviour, url, width, height, expected) => {
    expect(heroImage(url, width, height)).toMatchObject(expected);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The view bundle's HTML loses its dead weight, and only that (slimArticleHtml)
// ---------------------------------------------------------------------------------------------------------------

const STYLE = (css: string) => `<style data-mw-deduplicate="TemplateStyles:r1">${css}</style>`;

describe("slimming", () => {
  it.each([
    [
      "a link's title goes only when it repeats the link's text (and only on links)",
      '<p><a href="/wiki/Foo" title="Foo">Foo</a> <a href="/wiki/Foo" title="Foo">the foo</a> <a href="/wiki/Bar" title="Bar"><b>Bar</b></a> <abbr title="Abbr">Abbr</abbr></p>',
      '<p><a href="/wiki/Foo">Foo</a> <a href="/wiki/Foo" title="Foo">the foo</a> <a href="/wiki/Bar"><b>Bar</b></a> <abbr title="Abbr">Abbr</abbr></p>',
    ],
    [
      "classes nobody styles go, the others stay, and the attribute with them when none is left",
      '<a class="mw-redirect extiw" href="/wiki/A">A</a><a class="mw-redirect" href="/wiki/B">B</a><div class="infobox mergedrow">x</div>',
      '<a href="/wiki/A">A</a><a href="/wiki/B">B</a><div class="infobox">x</div>',
    ],
    ["empty class, style and title go; an empty alt stays", '<p class="" style=" " title="">x</p><img alt="" src="/a.png">', '<p>x</p><img alt="" src="/a.png">'],
    [
      "whitespace between blocks, in tables and lists goes, never between inline elements",
      "<div>\n  <p>a</p>\n  <p>b</p>\n</div>\n<ul>\n  <li>one</li>\n  <li>two</li>\n</ul>\n<table>\n <tbody>\n  <tr>\n   <td>x</td>\n   <td>y</td>\n  </tr>\n </tbody>\n</table>\n<p><b>bold</b> <i>italic</i> <span> </span><a href='/wiki/X'>x</a></p>",
      '<div><p>a</p><p>b</p></div><ul><li>one</li><li>two</li></ul><table><tbody><tr><td>x</td><td>y</td></tr></tbody></table><p><b>bold</b> <i>italic</i> <span> </span><a href="/wiki/X">x</a></p>',
    ],
    [
      "a no-break space is content (an &nbsp; spacer, other Unicode spaces), plain whitespace is not",
      '<div><div style="float:right;width:6em;height:2.6em">&nbsp;</div><p>a</p>&nbsp;<p>b</p>  </div>',
      '<div><div style="float:right;width:6em;height:2.6em">&nbsp;</div><p>a</p>&nbsp;<p>b</p>&nbsp; </div>',
    ],
    ["space, tab, newline, CR and form feed between blocks go", "<div>\n\t \r\f<p>a</p> \n <p>b</p></div>", "<div><p>a</p><p>b</p></div>"],
    [
      "the space beside a block its style lays out inline stays; two ordinary blocks lose theirs",
      '<div><div style="display:inline-block">a</div> <div style="display: inline-block">b</div> <p style="display:inline">c</p> <p>d</p></div><div><p>x</p> <p>y</p></div>',
      '<div><div style="display:inline-block">a</div> <div style="display: inline-block">b</div> <p style="display:inline">c</p> <p>d</p></div><div><p>x</p><p>y</p></div>',
    ],
    [
      "whitespace in <pre> and where the author asked for it stays (the parser drops the newline after <pre>)",
      '<div><pre>\n  <b>a</b>\n  <b>b</b>\n</pre></div><div style="white-space:pre-wrap"><p>a</p>\n<p>b</p></div>',
      '<div><pre>  <b>a</b>\n  <b>b</b>\n</pre></div><div style="white-space:pre-wrap"><p>a</p>\n<p>b</p></div>',
    ],
    [
      "a class a kept TemplateStyles block styles stays; the one it does not name is still dead weight (m3)",
      STYLE(".mw-parser-output .infobox-caption{font-weight:bold}.mw-parser-output .plainlinks a{color:red}") +
        '<div class="infobox-caption">cap</div><div class="plainlinks mw-redirect"><a href="/wiki/X">x</a></div>',
      STYLE(".mw-parser-output .infobox-caption{font-weight:bold}.mw-parser-output .plainlinks a{color:red}") +
        '<div class="infobox-caption">cap</div><div class="plainlinks"><a href="/wiki/X">x</a></div>',
    ],
    ["a class no sheet names goes as before", '<div class="infobox-caption treeview">x</div>', "<div>x</div>"],
    [
      "a style that is not TemplateStyles' keeps no class alive",
      '<style>.infobox-caption{color:red}</style><div class="infobox-caption">x</div>',
      "<style>.infobox-caption{color:red}</style><div>x</div>",
    ],
  ])("%s", (_behaviour, html, expected) => {
    expect(slimArticleHtml(html)).toBe(expected);
    expect(slimArticleHtml(expected)).toBe(expected); // idempotent
  });

  it("finds a sheet's classes however it names them: escapes, :is(), an attribute selector", () => {
    const out = slimArticleHtml(
      STYLE(".mw-parser-output .plain\\6c inks{a:b}.mw-parser-output :is(.treeview, .nv-view){a:b}.mw-parser-output [class~=infobox-below]{a:b}") +
        '<div class="plainlinks">a</div><div class="treeview">b</div><div class="nv-view">c</div><div class="infobox-below">d</div><div class="nv-edit">e</div>'
    );
    for (const kept of ["plainlinks", "treeview", "nv-view", "infobox-below"]) expect(out).toContain(`class="${kept}"`);
    expect(out).not.toContain("nv-edit");
    expect(slimArticleHtml(STYLE(".mw-parser-output .other{color:red}") + '<div class="infobox-caption other">x</div>')).toContain(
      '<div class="other">x</div>'
    );
  });

  it("leaves a chip marker byte for byte, and the empty string empty", () => {
    const marker = chipMarker("MyCountry:gdp");
    const once = slimArticleHtml(`<p>GDP ${marker} <a href="/wiki/Foo" title="Foo">Foo</a> &amp; more<br>text</p>`);
    expect(once).toBe(`<p>GDP ${marker} <a href="/wiki/Foo">Foo</a> &amp; more<br>text</p>`);
    expect(chipKeysIn(once)).toEqual(["MyCountry:gdp"]);
    expect(slimArticleHtml("")).toBe("");
  });

  it("templateStyleIdentifiers reads TemplateStyles blocks only, and an unclosed run of them costs its length", () => {
    expect([...templateStyleIdentifiers(`${STYLE(".a-b .c{x:y}")}<style>.not-this{x:y}</style>`, `<p>x</p>${STYLE(".d{x:y}")}`)].sort()).toEqual([
      "a-b",
      "c",
      "d",
      "x",
      "y",
    ]);
    const started = performance.now();
    expect(templateStyleIdentifiers('<style data-mw-deduplicate="x">'.repeat(20_000)).size).toBe(0);
    expect(performance.now() - started).toBeLessThan(250 * TIMING_BUDGET_SCALE);
  });

  it("the view bundle is built from slimmed HTML: body, infobox and notices", () => {
    const bundle = buildViewBundle(
      '<div class="mw-parser-output">' +
        '<table class="infobox"><tbody><tr><td><a class="mw-redirect" href="/wiki/Eurth" title="Eurth">Eurth</a></td></tr></tbody></table>\n' +
        '<div class="mw-heading mw-heading2"><h2 id="History">History</h2></div>\n' +
        '<p>Text <a href="/wiki/Urcea" title="Urcea">Urcea</a>.</p>\n</div>'
    );
    expect(bundle.infoboxHtml).toContain('<a href="/wiki/Eurth">Eurth</a>');
    expect(bundle.bodyHtml).toContain('<div class="mw-heading"><h2 id="History">History</h2></div>');
    expect(bundle.bodyHtml).toContain('<a href="/wiki/Urcea">Urcea</a>');
    expect(bundle.bodyHtml).not.toMatch(/>\s+</);
  });

  it("a sheet in the body keeps the classes it styles in the infobox", () => {
    const bundle = buildViewBundle(
      '<div class="mw-parser-output">' +
        STYLE(".mw-parser-output .infobox-caption{font-weight:bold}") +
        '<table class="infobox"><tbody><tr><td><div class="infobox-caption">Caption</div></td></tr></tbody></table>' +
        '<p>Body <span class="plainlinks">text</span></p></div>'
    );
    expect(bundle.infoboxHtml).toContain('class="infobox-caption"');
    expect(bundle.bodyHtml).toContain("<span>text</span>"); // plainlinks is named by no sheet
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Old profile links, and template chips
// ---------------------------------------------------------------------------------------------------------------

describe("profile links", () => {
  it.each([
    ["/thinkpages/profile/jane", "/dashboard/profile/jane"],
    ["/thinkpages/u/jane", "/dashboard/profile/jane"],
    ["/thinkpages/profile/jane/", "/dashboard/profile/jane"],
    ["/thinkpages/profile/jane?x=1#top", "/dashboard/profile/jane?x=1#top"],
    ["/id/@jane", "/@jane"],
    ["/id/@jane/", "/@jane"],
    ["/id/@jane?tab=work", "/@jane?tab=work"],
    ["/id/@jane#top", "/@jane#top"],
    ["/id/@jane/work", "/@jane?tab=work"],
    ["/id/@jane/work?x=1#top", "/@jane?tab=work&x=1#top"],
    ["/@jane/work", "/@jane?tab=work"],
    ["/@jane/work/", "/@jane?tab=work"],
    ["/@jane/work?x=1", "/@jane?tab=work&x=1"],
    ["/id/@jane/work?tab=x", "/@jane?tab=work"],
    ["/id/@jane/work?x=1&amp;y=2&tab=x", "/@jane?tab=work&x=1&amp;y=2"],
    // the base path and the IxWiki origin the link carries stay; the old base path moves
    ["/projects/ixstates/thinkpages/profile/jane", "/projects/ixstates/dashboard/profile/jane"],
    ["/projects/ixstates/id/@jane/work", "/projects/ixstates/@jane?tab=work"],
    ["https://ixwiki.com/thinkpages/u/jane", "https://ixwiki.com/dashboard/profile/jane"],
    ["https://www.ixwiki.com/projects/ixstates/id/@jane", "https://www.ixwiki.com/projects/ixstates/@jane"],
    ["/projects/ixstats/thinkpages/profile/jane", "/projects/ixstates/dashboard/profile/jane"],
    ["/projects/ixstats/thinkpages/u/jane?x=1", "/projects/ixstates/dashboard/profile/jane?x=1"],
    ["/projects/ixstats/id/@jane/work", "/projects/ixstates/@jane?tab=work"],
    ["/projects/ixstats/@jane/work#top", "/projects/ixstates/@jane?tab=work#top"],
    ["/projects/ixstats/@jane", "/projects/ixstates/@jane"],
    ["/projects/ixstats/@jane?tab=work", "/projects/ixstates/@jane?tab=work"],
    ["https://ixwiki.com/projects/ixstats/thinkpages/profile/jane", "https://ixwiki.com/projects/ixstates/dashboard/profile/jane"],
  ])("currentProfileHref sends %s to %s", (old, current) => {
    expect(currentProfileHref(old)).toBe(current);
  });

  it.each([
    "/@jane",
    "/@jane?tab=work",
    "/projects/ixstates/@jane",
    "/projects/ixstats/wiki/Foo",
    "/projects/ixstatsx/@jane/work",
    "/dashboard/profile/jane",
    "/id/jane",
    "/id/@",
    "/thinkpages/profile/",
    "/thinkpages/post/12",
    "/thinkpages/r/ixnay",
    "/wiki/Foo",
    "/countries/aurelia/@x/work",
    "https://example.com/@jane/work",
    "https://example.com/id/@jane",
    "https://example.com/thinkpages/profile/jane",
    "https://ixwiki.com.evil.test/id/@jane",
    "",
  ])("currentProfileHref leaves %s as it is", (href) => {
    expect(currentProfileHref(href)).toBe(href);
  });

  it("currentProfileLinks rewrites the href of each link and nothing else, and returns the same string when nothing changes", () => {
    expect(
      currentProfileLinks(
        '<p><a href="/thinkpages/profile/jane" class="x">Jane</a> and <a href="/id/@bob/work">Bob</a> and <a href="/wiki/Foo">Foo</a> and <a href="https://example.com/@mastodon/1">M</a> /id/@text</p>'
      )
    ).toBe(
      '<p><a href="/dashboard/profile/jane" class="x">Jane</a> and <a href="/@bob?tab=work">Bob</a> and <a href="/wiki/Foo">Foo</a> and <a href="https://example.com/@mastodon/1">M</a> /id/@text</p>'
    );
    const untouched = '<p><a href="/wiki/Foo">Foo</a></p>';
    expect(currentProfileLinks(untouched)).toBe(untouched);
  });
});

describe("template chips: stored as inert markers at render time, substituted exactly at serve time", () => {
  it.each([
    ["no chip: the HTML byte for byte, without a DOM round trip", '<p class="x">Plain &amp; <a href="/wiki/Foo">simple</a><br></p><p>unclosed', '<p class="x">Plain &amp; <a href="/wiki/Foo">simple</a><br></p><p>unclosed'],
    [
      "a chip link, whatever it wraps, and a raw chip",
      '<p><a href="/wiki/Template:CountryData:Aurelia:population"><b>12</b></a> and {{MyCountry:gdp}}.</p>',
      `<p>${chipMarker("CountryData:Aurelia:population")} and ${chipMarker("MyCountry:gdp")}.</p>`,
    ],
    ["a percent-encoded link target", '<a href="/wiki/Template%3AMyCountry%3Agdp">x</a>', chipMarker("MyCountry:gdp")],
    [
      "a link's whole label goes, even markup that looks like the end of the link",
      '<a href="/wiki/Template:MyCountry:x"><span title="</a><img src=x onerror=alert(1)>">y</span></a>',
      chipMarker("MyCountry:x"),
    ],
    [
      "ordinary links, other templates and chips outside the alphabet stay",
      '<a href="/wiki/Foo">a</a><a href="/wiki/Template:Other:x">b</a><a href="/wiki/Template:CountryData:A%3CB:pop">c</a>',
      '<a href="/wiki/Foo">a</a><a href="/wiki/Template:Other:x">b</a><a href="/wiki/Template:CountryData:A%3CB:pop">c</a>',
    ],
    ["nothing inside a style is a chip", "<style>/* {{MyCountry:x}} */</style><p>{{MyCountry:y}}</p>", `<style>/* {{MyCountry:x}} */</style><p>${chipMarker("MyCountry:y")}</p>`],
  ])("markTemplateChips: %s", (_behaviour, html, expected) => {
    expect(markTemplateChips(html)).toBe(expected);
  });

  it.each([
    ["MyCountry:gdp", true],
    ["CountryData:Aurelia:population", true],
    ["BusinessData:Acme Corp (Eurth):revenue", true],
    ["Other:gdp", false],
    ["MyCountry", false],
    ['MyCountry:a"b', false],
    ["CountryData:Bosnia & Herzegovina:population", false],
    ["CountryData:A<B:population", false],
    ["MyCountry:a=b", false],
    ["MyCountry:a\nb", false],
    ["CountryData::population", false],
    [`MyCountry:${"a".repeat(300)}`, false],
  ])("isMarkableKey(%j) is %s", (key, markable) => {
    expect(isMarkableKey(key)).toBe(markable);
  });

  const served = `<p>${chipMarker("MyCountry:a")} ${chipMarker("MyCountry:b")} ${chipMarker("MyCountry:a")}</p>`;
  it("finds each key once across parts, and replaces every exact marker without reading `$` in the value", () => {
    expect(chipKeysIn(served, null, chipMarker("CountryData:X:y"))).toEqual(["MyCountry:a", "MyCountry:b", "CountryData:X:y"]);
    expect(substituteChipMarkers(served, (key) => `[$&${key}]`)).toBe("<p>[$&MyCountry:a] [$&MyCountry:b] [$&MyCountry:a]</p>");
    expect(templateKeysOf(["MyCountry:gdp", "CountryData:Aurelia:population"])).toEqual([
      { key: "MyCountry:gdp", category: "mycountry", target: "", field: "gdp" },
      { key: "CountryData:Aurelia:population", category: "countrydata", target: "Aurelia", field: "population" },
    ]);
  });

  it.each([
    ["an extra attribute", '<span class="c" data-wikios-chip="MyCountry:a"></span>'],
    ["a child", '<span data-wikios-chip="MyCountry:a">x</span>'],
    ["another tag", '<b data-wikios-chip="MyCountry:a"></b>'],
    ["single quotes", "<span data-wikios-chip='MyCountry:a'></span>"],
    ["escaped text", '&lt;span data-wikios-chip="MyCountry:a"&gt;&lt;/span&gt;'],
    ["an attribute value", '<p title="<span data-wikios-chip=&quot;MyCountry:a&quot;></span>">x</p>'],
    ["a key outside the alphabet", '<span data-wikios-chip="MyCountry:a&amp;b"></span>'],
  ])("a lookalike with %s is no marker", (_name, lookalike) => {
    expect(chipKeysIn(lookalike)).toEqual([]);
    expect(substituteChipMarkers(lookalike, () => "CHIP")).toBe(lookalike);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The page's facts: its description and lead image for crawlers and link cards
// ---------------------------------------------------------------------------------------------------------------

describe("page facts", () => {
  const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
  it.each<[string, string, string | null]>([
    [
      "the first paragraph of real prose, without tags, entities or extra whitespace",
      '<p class="lead">Short.</p><p>The <b>Republic</b> of Aurelia &amp; its   colonies are\n a country of Eurth&#39;s northern coast.</p><p>Second paragraph, long enough to be prose too.</p>',
      "The Republic of Aurelia & its colonies are a country of Eurth's northern coast.",
    ],
    ["none for a page with no paragraph of prose (a list)", "<ul><li>A</li><li>B</li></ul>", null],
    ["none for a paragraph too short", "<p>Too short.</p>", null],
    ["none for nothing", "", null],
    ["a <pre> is no paragraph", "<pre>preformatted text that is long enough to count as a paragraph, surely</pre>", null],
    ["text past the start of a very long page is not read", `${"<div>x</div>".repeat(10_000)}<p>A long enough paragraph, but far down the page, so nobody looks.</p>`, null],
  ])("descriptionFromHtml: %s", (_behaviour, html, expected) => {
    expect(descriptionFromHtml(html)).toBe(expected);
  });

  it("cuts a long description at a word boundary with an ellipsis", () => {
    const description = descriptionFromHtml(`<p>${words}</p>`)!;
    expect(description.length).toBeLessThanOrEqual(200);
    expect(description.endsWith("…")).toBe(true);
    expect(description).not.toMatch(/word\d* …$/);
    expect(words.startsWith(description.slice(0, -1))).toBe(true);
  });

  it("reads the link card's image from the infobox, absolute as it is, and the description from the body", () => {
    expect(leadImageUrl('<table class="infobox"><tr><td><img src="https://cdn.example/a.png"></td></tr></table>', "https://ixwiki.com")).toBe(
      "https://cdn.example/a.png"
    );
    expect(leadImageUrl("<p>none</p>", "https://ixwiki.com")).toBeNull();
    const seo = articleSeo(
      {
        contentHtml: "<p>Aurelia is a country of Eurth, known for its long coast and its fleets.</p>",
        infoboxHtml: '<table class="infobox"><tr><td><img src="https://cdn.example/flag.png" width="300" height="200"></td></tr></table>',
      },
      "https://ixwiki.com"
    );
    expect(seo.description).toMatch(/^Aurelia is a country/);
    expect(seo.image).toBe("https://cdn.example/flag.png");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The fallback compiler (parseWikitextToHtml): wikitext drawn in-process when MediaWiki cannot render it
// ---------------------------------------------------------------------------------------------------------------

const HUNTING_TABLE = `{| class="wikitable"
|-
! Region !! Hunting Grounds !! Featured Game !! Notable Estate !! Image
|-
| [[Levantia]] || Stalking ground for fallow deer, red deer, ibex, and driven bird hunting for red legged partridge and wild ducks. || Fallow deer, red deer, Iberian ibex, red-legged partridge || Grand Lodge, Palazzo della chase. || [[File:Palazzo della Caccia - Stupinigi.jpg|120px|center]]
|}`;
const DEER_TABLE = `{| class="wikitable"
|-
| style="text-align: center;" | [[Levantia|Levantian Realm]]
| [[File:Deer.jpg|thumb|A wild [[Red deer]] in the hills]]
|}`;
const FOOTNOTES = `Urcea is an empire in Levantia.<ref name="urcea-gazette">Royal Gazette of Urcea, Vol. 14.</ref> Its capital is Urceopolis.<ref>Imperial Almanac 2024.</ref>

== References ==
<references />`;
const VELARC = `{{Infobox country
| name = Velarc
| image_flag = Flag of Velarc.svg
| capital = [[Kirav]]
}}
'''Velarc''' is a country. [[File:Velarc coast.jpg|thumb|The [[Kirav]] coast]] It borders the sea. [[Image:Map.png|200px]]`;

describe("the fallback compiler", () => {
  it.each<[string, string, "ixwiki" | "iiwiki", { images?: boolean } | undefined, string[], Array<string | RegExp>]>([
    ["strips an unknown template", "Hello {{unknown|X}} world", "ixwiki", undefined, ["Hello", "world"], ["unknown"]],
    ["never writes a flamingo for a template it does not know", "Text with {{SomeUnknownTemplate|foo=bar}} and more text.", "ixwiki", undefined, ["and more text."], ["🦩"]],
    [
      "unpacks the inline templates it knows",
      "A {{flag|Urcea}} B {{nowrap|text}} N {{formatnum:1234567}}",
      "ixwiki",
      undefined,
      ["Urcea", "text", "1234567"],
      ["{{flag", "formatnum:"],
    ],
    [
      "draws a wikitable with image and link cells and no dangling tokens",
      HUNTING_TABLE,
      "ixwiki",
      undefined,
      ["Levantia", "Palazzo della chase.", "<table", "<td"],
      ["|120px|center]]", "120px|center]]"],
    ],
    ["keeps cell attributes and nested links in captions", DEER_TABLE, "ixwiki", undefined, ["Levantian Realm", 'style="text-align: center;"'], ["|thumb|", "thumb]]"]],
    [
      "numbers footnotes and lists them under <references /> with backlinks",
      FOOTNOTES,
      "ixwiki",
      undefined,
      ['id="cite_ref-1"', 'href="#cite_note-1"', "[1]", 'id="cite_ref-2"', 'href="#cite_note-2"', "[2]", 'class="references', 'id="cite_note-1"', "Royal Gazette of Urcea", "Imperial Almanac 2024"],
      [],
    ],
    ["draws an article's images and its infobox picture by default", VELARC, "ixwiki", undefined, ["<img", "infobox-image-row"], []],
    [
      "with images off, leaves out file links and the infobox picture, keeping the text and the rest of the infobox",
      VELARC,
      "ixwiki",
      { images: false },
      ["It borders the sea.", "Capital"],
      ["<img", "<figure", "infobox-image-row", "Velarc coast", "Flag of Velarc"],
    ],
    [
      "with images off, reads a link to a file page as its plain words",
      "See [[:File:Flag of Velarc.svg|the flag]], [[:Image:Map.png]] and [[:media:Anthem.ogg|the anthem]].",
      "ixwiki",
      { images: false },
      ["See the flag, Image:Map.png and the anthem."],
      ["<a", /File|Anthem\.ogg/],
    ],
    ["keeps a link to a file page as a link by default", "See [[:File:Flag of Velarc.svg|the flag]].", "ixwiki", undefined, ['<a href="/wiki/%3AFile%3AFlag_of_Velarc.svg"'], []],
    [
      "leaves out an infobox it cannot draw for another wiki, keeping the lead text",
      IIWIKI_EXCERPT,
      "iiwiki",
      undefined,
      ["is a multinational organization that maintains the Manamana Canal.", "It was formed to bring stability to the area."],
      ["infobox", /Logo Size|Logo Caption|Map Alt|200px|Abbreviation/],
    ],
    [
      "draws another wiki's file links through that wiki's proxy, never IxWiki's",
      IIWIKI_EXCERPT,
      "iiwiki",
      undefined,
      [`src="${proxiedFileUrl("iiwiki", null, "Manamana Canal.jpg")}"`],
      ["/api/mediawiki/ixwiki/"],
    ],
    ["draws no image of another wiki with images off", IIWIKI_EXCERPT, "iiwiki", { images: false }, ["It was formed to bring stability to the area."], ["<img", "<figure"]],
    ["still draws an IxWiki article's infobox", IIWIKI_EXCERPT, "ixwiki", undefined, ["wikios-infobox", "Abbreviation"], []],
  ])("%s", (_behaviour, wikitext, wiki, options, contains, lacks) => {
    const html = parseWikitextToHtml(wikitext, wiki, options);
    for (const text of contains) expect(html).toContain(text);
    for (const text of lacks) {
      if (typeof text === "string") expect(html).not.toContain(text);
      else expect(html).not.toMatch(text);
    }
  });
});

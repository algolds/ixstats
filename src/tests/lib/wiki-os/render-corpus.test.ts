/** @jest-environment node */
/**
 * The renderer's corpus: realistic snippets of what WikiOS renders (MediaWiki's HTML of an IxWiki article and of a
 * sister wiki's page, the wikitext the fallback compiler draws, an infobox's figures) run through the real transform,
 * slimming, chip marking, view bundle, section edit links, lead image and page facts, and what each one must come out
 * as: one row per behaviour.
 *
 * Replaces html-transformer-redlinks (plan 415 F16), source-links (ruling E-l), srcset-transform (plan 415 F17: an
 * absolute candidate was prefixed again), lcp-images (plan 413), slim-html (plan 413, plan 415 m3), legacy-profile-links,
 * article-seo (plan 412), chip-markers (plan 404 review), wikitext-html-parser, section-edit-links, image-url-lead-image
 * (the old version's answers kept on random texts), lead-image-canonical-path (plan 418 D2: one stored form under any
 * base path) and parse-money (GDP figures read as money, never as leading digits).
 */

import { JSDOM } from "jsdom";
import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
import { appendSectionEditLinks, removeSectionEditLinks, transformArticleHtml, transformImages } from "~/lib/wiki-os/transformers/html-transformer";
import { mapSrcsetUrls } from "~/lib/wiki-os/transformers/srcset";
import { slimArticleHtml, templateStyleIdentifiers } from "~/lib/wiki-os/transformers/slim-html";
import { buildViewBundle, RENDERER_VERSION } from "~/lib/wiki-os/services/render-service";
import { extractLeadImage, extractLeadImageFromHtml, extractLeadImageFromWikitext, extractLeadImagePath, getImagePath, getImageUrl, getMd5ShardPath, HERO_IMAGE_WIDTH, heroImage, isNoticeOrUtilityIcon, resolveStoredImageUrl } from "~/lib/wiki-os/transformers/image-url";
import { currentProfileHref, currentProfileLinks } from "~/lib/wiki-os/legacy-profile-links";
import { articleSeo, descriptionFromHtml, leadImageUrl } from "~/lib/wiki-os/article-seo";
import { chipKeysIn, chipMarker, isMarkableKey, markTemplateChips, substituteChipMarkers, templateKeysOf } from "~/lib/wiki-os/templates/chip-markers";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { proxiedFileUrl } from "~/lib/realms/sources/wiki-file-info";
import { IIWIKI_EXCERPT } from "~/tests/fixtures/cards/iiwiki-excerpt";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { parseInfoboxWithTemplates } from "~/lib/wiki-os/adapters/ixstates/unified-parser";
import { parseMoney } from "~/lib/wiki-os/transformers/infobox-parser";

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
    '<a href="/wiki/File%3AFlag.svg">flag</a> <a href="/wiki/Special%3ARecentChanges">rc</a>',
    '<a href="/wiki/Special:WhatLinksHere/Gallambria">w</a> <a href="/wiki/Special:WhatLinksHere?target=Gallambria&amp;namespace=0">wq</a>',
    '<a href="/wiki/Special:FilePath/Map.png">fp</a> <a href="/wiki/Special:FilePath?file=Map.png">fpq</a>',
    '<a href="/wiki/Special:Nonexistent">x</a> <a href="/wiki/Special:Diff/abc/def/ghi">bad diff</a> <a href="/wiki/Special:Constructor">proto</a>',
    '<a href="/wiki/special:Nonexistent">lc</a> <a href="/wiki/Special%3aNonexistent">esc</a>',
    '<a href="/wiki/Special:AllPages?namespace=99999">ns past cap</a> <a href="/wiki/Special:AllPages?namespace=4">ns</a>',
    '<a href="/wiki/Special:Move?wpReason=x&amp;target=A%7CB">bad move</a> <a href="/wiki/Special:Move?wpReason=x&amp;target=Gallambria">move</a>',
    '<a href="https://ixwiki.com/wiki/File:Map.png">abs file</a> <a href="//evil.example/wiki/Special:Random">pr</a> <a href="https://evil.example/wiki/Special:Random">ext</a>',
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
    "articles and user pages are read in-app; no source parameter",
    [
      ["content", "+", 'href="/wiki/Gallambria"'],
      ["content", "+", 'href="/wiki/Gallambria#History"'],
      ["content", "+", 'href="/wiki/User:Kir"'],
      ["content", "-", "source="],
    ],
  ],
  [
    "files and the special pages WikiOS has are read in-app",
    [
      ["content", "+", 'href="/wiki/File:Map.png" class="mw-file-description"'],
      ["content", "+", 'href="/wiki/File%3AFlag.svg">'],
      ["content", "+", 'href="/wiki/Special:Random">'],
      ["content", "+", 'href="/wiki/Special%3ARecentChanges">'],
      ["content", "+", 'href="/wiki/Special:WhatLinksHere/Gallambria">'],
      ["content", "+", 'href="/wiki/Special:WhatLinksHere?target=Gallambria&amp;namespace=0">'],
      ["content", "+", 'href="/wiki/Special:Move?wpReason=x&amp;target=Gallambria">'],
      ["content", "+", 'href="/wiki/Special:AllPages?namespace=4">'],
      ["content", "-", `${ORIGIN}/wiki/File:Map.png" rel`],
      ["content", "-", `${ORIGIN}/wiki/Special:Random"`],
      ["content", "-", `${ORIGIN}/wiki/Special:WhatLinksHere`],
    ],
  ],
  [
    "Special:FilePath and a special WikiOS lacks stay on IxWiki",
    [
      ["content", "+", `href="${ORIGIN}/wiki/Special:FilePath/Map.png" rel="noreferrer"`],
      ["content", "+", `href="${ORIGIN}/wiki/Special:FilePath?file=Map.png" rel="noreferrer"`],
      ["content", "+", `href="${ORIGIN}/wiki/Special:Nonexistent" rel="noreferrer"`],
      ["content", "+", `href="${ORIGIN}/wiki/Special:Diff/abc/def/ghi" rel="noreferrer"`],
      ["content", "+", `href="${ORIGIN}/wiki/Special:Constructor" rel="noreferrer"`],
      ["content", "+", `href="${ORIGIN}/wiki/special:Nonexistent" rel="noreferrer"`],
      ["content", "+", `href="${ORIGIN}/wiki/Special%3aNonexistent" rel="noreferrer"`],
      ["content", "+", `href="${ORIGIN}/wiki/Special:AllPages?namespace=99999" rel="noreferrer"`],
      ["content", "+", `href="${ORIGIN}/wiki/Special:Move?wpReason=x&amp;target=A%7CB" rel="noreferrer"`],
    ],
  ],
  [
    "links that are not classic's own root-relative /wiki/ path are left as they were",
    [
      ["content", "+", '<a href="https://ixwiki.com/wiki/File:Map.png">abs file</a>'],
      ["content", "+", '<a href="//evil.example/wiki/Special:Random">pr</a>'],
      ["content", "+", '<a href="https://evil.example/wiki/Special:Random">ext</a>'],
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

  it("files and in-app specials take the base path they are given; FilePath stays on IxWiki", () => {
    const html = '<a href="/wiki/File:Map.png">m</a> <a href="/wiki/Special:Random">r</a> <a href="/wiki/Special:FilePath/Map.png">f</a>';
    const content = transformArticleHtml(html, "/projects/ixstates", "ixwiki").contentHtml;
    expect(content).toContain('href="/projects/ixstates/wiki/File:Map.png"');
    expect(content).toContain('href="/projects/ixstates/wiki/Special:Random"');
    expect(content).toContain(`href="${ORIGIN}/wiki/Special:FilePath/Map.png" rel="noreferrer"`);
  });

  it("the renderer version changed, so stored bundles re-render", () => {
    expect(RENDERER_VERSION.startsWith("5:")).toBe(true);
  });
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
    ["a.png 300w, b.png 600w", "<a.png> 300w, <b.png> 600w"],
    ["a.png,b.png", "<a.png,b.png>"],
    ["  a.png  1x ,  b.png 2x  ", "  <a.png>  1x ,  <b.png> 2x  "],
    ["/images/a/ab/Foo,_Bar.png 1x, /images/c/cd/Baz.png 2x", "</images/a/ab/Foo,_Bar.png> 1x, </images/c/cd/Baz.png> 2x"],
    ["", ""],
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
    ["a file no wider than the hero is served itself", thumb, 1200, 800, { src: original, original, width: 1200, height: 800 }],
    ["a vector is served itself", "/api/mediawiki/ixwiki/images/thumb/a/ab/Seal.svg/330px-Seal.svg.png", 5000, 5000, { src: "/api/mediawiki/ixwiki/images/a/ab/Seal.svg" }],
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
    ["/thinkpages/profile/jane?x=1#top", "/dashboard/profile/jane?x=1#top"],
    ["/id/@jane?tab=work", "/@jane?tab=work"],
    ["/id/@jane/work?x=1#top", "/@jane?tab=work&x=1#top"],
    ["/@jane/work", "/@jane?tab=work"],
    ["/id/@jane/work?tab=x", "/@jane?tab=work"],
    // the base path and the IxWiki origin the link carries stay; the old base path moves
    ["/projects/ixstates/thinkpages/profile/jane", "/projects/ixstates/dashboard/profile/jane"],
    ["https://ixwiki.com/thinkpages/u/jane", "https://ixwiki.com/dashboard/profile/jane"],
    ["/projects/ixstats/id/@jane/work", "/projects/ixstates/@jane?tab=work"],
    ["https://ixwiki.com/projects/ixstats/thinkpages/profile/jane", "https://ixwiki.com/projects/ixstates/dashboard/profile/jane"],
  ])("currentProfileHref sends %s to %s", (old, current) => {
    expect(currentProfileHref(old)).toBe(current);
  });

  it.each([
    "/@jane",
    "/projects/ixstatsx/@jane/work",
    "/id/jane",
    "/thinkpages/post/12",
    "/countries/aurelia/@x/work",
    "https://example.com/@jane/work",
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
    ["BusinessData:Acme Corp (Eurth):revenue", true],
    ["Other:gdp", false],
    ['MyCountry:a"b', false],
    ["CountryData:A<B:population", false],
    ["MyCountry:a\nb", false],
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
    ["single quotes", "<span data-wikios-chip='MyCountry:a'></span>"],
    ["escaped text", '&lt;span data-wikios-chip="MyCountry:a"&gt;&lt;/span&gt;'],
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

describe("section edit links", () => {
  // the reader appends them to its live tree in the browser: a document of its own stands in for it here
  const document = new JSDOM("<!doctype html><body></body>").window.document;
  /** The HTML of `html` after the links are appended to its live tree. */
  function addSectionEditLinks(html: string, slug: string): string {
    const root = document.createElement("div");
    root.innerHTML = html;
    appendSectionEditLinks(root, slug);
    return root.innerHTML;
  }

  describe("appendSectionEditLinks", () => {
    test("adds an edit link to h2/h3 headings carrying the heading text", () => {
      const html =
        '<div class="mw-heading mw-heading2"><h2 id="History">History &amp; Origins</h2></div>' +
        '<h3 id="Early"><span>Early</span> years</h3><h4 id="Deep">Deep</h4>';

      const out = addSectionEditLinks(html, "Foo_Bar");

      expect(out).toContain(
        '<h2 id="History">History &amp; Origins<a class="wikios-section-edit-link" href="'
      );
      expect(out).toContain(`/wiki/Foo_Bar?action=edit&amp;section=${encodeURIComponent("History & Origins")}`);
      expect(out).toContain('aria-label="Edit section: History &amp; Origins"');
      expect(out).toContain(`action=edit&amp;section=${encodeURIComponent("Early years")}`);
      expect(out).toContain('<h4 id="Deep">Deep</h4>');
    });
    test("adds a link in place, once: the heading element itself is the one that keeps it", () => {
      const root = document.createElement("div");
      root.innerHTML = '<h2 id="A">Alpha</h2><p>text</p>';
      const heading = root.querySelector("h2");

      appendSectionEditLinks(root, "Foo");
      appendSectionEditLinks(root, "Foo");

      expect(root.querySelector("h2")).toBe(heading);
      expect(root.querySelectorAll(".wikios-section-edit-link")).toHaveLength(1);
      expect(root.querySelector("p")?.textContent).toBe("text");
    });
  });

  describe("removeSectionEditLinks", () => {
    test("takes the appended links out again and leaves the headings and the rest alone", () => {
      const root = document.createElement("div");
      root.innerHTML = '<h2 id="A">Alpha</h2><h3 id="B">Beta</h3><p>text</p>';
      const heading = root.querySelector("h2");
      appendSectionEditLinks(root, "Foo");
      expect(root.querySelectorAll(".wikios-section-edit-link")).toHaveLength(2);

      removeSectionEditLinks(root);

      expect(root.innerHTML).toBe('<h2 id="A">Alpha</h2><h3 id="B">Beta</h3><p>text</p>');
      expect(root.querySelector("h2")).toBe(heading);
      removeSectionEditLinks(root); // none left: nothing to do
    });
  });
});

describe("the lead image of a page's wikitext", () => {
  /** The implementation this one replaced, unchanged: the oracle for small inputs. */
  function legacyExtractLeadImageFromWikitext(wikitext: string): string | null {
    if (!wikitext) return null;
    const infoboxFieldMatch = wikitext.match(
      /\|\s*(?:image|logo|company_logo|flag|image_flag|coat_of_arms|image_coat|seal|image_seal|map|image_map|photo|image_photo|portrait|image_portrait|album_cover|cover|poster|emblem|badge|insignia|picture|header_image|leader_image|flag_image|symbol)\s*=\s*([^|\n}]+)/i
    );
    if (infoboxFieldMatch && infoboxFieldMatch[1]) {
      const rawFile = infoboxFieldMatch[1]
        .replace(/\[\[(?:File|Image):/gi, "")
        .replace(/\]\]/g, "")
        .split(/[|\]}\n]/)[0]!
        .replace(/^(?:File|Image|file|image):/i, "")
        .trim();
      if (rawFile && !isNoticeOrUtilityIcon(rawFile)) return getImageUrl(rawFile);
    }
    const cleanWikitext = wikitext.replace(
      /^\{\{(?:Underconstruction|under_construction|WIP|work_in_progress|Stub|Cleanup|Ambox|Notice|Disambig|About|Short description)\b[\s\S]*?\}\}/gim,
      ""
    );
    const fileRegex = /\[\[(?:File|Image):([^|\]\n]+)[^\]]*\]\]/gi;
    let match: RegExpExecArray | null;
    while ((match = fileRegex.exec(cleanWikitext)) !== null) {
      const rawFile = match[1]?.trim();
      if (rawFile && !isNoticeOrUtilityIcon(rawFile)) return getImageUrl(rawFile);
    }
    return null;
  }

  const url = (file: string) => getImageUrl(file);

  describe("extractLeadImageFromWikitext", () => {
    it("takes the first infobox picture parameter, whatever its name", () => {
      expect(
        extractLeadImageFromWikitext(
          "{{Infobox country\n| name = Eurth\n| flag = Flag of Eurth.svg\n}}"
        )
      ).toBe(url("Flag of Eurth.svg"));
      expect(
        extractLeadImageFromWikitext("{{Infobox company\n|logo=Acme logo.png\n|image=Other.jpg}}")
      ).toBe(url("Acme logo.png"));
      for (const name of [
        "image",
        "company_logo",
        "coat_of_arms",
        "image_map",
        "album_cover",
        "symbol",
        "LOGO",
      ]) {
        expect(extractLeadImageFromWikitext(`{{Infobox\n| ${name} = A.png\n}}`)).toBe(url("A.png"));
      }
    });
    it("falls back to the first content file when the parameter is blank or a notice icon", () => {
      expect(extractLeadImageFromWikitext("| image = \n| x = 1\n[[File:Body.png|thumb|cap]]")).toBe(
        url("Body.png")
      );
      expect(extractLeadImageFromWikitext("| image = Ambox warning.png\n[[File:Body.png]]")).toBe(
        url("Body.png")
      );
    });

    it("skips notice templates at the top of a page, and notice icons among the files", () => {
      expect(
        extractLeadImageFromWikitext("{{Stub|[[File:Stub icon.png]]}}\n[[Image:Real.jpg|thumb]]")
      ).toBe(url("Real.jpg"));
      expect(extractLeadImageFromWikitext("[[File:Ambox notice.png]] [[File:Real.jpg]]")).toBe(
        url("Real.jpg")
      );
    });
    it("does not take a file name longer than MediaWiki allows for one", () => {
      expect(extractLeadImageFromWikitext(`| image = ${"a".repeat(1000)}.png`)).toBeNull();
      expect(extractLeadImageFromWikitext(`[[File:${"a".repeat(1000)}.png]]`)).toBeNull();
    });
  });

  describe("it answers what the regular-expression version answered", () => {
    const PIECES = [
      "[[",
      "]]",
      "[",
      "]",
      "|",
      "}",
      "{{",
      "}}",
      "{{Stub",
      "{{stub",
      "{{Notice",
      "{{Short description",
      "{{About",
      "File:",
      "Image:",
      "file:",
      "IMAGE:",
      "|image",
      "| image =",
      "|logo=",
      "| FLAG = ",
      "|map",
      "=",
      " ",
      "  ",
      "\n",
      "\r",
      "\t",
      " ",
      "a",
      "Flag.svg",
      "x.png",
      "A b.jpg",
      "ambox.png",
      "icon.png",
      "Real.jpg",
      "thumb",
      "200px",
      "stub",
      "_",
      "{",
      "}x",
    ];

    function random(seed: number): () => number {
      let state = seed;
      return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
      };
    }

    it("on 20,000 random small texts built from markup pieces", () => {
      const next = random(406);
      const disagreements: string[] = [];
      for (let i = 0; i < 20_000; i++) {
        const length = 1 + Math.floor(next() * 14);
        const text = Array.from({ length }, () => PIECES[Math.floor(next() * PIECES.length)]).join(
          ""
        );
        const expected = legacyExtractLeadImageFromWikitext(text);
        const actual = extractLeadImageFromWikitext(text);
        if (actual !== expected) disagreements.push(JSON.stringify({ text, expected, actual }));
      }
      expect(disagreements.slice(0, 5)).toEqual([]);
    });
  });

  describe("hostile input is read in linear time", () => {
    const BUDGET_MS = 100 * TIMING_BUDGET_SCALE;

    function ms(text: string): number {
      const started = performance.now();
      extractLeadImageFromWikitext(text);
      return performance.now() - started;
    }

    it("answers what the old version answered for a link that swallows the openers before it", () => {
      // The first opener runs to the first `]]` there is: the link of the real picture.
      const text = "[[File:a|x".repeat(10) + "\n[[File:Real.jpg]]";
      expect(extractLeadImageFromWikitext(text)).toBe(legacyExtractLeadImageFromWikitext(text));
      expect(extractLeadImageFromWikitext(text)).toBe(url("A"));
      expect(ms("[[File:a|x".repeat(100_000) + "\n[[File:Real.jpg]]")).toBeLessThan(BUDGET_MS);
    });
  });
});

describe("the stored lead image under any base path", () => {
  const BASE_PATH = "/projects/ixstats";
  const shard = (file: string) => getMd5ShardPath(file).fullPath;

  let savedBasePath: string | undefined;
  beforeEach(() => {
    savedBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
  });
  afterEach(() => {
    if (savedBasePath === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = savedBasePath;
  });

  describe("the stored form of a lead image", () => {
    it("is the canonical path, whatever base path the deployment is served at", () => {
      const wikitext = "{{Infobox country|image = Flag of Caphiria.svg}}";

      delete process.env.NEXT_PUBLIC_BASE_PATH;
      const atRoot = extractLeadImagePath(wikitext);
      process.env.NEXT_PUBLIC_BASE_PATH = BASE_PATH;
      const underBase = extractLeadImagePath(wikitext);

      expect(atRoot).toBe(`/images/${shard("Flag of Caphiria.svg")}`);
      expect(atRoot).toMatch(/^\/images\/[0-9a-f]\/[0-9a-f]{2}\/Flag_of_Caphiria\.svg$/);
      expect(underBase).toBe(atRoot);
      expect(getImagePath("Flag of Caphiria.svg")).toBe(atRoot);
    });
  });

  describe("resolveStoredImageUrl", () => {
    const canonical = `/images/${shard("Map.png")}`;

    it("loads a canonical path through the image proxy under the base path of the deployment", () => {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
      expect(resolveStoredImageUrl(canonical)).toBe(`/api/mediawiki/ixwiki${canonical}`);

      process.env.NEXT_PUBLIC_BASE_PATH = BASE_PATH;
      expect(resolveStoredImageUrl(canonical)).toBe(`${BASE_PATH}/api/mediawiki/ixwiki${canonical}`);
    });

    it("leaves a row written before as it is: a proxied path keeps the base path it was written under", () => {
      process.env.NEXT_PUBLIC_BASE_PATH = BASE_PATH;
      const legacy = `${BASE_PATH}/api/mediawiki/ixwiki${canonical}`;

      expect(resolveStoredImageUrl(legacy)).toBe(legacy);
      expect(resolveStoredImageUrl(`/api/mediawiki/ixwiki${canonical}`)).toBe(
        `/api/mediawiki/ixwiki${canonical}`
      );
    });

    it("proxies a stored absolute IxWiki URL as before, and leaves another host's alone", () => {
      delete process.env.NEXT_PUBLIC_BASE_PATH;

      expect(resolveStoredImageUrl(`https://ixwiki.com${canonical}`)).toBe(
        `/api/mediawiki/ixwiki${canonical}`
      );
      expect(resolveStoredImageUrl("https://example.org/pic.png")).toBe("https://example.org/pic.png");
    });
  });
});

describe("an infobox's money", () => {
  describe("parseMoney", () => {
    it.each([
      ["$45,000", 45_000],
      ["US$ 45,000", 45_000],
      ["USD 45,000", 45_000],
      ["£12,345.67", 12_346],
      ["$1.5 trillion", 1_500_000_000_000],
      ["€2.3 billion", 2_300_000_000],
      ["$1.2tn", 1_200_000_000_000],
      ["$45k", 45_000],
      ["{{formatnum:45000}}", 45_000],
      ["{{nowrap|$1.5 trillion}}", 1_500_000_000_000],
      ["45,000 (2025 est.)", 45_000],
      ["{{increase}} $45,000<ref>IMF, 2025</ref>", 45_000],
      ["approx. $1.5&nbsp;trillion", 1_500_000_000_000],
      ["[[United States dollar|$]]45,000", 45_000],
    ])("%s is %d", (text, expected) => {
      expect(parseMoney(text)).toBe(expected);
    });

    it.each([
      ["45 quadrillion"], // a magnitude it does not know: no leading-digits guess
      ["2.300.000"], // dots as thousand separators are ambiguous
      ["1,5 billion"], // a decimal comma likewise
      ["Ranked 12th"],
      ["$0"],
    ])("%s is not a figure", (text) => {
      expect(parseMoney(text)).toBeNull();
    });
  });

  describe("parseInfoboxWithTemplates reads GDP fields as money", () => {
    it("fills gdp_nominal and gdpPerCapita from currency-prefixed, trillion-scaled values", () => {
      const parsed = parseInfoboxWithTemplates(
        [
          "{{Infobox country",
          "| conventional_long_name = Federal Republic of Aurelia",
          "| population_estimate = 30,000,000",
          "| GDP_nominal = $1.5 trillion",
          "| GDP_nominal_per_capita = US$ 50,000",
          "| GDP_PPP = Int$ 2.1 trillion",
          "}}",
        ].join("\n"),
        "Aurelia"
      );
      expect(parsed).toMatchObject({
        population_estimate: 30_000_000,
        gdp_nominal: 1_500_000_000_000,
        gdpPerCapita: 50_000,
        gdp_ppp: 2_100_000_000_000,
      });
    });

    it("leaves a GDP it cannot read unset rather than misread", () => {
      const parsed = parseInfoboxWithTemplates(
        "{{Infobox country\n| GDP_nominal = 45 quadrillion\n}}",
        "Aurelia"
      );
      expect(parsed?.gdp_nominal).toBeUndefined();
    });
  });
});

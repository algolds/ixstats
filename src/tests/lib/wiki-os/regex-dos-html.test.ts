/** @jest-environment node */
/**
 * The linear rewrites of the HTML passes (plan F15, the regex-DoS sweep): the lead image of an article, the
 * transformer of MediaWiki's HTML, the featured-article card, the lead paragraph, the chips and the guards of the
 * passes that tidy a page in a DOM, each held against a verbatim copy of the code it replaced on random pages of
 * well-formed tags (the HTML a wiki serves) in many shapes. The gate that they are fast is regex-dos.test.ts.
 */
import { disagreements, fixtureTexts, randomTexts } from "../../helpers/wikitext-fuzz";
import { featuredArticleDetails } from "~/lib/wiki-os/main-page/featured-article";
import { leadParagraph } from "~/lib/wiki-os/main-page/lead-paragraph";
import { markTemplateChips } from "~/lib/wiki-os/templates/chip-markers";
import { extractTemplateKeys, rawChipsIn } from "~/lib/wiki-os/templates/template-resolver";
import {
  stripConflictingStyles,
  transformArticleHtml,
  transformImages,
} from "~/lib/wiki-os/transformers/html-transformer";
import {
  extractLeadImage,
  extractLeadImageFromHtml,
  isNoticeOrUtilityIcon,
  normalizeWikiImageUrl,
} from "~/lib/wiki-os/transformers/image-url";
import {
  DOM_DEPTH_CEILING,
  DOM_SIZE_CEILING,
  leavesAlone,
  nestsTooDeep,
} from "~/lib/wiki-os/transformers/inert-dom";
import { safeDecodeURI } from "~/lib/wiki-os/transformers/safe-decode";
import { slimArticleHtml } from "~/lib/wiki-os/transformers/slim-html";
import { featuredArticleDetails as legacyFeaturedArticleDetails } from "./legacy/featured-article";
import {
  stripConflictingStyles as legacyStripConflictingStyles,
  transformArticleHtml as legacyTransformArticleHtml,
  transformImages as legacyTransformImages,
} from "./legacy/html-transformer";

const fixtures = fixtureTexts();

// ---- image-url: the lead image of article HTML --------------------------------------------------------------
// `findLeadImage` as it was (verbatim, renamed): expressions over the whole page.

function legacyFindLeadImage(html: string | null | undefined): { tag: string; url: string } | null {
  if (!html || typeof html !== "string") return null;

  // 1. Strip out all known maintenance / notice / ambox blocks
  const cleanHtml = html
    .replace(
      /<table[^>]*class=["'][^"']*\b(?:ambox|tmbox|ombox|cmbox|fmbox|metadata|hatnote|dablink|stub|maint|wip)\b[^"']*["'][\s\S]*?<\/table>/gi,
      ""
    )
    .replace(
      /<div[^>]*class=["'][^"']*\b(?:ambox|metadata|hatnote|dablink|stub|wip|notice)\b[^"']*["'][\s\S]*?<\/div>/gi,
      ""
    )
    .replace(/<aside[^>]*class=["'][^"']*\b(?:notice|ambox)\b[^"']*["'][\s\S]*?<\/aside>/gi, "");

  // 2. First priority: Infobox image (<table class="infobox">, <aside class="portable-infobox">, .infobox-image)
  const infoboxMatch = cleanHtml.match(
    /<(?:table|aside)[^>]*class=["'][^"']*\b(?:infobox|portable-infobox)\b[^"']*["'][\s\S]*?<\/(?:table|aside)>/i
  );
  if (infoboxMatch) {
    const infoboxHtml = infoboxMatch[0];
    const infoboxImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = infoboxImgRegex.exec(infoboxHtml)) !== null) {
      const fullTag = imgMatch[0] || "";
      const src = imgMatch[1] || "";
      if (src && !isNoticeOrUtilityIcon(src)) {
        if (!/\b(?:width|height)=["'](?:1[0-9]|2[0-4]|[1-9])["']/i.test(fullTag)) {
          const normalized = normalizeWikiImageUrl(src);
          if (normalized) return { tag: fullTag, url: normalized };
        }
      }
    }
  }

  // 3. Second priority: Figure or Thumbimage (<figure>, <div class="thumb">, <img class="thumbimage">)
  const figureRegex =
    /<(?:figure|div)[^>]*class=["'][^"']*\b(?:thumb|mw-halign|mw-default-size|thumbinner)\b[^"']*["'][\s\S]*?<\/(?:figure|div)>/gi;
  let figMatch: RegExpExecArray | null;
  while ((figMatch = figureRegex.exec(cleanHtml)) !== null) {
    const figHtml = figMatch[0];
    const figImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = figImgRegex.exec(figHtml)) !== null) {
      const fullTag = imgMatch[0] || "";
      const src = imgMatch[1] || "";
      if (src && !isNoticeOrUtilityIcon(src)) {
        if (!/\b(?:width|height)=["'](?:1[0-9]|2[0-4]|[1-9])["']/i.test(fullTag)) {
          const normalized = normalizeWikiImageUrl(src);
          if (normalized) return { tag: fullTag, url: normalized };
        }
      }
    }
  }

  // 4. Third priority: Scan all remaining <img> tags in document order
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(cleanHtml)) !== null) {
    const fullTag = match[0] || "";
    const rawSrc = match[1] || "";
    if (!rawSrc) continue;

    if (isNoticeOrUtilityIcon(rawSrc)) continue;

    if (!/\b(?:width|height)=["'](?:1[0-9]|2[0-4]|[1-9])["']/i.test(fullTag)) {
      const normalized = normalizeWikiImageUrl(rawSrc);
      if (normalized) return { tag: fullTag, url: normalized };
    }
  }

  return null;
}

const HTML_TOKENS = [
  '<table class="infobox">',
  '<table class="infobox vcard ambox">',
  '<table class="ambox ambox-notice">',
  "<table class='x hatnote'>",
  "<table>",
  "</table>",
  '<div class="thumb tright">',
  '<div class="hatnote">',
  '<div class="thumbinner">',
  '<div class="notice-board">',
  '<div class="mw-halign-right">',
  "<div>",
  "</div>",
  '<figure class="mw-default-size">',
  '<figure typeof="mw:File/Thumb">',
  "</figure>",
  '<aside class="portable-infobox pi-theme">',
  '<aside class="notice">',
  "</aside>",
  '<img src="/images/a/ab/Flag.png" width="300" height="200" data-file-width="500" data-file-height="400">',
  '<img src="https://upload.wikimedia.org/wikipedia/commons/x.jpg">',
  "<img src='/images/b.png' width=\"10\">",
  '<img src="/images/thumb/c.svg/220px-c.svg.png" srcset="/images/c.png 2x">',
  '<img src="/images/Ambox_icon.png">',
  '<img alt="x">',
  '<img src="a.png" data-src="b.png">',
  '<IMG SRC="/images/up.png">',
  '<img src=""> ',
  '<imgx src="/images/q.png">',
  "<p>",
  "</p>",
  "text ",
  " ",
  "\n",
  '<a href="/wiki/X">',
  "</a>",
  '<span class="x">',
  "</span>",
  "<h2>",
  "a &gt; b",
];

describe("image-url: the lead image of article HTML, found by scanning for its tags", () => {
  const same = (html: string) => ({
    lead: extractLeadImage(html),
    url: extractLeadImageFromHtml(html),
  });
  const wasSame = (html: string) => {
    const found = legacyFindLeadImage(html);
    return {
      lead: found && {
        url: found.url,
        fileWidth: numberFrom(found.tag, "data-file-width"),
        fileHeight: numberFrom(found.tag, "data-file-height"),
      },
      url: found?.url ?? null,
    };
  };
  const numberFrom = (tag: string, name: string): number | null => {
    const value = Number(new RegExp(`\\b${name}=["'](\\d+)["']`, "i").exec(tag)?.[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
  };

  it("answers what it answered, on 30,000 random pages of tags", () => {
    expect(disagreements(randomTexts(HTML_TOKENS, 30_000, 91, 14), same, wasSame)).toEqual([]);
  });

  it("answers what it answered, on pages of the length articles are", () => {
    expect(disagreements(randomTexts(HTML_TOKENS, 3_000, 92, 120), same, wasSame)).toEqual([]);
  });
});

// ---- html-transformer ------------------------------------------------------------------------------------

const ARTICLE_TOKENS = [
  '<div class="mw-parser-output">',
  "</div>",
  '<table class="infobox vcard">',
  '<table class="infobox">',
  '<table class="ambox ambox-content">',
  "</table>",
  "<table>",
  "<tr><td>",
  "</td></tr>",
  '<div class="hatnote">',
  '<div class="dablink">',
  '<div class="messagebox">',
  '<div class="notice banner">',
  '<div class="mw-heading mw-heading2">',
  '<div class="mw-heading">',
  "<div>",
  '<h2 id="History">',
  '<h3 id="Early_years">',
  '<h2 id="">',
  "<h4>",
  '<h2 class="x">',
  "</h2>",
  "</h3>",
  '<span class="mw-editsection">[edit]</span>',
  '<span class="mw-editsection-bracket">[</span>',
  '<div id="toc">',
  '<div id="toc" class="toc">',
  '<aside class="portable-infobox">',
  "</aside>",
  '<aside class="x">',
  '<style data-mw-deduplicate="a">.skin-vector{}</style>',
  '<style data-mw-deduplicate="b">.infobox{}.skin-vector{}</style>',
  "<style>x</style>",
  '<style data-mw-deduplicate="c">.x{}</style>',
  '<img src="/images/a/ab/A.png" width="100">',
  '<img src="https://ixwiki.com/images/b.png">',
  '<img src="//ixwiki.com/images/c.png" srcset="/images/c.png 2x" loading="lazy">',
  '<img src="https://upload.wikimedia.org/wikipedia/commons/d.jpg" decoding="sync">',
  '<img width="5" src="/images/tiny.png">',
  '<img referrerpolicy="origin" src="/thumb/e.png">',
  "<img>",
  '<img alt="x" data-src="https://ixwiki.com/images/f.png" src="https://ixwiki.com/images/g.png">',
  '<a href="/wiki/Urcea">',
  '<a href="/wiki/Special:Search">',
  '<a href="/index.php?title=Foo&amp;action=edit&amp;redlink=1" class="new">',
  '<a href="/index.php?title=Special:Upload&wpDestFile=A.png">',
  "</a>",
  '<a class="new" href="/load.php">',
  "<p>",
  "</p>",
  "text ",
  " ",
  "\n",
  "<br>",
  "&nbsp;",
  "<ul><li>",
  "</li></ul>",
  "<b>",
  "</b>",
];

describe("html-transformer: the page's passes scan for tags", () => {
  const options = [["ixwiki"], ["iiwiki"]] as const;
  const texts = [
    ...randomTexts(ARTICLE_TOKENS, 25_000, 101, 16),
    ...randomTexts(ARTICLE_TOKENS, 1_500, 102, 120),
  ];

  it.each(options)("transformArticleHtml, for %s", (source) => {
    expect(
      disagreements(
        texts,
        (t) => transformArticleHtml(t, "/wiki", source),
        (t) => legacyTransformArticleHtml(t, "/wiki", source)
      )
    ).toEqual([]);
  });

  it("transformImages and stripConflictingStyles", () => {
    expect(
      disagreements(
        texts,
        (t) => transformImages(t),
        (t) => legacyTransformImages(t)
      )
    ).toEqual([]);
    expect(
      disagreements(
        texts,
        (t) => transformImages(t, "ixwiki", { eagerFirst: true }),
        (t) => legacyTransformImages(t, "ixwiki", { eagerFirst: true })
      )
    ).toEqual([]);
    expect(disagreements(texts, stripConflictingStyles, legacyStripConflictingStyles)).toEqual([]);
  });
});

// ---- main-page/featured-article ---------------------------------------------------------------------------

const CARD_TOKENS = [
  "<h3>",
  '<h3 class="x">',
  "</h3>",
  "<h3",
  '<a href="/wiki/Urcea">',
  '<a href="https://ixwiki.com/wiki/Aurelia_Nova" class="x">',
  '<a href="/wiki/A%20B" title="t">',
  '<a href="/other">',
  '<a class="x" href="/wiki/Last">',
  "<a>",
  "</a>",
  "<p>",
  '<p class="byline">',
  "</p>",
  "Featured article ",
  "text ",
  "by someone ",
  " ",
  "\n",
  "<b>",
  "</b>",
  "<i>x</i>",
  '<img src="/images/a.png" width="300">',
  '<img alt="x" src="https://ixwiki.com/images/b.png">',
  '<img src="/images/Ambox_icon.png">',
  "<pre>",
  "</pre>",
  "<div>",
  "</div>",
  "&amp; ",
  '<abbr href="/wiki/Abbr">',
  "<span>",
  "</span>",
];

describe("featured-article: the card is read by scanning for its tags", () => {
  const details = featuredArticleDetails;
  it("answers what it answered, on 40,000 random cards", () => {
    expect(
      disagreements(
        randomTexts(CARD_TOKENS, 40_000, 111, 14),
        details,
        legacyFeaturedArticleDetails
      )
    ).toEqual([]);
  });

  it("answers what it answered, on longer cards", () => {
    expect(
      disagreements(
        randomTexts(CARD_TOKENS, 3_000, 112, 100),
        details,
        legacyFeaturedArticleDetails
      )
    ).toEqual([]);
  });
});

// ---- main-page/lead-paragraph --------------------------------------------------------------------------------

/** `leadParagraph` as it was (it lived in main-page-service.ts): an expression over the page. */
function legacyLeadParagraph(html: string): string {
  const lead = (html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? []).find(
    (p) => p.length > 25 && !/infobox|mw-empty-elt/i.test(p)
  );
  return (lead ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

describe("lead-paragraph: the first real paragraph is found by scanning for its tags", () => {
  const TOKENS = [
    "<p>",
    "</p>",
    '<p class="x">',
    '<p class="mw-empty-elt">',
    "</p>\n",
    "<pre>",
    "</pre>",
    "<p>Short.</p>",
    "<p>A long enough paragraph of real prose that counts as the lead.</p>",
    '<p class="infobox">An infobox paragraph that is long enough to count.</p>',
    "text [1] more text ",
    " ",
    "\n",
    "<b>",
    "</b>",
    '<a href="/wiki/X">',
    "</a>",
    "<table>",
    "</table>",
    "<div>",
    "</div>",
  ];
  it("answers what it answered, on 40,000 random pages", () => {
    expect(
      disagreements(randomTexts(TOKENS, 40_000, 141, 14), leadParagraph, legacyLeadParagraph)
    ).toEqual([]);
  });
});

// ---- templates/template-resolver: raw chips found in one scan ---------------------------------------------

describe("rawChipsIn finds what the expression found", () => {
  const CHIP_TOKENS = [
    "{{MyCountry:",
    "{{CountryData:",
    "{{BusinessData:",
    "{{mycountry:",
    "}}",
    "}",
    "|",
    "a",
    ":",
    "x y",
    "{{",
    "{",
    "Template:MyCountry:gdp",
    "Template%3aCountryData%3aAurelia%3apop",
    '"',
    "?",
    "#",
    "&",
    '<a href="',
    ">",
    "gdp",
    "Aurelia",
  ];
  const expression = /\{\{(MyCountry|CountryData|BusinessData):([^|}]+)\}\}/g;

  it("the same chips in the same places", () => {
    const scanned = (text: string) =>
      [...rawChipsIn(text)].map((c) => [c.index, c.text, c.prefix, c.rest]);
    const matched = (text: string) =>
      [...text.matchAll(expression)].map((m) => [m.index, m[0], m[1], m[2]]);
    const texts = [...randomTexts(CHIP_TOKENS, 80_000, 71, 12), ...fixtures];
    expect(disagreements(texts, scanned, matched)).toEqual([]);
  });

  it("extractTemplateKeys answers what it did", () => {
    /** `extractTemplateKeys` as it was: the two expressions over the HTML. */
    const legacy = (html: string) => {
      const keys: string[] = [];
      const linkRegex =
        /Template(?::|%3a)((?:MyCountry|CountryData|BusinessData)(?::|%3a)[^"|?#&]+)/gi;
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(html)) !== null) keys.push(safeDecodeURI(match[1]!));
      const rawRegex = /\{\{(MyCountry|CountryData|BusinessData):([^|}]+)\}\}/g;
      while ((match = rawRegex.exec(html)) !== null) keys.push(`${match[1]}:${match[2]}`);
      return keys;
    };
    // Every key the expressions found, in a canonical form, is a key the function reports (and nothing else is).
    const reported = (html: string) =>
      extractTemplateKeys(html)
        .map((k) => k.key)
        .sort();
    const expected = (html: string) => {
      const keys = new Set<string>();
      for (const raw of legacy(html)) {
        const parts = raw.split(":");
        const category = parts[0]!.toLowerCase();
        if (parts.length < 2) continue;
        if (category === "mycountry") keys.add(`MyCountry:${parts[1]}`);
        else if (parts.length >= 3) {
          const head =
            category === "countrydata"
              ? "CountryData"
              : category === "businessdata"
                ? "BusinessData"
                : null;
          if (head) keys.add(`${head}:${parts[1]!.trim()}:${parts.slice(2).join(":")}`);
        }
      }
      return [...keys].sort();
    };
    expect(
      disagreements([...randomTexts(CHIP_TOKENS, 40_000, 72, 12), ...fixtures], reported, expected)
    ).toEqual([]);
  });
});

describe("a page nested too deep is left to the passes that only tidy it", () => {
  const nested = (open: string, depth: number) => open.repeat(depth);

  it("counts open tags, not closed ones, and no void element", () => {
    expect(nestsTooDeep(nested("<div>", DOM_DEPTH_CEILING))).toBe(false);
    expect(nestsTooDeep(nested("<div>", DOM_DEPTH_CEILING + 1))).toBe(true);
    expect(nestsTooDeep(nested("<div>x</div>", 50_000))).toBe(false);
    expect(nestsTooDeep(nested("<br><img src=a><hr>", 10_000))).toBe(false);
    expect(nestsTooDeep(nested("<s>", 6_000))).toBe(true);
    expect(nestsTooDeep("a < b <3 </ >")).toBe(false);
  });

  it("slimArticleHtml and markTemplateChips return such a page unchanged, at once", () => {
    const html = `${nested("<s>", 6_000)}{{MyCountry:gdp}}`;
    const started = performance.now();
    expect(slimArticleHtml(html)).toBe(html);
    expect(markTemplateChips(html)).toBe(html);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it("leaves a page over the size ceiling alone too, and one at it to the tidying passes", () => {
    const flat = (length: number) => `<p> a </p>${"b".repeat(length)}`.slice(0, length);
    expect(leavesAlone(flat(DOM_SIZE_CEILING))).toBe(false);
    expect(leavesAlone(flat(DOM_SIZE_CEILING + 1))).toBe(true);
    const big = `<p> a </p> {{MyCountry:gdp}}${"b".repeat(DOM_SIZE_CEILING)}`;
    expect(slimArticleHtml(big)).toBe(big);
    expect(markTemplateChips(big)).toBe(big);
  });

  it("still tidies a page of the depth articles have", () => {
    expect(slimArticleHtml('<div> <p>a</p> </div><a title="x">x</a>')).toBe(
      "<div><p>a</p></div><a>x</a>"
    );
  });
});

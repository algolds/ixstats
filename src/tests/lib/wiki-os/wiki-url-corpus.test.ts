/** @jest-environment node */
/**
 * The reader's addresses and the small facts around them, as tables: a path and what it is (a page view, a tool,
 * nothing), the link of every tool and remembered page, a wiki named in a URL (never a prototype key), the revisions
 * a ?diff= names, the section Add topic writes, what a mention card queries, how a stash types a title, and
 * MediaWiki's timestamps. Replaces article-route, page-tools, page-ref, wiki-source, diff-refs, new-section,
 * mention-target, hero-card, stash-content-type and mediawiki-timestamp.
 */
import { getArticleRoute, isNonArticlePath } from "~/lib/wiki-os/article-route";
import { pageEditHref, pageTalkPair } from "~/lib/wiki-os/page-tools";
import { isSamePage, pageRefPath, recentArticlesSchema } from "~/lib/wiki-os/page-ref";
import { articleHtmlInput, parseWikiSource, wikiReaderPath } from "~/lib/wiki-os/config";
import { diffNeedsHistory, resolveDiffRefs } from "~/lib/wiki-os/diff-refs";
import { appendNewSection, NEW_SECTION_HEADING } from "~/lib/wiki-os/wikitext/new-section";
import { findSectionLine } from "~/lib/wiki-os/wikitext/section-locator";
import { mentionQueries } from "~/lib/wiki-os/mention-target";
import { heroCardInputs, mayNameCountry } from "~/lib/wiki-os/hero-card";
import {
  isStashedArticle,
  isStashedForumThread,
  nativeThreadIdOf,
  nativeThreadTitle,
  stashContentTypeForTitle,
} from "~/lib/wiki-os/stash-content-type";
import { formatMWTimeAgo, parseMWDateObject, parseMWTimestamp } from "~/lib/wiki-os/adapters/mediawiki/timestamp";

describe("paths", () => {
  it.each<[string, string | undefined, ReturnType<typeof getArticleRoute>]>([
    ["/wiki/Aurelia", undefined, { title: "Aurelia", tab: "read" }],
    ["/wiki/Aurelia/", undefined, { title: "Aurelia", tab: "read" }],
    ["/wiki/Talk:Aurelia", undefined, { title: "Talk:Aurelia", tab: "talk" }],
    ["/wiki/Portal:Eurth", undefined, { title: "Portal:Eurth", tab: "read" }],
    ["/wiki/New_Aurelia%20City", undefined, { title: "New Aurelia City", tab: "read" }],
    ["/wiki/A/B", undefined, { title: "A/B", tab: "read" }],
    // a title that used to be a tool route is a page now (the old slugs redirect before this renders)
    ["/wiki/Search", undefined, { title: "Search", tab: "read" }],
    ["/util/history/Aurelia", undefined, { title: "Aurelia", tab: "history" }],
    ["/wiki/Aurelia", "edit", { title: "Aurelia", tab: "edit" }],
    ["/wiki/Talk:Aurelia", "history", { title: "Talk:Aurelia", tab: "history" }],
    ["/wiki", undefined, null],
    ["/wiki/Main_Page", undefined, null],
    ["/wiki/Special:Random", undefined, null],
    ["/wiki/special%3Arandom", undefined, null],
    ["/util/search", undefined, null],
    ["/util/history", undefined, null],
    ["/util/whatlinkshere/Aurelia", undefined, null],
    ["/stashes", undefined, null],
    ["/dashboard", undefined, null],
  ])("getArticleRoute(%s, %s)", (pathname, view, expected) => {
    expect(getArticleRoute(pathname, view as never)).toEqual(expected);
  });

  it.each([
    ["/wiki/Special:Random", true],
    ["/util/search", true],
    ["/wiki/Search", false],
    ["/wiki/Aurelia", false],
    ["/wiki/Talk:Aurelia", false],
  ])("isNonArticlePath(%s) is %s", (pathname, expected) => {
    expect(isNonArticlePath(pathname)).toBe(expected);
  });
});

describe("tool links", () => {
  it.each<[string, string | null, Record<string, string | null> | undefined, string]>([
    ["Foo bar", "Foo_bar", undefined, "/wiki/Foo_bar?action=edit"],
    ["Template:Foo/doc", "Template%3AFoo%2Fdoc", undefined, "/wiki/Template:Foo/doc?action=edit"],
    ["foo_bar", null, undefined, "/wiki/Foo_bar?action=edit"],
    ["Foo bar", null, { mode: "visual" }, "/wiki/Foo_bar?action=edit&mode=visual"],
    ["Foo", null, { mode: "source", prefill: "{{Infobox}}\n" }, "/wiki/Foo?action=edit&mode=source&prefill=%7B%7BInfobox%7D%7D%0A"],
    ["Foo", null, { mode: "source", prefill: null }, "/wiki/Foo?action=edit&mode=source"],
    ["a[b c", null, { mode: "visual" }, "/wiki/a%5Bb_c?action=edit&mode=visual"],
    // a text that is not a title keeps the page's own slug
    ["a[b", "a%5Bb", undefined, "/wiki/a%5Bb?action=edit"],
    ["a[b", null, undefined, "/wiki/a%5Bb?action=edit"],
  ])("pageEditHref(%j, %j, %j) is %s", (title, slug, params, expected) => {
    expect(pageEditHref(title, slug, params as never)).toBe(expected);
  });

  it.each([
    ["Foo bar", { page: { title: "Talk:Foo bar" }, isTalk: false }],
    ["User:Jane", { page: { title: "User talk:Jane" }, isTalk: false }],
    ["Talk:Foo bar", { page: { title: "Foo bar" }, isTalk: true }],
    ["Special:Random", null],
    ["a[b", null],
  ])("pageTalkPair(%s)", (title, expected) => {
    if (expected === null) expect(pageTalkPair(title)).toBeNull();
    else expect(pageTalkPair(title)).toMatchObject(expected);
  });

  it.each([
    ["Pelaxia", true],
    ["Economy of Urcea", true],
    ["Main Page", false],
    ["Main_Page", false],
    ["  ", false],
    ["Talk:Pelaxia", false],
    ["Category:Countries", false],
  ])("mayNameCountry(%j) is %s", (title, expected) => {
    expect(mayNameCountry(title)).toBe(expected);
  });

  it("asks the hero card's reads with the inputs the procedures take", () => {
    expect(heroCardInputs("Pelaxia")).toEqual({
      parentCategories: { title: "Pelaxia" },
      awards: { title: "Pelaxia" },
      country: { id: "Pelaxia" },
    });
  });
});

describe("pages on several wikis", () => {
  it.each(["ixwiki", "iiwiki", "althistory"])("parseWikiSource keeps %s", (source) => {
    expect(parseWikiSource(source)).toBe(source);
  });
  it.each([null, undefined, "", "eurth", "IIWIKI", "toString", "__proto__", "constructor"])("parseWikiSource reads %p as ixwiki", (value) => {
    expect(parseWikiSource(value)).toBe("ixwiki");
  });

  it.each<[string, "ixwiki" | "iiwiki" | "althistory" | undefined, string]>([
    ["United Kingdom of Aurelia", undefined, "/wiki/United_Kingdom_of_Aurelia"],
    ["Aurelia", "ixwiki", "/wiki/Aurelia"],
    ["Portal:Eurth", "iiwiki", "/wiki/Portal%3AEurth?source=iiwiki"],
    ["Gallambria", "althistory", "/wiki/Gallambria?source=althistory"],
  ])("wikiReaderPath(%j, %s) is %s", (title, source, expected) => {
    expect(wikiReaderPath(title, source)).toBe(expected);
  });

  it("encodes a title so it survives the reader's decodeURIComponent, and names the wiki in the article query", () => {
    const path = wikiReaderPath("Côte d'Or & Sons?", "iiwiki");
    expect(decodeURIComponent(path.slice("/wiki/".length, path.indexOf("?source="))).replace(/_/g, " ")).toBe("Côte d'Or & Sons?");
    expect(articleHtmlInput("Aurelia", "ixwiki")).toEqual({ title: "Aurelia" });
    expect(articleHtmlInput("Portal:Eurth", "iiwiki")).toEqual({ title: "Portal:Eurth", wikiSource: "iiwiki" });
  });

  it("remembers pages with their wiki: stored bare titles read as IxWiki's, the same title on two wikis is two pages", () => {
    expect(recentArticlesSchema.parse(["Aurelia", { title: "Portal:Eurth", source: "iiwiki" }, { title: "Borea", source: "nonsense" }])).toEqual([
      { title: "Aurelia" },
      { title: "Portal:Eurth", source: "iiwiki" },
      { title: "Borea", source: "ixwiki" },
    ]);
    expect(recentArticlesSchema.safeParse([{ nope: 1 }]).success).toBe(false);
    expect(pageRefPath({ title: "Portal:Eurth", source: "iiwiki" })).toBe("/wiki/Portal%3AEurth?source=iiwiki");
    expect(pageRefPath({ title: "United Kingdom of Aurelia" })).toBe("/wiki/United_Kingdom_of_Aurelia");
    expect(isSamePage({ title: "Gallambria", source: "iiwiki" }, "Gallambria", "iiwiki")).toBe(true);
    expect(isSamePage({ title: "Gallambria", source: "iiwiki" }, "Gallambria", "ixwiki")).toBe(false);
    expect(isSamePage({ title: "Gallambria" }, "Gallambria", "ixwiki")).toBe(true);
  });
});

describe("diffs and sections", () => {
  const HISTORY = ["9", "7", "5", "3"]; // newest first, as the history lists them
  it.each<[string, { oldid: string | null; diff: string }, string[], ReturnType<typeof resolveDiffRefs>]>([
    ["?diff=<ref>&oldid=<ref> compares the two", { oldid: "5", diff: "9" }, [], { fromrev: "5", torev: "9" }],
    ["?diff=<ref> alone is what that revision changed", { oldid: null, diff: "7" }, [], { fromrev: undefined, torev: "7" }],
    ["?diff=prev&oldid=N is what N changed", { oldid: "5", diff: "prev" }, [], { fromrev: undefined, torev: "5" }],
    ["?diff=prev needs an oldid", { oldid: null, diff: "prev" }, [], null],
    ["?diff=next&oldid=N compares N with the revision after it", { oldid: "5", diff: "next" }, HISTORY, { fromrev: "5", torev: "7" }],
    ["?diff=next of the newest is nothing", { oldid: "9", diff: "next" }, HISTORY, null],
    ["?diff=next of a revision not in the history is nothing", { oldid: "4", diff: "next" }, HISTORY, null],
    ["?diff=next needs an oldid", { oldid: null, diff: "next" }, HISTORY, null],
    ["?diff=cur compares with the newest revision", { oldid: "3", diff: "cur" }, HISTORY, { fromrev: "3", torev: "9" }],
    ["?diff=cur alone is the newest revision's change", { oldid: null, diff: "cur" }, HISTORY, { fromrev: undefined, torev: "9" }],
    ["?diff=cur needs the history", { oldid: "3", diff: "cur" }, [], null],
  ])("%s", (_behaviour, refs, history, expected) => {
    expect(resolveDiffRefs(refs, history)).toEqual(expected);
  });

  it("only next and cur need the history", () => {
    expect(["next", "cur", "prev", "9"].map((diff) => diffNeedsHistory({ oldid: "5", diff }))).toEqual([true, true, false, false]);
  });

  it.each([
    ["Hello.\n", "Hello.\n\n== New topic ==\n\n"],
    ["Hello.\n\n\n", "Hello.\n\n== New topic ==\n\n"],
    ["", "== New topic ==\n\n"],
    ["  \n", "== New topic ==\n\n"],
  ])("Add topic appends an empty level-2 section to %j", (text, expected) => {
    expect(appendNewSection(text)).toBe(expected);
  });

  it("puts the editor's cursor target, the heading, where the section locator finds it", () => {
    expect(findSectionLine(appendNewSection("== Earlier ==\nOld topic."), NEW_SECTION_HEADING)).toBe(4);
  });
});

describe("mentions and stashes", () => {
  it("a mention card queries the profile it names, once open", () => {
    expect(mentionQueries(true, "/dashboard/profile/jane_doe")).toEqual({ entityId: "jane_doe", league: false, club: false, country: false, user: true });
    expect(mentionQueries(false, "/dashboard/profile/jane_doe").user).toBe(false);
    expect(mentionQueries(true, "/myleague/l1")).toMatchObject({ entityId: "l1", league: true });
    expect(mentionQueries(true, "/countries/Caphiria")).toMatchObject({ country: true });
  });

  it.each(["/dashboard/profile/@jane", "/dashboard/profile/%20jane", "/countries/"])("a mention card queries nothing for %s, whose id is empty", (href) => {
    expect(mentionQueries(true, href)).toEqual({ entityId: "", league: false, club: false, country: false, user: false });
  });

  it.each([
    ["thinkpages:thread:t1", "forum_thread"],
    ["forum:thread:7", "forum_thread"],
    ["commons:File.png", "image"],
    ["Rome", "wiki"],
  ])("a stash types %s as %s", (title, type) => {
    expect(stashContentTypeForTitle(title)).toBe(type);
  });

  it("reads a native thread's id back from its title only, and keeps native threads out of the articles", () => {
    expect(nativeThreadIdOf("thinkpages:thread:t1")).toBe("t1");
    expect(nativeThreadIdOf("thinkpages:thread:")).toBeNull();
    expect(nativeThreadIdOf("forum:thread:7")).toBeNull();
    expect(nativeThreadTitle("t1")).toBe("thinkpages:thread:t1");
    expect(nativeThreadIdOf(nativeThreadTitle("t1"))).toBe("t1");
    const items = [
      { contentType: "forum_thread", pageTitle: "thinkpages:thread:t1" },
      { contentType: "forum_thread", pageTitle: "forum:thread:7" },
      { contentType: "wiki", pageTitle: "Rome" },
      { pageTitle: "thinkpages:thread:t1" },
    ];
    expect(items.map(isStashedForumThread)).toEqual([true, true, false, true]);
    expect(items.map(isStashedArticle)).toEqual([false, false, true, false]);
  });
});

describe("MediaWiki's timestamps", () => {
  it.each([
    ["20260818163557", "2026-08-18T16:35:57Z"],
    ["2026-08-18T18:07:34Z", "2026-08-18T18:07:34.000Z"],
    [null, null],
    [undefined, null],
    ["", null],
    ["invalid-date-string-xyz", null],
  ])("parseMWTimestamp(%p) is %p", (input, expected) => {
    expect(parseMWTimestamp(input)).toBe(expected);
  });

  it("reads the 14-digit form as a Date, nothing as null, and says how long ago a time was", () => {
    expect(parseMWDateObject("20260818163557")?.toISOString()).toBe("2026-08-18T16:35:57.000Z");
    expect([null, undefined, ""].map((input) => parseMWDateObject(input))).toEqual([null, null, null]);
    const now = Date.now();
    expect(formatMWTimeAgo(new Date(now - 10 * 60 * 1000).toISOString())).toBe("10m ago");
    expect(formatMWTimeAgo(new Date(now - 2 * 60 * 60 * 1000).toISOString())).toBe("2h ago");
  });
});

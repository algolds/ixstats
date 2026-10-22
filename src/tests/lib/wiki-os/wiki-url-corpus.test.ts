/** @jest-environment node */
/**
 * The reader's addresses and the small facts around them, as tables: canonical titles (namespaces, case, forbidden
 * characters, path segments, the 255-byte cap, another wiki's rules), the path a URL names (views, revisions, diffs,
 * special pages, never an Object prototype key, a canonical URL that cannot loop), redirects as MediaWiki reads them,
 * which paths a standalone WikiOS serves and which it sends to IxStates, the link of every tool and remembered page, a
 * wiki named in a URL, the revisions a ?diff= names, the section Add topic writes, what a mention card queries, how a
 * stash types a title, and MediaWiki's timestamps.
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
import { isStashedArticle, isStashedForumThread, nativeThreadIdOf, nativeThreadTitle, stashContentTypeForTitle } from "~/lib/wiki-os/stash-content-type";
import { formatMWTimeAgo, parseMWDateObject, parseMWTimestamp } from "~/lib/wiki-os/adapters/mediawiki/timestamp";
import { canonicalizeTitle, decodeTitleParam, storedNamespace } from "~/lib/wiki-os/core/title";
import { canonicalPathRedirect, resolveWikiPath, type WikiPathTarget } from "~/lib/wiki-os/wiki-path";
import { parseRedirect } from "~/lib/wiki-os/core/redirect";
import { isWikiStandalone, WikiStandaloneConfigError, wikiStandaloneRedirect } from "~/lib/system/wikios-standalone";

describe("paths", () => {
  it.each<[string, string | undefined, ReturnType<typeof getArticleRoute>]>([
    ["/wiki/Aurelia", undefined, { title: "Aurelia", tab: "read" }],
    ["/wiki/Talk:Aurelia", undefined, { title: "Talk:Aurelia", tab: "talk" }],
    ["/wiki/New_Aurelia%20City", undefined, { title: "New Aurelia City", tab: "read" }],
    ["/wiki/A/B", undefined, { title: "A/B", tab: "read" }],
    // a title that used to be a tool route is a page now (the old slugs redirect before this renders)
    ["/wiki/Search", undefined, { title: "Search", tab: "read" }],
    ["/util/history/Aurelia", undefined, { title: "Aurelia", tab: "history" }],
    ["/wiki/Aurelia", "edit", { title: "Aurelia", tab: "edit" }],
    ["/wiki/special%3Arandom", undefined, null],
    ["/util/search", undefined, null],
    ["/stashes", undefined, null],
    ["/dashboard", undefined, null],
  ])("getArticleRoute(%s, %s)", (pathname, view, expected) => {
    expect(getArticleRoute(pathname, view as never)).toEqual(expected);
  });

  it.each([
    ["/wiki/Special:Random", true],
    ["/util/search", true],
    ["/wiki/Search", false],
  ])("isNonArticlePath(%s) is %s", (pathname, expected) => {
    expect(isNonArticlePath(pathname)).toBe(expected);
  });
});

describe("tool links", () => {
  it.each<[string, string | null, Record<string, string | null> | undefined, string]>([
    ["Foo bar", "Foo_bar", undefined, "/wiki/Foo_bar?action=edit"],
    ["Template:Foo/doc", "Template%3AFoo%2Fdoc", undefined, "/wiki/Template:Foo/doc?action=edit"],
    ["Foo", null, { mode: "source", prefill: "{{Infobox}}\n" }, "/wiki/Foo?action=edit&mode=source&prefill=%7B%7BInfobox%7D%7D%0A"],
    ["a[b c", null, { mode: "visual" }, "/wiki/a%5Bb_c?action=edit&mode=visual"],
    // a text that is not a title keeps the page's own slug
    ["a[b", "a%5Bb", undefined, "/wiki/a%5Bb?action=edit"],
  ])("pageEditHref(%j, %j, %j) is %s", (title, slug, params, expected) => {
    expect(pageEditHref(title, slug, params as never)).toBe(expected);
  });

  it.each([
    ["Foo bar", { page: { title: "Talk:Foo bar" }, isTalk: false }],
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
    ["Talk:Pelaxia", false],
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
  it.each([null, "eurth", "IIWIKI", "__proto__", "constructor"])("parseWikiSource reads %p as ixwiki", (value) => {
    expect(parseWikiSource(value)).toBe("ixwiki");
  });

  it.each<[string, "ixwiki" | "iiwiki" | "althistory" | undefined, string]>([
    ["United Kingdom of Aurelia", undefined, "/wiki/United_Kingdom_of_Aurelia"],
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
    ["?diff=prev&oldid=N is what N changed", { oldid: "5", diff: "prev" }, [], { fromrev: undefined, torev: "5" }],
    ["?diff=prev needs an oldid", { oldid: null, diff: "prev" }, [], null],
    ["?diff=next&oldid=N compares N with the revision after it", { oldid: "5", diff: "next" }, HISTORY, { fromrev: "5", torev: "7" }],
    ["?diff=next of the newest is nothing", { oldid: "9", diff: "next" }, HISTORY, null],
    ["?diff=cur compares with the newest revision", { oldid: "3", diff: "cur" }, HISTORY, { fromrev: "3", torev: "9" }],
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

describe("canonical titles", () => {
  const titleOf = (raw: string): string | undefined => canonicalizeTitle(raw)?.title;

  describe("canonicalizeTitle", () => {
    it("turns underscores into spaces and upper-cases only the first letter", () => {
      expect(titleOf("foo_bar")).toBe("Foo bar");
      expect(titleOf("  foo   bar  ")).toBe("Foo bar");
      expect(titleOf("fooBar_bAZ")).toBe("FooBar bAZ");
    });

    it("keeps an all-caps title and capitalises a lower-case one (NATO vs Nato stay distinct)", () => {
      expect(titleOf("NATO")).toBe("NATO");
      expect(titleOf("nato")).toBe("Nato");
      expect(canonicalizeTitle("NATO")?.slug).toBe(canonicalizeTitle("nato")?.slug);
    });

    it("writes a recognised namespace prefix in its canonical form, case-insensitively", () => {
      const talk = canonicalizeTitle("user talk:jane_doe");
      expect(talk).toMatchObject({
        title: "User talk:Jane doe",
        namespaceId: 3,
        namespacePrefix: "User talk",
        base: "Jane doe",
        slug: "user_talk:jane_doe",
        urlPath: "User_talk:Jane_doe",
      });
      expect(titleOf("TEMPLATE:infobox country")).toBe("Template:Infobox country");
      expect(titleOf("module:foo")).toBe("Module:Foo");
    });

    it("knows IxWiki's Campaign namespaces (460, 461) next to the standard ones", () => {
      expect(canonicalizeTitle("campaign:operation dawn")).toMatchObject({
        title: "Campaign:Operation dawn",
        namespaceId: 460,
        namespacePrefix: "Campaign",
        slug: "campaign:operation_dawn",
      });
      expect(canonicalizeTitle("Campaign_talk:Operation dawn")).toMatchObject({
        title: "Campaign talk:Operation dawn",
        namespaceId: 461,
        namespacePrefix: "Campaign talk",
      });
    });

    it("keeps Portal: as a plain main-namespace title (IxWiki has no such namespace)", () => {
      expect(canonicalizeTitle("portal:eurth")).toMatchObject({
        title: "Portal:eurth",
        namespaceId: 0,
        namespacePrefix: null,
      });
    });

    it("resolves namespace aliases to the canonical name", () => {
      expect(titleOf("Image:x.png")).toBe("File:X.png");
      expect(titleOf("ixwiki:About")).toBe("IxWiki:About");
      expect(titleOf("project talk:rules")).toBe("IxWiki talk:Rules");
    });
    it("splits the fragment off the title", () => {
      expect(canonicalizeTitle("Foo#Bar_baz")).toMatchObject({ title: "Foo", fragment: "Bar baz" });
      expect(canonicalizeTitle("Foo#")).toMatchObject({ title: "Foo", fragment: null });
      expect(canonicalizeTitle("Foo")?.fragment).toBeNull();
      expect(canonicalizeTitle("#Bar")).toBeNull();
    });

    it("keeps a character whose upper-case form is several characters", () => {
      expect(titleOf("ßtraße")).toBe("ßtraße");
    });
    it("treats an astral first character as one code point", () => {
      const title = titleOf("𝒜bc");
      expect(title).toBe("𝒜bc");
      expect(Array.from(title ?? "")).toHaveLength(3);
      expect(title).toHaveLength(4);
      expect(titleOf("𐐨bc")).toBe("𐐀bc");
    });
    it("refuses the characters MediaWiki forbids in a title", () => {
      for (const bad of ["a[b", "a]b", "a{b", "a}b", "a|b", "a<b", "a>b"]) {
        expect(canonicalizeTitle(bad)).toBeNull();
      }
    });

    it("refuses a page name longer than 255 UTF-8 bytes", () => {
      expect(canonicalizeTitle("a".repeat(255))).not.toBeNull();
      expect(canonicalizeTitle("a".repeat(256))).toBeNull();
      expect(canonicalizeTitle("é".repeat(128))).toBeNull();
      expect(canonicalizeTitle("é".repeat(127))).not.toBeNull();
    });

    it("produces identical output for composed and decomposed input", () => {
      const composed = canonicalizeTitle("école");
      const decomposed = canonicalizeTitle("école");
      expect(decomposed).toEqual(composed);
      expect(composed?.title).toBe("École");
    });

    it("round-trips a title with a percent sign through urlPath and decodeTitleParam", () => {
      const canon = canonicalizeTitle("100% Pure");
      expect(canon?.urlPath).toBe("100%25_Pure");
      expect(canonicalizeTitle(decodeTitleParam(canon?.urlPath ?? ""))?.title).toBe("100% Pure");
    });
  });

  describe("canonicalizeTitle: MediaWiki's invalid titles (Title::secureAndSplit)", () => {
    it("refuses control characters, wherever they are", () => {
      for (const bad of ["a\u0000b", "a\tb", "a\nb", "a\rb", "a\u001Fb", "a\u007Fb", "\u0001a"]) {
        expect(canonicalizeTitle(bad)).toBeNull();
      }
      expect(canonicalizeTitle("Talk:a\nb")).toBeNull();
      expect(canonicalizeTitle("a\u0080b")).not.toBeNull();
    });

    it("refuses a percent followed by two hex digits, but not a bare percent", () => {
      expect(canonicalizeTitle("a%41b")).toBeNull();
      expect(canonicalizeTitle("a%e9b")).toBeNull();
      expect(canonicalizeTitle("Talk:100%25")).toBeNull();
      expect(titleOf("100% Pure")).toBe("100% Pure");
      expect(titleOf("a%4")).toBe("A%4");
      expect(titleOf("a%zz")).toBe("A%zz");
    });

    it("refuses relative path segments", () => {
      for (const bad of [
        ".",
        "..",
        "./a",
        "../a",
        "a/./b",
        "a/../b",
        "a/.",
        "a/..",
        "Talk:..",
        "Talk:a/../b",
      ]) {
        expect(canonicalizeTitle(bad)).toBeNull();
      }
      for (const fine of ["...", "a/b", "a/.b", "a./b", "a/..b", "Wait...", ".hidden", "a.b/c.d"]) {
        expect(canonicalizeTitle(fine)).not.toBeNull();
      }
    });

    it("refuses the signature magic word", () => {
      expect(canonicalizeTitle("a~~~b")).toBeNull();
      expect(canonicalizeTitle("Talk:~~~")).toBeNull();
      expect(titleOf("a~~b")).toBe("A~~b");
    });

    it("refuses a namespace prefix followed by an empty or colon-leading name", () => {
      expect(canonicalizeTitle("Talk:")).toBeNull();
      expect(canonicalizeTitle("Talk: ")).toBeNull();
      expect(canonicalizeTitle("Talk::Foo")).toBeNull();
      expect(canonicalizeTitle("user talk:_:x")).toBeNull();
      expect(titleOf("Talk:Foo:bar")).toBe("Talk:Foo:bar");
    });
  });

  describe("canonicalizeTitle for another wiki", () => {
    const foreign = (raw: string, source = "iiwiki") => canonicalizeTitle(raw, { source });

    it("never applies IxWiki's namespace table", () => {
      expect(foreign("project:Foo")).toMatchObject({
        title: "Project:Foo",
        namespaceId: 0,
        namespacePrefix: null,
        base: "Project:Foo",
      });
      expect(foreign("image:x.png")?.title).toBe("Image:x.png");
      expect(foreign("ixwiki:about")?.title).toBe("Ixwiki:about");
      expect(foreign("user talk:jane")?.title).toBe("User talk:jane");
    });
  });

  describe("storedNamespace", () => {
    it("keeps MediaWiki's namespace and the title's own prefix for one the table lacks", () => {
      const canon = canonicalizeTitle("Portal:Eurth");
      expect(canon && storedNamespace(canon, 100)).toEqual({
        namespaceId: 100,
        namespacePrefix: "Portal",
      });
    });
  });

  describe("decodeTitleParam", () => {
    it("returns a malformed segment untouched instead of throwing", () => {
      expect(decodeTitleParam("%E0%A4%A")).toBe("%E0%A4%A");
      expect(decodeTitleParam("100% Pure")).toBe("100% Pure");
    });
  });
});

describe("the path a URL names", () => {
  function article(target: WikiPathTarget) {
    if (target.kind !== "article") throw new Error(`expected an article, got ${target.kind}`);
    return target;
  }

  describe("resolveWikiPath: articles", () => {
    it("reads a plain title, canonicalised", () => {
      const target = article(resolveWikiPath(["foo_bar"]));
      expect(target.canon.title).toBe("Foo bar");
      expect(target.source).toBe("ixwiki");
      expect(target.view).toEqual({ type: "read", followRedirect: true, redirectedFrom: null });
    });
    it("decodes each segment once", () => {
      expect(article(resolveWikiPath(["100%25_Pure"])).canon.title).toBe("100% Pure");
      expect(article(resolveWikiPath(["Portal%3AEurth"])).canon.title).toBe("Portal:Eurth");
    });

    it("refuses a title MediaWiki would refuse", () => {
      expect(resolveWikiPath(["a%5Bb"])).toEqual({ kind: "invalid", raw: "a[b" });
      expect(resolveWikiPath(["..", "x"]).kind).toBe("invalid");
    });
    it("?action=edit opens the editor: source by default, visual on request, source for a section", () => {
      expect(article(resolveWikiPath(["Foo"], { action: "edit" })).view).toEqual({
        type: "edit",
        section: null,
        mode: "source",
      });
      expect(
        article(resolveWikiPath(["Foo"], { action: "edit", mode: "visual" })).view
      ).toMatchObject({ mode: "visual" });
      expect(article(resolveWikiPath(["Foo"], { veaction: "edit" })).view).toMatchObject({
        mode: "visual",
      });
      expect(
        article(resolveWikiPath(["Foo"], { action: "edit", mode: "visual", section: "Geography" }))
          .view
      ).toEqual({ type: "edit", section: "Geography", mode: "source" });
      expect(
        article(resolveWikiPath(["Talk:Foo"], { action: "edit", section: "new" })).view
      ).toMatchObject({ section: "new" });
    });

    it("?oldid=5 is one old revision", () => {
      expect(article(resolveWikiPath(["Foo"], { oldid: "5" })).view).toEqual({
        type: "revision",
        ref: "5",
      });
      expect(article(resolveWikiPath(["Foo"], { oldid: "ckx12abc" })).view).toEqual({
        type: "revision",
        ref: "ckx12abc",
      });
    });

    it("?diff=prev&oldid=5, ?diff=9&oldid=5 and ?diff=cur are diffs", () => {
      expect(article(resolveWikiPath(["Foo"], { diff: "prev", oldid: "5" })).view).toEqual({
        type: "diff",
        oldid: "5",
        diff: "prev",
      });
      expect(article(resolveWikiPath(["Foo"], { diff: "9", oldid: "5" })).view).toEqual({
        type: "diff",
        oldid: "5",
        diff: "9",
      });
      expect(article(resolveWikiPath(["Foo"], { diff: "0", oldid: "5" })).view).toEqual({
        type: "diff",
        oldid: "5",
        diff: "cur",
      });
      expect(article(resolveWikiPath(["Foo"], { diff: "9" })).view).toEqual({
        type: "diff",
        oldid: null,
        diff: "9",
      });
    });

    it("a revision reference that cannot be one is invalid, never the current page", () => {
      expect(resolveWikiPath(["Foo"], { oldid: "5;drop" }).kind).toBe("invalid");
      expect(resolveWikiPath(["Foo"], { diff: "a b" }).kind).toBe("invalid");
      expect(resolveWikiPath(["Foo"], { action: "raw", oldid: "x y" }).kind).toBe("invalid");
    });

    it("?redirect=no shows the redirect page itself; ?rdfrom= names where the reader came from", () => {
      expect(article(resolveWikiPath(["Foo"], { redirect: "no" })).view).toMatchObject({
        type: "read",
        followRedirect: false,
      });
      expect(article(resolveWikiPath(["Foo"], { rdfrom: "old_name" })).view).toMatchObject({
        redirectedFrom: "Old name",
      });
      expect(article(resolveWikiPath(["Foo"], { rdfrom: "a[b" })).view).toMatchObject({
        redirectedFrom: null,
      });
    });
    it("another wiki's page is only read, under that wiki's own title rules", () => {
      const target = article(
        resolveWikiPath(["project%3Afoo"], { source: "althistory", action: "edit" })
      );
      expect(target.source).toBe("althistory");
      expect(target.canon.title).toBe("Project:foo");
      expect(target.view).toMatchObject({ type: "read" });
      expect(resolveWikiPath(["Special:Random"], { source: "iiwiki" }).kind).toBe("article");
      expect(resolveWikiPath(["recent-changes"], { source: "iiwiki" }).kind).toBe("article");
    });
  });

  describe("resolveWikiPath: Special pages", () => {
    const special = (path: string[], query: Record<string, string> = {}) => {
      const target = resolveWikiPath(path, query);
      if (target.kind !== "special") throw new Error(`expected a special page, got ${target.kind}`);
      return target.action;
    };

    it("Special:Diff/12/13 is the diff from 12 to 13, Special:Diff/12 the change 12 made", () => {
      expect(special(["Special:Diff", "12", "13"])).toEqual({
        type: "redirect",
        href: "/util/diff?from=12&to=13",
      });
      expect(special(["Special:Diff", "12"])).toEqual({ type: "redirect", href: "/util/diff?to=12" });
      expect(special(["Special:Diff", "1", "2", "3"])).toEqual({ type: "unknown" });
      expect(special(["Special:Diff", "a b"])).toEqual({ type: "unknown" });
    });
    it("knows a special page by any spelling of its name", () => {
      for (const name of [
        "Special:RecentChanges",
        "special:recent_changes",
        "Special%3ARecent-Changes",
      ]) {
        expect(special([name])).toEqual({ type: "redirect", href: "/util/recent-changes" });
      }
      expect(special(["Special:SpecialPages"])).toEqual({ type: "redirect", href: "/util" });
      expect(special(["Special:"])).toEqual({ type: "redirect", href: "/util" });
      expect(special(["Special:Watchlist"])).toEqual({ type: "redirect", href: "/util/watchlist" });
      expect(special(["Special:Categories"])).toEqual({ type: "redirect", href: "/util/categories" });
      expect(special(["Special:Export"])).toEqual({ type: "redirect", href: "/util/export" });
      expect(special(["Special:Import"])).toEqual({ type: "redirect", href: "/util/import" });
      // plan 411: Special:Upload is WikiOS's own upload page, and keeps MediaWiki's destination-file parameter
      expect(special(["Special:Upload"])).toEqual({ type: "redirect", href: "/util/upload" });
      expect(special(["Special:Upload"], { wpDestFile: "Flag_of_Eurth.png" })).toEqual({
        type: "redirect",
        href: "/util/upload?wpDestFile=Flag_of_Eurth.png",
      });
    });
    it("an unknown special page is unknown, and so is anything inherited from Object", () => {
      expect(special(["Special:NoSuchThing"])).toEqual({ type: "unknown" });
      for (const name of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
        expect(special([`Special:${name}`])).toEqual({ type: "unknown" });
      }
    });
  });

  describe("resolveWikiPath: the rights-model special pages (plan 409)", () => {
    const special = (path: string[], query: Record<string, string> = {}) => {
      const target = resolveWikiPath(path, query);
      if (target.kind !== "special") throw new Error(`expected a special page, got ${target.kind}`);
      return target.action;
    };
    const to = (href: string) => ({ type: "redirect", href });

    it("Special:Log[/type] is /util/log, with MediaWiki's page and user filters", () => {
      expect(special(["Special:Log"])).toEqual(to("/util/log"));
      expect(special(["Special:Log", "delete"])).toEqual(to("/util/log?type=delete"));
      expect(special(["Special:Log"], { type: "move", page: "Foo bar", user: "Jane" })).toEqual(
        to("/util/log?type=move&title=Foo+bar&user=Jane")
      );
    });
  });

  describe("resolveWikiPath: the old WikiOS tool and /edit, /talk paths are titles", () => {
    it("a former tool slug is an ordinary article title", () => {
      expect(article(resolveWikiPath(["recent-changes"])).canon.title).toBe("Recent-changes");
      expect(article(resolveWikiPath(["search"], { q: "eurth" })).canon.title).toBe("Search");
      expect(article(resolveWikiPath(["history", "Foo"])).canon.title).toBe("History/Foo");
    });
  });
  describe("canonicalPathRedirect (plan 412: the canonical redirect of plan 403, now on the server)", () => {
    const canon = (title: string) => {
      const result = canonicalizeTitle(title);
      if (!result) throw new Error(title);
      return result;
    };

    it("moves a non-canonical spelling to the canonical one, keeping the query string", () => {
      expect(canonicalPathRedirect(["foo_bar"], canon("foo_bar"), { margin: "threads" })).toBe(
        "/wiki/Foo_bar?margin=threads"
      );
      expect(canonicalPathRedirect(["nato"], canon("nato"), {})).toBe("/wiki/Nato");
      expect(
        canonicalPathRedirect(["foo", "bar"], canon("foo/bar"), new URLSearchParams("a=1&a=2"))
      ).toBe("/wiki/Foo/bar?a=1&a=2");
    });
    it("leaves a canonical URL alone, however it is percent-encoded, so nothing can loop", () => {
      for (const segments of [["Portal%3AEurth"], ["Portal:Eurth"]]) {
        expect(canonicalPathRedirect(segments, canon("Portal:Eurth"), {})).toBeNull();
      }
      expect(canonicalPathRedirect(["100%25_Pure"], canon("100% Pure"), {})).toBeNull();
      expect(canonicalPathRedirect(["Foo%2Fbar"], canon("Foo/bar"), {})).toBeNull();
      expect(canonicalPathRedirect(["Foo", "bar"], canon("Foo/bar"), {})).toBeNull();
    });
  });
});

describe("redirects", () => {
  describe("parseRedirect", () => {
    it("reads a plain redirect", () => {
      expect(parseRedirect("#REDIRECT [[Foo]]")).toEqual({
        title: "Foo",
        slug: "foo",
        fragment: null,
      });
    });

    it("is case-insensitive, allows leading whitespace and a colon, and canonicalizes the target", () => {
      expect(parseRedirect("  #redirect:[[foo_bar#Sec one]]")).toEqual({
        title: "Foo bar",
        slug: "foo_bar",
        fragment: "Sec one",
      });
    });
    it("ignores a #REDIRECT that does not start the text", () => {
      expect(parseRedirect("Text first\n#REDIRECT [[Foo]]")).toBeNull();
      expect(parseRedirect("<nowiki>#REDIRECT [[Foo]]</nowiki>")).toBeNull();
    });

    it("ignores an empty, fragment-only or invalid target", () => {
      expect(parseRedirect("#REDIRECT [[]]")).toBeNull();
      expect(parseRedirect("#REDIRECT [[#Section]]")).toBeNull();
      expect(parseRedirect("#REDIRECT [[a{b]]")).toBeNull();
      expect(parseRedirect("#REDIRECT Foo")).toBeNull();
    });
    it("takes the target up to the first pipe or closing brackets, even with a ] in the label", () => {
      expect(parseRedirect("#REDIRECT [[Foo|la]bel]]")?.title).toBe("Foo");
      expect(parseRedirect("#REDIRECT [[Foo]]]")?.title).toBe("Foo");
      expect(parseRedirect("#REDIRECT [[Foo]bar]]")).toBeNull();
    });

    it("needs the link to close on the same line", () => {
      expect(parseRedirect("#REDIRECT [[Foo")).toBeNull();
      expect(parseRedirect("#REDIRECT [[Foo|label")).toBeNull();
      expect(parseRedirect("#REDIRECT [[Foo\nBar]]")).toBeNull();
      expect(parseRedirect("#REDIRECT [[Foo|label\n]]")).toBeNull();
      expect(parseRedirect("#REDIRECT [[Foo]]\nMore text after the link.")?.title).toBe("Foo");
    });

    it("strips only ASCII whitespace before #REDIRECT: a no-break space or BOM is not a redirect", () => {
      expect(parseRedirect("\u00A0#REDIRECT [[Foo]]")).toBeNull();
      expect(parseRedirect("\uFEFF#REDIRECT [[Foo]]")).toBeNull();
      expect(parseRedirect(" \t\r\n#REDIRECT\n[[Foo]]")?.title).toBe("Foo");
    });

    it("percent-decodes the target and the fragment, as MediaWiki's rawurldecode does", () => {
      expect(parseRedirect("#REDIRECT [[%41bc]]")?.title).toBe("Abc");
      expect(parseRedirect("#REDIRECT [[Foo%20bar#Sec%20one]]")).toMatchObject({
        title: "Foo bar",
        fragment: "Sec one",
      });
      expect(parseRedirect("#REDIRECT [[%3ACategory%3AX]]")?.title).toBe("Category:X");
    });

    it("refuses a target whose percent escape is malformed or decodes to something illegal", () => {
      expect(parseRedirect("#REDIRECT [[Foo%FF]]")).toBeNull();
      expect(parseRedirect("#REDIRECT [[Foo%5Dbar]]")).toBeNull();
      expect(parseRedirect("#REDIRECT [[Foo%0Abar]]")).toBeNull();
    });
  });
});

describe("the standalone WikiOS", () => {
  const IXSTATES = "https://ixwiki.com/projects/ixstates";

  describe("isWikiStandalone", () => {
    const original = process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;

    afterEach(() => {
      if (original === undefined) delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
      else process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = original;
    });

    it("is on only for the exact value 'true'", () => {
      process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
      expect(isWikiStandalone()).toBe(true);
      process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "false";
      expect(isWikiStandalone()).toBe(false);
      process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "1";
      expect(isWikiStandalone()).toBe(false);
      delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
      expect(isWikiStandalone()).toBe(false);
    });
  });

  describe("wikiStandaloneRedirect", () => {
    const original = process.env.NEXT_PUBLIC_IXSTATES_URL;

    beforeEach(() => {
      process.env.NEXT_PUBLIC_IXSTATES_URL = IXSTATES;
    });

    afterAll(() => {
      if (original === undefined) delete process.env.NEXT_PUBLIC_IXSTATES_URL;
      else process.env.NEXT_PUBLIC_IXSTATES_URL = original;
    });
    it.each([
      "/wiki/Main_Page",
      "/w/api.php",
      "/util/search",
      "/stashes/abc",
      "/api/trpc/wikios.page.get",
      "/api/wiki/sync-webhook",
      "/api/mediawiki/parse",
      "/api.php",
      "/sitemap.xml",
      "/robots.txt",
      "/_next/static/chunks/a.js",
      "/sign-in/factor-one",
      "/favicon.ico",
      "/images/uploads/uploaded_1784640623616_c02c54d0_Dushina_Flags_and_Test_Flags_1_.png",
      "/maplibre/maplibre-gl-worker.mjs",
      "/opensearch.xml",
    ])("serves %s in WikiOS", (pathname) => {
      expect(wikiStandaloneRedirect(pathname, "?x=1")).toBeNull();
    });

    it.each([
      ["/mycountry/overview", "?tab=gdp"],
      ["/api/health", ""],
      ["/api/ixtime/set-override", ""],
      ["/maps", "?embed=true&lat=1&lng=2&zoom=3"],
      // only /images/uploads, /images/flags and /images/wikios are WikiOS's: a longer name is not a match, and
      // MediaWiki's own uploads (nginx sends them to MediaWiki, never to WikiOS) are not either
      ["/images/uploads_backup/Flag.png", ""],
      ["/images/a/ab/Flag.png", ""],
      ["/admin", ""],
    ])("redirects %s to IxStates", (pathname, search) => {
      expect(wikiStandaloneRedirect(pathname, search)).toBe(`${IXSTATES}${pathname}${search}`);
    });

    it("does not treat a longer name as a match for a segment prefix", () => {
      expect(wikiStandaloneRedirect("/wikipedia", "")).toBe(`${IXSTATES}/wikipedia`);
      expect(wikiStandaloneRedirect("/utilities", "")).toBe(`${IXSTATES}/utilities`);
      expect(wikiStandaloneRedirect("/stashed", "")).toBe(`${IXSTATES}/stashed`);
      expect(wikiStandaloneRedirect("/fontsy", "")).toBe(`${IXSTATES}/fontsy`);
      // "/w" is a segment prefix: it is api.php's directory, not every path that starts with w
      expect(wikiStandaloneRedirect("/wx/api.php", "")).toBe(`${IXSTATES}/wx/api.php`);
      expect(wikiStandaloneRedirect("/world", "")).toBe(`${IXSTATES}/world`);
      expect(wikiStandaloneRedirect("/wikipedia", "")).toBe(`${IXSTATES}/wikipedia`);
    });
    it.each([
      ["unset", undefined],
      ["empty", ""],
      ["blank", "   "],
    ])(
      "has no default: a redirect to IxStates throws when NEXT_PUBLIC_IXSTATES_URL is %s",
      (_label, value) => {
        if (value === undefined) delete process.env.NEXT_PUBLIC_IXSTATES_URL;
        else process.env.NEXT_PUBLIC_IXSTATES_URL = value;
        expect(() => wikiStandaloneRedirect("/vault", "")).toThrow(WikiStandaloneConfigError);
        expect(() => wikiStandaloneRedirect("/vault", "")).toThrow(/NEXT_PUBLIC_IXSTATES_URL/);
      }
    );
  });
});

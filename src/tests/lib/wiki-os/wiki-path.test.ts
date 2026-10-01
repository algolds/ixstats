/** Plan 412: what a /wiki/<path>?<query> URL asks WikiOS for. */
import {
  articleHref,
  canonicalPathRedirect,
  pageAdminHref,
  queryParam,
  queryStringOf,
  resolveWikiPath,
  type WikiPathTarget,
} from "~/lib/wiki-os/wiki-path";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { counterpartOf, subjectPageOf, talkPageOf } from "~/lib/wiki-os/core/talk";

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

  it("joins the segments of a subpage, and treats an encoded slash the same", () => {
    expect(article(resolveWikiPath(["Template:Foo", "doc"])).canon.title).toBe("Template:Foo/doc");
    expect(article(resolveWikiPath(["A", "B", "C"])).canon.title).toBe("A/B/C");
    expect(article(resolveWikiPath(["A%2FB"])).canon.title).toBe("A/B");
    expect(article(resolveWikiPath(["A", "B"])).canon.urlPath).toBe("A/B");
  });

  it("decodes each segment once", () => {
    expect(article(resolveWikiPath(["100%25_Pure"])).canon.title).toBe("100% Pure");
    expect(article(resolveWikiPath(["Portal%3AEurth"])).canon.title).toBe("Portal:Eurth");
  });

  it("refuses a title MediaWiki would refuse", () => {
    expect(resolveWikiPath(["a%5Bb"])).toEqual({ kind: "invalid", raw: "a[b" });
    expect(resolveWikiPath(["..", "x"]).kind).toBe("invalid");
  });

  it("?action=history is the history view", () => {
    const target = article(resolveWikiPath(["foo_bar"], { action: "history" }));
    expect(target.canon.title).toBe("Foo bar");
    expect(target.view).toEqual({ type: "history" });
  });

  it("?action=info is the page-info view", () => {
    expect(article(resolveWikiPath(["Foo"], new URLSearchParams("action=info"))).view).toEqual({
      type: "info",
    });
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

  it("?action=raw is the raw wikitext of the page or of ?oldid=", () => {
    const current = resolveWikiPath(["foo_bar"], { action: "raw" });
    expect(current).toMatchObject({ kind: "raw", ref: null });
    expect(resolveWikiPath(["Foo"], { action: "raw", oldid: "77" })).toMatchObject({
      kind: "raw",
      ref: "77",
    });
  });

  it("takes the first value of a repeated query parameter", () => {
    expect(article(resolveWikiPath(["Foo"], { action: ["history", "edit"] })).view).toEqual({
      type: "history",
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

  it("Special:Search?search=x goes to the search tool with q=x, and so does Special:Search/x", () => {
    expect(special(["Special:Search"], { search: "x y" })).toEqual({
      type: "redirect",
      href: "/util/search?q=x+y",
    });
    expect(special(["Special:Search", "lore"])).toEqual({
      type: "redirect",
      href: "/util/search?q=lore",
    });
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

  it("keeps the arguments of a tool redirect", () => {
    expect(special(["Special:RecentChanges"], { days: "7", limit: "50" })).toEqual({
      type: "redirect",
      href: "/util/recent-changes?days=7&limit=50",
    });
  });

  it("maps Contributions and WhatLinksHere with and without an argument", () => {
    expect(special(["Special:Contributions", "Jane_Doe"])).toEqual({
      type: "redirect",
      href: "/util/contributions/Jane%20Doe",
    });
    expect(special(["Special:Contributions"])).toEqual({
      type: "redirect",
      href: "/util/contributions",
    });
    expect(special(["Special:WhatLinksHere", "Foo", "bar"])).toEqual({
      type: "redirect",
      href: "/util/whatlinkshere/Foo%2Fbar",
    });
    expect(special(["Special:WhatLinksHere"], { target: "Foo" })).toEqual({
      type: "redirect",
      href: "/util/whatlinkshere?target=Foo",
    });
  });

  it("Random and FilePath are for the route to answer", () => {
    expect(special(["Special:Random"])).toEqual({ type: "random" });
    expect(special(["Special:RandomPage"])).toEqual({ type: "random" });
    expect(special(["Special:FilePath", "File:Flag_of_Eurth.svg"])).toEqual({
      type: "file-path",
      file: "Flag of Eurth.svg",
    });
    expect(special(["Special:FilePath"], { file: "Map.png" })).toEqual({
      type: "file-path",
      file: "Map.png",
    });
    expect(special(["Special:FilePath"])).toEqual({ type: "unknown" });
  });

  it("AllPages and PrefixIndex are listings", () => {
    expect(special(["Special:AllPages"])).toEqual({
      type: "list-pages",
      mode: "allpages",
      prefix: "",
      namespace: 0,
      from: "",
    });
    expect(special(["Special:AllPages", "Foo_bar"], { namespace: "10" })).toEqual({
      type: "list-pages",
      mode: "allpages",
      prefix: "",
      namespace: 10,
      from: "Foo bar",
    });
    expect(special(["Special:PrefixIndex", "Aur", "elia"])).toEqual({
      type: "list-pages",
      mode: "prefix",
      prefix: "Aur/elia",
      namespace: 0,
      from: "",
    });
    expect(special(["Special:PrefixIndex", "Talk:Aur"])).toEqual({
      type: "list-pages",
      mode: "prefix",
      prefix: "Aur",
      namespace: 1,
      from: "",
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

  it("Special:Move/<title> and Special:MovePage/<title> are /util/move?title=", () => {
    expect(special(["Special:Move", "foo_bar"])).toEqual(to("/util/move?title=Foo+bar"));
    expect(special(["Special:MovePage", "Template:Foo", "doc"])).toEqual(
      to("/util/move?title=Template%3AFoo%2Fdoc")
    );
    expect(special(["Special:MovePage"], { target: "Foo" })).toEqual(to("/util/move?title=Foo"));
    expect(special(["Special:Move"])).toEqual(to("/util/move"));
    expect(special(["Special:Move", "a[b"])).toEqual({ type: "unknown" });
  });

  it("Special:Delete, Undelete and Protect take a page, Block and UserRights a user, BlockList nothing", () => {
    expect(special(["Special:Delete", "Foo"])).toEqual(to("/util/delete?title=Foo"));
    expect(special(["Special:Undelete", "Foo"])).toEqual(to("/util/undelete?title=Foo"));
    expect(special(["Special:Undelete"])).toEqual(to("/util/undelete"));
    expect(special(["Special:Protect", "Foo"])).toEqual(to("/util/protect?title=Foo"));
    expect(special(["Special:Block", "Jane_Doe"])).toEqual(to("/util/block?user=Jane+Doe"));
    expect(special(["Special:Block", "User:Jane"])).toEqual(to("/util/block?user=Jane"));
    expect(special(["Special:UserRights", "Jane"])).toEqual(to("/util/userrights?user=Jane"));
    expect(special(["Special:UserRights"])).toEqual(to("/util/userrights"));
    expect(special(["Special:BlockList"])).toEqual(to("/util/blocklist"));
  });

  it("?action=delete, protect and unprotect on an article are the admin view", () => {
    for (const action of ["delete", "protect", "unprotect"]) {
      const target = article(resolveWikiPath(["foo_bar"], { action }));
      expect(target.view).toEqual({ type: "admin", action });
    }
    expect(pageAdminHref(canonicalizeTitle("Foo bar")!, "delete")).toBe(
      "/util/delete?title=Foo+bar"
    );
    expect(pageAdminHref(canonicalizeTitle("Foo bar")!, "protect")).toBe(
      "/util/protect?title=Foo+bar"
    );
    expect(pageAdminHref(canonicalizeTitle("Foo bar")!, "unprotect")).toBe(
      "/util/protect?title=Foo+bar"
    );
  });
});

describe("resolveWikiPath: old WikiOS URLs", () => {
  it("a lower-case tool slug is a redirect to its tool, unless an article has that title", () => {
    const target = resolveWikiPath(["recent-changes"]);
    expect(target).toMatchObject({
      kind: "tool-redirect",
      href: "/util/recent-changes",
      canon: { title: "Recent-changes" },
    });
    expect(resolveWikiPath(["recent_changes"])).toMatchObject({
      kind: "tool-redirect",
      canon: { title: "Recent changes" },
    });
    expect(resolveWikiPath(["search"], { q: "eurth" })).toMatchObject({
      kind: "tool-redirect",
      href: "/util/search?q=eurth",
    });
  });

  it("a capitalised tool name is an ordinary article title", () => {
    expect(resolveWikiPath(["Recent-changes"]).kind).toBe("article");
    expect(resolveWikiPath(["Search"]).kind).toBe("article");
    expect(resolveWikiPath(["Categories"]).kind).toBe("article");
  });

  it("the tool routes that took an argument keep it", () => {
    expect(resolveWikiPath(["categories", "Countries"])).toMatchObject({
      href: "/util/categories/Countries",
    });
    expect(resolveWikiPath(["contributions", "Jane_Doe"])).toMatchObject({
      href: "/util/contributions/Jane_Doe",
    });
    expect(resolveWikiPath(["history", "Foo", "bar"])).toMatchObject({
      href: "/util/history/Foo%2Fbar",
    });
    expect(resolveWikiPath(["whatlinkshere", "Foo"])).toMatchObject({
      href: "/util/whatlinkshere/Foo",
    });
    expect(resolveWikiPath(["user", "jane_doe"])).toMatchObject({ href: "/wiki/User:Jane_doe" });
  });

  it("an unrelated lower-case title is an article, even with a tool's name inside", () => {
    expect(resolveWikiPath(["searching"]).kind).toBe("article");
    expect(resolveWikiPath(["random", "thoughts"]).kind).toBe("article");
  });

  it("/<title>/edit goes to ?action=edit, unless the page <title>/edit exists", () => {
    const target = resolveWikiPath(["foo_bar", "edit"], { section: "Geography" });
    expect(target).toMatchObject({
      kind: "legacy-redirect",
      href: "/wiki/Foo_bar?section=Geography&action=edit",
      canon: { title: "Foo bar/edit" },
    });
    expect(resolveWikiPath(["A%2FB", "edit"])).toMatchObject({ href: "/wiki/A/B?action=edit" });
  });

  it("/<title>/talk goes to the talk page, unless the page <title>/talk exists", () => {
    expect(resolveWikiPath(["Foo", "talk"])).toMatchObject({
      kind: "legacy-redirect",
      href: "/wiki/Talk:Foo",
      canon: { title: "Foo/talk" },
    });
    expect(resolveWikiPath(["User:Jane", "talk"])).toMatchObject({ href: "/wiki/User_talk:Jane" });
    // A talk page has no talk page: "Talk:Foo/talk" is a subpage.
    expect(resolveWikiPath(["Talk:Foo", "talk"]).kind).toBe("article");
    expect(resolveWikiPath(["Special:Random", "talk"]).kind).toBe("special");
  });

  it("what the query string asks of an article is kept for when the article exists (plan 412 review)", () => {
    expect(resolveWikiPath(["Foo", "talk"], { action: "raw" })).toMatchObject({
      kind: "legacy-redirect",
      href: "/wiki/Talk:Foo",
      canon: { title: "Foo/talk" },
      ifArticle: { kind: "raw", canon: { title: "Foo/talk" }, ref: null },
    });
    expect(resolveWikiPath(["search"], { action: "raw", oldid: "7" })).toMatchObject({
      kind: "tool-redirect",
      ifArticle: { kind: "raw", canon: { title: "Search" }, ref: "7" },
    });
    expect(resolveWikiPath(["Foo", "edit"], { action: "history" })).toMatchObject({
      kind: "legacy-redirect",
      ifArticle: { kind: "article", view: { type: "history" } },
    });
    expect(resolveWikiPath(["search"], { oldid: "5" })).toMatchObject({
      ifArticle: { kind: "article", view: { type: "revision", ref: "5" } },
    });
    expect(resolveWikiPath(["search"], { diff: "prev", oldid: "5" })).toMatchObject({
      ifArticle: { kind: "article", view: { type: "diff", oldid: "5", diff: "prev" } },
    });
    expect(resolveWikiPath(["search"], { action: "info" })).toMatchObject({
      ifArticle: { kind: "article", view: { type: "info" } },
    });
    // A plain visit is a plain read; a bad revision reference is invalid for the article too.
    expect(resolveWikiPath(["search"])).toMatchObject({
      ifArticle: { kind: "article", view: { type: "read" } },
    });
    expect(resolveWikiPath(["search"], { oldid: "a b" })).toMatchObject({
      ifArticle: { kind: "invalid" },
    });
  });

  it("Talk:X is an ordinary page", () => {
    const target = article(resolveWikiPath(["Talk:X"]));
    expect(target.canon).toMatchObject({ title: "Talk:X", namespaceId: 1 });
  });
});

describe("articleHref", () => {
  it("builds the canonical URL of a title, with a query and the section fragment", () => {
    const canon = canonicalizeTitle("foo_bar/baz#Some section");
    if (!canon) throw new Error("not a title");
    expect(articleHref(canon)).toBe("/wiki/Foo_bar/baz#Some_section");
    expect(articleHref(canon, { rdfrom: "Old name", redirect: null })).toBe(
      "/wiki/Foo_bar/baz?rdfrom=Old+name#Some_section"
    );
  });
});

describe("subject and talk pages", () => {
  const canon = (title: string) => {
    const result = canonicalizeTitle(title);
    if (!result) throw new Error(title);
    return result;
  };

  it("pairs every content namespace with its talk namespace", () => {
    expect(talkPageOf(canon("Foo"))?.title).toBe("Talk:Foo");
    expect(talkPageOf(canon("User:Jane"))?.title).toBe("User talk:Jane");
    expect(talkPageOf(canon("Template:Foo/doc"))?.title).toBe("Template talk:Foo/doc");
    expect(subjectPageOf(canon("Talk:Foo"))?.title).toBe("Foo");
    expect(subjectPageOf(canon("Category talk:Bar"))?.title).toBe("Category:Bar");
  });

  it("has no counterpart where MediaWiki has none", () => {
    expect(talkPageOf(canon("Talk:Foo"))).toBeNull();
    expect(subjectPageOf(canon("Foo"))).toBeNull();
    expect(counterpartOf(canon("Special:Random"))).toBeNull();
    expect(counterpartOf(canon("Topic:Xyz"))).toBeNull();
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

  it("carries a section typed into the path as the fragment", () => {
    expect(
      canonicalPathRedirect(["user%20talk%3Ajane%23Notes"], canon("user talk:jane#Notes"), {})
    ).toBe("/wiki/User_talk:Jane#Notes");
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

describe("query helpers", () => {
  it("queryStringOf keeps every value of a repeated key and leaves out what it is told to", () => {
    expect(queryStringOf({ a: "1", b: ["2", "3"], c: undefined })).toBe("a=1&b=2&b=3");
    expect(
      queryStringOf(new URLSearchParams("a=1&redirect=no&rdfrom=X"), ["redirect", "rdfrom"])
    ).toBe("a=1");
    expect(queryStringOf({})).toBe("");
  });

  it("queryParam reads the first value, from either shape", () => {
    expect(queryParam({ a: ["x", "y"] }, "a")).toBe("x");
    expect(queryParam(new URLSearchParams("a=x&a=y"), "a")).toBe("x");
    expect(queryParam({}, "a")).toBeNull();
  });
});

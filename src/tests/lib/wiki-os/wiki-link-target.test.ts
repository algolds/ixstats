/** @jest-environment node */
/**
 * `wikiLinkTarget(href, basePath)` reads a hovered link as the wiki article a preview shows, or null. Article HTML
 * carries the base path at display (`withAppHrefs`), so on IxStates's deployment the reader's links are
 * `/projects/ixstates/wiki/Title`; a sister page is `/wiki/Title?source=<wiki>`; an outside link to a wiki WikiOS
 * reads is that wiki's article. Anything WikiOS cannot preview (files, specials, other namespaces, other sites, the
 * wiki's entry points) is null, and no href makes it throw.
 */
import { absoluteReaderTarget, SITE_NAMESPACE, wikiLinkTarget } from "~/lib/wiki-os/wiki-link-target";
import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";

const BASE = "/projects/ixstates";

describe("wikiLinkTarget", () => {
  it("/projects/ixstates/wiki/Foo is IxWiki's Foo under the base path; with no base path, /wiki/Foo", () => {
    expect(wikiLinkTarget(`${BASE}/wiki/Foo`, BASE)).toEqual({ title: "Foo", wiki: "ixwiki" });
    expect(wikiLinkTarget("/wiki/Foo", "")).toEqual({ title: "Foo", wiki: "ixwiki" });
    // A bare /wiki/ link under a base path is still IxWiki's article (classic's copy of it).
    expect(wikiLinkTarget("/wiki/Foo", BASE)).toEqual({ title: "Foo", wiki: "ixwiki" });
    // Without a base path, the deployment's prefix is just another first segment.
    expect(wikiLinkTarget(`${BASE}/wiki/Foo`, "")).toBeNull();
  });

  it("decodes the title, reads underscores as spaces and drops the query and fragment", () => {
    expect(wikiLinkTarget(`${BASE}/wiki/C%C3%B4te_d%27Or?action=history#History`, BASE)).toEqual({
      title: "Côte d'Or",
      wiki: "ixwiki",
    });
    expect(wikiLinkTarget("/wiki/Burgundie/Economy", BASE)).toEqual({
      title: "Burgundie/Economy",
      wiki: "ixwiki",
    });
  });

  it("the base path counts only at a segment boundary", () => {
    expect(wikiLinkTarget(`${BASE}wiki/Foo`, BASE)).toBeNull();
    expect(wikiLinkTarget(`${BASE}x/wiki/Foo`, BASE)).toBeNull();
  });

  it("/wiki/Foo?source=althistory and https://althistory.fandom.com/wiki/Foo are althistory", () => {
    const foo = { title: "Foo", wiki: "althistory" };
    expect(wikiLinkTarget(`${BASE}/wiki/Foo?source=althistory`, BASE)).toEqual(foo);
    expect(wikiLinkTarget("/wiki/Foo?source=althistory", "")).toEqual(foo);
    expect(wikiLinkTarget("https://althistory.fandom.com/wiki/Foo", BASE)).toEqual(foo);
    expect(wikiLinkTarget("//althistory.fandom.com/wiki/Foo", BASE)).toEqual(foo);
  });

  it("/wiki/Foo?source=iiwiki and https://iiwiki.com/wiki/Foo are iiwiki", () => {
    const foo = { title: "Foo", wiki: "iiwiki" };
    expect(wikiLinkTarget(`${BASE}/wiki/Foo?source=iiwiki`, BASE)).toEqual(foo);
    expect(wikiLinkTarget("https://iiwiki.com/wiki/Foo", BASE)).toEqual(foo);
    expect(wikiLinkTarget("https://www.iiwiki.com/wiki/Foo", BASE)).toEqual(foo);
    expect(wikiLinkTarget("http://iiwiki.us/wiki/Foo", BASE)).toEqual(foo);
  });

  it("an unknown ?source= reads as IxWiki, as the reader does", () => {
    expect(wikiLinkTarget(`${BASE}/wiki/Foo?source=commons`, BASE)).toEqual({
      title: "Foo",
      wiki: "ixwiki",
    });
  });

  it("https://iiwiki.com/index.php?title=Foo, title alone, is iiwiki's Foo", () => {
    expect(wikiLinkTarget("https://iiwiki.com/index.php?title=Foo_Bar", BASE)).toEqual({
      title: "Foo Bar",
      wiki: "iiwiki",
    });
  });

  it("an absolute link to IxWiki's host is IxWiki's article", () => {
    const foo = { title: "Foo", wiki: "ixwiki" };
    expect(wikiLinkTarget("https://ixwiki.com/wiki/Foo", BASE)).toEqual(foo);
    expect(wikiLinkTarget("https://www.ixwiki.com/wiki/Foo?oldid=12#Top", BASE)).toEqual(foo);
  });

  it("an absolute IxStates permalink on IxWiki's host is IxWiki's article, with its ?source= (feeds, Discord)", () => {
    const foo = { title: "Foo", wiki: "ixwiki" };
    expect(wikiLinkTarget(`https://ixwiki.com${BASE}/wiki/Foo`, BASE)).toEqual(foo);
    expect(wikiLinkTarget(`https://www.ixwiki.com${BASE}/wiki/Foo#History`, BASE)).toEqual(foo);
    expect(wikiLinkTarget(`//ixwiki.com${BASE}/wiki/Foo`, BASE)).toEqual(foo);
    expect(wikiLinkTarget(`https://ixwiki.com${BASE}/w/Foo_Bar`, BASE)).toEqual({
      title: "Foo Bar",
      wiki: "ixwiki",
    });
    expect(wikiLinkTarget(`https://ixwiki.com${BASE}/wiki/Foo?source=iiwiki`, BASE)).toEqual({
      title: "Foo",
      wiki: "iiwiki",
    });
    // its entry points, other app pages, a prefix that is not at a segment boundary and another host are not
    expect(wikiLinkTarget(`https://ixwiki.com${BASE}/w/api.php`, BASE)).toBeNull();
    expect(wikiLinkTarget(`https://ixwiki.com${BASE}/dashboard/accounts`, BASE)).toBeNull();
    expect(wikiLinkTarget(`https://ixwiki.com${BASE}x/wiki/Foo`, BASE)).toBeNull();
    expect(wikiLinkTarget(`https://example.com${BASE}/wiki/Foo`, BASE)).toBeNull();
    expect(wikiLinkTarget(`https://iiwiki.com${BASE}/wiki/Foo`, BASE)).toBeNull();
    expect(wikiLinkTarget(`ftp://ixwiki.com${BASE}/wiki/Foo`, BASE)).toBeNull();
    // without a base path the prefix is just another first segment
    expect(wikiLinkTarget(`https://ixwiki.com${BASE}/wiki/Foo`, "")).toBeNull();
    // and with no base path an absolute IxWiki link stays classic's: its /w/ form and ?source= are not read
    expect(wikiLinkTarget("https://ixwiki.com/w/Foo", "")).toBeNull();
    expect(wikiLinkTarget("https://ixwiki.com/wiki/Foo?source=iiwiki", "")).toEqual(foo);
    // nor is a bare classic link when there is a base path
    expect(wikiLinkTarget("https://ixwiki.com/wiki/Foo?source=iiwiki", BASE)).toEqual(foo);
  });

  it("another first segment is not the base path: /other/wiki/Foo is no link", () => {
    expect(wikiLinkTarget("/other/wiki/Foo", BASE)).toBeNull();
    expect(wikiLinkTarget("/other/wiki/Foo", "")).toBeNull();
    expect(wikiLinkTarget(`${BASE}/dashboard/accounts`, BASE)).toBeNull();
  });

  it("/w/api.php is no article", () => {
    expect(wikiLinkTarget("/w/api.php", BASE)).toBeNull();
    expect(wikiLinkTarget("/w/api.php/Foo", "")).toBeNull();
    expect(wikiLinkTarget(`${BASE}/w/index.php/Foo_Bar`, BASE)).toBeNull();
    expect(wikiLinkTarget("/w/api.php?action=query", "")).toBeNull();
    expect(wikiLinkTarget("/w/index.php?title=Foo", "")).toBeNull();
    expect(wikiLinkTarget(`${BASE}/w/load.php`, BASE)).toBeNull();
    expect(wikiLinkTarget("/w/API.php", "")).toBeNull();
    // Only a whole first segment is an entry point.
    expect(wikiLinkTarget("/w/My_api.php_notes", "")).toEqual({
      title: "My api.php notes",
      wiki: "ixwiki",
    });
    expect(wikiLinkTarget("/w/Docs/api.php", "")).toEqual({
      title: "Docs/api.php",
      wiki: "ixwiki",
    });
    // A legacy /w/ article link is IxWiki's, under the base path or not.
    expect(wikiLinkTarget("/w/Foo", "")).toEqual({ title: "Foo", wiki: "ixwiki" });
    expect(wikiLinkTarget(`${BASE}/w/Foo_Bar`, BASE)).toEqual({ title: "Foo Bar", wiki: "ixwiki" });
  });

  it("Special:, File:, Category:, Template: links get no preview", () => {
    for (const title of [
      "Special:Search",
      "special:RecentChanges",
      "File:Flag.svg",
      "Image:Flag.svg",
      "Media:Flag.svg",
      "Category:Nations",
      "Template:Infobox_country",
      "Help:Editing",
      "User:Livia",
      "Talk:Foo",
      "Alternate_History_talk:Foo",
      "Special%3ASearch",
      "User_talk:Kir",
      "File_talk:Flag.svg",
      "Module:Infobox",
      "MediaWiki:Sidebar",
    ]) {
      expect(wikiLinkTarget(`${BASE}/wiki/${title}`, BASE)).toBeNull();
      expect(wikiLinkTarget(`https://iiwiki.com/wiki/${title}`, BASE)).toBeNull();
    }
    expect(wikiLinkTarget("/w/Special:MyLanguage/Foo", "")).toBeNull();
    // A title that only starts like a namespace is an article.
    expect(wikiLinkTarget("/wiki/Filet_mignon", "")).toEqual({
      title: "Filet mignon",
      wiki: "ixwiki",
    });
    expect(wikiLinkTarget("/wiki/Notes_on_Help:Editing", "")).toEqual({
      title: "Notes on Help:Editing",
      wiki: "ixwiki",
    });
    // A namespace needs its colon: a subpage whose name starts like one is an article.
    expect(wikiLinkTarget("/wiki/Media/Press", "")).toEqual({ title: "Media/Press", wiki: "ixwiki" });
    expect(wikiLinkTarget("/wiki/Special/Random", "")).toEqual({
      title: "Special/Random",
      wiki: "ixwiki",
    });
  });

  it("Portal: pages preview: the reader reads them as articles", () => {
    expect(wikiLinkTarget("/wiki/Portal:Eurth?source=iiwiki", "")).toEqual({
      title: "Portal:Eurth",
      wiki: "iiwiki",
    });
    expect(wikiLinkTarget("https://iiwiki.com/wiki/Portal:Eurth", BASE)).toEqual({
      title: "Portal:Eurth",
      wiki: "iiwiki",
    });
  });

  it("other sites, other paths and non-links are null", () => {
    for (const href of [
      "https://example.com/wiki/Foo",
      "https://iiwiki.com.evil.test/wiki/Foo",
      "https://notiiwiki.com/wiki/Foo",
      "https://iiwiki.com/index.php?title=Foo&action=edit",
      "https://iiwiki.com/index.php?curid=12",
      "https://iiwiki.com:8443/wiki/Foo",
      "https://ixwiki.com/projects/ixstates/dashboard",
      "javascript://iiwiki.com/wiki/Foo",
      "ftp://iiwiki.com/wiki/Foo",
      "//example.com/wiki/Foo",
      "/\\example.com/wiki/Foo",
      "wiki/Foo",
      "#Foo",
      "?source=iiwiki",
      "",
      "mailto:a@b.c",
    ]) {
      expect(wikiLinkTarget(href, BASE)).toBeNull();
    }
  });

  it("a link with no title is null", () => {
    expect(wikiLinkTarget("/wiki/", "")).toBeNull();
    expect(wikiLinkTarget("/wiki/_", "")).toBeNull();
    expect(wikiLinkTarget("/w/", "")).toBeNull();
    expect(wikiLinkTarget("https://iiwiki.com/wiki/", BASE)).toBeNull();
    expect(wikiLinkTarget("/wiki/_Foo_", "")).toEqual({ title: "Foo", wiki: "ixwiki" });
  });

  it("a malformed escape is null, not a throw", () => {
    expect(() => wikiLinkTarget("/wiki/100%_Foo", "")).not.toThrow();
    expect(wikiLinkTarget("/wiki/100%_Foo", "")).toBeNull();
    expect(wikiLinkTarget(`${BASE}/wiki/%E0%A4%A`, BASE)).toBeNull();
    expect(wikiLinkTarget("https://althistory.fandom.com/wiki/%ZZ", BASE)).toBeNull();
    expect(wikiLinkTarget("http://[bad/wiki/Foo", BASE)).toBeNull();
  });

  it("a long crafted href answers quickly", () => {
    const long = "%".repeat(50_000) + "/wiki/".repeat(10_000);
    const began = performance.now();
    wikiLinkTarget(`${BASE}/wiki/${long}`, BASE);
    wikiLinkTarget(`https://iiwiki.com/wiki/${"a_".repeat(50_000)}`, BASE);
    wikiLinkTarget(`/w/${"a".repeat(100_000)}`, BASE);
    expect(performance.now() - began).toBeLessThan(75 * TIMING_BUDGET_SCALE);
  });
});

describe("absoluteReaderTarget", () => {
  it("an iiwiki article, on its origin or www.: title decoded with spaces, fragment kept", () => {
    expect(absoluteReaderTarget("https://iiwiki.com/wiki/C%C3%B4te_d%27Or#History")).toEqual({
      wiki: "iiwiki",
      title: "Côte d'Or",
      fragment: "#History",
    });
    expect(absoluteReaderTarget("https://www.iiwiki.com/wiki/Gallambria")).toEqual({
      wiki: "iiwiki",
      title: "Gallambria",
      fragment: "",
    });
    expect(absoluteReaderTarget("http://iiwiki.us/wiki/Gallambria")).toEqual({
      wiki: "iiwiki",
      title: "Gallambria",
      fragment: "",
    });
    expect(absoluteReaderTarget("//iiwiki.com/wiki/Gallambria")).toEqual({
      wiki: "iiwiki",
      title: "Gallambria",
      fragment: "",
    });
  });

  it("reads the href as a browser does: scheme and host in any case, leading space, backslashes for slashes", () => {
    const gallambria = { wiki: "iiwiki", title: "Gallambria", fragment: "" };
    expect(absoluteReaderTarget("HTTPS://IIWIKI.COM/wiki/Gallambria")).toEqual(gallambria);
    expect(absoluteReaderTarget("  https://iiwiki.com/wiki/Gallambria")).toEqual(gallambria);
    expect(absoluteReaderTarget("\\\\iiwiki.com/wiki/Gallambria")).toEqual(gallambria);
    expect(absoluteReaderTarget("https:\\\\iiwiki.com/wiki/Gallambria")).toEqual(gallambria);
  });

  it("an althistory article", () => {
    expect(absoluteReaderTarget("https://althistory.fandom.com/wiki/Napoleon%27s_World#Map")).toEqual({
      wiki: "althistory",
      title: "Napoleon's World",
      fragment: "#Map",
    });
  });

  it("an article on IxWiki's host", () => {
    expect(absoluteReaderTarget("https://ixwiki.com/wiki/Burgundie/Economy")).toEqual({
      wiki: "ixwiki",
      title: "Burgundie/Economy",
      fragment: "",
    });
    expect(absoluteReaderTarget("https://www.ixwiki.com/wiki/Burgundie")).toEqual({
      wiki: "ixwiki",
      title: "Burgundie",
      fragment: "",
    });
  });

  it("index.php?title= with title as its only parameter, + and %20 as spaces", () => {
    expect(absoluteReaderTarget("https://iiwiki.com/index.php?title=Foo_Bar#Top")).toEqual({
      wiki: "iiwiki",
      title: "Foo Bar",
      fragment: "#Top",
    });
    expect(absoluteReaderTarget("https://althistory.fandom.com/index.php?title=New+World%20Order")).toEqual({
      wiki: "althistory",
      title: "New World Order",
      fragment: "",
    });
    expect(absoluteReaderTarget("https://ixwiki.com/index.php?title=C%2B%2B")).toEqual({
      wiki: "ixwiki",
      title: "C++",
      fragment: "",
    });
  });

  it("a query other than title is null", () => {
    for (const href of [
      "https://iiwiki.com/wiki/Foo?action=history",
      "https://iiwiki.com/wiki/Foo?oldid=12#Top",
      "https://ixwiki.com/wiki/Foo?source=iiwiki",
      "https://iiwiki.com/index.php?title=Foo&action=edit",
      "https://iiwiki.com/index.php?action=edit&title=Foo",
      "https://iiwiki.com/index.php?title=Foo&",
      "https://iiwiki.com/index.php?oldid=12",
      "https://iiwiki.com/index.php?title=",
      "https://iiwiki.com/index.php",
    ]) {
      expect(absoluteReaderTarget(href)).toBeNull();
    }
  });

  it("a title MediaWiki refuses for its dot segments is null, its slashes escaped or not", () => {
    for (const path of [
      "a%2F..%2F..%2F..%2Fapi%2Fadmin",
      "a%2f..%2fapi",
      "..",
      ".",
      "%2E%2E",
      "..%2Fapi",
      "Foo%2F.%2FBar",
      ".%2FFoo",
      "Foo%2F.",
      "Foo/%2E%2E",
      "Foo%2F..%2F",
    ]) {
      expect(absoluteReaderTarget(`https://iiwiki.com/wiki/${path}`)).toBeNull();
      expect(absoluteReaderTarget(`https://iiwiki.com/index.php?title=${path}`)).toBeNull();
      expect(wikiLinkTarget(`/wiki/${path}?source=iiwiki`, "")).toBeNull();
    }
    // A literal dot segment of the path is the URL's own, resolved as the browser resolves it.
    expect(absoluteReaderTarget("https://iiwiki.com/wiki/./Foo")?.title).toBe("Foo");
    expect(absoluteReaderTarget("https://iiwiki.com/index.php?title=./Foo")).toBeNull();
    // Dots that are not a whole segment are part of a title.
    for (const title of ["...", "Foo..", "..Foo", "Foo/.../Bar", "Foo/.Bar", "Foo./Bar", "Mr. Foo"]) {
      expect(absoluteReaderTarget(`https://iiwiki.com/wiki/${encodeURIComponent(title)}`)?.title).toBe(title);
    }
  });

  it("does not filter namespaces: the caller decides", () => {
    expect(absoluteReaderTarget("https://iiwiki.com/wiki/File:Flag.png")).toEqual({
      wiki: "iiwiki",
      title: "File:Flag.png",
      fragment: "",
    });
  });

  it("a malformed escape is null, not a throw", () => {
    expect(() => absoluteReaderTarget("https://iiwiki.com/wiki/100%_Foo")).not.toThrow();
    expect(absoluteReaderTarget("https://iiwiki.com/wiki/100%_Foo")).toBeNull();
    expect(absoluteReaderTarget("https://iiwiki.com/index.php?title=%E0%A4%A")).toBeNull();
    expect(absoluteReaderTarget("http://[bad/wiki/Foo")).toBeNull();
  });

  it("a relative link, another host, another path or scheme is null", () => {
    for (const href of [
      "/wiki/Foo",
      "/wiki/Foo?source=iiwiki",
      "wiki/Foo",
      "#Foo",
      "",
      "https://example.com/wiki/Foo",
      "https://iiwiki.com.evil.test/wiki/Foo",
      "https://commons.wikimedia.org/wiki/Foo",
      "https://iiwiki.com/w/Foo",
      "https://iiwiki.com/w/index.php?title=Foo",
      "https://iiwiki.com/index.php/Foo",
      "https://iiwiki.com/index.php/Foo?title=Bar",
      "https://iiwiki.com/index.php5?title=Foo",
      "https://iiwiki.com/wiki/",
      "ftp://iiwiki.com/wiki/Foo",
      "javascript://iiwiki.com/wiki/Foo",
    ]) {
      expect(absoluteReaderTarget(href)).toBeNull();
    }
  });
});

describe("absoluteReaderTarget on hostile input", () => {
  it("a long crafted href answers quickly", () => {
    const began = performance.now();
    absoluteReaderTarget(" ".repeat(100_000));
    absoluteReaderTarget(`${" ".repeat(100_000)}/x`);
    absoluteReaderTarget(`https://iiwiki.com/index.php?title=${"%".repeat(100_000)}`);
    absoluteReaderTarget(`https://iiwiki.com/wiki/${"a_".repeat(50_000)}#${"&".repeat(50_000)}`);
    expect(performance.now() - began).toBeLessThan(75 * TIMING_BUDGET_SCALE);
  });
});

describe("SITE_NAMESPACE", () => {
  it("a long name of words that is no talk namespace answers quickly", () => {
    const began = performance.now();
    for (const title of [`${"a ".repeat(100_000)}:`, `${"a_".repeat(100_000)}tal:`, `${"talk ".repeat(40_000)}x`]) {
      expect(SITE_NAMESPACE.test(title)).toBe(false);
    }
    expect(performance.now() - began).toBeLessThan(75 * TIMING_BUDGET_SCALE);
  });

  it("names the namespaces read on the wiki's own site, as written in a link path or as a title", () => {
    for (const title of [
      "File:Flag.png",
      "file%3AFlag.png",
      "Image:Flag.png",
      "Media:Flag.png",
      "Special:Random",
      "User:Kir",
      "User_talk:Kir",
      "User talk:Kir",
      "Category:Eurth",
      "Template:Infobox",
      "Module:Infobox",
      "Help:Editing",
      "MediaWiki:Sidebar",
      "Talk:Foo",
      "Alternate History talk:Foo",
      "Alternate_History_talk%3AFoo",
    ]) {
      expect(SITE_NAMESPACE.test(title)).toBe(true);
    }
    // Project pages are read in the reader: the rule does not exclude them.
    for (const title of [
      "Gallambria",
      "Portal:Eurth",
      "Filet mignon",
      "Media/Press",
      "Notes on Help:Editing",
      "Wiki:About",
      "IxWiki:Policy",
      "Project:About",
      "Talking points",
      "Small talks",
    ]) {
      expect(SITE_NAMESPACE.test(title)).toBe(false);
    }
  });
});

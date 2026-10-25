/** @jest-environment node */
/**
 * `wikiLinkTarget(href, basePath)` reads a hovered link as the wiki article a preview shows, or null. Article HTML
 * carries the base path at display (`withAppHrefs`), so on IxStates's deployment the reader's links are
 * `/projects/ixstates/wiki/Title`; a sister page is `/wiki/Title?source=<wiki>`; an outside link to a wiki WikiOS
 * reads is that wiki's article. Anything WikiOS cannot preview (files, specials, other namespaces, other sites, the
 * wiki's entry points) is null, and no href makes it throw.
 */
import { wikiLinkTarget } from "~/lib/wiki-os/wiki-link-target";
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
      "Wiki:About",
      "Special%3ASearch",
      "Special/Random",
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
  });

  it("other sites, other paths and non-links are null", () => {
    for (const href of [
      "https://example.com/wiki/Foo",
      "https://iiwiki.com.evil.test/wiki/Foo",
      "https://notiiwiki.com/wiki/Foo",
      "https://iiwiki.com/index.php?title=Foo",
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

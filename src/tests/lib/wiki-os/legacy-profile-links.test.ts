/** @jest-environment node */
/**
 * Old profile and passport links in wiki content resolve to the current pages when the content is rendered: the
 * ThinkPages profile paths to the persona profile, the `/id/@<u>` and `/@<u>/<tab>` passport paths to `/@<u>`.
 */
import { currentProfileHref, currentProfileLinks } from "~/lib/wiki-os/legacy-profile-links";
import { transformArticleHtml } from "~/lib/wiki-os/transformers/html-transformer";

describe("currentProfileHref", () => {
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
  ])("sends %s to %s", (old, current) => {
    expect(currentProfileHref(old)).toBe(current);
  });

  it("keeps the base path and the IxWiki origin the link already carries", () => {
    expect(currentProfileHref("/projects/ixstates/thinkpages/profile/jane")).toBe(
      "/projects/ixstates/dashboard/profile/jane"
    );
    expect(currentProfileHref("/projects/ixstates/id/@jane/work")).toBe(
      "/projects/ixstates/@jane?tab=work"
    );
    expect(currentProfileHref("https://ixwiki.com/thinkpages/u/jane")).toBe(
      "https://ixwiki.com/dashboard/profile/jane"
    );
    expect(currentProfileHref("https://www.ixwiki.com/projects/ixstates/id/@jane")).toBe(
      "https://www.ixwiki.com/projects/ixstates/@jane"
    );
  });

  it.each([
    ["/projects/ixstats/thinkpages/profile/jane", "/projects/ixstates/dashboard/profile/jane"],
    ["/projects/ixstats/thinkpages/u/jane?x=1", "/projects/ixstates/dashboard/profile/jane?x=1"],
    ["/projects/ixstats/id/@jane/work", "/projects/ixstates/@jane?tab=work"],
    ["/projects/ixstats/@jane/work#top", "/projects/ixstates/@jane?tab=work#top"],
    ["/projects/ixstats/@jane", "/projects/ixstates/@jane"],
    ["/projects/ixstats/@jane?tab=work", "/projects/ixstates/@jane?tab=work"],
    [
      "https://ixwiki.com/projects/ixstats/thinkpages/profile/jane",
      "https://ixwiki.com/projects/ixstates/dashboard/profile/jane",
    ],
  ])("moves the old base path: %s to %s", (old, current) => {
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
  ])("leaves %s as it is", (href) => {
    expect(currentProfileHref(href)).toBe(href);
  });
});

describe("currentProfileLinks", () => {
  it("rewrites the href of each link in an HTML string and nothing else", () => {
    const html =
      '<p><a href="/thinkpages/profile/jane" class="x">Jane</a> and <a href="/id/@bob/work">Bob</a> ' +
      'and <a href="/wiki/Foo">Foo</a> and <a href="https://example.com/@mastodon/1">M</a> /id/@text</p>';

    expect(currentProfileLinks(html)).toBe(
      '<p><a href="/dashboard/profile/jane" class="x">Jane</a> and <a href="/@bob?tab=work">Bob</a> ' +
        'and <a href="/wiki/Foo">Foo</a> and <a href="https://example.com/@mastodon/1">M</a> /id/@text</p>'
    );
  });

  it("returns the very same string when there is nothing to change", () => {
    const html = '<p><a href="/wiki/Foo">Foo</a></p>';
    expect(currentProfileLinks(html)).toBe(html);
  });
});

describe("an IxWiki article", () => {
  it("links to current profile pages: body, infobox and page notices", () => {
    const html =
      '<div class="mw-parser-output">' +
      '<table class="infobox"><tbody><tr><td><a href="/id/@ada/work">Ada</a></td></tr></tbody></table>' +
      '<p><a href="/thinkpages/profile/jane">Jane</a></p></div>';

    const out = transformArticleHtml(html, "", "ixwiki");

    expect(out.contentHtml).toContain('href="/dashboard/profile/jane"');
    expect(out.contentHtml).not.toContain("/thinkpages/profile/");
    expect(out.infoboxHtml).toContain('href="/@ada?tab=work"');
  });

  it("is left alone for another wiki, whose relative links are its own", () => {
    const html = '<div class="mw-parser-output"><p><a href="/@jane/work">J</a></p></div>';
    expect(transformArticleHtml(html, "", "iiwiki").contentHtml).toContain('href="/@jane/work"');
  });
});

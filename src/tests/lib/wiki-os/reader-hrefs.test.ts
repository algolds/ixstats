/**
 * Article HTML keeps its app links root-relative and without the base path (`/wiki/Title`, `/@handle`): stored
 * bundles are shared across environments and dev has no base path. `withAppHrefs` gives each such link the base path
 * at display, so on IxStates's deployment (`/projects/ixstates`) it stays in the app instead of opening classic at
 * the site's root. It is the only helper that does this (native lore's `linksUnderBasePath` moved here).
 */
import { withAppHrefs } from "~/lib/wiki-os/reader-hrefs";
import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";

const BASE = "/projects/ixstates";
const saved = process.env.NEXT_PUBLIC_BASE_PATH;

/** `withAppHrefs` under a given base path (read from the env, as in a deployment). */
function under(basePath: string, html: string): string {
  process.env.NEXT_PUBLIC_BASE_PATH = basePath;
  return withAppHrefs(html);
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_BASE_PATH = BASE;
});

afterEach(() => {
  if (saved === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = saved;
});

describe("withAppHrefs", () => {
  it("prefixes /wiki/, /dashboard/ and /@ links", () => {
    expect(withAppHrefs('<p><a href="/wiki/Venceia" title="Venceia">V</a></p>')).toBe(
      `<p><a href="${BASE}/wiki/Venceia" title="Venceia">V</a></p>`
    );
    expect(withAppHrefs('<a class="c" href="/dashboard/accounts">C</a>')).toBe(
      `<a class="c" href="${BASE}/dashboard/accounts">C</a>`
    );
    expect(withAppHrefs('<a href="/@livia">L</a>')).toBe(`<a href="${BASE}/@livia">L</a>`);
    expect(under("/p", '<A HREF="/wiki/A">a</A>')).toBe('<A HREF="/p/wiki/A">a</A>');
  });

  it("gives the File: and Special: links WikiOS reads in-app the base path too", () => {
    expect(
      withAppHrefs('<a href="/wiki/File:Map.png" class="mw-file-description"><img src="x"></a>')
    ).toBe(`<a href="${BASE}/wiki/File:Map.png" class="mw-file-description"><img src="x"></a>`);
    expect(withAppHrefs('<a href="/wiki/Special:WhatLinksHere/Gallambria">w</a>')).toBe(
      `<a href="${BASE}/wiki/Special:WhatLinksHere/Gallambria">w</a>`
    );
  });

  it("rewrites every link in the HTML, each once", () => {
    expect(withAppHrefs('<a href="/wiki/A">a</a> and <a href="/wiki/B">b</a>')).toBe(
      `<a href="${BASE}/wiki/A">a</a> and <a href="${BASE}/wiki/B">b</a>`
    );
  });

  it("finds a link's href after an earlier attribute whose value holds a > (the serializer leaves it raw)", () => {
    expect(withAppHrefs('<a title="A > B" href="/wiki/A">a</a>')).toBe(
      `<a title="A > B" href="${BASE}/wiki/A">a</a>`
    );
  });

  it("a link that already carries the base path is left alone", () => {
    const html = [
      `<a href="${BASE}/wiki/A">a</a>`,
      `<a href="${BASE}?x">b</a>`,
      `<a href="${BASE}#a">c</a>`,
      `<a href="${BASE}/@livia">d</a>`,
    ].join("");
    expect(withAppHrefs(html)).toBe(html);
    expect(withAppHrefs(withAppHrefs('<a href="/wiki/A">a</a>'))).toBe(
      `<a href="${BASE}/wiki/A">a</a>`
    );
  });

  it("counts a link as under the base path only at a boundary", () => {
    // A base path that is itself an app path shows the boundary rule: /@app, /@app/…, /@app?x and /@app#a are under
    // it, /@apple is not.
    for (const href of ["/@app", "/@app/wiki/A", "/@app?x", "/@app#a"]) {
      expect(under("/@app", `<a href="${href}">a</a>`)).toBe(`<a href="${href}">a</a>`);
    }
    expect(under("/@app", '<a href="/@apple">a</a>')).toBe('<a href="/@app/@apple">a</a>');
  });

  it("leaves absolute, protocol-relative, fragment, /api/ and /images/ links alone", () => {
    const html = [
      '<a href="https://iiwiki.com/wiki/B">a</a>',
      '<a href="https://ixwiki.com/wiki/Special:FilePath/X.png">b</a>',
      '<a href="//example.com/wiki/x">c</a>',
      '<a href="/\\evil.com/wiki/x">d</a>',
      '<a href="#History">e</a>',
      '<a href="/api/mediawiki/ixwiki/x">f</a>',
      '<a href="/images/a/ab/File.png">g</a>',
    ].join("");
    expect(withAppHrefs(html)).toBe(html);
  });

  it("leaves every other root path where it is: MediaWiki's index.php, api.php, other routes", () => {
    const html = [
      '<a href="/index.php?title=X">a</a>',
      '<a href="/index.php?title=Special:Search">b</a>',
      '<a href="/api.php">c</a>',
      '<a href="/w/index.php?title=X">d</a>',
      '<a href="/countries/caphiria">e</a>',
      '<a href="/wiki">f</a>',
      '<a href="/dashboard">g</a>',
      '<a href="/wikis/x">h</a>',
    ].join("");
    expect(withAppHrefs(html)).toBe(html);
  });

  it("touches only links, never text or other elements that look like one", () => {
    const html = [
      '<p>write href="/wiki/A" like this</p>',
      '<img src="/wiki/x.png">',
      '<abbr href="/wiki/B">b</abbr>',
      '<a data-href="/wiki/C">c</a>',
      // The serializer leaves `<` raw in an attribute value: an `<a` there never starts a link.
      '<span title="<a " href="/wiki/D">d</span>',
      "<a>e</a>",
    ].join("");
    expect(withAppHrefs(html)).toBe(html);
  });

  it("is linear on values full of a raw `<a ` and a long page", () => {
    const html = `<span title="${"<a ".repeat(20_000)}">x</span>${"<p>t</p>".repeat(20_000)}<a href="/wiki/A">a</a>`;
    const started = performance.now();
    const out = withAppHrefs(html);
    expect(performance.now() - started).toBeLessThan(50 * TIMING_BUDGET_SCALE);
    expect(out).toBe(html.replace('"/wiki/A"', `"${BASE}/wiki/A"`));
  });

  it("is linear on tags that never close, and leaves the rest of such HTML as it is", () => {
    for (const opener of ['<a href="', "<ref", '<span title="', "<"]) {
      const html = `<a href="/wiki/A">a</a>${opener.repeat(10_000)}<a href="/wiki/B">b</a>`;
      const started = performance.now();
      const out = withAppHrefs(html);
      expect(performance.now() - started).toBeLessThan(50 * TIMING_BUDGET_SCALE);
      expect(out.startsWith(`<a href="${BASE}/wiki/A">a</a>`)).toBe(true);
    }
    // A quote that never closes: the walk ends at its tag, and a link after it is not read out of the broken value.
    expect(withAppHrefs('<a href="/wiki/A">a</a><span title="x><a href="/wiki/B">b</a>')).toBe(
      `<a href="${BASE}/wiki/A">a</a><span title="x><a href="/wiki/B">b</a>`
    );
  });

  it("with no base path the HTML is unchanged", () => {
    const html = '<a href="/wiki/A">a</a><a href="/@x">b</a><a href="/dashboard/y">c</a>';
    expect(under("", html)).toBe(html);
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(withAppHrefs(html)).toBe(html);
  });
});

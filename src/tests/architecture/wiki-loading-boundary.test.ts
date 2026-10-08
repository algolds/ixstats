/** @jest-environment node */
/**
 * A `loading.tsx` above a route makes Next flush the shell before the page runs, so `notFound()`,
 * `redirect()` and `permanentRedirect()` from it answer HTTP 200 (verified on Next 16.3.6). The
 * WikiOS routes need the real 404, 307 and 308: no `loading.tsx` may be an ancestor of
 * `src/app/(wiki-os)`. The loading UI lives in `_components/RootLoading.tsx` and every other
 * top-level route segment re-exports it from its own `loading.tsx`.
 *
 * The passport redirects need the real 308 too: `/id/[username]` (canonical handle) and the legacy
 * `/r/[realm]/[username]` have no `loading.tsx` above them. `/r`'s loading UI sits in the realm's
 * `(region)` group instead, below the legacy path.
 */
import fs from "node:fs";
import path from "node:path";

const APP = path.join(process.cwd(), "src/app");
const WIKI_GROUP = "(wiki-os)";
/** Directories that are not route segments with pages of their own, or are WikiOS's. */
const NOT_LOADING_SEGMENTS = new Set([
  WIKI_GROUP,
  "api",
  "wiki-sitemap",
  "robots.txt",
  "_components",
]);
/** A segment with a loading.tsx of its own that is not the shared one. */
const OWN_LOADING = new Set(["builder"]);
/** Top-level segments whose redirect pages need the real 308, so they have no loading.tsx. */
const REDIRECT_SEGMENTS = new Set(["id", "r"]);
/** The redirect pages, relative to src/app. */
const REDIRECT_PAGES = ["id/[username]/page.tsx", "r/[realm]/[username]/page.tsx"];

const LOADING_FILE = /^loading\.(?:tsx?|jsx?)$/;
const PAGE_FILE = /^page\.(?:tsx?|jsx?)$/;

function walk(dir: string, visit: (file: string) => void): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else visit(full);
  }
}

const hasLoading = (dir: string) => fs.readdirSync(dir).some((name) => LOADING_FILE.test(name));

describe("no loading.tsx above the WikiOS routes", () => {
  it("there is none at src/app", () => {
    expect(fs.readdirSync(APP).filter((name) => LOADING_FILE.test(name))).toEqual([]);
  });

  it("there is none in any ancestor directory of a (wiki-os) page", () => {
    const pages: string[] = [];
    walk(path.join(APP, WIKI_GROUP), (file) => {
      if (PAGE_FILE.test(path.basename(file))) pages.push(file);
    });
    expect(pages.length).toBeGreaterThan(20); // the walk found the wiki routes

    const offenders: string[] = [];
    for (const page of pages) {
      for (let dir = path.dirname(page); dir.startsWith(APP); dir = path.dirname(dir)) {
        if (hasLoading(dir)) offenders.push(path.relative(process.cwd(), dir));
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  it("the catch-all route has none either", () => {
    const wikiDir = path.join(APP, WIKI_GROUP, "wiki", "[...slug]");
    expect(fs.existsSync(path.join(wikiDir, "page.tsx"))).toBe(true);
    expect(hasLoading(wikiDir)).toBe(false);
    expect(hasLoading(path.join(APP, WIKI_GROUP, "wiki"))).toBe(false);
    expect(hasLoading(path.join(APP, WIKI_GROUP))).toBe(false);
  });
});

describe("no loading.tsx above the passport redirects", () => {
  it.each(REDIRECT_PAGES)("%s has none in any ancestor directory", (page) => {
    const file = path.join(APP, page);
    expect(fs.existsSync(file)).toBe(true);
    const offenders: string[] = [];
    for (let dir = path.dirname(file); dir.startsWith(APP); dir = path.dirname(dir)) {
      if (hasLoading(dir)) offenders.push(path.relative(process.cwd(), dir));
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the realm pages' loading UI inside the (region) group", () => {
    const source = fs.readFileSync(path.join(APP, "r/[realm]/(region)/loading.tsx"), "utf8");
    expect(source).toContain('from "~/app/_components/RootLoading"');
  });
});

describe("the non-wiki route segments keep their loading UI", () => {
  const segments = fs
    .readdirSync(APP, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !NOT_LOADING_SEGMENTS.has(entry.name))
    .filter((entry) => !REDIRECT_SEGMENTS.has(entry.name))
    .map((entry) => entry.name)
    .filter((name) => {
      let hasPage = false;
      walk(path.join(APP, name), (file) => {
        hasPage ||= PAGE_FILE.test(path.basename(file));
      });
      return hasPage;
    });

  it("finds the segments (so the test below is not vacuous)", () => {
    expect(segments).toEqual(
      expect.arrayContaining(["dashboard", "mycountry", "vault", "(forum)", "builder"])
    );
  });

  it.each(segments)("%s has a loading.tsx", (segment) => {
    expect(hasLoading(path.join(APP, segment))).toBe(true);
  });

  it.each(segments.filter((segment) => !OWN_LOADING.has(segment)))(
    "%s re-exports the shared RootLoading",
    (segment) => {
      const source = fs.readFileSync(path.join(APP, segment, "loading.tsx"), "utf8");
      expect(source).toContain('from "~/app/_components/RootLoading"');
    }
  );

  it("the shared loading UI exists and is the old root one", () => {
    const source = fs.readFileSync(path.join(APP, "_components", "RootLoading.tsx"), "utf8");
    expect(source).toContain("GlobalLoader");
    expect(source).toContain('"use client"');
  });
});

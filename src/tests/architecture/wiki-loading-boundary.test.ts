/** @jest-environment node */
/**
 * A `loading.tsx` above a route makes Next flush the shell before the page runs, so `notFound()`,
 * `redirect()` and `permanentRedirect()` from it answer HTTP 200 (verified on Next 16.3.6). The
 * WikiOS routes need the real 404, 307 and 308: no `loading.tsx` may be an ancestor of
 * `src/app/(wiki-os)`.
 *
 * The passport redirect needs the real 308 too: `/id/[username]` (canonical handle) has no `loading.tsx` above it.
 * `/r`'s loading UI sits in the realm's `(region)` group instead.
 *
 * The forum post permalink resolver (`/thinkpages/post/<id>`), "Your realm" (`/thinkpages/r/mine`) and "jump to
 * unread" (`/thinkpages/t/<id>/unread`) need the real 307 too, so no `loading.tsx` sits above them. Of the forum's
 * loaders only `thinkpages/loading.tsx` itself is absent: `c/`, `mod/` and `r/[realm]/[key]/` have their own, and the
 * thread page's sits in the `t/[threadId]/(thread)/` route group, so it does not wrap the unread redirect beside it.
 * `/thinkpages` and the realm landing page only render (they no longer redirect), so they are not pinned.
 */
import fs from "node:fs";
import path from "node:path";

const APP = path.join(process.cwd(), "src/app");
const WIKI_GROUP = "(wiki-os)";
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

/** Every directory from the page's own up to src/app that holds a loading.tsx. */
function loadingAbove(page: string): string[] {
  const found: string[] = [];
  for (let dir = path.dirname(page); dir.startsWith(APP); dir = path.dirname(dir)) {
    if (hasLoading(dir)) found.push(path.relative(process.cwd(), dir));
  }
  return found;
}

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
    expect([...new Set(pages.flatMap(loadingAbove))]).toEqual([]);
  });
});

describe("no loading.tsx above the redirect pages", () => {
  it.each([
    "id/[username]/page.tsx",
    "thinkpages/post/[postId]/page.tsx",
    "thinkpages/r/mine/page.tsx",
    "thinkpages/t/[threadId]/unread/page.tsx",
  ])("%s has none in any ancestor directory", (page) => {
    const file = path.join(APP, page);
    expect(fs.existsSync(file)).toBe(true);
    expect(loadingAbove(file)).toEqual([]);
  });
});

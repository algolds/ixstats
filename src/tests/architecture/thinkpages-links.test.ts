/** @jest-environment node */
/**
 * Phase 5 of the ThinkPages forum: /thinkpages is the forum. The persona hub is /dashboard/accounts, feed posts
 * /dashboard/post/<id>, persona profiles /dashboard/profile/<username>, saved posts /dashboard/saved. The old
 * /thinkpages pages only redirect, so nothing links to them; /thinkpages/post/<id> is the forum post permalink
 * (ruling P5, written into wiki story chains) and only the resolver page and the link-builder modules spell it.
 *
 * Scope: ts/tsx under src/ (markdown is out of scope). Comment lines are skipped. The patterns need a
 * non-word character before `/thinkpages`, so import specifiers such as `~/components/thinkpages/post/...`
 * and `~/lib/thinkpages/post-views` are not link literals and do not trip them.
 *
 * Phase 4b retired the XenForo bridge: `/forum/*` only redirects (permanently, through the import's id map), so
 * nothing links to it either. Only the files that recognize old links or build a XenForo post's legacy permalink
 * may spell it (`BRIDGE_FILES`).
 */
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");
const SKIP_DIRS = new Set(["tests", "node_modules", "generated"]);

/** The retired pages: they only redirect, and are the one place their old paths may be named. */
const LEGACY_PAGES = [
  "app/thinkpages/feed/page.tsx",
  "app/thinkpages/forum/page.tsx",
  "app/thinkpages/profile/[username]/page.tsx",
  "app/thinkpages/saved/page.tsx",
  "app/thinkpages/thinkshare/page.tsx",
  "app/thinkpages/thinktanks/page.tsx",
  // Recognizes the old persona profile path in existing wiki pages (hover card); it builds no link.
  "components/wiki-os/reader/WikiLinkPreview.tsx",
];
/**
 * Where `/thinkpages/post/<id>` is built: the resolver page, the wiki action-link builder, and the forum link
 * module (`postHref`, which is also the target of phase 4's `/forum/post/<xf>` redirect).
 */
const PERMALINK_FILES = [
  "app/thinkpages/post/[postId]/page.tsx",
  "lib/action-links.ts",
  "lib/thinkpages-forum/links.ts",
];
/** Files that may spell `/forum`: they recognize stored old links, or point an old XenForo post at its redirect. */
const BRIDGE_FILES = [
  "lib/action-links.ts", // postPermalinkPath("xenforo", …) → /forum/post/<id>, which 308s to the import
  "lib/thinkpages-forum/html-urls.ts", // rebases stored root-relative links, old /forum/ ones included
  "app/_components/SetupRedirect.tsx", // lets the legacy redirects through without a nation
  "components/wiki-os/stashes/StashThreadsList.tsx", // legacy forum:thread: stash items open their old path (Q15)
  "lib/thinkpages-forum/import/bbcode.ts", // the importer's link rewriting for old in-forum links
  "server/modules/thinkpages-forum/import-db.ts", // the importer's lookups
];
/** The bridge's `/forum` path: not `/thinkpages/forum`, `~/components/forum`, `(forum)` or `forum.ixwiki.com`. */
const BRIDGE_PATH = /(?<![\w./(-])\/forum(?=[/"'`?#]|$)/;
const LEGACY_PATH =
  /(?<!\w)\/thinkpages\/(?:feed|forum|profile|saved|thinkshare|thinktanks)(?![\w-])/;
const POST_PATH = /(?<!\w)\/thinkpages\/post(?![\w-])/;
const HUB_REDIRECT_PATH = /redirectPath=["']\/thinkpages/;

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) sources(full, found);
    } else if (/\.tsx?$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

const FILES = sources(SRC).map((file) => ({
  rel: path.relative(SRC, file).split(path.sep).join("/"),
  lines: fs.readFileSync(file, "utf8").split("\n"),
}));

const isComment = (line: string): boolean => /^\s*(?:\/\/|\*|\/\*)/.test(line);

/** `src/<file>:<line>` for each non-comment line matching `pattern`, outside the allowed files. */
function offenders(pattern: RegExp, allowed: readonly string[] = []): string[] {
  const found: string[] = [];
  for (const { rel, lines } of FILES) {
    if (allowed.includes(rel)) continue;
    lines.forEach((line, index) => {
      if (!isComment(line) && pattern.test(line)) found.push(`src/${rel}:${index + 1}`);
    });
  }
  return found;
}

function filesContaining(needle: string): number {
  return FILES.filter(({ lines }) => lines.some((line) => line.includes(needle))).length;
}

describe("the patterns catch the old links (and only links)", () => {
  it.each([
    'href="/thinkpages/profile/ada"',
    "href={`/thinkpages/profile/${username}`}",
    'router.push("/thinkpages/saved")',
    "redirect('/thinkpages/feed')",
    'href="/thinkpages/forum"',
    "`${origin}/thinkpages/forum?realm=x`",
    'href="/thinkpages/thinkshare"',
    'href="/thinkpages/thinktanks"',
  ])("LEGACY_PATH matches %s", (line) => {
    expect(LEGACY_PATH.test(line)).toBe(true);
  });

  it.each([
    'href="/thinkpages"',
    "href={`/thinkpages/t/${id}`}",
    'href="/thinkpages/c/general"',
    'href="/thinkpages/r/ixwiki"',
    'href="/thinkpages/mod"',
    'import { x } from "~/components/thinkpages/post/ThinkpagesPostUtils";',
    'import { y } from "~/lib/thinkpages/post-views";',
    'import { z } from "~/app/thinkpages/forum/page";',
    'href="/dashboard/profile/ada"',
    'href="/help/social/thinkpages"',
  ])("the guard lets %s through", (line) => {
    expect(LEGACY_PATH.test(line) || POST_PATH.test(line)).toBe(false);
  });

  it.each(['href="/forum"', 'router.push("/forum/thread/12")', "`/forum?sort=new`", "path: '/forum/new-thread',"])(
    "BRIDGE_PATH matches %s",
    (line) => {
      expect(BRIDGE_PATH.test(line)).toBe(true);
    }
  );

  it.each([
    'href="/thinkpages/forum"',
    'import { x } from "~/components/forum/reader/PostCard";',
    'const dir = "src/app/(forum)";',
    '"https://forum.ixwiki.com/threads/12/"',
    'href="/forums-of-old"',
  ])("BRIDGE_PATH lets %s through", (line) => {
    expect(BRIDGE_PATH.test(line)).toBe(false);
  });

  it("POST_PATH matches the permalink and nothing longer-named", () => {
    expect(POST_PATH.test("`/thinkpages/post/${id}`")).toBe(true);
    expect(POST_PATH.test('"/thinkpages/post-views"')).toBe(false);
    expect(POST_PATH.test('"~/components/thinkpages/post/Utils"')).toBe(false);
  });

  it("HUB_REDIRECT_PATH matches a guarded page redirecting into /thinkpages", () => {
    expect(HUB_REDIRECT_PATH.test('<AuthenticationGuard redirectPath="/thinkpages/saved">')).toBe(true);
    expect(HUB_REDIRECT_PATH.test('<AuthenticationGuard redirectPath="/dashboard/saved">')).toBe(false);
  });
});

describe("nothing links to the retired XenForo bridge (phase 4b)", () => {
  it("spells /forum only where old links are recognized or redirected", () => {
    expect(offenders(BRIDGE_PATH, BRIDGE_FILES)).toEqual([]);
  });
});

describe("nothing links to a retired ThinkPages feed page", () => {
  it("links nothing to the retired /thinkpages pages", () => {
    expect(offenders(LEGACY_PATH, LEGACY_PAGES)).toEqual([]);
  });

  it("builds /thinkpages/post/<id> only as the forum permalink", () => {
    expect(offenders(POST_PATH, PERMALINK_FILES)).toEqual([]);
  });

  it("FORUM_HOME is /thinkpages (so no source spells /thinkpages/forum)", () => {
    const links = FILES.find(({ rel }) => rel === "lib/thinkpages-forum/links.ts");
    expect(links?.lines.join("\n")).toMatch(/export const FORUM_HOME = "\/thinkpages";/);
  });

  it("the account hub is the Dashboard's Accounts section", () => {
    expect(fs.existsSync(path.join(SRC, "components/thinkpages/ThinkPagesAccountHub.tsx"))).toBe(false);
    expect(offenders(/ThinkPagesAccountHub/)).toEqual([]);
  });

  it("is not vacuous: feed posts and persona profiles are linked under /dashboard", () => {
    expect(filesContaining("/dashboard/post/")).toBeGreaterThanOrEqual(6);
    expect(filesContaining("/dashboard/profile/")).toBeGreaterThanOrEqual(2);
  });

  it("guarded pages never redirect into /thinkpages (the forum is public, the guarded pages moved)", () => {
    expect(offenders(HUB_REDIRECT_PATH)).toEqual([]);
  });
});

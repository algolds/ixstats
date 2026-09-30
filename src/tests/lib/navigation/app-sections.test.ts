/** @jest-environment node */
/**
 * Facet 3 navigation shell (spec §7.4, Phase 3): the app section map may only link to routes that
 * exist and render (a `src/app/**\/page.tsx` that is not a bare `redirect()` stub), and its
 * resolvers pick exactly one app and one section per URL.
 */
import fs from "fs";
import path from "path";
import {
  APPS,
  TAB_BAR_SLOTS,
  getActiveSectionId,
  getApp,
  getAppForPath,
  getTintForPath,
  getVisibleApps,
  isChromelessPath,
  matchesPrefix,
  splitTabBarApps,
} from "~/lib/navigation/app-sections";

const appDir = path.resolve(__dirname, "../../../app");

function listPages(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listPages(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

/** One page route as a matcher over URL segments (route groups dropped). */
function toMatcher(file: string): { file: string; regex: RegExp } {
  const segments = path
    .relative(appDir, path.dirname(file))
    .split(path.sep)
    .filter((segment) => segment !== "" && !/^\(.*\)$/.test(segment));
  let pattern = "";
  for (const segment of segments) {
    if (/^\[\[\.\.\..+\]\]$/.test(segment)) pattern += "(?:/[^/]+)*";
    else if (/^\[\.\.\..+\]$/.test(segment)) pattern += "(?:/[^/]+)+";
    else if (/^\[.+\]$/.test(segment)) pattern += "/[^/]+";
    else pattern += `/${segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
  }
  return { file, regex: new RegExp(`^${pattern || "/"}$`.replace("^/$", "^/?$")) };
}

const pages = listPages(appDir).map(toMatcher);

/** Prefer a static route over a dynamic one, as Next does. */
function resolvePage(href: string): string | undefined {
  const pathname = href.split(/[?#]/)[0] || "/";
  const matches = pages.filter(({ regex }) => regex.test(pathname));
  matches.sort((a, b) => a.regex.source.split("[^/]").length - b.regex.source.split("[^/]").length);
  return matches[0]?.file;
}

/** A page that only forwards elsewhere (server `redirect()` or a client `router.replace`). */
function isRedirectStub(file: string): boolean {
  const source = fs
    .readFileSync(file, "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const forwards = /\b(?:permanentRedirect|redirect)\(|\brouter\.replace\(/.test(source);
  return forwards && !/return\s*\(?\s*</.test(source);
}

const allLinks = APPS.flatMap((app) => [
  { owner: app.id, href: app.href },
  ...app.sections.map((section) => ({ owner: `${app.id}/${section.id}`, href: section.href })),
]);

describe("app section map routes", () => {
  it.each(allLinks)("$owner → $href resolves to a page", ({ href }) => {
    expect(resolvePage(href)).toBeDefined();
  });

  it("links to no redirect-only pages", () => {
    const stubs = allLinks
      .map(({ owner, href }) => ({ owner, href, file: resolvePage(href) }))
      .filter(({ file }) => file !== undefined && isRedirectStub(file))
      .map(({ owner, href }) => `${owner}: ${href}`);
    expect(stubs).toEqual([]);
  });

  it("uses only settings tabs that the settings page knows", () => {
    const source = fs.readFileSync(path.join(appDir, "settings/_lib/sections.ts"), "utf-8");
    const union = source.match(/export type SettingSectionId =([^;]+);/)?.[1] ?? "";
    const valid = new Set([...union.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]));
    const used = getApp("settings").sections.map(
      (section) => new URLSearchParams(section.href.split("?")[1]).get("tab") ?? ""
    );
    expect(valid.size).toBeGreaterThan(0);
    expect(used.filter((tab) => !valid.has(tab))).toEqual([]);
  });

  it("has unique app ids and unique section ids per app", () => {
    const ids = APPS.map((app) => app.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const app of APPS) {
      const sectionIds = app.sections.map((section) => section.id);
      expect(new Set(sectionIds).size).toBe(sectionIds.length);
    }
  });

  it("lists MyCountry's sections in order", () => {
    expect(getApp("mycountry").sections.map((section) => section.id)).toEqual([
      "overview",
      "executive",
      "economy",
      "diplomacy",
      "defense",
      "politics",
      "intelligence",
      "map-editor",
      "editor",
    ]);
  });
});

describe("app section map resolvers", () => {
  it("matches prefixes on segment boundaries", () => {
    expect(matchesPrefix("/mycountry/economy", "/mycountry")).toBe(true);
    expect(matchesPrefix("/mycountry", "/mycountry/")).toBe(true);
    expect(matchesPrefix("/mycountryx", "/mycountry")).toBe(false);
    expect(matchesPrefix("/dashboard", "/")).toBe(false);
    expect(matchesPrefix("/", "/")).toBe(true);
  });

  it.each([
    ["/", "home"],
    ["/dashboard", "home"],
    ["/mycountry/intelligence", "mycountry"],
    ["/thinktanks/abc", "thinkpages"],
    ["/messages/inbox", "thinkpages"],
    ["/vault/ns-deck/foo", "vault"],
    ["/util/search", "wiki"],
    ["/blurbs/abc", "wiki"],
    ["/wiki/Some_Article", "wiki"],
    ["/forum/thread/1", "forum"],
    ["/myclub/2", "sports"],
    ["/countries/caphiria/dossier", "countries"],
    ["/admin/users", "admin"],
    ["/settings", "settings"],
  ])("puts %s in %s", (pathname, appId) => {
    expect(getAppForPath(pathname)?.id).toBe(appId);
  });

  it("leaves unknown routes without an app", () => {
    expect(getAppForPath("/setup")).toBeUndefined();
  });

  it("picks the most specific section", () => {
    const mycountry = getApp("mycountry");
    expect(getActiveSectionId(mycountry, "/mycountry", null)).toBe("overview");
    expect(getActiveSectionId(mycountry, "/mycountry/economy", null)).toBe("economy");
    expect(getActiveSectionId(mycountry, "/mycountry/builder", null)).toBeUndefined();
    const vault = getApp("vault");
    expect(getActiveSectionId(vault, "/vault/trading", null)).toBe("marketplace");
    expect(getActiveSectionId(vault, "/vault/inventory", null)).toBe("cards");
    const forum = getApp("forum");
    expect(getActiveSectionId(forum, "/forum/search", null)).toBe("search");
    expect(getActiveSectionId(forum, "/forum/thread/9", null)).toBe("forums");
  });

  it("matches query sections, falling back to the default tab", () => {
    const settings = getApp("settings");
    expect(getActiveSectionId(settings, "/settings", new URLSearchParams("tab=appearance"))).toBe(
      "appearance"
    );
    expect(getActiveSectionId(settings, "/settings", new URLSearchParams())).toBe("account");
    expect(getActiveSectionId(settings, "/settings", null)).toBe("account");
  });

  it("uses a section's tint over the app's", () => {
    const mycountry = getApp("mycountry");
    expect(getTintForPath(mycountry, "intelligence")).toBe("intel");
    expect(getTintForPath(mycountry, "economy")).toBe("mycountry");
    expect(getTintForPath(getApp("countries"), "directory")).toBeUndefined();
  });

  it("keeps Maps and the full-screen map editors chromeless", () => {
    expect(isChromelessPath("/maps")).toBe(true);
    expect(isChromelessPath("/maps/anything")).toBe(true);
    expect(isChromelessPath("/mycountry/map-editor")).toBe(true);
    expect(isChromelessPath("/admin/maps/editor")).toBe(true);
    expect(isChromelessPath("/admin/maps")).toBe(false);
    expect(isChromelessPath("/mycountry")).toBe(false);
  });
});

describe("app visibility and the tab bar", () => {
  it("hides signed-in, admin and admin-disabled apps", () => {
    const signedOut = getVisibleApps({ signedIn: false, isAdmin: false }).map((app) => app.id);
    expect(signedOut).not.toContain("mycountry");
    expect(signedOut).not.toContain("admin");
    expect(signedOut).toContain("countries");

    const member = getVisibleApps({ signedIn: true, isAdmin: false }).map((app) => app.id);
    expect(member).toContain("mycountry");
    expect(member).not.toContain("admin");

    const admin = getVisibleApps({
      signedIn: true,
      isAdmin: true,
      navigationSettings: { showWikiTab: false },
    }).map((app) => app.id);
    expect(admin).toContain("admin");
    expect(admin).not.toContain("wiki");
  });

  it("gives the tab bar four primary apps and puts the rest under More", () => {
    const visible = getVisibleApps({ signedIn: true, isAdmin: true });
    const { primary, more } = splitTabBarApps(visible);
    expect(primary.map((app) => app.id)).toEqual(["home", "mycountry", "maps", "thinkpages"]);
    expect(primary).toHaveLength(TAB_BAR_SLOTS);
    expect(more.map((app) => app.id)).toEqual(
      expect.arrayContaining(["countries", "wiki", "forum", "vault", "admin"])
    );
    const signedOut = splitTabBarApps(getVisibleApps({ signedIn: false, isAdmin: false }));
    expect(signedOut.primary.map((app) => app.id)).toEqual(["maps", "countries", "wiki", "forum"]);
  });
});

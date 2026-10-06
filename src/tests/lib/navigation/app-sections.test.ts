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
  groupSections,
  isChromelessPath,
  matchesPrefix,
  splitTabBarApps,
} from "~/lib/navigation/app-sections";
import { SETTINGS_TAB_IDS } from "~/app/settings/_lib/sections";

const appDir = path.resolve(__dirname, "../../../app");
const srcDir = path.resolve(__dirname, "../../..");

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
  // External links (the Discord invite) leave the app, so there is no page of ours to resolve.
  ...app.sections
    .filter((section) => !section.external)
    .map((section) => ({ owner: `${app.id}/${section.id}`, href: section.href })),
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

  it("lists exactly the settings tabs the settings page renders", () => {
    const tabOf = (href: string) => new URLSearchParams(href.split("?")[1]).get("tab");
    const sections = getApp("settings").sections;
    expect(sections.map((section) => section.id).sort()).toEqual([...SETTINGS_TAB_IDS].sort());
    expect(sections.map((section) => tabOf(section.href))).toEqual(
      sections.map((section) => section.id)
    );
  });

  it("has unique app ids and unique section ids per app", () => {
    const ids = APPS.map((app) => app.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const app of APPS) {
      const sectionIds = app.sections.map((section) => section.id);
      expect(new Set(sectionIds).size).toBe(sectionIds.length);
    }
  });

  it("lists MyCountry's sections in order (Intelligence, Map editor and Editor are not rows)", () => {
    expect(getApp("mycountry").sections.map((section) => section.id)).toEqual([
      "overview",
      "executive",
      "economy",
      "diplomacy",
      "politics",
      "defense",
    ]);
  });

  it("opens the Realms app on /realms, with My realm and Explore as its sections", () => {
    const realms = getApp("countries");
    expect(realms).toMatchObject({ label: "Realms", href: "/realms" });
    expect(realms.sections.map((section) => [section.label, section.href])).toEqual([
      ["My realm", "/countries"],
      ["Explore", "/realms"],
    ]);
  });

  it("folds ThinkPages into Home as emerald-tinted sections", () => {
    expect(APPS.map((app) => app.id)).not.toContain("thinkpages");
    const home = getApp("home");
    expect(home.sections.filter((s) => !s.conditional).map((s) => s.label)).toEqual([
      "Dashboard",
      "Messages",
      "ThinkTanks",
      "ThinkPages",
    ]);
    expect(home.sections.find((s) => s.label === "ThinkTanks")).toMatchObject({
      href: "/thinktanks",
      tint: "thinkpages",
    });
    expect(home.sections.find((s) => s.label === "ThinkPages")).toMatchObject({
      href: "/thinkpages",
      tint: "thinkpages",
    });
  });

  it.each([
    ["/thinkpages", "thinkpages"],
    ["/thinkpages/post/abc", "thinkpages"],
    ["/thinkpages/profile/someone", "thinkpages"],
    ["/thinktanks", "thinktanks"],
    ["/thinktanks/abc", "thinktanks"],
  ])("resolves %s to Home's %s section with the thinkpages tint", (pathname, sectionId) => {
    const home = getAppForPath(pathname);
    expect(home?.id).toBe("home");
    const active = getActiveSectionId(home!, pathname, null);
    expect(active).toBe(sectionId);
    expect(getTintForPath(home, active)).toBe("thinkpages");
  });

  it("gives /mycountry/intelligence (no row of its own) Defense's highlight and crimson tint", () => {
    const mycountry = getAppForPath("/mycountry/intelligence")!;
    expect(mycountry.id).toBe("mycountry");
    const active = getActiveSectionId(mycountry, "/mycountry/intelligence", null);
    expect(active).toBe("defense");
    expect(getTintForPath(mycountry, active)).toBe("intel");
  });

  it("keeps Home untinted on its own pages", () => {
    expect(getTintForPath(getApp("home"), "messages")).toBeUndefined();
  });
});

describe("admin sections", () => {
  it("lists the admin console's full set of pages", () => {
    const admin = APPS.find((app) => app.id === "admin")!;
    expect(admin.sections.length).toBeGreaterThan(25);
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
    ["/thinktanks/abc", "home"],
    ["/messages/inbox", "home"],
    ["/vault/ns-deck/foo", "vault"],
    ["/util/search", "wiki"],
    ["/blurbs/abc", "wiki"],
    ["/wiki/Some_Article", "wiki"],
    ["/forum/thread/1", "forum"],
    ["/myclub/2", "labs"],
    ["/myleague", "labs"],
    ["/countries/caphiria/dossier", "countries"],
    ["/admin/users", "admin"],
    ["/settings", "settings"],
    ["/stashes", "wiki"],
    ["/labs/vexel", "labs"],
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

  it("resolves forum feeds and wiki aliases", () => {
    const forum = getApp("forum");
    expect(getActiveSectionId(forum, "/forum", new URLSearchParams("sort=trending"))).toBe(
      "trending"
    );
    expect(getActiveSectionId(forum, "/forum", new URLSearchParams("sort=new"))).toBe("new-posts");
    expect(getActiveSectionId(forum, "/forum", new URLSearchParams())).toBe("forums");
    const wiki = getApp("wiki");
    expect(getActiveSectionId(wiki, "/wiki/Main_Page", null)).toBe("main");
    expect(getActiveSectionId(wiki, "/wiki/Some_Article", null)).toBeUndefined();
    expect(getActiveSectionId(wiki, "/stashes", null)).toBe("stashes");
    expect(getAppForPath("/labs/onoma/studio")?.id).toBe("labs");
    expect(getActiveSectionId(getApp("labs"), "/labs/onoma/studio", null)).toBe("onoma");
  });

  it("groups consecutive sections under their sub-heading", () => {
    const runs = groupSections(getApp("admin").sections);
    expect(runs[0]).toMatchObject({ group: undefined });
    expect(runs[0]?.sections.map((section) => section.id)).toEqual(["overview"]);
    expect(runs.slice(1).map((run) => run.group)).toEqual([
      "Platform",
      "Apps",
      "Simulation",
      "Users & security",
      "Labs",
    ]);
    expect(groupSections(getApp("mycountry").sections)).toHaveLength(1);
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
    expect(getTintForPath(mycountry, "defense")).toBe("intel");
    expect(getTintForPath(mycountry, "economy")).toBe("mycountry");
    expect(getTintForPath(getApp("countries"), "countries")).toBeUndefined();
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

  it("shows Labs like the legacy nav: signed in, unless showLabsTab is off", () => {
    const hidden = { showLabsTab: false };
    expect(getVisibleApps({ signedIn: false, isAdmin: false }).map((app) => app.id)).not.toContain(
      "labs"
    );
    expect(getVisibleApps({ signedIn: true, isAdmin: false }).map((app) => app.id)).toContain(
      "labs"
    );
    const member = getVisibleApps({ signedIn: true, isAdmin: false, navigationSettings: hidden });
    expect(member.map((app) => app.id)).not.toContain("labs");
    // Admins and `labs.access` holders keep it.
    const admin = getVisibleApps({ signedIn: true, isAdmin: true, navigationSettings: hidden });
    expect(admin.map((app) => app.id)).toContain("labs");
    const granted = getVisibleApps({
      signedIn: true,
      isAdmin: false,
      hasLabsAccess: true,
      navigationSettings: hidden,
    });
    expect(granted.map((app) => app.id)).toContain("labs");
    // The bypass is Labs-only.
    const wikiOff = getVisibleApps({
      signedIn: true,
      isAdmin: true,
      hasLabsAccess: true,
      navigationSettings: { showWikiTab: false },
    });
    expect(wikiOff.map((app) => app.id)).not.toContain("wiki");
  });

  it("shows Defense only with MyCountry Premium (premium tier, beta tester, staff)", () => {
    const defense = (hasMycountryPremium?: boolean) =>
      getVisibleApps({ signedIn: true, isAdmin: false, hasMycountryPremium })
        .find((app) => app.id === "mycountry")!
        .sections.map((section) => section.id);
    expect(defense()).not.toContain("defense");
    expect(defense(false)).not.toContain("defense");
    expect(defense(true)).toContain("defense");
    // Only Defense is gated: the rest of the condensed group is for everyone.
    expect(defense(false)).toEqual(["overview", "executive", "economy", "diplomacy", "politics"]);
    expect(defense(true)).toEqual([
      "overview",
      "executive",
      "economy",
      "diplomacy",
      "politics",
      "defense",
    ]);
  });

  it("does not mutate the shared map when it filters gated sections", () => {
    getVisibleApps({ signedIn: true, isAdmin: false, hasMycountryPremium: false });
    expect(getApp("mycountry").sections.map((section) => section.id)).toContain("defense");
  });

  it("gives the tab bar four primary apps and puts the rest under More", () => {
    const visible = getVisibleApps({ signedIn: true, isAdmin: true });
    const { primary, more } = splitTabBarApps(visible);
    expect(primary.map((app) => app.id)).toEqual(["home", "mycountry", "maps", "countries"]);
    expect(primary).toHaveLength(TAB_BAR_SLOTS);
    expect(more.map((app) => app.id)).toEqual(
      expect.arrayContaining(["wiki", "forum", "vault", "labs", "admin"])
    );
    const signedOut = splitTabBarApps(getVisibleApps({ signedIn: false, isAdmin: false }));
    expect(signedOut.primary.map((app) => app.id)).toEqual(["maps", "countries", "wiki", "forum"]);
  });
});

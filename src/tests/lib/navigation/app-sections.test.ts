/** @jest-environment node */
/**
 * Facet 3 navigation shell (spec §7.4, Phase 3): the app section map may only link to routes that
 * exist and render (a `src/app/**\/page.tsx` that is not a bare `redirect()` stub), and its
 * resolvers pick exactly one app and one section per URL.
 */
import "fs";
import "path";
import {
  APPS,
  getActiveSectionId,
  getApp,
  getAppForPath,
  getVisibleApps,
  matchesPrefix,
  type NavigationVisibilitySettings,
} from "~/lib/navigation/app-sections";
describe("app section map routes", () => {
  it("has unique app ids and unique section ids per app", () => {
    const ids = APPS.map((app) => app.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const app of APPS) {
      const sectionIds = app.sections.map((section) => section.id);
      expect(new Set(sectionIds).size).toBe(sectionIds.length);
    }
  });
  it("lists Realm admin under Realms for admins only", () => {
    const sections = (isAdmin: boolean) =>
      getVisibleApps({ signedIn: true, isAdmin })
        .find((app) => app.id === "countries")
        ?.sections.map((s) => s.id);
    expect(sections(false)).toEqual(["my-realm", "explore"]);
    expect(sections(true)).toEqual(["my-realm", "explore", "realm-admin"]);
  });
  it("lists Accounts only for a signed-in member", () => {
    const labels = (signedIn: boolean) =>
      getVisibleApps({ signedIn, isAdmin: false })
        .find((app) => app.id === "thinkpages")!
        .sections.map((s) => s.label);
    expect(labels(false)).toEqual(["Forums", "ThinkTanks"]);
    expect(labels(true)).toEqual(["Forums", "ThinkTanks", "Accounts"]);
  });
});

describe("Vault app", () => {
  it("is gated by no navigation setting: every signed-in player sees it", () => {
    expect(APPS.map((app) => app.navSetting as string | undefined)).not.toContain("showCardsTab");
    const ids = (navigationSettings: NavigationVisibilitySettings) =>
      getVisibleApps({ signedIn: true, isAdmin: false, navigationSettings }).map((app) => app.id);
    expect(ids({})).toContain("vault");
    expect(ids({ showWikiTab: false, showLabsTab: false, showMapsTab: false })).toContain("vault");
    expect(getVisibleApps({ signedIn: false, isAdmin: false }).map((app) => app.id)).not.toContain(
      "vault"
    );
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
    ["/messages/inbox", "home"],
    ["/vault/ns-deck/foo", "vault"],
    ["/util/search", "wiki"],
    ["/blurbs/abc", "wiki"],
    ["/wiki/Some_Article", "wiki"],
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
    const vault = getApp("vault");
    expect(getActiveSectionId(vault, "/vault/cards/market", null)).toBe("cards");
    expect(getActiveSectionId(vault, "/vault/store", null)).toBe("store");
  });

  it("resolves wiki aliases", () => {
    const wiki = getApp("wiki");
    expect(getActiveSectionId(wiki, "/wiki/Main_Page", null)).toBe("main");
    expect(getActiveSectionId(wiki, "/wiki/Some_Article", null)).toBeUndefined();
    // Stash moved to the account menu: the page stays in the Wiki app, with no row of its own.
    expect(getActiveSectionId(wiki, "/stashes", null)).toBeUndefined();
    expect(getAppForPath("/labs/onoma/studio")?.id).toBe("labs");
    expect(getActiveSectionId(getApp("labs"), "/labs/onoma/studio", null)).toBe("onoma");
  });
  it("matches query sections, falling back to the default tab", () => {
    const settings = getApp("settings");
    expect(getActiveSectionId(settings, "/settings", new URLSearchParams("tab=appearance"))).toBe(
      "appearance"
    );
    expect(getActiveSectionId(settings, "/settings", new URLSearchParams())).toBe("account");
    expect(getActiveSectionId(settings, "/settings", null)).toBe("account");
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
  it("lists ThinkPages for everyone, with the gated sections only for those who pass the check", () => {
    const sections = (context: Parameters<typeof getVisibleApps>[0]) =>
      getVisibleApps(context)
        .find((app) => app.id === "thinkpages")
        ?.sections.map((s) => s.id);
    expect(sections({ signedIn: false, isAdmin: false })).toEqual(["forums", "thinktanks"]);
    expect(sections({ signedIn: true, isAdmin: false })).toEqual([
      "forums",
      "thinktanks",
      "accounts",
    ]);
    expect(sections({ signedIn: true, isAdmin: false, forumModerator: true })).toEqual([
      "forums",
      "thinktanks",
      "accounts",
      "moderation",
    ]);
  });

  it("keeps the shared ThinkPages object when every section is granted", () => {
    const granted = getVisibleApps({
      signedIn: true,
      isAdmin: false,
      forumModerator: true,
    }).find((app) => app.id === "thinkpages");
    expect(granted).toBe(getApp("thinkpages"));
  });
});

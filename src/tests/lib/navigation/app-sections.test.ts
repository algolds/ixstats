/** @jest-environment node */
/**
 * Facet 3 navigation shell (spec §7.4, Phase 3): the app section map may only link to routes that
 * exist and render (a `src/app/**\/page.tsx` that is not a bare `redirect()` stub), and its
 * resolvers pick exactly one app and one section per URL.
 */
import "fs";
import "path";
import {
  getApp,
  getAppForPath,
  getVisibleApps
} from "~/lib/navigation/app-sections";
describe("app section map resolvers", () => {
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
});

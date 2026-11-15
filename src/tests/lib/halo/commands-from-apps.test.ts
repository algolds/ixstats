import { APPS, withCountryRows } from "~/lib/navigation/app-sections";
import {
  commandsFromApps,
  commandsFromVisibleApps,
  NAV_COMMAND_META,
} from "~/lib/halo/commands-from-apps";

describe("commandsFromApps", () => {
  it("lists no sign-in-gated app for a signed-out viewer", () => {
    const signedOut = commandsFromApps({ signedIn: false, isAdmin: false });
    const paths = signedOut.map((entry) => entry.path);
    const gated = APPS.filter((app) => app.requiresAuth).map((app) => app.href);
    expect(gated.length).toBeGreaterThan(0);
    for (const href of gated) expect(paths).not.toContain(href);
  });

  it("derives unique routed destinations and system actions for non-admin and admin viewers", () => {
    const nonAdmin = commandsFromApps({
      signedIn: true,
      isAdmin: false,
      canOpenAdmin: false,
      ownsNation: true,
      countryHref: "/countries/aphis",
    });

    const nonAdminPaths = nonAdmin
      .map((entry) => entry.path)
      .filter((path): path is string => typeof path === "string" && !path.startsWith("#"));
    expect(new Set(nonAdminPaths).size).toBe(nonAdminPaths.length);
    expect(nonAdminPaths).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/messages",
        "/@me",
        "/mycountry",
        "/countries/aphis",
        "/mycountry/editor",
        "/mycountry/map-editor",
        "/mycountry/executive",
        "/maps",
        "/vault",
        "/vault/store",
        "/leaderboards",
        "/wiki/Main_Page",
        "/wiki?create=true",
        "/thinkpages",
        "/countries",
        "/realms",
        "/labs/onoma",
        "/exchange",
        "/exchange/markets",
        "/myleague",
        "/help",
        "/changelog",
        "/settings",
      ])
    );
    expect(nonAdmin.map((e) => e.actionId).filter(Boolean)).toEqual(
      expect.arrayContaining([
        "daily-reward",
        "random-country",
        "random-wiki",
        "reload-data",
        "toggle-sidebar",
        "toggle-theme",
        "toggle-sound",
        "toggle-compact",
        "mark-all-read",
        "open-feedback",
      ])
    );
    expect(nonAdmin.some((e) => e.path?.startsWith("/admin"))).toBe(false);
  });

  it("hides apps and scoped extra deep links when admin navigationSettings turn tabs off", () => {
    const derived = commandsFromApps({
      signedIn: true,
      isAdmin: false,
      canOpenAdmin: false,
      hasLabsAccess: false,
      navigationSettings: {
        showMapsTab: false,
        showLabsTab: false,
        showWikiTab: false,
        showHelpTab: false,
      },
    });

    const paths = new Set(derived.map((e) => e.path));
    expect(paths.has("/maps")).toBe(false);
    expect(paths.has("/labs/onoma")).toBe(false);
    expect(paths.has("/exchange")).toBe(false);
    expect(paths.has("/exchange/markets")).toBe(false);
    expect(paths.has("/exchange/portfolio")).toBe(false);
    expect(paths.has("/wiki/Main_Page")).toBe(false);
    expect(paths.has("/wiki?create=true")).toBe(false);
    expect(paths.has("#random-wiki")).toBe(false);
    expect(paths.has("/help")).toBe(false);
  });

  it("includes deduplicated admin console routes when canOpenAdmin is true", () => {
    const derived = commandsFromApps({
      signedIn: true,
      isAdmin: true,
      canOpenAdmin: true,
    });

    const adminPaths = derived
      .map((e) => e.path)
      .filter((p): p is string => Boolean(p?.startsWith("/admin")));
    expect(adminPaths).toContain("/admin");
    expect(adminPaths).toContain("/admin/realms");
    expect(adminPaths).toContain("/admin/storyteller");
    expect(new Set(adminPaths).size).toBe(adminPaths.length);
  });

  it("keeps every NAV_COMMAND_META key aligned with emitted APPS (+ withCountryRows) keys", () => {
    const allApps = withCountryRows(APPS, "/countries/sample");
    const validKeys = new Set<string>();
    for (const app of allApps) {
      const rootSharesSectionHref = app.sections.some(
        (s) => !s.action && !s.conditional && !s.external && s.href === app.href
      );
      if (!app.inline && !rootSharesSectionHref) {
        validKeys.add(`app:${app.id}`);
      }
      for (const section of app.sections) {
        validKeys.add(`${app.id}:${section.id}`);
      }
    }

    const orphaned = Object.keys(NAV_COMMAND_META).filter((key) => !validKeys.has(key));
    expect(orphaned).toEqual([]);
  });

  it("formats unannotated settings and admin sections with their parent app label", () => {
    const derived = commandsFromVisibleApps(APPS, { includeExtras: false });
    expect(derived.find((e) => e.path === "/settings?tab=cosmetics")?.name).toBe(
      "Settings: Cosmetics"
    );
    expect(derived.find((e) => e.path === "/admin/storyteller")?.name).toBe("Admin: Storyteller");
  });
});

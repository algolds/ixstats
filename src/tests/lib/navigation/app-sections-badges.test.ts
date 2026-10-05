import {
  getActiveSectionId,
  getAppForPath,
  getTintForPath,
  getVisibleApps,
  splitTabBarApps,
} from "~/lib/navigation/app-sections";
import { WikiLogomark } from "~/lib/navigation/icons/WikiLogomark";

const apps = getVisibleApps({
  signedIn: true,
  isAdmin: true,
  hasLabsAccess: true,
  navigationSettings: undefined,
});
const app = (id: string) => apps.find((a) => a.id === id)!;

describe("section map badges", () => {
  it("MyCountry shows the flag and Diplomacy carries the inbox count", () => {
    expect(app("mycountry").badge).toBe("mycountry-flag");
    expect(app("mycountry").sections.find((s) => s.id === "diplomacy")?.badge).toBe(
      "diplomacy-inbox"
    );
  });

  it("Vault shows the balance and a daily reward action row", () => {
    expect(app("vault").badge).toBe("vault-balance");
    const reward = app("vault").sections.find((s) => s.id === "daily-reward");
    expect(reward).toMatchObject({
      action: "daily-reward",
      badge: "daily-reward",
      label: "Daily reward",
    });
  });

  it("never marks the action row as the current section", () => {
    expect(getActiveSectionId(app("vault"), "/vault", null)).toBe("dashboard");
  });
});

describe("Home, Messages, Sports and Help in the map", () => {
  it("Home lists exactly Dashboard, Messages and a conditional What's new", () => {
    expect(app("home").sections.map((s) => s.id)).toEqual(["dashboard", "messages", "whats-new"]);
    expect(app("home").sections.find((s) => s.id === "messages")).toMatchObject({
      href: "/messages",
      badge: "messages-unread",
    });
    expect(app("home").sections.find((s) => s.id === "whats-new")).toMatchObject({
      label: "What's new",
      href: "/changelog",
      badge: "whats-new",
      conditional: true,
    });
  });

  it("owns /messages in Home, leaving ThinkPages Accounts and ThinkTanks", () => {
    expect(getAppForPath("/messages")?.id).toBe("home");
    expect(getAppForPath("/messages/abc")?.id).toBe("home");
    expect(getActiveSectionId(app("home"), "/messages/abc", null)).toBe("messages");
    expect(app("thinkpages").sections.map((s) => s.id)).toEqual(["accounts", "thinktanks"]);
    expect(app("thinkpages").match).not.toContain("/messages");
  });

  it("no longer lists Activity or Achievements, though Home still owns their routes", () => {
    const ids = app("home").sections.map((s) => s.id);
    expect(ids).not.toContain("feed");
    expect(ids).not.toContain("achievements");
    expect(getAppForPath("/feed")?.id).toBe("home");
    expect(getAppForPath("/achievements")?.id).toBe("home");
  });

  it("moves Sports under Labs as sports-tinted sections", () => {
    expect(apps.find((a) => (a.id as string) === "sports")).toBeUndefined();
    const labs = app("labs");
    for (const id of ["myleague", "myclub"]) {
      expect(labs.sections.find((s) => s.id === id)).toMatchObject({
        href: `/${id}`,
        tint: "sports",
      });
    }
    expect(getAppForPath("/myclub/2")?.id).toBe("labs");
    expect(getTintForPath(labs, getActiveSectionId(labs, "/myleague", null))).toBe("sports");
    expect(splitTabBarApps(apps).more.concat(splitTabBarApps(apps).primary)).not.toContainEqual(
      expect.objectContaining({ id: "sports" })
    );
  });

  it("gives Wiki its logomark rather than the book icon", () => {
    expect(app("wiki").icon).toBe(WikiLogomark);
  });

  it("keeps a permanent changelog row under Help", () => {
    expect(app("help").sections.find((s) => s.href === "/changelog")).toMatchObject({
      label: "What's new",
    });
  });
});

import {
  getActiveSectionId,
  getAppForPath,
  getTintForPath,
  getVisibleApps,
  splitTabBarApps,
} from "~/lib/navigation/app-sections";
import { MyCountryLogomark } from "~/lib/navigation/icons/MyCountryLogomark";
import { WikiLogomark } from "~/lib/navigation/icons/WikiLogomark";
import { RealmsLogomark } from "~/lib/navigation/icons/RealmsLogomark";
import { VaultLogomark } from "~/lib/navigation/icons/VaultLogomark";
import {
  Compass as SolidCompass,
  MultiBubble as SolidMultiBubble,
  RoundFlask as SolidRoundFlask,
} from "iconoir-react/solid";
import { Search } from "iconoir-react";

const apps = getVisibleApps({
  signedIn: true,
  isAdmin: true,
  hasLabsAccess: true,
  navigationSettings: undefined,
});
const app = (id: string) => apps.find((a) => a.id === id)!;

describe("section map badges", () => {
  it("MyCountry wears its logo, not a flag badge, and Diplomacy carries the inbox count", () => {
    expect(app("mycountry").badge).toBeUndefined();
    expect(app("mycountry").icon).toBe(MyCountryLogomark);
    expect(app("mycountry").sections.find((s) => s.id === "diplomacy")?.badge).toBe(
      "diplomacy-inbox"
    );
  });

  it("Maps wears iconoir's solid compass and Realms its hexagon mark", () => {
    expect(app("maps").icon).toBe(SolidCompass);
    expect(app("countries").icon).toBe(RealmsLogomark);
  });

  it("Vault, Forum and Labs wear solid marks like the other apps", () => {
    expect(app("vault").icon).toBe(VaultLogomark);
    expect(app("forum").icon).toBe(SolidMultiBubble);
    expect(app("labs").icon).toBe(SolidRoundFlask);
  });

  it("Realms has its own purple tint instead of the default indigo", () => {
    expect(app("countries").tint).toBe("realms");
  });

  it("Realms' Explore row uses Search, so the app's people glyph isn't repeated under it", () => {
    expect(app("countries").sections.find((s) => s.id === "explore")?.icon).toBe(Search);
  });

  it("Vault has no balance badge (the sidebar footer card shows it) but keeps the daily reward action row", () => {
    expect(app("vault").badge).toBeUndefined();
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
  it("Home lists a conditional What's new above Dashboard, Accounts, Messages, ThinkTanks and Forum", () => {
    expect(app("home").sections.map((s) => s.id)).toEqual([
      "whats-new",
      "dashboard",
      "accounts",
      "messages",
      "thinktanks",
      "forum",
    ]);
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

  it("owns /messages in Home, and ThinkPages is no longer an app", () => {
    expect(getAppForPath("/messages")?.id).toBe("home");
    expect(getAppForPath("/messages/abc")?.id).toBe("home");
    expect(getActiveSectionId(app("home"), "/messages/abc", null)).toBe("messages");
    expect(apps.find((a) => (a.id as string) === "thinkpages")).toBeUndefined();
  });

  it("no longer lists Activity or Achievements, though Home still owns their routes", () => {
    const ids = app("home").sections.map((s) => s.id);
    expect(ids).not.toContain("feed");
    expect(ids).not.toContain("achievements");
    expect(getAppForPath("/feed")?.id).toBe("home");
    expect(getAppForPath("/achievements")?.id).toBe("home");
  });

  it("moves Sports under Labs as sections in Labs' own colour", () => {
    expect(apps.find((a) => (a.id as string) === "sports")).toBeUndefined();
    const labs = app("labs");
    expect(labs.tint).toBe("labs");
    for (const id of ["myleague", "myclub"]) {
      const section = labs.sections.find((s) => s.id === id);
      expect(section).toMatchObject({ href: `/${id}` });
      expect(section).not.toHaveProperty("tint");
    }
    expect(getAppForPath("/myclub/2")?.id).toBe("labs");
    expect(getTintForPath(labs, getActiveSectionId(labs, "/myleague", null))).toBe("labs");
    expect(splitTabBarApps(apps).more.concat(splitTabBarApps(apps).primary)).not.toContainEqual(
      expect.objectContaining({ id: "sports" })
    );
  });

  it("gives Wiki its logomark rather than the book icon", () => {
    expect(app("wiki").icon).toBe(WikiLogomark);
  });

  it("resolves /changelog to Help so its permanent row highlights there", () => {
    const help = app("help");
    expect(getAppForPath("/changelog")?.id).toBe("help");
    expect(getActiveSectionId(help, "/changelog", null)).toBe("changelog");
  });

  it("keeps a permanent changelog row under Help", () => {
    expect(app("help").sections.find((s) => s.href === "/changelog")).toMatchObject({
      label: "What's new",
    });
  });
});

describe("badges recovered from the old player widget", () => {
  it("Directives carries the pending issues; the Overview has no badge (meeting actions have no UI home)", () => {
    const sections = app("mycountry").sections;
    expect(sections.find((s) => s.id === "overview")?.badge).toBeUndefined();
    expect(sections.find((s) => s.id === "executive")?.badge).toBe("issues-pending");
  });

  it("Help links the community Discord as an external section that is never current", () => {
    const help = app("help");
    const discord = help.sections.find((s) => s.id === "discord");
    expect(discord).toMatchObject({
      label: "Ixnay Discord",
      href: "https://discord.gg/mgXAEYdqkd",
      external: true,
    });
    expect(getActiveSectionId(help, "/help", null)).not.toBe("discord");
  });
});

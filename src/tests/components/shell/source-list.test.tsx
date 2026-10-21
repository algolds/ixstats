import "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { SourceList } from "~/components/shell/SourceList";
import { getVisibleApps, type NavBadges } from "~/lib/navigation/app-sections";

const apps = getVisibleApps({
  signedIn: true,
  isAdmin: true,
  hasLabsAccess: true,
  navigationSettings: undefined,
});

function setup(pathname: string, opts: { expanded?: string[]; badges?: NavBadges } = {}) {
  const onToggle = jest.fn();
  const onAction = jest.fn();
  const onNavigate = jest.fn();
  render(
    <SourceList
      pathname={pathname}
      searchParams={null}
      apps={apps}
      expanded={new Set(opts.expanded ?? [])}
      onToggle={onToggle}
      badges={opts.badges ?? {}}
      onAction={onAction}
      onNavigate={onNavigate}
    />
  );
  return {
    onToggle,
    onAction,
    onNavigate,
    nav: screen.getByRole("navigation", { name: "App navigation" }),
  };
}

describe("SourceList", () => {
  it("lists every main app and opens only the current one", () => {
    const { nav } = setup("/vault/store");
    expect(within(nav).getByRole("link", { name: "Vault" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Wiki" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Store" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(nav).queryByRole("link", { name: "Recent changes" })).toBeNull();
  });

  it("opens remembered apps and toggles others", () => {
    const { nav, onToggle } = setup("/vault", { expanded: ["wiki"] });
    expect(within(nav).getByRole("link", { name: "Recent changes" })).toBeInTheDocument();
    fireEvent.click(within(nav).getByRole("button", { name: "Expand Help" }));
    expect(onToggle).toHaveBeenCalledWith("help");
    expect(within(nav).queryByRole("button", { name: /Vault$/ })).toBeNull();
  });

  it("marks a section-less current app itself as current", () => {
    const { nav } = setup("/maps");
    expect(within(nav).getByRole("link", { name: "Maps" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("button", { name: /Maps/ })).toBeNull();
  });
  it("marks only the current app's section when section ids repeat across apps", () => {
    const vault = setup("/vault", { expanded: ["home", "countries"] });
    const current = within(vault.nav).getAllByRole("link", { current: "page" });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Wallet");
    expect(current[0]).toHaveAttribute(
      "href",
      apps.find((a) => a.id === "vault")!.sections.find((s) => s.id === "dashboard")!.href
    );
  });

  it("does not mark another expanded app's same-named section as current", () => {
    const { nav } = setup("/dashboard", { expanded: ["vault"] });
    const current = within(nav).getAllByRole("link", { current: "page" });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute("href", "/dashboard");
  });
  it("closes a hosting sheet or popover when an action row is used", () => {
    const { nav, onAction, onNavigate } = setup("/vault", {
      badges: { "daily-reward": { kind: "action", label: "4d" } },
    });
    fireEvent.click(within(nav).getByRole("button", { name: /Daily reward/ }));
    expect(onAction).toHaveBeenCalledWith("daily-reward");
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
  it("switches to area mode in admin, with the current group open", () => {
    const admin = apps.find((a) => a.id === "admin")!;
    const deep = admin.sections[admin.sections.length - 1]!;
    const { nav } = setup(deep.href);
    expect(nav).toHaveAttribute("data-mode", "area");
    expect(within(nav).getByRole("link", { name: /All apps/ })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(within(nav).getByRole("link", { name: deep.label })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(nav).queryByRole("link", { name: "Vault" })).toBeNull();
  });
  it("area mode: a group toggle calls onToggle with the app-qualified group key", () => {
    const admin = apps.find((a) => a.id === "admin")!;
    const deep = admin.sections[admin.sections.length - 1]!;
    const other = admin.sections.find((s) => s.group && s.group !== deep.group)!;
    const { nav, onToggle } = setup(deep.href);
    fireEvent.click(within(nav).getByRole("button", { name: other.group }));
    expect(onToggle).toHaveBeenCalledWith(`admin:${other.group}`);
  });
  describe("when the owning app is hidden", () => {
    const withoutHelp = getVisibleApps({
      signedIn: true,
      isAdmin: false,
      navigationSettings: { showHelpTab: false } as never,
    });
    const renderChangelog = (badges: NavBadges) =>
      render(
        <SourceList
          pathname="/changelog"
          searchParams={null}
          apps={withoutHelp}
          expanded={new Set()}
          onToggle={() => {}}
          badges={badges}
        />
      );

    it("highlights a visible row with the same href (Home's What's new)", () => {
      expect(withoutHelp.some((a) => a.id === "help")).toBe(false);
      renderChangelog({ "whats-new": { kind: "action", label: "New" } });
      const nav = screen.getByRole("navigation", { name: "App navigation" });
      expect(within(nav).getByRole("link", { current: "page" })).toHaveAttribute(
        "href",
        "/changelog"
      );
    });

    it("highlights nothing when no visible row points there", () => {
      renderChangelog({});
      const nav = screen.getByRole("navigation", { name: "App navigation" });
      expect(within(nav).queryByRole("link", { current: "page" })).toBeNull();
    });
  });
});

describe("SourceList external sections", () => {
  it("opens the Discord invite in a new tab without opener access and never marks it current", () => {
    const { nav, onNavigate } = setup("/help", { expanded: ["help"] });
    const link = within(nav).getByRole("link", { name: "Ixnay Discord" });
    expect(link).toHaveAttribute("href", "https://discord.gg/mgXAEYdqkd");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).not.toHaveAttribute("aria-current");
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalled();
  });
});

describe("SourceList ThinkTanks", () => {
  afterEach(cleanup);

  it("marks ThinkTanks current under ThinkPages on /thinktanks", () => {
    const { nav } = setup("/thinktanks");
    expect(within(nav).getByRole("link", { name: "ThinkTanks" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("does not mark ThinkTanks current on the forum home", () => {
    const { nav } = setup("/thinkpages");
    expect(within(nav).getByRole("link", { name: "ThinkTanks" })).not.toHaveAttribute(
      "aria-current"
    );
  });
});

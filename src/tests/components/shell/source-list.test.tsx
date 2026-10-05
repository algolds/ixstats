import React from "react";
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
    const { nav } = setup("/vault/marketplace");
    expect(within(nav).getByRole("link", { name: "Vault" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Wiki" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Marketplace" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(nav).queryByRole("link", { name: "Recent changes" })).toBeNull();
  });

  it("opens remembered apps and toggles others", () => {
    const { nav, onToggle } = setup("/vault", { expanded: ["wiki"] });
    expect(within(nav).getByRole("link", { name: "Recent changes" })).toBeInTheDocument();
    fireEvent.click(within(nav).getByRole("button", { name: "Expand Forum" }));
    expect(onToggle).toHaveBeenCalledWith("forum");
    expect(within(nav).queryByRole("button", { name: /Vault$/ })).toBeNull();
  });

  it("marks a section-less current app itself as current", () => {
    const { nav } = setup("/maps");
    expect(within(nav).getByRole("link", { name: "Maps" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("button", { name: /Maps/ })).toBeNull();
  });

  it("shows badges, the reward action row and collapsed dots", () => {
    const { nav, onAction } = setup("/dashboard", {
      expanded: ["vault"],
      badges: {
        "vault-balance": { kind: "value", label: "1,240 IxC" },
        "daily-reward": { kind: "action", label: "4d" },
        "diplomacy-inbox": { kind: "count", value: 3 },
      },
    });
    expect(within(nav).getByText("1,240 IxC")).toBeInTheDocument();
    fireEvent.click(within(nav).getByRole("button", { name: /Daily reward/ }));
    expect(onAction).toHaveBeenCalledWith("daily-reward");
    // MyCountry is collapsed, so its Diplomacy count shows as a dot on the app row.
    expect(
      within(within(nav).getByRole("link", { name: /MyCountry/ })).getByLabelText("Has updates")
    ).toBeInTheDocument();
  });

  it("marks only the current app's section when section ids repeat across apps", () => {
    const vault = setup("/vault", { expanded: ["home", "countries"] });
    const current = within(vault.nav).getAllByRole("link", { current: "page" });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Dashboard");
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

  it("hides the reward row when nothing is claimable", () => {
    const { nav } = setup("/vault");
    expect(within(nav).queryByRole("button", { name: /Daily reward/ })).toBeNull();
  });

  it("renders a conditional row only while its badge exists, as a normal link", () => {
    const hidden = setup("/dashboard");
    expect(within(hidden.nav).queryByRole("link", { name: /What's new/ })).toBeNull();
    cleanup();
    const { nav } = setup("/dashboard", {
      badges: { "whats-new": { kind: "action", label: "New" } },
    });
    const row = within(nav).getByRole("link", { name: /What's new/ });
    expect(row).toHaveAttribute("href", "/changelog");
    expect(row).toHaveTextContent("New");
  });

  it("shows the messages unread count on the Messages row", () => {
    const { nav } = setup("/dashboard", {
      badges: { "messages-unread": { kind: "count", value: 7 } },
    });
    expect(within(nav).getByRole("link", { name: /Messages/ })).toHaveTextContent("7");
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

  it("renders the active section's group heading as plain text, not a dead toggle", () => {
    const admin = apps.find((a) => a.id === "admin")!;
    const deep = admin.sections[admin.sections.length - 1]!;
    const { nav } = setup(deep.href);
    const group = within(nav).getByRole("group", { name: deep.group });
    expect(within(group).queryByRole("button", { name: deep.group })).toBeNull();
    expect(within(group).getByRole("heading", { name: deep.group })).toBeInTheDocument();
    // Another group is still a real toggle.
    const other = admin.sections.find((s) => s.group && s.group !== deep.group)!;
    expect(within(nav).getByRole("button", { name: other.group })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("lists one app's sections in the popover and marks the active one only inside the current app", () => {
    const vault = apps.find((a) => a.id === "vault")!;
    const renderPopover = (pathname: string) =>
      render(
        <SourceList
          variant="popover"
          app={vault}
          pathname={pathname}
          searchParams={null}
          apps={apps}
          expanded={new Set()}
          onToggle={() => {}}
          badges={{}}
        />
      );
    const other = renderPopover("/mycountry/economy");
    const otherNav = screen.getByRole("navigation", { name: "Vault" });
    expect(within(otherNav).getAllByRole("link").length).toBeGreaterThan(0);
    expect(within(otherNav).queryByRole("link", { current: "page" })).toBeNull();
    other.unmount();

    renderPopover("/vault/marketplace");
    const nav = screen.getByRole("navigation", { name: "Vault" });
    expect(nav).toHaveAttribute("data-mode", "popover");
    expect(within(nav).getByRole("link", { name: "Marketplace" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(nav).getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it("keeps a collapsed disclosure's list mounted but hidden, so aria-controls always resolves", () => {
    const admin = apps.find((a) => a.id === "admin")!;
    const deep = admin.sections[admin.sections.length - 1]!;
    const { nav } = setup(deep.href);
    const other = admin.sections.find((s) => s.group && s.group !== deep.group)!;
    const toggle = within(nav).getByRole("button", { name: other.group });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const list = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(list).not.toBeNull();
    expect(list).toHaveAttribute("hidden");
    // Hidden rows are out of the accessibility tree.
    expect(within(nav).queryByRole("link", { name: other.label })).toBeNull();
  });

  it("keeps a collapsed app's section list mounted but hidden", () => {
    const { nav } = setup("/vault");
    const expand = within(nav).getByRole("button", { name: "Expand Forum" });
    const list = document.getElementById(expand.getAttribute("aria-controls")!);
    expect(list).not.toBeNull();
    expect(list).toHaveAttribute("hidden");
  });

  it("labels a plain group by its heading rather than repeating the text in aria-label", () => {
    const admin = apps.find((a) => a.id === "admin")!;
    const deep = admin.sections[admin.sections.length - 1]!;
    const { nav } = setup(deep.href);
    const group = within(nav).getByRole("group", { name: deep.group });
    expect(group).not.toHaveAttribute("aria-label");
    const heading = within(group).getByRole("heading", { name: deep.group });
    expect(group).toHaveAttribute("aria-labelledby", heading.id);
  });

  it("area mode: a group toggle calls onToggle with the app-qualified group key", () => {
    const admin = apps.find((a) => a.id === "admin")!;
    const deep = admin.sections[admin.sections.length - 1]!;
    const other = admin.sections.find((s) => s.group && s.group !== deep.group)!;
    const { nav, onToggle } = setup(deep.href);
    fireEvent.click(within(nav).getByRole("button", { name: other.group }));
    expect(onToggle).toHaveBeenCalledWith(`admin:${other.group}`);
  });

  it("popover variant renders exactly one app's sections, with no app list", () => {
    const vault = apps.find((a) => a.id === "vault")!;
    render(
      <SourceList
        variant="popover"
        app={vault}
        pathname="/dashboard"
        searchParams={null}
        apps={apps}
        expanded={new Set()}
        onToggle={() => {}}
        badges={{}}
      />
    );
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Wiki" })).toBeNull();
    const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    for (const section of vault.sections.filter((x) => !x.action && !x.conditional)) {
      expect(hrefs).toContain(section.href);
    }
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

  it("links every section href in the map (reachability)", () => {
    for (const app of apps) {
      const pathname = app.href;
      const { unmount } = render(
        <SourceList
          pathname={pathname}
          searchParams={null}
          apps={apps}
          expanded={
            new Set(apps.flatMap((a) => [a.id, ...a.sections.map((s) => `${a.id}:${s.group}`)]))
          }
          onToggle={() => {}}
          badges={{}}
        />
      );
      const nav = screen.getByRole("navigation", { name: "App navigation" });
      const hrefs = within(nav)
        .getAllByRole("link")
        .map((l) => l.getAttribute("href"));
      for (const section of app.sections.filter((s) => !s.action && !s.conditional)) {
        expect({
          app: app.id,
          href: section.href,
          found: hrefs.includes(section.href),
        }).toMatchObject({ found: true });
      }
      unmount();
    }
  });
});

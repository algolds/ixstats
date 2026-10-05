import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  render(
    <SourceList
      pathname={pathname}
      searchParams={null}
      apps={apps}
      expanded={new Set(opts.expanded ?? [])}
      onToggle={onToggle}
      badges={opts.badges ?? {}}
      onAction={onAction}
    />
  );
  return { onToggle, onAction, nav: screen.getByRole("navigation", { name: "App navigation" }) };
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

  it("hides the reward row when nothing is claimable", () => {
    const { nav } = setup("/vault");
    expect(within(nav).queryByRole("button", { name: /Daily reward/ })).toBeNull();
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
      for (const section of app.sections.filter((s) => !s.action)) {
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

import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { describe, it, expect, jest } from "@jest/globals";
import { AppSidebar } from "~/components/shell/AppSidebar";
import { getVisibleApps } from "~/lib/navigation/app-sections";

const apps = getVisibleApps({ signedIn: true, isAdmin: false });
const mainApps = apps.filter((app) => app.placement !== "footer");

function renderSidebar(props: Partial<React.ComponentProps<typeof AppSidebar>> = {}) {
  const onCollapsedChange = jest.fn();
  const onToggle = jest.fn();
  const onAction = jest.fn();
  const utils = render(
    <AppSidebar
      pathname="/mycountry/economy"
      searchParams={null}
      apps={apps}
      collapsed={false}
      onCollapsedChange={onCollapsedChange}
      account={<button type="button">Account: diplomat</button>}
      expanded={new Set()}
      onToggle={onToggle}
      badges={{}}
      onAction={onAction}
      {...props}
    />
  );
  const rail = () => {
    const el = utils.container.querySelector<HTMLElement>('[data-slot="app-sidebar-rail"]');
    if (!el) throw new Error("rail not rendered");
    return el;
  };
  return { ...utils, onCollapsedChange, onToggle, onAction, rail };
}

describe("AppSidebar", () => {
  it("hosts the source list and tints the panel for the current app", () => {
    const { container } = renderSidebar();
    const nav = screen.getByRole("navigation", { name: "App navigation" });
    expect(nav).toHaveAttribute("data-mode", "main");
    expect(container.querySelector('[data-slot="app-sidebar"]')).toHaveAttribute(
      "data-app",
      "mycountry"
    );
    expect(within(nav).getByRole("link", { name: "Economy" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it.each(["/thinkpages", "/thinkpages/t/abc"])(
    "uses the section tint on %s (ThinkPages is its own colour under Home)",
    (pathname) => {
      const { container } = renderSidebar({ pathname });
      expect(container.querySelector('[data-slot="app-sidebar"]')).toHaveAttribute(
        "data-app",
        "thinkpages"
      );
    }
  );

  it("shows the account slot and has no app switcher", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: "Account: diplomat" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Switch app/ })).toBeNull();
  });

  it("lists Settings through the source list instead of a separate link", () => {
    renderSidebar({ pathname: "/vault" });
    const nav = screen.getByRole("navigation", { name: "App navigation" });
    expect(within(nav).getAllByRole("link", { name: "Settings" })).toHaveLength(1);
  });

  it("switches to the area list inside Settings and Admin", () => {
    renderSidebar({
      pathname: "/admin/calculations",
      apps: getVisibleApps({ signedIn: true, isAdmin: true }),
    });
    const nav = screen.getByRole("navigation", { name: "App navigation" });
    expect(nav).toHaveAttribute("data-mode", "area");
    expect(within(nav).getByRole("link", { name: "Calculations" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("toggles collapse with an accessible button", () => {
    const { onCollapsedChange, rerender } = renderSidebar();
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(onCollapsedChange).toHaveBeenCalledWith(true);

    rerender(
      <AppSidebar
        pathname="/mycountry/economy"
        searchParams={null}
        apps={apps}
        collapsed
        onCollapsedChange={onCollapsedChange}
        expanded={new Set()}
        onToggle={() => {}}
        badges={{}}
      />
    );
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  describe("icon rail", () => {
    it("has one control per main app, named by the app", () => {
      const { rail } = renderSidebar({ collapsed: true });
      for (const app of mainApps.filter((a) => !a.inline)) {
        const control = within(rail()).getByRole(app.sections.length > 0 ? "button" : "link", {
          name: app.label,
        });
        if (app.id === "mycountry") expect(control).toHaveAttribute("aria-current", "true");
      }
    });

    it("puts Home's sections on the rail as links, not a popover", () => {
      const { rail } = renderSidebar({
        collapsed: true,
        badges: { "messages-unread": { kind: "count", value: 3 } },
      });
      expect(within(rail()).queryByRole("button", { name: "Home" })).toBeNull();
      expect(within(rail()).getByRole("link", { name: "Home" })).toHaveAttribute(
        "href",
        "/dashboard"
      );
      const messages = within(rail()).getByRole("link", { name: "Messages, 3 unread" });
      expect(messages).toHaveTextContent("3");
      expect(within(rail()).getByRole("link", { name: "ThinkTanks" })).toBeInTheDocument();
      expect(within(rail()).getByRole("link", { name: "ThinkPages" })).toHaveAttribute(
        "href",
        "/thinkpages"
      );
      expect(within(rail()).queryByRole("link", { name: "What's new" })).toBeNull();
    });

    it("puts What's new above Home on the rail while the build is unseen", () => {
      const { rail } = renderSidebar({
        collapsed: true,
        badges: { "whats-new": { kind: "action", label: "New" } },
      });
      const names = within(rail())
        .getAllByRole("link")
        .map((l) => l.getAttribute("aria-label"));
      expect(names.indexOf("What's new")).toBe(names.indexOf("Home") - 1);
    });

    it("draws every app in its own colour, not only the current one", () => {
      const { rail } = renderSidebar({ collapsed: true });
      const grey = within(rail())
        .getAllByRole("link")
        .concat(within(rail()).queryAllByRole("button"))
        .filter((control) => control.querySelector("svg") && !control.matches(".text-tint"))
        .map((control) => control.getAttribute("aria-label") ?? control.textContent);
      expect(grey).toEqual([]);
    });

    it("has its own navigation landmark", () => {
      renderSidebar({ collapsed: true });
      expect(screen.getByRole("navigation", { name: "Apps" })).toBeInTheDocument();
    });

    it("keeps Settings and Admin reachable as plain links after the main apps", () => {
      const { rail } = renderSidebar({
        collapsed: true,
        pathname: "/settings",
        apps: getVisibleApps({ signedIn: true, isAdmin: true }),
      });
      const settings = within(rail()).getByRole("link", { name: "Settings" });
      expect(settings).toHaveAttribute("href", "/settings");
      expect(settings).toHaveAttribute("aria-current", "page");
      expect(within(rail()).getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
      expect(within(rail()).queryByRole("button", { name: "Settings" })).toBeNull();
    });

    it("does not mark a popover trigger as the current page", () => {
      const { rail } = renderSidebar({ collapsed: true });
      const mycountry = within(rail()).getByRole("button", { name: "MyCountry" });
      expect(mycountry).toHaveAttribute("aria-current", "true");
    });

    it("opens a popover with the app's sections", async () => {
      const { rail } = renderSidebar({ collapsed: true });
      fireEvent.click(within(rail()).getByRole("button", { name: "Vault" }));
      const nav = await screen.findByRole("navigation", { name: "Vault" });
      expect(nav).toHaveAttribute("data-mode", "popover");
      expect(within(nav).getByRole("link", { name: "Marketplace" })).toHaveAttribute(
        "href",
        "/vault/marketplace"
      );
      expect(within(nav).queryByRole("link", { current: "page" })).toBeNull();
    });

    it("links the popover header to the app itself", async () => {
      const { rail } = renderSidebar({ collapsed: true });
      fireEvent.click(within(rail()).getByRole("button", { name: "Vault" }));
      const nav = await screen.findByRole("navigation", { name: "Vault" });
      const popover = nav.closest<HTMLElement>('[data-slot="popover-content"]')!;
      expect(within(popover).getByRole("link", { name: "Vault" })).toHaveAttribute(
        "href",
        "/vault"
      );
    });

    it("opening a second rail popover closes the first", async () => {
      const { rail } = renderSidebar({ collapsed: true });
      fireEvent.click(within(rail()).getByRole("button", { name: "Vault" }));
      await screen.findByRole("navigation", { name: "Vault" });
      const wiki = within(rail()).getByRole("button", { name: "Wiki" });
      // A real click presses down outside the open popover first, which is what dismisses it.
      fireEvent.pointerDown(wiki);
      fireEvent.click(wiki);
      await screen.findByRole("navigation", { name: "Wiki" });
      await waitFor(() => expect(screen.queryByRole("navigation", { name: "Vault" })).toBeNull());
    });

    it("closes the popover when a section link inside it is followed", async () => {
      const { rail } = renderSidebar({ collapsed: true });
      fireEvent.click(within(rail()).getByRole("button", { name: "Vault" }));
      const nav = await screen.findByRole("navigation", { name: "Vault" });
      const link = within(nav).getByRole("link", { name: "Marketplace" });
      // jsdom does not navigate; the click handler is what closes the popover.
      link.addEventListener("click", (event) => event.preventDefault());
      fireEvent.click(link);
      await waitFor(() => expect(screen.queryByRole("navigation", { name: "Vault" })).toBeNull());
    });

    it("dots a rail button whose sections have something pending", () => {
      const { rail } = renderSidebar({
        collapsed: true,
        badges: { "daily-reward": { kind: "action", label: "4d" } },
      });
      const vault = within(rail()).getByRole("button", { name: "Vault" });
      expect(within(vault).getByLabelText("Has updates")).toBeInTheDocument();
      const wiki = within(rail()).getByRole("button", { name: "Wiki" });
      expect(within(wiki).queryByLabelText("Has updates")).toBeNull();
    });
  });
});

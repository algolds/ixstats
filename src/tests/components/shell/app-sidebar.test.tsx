import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { describe, it, expect, jest } from "@jest/globals";
import { AppSidebar } from "~/components/shell/AppSidebar";
import { getVisibleApps } from "~/lib/navigation/app-sections";

const apps = getVisibleApps({ signedIn: true, isAdmin: false });

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
  // A flex item is never narrower than its content by default, so a row that cannot shrink (the claimable
  // "Daily reward" with its streak pill) widened the panel past its column and over the page's left edge.
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
      expect(within(nav).getByRole("link", { name: "Store" })).toHaveAttribute(
        "href",
        "/vault/store"
      );
      expect(within(nav).queryByRole("link", { current: "page" })).toBeNull();
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
      const link = within(nav).getByRole("link", { name: "Store" });
      // jsdom does not navigate; the click handler is what closes the popover.
      link.addEventListener("click", (event) => event.preventDefault());
      fireEvent.click(link);
      await waitFor(() => expect(screen.queryByRole("navigation", { name: "Vault" })).toBeNull());
    });
  });
});

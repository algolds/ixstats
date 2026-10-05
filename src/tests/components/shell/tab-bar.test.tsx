import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, afterEach } from "@jest/globals";
import { TabBar } from "~/components/shell/TabBar";
import { SHEET_SIDE_BREAKPOINT_QUERY } from "~/components/ui/sheet";
import { getVisibleApps } from "~/lib/navigation/app-sections";

const apps = getVisibleApps({ signedIn: true, isAdmin: false });
const navProps = { expanded: new Set<string>(), onToggle: () => undefined, badges: {} };
const originalMatchMedia = window.matchMedia;

/** Below 768px the automatic sheet is a bottom sheet; the tab bar asks for one explicitly anyway. */
function mockPhoneWidth() {
  window.matchMedia = ((query: string) => ({
    matches: query !== SHEET_SIDE_BREAKPOINT_QUERY && false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("TabBar", () => {
  it("shows four primary apps plus More, with the current one marked", () => {
    render(<TabBar pathname="/mycountry/economy" searchParams={null} apps={apps} {...navProps} />);
    const nav = screen.getByRole("navigation", { name: "Tab bar" });
    const items = within(nav).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(within(nav).getByRole("link", { name: "MyCountry" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(nav).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("opens More as a bottom sheet with the app's sections and the other apps", () => {
    mockPhoneWidth();
    render(<TabBar pathname="/mycountry/economy" searchParams={null} apps={apps} {...navProps} />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));

    const sheet = screen.getByRole("dialog", { name: "More" });
    expect(sheet).toHaveAttribute("data-side", "bottom");
    expect(sheet).toHaveAttribute("data-presentation", "bottom-detent");
    expect(within(sheet).getByRole("link", { name: "Economy" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(sheet).getByRole("link", { name: "Wiki" })).toHaveAttribute("href", "/wiki");
    expect(within(sheet).getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("renders the shared source list in More, without the old Apps section header", () => {
    mockPhoneWidth();
    render(<TabBar pathname="/mycountry/economy" searchParams={null} apps={apps} {...navProps} />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const sheet = screen.getByRole("dialog", { name: "More" });
    const list = within(sheet).getByRole("navigation", { name: "App navigation" });
    expect(list).toHaveAttribute("data-mode", "main");
    expect(within(sheet).queryByText("Apps")).not.toBeInTheDocument();
  });

  it("closes the sheet when a current-app section link is followed", () => {
    mockPhoneWidth();
    render(<TabBar pathname="/mycountry/economy" searchParams={null} apps={apps} {...navProps} />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "More" })).getByRole("link", { name: "Economy" })
    );
    expect(screen.queryByRole("dialog", { name: "More" })).not.toBeInTheDocument();
  });

  it("marks More when the current app is not a primary tab", () => {
    mockPhoneWidth();
    render(<TabBar pathname="/forum/search" searchParams={null} apps={apps} {...navProps} />);
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("data-current");
    fireEvent.click(more);
    const sheet = screen.getByRole("dialog", { name: "More" });
    expect(within(sheet).getByRole("link", { name: "Search" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    // Forum's own section list is open (the current app always is), with no disclosure to
    // collapse it.
    expect(within(sheet).queryByRole("button", { name: /Forum/ })).not.toBeInTheDocument();
  });

  it("lists the account at the end of More and closes the sheet when one of its links is used", () => {
    mockPhoneWidth();
    render(
      <TabBar
        pathname="/dashboard"
        searchParams={null}
        apps={apps}
        {...navProps}
        account={<a href="/settings?tab=account#ixnayid-card">IxnayID connections</a>}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "More" })).getByRole("link", {
        name: "IxnayID connections",
      })
    );
    expect(screen.queryByRole("dialog", { name: "More" })).not.toBeInTheDocument();
  });

  it("uses at least 44px targets", () => {
    render(<TabBar pathname="/dashboard" searchParams={null} apps={apps} {...navProps} />);
    expect(screen.getByRole("link", { name: "Home" }).className).toContain("min-h-11");
    expect(screen.getByRole("button", { name: "More" }).className).toContain("min-h-11");
  });
});

import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, jest } from "@jest/globals";
import { AppSidebar } from "~/components/shell/AppSidebar";
import { getVisibleApps } from "~/lib/navigation/app-sections";

const apps = getVisibleApps({ signedIn: true, isAdmin: false });

function renderSidebar(props: Partial<React.ComponentProps<typeof AppSidebar>> = {}) {
  const onCollapsedChange = jest.fn();
  const utils = render(
    <AppSidebar
      pathname="/mycountry/economy"
      searchParams={null}
      apps={apps}
      collapsed={false}
      onCollapsedChange={onCollapsedChange}
      account={<button type="button">Account: diplomat</button>}
      {...props}
    />
  );
  return { ...utils, onCollapsedChange };
}

describe("AppSidebar", () => {
  it("is a labelled nav landmark tinted for the current app", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "App navigation" });
    expect(nav).toHaveAttribute("data-app", "mycountry");
    expect(within(nav).getByRole("heading", { name: "MyCountry" })).toBeInTheDocument();
  });

  it("marks only the current section with aria-current", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: "Economy" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Directives" })).toHaveAttribute(
      "href",
      "/mycountry/executive"
    );
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("uses the section tint (Intelligence is crimson)", () => {
    renderSidebar({ pathname: "/mycountry/intelligence" });
    expect(screen.getByRole("navigation", { name: "App navigation" })).toHaveAttribute(
      "data-app",
      "intel"
    );
  });

  it("highlights query sections from the search params", () => {
    renderSidebar({ pathname: "/settings", searchParams: new URLSearchParams("tab=appearance") });
    expect(screen.getByRole("link", { name: "Appearance & accessibility" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    // Settings is pinned to the bottom and current too.
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  });

  it("lists grouped sections under labelled sub-headings", () => {
    renderSidebar({
      pathname: "/admin/calculations",
      apps: getVisibleApps({ signedIn: true, isAdmin: true }),
    });
    const simulation = screen.getByRole("group", { name: "Simulation" });
    expect(within(simulation).getByRole("link", { name: "Calculations" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("heading", { name: "Users & security" })).toBeInTheDocument();
    // The ungrouped overview leads without a heading of its own.
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/admin");
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("highlights the settings tab of the current URL within its group", () => {
    renderSidebar({ pathname: "/settings", searchParams: new URLSearchParams("tab=cosmetics") });
    const vault = screen.getByRole("group", { name: "Vault" });
    expect(within(vault).getByRole("link", { name: "Cosmetics" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "IxnayID & Passport" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("shows the account slot and the app switcher", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: "Account: diplomat" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Switch app, current app MyCountry" })
    ).toHaveAttribute("aria-haspopup", "menu");
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
      />
    );
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    // Labels stay in the accessibility tree when collapsed to icons.
    expect(screen.getByRole("link", { name: "Economy" })).toBeInTheDocument();
  });

  it("shows no sections outside the map", () => {
    renderSidebar({ pathname: "/setup" });
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch app, current app IxStats" })).toBeVisible();
  });
});

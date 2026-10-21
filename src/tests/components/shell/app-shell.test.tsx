import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "@jest/globals";

let mockPathname = "/dashboard";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));
jest.mock("~/components/shell/FacetShell", () => ({
  FacetShell: () => <div data-testid="facet-shell" />,
}));

// The provider's own behaviour is covered in the vault tests; here it only wraps the page.
const dailyRewardProps: Array<{ autoOpen?: boolean }> = [];
jest.mock("~/components/vault/DailyRewardProvider", () => ({
  DailyRewardProvider: ({
    children,
    autoOpen,
  }: {
    children: React.ReactNode;
    autoOpen?: boolean;
  }) => {
    dailyRewardProps.push({ autoOpen });
    return <>{children}</>;
  },
}));

// eslint-disable-next-line import/first
import { AppShell } from "~/components/shell/AppShell";

function Shell() {
  return (
    <AppShell beforeMain={<div data-testid="before-main" />}>
      <p>Page</p>
    </AppShell>
  );
}

beforeEach(() => {
  mockPathname = "/dashboard";
  dailyRewardProps.length = 0;
});

describe("AppShell", () => {
  it("puts a skip link first, targeting the main landmark", () => {
    const { container } = render(<Shell />);
    const skip = screen.getByRole("link", { name: "Skip to content" });
    const main = screen.getByRole("main");
    expect(skip).toHaveAttribute("href", `#${main.id}`);
    expect(main.id).not.toBe("");
    expect(main).toHaveAttribute("tabindex", "-1");
    const firstFocusable = container.querySelector("a[href], button, [tabindex='0']");
    expect(firstFocusable).toBe(skip);
  });
  it("auto-opens the daily reward on routes with chrome, not on chromeless ones", () => {
    render(<Shell />);
    expect(dailyRewardProps.at(-1)?.autoOpen).toBe(true);
    dailyRewardProps.length = 0;
    mockPathname = "/maps";
    render(<Shell />);
    expect(dailyRewardProps.at(-1)?.autoOpen).toBe(false);
  });
});

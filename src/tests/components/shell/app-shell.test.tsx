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
});

describe("AppShell", () => {
  it("renders the navigation shell, the before-main slot and main", () => {
    render(<Shell />);
    expect(screen.getByTestId("facet-shell")).toBeInTheDocument();
    expect(screen.getByTestId("before-main")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-shell-main");
    expect(screen.getByText("Page")).toBeInTheDocument();
  });

  it("marks chromeless routes (Maps)", () => {
    mockPathname = "/maps";
    const { container } = render(<Shell />);
    expect(container.querySelector("[data-app-shell]")).toHaveAttribute("data-chromeless");
  });

  it("leaves other routes with chrome", () => {
    const { container } = render(<Shell />);
    expect(container.querySelector("[data-app-shell]")).not.toHaveAttribute("data-chromeless");
  });

  it("paints the tinted canvas and scopes the current app's tint on the shell root", () => {
    mockPathname = "/vault";
    const { container } = render(<Shell />);
    const shell = container.querySelector("[data-app-shell]")!;
    expect(shell.getAttribute("class")).toMatch(/\bfacet-canvas\b/);
    expect(shell).toHaveAttribute("data-app", "vault");
  });

  it("gives chromeless routes no canvas wash", () => {
    mockPathname = "/maps";
    const { container } = render(<Shell />);
    const shell = container.querySelector("[data-app-shell]")!;
    expect(shell).toHaveAttribute("data-chromeless");
    expect(shell.getAttribute("class") ?? "").not.toMatch(/\bfacet-canvas\b/);
  });
});

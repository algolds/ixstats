import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
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
// eslint-disable-next-line import/first
import { useFacetNav } from "~/lib/navigation/use-facet-nav";
// eslint-disable-next-line import/first
import { NAV_STORAGE_KEYS } from "~/lib/design/appearance";

const legacyNav = <nav aria-label="Legacy navigation" data-testid="legacy-nav" />;

function Shell() {
  return (
    <AppShell legacyNav={legacyNav}>
      <p>Page</p>
    </AppShell>
  );
}

beforeEach(() => {
  mockPathname = "/dashboard";
  localStorage.clear();
  document.documentElement.removeAttribute("data-nav");
  document.documentElement.removeAttribute("data-sidebar");
});

describe("AppShell (facet-nav flag)", () => {
  it("renders the legacy navigation when the flag is off", () => {
    render(<Shell />);
    expect(screen.getByTestId("legacy-nav")).toBeInTheDocument();
    expect(screen.queryByTestId("facet-shell")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-shell-main");
    expect(screen.getByText("Page")).toBeInTheDocument();
  });

  it("renders the Facet shell instead when html[data-nav=facet]", () => {
    document.documentElement.setAttribute("data-nav", "facet");
    render(<Shell />);
    expect(screen.getByTestId("facet-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("legacy-nav")).not.toBeInTheDocument();
  });

  it("server-renders both shells behind CSS gates so the first paint matches the pre-paint flag", () => {
    const html = renderToString(<Shell />);
    expect(html).toContain('data-shell-variant="legacy"');
    expect(html).toContain('data-shell-variant="facet"');
    expect(html).toContain('data-testid="legacy-nav"');
    expect(html).toContain('data-testid="facet-shell"');
  });

  it("marks chromeless routes (Maps)", () => {
    mockPathname = "/maps";
    const { container } = render(<Shell />);
    expect(container.querySelector("[data-app-shell]")).toHaveAttribute("data-chromeless");
  });

  it("switches shells live when the preview toggle changes", async () => {
    let toggle: ((on: boolean) => void) | undefined;
    function Toggle() {
      toggle = useFacetNav().setEnabled;
      return null;
    }
    render(
      <>
        <Shell />
        <Toggle />
      </>
    );
    expect(screen.getByTestId("legacy-nav")).toBeInTheDocument();
    act(() => toggle?.(true));
    await waitFor(() => expect(screen.getByTestId("facet-shell")).toBeInTheDocument());
    expect(screen.queryByTestId("legacy-nav")).not.toBeInTheDocument();
    expect(localStorage.getItem(NAV_STORAGE_KEYS.facetNav)).toBe("true");
    expect(document.documentElement.getAttribute("data-nav")).toBe("facet");
  });
});

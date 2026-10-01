import React from "react";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, it, expect, beforeEach } from "@jest/globals";
import { ShellPageHeader } from "~/components/shell/ShellPageHeader";

beforeEach(() => {
  document.documentElement.removeAttribute("data-nav");
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});

describe("ShellPageHeader", () => {
  it("renders nothing with the flag off", () => {
    const { container } = render(<ShellPageHeader title="Vault" />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("heading", { name: "Vault" })).not.toBeInTheDocument();
  });

  it("renders the page's large title under the new shell, phone-only by default", () => {
    document.documentElement.setAttribute("data-nav", "facet");
    const { container } = render(<ShellPageHeader title="Vault" subtitle="Cards and credits" />);
    expect(screen.getByRole("heading", { level: 1, name: "Vault" })).toBeInTheDocument();
    expect(screen.getByText("Cards and credits")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="shell-page-header"]')).toHaveClass("lg:hidden");
  });

  it("can show at every width", () => {
    document.documentElement.setAttribute("data-nav", "facet");
    const { container } = render(<ShellPageHeader title="Settings" phoneOnly={false} />);
    expect(container.querySelector('[data-slot="shell-page-header"]')).not.toHaveClass("lg:hidden");
  });

  it("is CSS-gated in the server HTML so the first paint matches the flag", () => {
    const html = renderToString(<ShellPageHeader title="Forum" />);
    expect(html).toContain('data-shell-variant="facet"');
    expect(html).toContain("Forum");
  });
});

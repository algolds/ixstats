import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "@jest/globals";
import { ShellPageHeader } from "~/components/shell/ShellPageHeader";

beforeEach(() => {
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
  it("renders the page's large title, phone-only by default", () => {
    const { container } = render(<ShellPageHeader title="Vault" subtitle="Cards and credits" />);
    expect(screen.getByRole("heading", { level: 1, name: "Vault" })).toBeInTheDocument();
    expect(screen.getByText("Cards and credits")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="shell-page-header"]')).toHaveClass("lg:hidden");
  });

  it("can show at every width", () => {
    const { container } = render(<ShellPageHeader title="Settings" phoneOnly={false} />);
    expect(container.querySelector('[data-slot="shell-page-header"]')).not.toHaveClass("lg:hidden");
  });
});

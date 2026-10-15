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

  it("passes a leading mark through, beside the title and outside the heading", () => {
    render(
      <ShellPageHeader title="Vault" leading={<span data-testid="mark" aria-hidden="true" />} />
    );
    const mark = screen.getByTestId("mark");
    const heading = screen.getByRole("heading", { level: 1, name: "Vault" });
    expect(heading.contains(mark)).toBe(false);
    expect(mark.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

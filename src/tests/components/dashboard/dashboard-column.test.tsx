import React from "react";
import { render, screen } from "@testing-library/react";
import { DashboardColumn } from "~/components/dashboard/DashboardColumn";

describe("DashboardColumn", () => {
  it("renders the hero above the content, with the content directly in the column", () => {
    render(
      <DashboardColumn heroSection={<div data-testid="hero" />}>
        <p data-testid="content">Content</p>
      </DashboardColumn>
    );
    const hero = screen.getByTestId("hero");
    const content = screen.getByTestId("content");
    expect(hero.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The content sits directly in the padded container, not in a single-child flex row.
    expect(content.parentElement?.className).toContain("container");
    expect(content.parentElement?.className).not.toMatch(/\bflex\b/);
  });

  it("renders without a hero", () => {
    render(
      <DashboardColumn>
        <p>Only content</p>
      </DashboardColumn>
    );
    expect(screen.getByText("Only content")).toBeInTheDocument();
  });
});

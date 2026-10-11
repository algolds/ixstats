/** The country editor's compact toolbar: section tabs with change and issue counts, and the save status. */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorHeader } from "~/app/builder/components/editor/EditorHeader";

jest.mock("~/lib/sound/cuelume", () => ({ soundEffects: { press: jest.fn() } }));
jest.mock("~/app/builder/components/builder-guide-context", () => ({
  useBuilderGuide: () => ({ openGuide: jest.fn() }),
}));
jest.mock("~/app/builder/components/BuilderModeToggle", () => ({
  BuilderModeToggle: () => <div data-testid="mode-toggle" />,
}));

const alertResult = {
  sectionCounts: { government: { error: 2, warning: 0 } },
} as never;

function renderHeader(onNavigate = jest.fn()) {
  render(
    <EditorHeader
      countryName="Caphiria"
      activeSection="identity"
      onNavigate={onNavigate}
      changeCounts={{ identity: 3, government: 0, economics: 0 }}
      alertResult={alertResult}
      saveStatus="saved"
      lastSyncedAt={null}
    />
  );
  return onNavigate;
}

describe("EditorHeader", () => {
  it("shows the country as the page's one heading, with its save status", () => {
    renderHeader();
    expect(screen.getByRole("heading", { level: 1, name: "Caphiria" })).toBeInTheDocument();
  });

  it("lists the four sections as compact tabs, the current one marked", () => {
    renderHeader();
    const nav = screen.getByRole("navigation", { name: "Editor sections" });
    const tabs = Array.from(nav.querySelectorAll("button"));
    expect(tabs.map((t) => t.textContent?.replace(/\(.*\)|\d/g, "").trim())).toEqual([
      "Identity",
      "Government",
      "Economy",
      "Review",
    ]);
    expect(screen.getByRole("button", { name: /Identity/ })).toHaveAttribute("aria-current", "page");
  });

  it("announces each section's changes and issues", () => {
    renderHeader();
    expect(screen.getByRole("button", { name: /Identity \(3 changes\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Government \(2 issues to fix\)/ })).toBeInTheDocument();
  });

  it("jumps to a section", () => {
    const onNavigate = renderHeader();
    fireEvent.click(screen.getByRole("button", { name: /Economy/ }));
    expect(onNavigate).toHaveBeenCalledWith("economics");
  });
});

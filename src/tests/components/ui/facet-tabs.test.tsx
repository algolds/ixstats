import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeAll } from "@jest/globals";
import { FacetTabs } from "~/components/ui/facet";

const TABS = [
  { id: "one", label: "One" },
  { id: "two", label: "Two" },
  { id: "three", label: "Three" },
];

beforeAll(() => {
  // jsdom has no ResizeObserver; FacetTabs uses it to measure tab bounds.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function Harness() {
  const [active, setActive] = useState("one");
  return <FacetTabs tabs={TABS} activeTab={active} onChange={setActive} aria-label="Sections" />;
}

describe("FacetTabs accessibility", () => {
  it("exposes a named tablist whose selected tab is the only tab stop", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Sections" })).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    expect(tabs.every((t) => t.getAttribute("type") === "button")).toBe(true);
  });

  it("moves selection and focus with the arrow, Home and End keys", () => {
    render(<Harness />);
    const tab = (name: string) => screen.getByRole("tab", { name });

    fireEvent.keyDown(tab("One"), { key: "ArrowRight" });
    expect(tab("Two")).toHaveAttribute("aria-selected", "true");
    expect(tab("Two")).toHaveFocus();

    fireEvent.keyDown(tab("Two"), { key: "End" });
    expect(tab("Three")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("Three"), { key: "ArrowRight" });
    expect(tab("One")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("One"), { key: "ArrowLeft" });
    expect(tab("Three")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("Three"), { key: "Home" });
    expect(tab("One")).toHaveAttribute("aria-selected", "true");
    expect(tab("One")).toHaveFocus();
  });
});

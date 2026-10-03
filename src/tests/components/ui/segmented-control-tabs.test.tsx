import React, { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "@jest/globals";
import { SegmentedControl } from "~/components/ui/segmented-control";

const TABS = [
  { value: "one", label: "One" },
  { value: "two", label: "Two" },
  { value: "three", label: "Three" },
];

function Harness() {
  const [active, setActive] = useState("one");
  return (
    <SegmentedControl
      asTabs
      options={TABS}
      value={active}
      onValueChange={setActive}
      aria-label="Sections"
    />
  );
}

describe("SegmentedControl asTabs accessibility", () => {
  it("exposes a named tablist; focusing it lands on the selected tab", () => {
    render(<Harness />);
    const list = screen.getByRole("tablist", { name: "Sections" });
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(tabs.every((t) => t.getAttribute("type") === "button")).toBe(true);
    fireEvent.focus(list);
    expect(tabs[0]).toHaveFocus();
  });

  it("moves selection and focus with the arrow, Home and End keys", async () => {
    render(<Harness />);
    const tab = (name: string) => screen.getByRole("tab", { name });

    tab("One").focus();
    fireEvent.keyDown(tab("One"), { key: "ArrowRight" });
    await waitFor(() => expect(tab("Two")).toHaveAttribute("aria-selected", "true"));
    expect(tab("Two")).toHaveFocus();

    fireEvent.keyDown(tab("Two"), { key: "End" });
    await waitFor(() => expect(tab("Three")).toHaveAttribute("aria-selected", "true"));

    fireEvent.keyDown(tab("Three"), { key: "ArrowRight" });
    await waitFor(() => expect(tab("One")).toHaveAttribute("aria-selected", "true"));

    fireEvent.keyDown(tab("One"), { key: "ArrowLeft" });
    await waitFor(() => expect(tab("Three")).toHaveAttribute("aria-selected", "true"));

    fireEvent.keyDown(tab("Three"), { key: "Home" });
    await waitFor(() => expect(tab("One")).toHaveAttribute("aria-selected", "true"));
    expect(tab("One")).toHaveFocus();
  });
});

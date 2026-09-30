/**
 * Tests for the builder "Show advanced options" disclosure (Plan 003 Step 3B)
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdvancedFieldsDisclosure } from "~/app/builder/primitives/AdvancedFieldsDisclosure";

const STORAGE_KEY = "builder-advanced:government:branches";

function Branches({
  legislatureName = "",
  errorFields,
  defaultOpen,
}: {
  legislatureName?: string;
  errorFields?: readonly string[];
  defaultOpen?: boolean;
}) {
  return (
    <AdvancedFieldsDisclosure
      section="government"
      id="branches"
      values={{ legislatureName }}
      errorFields={errorFields}
      defaultOpen={defaultOpen}
    >
      <label htmlFor="legislatureName">Legislature</label>
      <input id="legislatureName" defaultValue={legislatureName} />
    </AdvancedFieldsDisclosure>
  );
}

const trigger = () => screen.getByRole("button", { name: /advanced options/i });

describe("AdvancedFieldsDisclosure", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is a collapsed, keyboard-operable button by default", () => {
    render(<Branches />);

    expect(trigger().tagName).toBe("BUTTON");
    expect(trigger()).toHaveAttribute("type", "button");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).toHaveTextContent("Show advanced options");
    expect(screen.queryByLabelText("Legislature")).not.toBeInTheDocument();
  });

  it("toggles open and remembers the choice for the section", () => {
    const { unmount } = render(<Branches />);

    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(trigger()).toHaveTextContent("Hide advanced options");
    expect(screen.getByLabelText("Legislature")).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("open");

    unmount();
    render(<Branches />);
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("uses defaultOpen only when nothing is remembered", () => {
    const { unmount } = render(<Branches defaultOpen />);
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger());
    unmount();
    render(<Branches defaultOpen />);
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens by itself when an advanced field is already filled, even if remembered closed", () => {
    window.localStorage.setItem(STORAGE_KEY, "closed");
    render(<Branches legislatureName="Imperial Senate" />);

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Legislature")).toHaveValue("Imperial Senate");
  });

  it("opens when an advanced field gains a validation error after mount", () => {
    const { rerender } = render(<Branches />);
    expect(trigger()).toHaveAttribute("aria-expanded", "false");

    rerender(<Branches errorFields={["legislatureName"]} />);
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("does not collapse while the user clears the last filled field", () => {
    const { rerender } = render(<Branches legislatureName="Senate" />);
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    rerender(<Branches legislatureName="" />);
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("still lets the user collapse an auto-opened disclosure", () => {
    render(<Branches legislatureName="Senate" />);

    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("closed");
  });

  it("works when localStorage throws", () => {
    const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    render(<Branches />);
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

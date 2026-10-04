import React from "react";
import { render, screen } from "@testing-library/react";
import { Stat } from "~/components/ui/stat";

describe("Stat", () => {
  it("puts a large tinted tabular figure above a regular-case label", () => {
    render(<Stat label="GDP" value="$1.2T" />);
    const value = screen.getByText("$1.2T");
    const label = screen.getByText("GDP");
    expect(value).toHaveClass("text-title-1", "text-tint", "tabular-nums");
    expect(label).toHaveClass("text-footnote", "text-label-secondary");
    expect(label.className).not.toMatch(/stat-label|uppercase/);
    expect(value.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("uses text-title-3 for the small size", () => {
    render(<Stat label="GDP" value="$1.2T" size="sm" />);
    expect(screen.getByText("$1.2T")).toHaveClass("text-title-3");
  });

  it.each([
    ["up", "Up", "text-success"],
    ["down", "Down", "text-destructive"],
    ["neutral", "No change", "text-label-secondary"],
  ] as const)(
    "pairs a %s delta with an icon, text and colour (never colour alone)",
    (direction, srText, colour) => {
      const { container } = render(
        <Stat label="Growth" value="3%" delta={{ value: "0.4 pts", direction }} />
      );
      const delta = container.querySelector('[data-slot="stat-delta"]')!;
      expect(delta.className).toContain(colour);
      expect(delta.querySelector("svg")).not.toBeNull();
      expect(delta.querySelector("svg")).toHaveAttribute("aria-hidden");
      expect(delta.textContent).toContain(srText);
      expect(delta.textContent).toContain("0.4 pts");
    }
  );

  it("lets sentiment override the colour when up is bad", () => {
    const { container } = render(
      <Stat
        label="Debt"
        value="80%"
        delta={{ value: "+5%", direction: "up", sentiment: "negative", label: "Rose" }}
      />
    );
    const delta = container.querySelector('[data-slot="stat-delta"]')!;
    expect(delta.className).toContain("text-destructive");
    expect(delta.textContent).toContain("Rose");
  });
});

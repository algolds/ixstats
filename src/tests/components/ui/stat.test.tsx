import React from "react";
import { render, screen } from "@testing-library/react";
import { Stat } from "~/components/ui/stat";

describe("Stat", () => {
  it("renders a stat label and a tabular title-3 value", () => {
    render(<Stat label="GDP" value="$1.2T" hint="vs. last year" />);
    const label = screen.getByText("GDP");
    expect(label.className).toContain("text-stat-label");
    const value = screen.getByText("$1.2T");
    expect(value.className).toContain("text-title-3");
    expect(value.className).toContain("tabular-nums");
    expect(screen.getByText("vs. last year").className).toContain("text-footnote");
  });

  it("uses text-headline for the small size", () => {
    render(<Stat size="sm" label="Pop." value="12M" />);
    expect(screen.getByText("12M").className).toContain("text-headline");
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

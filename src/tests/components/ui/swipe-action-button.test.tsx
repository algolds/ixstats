import React from "react";
import { render, screen } from "@testing-library/react";
import { SwipeActionButton } from "~/components/ui/facet/swipeable/SwipeableRow";

function Icon({ className }: { className?: string }) {
  return <svg className={className} />;
}

function renderButton(color: string) {
  render(<SwipeActionButton id="x" icon={Icon} label="Delete" onClick={() => {}} color={color} />);
  return screen.getByRole("button", { name: "Delete" });
}

describe("SwipeActionButton colour handling", () => {
  it.each(["var(--color-error)", "#ef4444", "rgb(239, 68, 68)"])(
    "treats %s as a CSS colour and exposes it as --btn-color",
    (color) => {
      const button = renderButton(color);
      expect(button.style.getPropertyValue("--btn-color")).toBe(color);
      expect(button.className).toContain("var(--btn-color)");
    }
  );

  it("treats a bare name as a Tailwind colour", () => {
    const button = renderButton("red");
    expect(button.style.getPropertyValue("--btn-color")).toBe("");
    expect(button.className).not.toContain("var(--btn-color)");
  });
});

import "react";
import { render } from "@testing-library/react";
import { Stat } from "~/components/ui/stat";

describe("Stat", () => {
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
});

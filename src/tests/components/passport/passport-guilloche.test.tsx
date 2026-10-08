/** The guilloché background is deterministic hairline rosettes, reusable by the OG image. */
import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react";
import { PassportGuilloche } from "~/components/passport/document/PassportGuilloche";
import { guillochePaths } from "~/lib/passport/guilloche";

describe("guillochePaths", () => {
  it("is deterministic", () => {
    expect(guillochePaths(1200, 630)).toEqual(guillochePaths(1200, 630));
  });

  it("draws several closed curves with finite coordinates", () => {
    const paths = guillochePaths(1200, 630);
    expect(paths.length).toBeGreaterThanOrEqual(3);
    for (const d of paths) {
      expect(d).toMatch(/^M[\d.-]+ [\d.-]+/);
      expect(d.endsWith("Z")).toBe(true);
      expect(d).not.toMatch(/NaN|Infinity/);
    }
  });

  it("scales with the canvas", () => {
    expect(guillochePaths(600, 315)).not.toEqual(guillochePaths(1200, 630));
  });
});

describe("PassportGuilloche", () => {
  it("renders decorative hairlines in the current colour", () => {
    const { container } = render(<PassportGuilloche />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("fill", "none");
    expect(container.querySelectorAll("path").length).toBe(guillochePaths(1200, 630).length);
  });
});

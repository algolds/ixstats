/**
 * Vexel's charge library shows each charge's own drawing, not a placeholder icon, and names imported charges
 * plainly rather than by their database id.
 */
import { render } from "@testing-library/react";
import { ChargeGlyph } from "~/components/maps/vexel/ChargeGlyph";
import { chargeName } from "~/components/maps/vexel/builtin-charges";
import { CHARGE_PATHS } from "~/lib/heraldry/charge-paths";

describe("ChargeGlyph", () => {
  it("draws a built-in charge from the renderer's own path", () => {
    const { container } = render(<ChargeGlyph chargeId="lion" />);
    expect(container.querySelector("path")).toHaveAttribute("d", CHARGE_PATHS.lion);
  });

  it("draws an imported charge from its stored SVG", () => {
    const svg = '<svg width="40" height="40"><circle cx="20" cy="20" r="10"/></svg>';
    const { container } = render(<ChargeGlyph chargeId="abc-123" svgData={svg} />);
    expect(container.querySelector("circle")).not.toBeNull();
    expect(container.querySelector("svg")).toHaveAttribute("width", "100%");
  });
});

describe("chargeName", () => {
  it("names built-in charges and labels imported ones", () => {
    expect(chargeName("eagle")).toBe("Eagle displayed");
    expect(chargeName("9f1c-uuid")).toBe("Imported charge");
  });
});

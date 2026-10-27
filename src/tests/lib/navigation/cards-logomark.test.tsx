import { render } from "@testing-library/react";
import { CardsLogomark } from "~/lib/navigation/icons/CardsLogomark";

const marks = (d: string | null | undefined) => (d ?? "").split("M").length - 1;

describe("CardsLogomark", () => {
  it("cuts five lattice marks out of the small stamp, and no seal", () => {
    const { container } = render(<CardsLogomark />);
    expect(container.querySelectorAll("ellipse")).toHaveLength(0);
    expect(marks(container.querySelector("mask path")?.getAttribute("d"))).toBe(5);
    expect(container.querySelector("clipPath")).toBeNull();
  });

  it("engraves the seal and opens its window onto the lattice in the centre colour", () => {
    const { container } = render(<CardsLogomark detailed />);
    expect(container.querySelectorAll("ellipse")).toHaveLength(18);
    const window = container.querySelector("path[clip-path]");
    expect(window?.getAttribute("class")).toContain("--cards-centre");
    expect(marks(window?.getAttribute("d"))).toBeGreaterThan(20);
  });

  it("gives each instance its own mask", () => {
    const { container } = render(
      <>
        <CardsLogomark />
        <CardsLogomark />
      </>
    );
    const ids = [...container.querySelectorAll("mask")].map((mask) => mask.id);
    expect(new Set(ids).size).toBe(2);
  });
});

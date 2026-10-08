import { render } from "@testing-library/react";
import { RealmsLogomark } from "~/lib/navigation/icons/RealmsLogomark";

describe("RealmsLogomark (navigation icon)", () => {
  it("is a solid hexagon with the community figures cut out of it, in the row's tint", () => {
    const { container } = render(<RealmsLogomark className="size-5" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toContain("size-5");

    const hexagon = container.querySelector("path[mask]");
    const maskId = container.querySelector("mask")?.getAttribute("id");
    expect(hexagon?.getAttribute("fill")).toBe("currentColor");
    expect(hexagon?.getAttribute("mask")).toBe(`url(#${maskId})`);
    // The figures are drawn in black inside the mask: cut out, not painted on
    expect(container.querySelector("mask svg")?.getAttribute("color")).toBe("black");
  });

  it("gives every instance its own mask id, so two marks on a page never share one", () => {
    const { container } = render(
      <>
        <RealmsLogomark />
        <RealmsLogomark />
      </>
    );
    const ids = Array.from(container.querySelectorAll("mask")).map((m) => m.getAttribute("id"));
    expect(new Set(ids).size).toBe(2);
  });

  it("is decorative by default, like the other navigation icons", () => {
    const svg = render(<RealmsLogomark />).container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});

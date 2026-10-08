import { render } from "@testing-library/react";
import { BNB_GLYPH, VaultLogomark } from "~/lib/navigation/icons/VaultLogomark";

describe("VaultLogomark (navigation icon)", () => {
  it("is a solid card with the ccy-icons BNB glyph cut out of it, in the row's tint", () => {
    const { container } = render(<VaultLogomark className="size-5" />);
    expect(container.querySelector("svg")!.getAttribute("class")).toContain("size-5");

    const card = container.querySelector("path[mask]");
    const maskId = container.querySelector("mask")?.getAttribute("id");
    expect(card?.getAttribute("fill")).toBe("currentColor");
    expect(card?.getAttribute("mask")).toBe(`url(#${maskId})`);
    // The glyph is drawn in black inside the mask: cut out, not painted on
    const glyph = container.querySelector("mask svg path");
    expect(glyph?.getAttribute("d")).toBe(BNB_GLYPH.path);
    expect(glyph?.getAttribute("fill")).toBe("black");
  });

  it("gives every instance its own mask id, so two marks on a page never share one", () => {
    const { container } = render(
      <>
        <VaultLogomark />
        <VaultLogomark />
      </>
    );
    const ids = Array.from(container.querySelectorAll("mask")).map((m) => m.getAttribute("id"));
    expect(new Set(ids).size).toBe(2);
  });

  it("is decorative by default, like the other navigation icons", () => {
    const svg = render(<VaultLogomark />).container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});

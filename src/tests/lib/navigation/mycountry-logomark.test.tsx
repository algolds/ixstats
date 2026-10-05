import { render } from "@testing-library/react";
import { MyCountryLogomark } from "~/lib/navigation/icons/MyCountryLogomark";

describe("MyCountryLogomark (navigation icon)", () => {
  it("draws an SVG that takes its size and colour from the container", () => {
    const { container } = render(<MyCountryLogomark className="size-5" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("class")).toContain("size-5");
    expect(container.innerHTML).toContain("currentColor");
  });

  it("is decorative by default, like the other navigation icons", () => {
    const svg = render(<MyCountryLogomark />).container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
    expect(svg).not.toHaveAttribute("aria-label");
  });
});

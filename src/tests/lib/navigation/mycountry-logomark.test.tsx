import { render } from "@testing-library/react";
import { MyCountryLogomark } from "~/lib/navigation/icons/MyCountryLogomark";

describe("MyCountryLogomark (navigation icon)", () => {
  it("is an SVG sized by its container, like the other navigation icons", () => {
    const svg = render(<MyCountryLogomark className="size-5" />).container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("class")).toContain("size-5");
  });

  it("draws the MyCountry crown badge alone: a gold disc with the crown, no globe behind it", () => {
    const { container } = render(<MyCountryLogomark />);
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(1);
    expect(container.querySelectorAll("path")).toHaveLength(1);
    // Its own colours, not the row's tint
    expect(container.innerHTML).not.toContain("currentColor");
  });

  it("paints with literal colours, so it shows without the app's Tailwind CSS (previews, exports)", () => {
    const { container } = render(<MyCountryLogomark />);
    expect(container.querySelector("circle")).toHaveAttribute("fill", "#ffb900");
    expect(container.querySelector("circle")).toHaveAttribute("stroke", "#ffd230");
    expect(container.querySelector("path")).toHaveAttribute("stroke", "#7b3306");
    expect(container.querySelector("[class*='amber']")).toBeNull();
  });

  it("is decorative by default, like the other navigation icons", () => {
    const svg = render(<MyCountryLogomark />).container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
    expect(svg).not.toHaveAttribute("aria-label");
  });
});

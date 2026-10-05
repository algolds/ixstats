import { render, screen } from "@testing-library/react";

import {
  MyCountryLogo,
  MyCountryLogomark,
} from "~/components/mycountry/shared/primitives/mycountry-logo";
import { MyCountryLogomark as NavMyCountryLogomark } from "~/lib/navigation/icons/MyCountryLogomark";

describe("MyCountryLogo", () => {
  it.each(["full", "text-only"] as const)(
    "keeps its DOM (and hover animation state) across re-renders: %s",
    (variant) => {
      const { rerender } = render(<MyCountryLogo variant={variant} />);
      const before = screen.getByText("MyCountry");
      rerender(<MyCountryLogo variant={variant} className="other" />);
      expect(screen.getByText("MyCountry")).toBe(before);
    }
  );
});

describe("MyCountryLogomark", () => {
  it("is the navigation map's icon: one SVG source, re-exported by the component", () => {
    expect(MyCountryLogomark).toBe(NavMyCountryLogomark);
  });

  it("draws an SVG that takes its size and colour from the container", () => {
    const { container } = render(<NavMyCountryLogomark className="size-5" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("class")).toContain("size-5");
    expect(container.innerHTML).toContain("currentColor");
  });
});

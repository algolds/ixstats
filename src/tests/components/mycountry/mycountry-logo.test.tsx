import { render, screen } from "@testing-library/react";

import { MyCountryLogo } from "~/components/mycountry/shared/primitives/mycountry-logo";

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

import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/context/DevCountryViewContext", () => ({
  useDevCountryView: () => ({
    canUseDevView: true,
    isViewingOtherCountry: true,
    viewCountryName: "Caphiria",
    viewCountryId: "c1",
    clearViewCountry: jest.fn(),
  }),
}));

type Banner = typeof import("~/components/dev/ViewingAsBanner").ViewingAsBanner;
let ViewingAsBanner: Banner;

beforeAll(async () => {
  // The banner decides at module load whether it exists, so import it as in development.
  const env = process.env as Record<string, string | undefined>;
  const original = env.NODE_ENV;
  env.NODE_ENV = "development";
  ({ ViewingAsBanner } = await import("~/components/dev/ViewingAsBanner"));
  env.NODE_ENV = original;
});

describe("ViewingAsBanner", () => {
  it("spans the content column: clear of the sidebar and of the Inspector gutter", () => {
    render(<ViewingAsBanner />);
    const banner = screen.getByText(/Viewing as/).parentElement!;
    expect(banner).toHaveClass("left-(--shell-sidebar-width)");
    expect(banner).toHaveClass("right-(--shell-inspector-width)");
    expect(banner).not.toHaveClass("right-0");
  });
});

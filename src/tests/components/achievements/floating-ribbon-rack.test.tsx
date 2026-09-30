import { render, screen } from "@testing-library/react";

const useQuery = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: { ixnayid: { getCountryRibbons: { useQuery: (...args: unknown[]) => useQuery(...args) } } },
}));

import {
  CountryOwnerRibbonRack,
  FloatingRibbonRack,
  ribbonDevice,
  ribbonStripe,
  type RibbonView,
} from "~/components/achievements/FloatingRibbonRack";

const ribbon = (key: string, category = "Economic", rarity = "Rare"): RibbonView => ({
  key,
  title: `Title ${key}`,
  category,
  rarity,
});

describe("FloatingRibbonRack", () => {
  it("renders nothing without ribbons (no hard-coded defaults)", () => {
    const { container } = render(<FloatingRibbonRack />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one bar per supplied ribbon, up to the max, with a +N counter", () => {
    render(
      <FloatingRibbonRack
        ribbons={[ribbon("a"), ribbon("b"), ribbon("c"), ribbon("d")]}
        max={3}
        total={7}
      />
    );
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.getByText("+4")).toBeInTheDocument();
  });

  it("styles the stripe by category and the device by rarity, with fallbacks", () => {
    expect(ribbonStripe("Military")).toContain("red");
    expect(ribbonStripe("Unknown")).toBe(ribbonStripe("General"));
    expect(ribbonDevice("Legendary")).not.toBe(ribbonDevice("Common"));
    expect(ribbonDevice("Mystery")).toBe(ribbonDevice("Common"));
  });
});

describe("CountryOwnerRibbonRack", () => {
  beforeEach(() => useQuery.mockReset());

  it("queries the owner's ribbons by country slug and renders them", () => {
    useQuery.mockReturnValue({ data: { ribbons: [ribbon("a")], total: 1 } });
    render(<CountryOwnerRibbonRack countrySlug="caphiria" />);
    expect(useQuery).toHaveBeenCalledWith(
      { countrySlug: "caphiria" },
      expect.objectContaining({ enabled: true })
    );
    expect(screen.getByRole("img", { name: /Title a/ })).toBeInTheDocument();
  });

  it("renders nothing when the owner has no ribbons", () => {
    useQuery.mockReturnValue({ data: { ribbons: [], total: 0 } });
    const { container } = render(<CountryOwnerRibbonRack countrySlug="caphiria" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not query without a slug", () => {
    useQuery.mockReturnValue({ data: undefined });
    const { container } = render(<CountryOwnerRibbonRack countrySlug={null} />);
    expect(useQuery).toHaveBeenCalledWith(
      { countrySlug: "" },
      expect.objectContaining({ enabled: false })
    );
    expect(container).toBeEmptyDOMElement();
  });
});

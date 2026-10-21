import { render, screen } from "@testing-library/react";

const useQuery = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: { ixnayid: { getCountryRibbons: { useQuery: (...args: unknown[]) => useQuery(...args) } } },
}));

import {
  CountryOwnerRibbonRack,
  type RibbonView,
} from "~/components/achievements/FloatingRibbonRack";

const ribbon = (key: string, category = "Economic", rarity = "Rare"): RibbonView => ({
  key,
  title: `Title ${key}`,
  category,
  rarity,
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

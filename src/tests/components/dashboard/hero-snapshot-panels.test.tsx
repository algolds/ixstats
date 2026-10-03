import { useState } from "react";
import { render, screen } from "@testing-library/react";

const useQuery = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    mycountry: { getCountryDashboard: { useQuery: (...args: unknown[]) => useQuery(...args) } },
  },
}));

import {
  HeroSnapshotPanels,
  type HeroSnapshotData,
} from "~/components/dashboard/hero/HeroSnapshotPanels";

const data: HeroSnapshotData = {
  stats: {
    gdpPerCapita: 40000,
    currentTotalGdp: 2e12,
    population: 5_000_000,
    populationDensity: null,
    landArea: null,
    areaSqMi: null,
    gdpGrowth: 0,
    popGrowth: 0,
  },
};

describe("HeroSnapshotPanels", () => {
  beforeEach(() => {
    useQuery.mockReset();
    // A real query hook owns state; React crashes if the call is skipped on a later render.
    useQuery.mockImplementation(() => {
      const [recorded] = useState({ publicApproval: 72.4, politicalStability: "Stable" });
      return { data: recorded };
    });
  });

  it("runs the dashboard query on every render, disabled while there is no country", () => {
    const { rerender } = render(
      <HeroSnapshotPanels isPremium={false} data={data} onOpenModal={jest.fn()} />
    );
    expect(useQuery).toHaveBeenLastCalledWith(
      { countryId: "" },
      expect.objectContaining({ enabled: false })
    );

    rerender(
      <HeroSnapshotPanels isPremium={false} data={data} countryId="c1" onOpenModal={jest.fn()} />
    );
    expect(useQuery).toHaveBeenLastCalledWith(
      { countryId: "c1" },
      expect.objectContaining({ enabled: true })
    );
    expect(screen.getByText("72%")).toBeInTheDocument();

    rerender(<HeroSnapshotPanels isPremium={false} data={data} onOpenModal={jest.fn()} />);
    expect(useQuery).toHaveBeenCalledTimes(3);
  });
});

/**
 * P2-9: the country page passes its slug to CountryDataProvider. The country query resolves a slug, but
 * `countries.getActivityRingsData` takes only an id, so the rings query must use the resolved country's id;
 * asking with the slug logged "Country with ID <slug> not found" on every country page load.
 */
import React from "react";
import { render } from "@testing-library/react";

const ringsQuery = jest.fn((_input: { countryId: string }, _opts: { enabled: boolean }) => ({
  data: undefined,
}));
let countryData: { id: string; name: string } | undefined;

jest.mock("~/trpc/react", () => ({
  api: {
    users: { getProfile: { useQuery: () => ({ data: undefined, isLoading: false }) } },
    system: {
      getCurrentIxTime: {
        useQuery: () => ({ data: { currentIxTimeNumber: 1 }, isLoading: false }),
      },
    },
    countries: {
      getByIdWithEconomicData: {
        useQuery: () => ({ data: countryData, isLoading: false, error: null }),
      },
      getActivityRingsData: {
        useQuery: (input: { countryId: string }, opts: { enabled: boolean }) =>
          ringsQuery(input, opts),
      },
    },
  },
}));
jest.mock("~/context/DevCountryViewContext", () => ({
  useDevCountryView: () => ({ viewCountryId: null, isViewingOtherCountry: false }),
}));
jest.mock("~/context/DemoModeContext", () => ({
  useDemoMode: () => ({ isDemoActive: false, demoCountryId: null }),
}));
jest.mock("~/lib/economy/data-mapper", () => ({ mapCountryToEconomyData: () => null }));

import { CountryDataProvider } from "~/components/mycountry/shared/primitives/CountryDataProvider";

const renderWithSlug = () =>
  render(
    <CountryDataProvider userId="" countryId="e2e-bravoland" isPublicReadOnly>
      <span />
    </CountryDataProvider>
  );

beforeEach(() => ringsQuery.mockClear());

it("asks for the rings with the resolved country id, never the slug", () => {
  countryData = { id: "cmuuth78z0003", name: "E2E Bravoland" };
  renderWithSlug();
  expect(ringsQuery).toHaveBeenCalledWith({ countryId: "cmuuth78z0003" }, { enabled: true });
  expect(ringsQuery).not.toHaveBeenCalledWith({ countryId: "e2e-bravoland" }, expect.anything());
});

it("holds the rings query until the country has resolved", () => {
  countryData = undefined;
  renderWithSlug();
  expect(ringsQuery).toHaveBeenCalledWith({ countryId: "" }, { enabled: false });
});

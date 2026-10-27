/**
 * P2-9: the country page passes its slug to CountryDataProvider. The country query resolves a slug, but
 * `countries.getActivityRingsData` takes only an id, so the rings query must use the resolved country's id;
 * asking with the slug logged "Country with ID <slug> not found" on every country page load.
 * Realm time: the provider's "now" is the country's realm clock (not Ixnay's), shared with `useNationClock`.
 */
import React from "react";
import { render, screen } from "@testing-library/react";

const ringsQuery = jest.fn((_input: { countryId: string }, _opts: { enabled: boolean }) => ({
  data: undefined,
}));
let countryData: { id: string; name: string; realmId?: string } | undefined;
let clockLoaded = true;

jest.mock("~/trpc/react", () => ({
  api: {
    users: { getProfile: { useQuery: () => ({ data: undefined, isLoading: false }) } },
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
jest.mock("~/hooks/useRealmClock", () => {
  const { sixTimesReader } = jest.requireActual("~/tests/fixtures/realm-readers");
  const frost = sixTimesReader();
  return {
    useCountryClock: (country: { realmId?: string } | null) =>
      country && clockLoaded ? frost : null,
  };
});

import {
  CountryDataProvider,
  useCountryData,
} from "~/components/mycountry/shared/primitives/CountryDataProvider";
import { useNationClock } from "~/hooks/useNationClock";
import { formatClockDate } from "~/lib/realms/nation-time";

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

function ClockProbe() {
  const { currentIxTime, clock } = useCountryData();
  const shared = useNationClock();
  return (
    <span>
      {formatClockDate(currentIxTime, clock)} · {shared === clock ? "shared" : "apart"}
    </span>
  );
}

describe("the country's clock", () => {
  beforeEach(() => {
    countryData = { id: "c-frost", name: "Frostmark", realmId: "realm-frost" };
  });
  afterEach(() => {
    clockLoaded = true;
  });

  it("dates the country on its realm's clock and calendar, and shares the clock below", () => {
    render(
      <CountryDataProvider userId="" countryId="frostmark" isPublicReadOnly>
        <ClockProbe />
      </CountryDataProvider>
    );
    expect(screen.getByText("14 Thaw 812 AE · shared")).toBeInTheDocument();
  });

  it("holds the page on its skeleton until the realm's clock arrives", () => {
    clockLoaded = false;
    render(
      <CountryDataProvider userId="" countryId="frostmark" isPublicReadOnly>
        <ClockProbe />
      </CountryDataProvider>
    );
    expect(screen.getByRole("status", { name: "Loading country" })).toBeInTheDocument();
    expect(screen.queryByText(/Thaw/)).not.toBeInTheDocument();
  });
});

/**
 * Pickers for country-to-country actions offer only nations of the acting nation's realm (the cross-realm rule):
 * the nation search behind the embassy host and alliance target pickers, the exchange wizard's participants, and
 * the dossier, whose embassy, meeting and proposal rows are off for a nation of another realm.
 */
import React from "react";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";

const COUNTRIES = [
  { id: "frost-1", name: "Frostmark", realmId: "realm-frost" },
  { id: "frost-2", name: "Icereach", realmId: "realm-frost" },
  { id: "ixnay-1", name: "Caphiria", realmId: "default" },
];
let mockCrossRealm = false;

jest.mock("~/trpc/react", () => ({
  api: {
    countries: {
      getAll: { useQuery: () => ({ data: { countries: COUNTRIES }, isLoading: false }) },
    },
    users: { getProfile: { useQuery: () => ({ data: undefined }) } },
    thinkpages: { createPost: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) } },
    achievements: { getRecentByCountry: { useQuery: () => ({ data: [] }) } },
  },
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next/dynamic", () => () => () => null);
jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiLinkPreview: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("~/hooks/useViewerPostingAccount", () => ({ useViewerPostingAccount: () => null }));
jest.mock("~/components/mycountry/dossier/useCountryDiplomacyActions", () => ({
  useCountryDiplomacyActions: () => ({
    isFollowing: false,
    isFollowPending: false,
    isEmbassyPending: false,
    isPending: false,
    crossRealm: mockCrossRealm,
    toggleFollow: jest.fn(),
    establishEmbassy: jest.fn(),
    proposeForeignPolicy: jest.fn(),
  }),
}));

import { CountrySearchSelect } from "~/components/mycountry/domains/diplomacy/CountrySearchSelect";
import { useExchangeWizardForm } from "~/components/mycountry/domains/diplomacy/exchange-wizard/useExchangeWizardForm";
import { CountryActionsMenu } from "~/components/mycountry/dossier/CountryActionsMenu";
import { NationClockProvider } from "~/hooks/useNationClock";
import { sixTimesReader } from "~/tests/fixtures/realm-readers";

const inFrost = ({ children }: { children: React.ReactNode }) => (
  <NationClockProvider value={sixTimesReader()}>{children}</NationClockProvider>
);

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  Element.prototype.scrollIntoView ??= () => undefined;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
});

it("the nation search lists only nations of the acting nation's realm", () => {
  render(<CountrySearchSelect value="" onSelect={jest.fn()} excludeIds={["frost-1"]} label="Host" />, {
    wrapper: inFrost,
  });
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Host" }), { key: "Enter" });
  const options = screen.getAllByRole("option").map((o) => o.textContent);
  expect(options).toEqual(["Icereach"]);
});

it("the exchange wizard offers participants of the host's realm only", () => {
  const { result } = renderHook(() => useExchangeWizardForm({ id: "frost-1", name: "Frostmark" }), {
    wrapper: inFrost,
  });
  expect(result.current.availableCountries.map((c) => c.id)).toEqual(["frost-2"]);
});

describe("the dossier", () => {
  const renderMenu = () =>
    render(
      <CountryActionsMenu
        targetCountryId="ixnay-1"
        targetCountryName="Caphiria"
        targetRealmId="default"
        viewerCountryId="frost-1"
        isOpen
        onClose={jest.fn()}
      />
    );

  it("turns embassy, meeting and proposal rows off for a nation of another realm", () => {
    mockCrossRealm = true;
    renderMenu();
    expect(screen.getByRole("button", { name: "Construct Embassy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request meeting" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Propose free trade" })).toBeDisabled();
    expect(screen.getByText(/Both nations must be in the same realm/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Follow Nation" })).toBeEnabled();
  });

  it("keeps them on within one realm", () => {
    mockCrossRealm = false;
    renderMenu();
    expect(screen.getByRole("button", { name: "Construct Embassy" })).toBeEnabled();
    expect(screen.queryByText(/Both nations must be in the same realm/)).not.toBeInTheDocument();
  });
});

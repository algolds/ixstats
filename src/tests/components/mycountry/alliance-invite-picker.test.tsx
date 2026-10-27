/**
 * The alliance invite picker offers every nation of the realm that isn't already in the alliance, as the
 * inviteMember rule allows, not only the nations the inviter has a relation record ("stance") with.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const COUNTRIES = [
  { id: "me", name: "Urcea", realmId: "default" },
  { id: "member", name: "Burgundie", realmId: "default" },
  { id: "stranger", name: "Caphiria", realmId: "default" },
  { id: "far", name: "Frostmark", realmId: "realm-frost" },
];
const mockGetRelationships = jest.fn(() => ({ data: [] }));

jest.mock("~/hooks/useActingRealmId", () => ({ useActingRealmId: () => "default" }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/mycountry/domains/diplomacy/alliances/CollectiveActionsPanel", () => ({
  CollectiveActionsPanel: () => null,
}));
jest.mock("~/trpc/react", () => {
  const mutation = { useMutation: () => ({ mutate: jest.fn(), isPending: false }) };
  return {
    api: {
      useUtils: () => ({
        diplomaticPolicies: { getOutgoingAllianceInvites: { invalidate: jest.fn() } },
      }),
      countries: {
        getAll: { useQuery: () => ({ data: { countries: COUNTRIES }, isLoading: false }) },
      },
      diplomaticCore: { getRelationships: { useQuery: () => mockGetRelationships() } },
      diplomaticPolicies: {
        getAllianceDashboard: {
          useQuery: () => ({
            data: {
              name: "Northern Pact",
              shortName: "NP",
              color: "#123456",
              type: "defense",
              visibility: "public",
              memberCount: 2,
              members: [
                { id: "m1", countryId: "me", role: "founder", country: { name: "Urcea" } },
                { id: "m2", countryId: "member", role: "member", country: { name: "Burgundie" } },
              ],
              calculatedTotalGdp: 0,
              calculatedTotalPopulation: 0,
              pendingActions: 0,
              documents: [],
            },
            refetch: jest.fn(),
          }),
        },
        inviteMember: mutation,
        leaveAlliance: mutation,
      },
    },
  };
});

import { AllianceDashboard } from "~/components/mycountry/domains/diplomacy/alliances/AllianceDashboard";

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

it("offers realm nations outside the alliance even with no relation record", () => {
  render(<AllianceDashboard allianceId="a1" countryId="me" myRole="founder" />);
  fireEvent.click(screen.getByRole("button", { name: /invite/i }));
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Nation to invite" }), { key: "Enter" });
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Caphiria"]);
  expect(mockGetRelationships).not.toHaveBeenCalled();
});

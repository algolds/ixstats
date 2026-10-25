/**
 * The MyCountry profile prompt only checks what the owner can fill. A fully set-up nation (flag and
 * coat of arms on the Country row, identity filled in the editor, a government with departments and
 * allocations, one saved tax rate) is compliant, so the prompt stops reopening.
 */
import { renderHook } from "@testing-library/react";

const mockGovernment = {
  governmentType: "Constitutional monarchy",
  departments: [{ id: "d-1" }],
  budgetAllocations: [{ id: "a-1" }],
};

const completeCountry = {
  id: "c-1",
  name: "Eldoria",
  flag: "https://img.example/flag.png",
  coatOfArms: "https://img.example/arms.png",
  // Growth is computed (there is no stored growth field), so it is never checked.
  calculatedStats: { gdpGrowth: 0.02 },
  nationalIdentity: {
    officialName: "Kingdom of Eldoria",
    capitalCity: "Aurum",
    demonym: "Eldorian",
    currency: "Eldorian crown",
    currencySymbol: "E",
    nationalAnthem: "Rise, Eldoria",
    nationalDay: "4 July",
    isoCode: "ELD",
  },
  fiscalSystem: { salesTaxRate: 12 },
};

const mockState: { country: object } = { country: completeCountry };

jest.mock("~/trpc/react", () => ({
  api: {
    government: { getByCountryId: { useQuery: () => ({ data: mockGovernment, isLoading: false }) } },
  },
}));

jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: mockState.country, userProfile: null }),
}));

import { useMyCountryCompliance } from "~/hooks/useMyCountryCompliance";
import { complianceReviewHref } from "~/lib/mycountry/routes";

beforeEach(() => {
  mockState.country = completeCountry;
});

describe("useMyCountryCompliance", () => {
  it("calls a fully set-up nation compliant", () => {
    const { result } = renderHook(() => useMyCountryCompliance());
    expect(result.current.sections.map((s) => s.missing)).toEqual([[], [], []]);
    expect(result.current.isCompliant).toBe(true);
  });

  it("reads the flag and coat of arms from the Country row", () => {
    mockState.country = { ...completeCountry, flag: null, coatOfArms: "" };
    const { result } = renderHook(() => useMyCountryCompliance());
    const identity = result.current.sections.find((s) => s.id === "national-identity");
    expect(identity?.missing).toEqual(["Flag", "Coat of arms"]);
    expect(result.current.isCompliant).toBe(false);
  });

  it("asks for tax rates when none is saved, and sends Review to the Fiscal policy tab", () => {
    mockState.country = { ...completeCountry, fiscalSystem: null };
    const { result } = renderHook(() => useMyCountryCompliance());
    const taxes = result.current.sections.find((s) => s.id === "taxes");
    expect(taxes?.missing).toEqual(["Tax rates"]);
    expect(complianceReviewHref(taxes)).toBe("/mycountry/economy?tab=taxes");
  });
});

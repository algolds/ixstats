/**
 * Realm time D1: the Defense page reads its budget from the government budget (the National
 * budget tab's query) and saves through the owner-checked `government.setAllocation`, never a
 * security procedure. Realm time T4: the budget year is the nation's, on its realm clock.
 */
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { NationClockProvider } from "~/hooks/useNationClock";
import type { RealmClockReader } from "~/lib/realms/realm-clock";
import { CLOCK_NOW, ixnayReader } from "~/tests/fixtures/realm-readers";

const mockSetAllocation = jest.fn();
const mockAddDepartment = jest.fn();
const mockGovernment = {
  totalBudget: 100e9,
  departments: [{ id: "d_def", name: "Ministry of Defence", category: "Defense" }],
  budgetAllocations: [
    { departmentId: "d_def", budgetYear: 2040, allocatedPercent: 8, allocatedAmount: 8e9 },
  ],
};

jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({ error: jest.fn() }) }));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      government: {
        getFullByCountryId: { invalidate: jest.fn() },
        getByCountryId: { invalidate: jest.fn() },
      },
      mycountry: { getFirstSteps: { invalidate: jest.fn() } },
    }),
    government: {
      getFullByCountryId: {
        useQuery: () => ({ data: mockGovernment, isLoading: false }),
      },
      setAllocation: {
        useMutation: () => ({
          mutate: (...a: object[]) => mockSetAllocation(...a),
          isPending: false,
        }),
      },
      addDepartment: {
        useMutation: () => ({
          mutate: (...a: object[]) => mockAddDepartment(...a),
          isPending: false,
        }),
      },
      removeDepartment: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
    },
  },
}));

import { useDefenseBudget } from "~/hooks/useDefenseBudget";

let clock: RealmClockReader | null = ixnayReader();
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NationClockProvider value={clock}>{children}</NationClockProvider>
);
const renderBudget = () => renderHook(() => useDefenseBudget({ countryId: "c1" }), { wrapper });

beforeEach(() => {
  clock = ixnayReader();
  mockSetAllocation.mockReset();
  mockAddDepartment.mockReset();
});

it("reads the Defense department line of the budget in effect", () => {
  const { result } = renderBudget();
  expect(result.current.line).toMatchObject({
    kind: "line",
    departmentId: "d_def",
    allocatedAmount: 8e9,
    allocatedPercent: 8,
    totalBudget: 100e9,
  });
});

it("saves the share through government.setAllocation and closes the editor", () => {
  const { result } = renderBudget();
  act(() => result.current.setEditingBudget(true));
  act(() => result.current.saveShare(12));
  expect(mockSetAllocation).toHaveBeenCalledWith({
    countryId: "c1",
    departmentId: "d_def",
    allocatedPercent: 12,
  });
  expect(result.current.editingBudget).toBe(false);
});

it("adds a Defense department through government.addDepartment", () => {
  const { result } = renderBudget();
  act(() => result.current.addDefenseDepartment());
  expect(mockAddDepartment).toHaveBeenCalledWith({
    countryId: "c1",
    name: "Ministry of Defence",
    category: "Defense",
  });
});

it("takes the budget year from the nation's realm clock", () => {
  // A realm still in 2039 has no budget in effect yet: its Defense line reads 0.
  clock = { ...ixnayReader(), now: () => Date.UTC(2039, 5, 1) };
  expect(renderBudget().result.current.line).toMatchObject({ kind: "line", allocatedPercent: 0 });
  clock = ixnayReader(() => CLOCK_NOW);
  expect(renderBudget().result.current.line).toMatchObject({ kind: "line", allocatedPercent: 8 });
});

it("waits for the nation's clock", () => {
  clock = null;
  expect(renderBudget().result.current.isLoading).toBe(true);
});

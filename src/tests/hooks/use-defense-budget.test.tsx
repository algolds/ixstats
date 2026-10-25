/**
 * Realm time D1: the Defense page reads its budget from the government budget (the National
 * budget tab's query) and saves through the owner-checked `government.setAllocation`, never a
 * security procedure.
 */
import { act, renderHook } from "@testing-library/react";

const mockSetAllocation = jest.fn();
const mockAddDepartment = jest.fn();
const mockGovernment = {
  totalBudget: 100e9,
  departments: [{ id: "d_def", name: "Ministry of Defence", category: "Defense" }],
  budgetAllocations: [
    { departmentId: "d_def", budgetYear: 2040, allocatedPercent: 8, allocatedAmount: 8e9 },
  ],
};

jest.mock("~/lib/government/budget-year", () => ({
  ...jest.requireActual("~/lib/government/budget-year"),
  currentBudgetYear: () => 2040,
}));
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

beforeEach(() => {
  mockSetAllocation.mockReset();
  mockAddDepartment.mockReset();
});

it("reads the Defense department line of the budget in effect", () => {
  const { result } = renderHook(() => useDefenseBudget({ countryId: "c1" }));
  expect(result.current.line).toMatchObject({
    kind: "line",
    departmentId: "d_def",
    allocatedAmount: 8e9,
    allocatedPercent: 8,
    totalBudget: 100e9,
  });
});

it("saves the share through government.setAllocation and closes the editor", () => {
  const { result } = renderHook(() => useDefenseBudget({ countryId: "c1" }));
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
  const { result } = renderHook(() => useDefenseBudget({ countryId: "c1" }));
  act(() => result.current.addDefenseDepartment());
  expect(mockAddDepartment).toHaveBeenCalledWith({
    countryId: "c1",
    name: "Ministry of Defence",
    category: "Defense",
  });
});

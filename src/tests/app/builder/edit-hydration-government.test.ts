import { describe, it, expect } from "@jest/globals";
import { hydrateGovernmentStructure } from "~/app/builder/lib/edit-hydration";

type Args = Parameters<typeof hydrateGovernmentStructure>;

describe("hydrateGovernmentStructure", () => {
  it("keys allocations and parent links by department index, as the government save expects", () => {
    const department = (id: string, parentDepartmentId: string | null) => ({
      id,
      name: id,
      category: "Other",
      ministerTitle: "Minister",
      parentDepartmentId,
      functions: null,
      kpis: null,
    });
    const government = {
      governmentName: "Government of Testland",
      governmentType: "Other",
      totalBudget: 1000,
      fiscalYear: "Calendar Year",
      budgetCurrency: "USD",
      departments: [department("cuid-a", null), department("cuid-b", "cuid-a")],
      budgetAllocations: [
        { departmentId: "cuid-b", budgetYear: 2040, allocatedAmount: 50, allocatedPercent: 5 },
        { departmentId: "cuid-gone", budgetYear: 2040, allocatedAmount: 1, allocatedPercent: 1 },
      ],
      revenueSources: [],
    } as unknown as Args[1];

    const state = hydrateGovernmentStructure({ name: "Testland" } as Args[0], government, 0);

    expect(state.departments[1]?.parentDepartmentId).toBe("0");
    expect(state.budgetAllocations).toEqual([
      expect.objectContaining({ departmentId: "1", budgetYear: 2040, allocatedAmount: 50 }),
    ]);
  });
});

import { removeDepartmentAt } from "~/app/builder/lib/remove-department";
import type { GovernmentBuilderState } from "~/types/government";

const government = (): GovernmentBuilderState =>
  ({
    structure: {},
    departments: [
      { name: "Defence" },
      { name: "Army", parentDepartmentId: "0" },
      { name: "Finance" },
      { name: "Treasury", parentDepartmentId: "2" },
    ],
    budgetAllocations: [
      { departmentId: "0", budgetYear: 2026, allocatedAmount: 40, allocatedPercent: 40 },
      { departmentId: "1", budgetYear: 2026, allocatedAmount: 10, allocatedPercent: 10 },
      { departmentId: "2", budgetYear: 2026, allocatedAmount: 30, allocatedPercent: 30 },
      { departmentId: "3", budgetYear: 2026, allocatedAmount: 20, allocatedPercent: 20 },
    ],
    revenueSources: [],
    isValid: true,
    errors: {},
  }) as unknown as GovernmentBuilderState;

describe("removeDepartmentAt", () => {
  it("drops the department's allocations and keeps the others on their departments", () => {
    const next = removeDepartmentAt(government(), 1);

    expect(next.departments.map((d) => d.name)).toEqual(["Defence", "Finance", "Treasury"]);
    expect(next.budgetAllocations.map((a) => [a.departmentId, a.allocatedAmount])).toEqual([
      ["0", 40],
      ["1", 30],
      ["2", 20],
    ]);
    expect(next.departments[2]?.parentDepartmentId).toBe("1");
  });

  it("clears links to the removed department", () => {
    const next = removeDepartmentAt(government(), 0);

    expect(next.departments[0]).toEqual({ name: "Army", parentDepartmentId: undefined });
  });
});

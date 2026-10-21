import { describe, it, expect } from "@jest/globals";
import { GovernmentBuilderStateSchema } from "~/types/government";

describe("GovernmentBuilder validation", () => {
  it("fails when totalBudget <= 0 and department name missing", () => {
    const invalid = {
      structure: {
        governmentName: "",
        governmentType: "Unitary State",
        totalBudget: 0,
        fiscalYear: "Calendar Year",
        budgetCurrency: "USD",
      },
      departments: [
        {
          name: "",
          category: "Other",
          organizationalLevel: "Ministry",
          color: "#000000",
          priority: 50,
        },
      ],
      budgetAllocations: [],
      revenueSources: [],
    } as any;
    const result = GovernmentBuilderStateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

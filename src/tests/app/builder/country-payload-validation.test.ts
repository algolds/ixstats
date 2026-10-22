/**
 * Builder payloads against the server's input schemas (data-loss guard): edit-mode state with undefined keys, Dates
 * and non-finite numbers must pass, as raw state and as it crosses the wire; a government with no budget and an
 * unnamed department is refused.
 *
 * Folds governmentValidator.
 */
import { GovernmentBuilderStateSchema } from "~/types/government";
import {
  countryTaxSystemInputSchema,
  countryGovernmentStructureInputSchema,
  countryEconomyBuilderStateSchema,
} from "~/server/shared/country-payload-builder";

// Edit-mode builder state as useBuilderEditMode / taxSystem.getByCountryId build it:
// optional DB columns become `undefined` keys, exemptions carry Dates.
const taxSystemData = {
  taxSystem: {
    taxSystemName: "Tax",
    taxAuthority: undefined,
    taxCode: undefined,
    baseRate: undefined,
  },
  categories: [{ categoryName: "Income", description: undefined, baseRate: NaN }],
  brackets: { "0": [{ minIncome: 0, maxIncome: undefined, rate: 10 }] },
  exemptions: [{ exemptionName: "Kids", endDate: new Date("2030-01-01") }],
  deductions: {},
  isValid: true,
  errors: {},
};
const governmentStructure = {
  structure: { governmentName: "Gov", headOfState: undefined },
  departments: [{ name: "Defense", parentDepartmentId: undefined, functions: [] }],
  budgetAllocations: [],
  revenueSources: [
    { name: "VAT", rate: undefined, collectionMethod: undefined, administeredBy: undefined },
  ],
  isValid: true,
  errors: { structure: [], departments: {}, budget: [], revenue: [] },
};
const economyBuilderState = {
  sectors: [{ id: "a", share: Infinity }],
  lastUpdated: new Date(),
  isValid: true,
};

/** The payload as it crosses the wire: JSON, so Dates become strings and NaN/Infinity drop out. */
function asJsonPayload<T>(payload: object): T {
  return JSON.parse(
    JSON.stringify(payload, (_key, value: unknown) =>
      typeof value === "number" && !Number.isFinite(value) ? undefined : value
    )
  ) as T;
}

describe("builder country payload validation", () => {
  it("accepts raw builder state with undefined keys (superjson path)", () => {
    expect(
      countryTaxSystemInputSchema.safeParse({
        ...taxSystemData,
        categories: [{ categoryName: "Income", description: undefined }],
        exemptions: [],
      }).success
    ).toBe(true);
    expect(countryGovernmentStructureInputSchema.safeParse(governmentStructure).success).toBe(true);
  });

  it("accepts the normalized payload including Dates and non-finite numbers", () => {
    const p = asJsonPayload<{ t: unknown; g: unknown; e: unknown }>({
      t: taxSystemData,
      g: governmentStructure,
      e: economyBuilderState,
    });
    expect(countryTaxSystemInputSchema.safeParse(p.t).success).toBe(true);
    expect(countryGovernmentStructureInputSchema.safeParse(p.g).success).toBe(true);
    expect(countryEconomyBuilderStateSchema.safeParse(p.e).success).toBe(true);
    expect(JSON.stringify(p)).toContain('"endDate":"2030-01-01T00:00:00.000Z"');
  });
});

describe("government builder validation", () => {
  it("refuses an empty budget and an unnamed department", () => {
    const result = GovernmentBuilderStateSchema.safeParse({
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
    });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["structure.totalBudget", "departments.0.name"]));
  });
});

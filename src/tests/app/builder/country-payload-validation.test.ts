import { asJsonPayload } from "~/app/builder/lib/json-payload";
import {
  countryTaxSystemInputSchema,
  countryGovernmentStructureInputSchema,
  countryEconomyBuilderStateSchema,
} from "~/server/shared/country-payload-builder";

// Edit-mode builder state as useBuilderEditMode / taxSystem.getByCountryId build it:
// optional DB columns become `undefined` keys, exemptions carry Dates.
const taxSystemData = {
  taxSystem: { taxSystemName: "Tax", taxAuthority: undefined, taxCode: undefined, baseRate: undefined },
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
  revenueSources: [{ name: "VAT", rate: undefined, collectionMethod: undefined, administeredBy: undefined }],
  isValid: true,
  errors: { structure: [], departments: {}, budget: [], revenue: [] },
};
const economyBuilderState = { sectors: [{ id: "a", share: Infinity }], lastUpdated: new Date(), isValid: true };

describe("builder country payload validation", () => {
  it("accepts raw builder state with undefined keys (superjson path)", () => {
    expect(countryTaxSystemInputSchema.safeParse({ ...taxSystemData, categories: [{ categoryName: "Income", description: undefined }], exemptions: [] }).success).toBe(true);
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

  it("keeps nulls (foundationCountry: null is meaningful)", () => {
    expect(asJsonPayload<{ a: null }>({ a: null })).toEqual({ a: null });
  });
});

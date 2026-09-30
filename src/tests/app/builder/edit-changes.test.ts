import {
  getChangedFields,
  indexChangesByName,
  isFieldChanged,
  normalizeFieldName,
  pickTrackedData,
  pushBounded,
  type TrackedData,
} from "~/app/builder/lib/edit-changes";
import { baseInitialState, type BuilderState } from "~/app/builder/hooks/builderStateTypes";
import { createDefaultEconomicInputs } from "~/app/builder/lib/default-economic-inputs";
import type { GovernmentBuilderState } from "~/types/government";
import type { ComponentType } from "~/lib/enums";

const inputs = createDefaultEconomicInputs();
const loaded: BuilderState = {
  ...baseInitialState,
  step: "core",
  economicInputs: inputs,
};
const baseline = pickTrackedData(loaded);
const government = loaded.governmentStructure as GovernmentBuilderState;

function withUnemployment(rate: number): TrackedData {
  return {
    ...baseline,
    economicInputs: {
      ...inputs,
      laborEmployment: { ...inputs.laborEmployment, unemploymentRate: rate },
    },
  };
}

describe("getChangedFields", () => {
  it("reports nothing when the state matches the baseline", () => {
    expect(getChangedFields(baseline, pickTrackedData({ ...loaded }))).toEqual([]);
  });

  it("reports each changed field by path with its current value", () => {
    expect(getChangedFields(baseline, withUnemployment(7.5))).toEqual([
      { path: "economicInputs.laborEmployment.unemploymentRate", value: 7.5 },
    ]);
  });

  it("stops reporting a field once it is changed back", () => {
    const original = inputs.laborEmployment.unemploymentRate;
    expect(getChangedFields(baseline, withUnemployment(original))).toEqual([]);
  });

  it("ignores navigation and view state", () => {
    const navigated = pickTrackedData({
      ...loaded,
      step: "economics",
      activeEconomicsTab: "workforce",
      showAdvancedMode: !loaded.showAdvancedMode,
    });
    expect(getChangedFields(baseline, navigated)).toEqual([]);
  });

  it("ignores validation and timestamp bookkeeping", () => {
    const revalidated: TrackedData = {
      ...baseline,
      governmentStructure: {
        ...government,
        isValid: false,
        errors: { structure: ["Name required"], departments: {}, budget: [], revenue: [] },
      },
    };
    expect(getChangedFields(baseline, revalidated)).toEqual([]);
  });

  it("counts a changed list as one field without a scalar value", () => {
    const current: TrackedData = {
      ...baseline,
      governmentComponents: ["SOCIAL_DEMOCRACY" as ComponentType],
      governmentStructure: {
        ...government,
        departments: [
          {
            name: "Treasury",
            category: "Finance",
            ministerTitle: "Minister",
            color: "amber",
            priority: 1,
            organizationalLevel: "Department",
          },
        ],
      },
    };
    expect(getChangedFields(baseline, current)).toEqual([
      { path: "governmentComponents", value: undefined },
      { path: "governmentStructure.departments", value: undefined },
    ]);
  });

  it("counts a section that appears or disappears as one field", () => {
    const current: TrackedData = { ...baseline, taxSystemData: null, governmentStructure: null };
    expect(getChangedFields(baseline, current)).toEqual([
      { path: "governmentStructure", value: undefined },
    ]);
  });
});

describe("pushBounded", () => {
  it("appends and drops the oldest entries past the limit", () => {
    expect(pushBounded([1, 2], 3, 5)).toEqual([1, 2, 3]);
    expect(pushBounded([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });

  it("does not mutate the original stack", () => {
    const stack = [1];
    pushBounded(stack, 2, 5);
    expect(stack).toEqual([1]);
  });
});

describe("field name matching", () => {
  it("normalizes labels and keys to the same name", () => {
    expect(normalizeFieldName("Health Expenditure (GDP %)")).toBe("healthexpendituregdp");
    expect(normalizeFieldName("healthExpenditureGDP")).toBe("healthexpendituregdp");
    expect(normalizeFieldName("Minimum Wage (Hourly)")).toBe(normalizeFieldName("minimumWageHourly"));
  });

  it("matches a field by label or key when its current value is the changed value", () => {
    const index = indexChangesByName(getChangedFields(baseline, withUnemployment(7.5)));
    expect(isFieldChanged(index, "Unemployment Rate", 7.5)).toBe(true);
    expect(isFieldChanged(index, "unemploymentRate", 7.5)).toBe(true);
  });

  it("does not match a same-named field holding a different value", () => {
    const index = indexChangesByName(getChangedFields(baseline, withUnemployment(7.5)));
    expect(isFieldChanged(index, "Unemployment Rate", 5)).toBe(false);
  });

  it("does not match unchanged or list fields", () => {
    const index = indexChangesByName([
      { path: "governmentComponents" },
      { path: "economicInputs.countryName", value: "Caphiria" },
    ]);
    expect(isFieldChanged(index, "Literacy Rate", 90)).toBe(false);
    expect(isFieldChanged(index, "governmentComponents", "SOCIAL_DEMOCRACY")).toBe(false);
    expect(isFieldChanged(index, "Country Name", "Caphiria")).toBe(true);
  });
});

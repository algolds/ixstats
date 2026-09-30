import { describe, it, expect } from "@jest/globals";
import { consequenceFieldLabel, describeConsequenceBadge } from "~/lib/intent/consequence-labels";

describe("consequence labels", () => {
  it("names fields in English instead of code keys", () => {
    expect(consequenceFieldLabel("publicApproval")).toBe("Public Approval");
    expect(consequenceFieldLabel("trustInGovernment")).toBe("Trust in Government");
    expect(consequenceFieldLabel("someNewField")).toBe("Some new field");
  });

  it("marks a falling cost-side stat as favorable", () => {
    expect(
      describeConsequenceBadge({
        targetField: "unemploymentRate",
        operation: "subtract",
        value: 0.6,
      })
    ).toEqual({ text: "Unemployment −0.6", favorable: true });
    expect(
      describeConsequenceBadge({ targetField: "publicApproval", operation: "subtract", value: 2 })
    ).toEqual({ text: "Public Approval −2", favorable: false });
    expect(
      describeConsequenceBadge({ targetField: "stabilityScore", operation: "add", value: 2 })
    ).toEqual({ text: "Stability +2", favorable: true });
  });
});

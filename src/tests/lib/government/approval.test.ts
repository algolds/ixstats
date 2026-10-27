import { describe, it, expect } from "@jest/globals";
import { approvalKpiValue } from "~/lib/government/approval";

// The Politics rail's approval is Country.publicApproval, the Standing card's figure: never an invented 50%.
describe("approvalKpiValue", () => {
  it("shows public approval rounded, and a dash when there is none", () => {
    expect(approvalKpiValue(62.6)).toBe("63%");
    expect(approvalKpiValue(0)).toBe("0%");
    expect(approvalKpiValue(null)).toBe("—");
    expect(approvalKpiValue(undefined)).toBe("—");
    expect(approvalKpiValue(Number.NaN)).toBe("—");
  });
});

/**
 * "Draft a custom policy" needs a managing department, and stored department categories are
 * written as "Finance" or "Foreign Affairs". The sheet and the server use one match that ignores
 * case and accepts a category that starts with the key, so a nation with a Finance department can
 * submit a fiscal policy.
 */
import {
  findPolicyDepartment,
  hasPolicyDepartment,
  policyDepartmentKey,
} from "~/lib/policies/department-match";

describe("policy department match", () => {
  const departments = [
    { name: "Ministry of Finance", category: "Finance" },
    { name: "Foreign Office", category: "Foreign Affairs" },
  ];

  it("finds the stored department whatever its case or suffix", () => {
    expect(findPolicyDepartment(departments, "fiscal")?.name).toBe("Ministry of Finance");
    expect(findPolicyDepartment(departments, "diplomatic")?.name).toBe("Foreign Office");
    expect(hasPolicyDepartment(["Finance", "Foreign Affairs"], "monetary")).toBe(true);
  });

  it("reports a missing department", () => {
    expect(findPolicyDepartment(departments, "healthcare")).toBeUndefined();
    expect(hasPolicyDepartment(["Finance"], "education")).toBe(false);
    expect(policyDepartmentKey("healthcare")).toBe("health");
  });
});

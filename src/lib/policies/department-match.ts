/**
 * Which government department manages a custom policy of a given category. Department categories
 * are stored as the player or the founding flow wrote them ("Finance", "Foreign Affairs",
 * "social"), so the match ignores case and accepts any category that starts with the key.
 */

const POLICY_DEPARTMENT: Record<string, string> = {
  fiscal: "finance",
  monetary: "finance",
  trade: "commerce",
  defense: "defense",
  education: "education",
  healthcare: "health",
  infrastructure: "interior",
  environment: "interior",
  governance: "interior",
  security: "interior",
  social: "interior",
  foreign: "foreign",
  diplomatic: "foreign",
};

/** The department key ("finance", "foreign") a policy category needs. */
export function policyDepartmentKey(policyCategory: string): string {
  return POLICY_DEPARTMENT[policyCategory.toLowerCase()] ?? "interior";
}

function managesKey(departmentCategory: string, key: string): boolean {
  return departmentCategory.trim().toLowerCase().startsWith(key);
}

/** The first department that manages policies of this category, if the nation has one. */
export function findPolicyDepartment<T extends { category: string }>(
  departments: readonly T[],
  policyCategory: string
): T | undefined {
  const key = policyDepartmentKey(policyCategory);
  return departments.find((d) => managesKey(d.category, key));
}

/** True when one of these department categories manages policies of this category. */
export function hasPolicyDepartment(
  departmentCategories: readonly string[],
  policyCategory: string
): boolean {
  const key = policyDepartmentKey(policyCategory);
  return departmentCategories.some((category) => managesKey(category, key));
}

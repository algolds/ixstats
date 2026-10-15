/**
 * Default departments per government form: 5 to 9 each, budget shares summing to 1, and only
 * department categories the government types accept.
 */
import {
  KNOWN_FORM_IDS,
  departmentsForForm,
  governmentTypeForForm,
} from "~/lib/government/form-departments";
import type { DepartmentCategory } from "~/types/government";

// Mirrors the DepartmentCategory union in src/types/government.ts; the `satisfies` keeps it honest.
const CATEGORIES = [
  "Defense",
  "Education",
  "Health",
  "Finance",
  "Foreign Affairs",
  "Interior",
  "Justice",
  "Transportation",
  "Agriculture",
  "Environment",
  "Labor",
  "Commerce",
  "Energy",
  "Communications",
  "Culture",
  "Science and Technology",
  "Social Services",
  "Housing",
  "Veterans Affairs",
  "Intelligence",
  "Emergency Management",
  "Other",
] as const satisfies readonly DepartmentCategory[];

const FORM_IDS = [
  "parliamentary-republic",
  "presidential-republic",
  "federal-republic",
  "constitutional-monarchy",
  "absolute-monarchy",
  "one-party-state",
  "military-government",
  "theocracy",
  "technocracy",
  "merchant-oligarchy",
  "confederation",
];

describe("departmentsForForm", () => {
  it("knows every form in the spec", () => {
    expect([...KNOWN_FORM_IDS].sort()).toEqual([...FORM_IDS].sort());
  });

  it.each([...FORM_IDS, "no-such-form", ""])("%s: 5 to 9 valid departments", (formId) => {
    const departments = departmentsForForm(formId);
    expect(departments.length).toBeGreaterThanOrEqual(5);
    expect(departments.length).toBeLessThanOrEqual(9);

    const total = departments.reduce((sum, d) => sum + d.spendingShare, 0);
    expect(total).toBeCloseTo(1, 10);
    for (const dept of departments) {
      expect(CATEGORIES).toContain(dept.category);
      expect(dept.spendingShare).toBeGreaterThan(0);
      expect(dept.priority).toBeGreaterThanOrEqual(1);
      expect(dept.priority).toBeLessThanOrEqual(100);
      expect(dept.name).not.toBe("");
      expect(dept.shortName).not.toBe("");
      expect(dept.ministerTitle).not.toBe("");
    }
    expect(new Set(departments.map((d) => d.name)).size).toBe(departments.length);
    // Every government can collect its taxes.
    expect(departments.some((d) => d.category === "Finance")).toBe(true);
  });

  it("an unknown form gets the parliamentary set", () => {
    expect(departmentsForForm("no-such-form")).toEqual(
      departmentsForForm("parliamentary-republic")
    );
  });

  it("names departments for the form", () => {
    expect(departmentsForForm("absolute-monarchy").map((d) => d.name)).toContain(
      "Royal Army Command"
    );
    expect(departmentsForForm("parliamentary-republic").map((d) => d.name)).toContain(
      "Ministry of Defence"
    );
  });

  it("gives every known form a government type", () => {
    for (const formId of FORM_IDS) expect(governmentTypeForForm(formId)).toBeTruthy();
    expect(governmentTypeForForm("no-such-form")).toBeNull();
  });
});

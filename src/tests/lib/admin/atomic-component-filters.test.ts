import { componentCategories, filterAtomicComponents } from "~/lib/admin/atomic-component-filters";

const components = [
  {
    name: "Centralized Power",
    description: "Unitary authority",
    category: "Power Distribution",
    metadata: { complexity: "Low" },
  },
  {
    name: "Federal System",
    description: "Division of powers between levels",
    category: "Power Distribution",
    metadata: { complexity: "High" },
  },
  {
    name: "Democratic Process",
    description: "Elections",
    category: "Decision Process",
    metadata: { complexity: "Medium" },
  },
];

describe("atomic-component-filters", () => {
  test("filterAtomicComponents returns everything with no filters", () => {
    expect(filterAtomicComponents(components, "", "all", "all")).toHaveLength(3);
  });

  test("filterAtomicComponents matches name or description, case-insensitively", () => {
    expect(filterAtomicComponents(components, "federal", "all", "all").map((c) => c.name)).toEqual([
      "Federal System",
    ]);
    expect(filterAtomicComponents(components, "POWERS", "all", "all").map((c) => c.name)).toEqual([
      "Federal System",
    ]);
  });

  test("filterAtomicComponents combines category and complexity", () => {
    expect(
      filterAtomicComponents(components, "", "Power Distribution", "High").map((c) => c.name)
    ).toEqual(["Federal System"]);
    expect(filterAtomicComponents(components, "", "Decision Process", "Low")).toEqual([]);
  });

  test("componentCategories lists distinct categories in order", () => {
    expect(componentCategories(components)).toEqual(["Decision Process", "Power Distribution"]);
  });
});

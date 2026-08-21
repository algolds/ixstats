import {
  defaultEconomicComponentFormData,
  economicComponentToFormData,
  filterEconomicComponents,
  COMPONENT_CATEGORIES,
  COMPLEXITY_LEVELS,
} from "~/lib/admin/economic-component-transforms";
import { EconomicComponentType } from "~/lib/enums";

describe("economic-component-transforms", () => {
  test("defaultEconomicComponentFormData produces valid initial defaults", () => {
    const data = defaultEconomicComponentFormData();
    expect(data.type).toBe(EconomicComponentType.FREE_MARKET_SYSTEM);
    expect(data.category).toBe("Economic Model");
    expect(data.effectiveness).toBe(75);
    expect(data.implementationCost).toBe(500000);
    expect(data.maintenanceCost).toBe(100000);
    expect(data.requiredCapacity).toBe(75);
    expect(data.taxImpact.optimalCorporateRate).toBe(20);
    expect(data.taxImpact.revenueEfficiency).toBe(75);
    expect(data.sectorImpact.services).toBe(1.0);
    expect(data.employmentImpact.unemploymentModifier).toBe(0);
    expect(data.complexity).toBe("Medium");
  });

  test("economicComponentToFormData maps record with nullish safety", () => {
    const raw = {
      id: "comp-1",
      type: EconomicComponentType.RESOURCE_BASED_ECONOMY,
      name: "Resource Based Economy",
      description: "Focus on natural resources",
      category: "Economic Model",
      effectiveness: 80,
      implementationCost: 600000,
      maintenanceCost: 120000,
      requiredCapacity: 70,
      synergies: [EconomicComponentType.FREE_MARKET_SYSTEM],
      conflicts: [],
      metadata: {
        complexity: "High",
        timeToImplement: "18 months",
        staffRequired: 50,
        technologyRequired: true,
      },
      color: "amber",
      icon: "Leaf",
    };

    const form = economicComponentToFormData(raw);
    expect(form.type).toBe(EconomicComponentType.RESOURCE_BASED_ECONOMY);
    expect(form.name).toBe("Resource Based Economy");
    expect(form.complexity).toBe("High");
    expect(form.staffRequired).toBe(50);
    expect(form.technologyRequired).toBe(true);
    expect(form.synergies).toEqual([EconomicComponentType.FREE_MARKET_SYSTEM]);
  });

  test("filterEconomicComponents filters by search term, category, and complexity", () => {
    const list = [
      {
        id: "1",
        name: "Free Market System",
        description: "Open markets",
        category: "Economic Model",
        metadata: { complexity: "Low" },
      },
      {
        id: "2",
        name: "Agriculture Led",
        description: "Farming focus",
        category: "Sector Focus",
        metadata: { complexity: "Medium" },
      },
      {
        id: "3",
        name: "High Tech",
        description: "Silicon innovation",
        category: "Sector Focus",
        metadata: { complexity: "High" },
      },
    ];

    expect(filterEconomicComponents(list, "", "all", "all")).toHaveLength(3);
    expect(filterEconomicComponents(list, "farming", "all", "all")).toHaveLength(1);
    expect(filterEconomicComponents(list, "", "Sector Focus", "all")).toHaveLength(2);
    expect(filterEconomicComponents(list, "", "all", "High")).toHaveLength(1);
    expect(filterEconomicComponents(list, "free", "Economic Model", "Low")).toHaveLength(1);
    expect(filterEconomicComponents(undefined, "free", "all", "all")).toEqual([]);
  });
});

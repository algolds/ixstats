import {
  defaultGovernmentComponentFormData,
  governmentComponentToFormData,
  filterGovernmentComponents,
  COMPONENT_CATEGORIES,
  COMPLEXITY_LEVELS,
} from "~/lib/admin/government-component-transforms";
import { ComponentType } from "~/lib/enums";

describe("government-component-transforms", () => {
  test("defaultGovernmentComponentFormData produces valid initial defaults", () => {
    const data = defaultGovernmentComponentFormData();
    expect(data.type).toBe(ComponentType.CENTRALIZED_POWER);
    expect(data.category).toBe("Power Distribution");
    expect(data.effectiveness).toBe(75);
    expect(data.implementationCost).toBe(500000);
    expect(data.maintenanceCost).toBe(100000);
    expect(data.requiredCapacity).toBe(75);
    expect(data.complexity).toBe("Medium");
  });

  test("governmentComponentToFormData maps record with nullish safety", () => {
    const raw = {
      id: "gov-1",
      type: ComponentType.FEDERAL_SYSTEM,
      name: "Federal System",
      description: "Division of powers",
      category: "Power Distribution",
      effectiveness: 80,
      implementationCost: 750000,
      maintenanceCost: 150000,
      requiredCapacity: 80,
      synergies: [ComponentType.DEMOCRATIC_PROCESS],
      conflicts: [],
      metadata: {
        complexity: "High",
        timeToImplement: "24 months",
        staffRequired: 100,
        technologyRequired: false,
      },
      color: "purple",
      icon: "Building2",
    };

    const form = governmentComponentToFormData(raw);
    expect(form.type).toBe(ComponentType.FEDERAL_SYSTEM);
    expect(form.name).toBe("Federal System");
    expect(form.complexity).toBe("High");
    expect(form.staffRequired).toBe(100);
    expect(form.technologyRequired).toBe(false);
    expect(form.synergies).toEqual([ComponentType.DEMOCRATIC_PROCESS]);
  });

  test("filterGovernmentComponents filters by search term, category, and complexity", () => {
    const list = [
      {
        id: "1",
        name: "Centralized Power",
        description: "Unitary authority",
        category: "Power Distribution",
        metadata: { complexity: "High" },
      },
      {
        id: "2",
        name: "Democratic Process",
        description: "Voting and elections",
        category: "Decision Process",
        metadata: { complexity: "Medium" },
      },
    ];

    expect(filterGovernmentComponents(list, "", "all", "all")).toHaveLength(2);
    expect(filterGovernmentComponents(list, "voting", "all", "all")).toHaveLength(1);
    expect(filterGovernmentComponents(list, "", "Power Distribution", "all")).toHaveLength(1);
    expect(filterGovernmentComponents(list, "", "all", "High")).toHaveLength(1);
    expect(filterGovernmentComponents(undefined, "voting", "all", "all")).toEqual([]);
  });
});

import {
  defaultScenarioFormData,
  defaultChoiceFormData,
  calculateScenarioExpiry,
  extractTagsFromScenario,
  scenarioToFormData,
  scenarioToCloneFormData,
  filterDiplomaticScenarios,
  SCENARIO_TYPES,
  RELATIONSHIP_LEVELS,
  DIFFICULTY_LEVELS,
  TIME_FRAMES,
} from "~/lib/admin/diplomatic-scenario-transforms";

describe("diplomatic-scenario-transforms", () => {
  test("defaultScenarioFormData produces valid initial defaults", () => {
    const data = defaultScenarioFormData();
    expect(data.type).toBe("diplomatic_incident");
    expect(data.relationshipState).toBe("neutral");
    expect(data.timeFrame).toBe("strategic");
    expect(data.difficulty).toBe("moderate");
    expect(data.status).toBe("active");
  });

  test("calculateScenarioExpiry computes correct offset date", () => {
    const baseDate = new Date("2026-08-20T00:00:00Z");
    const urgent = calculateScenarioExpiry("urgent", baseDate);
    expect(urgent.toISOString()).toBe("2026-08-23T00:00:00.000Z");

    const strategic = calculateScenarioExpiry("strategic", baseDate);
    expect(strategic.toISOString()).toBe("2026-09-03T00:00:00.000Z");
  });

  test("scenarioToFormData and extractTagsFromScenario handle nullish tags", () => {
    const raw = {
      id: "scen-1",
      type: "border_dispute",
      title: "Island Conflict",
      narrative: "Tensions rise over island",
      relationshipState: "tense",
      relationshipStrength: 30,
      tags: ["border_dispute", "critical", "urgent"],
      responseOptions: [{ id: "opt-1", label: "Send fleet" }],
      country1Id: "c1",
      country2Id: "c2",
    };

    const { formData, responseOptions } = scenarioToFormData(raw);
    expect(formData.title).toBe("Island Conflict");
    expect(formData.difficulty).toBe("critical");
    expect(formData.timeFrame).toBe("urgent");
    expect(responseOptions).toHaveLength(1);
  });

  test("scenarioToCloneFormData appends (Copy) and re-keys choice IDs", () => {
    const raw = {
      id: "scen-1",
      title: "Treaty Negotiation",
      tags: ["strategic", "challenging"],
      responseOptions: [{ id: "opt-1", label: "Sign" }],
    };

    const { formData, responseOptions } = scenarioToCloneFormData(
      raw,
      (id) => `${id}_test_clone`
    );

    expect(formData.title).toBe("Treaty Negotiation (Copy)");
    expect(formData.status).toBe("active");
    expect(responseOptions[0]?.id).toBe("opt-1_test_clone");
  });

  test("filterDiplomaticScenarios filters by relationship, difficulty, and timeframe", () => {
    const list = [
      {
        id: "1",
        relationshipState: "hostile",
        tags: ["critical", "urgent"],
      },
      {
        id: "2",
        relationshipState: "friendly",
        tags: ["moderate", "strategic"],
      },
    ];

    expect(filterDiplomaticScenarios(list, ["hostile"], [], [])).toHaveLength(1);
    expect(filterDiplomaticScenarios(list, [], ["critical"], [])).toHaveLength(1);
    expect(filterDiplomaticScenarios(list, [], [], ["strategic"])).toHaveLength(1);
    expect(filterDiplomaticScenarios(list, ["friendly"], ["moderate"], ["strategic"])).toHaveLength(1);
    expect(filterDiplomaticScenarios(undefined, [], [], [])).toEqual([]);
  });
});

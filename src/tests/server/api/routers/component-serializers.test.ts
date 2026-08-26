import { transformDatabaseComponent as transformEconomicComponent } from "~/server/api/routers/economicComponents/serializer";
import { transformDatabaseComponent as transformGovernmentComponent } from "~/server/api/routers/governmentComponents/serializer";
import { EconomicComponentType, ComponentType } from "@prisma/client";

describe("component-serializers zero values and presence semantics", () => {
  describe("economic component serializer", () => {
    it("preserves effectiveness 0 when effectivenessScore is nonzero", () => {
      const dbComp = {
        id: "econ_1",
        componentType: EconomicComponentType.MIXED_ECONOMY,
        name: "Mixed Market",
        effectiveness: 0,
        effectivenessScore: 62,
      };

      const result = transformEconomicComponent(dbComp);
      expect(result.effectiveness).toBe(0);
    });

    it("falls back to effectivenessScore 0 when effectiveness is null/undefined", () => {
      const dbComp = {
        id: "econ_1",
        componentType: EconomicComponentType.MIXED_ECONOMY,
        name: "Mixed Market",
        effectiveness: null,
        effectivenessScore: 0,
      };

      const result = transformEconomicComponent(dbComp);
      expect(result.effectiveness).toBe(0);
    });

    it("falls back to default 75 when both effectiveness and effectivenessScore are nullish", () => {
      const dbComp = {
        id: "econ_1",
        componentType: EconomicComponentType.MIXED_ECONOMY,
        name: "Mixed Market",
        effectiveness: null,
        effectivenessScore: null,
      };

      const result = transformEconomicComponent(dbComp);
      expect(result.effectiveness).toBe(75);
    });

    it("preserves numeric 0 for implementationCost, maintenanceCost, and requiredCapacity", () => {
      const dbComp = {
        id: "econ_2",
        componentType: EconomicComponentType.FREE_MARKET_SYSTEM,
        name: "Free Market",
        implementationCost: 0,
        maintenanceCost: 0,
        requiredCapacity: 0,
        usageCount: 0,
        isActive: false,
      };

      const result = transformEconomicComponent(dbComp);
      expect(result.implementationCost).toBe(0);
      expect(result.maintenanceCost).toBe(0);
      expect(result.requiredCapacity).toBe(0);
      expect(result.usageCount).toBe(0);
      expect(result.isActive).toBe(false);
    });

    it("applies standard defaults when costs and capacity are nullish", () => {
      const dbComp = {
        id: "econ_3",
        componentType: EconomicComponentType.PLANNED_ECONOMY,
        name: "Command Economy",
        implementationCost: null,
        maintenanceCost: undefined,
        requiredCapacity: null,
      };

      const result = transformEconomicComponent(dbComp);
      expect(result.implementationCost).toBe(100000);
      expect(result.maintenanceCost).toBe(50000);
      expect(result.requiredCapacity).toBe(75);
    });

    it("handles valid JSON fields and falls back gracefully on malformed JSON", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const dbComp = {
        id: "econ_4",
        componentType: EconomicComponentType.CIRCULAR_ECONOMY,
        name: "Circular Economy",
        synergies: JSON.stringify([EconomicComponentType.MIXED_ECONOMY]),
        conflicts: "invalid-json-string{",
      };

      const result = transformEconomicComponent(dbComp);
      expect(result.synergies).toEqual([EconomicComponentType.MIXED_ECONOMY]);
      expect(result.conflicts).toEqual([]);
      warnSpy.mockRestore();
    });
  });

  describe("government component serializer", () => {
    it("preserves numeric 0 for effectiveness, capacity, and costs", () => {
      const dbComp = {
        id: "gov_1",
        componentType: ComponentType.DEMOCRATIC_PROCESS,
        name: "Democratic Process",
        effectiveness: 0,
        requiredCapacity: 0,
        implementationCost: 0,
        maintenanceCost: 0,
        usageCount: 0,
        isActive: false,
      };

      const result = transformGovernmentComponent(dbComp);
      expect(result.effectiveness).toBe(0);
      expect(result.requiredCapacity).toBe(0);
      expect(result.implementationCost).toBe(0);
      expect(result.maintenanceCost).toBe(0);
      expect(result.usageCount).toBe(0);
      expect(result.isActive).toBe(false);
    });

    it("applies standard defaults when numeric values are nullish", () => {
      const dbComp = {
        id: "gov_2",
        componentType: ComponentType.UNITARY_SYSTEM,
        name: "Unitary System",
        effectiveness: null,
        requiredCapacity: undefined,
        implementationCost: null,
        maintenanceCost: null,
      };

      const result = transformGovernmentComponent(dbComp);
      expect(result.effectiveness).toBe(50);
      expect(result.requiredCapacity).toBe(50);
      expect(result.implementationCost).toBe(0);
      expect(result.maintenanceCost).toBe(0);
    });

    it("handles valid and malformed JSON in government components", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const dbComp = {
        id: "gov_3",
        componentType: ComponentType.FEDERAL_SYSTEM,
        name: "Federal System",
        synergies: JSON.stringify([ComponentType.UNITARY_SYSTEM]),
        conflicts: "invalid-json-string{",
      };

      const result = transformGovernmentComponent(dbComp);
      expect(result.synergies).toEqual([ComponentType.UNITARY_SYSTEM]);
      expect(result.conflicts).toEqual([]);
      warnSpy.mockRestore();
    });
  });
});

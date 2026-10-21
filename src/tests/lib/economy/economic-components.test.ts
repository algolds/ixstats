import { describe, it, expect } from "@jest/globals";
import {
  ATOMIC_ECONOMIC_COMPONENTS,
  COMPONENT_CATEGORIES,
  ECONOMIC_TEMPLATES,
  EconomicCategory,
  EconomicComponentType
} from "~/lib/economy/atomic-data";
import { builtinArchetypes } from "~/lib/economy/archetypes/seed";

const ALL_TYPES = Object.values(EconomicComponentType);
const definitionOf = (type: EconomicComponentType) => ATOMIC_ECONOMIC_COMPONENTS[type];
describe("economic component definitions", () => {
  it("defines every EconomicComponentType", () => {
    const missing = ALL_TYPES.filter((type) => !definitionOf(type));
    expect(missing).toEqual([]);
    expect(Object.keys(ATOMIC_ECONOMIC_COMPONENTS)).toHaveLength(ALL_TYPES.length);
  });

  it("keys each definition by its own type with a matching id", () => {
    for (const type of ALL_TYPES) {
      const def = definitionOf(type)!;
      expect(def.type).toBe(type);
      expect(def.id).toBe(type.toLowerCase());
    }
  });

  it("keeps effects within the ranges the existing components use", () => {
    for (const type of ALL_TYPES) {
      const def = definitionOf(type)!;
      expect(def.effectiveness).toBeGreaterThanOrEqual(50);
      expect(def.effectiveness).toBeLessThanOrEqual(100);
      expect(def.taxImpact.revenueEfficiency).toBeCloseTo(def.effectiveness / 100, 5);
      expect(def.taxImpact.optimalCorporateRate).toBeGreaterThan(0);
      expect(def.taxImpact.optimalCorporateRate).toBeLessThan(50);
      expect(def.taxImpact.optimalIncomeRate).toBeGreaterThan(0);
      expect(def.taxImpact.optimalIncomeRate).toBeLessThan(50);
      expect(Math.abs(def.employmentImpact.unemploymentModifier)).toBeLessThanOrEqual(3);
      for (const value of [
        def.employmentImpact.participationModifier,
        def.employmentImpact.wageGrowthModifier,
        ...Object.values(def.demographicImpact),
        ...Object.values(def.sectorImpact),
      ]) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(3);
      }
      expect(def.maintenanceCost).toBeLessThan(def.implementationCost);
      expect(def.requiredCapacity).toBeGreaterThan(0);
      expect(def.requiredCapacity).toBeLessThanOrEqual(100);
      expect(Object.values(EconomicCategory)).toContain(def.category);
      expect(def.icon).toBeTruthy();
    }
  });
});
describe("economic component synergies and conflicts", () => {
  it("only reference defined components, never themselves", () => {
    for (const type of ALL_TYPES) {
      const def = definitionOf(type)!;
      for (const other of [...def.synergies, ...def.conflicts]) {
        expect({ type, other, defined: Boolean(definitionOf(other)) }).toMatchObject({
          defined: true,
        });
        expect(other).not.toBe(type);
      }
      expect(new Set(def.synergies).size).toBe(def.synergies.length);
      expect(new Set(def.conflicts).size).toBe(def.conflicts.length);
    }
  });

  it("are symmetric", () => {
    const oneSided: string[] = [];
    for (const type of ALL_TYPES) {
      const def = definitionOf(type)!;
      for (const other of def.synergies) {
        if (!definitionOf(other)?.synergies.includes(type)) {
          oneSided.push(`${type} synergy ${other}`);
        }
      }
      for (const other of def.conflicts) {
        if (!definitionOf(other)?.conflicts.includes(type)) {
          oneSided.push(`${type} conflict ${other}`);
        }
      }
    }
    expect(oneSided).toEqual([]);
  });

  it("never list a pair as both a synergy and a conflict", () => {
    for (const type of ALL_TYPES) {
      const def = definitionOf(type)!;
      const overlap = def.synergies.filter((other) => def.conflicts.includes(other));
      expect({ type, overlap }).toEqual({ type, overlap: [] });
    }
  });
});

describe("COMPONENT_CATEGORIES", () => {
  it("lists every defined component exactly once, under its own category", () => {
    const seen = new Map<EconomicComponentType, string>();
    for (const [key, group] of Object.entries(COMPONENT_CATEGORIES)) {
      expect(group.name).toBe(key);
      expect(Object.values(EconomicCategory)).toContain(key);
      for (const type of group.components) {
        const def = definitionOf(type);
        expect({ type, defined: Boolean(def) }).toEqual({ type, defined: true });
        expect({ type, listedTwice: seen.has(type) }).toEqual({ type, listedTwice: false });
        expect({ type, category: def?.category }).toEqual({ type, category: key });
        seen.set(type, key);
      }
    }
    expect([...seen.keys()].sort()).toEqual([...ALL_TYPES].sort());
  });
});

describe("economic component references", () => {
  it("resolves every economic template component", () => {
    for (const template of ECONOMIC_TEMPLATES) {
      for (const type of template.components) {
        expect({ template: template.id, type, defined: Boolean(definitionOf(type)) }).toEqual({
          template: template.id,
          type,
          defined: true,
        });
      }
    }
  });

  it("resolves every archetype economic component", () => {
    const archetypes = builtinArchetypes();
    expect(archetypes).toHaveLength(20);
    for (const archetype of archetypes) {
      expect(archetype.economicComponents.length).toBeGreaterThan(0);
      for (const type of archetype.economicComponents) {
        expect({ archetype: archetype.id, type, defined: Boolean(definitionOf(type)) }).toEqual({
          archetype: archetype.id,
          type,
          defined: true,
        });
      }
    }
  });
});

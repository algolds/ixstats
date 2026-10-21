import { describe, it, expect } from "@jest/globals";
import {
  ATOMIC_ECONOMIC_COMPONENTS,
  ECONOMIC_TEMPLATES,
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
});
describe("economic component synergies and conflicts", () => {
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

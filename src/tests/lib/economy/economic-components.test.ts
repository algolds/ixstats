import { describe, it, expect } from "@jest/globals";
import {
  ATOMIC_ECONOMIC_COMPONENTS,
  COMPONENT_CATEGORIES,
  ECONOMIC_COMPONENT_DISPLAY,
  ECONOMIC_TEMPLATES,
  EconomicCategory,
  EconomicComponentType,
  formatComponentName,
  getEconomicComponentEffect,
} from "~/lib/economy/atomic-data";
import { builtinArchetypes } from "~/lib/economy/archetypes/seed";

const ALL_TYPES = Object.values(EconomicComponentType);
const definitionOf = (type: EconomicComponentType) => ATOMIC_ECONOMIC_COMPONENTS[type];

/** The old enum-derived label ("RD_INVESTMENT" -> "Rd Investment"). */
const enumTitleCase = (type: string) =>
  type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

/** Facet copy rules: no em or en dashes, no exclamation marks, no emoji. */
function copyProblems(text: string): string[] {
  const problems: string[] = [];
  if (/[—–]/.test(text)) problems.push("dash");
  if (text.includes("!")) problems.push("exclamation mark");
  if (/\p{Extended_Pictographic}/u.test(text)) problems.push("emoji");
  if (text !== text.trim() || /\s{2,}/.test(text)) problems.push("whitespace");
  return problems;
}

/** Sentence case: a capital first letter and no other capitalised words. */
function isSentenceCase(text: string): boolean {
  const words = text.split(/\s+/);
  if (!/^[A-Z]/.test(words[0] ?? "")) return false;
  return words.slice(1).every((word) => !/^[A-Z]/.test(word));
}

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

describe("economic component display copy", () => {
  it("has a hand-written name and effect for every type", () => {
    expect(Object.keys(ECONOMIC_COMPONENT_DISPLAY).sort()).toEqual([...ALL_TYPES].sort());
    for (const type of ALL_TYPES) {
      const { name, effect } = ECONOMIC_COMPONENT_DISPLAY[type];
      expect(name.length).toBeGreaterThan(0);
      expect(name).not.toBe(enumTitleCase(type));
      expect(name).not.toMatch(/_/);
      expect(effect.length).toBeGreaterThan(20);
    }
  });

  it("uses the written name on every definition and in formatComponentName", () => {
    for (const type of ALL_TYPES) {
      expect(definitionOf(type)!.name).toBe(ECONOMIC_COMPONENT_DISPLAY[type].name);
      expect(formatComponentName(type)).toBe(ECONOMIC_COMPONENT_DISPLAY[type].name);
      expect(getEconomicComponentEffect(type)).toBe(ECONOMIC_COMPONENT_DISPLAY[type].effect);
    }
    expect(formatComponentName(EconomicComponentType.RD_INVESTMENT)).toBe("Research funding");
  });

  it("falls back to sentence case for unknown strings", () => {
    expect(formatComponentName("SOME_LEGACY_VALUE")).toBe("Some legacy value");
    expect(getEconomicComponentEffect("SOME_LEGACY_VALUE")).toBe("");
  });

  it("follows the copy rules", () => {
    const names = new Set<string>();
    for (const type of ALL_TYPES) {
      const { name, effect } = ECONOMIC_COMPONENT_DISPLAY[type];
      expect({ type, problems: copyProblems(name) }).toEqual({ type, problems: [] });
      expect({ type, problems: copyProblems(effect) }).toEqual({ type, problems: [] });
      expect({ type, name, sentenceCase: isSentenceCase(name) }).toMatchObject({
        sentenceCase: true,
      });
      expect({ type, effect, sentenceCase: isSentenceCase(effect) }).toMatchObject({
        sentenceCase: true,
      });
      // One sentence, ending in a full stop.
      expect(effect.endsWith(".")).toBe(true);
      expect(effect.slice(0, -1)).not.toMatch(/[.?;]/);
      expect(name.endsWith(".")).toBe(false);
      names.add(name.toLowerCase());
    }
    expect(names.size).toBe(ALL_TYPES.length);
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

  it("has a group for every category", () => {
    expect(Object.keys(COMPONENT_CATEGORIES).sort()).toEqual(
      Object.values(EconomicCategory).sort()
    );
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

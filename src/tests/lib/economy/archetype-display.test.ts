import { describe, it, expect } from "@jest/globals";
import {
  ARCHETYPE_DISPLAY,
  GOVERNMENT_FORM_IDS,
  POPULATION_BANDS,
  WEALTH_BANDS,
  getArchetypeDisplay,
} from "~/lib/economy/archetypes/display";
import { builtinArchetypes } from "~/lib/economy/archetypes/seed";

const archetypes = builtinArchetypes();

function copyProblems(text: string): string[] {
  const problems: string[] = [];
  if (/[—–]/.test(text)) problems.push("dash");
  if (text.includes("!")) problems.push("exclamation mark");
  if (/\p{Extended_Pictographic}/u.test(text)) problems.push("emoji");
  if (text !== text.trim() || /\s{2,}/.test(text)) problems.push("whitespace");
  return problems;
}

describe("archetype display copy", () => {
  it("covers exactly the 20 built-in archetypes", () => {
    expect(archetypes).toHaveLength(20);
    expect(Object.keys(ARCHETYPE_DISPLAY).sort()).toEqual(archetypes.map((a) => a.id).sort());
    for (const archetype of archetypes) {
      expect(getArchetypeDisplay(archetype.id)).toBe(
        ARCHETYPE_DISPLAY[archetype.id as keyof typeof ARCHETYPE_DISPLAY]
      );
    }
    expect(getArchetypeDisplay("custom-archetype")).toBeUndefined();
    expect(getArchetypeDisplay("toString")).toBeUndefined();
  });

  it("uses valid band and government form ids", () => {
    for (const [id, display] of Object.entries(ARCHETYPE_DISPLAY)) {
      expect({ id, band: display.typicalPopulationBand, valid: true }).toEqual({
        id,
        band: display.typicalPopulationBand,
        valid: POPULATION_BANDS.includes(display.typicalPopulationBand),
      });
      expect({ id, band: display.typicalWealthBand, valid: true }).toEqual({
        id,
        band: display.typicalWealthBand,
        valid: WEALTH_BANDS.includes(display.typicalWealthBand),
      });
      expect({ id, form: display.startingGovernmentForm, valid: true }).toEqual({
        id,
        form: display.startingGovernmentForm,
        valid: (GOVERNMENT_FORM_IDS as readonly string[]).includes(display.startingGovernmentForm),
      });
    }
  });

  it("matches well-known government forms", () => {
    expect(ARCHETYPE_DISPLAY["soviet-command"].startingGovernmentForm).toBe("one-party-state");
    expect(ARCHETYPE_DISPLAY["ottoman-empire"].startingGovernmentForm).toBe("absolute-monarchy");
    expect(ARCHETYPE_DISPLAY["venetian-republic"].startingGovernmentForm).toBe(
      "merchant-oligarchy"
    );
    expect(ARCHETYPE_DISPLAY["british-empire"].startingGovernmentForm).toBe(
      "constitutional-monarchy"
    );
    expect(["confederation", "federal-republic"]).toContain(
      ARCHETYPE_DISPLAY.swiss.startingGovernmentForm
    );
  });

  it("gives the Nordic model its plain name and inspiration line", () => {
    expect(ARCHETYPE_DISPLAY.nordic.displayName).toBe("Wealthy welfare state");
    expect(ARCHETYPE_DISPLAY.nordic.inspiration).toBe("Inspired by the Nordic model");
  });

  it("follows the copy rules", () => {
    const names = new Set<string>();
    for (const [id, display] of Object.entries(ARCHETYPE_DISPLAY)) {
      for (const text of [display.displayName, display.pitch, display.inspiration]) {
        expect({ id, text, problems: copyProblems(text) }).toEqual({ id, text, problems: [] });
      }
      // Plain names are sentence case and carry no proper nouns.
      const [first = "", ...rest] = display.displayName.split(/\s+/);
      expect({
        id,
        sentenceCase: /^[A-Z]/.test(first) && rest.every((w) => !/^[A-Z]/.test(w)),
      }).toEqual({ id, sentenceCase: true });
      expect(display.pitch).toMatch(/^[A-Z].*\.$/);
      expect(display.inspiration).toMatch(/^Inspired by \S/);
      expect(display.inspiration.endsWith(".")).toBe(false);
      names.add(display.displayName.toLowerCase());
    }
    expect(names.size).toBe(Object.keys(ARCHETYPE_DISPLAY).length);
  });
});

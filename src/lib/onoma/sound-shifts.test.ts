// src/lib/onoma/sound-shifts.test.ts
// Unit tests for Historical Sound Change & Language Evolution Engine

import {
  applySingleRule,
  applySoundShifts,
  SOUND_SHIFT_PRESETS,
  type SoundShiftEpoch,
  type SoundShiftRule,
} from "./sound-shifts";

describe("Sound Shifts Engine (applySingleRule)", () => {
  test("applies unconditional sound shift", () => {
    const rule: SoundShiftRule = { id: "1", source: "p", target: "f" };
    expect(applySingleRule("pater", rule)).toBe("fater");
    expect(applySingleRule("apple", rule)).toBe("affle");
    expect(applySingleRule("stop", rule)).toBe("stof");
  });

  test("preserves capital letter on word onset", () => {
    const rule: SoundShiftRule = { id: "1", source: "p", target: "f" };
    expect(applySingleRule("Pater", rule)).toBe("Fater");
  });

  test("ignores disabled rules", () => {
    const rule: SoundShiftRule = { id: "1", source: "p", target: "f", enabled: false };
    expect(applySingleRule("pater", rule)).toBe("pater");
  });

  test("applies environmental context rule before front vowels (_[ei])", () => {
    const rule: SoundShiftRule = {
      id: "palat",
      source: "c",
      target: "tʃ",
      context: "_[ei]",
    };
    expect(applySingleRule("centum", rule)).toBe("tʃentum");
    expect(applySingleRule("civitas", rule)).toBe("tʃivitas");
    // Should NOT apply before back vowels
    expect(applySingleRule("corpus", rule)).toBe("corpus");
    expect(applySingleRule("canis", rule)).toBe("canis");
  });

  test("applies intervocalic lenition (V_V)", () => {
    const rule: SoundShiftRule = {
      id: "lenit",
      source: "p",
      target: "b",
      context: "V_V",
    };
    expect(applySingleRule("ripa", rule)).toBe("riba");
    expect(applySingleRule("lupus", rule)).toBe("lubus");
    // Should NOT apply word-initially or word-finally
    expect(applySingleRule("pater", rule)).toBe("pater");
    expect(applySingleRule("camp", rule)).toBe("camp");
  });

  test("applies word-final apocope (_#)", () => {
    const rule: SoundShiftRule = {
      id: "apocope",
      source: "m",
      target: "",
      context: "_#",
    };
    expect(applySingleRule("aurum", rule)).toBe("auru");
    expect(applySingleRule("centum", rule)).toBe("centu");
    // Should NOT apply medial or initial m
    expect(applySingleRule("mater", rule)).toBe("mater");
    expect(applySingleRule("amicus", rule)).toBe("amicus");
  });

  test("applies word-initial shift (#_)", () => {
    const rule: SoundShiftRule = {
      id: "init",
      source: "k",
      target: "h",
      context: "#_",
    };
    expect(applySingleRule("kann", rule)).toBe("hann");
    expect(applySingleRule("aka", rule)).toBe("aka");
  });
});

describe("applySoundShifts (Chronological Multi-Epoch Pipeline)", () => {
  test("simulates Grimm's Law with step-by-step trace", () => {
    const grimmsPreset = SOUND_SHIFT_PRESETS.find((p) => p.id === "grimms-law")!;
    expect(grimmsPreset).toBeDefined();

    const results = applySoundShifts(["pater", "deka", "dʰwer"], grimmsPreset.epochs);

    expect(results).toHaveLength(3);

    // pater -> fater (Phase 1: p -> f) -> faθer (Phase 1: t -> θ)
    const paterResult = results[0]!;
    expect(paterResult.original).toBe("pater");
    expect(paterResult.final).toBe("faθer");
    expect(paterResult.steps.length).toBeGreaterThanOrEqual(2);
    expect(paterResult.steps[0]!.epochName).toContain("Phase 1");
    expect(paterResult.steps[0]!.before).toBe("pater");
    expect(paterResult.steps[0]!.after).toBe("fater");

    // deka -> teka (Phase 2: d -> t) -> teha (Phase 1: k -> h, but since Phase 1 runs first, deka -> deha -> teha)
    const dekaResult = results[1]!;
    expect(dekaResult.final).toBe("teha");

    // dʰwer -> dwer (Phase 3: dʰ -> d)
    const dhwerResult = results[2]!;
    expect(dhwerResult.final).toBe("dwer");
  });

  test("simulates Latin to Early Romance Lenition", () => {
    const latinPreset = SOUND_SHIFT_PRESETS.find((p) => p.id === "latin-to-romance")!;
    expect(latinPreset).toBeDefined();

    const results = applySoundShifts(["civitas", "ripa", "aurum"], latinPreset.epochs);

    // civitas -> tʃivitas (palatalization) -> tʃividas (intervocalic lenition)
    expect(results[0]!.final).toBe("tʃividas");
    // ripa -> riba (intervocalic lenition)
    expect(results[1]!.final).toBe("riba");
    // aurum -> auru (terminal apocope)
    expect(results[2]!.final).toBe("auru");
  });

  test("handles empty inputs gracefully", () => {
    const epochs: SoundShiftEpoch[] = [];
    const results = applySoundShifts([], epochs);
    expect(results).toEqual([]);
  });
});

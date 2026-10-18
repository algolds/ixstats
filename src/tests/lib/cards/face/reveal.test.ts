/** @jest-environment node */
import {
  nextFaceDown,
  rarestFace,
  revealBeatMs,
  revealFeedbackFor,
  revealShines,
} from "~/lib/cards/face/reveal";

describe("reveal pacing", () => {
  it("gives rarer cards a longer beat", () => {
    expect(revealBeatMs("COMMON")).toBe(250);
    expect(revealBeatMs("RARE")).toBeGreaterThan(revealBeatMs("UNCOMMON"));
    expect(revealBeatMs("EPIC")).toBeGreaterThan(revealBeatMs("ULTRA_RARE"));
    expect(revealBeatMs("LEGENDARY")).toBe(1000);
  });

  it("plays the reveal sound from Rare and buzzes from Epic", () => {
    expect(revealFeedbackFor("UNCOMMON")).toEqual({ sound: false, haptic: false });
    expect(revealFeedbackFor("RARE")).toEqual({ sound: true, haptic: false });
    expect(revealFeedbackFor("ULTRA_RARE")).toEqual({ sound: true, haptic: false });
    expect(revealFeedbackFor("EPIC")).toEqual({ sound: true, haptic: true });
    expect(revealFeedbackFor("LEGENDARY")).toEqual({ sound: true, haptic: true });
  });

  it("lets Rare and rarer pulls tilt and shine in the summary", () => {
    expect(revealShines("COMMON")).toBe(false);
    expect(revealShines("UNCOMMON")).toBe(false);
    for (const rarity of ["RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"] as const) {
      expect([rarity, revealShines(rarity)]).toEqual([rarity, true]);
    }
  });

  it("finds the next card still face down, wrapping, or -1", () => {
    expect(nextFaceDown([false, false], -1)).toBe(0);
    expect(nextFaceDown([true, false, false], 0)).toBe(1);
    expect(nextFaceDown([false, true, true], 1)).toBe(0);
    expect(nextFaceDown([true, true], 0)).toBe(-1);
    expect(nextFaceDown([], -1)).toBe(-1);
  });

  it("names the rarest card, the first of a tie, or none", () => {
    const pulls = [
      { id: "a", rarity: "RARE" as const },
      { id: "b", rarity: "EPIC" as const },
      { id: "c", rarity: "EPIC" as const },
      { id: "d", rarity: "ULTRA_RARE" as const },
    ];
    expect(rarestFace(pulls)?.id).toBe("b");
    expect(rarestFace([])).toBeNull();
  });
});

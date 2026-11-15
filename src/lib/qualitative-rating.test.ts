import { getQualitativeRating, levelWord, relationStrengthWord } from "./qualitative-rating";

it("rates a health score in words, never a percentage", () => {
  expect([100, 80, 79, 65, 45, 30, 29, 0].map((s) => getQualitativeRating(s).label)).toEqual([
    "Optimal",
    "Optimal",
    "Strong",
    "Strong",
    "Stable",
    "Moderate",
    "Vulnerable",
    "Vulnerable",
  ]);
  expect(getQualitativeRating(10).color).toBe("text-destructive");
});

it("bands a relationship's strength and a level in five even steps", () => {
  expect([100, 85, 60, 59, 40, 20, 19, 0].map(relationStrengthWord)).toEqual([
    "Very strong",
    "Very strong",
    "Strong",
    "Steady",
    "Steady",
    "Weak",
    "Fragile",
    "Fragile",
  ]);
  expect([95, 70, 50, 30, 5].map(levelWord)).toEqual([
    "Very high",
    "High",
    "Moderate",
    "Low",
    "Very low",
  ]);
});

it("clamps scores outside 0 to 100", () => {
  expect(relationStrengthWord(140)).toBe("Very strong");
  expect(levelWord(-5)).toBe("Very low");
});

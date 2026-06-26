import { trainLM, perplexity, naturalnessScore } from "./perplexity";

const ROMAN = [
  "Marcus",
  "Lucius",
  "Gaius",
  "Julius",
  "Tiberius",
  "Claudius",
  "Verona",
  "Roma",
  "Carthago",
  "Ravenna",
  "Mediolanum",
  "Aquileia",
  "Capua",
  "Brundisium",
  "Tarentum",
];

describe("perplexity scorer", () => {
  const lm = trainLM(ROMAN, 3);

  test("in-style names are less perplexing than gibberish", () => {
    expect(perplexity("Marcellus", lm)).toBeLessThan(perplexity("Xqzkbwth", lm));
  });

  test("naturalness is higher for in-style than out-of-style", () => {
    const inStyle = naturalnessScore("Tiberius", lm);
    const gibberish = naturalnessScore("Xqzkbwth", lm);
    expect(inStyle).toBeGreaterThan(gibberish);
    expect(inStyle).toBeGreaterThanOrEqual(0);
    expect(inStyle).toBeLessThanOrEqual(100);
  });

  test("empty input and empty model are safe", () => {
    expect(naturalnessScore("", lm)).toBe(0);
    expect(naturalnessScore("anything", trainLM([], 3))).toBe(0);
  });
});

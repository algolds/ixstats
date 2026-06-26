// src/lib/onoma/markov-chain.test.ts
import { MarkovChain } from "./markov-chain";

describe("MarkovChain", () => {
  let chain: MarkovChain;

  beforeEach(() => {
    chain = new MarkovChain(2); // Use order 2 for testing
  });

  test("should capitalize words correctly", () => {
    expect(MarkovChain.capitalize("roma")).toBe("Roma");
    expect(MarkovChain.capitalize("le-grand")).toBe("Le-Grand");
    expect(MarkovChain.capitalize("o'connor")).toBe("O'Connor");
  });

  test("should detect duplicates (exact match against training words)", () => {
    chain.addWord("Roma");
    expect(chain.isDuplicate("roma")).toBe(true); // case-insensitive exact match
    expect(chain.isDuplicate("rom")).toBe(false); // substrings are not duplicates
    expect(chain.isDuplicate("xyz")).toBe(false);
  });

  test("should generate names matching constraints", () => {
    // Train with some Roman names
    chain.addWords(["Roma", "Mediolanum", "Carthago", "Ravenna", "Verona"]);

    const name = chain.generate({
      minLength: 4,
      maxLength: 15,
      allowDuplicates: true,
    });

    expect(name).not.toBeNull();
    expect(name!.length).toBeGreaterThanOrEqual(4);
    expect(name!.length).toBeLessThanOrEqual(15);
  });

  test("should respect startsWith and endsWith constraints", () => {
    chain.addWords(["Constantinus", "Constantia", "Constantius"]);

    const name = chain.generate({
      startsWith: "Con",
      endsWith: "us",
      allowDuplicates: true,
      maxAttempts: 200,
    });

    expect(name).not.toBeNull();
    expect(name!.startsWith("Con")).toBe(true);
    expect(name!.endsWith("us")).toBe(true);
  });

  test("should handle empty chain gracefully", () => {
    const emptyChain = new MarkovChain();
    expect(emptyChain.generate()).toBeNull();
  });

  test("should split words into syllables correctly using tokenizeIntoSyllables", () => {
    const { tokenizeIntoSyllables } = require("./markov-chain");
    expect(tokenizeIntoSyllables("Heidelberg")).toEqual(["Hei", "del", "berg"]);
    expect(tokenizeIntoSyllables("Alexandria")).toEqual(["A", "le", "xand", "ria"]);
    expect(tokenizeIntoSyllables("Constantia")).toEqual(["Cons", "tan", "tia"]);
    expect(tokenizeIntoSyllables("Uppsala")).toEqual(["Upp", "sa", "la"]);
  });

  test("should generate names in syllable mode", () => {
    const syllableChain = new MarkovChain(1, "syllable");
    syllableChain.addWords(["Uppsala", "Heidelberg", "Alexandria", "Constantia"]);

    const name = syllableChain.generate({
      minLength: 4,
      maxLength: 15,
      allowDuplicates: true,
    });
    expect(name).not.toBeNull();
    expect(name!.length).toBeGreaterThanOrEqual(4);
  });

  test("should perform backoff when constraints are too strict for higher order", () => {
    const backoffChain = new MarkovChain(3, "character");
    // Train with very limited data so order 3 has strict transitions
    backoffChain.addWords(["Roma", "Rosa"]);

    // If order 3 is used, "starts with R and ends with a" will work.
    // Let's ask for "starts with R and ends with o" -> which is not possible in "Roma" or "Rosa" at order 3
    // because "oma" or "osa" both end in "a".
    // But at order 1, R -> o -> m -> o could happen, or backoff can transition.
    // Let's train "Como" as well to add 'o' transitions.
    backoffChain.addWords(["Como"]);

    const name = backoffChain.generate({
      startsWith: "R",
      endsWith: "o",
      allowDuplicates: true,
      maxAttempts: 200,
    });

    // Should successfully generate a name like "Romo" or "Roso" by backing off to order 1 or 2
    expect(name).not.toBeNull();
    expect(name!.startsWith("R")).toBe(true);
    expect(name!.endsWith("o")).toBe(true);
  });

  test("should reject unpronounceable/invalid candidates via phonotactic safeguards", () => {
    const cleanChain = new MarkovChain(1);
    // Add words that could trigger safeguards if matched randomly
    cleanChain.addWords(["R---a", "Roaaao", "Rbbbbba"]);

    const name = cleanChain.generate({
      minLength: 3,
      allowDuplicates: true,
      maxAttempts: 10,
    });

    // It should not generate anything with triple letters or double hyphens
    if (name) {
      expect(name).not.toContain("---");
      expect(name).not.toContain("aaa");
      expect(name).not.toContain("bbbbb");
    }
  });
});

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

  describe("getTransitions", () => {
    test("should retrieve transitions for empty prefix (starts) in character mode", () => {
      const charChain = new MarkovChain(2, "character");
      charChain.addWords(["Ab", "Ac"]);

      const transitions = charChain.getTransitions("");
      // "ab" and "ac" are lowercase.
      // Starts should transition to "a" with 100% probability (count 2)
      expect(transitions).toHaveLength(1);
      expect(transitions[0]).toEqual({
        token: "a",
        count: 2,
        probability: 1.0,
      });
    });

    test("should retrieve correct transition probabilities in character mode", () => {
      const charChain = new MarkovChain(2, "character");
      charChain.addWords(["Ab", "Ac", "Ad"]); // "a" -> "b", "c", "d"

      const transitions = charChain.getTransitions("a");
      // "a" should transition to "b", "c", "d" with 1/3 probability each
      expect(transitions).toHaveLength(3);
      expect(transitions).toContainEqual({ token: "b", count: 1, probability: 1/3 });
      expect(transitions).toContainEqual({ token: "c", count: 1, probability: 1/3 });
      expect(transitions).toContainEqual({ token: "d", count: 1, probability: 1/3 });
    });

    test("should retrieve transitions in syllable mode", () => {
      const syllableChain = new MarkovChain(2, "syllable");
      // "Uppsala" splits to ["Upp", "sa", "la"]
      // "Constantia" splits to ["Cons", "tan", "tia"]
      syllableChain.addWords(["Uppsala", "Constantia"]);

      const starts = syllableChain.getTransitions("");
      expect(starts).toHaveLength(2);
      expect(starts.map(t => t.token)).toContain("upp");
      expect(starts.map(t => t.token)).toContain("cons");

      const transitions = syllableChain.getTransitions("upp");
      expect(transitions).toHaveLength(1);
      expect(transitions[0]).toEqual({
        token: "sa",
        count: 1,
        probability: 1.0,
      });
    });

    test("should return empty array for unknown prefix", () => {
      const charChain = new MarkovChain(2, "character");
      charChain.addWord("abc");

      const transitions = charChain.getTransitions("x");
      expect(transitions).toEqual([]);
    });

    test("should handle end transitions (token is null)", () => {
      const charChain = new MarkovChain(2, "character");
      charChain.addWord("a"); // "a" -> null

      const transitions = charChain.getTransitions("a");
      expect(transitions).toHaveLength(1);
      expect(transitions[0]).toEqual({
        token: null,
        count: 1,
        probability: 1.0,
      });
    });
  });
});

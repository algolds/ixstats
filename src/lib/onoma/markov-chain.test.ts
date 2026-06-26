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

  test("should detect duplicates (suffix trie matches substrings)", () => {
    chain.addWord("Roma");
    expect(chain.isDuplicate("roma")).toBe(true);
    expect(chain.isDuplicate("rom")).toBe(true); // 'rom' is a substring of 'Roma'
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
});

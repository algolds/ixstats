// src/lib/onoma/markov-chain.ts
// Onoma Lab — Markov Chain Engine
// Ported from original markovChainGenerator.js, rewritten in TypeScript.

import { GenerateOptions } from "./types";

export class MarkovNode {
  character: string;
  neighbors: (MarkovNode | null)[];

  constructor(char: string) {
    this.character = char;
    this.neighbors = [];
  }
}

export class MarkovChain {
  private order = 3;
  // Exact training words (lowercased) for dedup. A Set is O(1) and O(n) memory;
  // the old suffix-trie rejected any substring of any training word, which both
  // exploded memory on large corpora and over-rejected plausible names.
  private words = new Set<string>();
  private start = new MarkovNode("");
  private map: Record<string, MarkovNode> = {};

  constructor(order = 3) {
    this.order = order;
  }

  /**
   * Capitalizes a string, matching original word boundaries and accents.
   */
  public static capitalize(str: string): string {
    if (!str) return "";
    let capitalized = str.charAt(0).toUpperCase() + str.slice(1);
    if (capitalized.length === 1) {
      return capitalized;
    }

    // Capitalize letters following special non-alphabetic chars
    // (like space, hyphens, apostrophes)
    for (let i = 1; i < capitalized.length; i++) {
      const prevChar = capitalized.charAt(i - 1);
      const isWordChar = /[a-zÆÐƎƏƐƔĲŊŒẞÞǷȜæðǝəɛɣĳŋœĸſßþƿȝĄƁÇĐƊĘĦĮƘŁØƠŞȘŢȚŦŲƯY̨Ƴąɓçđɗęħįƙłøơşșţțŧųưy̨ƴÁÀÂÄǍĂĀÃÅǺĄÆǼǢƁĆĊĈČÇĎḌĐƊÐÉÈĖÊËĚĔĒĘẸƎƏƐĠĜǦĞĢƔáàâäǎăāãåǻąæǽǣɓćċĉčçďḍđɗðéèėêëěĕēęẹǝəɛġĝǧğģɣĤḤĦIÍÌİÎÏǏĬĪĨĮỊĲĴĶƘĹĻŁĽĿʼNŃN̈ŇÑŅŊÓÒÔÖǑŎŌÕŐỌØǾƠŒĥḥħıíìiîïǐĭīĩįịĳĵķƙĸĺļłľŀŉńn̈ňñņŋóòôöǒŏōõőọøǿơœŔŘŖŚŜŠŞȘṢẞŤŢṬŦÞÚÙÛÜǓŬŪŨŰŮŲỤƯẂẀŴẄǷÝỲŶŸȲỸƳŹŻŽẒŕřŗſśŝšşșṣßťţṭŧþúùûüǔŭūũűůųụưẃẁŵẅƿýỳŷÿȳỹƴźżžẓ]/i.test(prevChar);
      if (!isWordChar && capitalized.length > i) {
        capitalized =
          capitalized.slice(0, i) +
          capitalized.charAt(i).toUpperCase() +
          capitalized.slice(i + 1);
      }
    }
    return capitalized;
  }

  /**
   * Reset the Markov transition graph and duplicates trie.
   */
  public reset(): void {
    this.words = new Set<string>();
    this.start = new MarkovNode("");
    this.map = {};
  }

  /**
   * Configure the Markov look-back depth/order.
   */
  public setOrder(order: number): void {
    this.order = order;
  }

  /**
   * Add a list of words to train the Markov chain.
   */
  public addWords(words: string[]): void {
    for (const word of words) {
      if (word && word.trim()) {
        this.addWord(word.trim());
      }
    }
  }

  /**
   * Add a single word to train the Markov chain.
   */
  public addWord(word: string): void {
    const lowercaseWord = word.toLowerCase();
    this.words.add(lowercaseWord);

    let previous = this.start;
    let key = "";

    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      key += char;
      if (key.length > this.order) {
        key = key.substring(1);
      }

      let newNode = this.map[key];
      if (!newNode) {
        newNode = new MarkovNode(char);
        this.map[key] = newNode;
      }

      previous.neighbors.push(newNode);
      previous = newNode;
    }

    // Terminate sequence
    previous.neighbors.push(null);
  }

  /**
   * Check if a generated word exactly matches one of the training words.
   */
  public isDuplicate(word: string): boolean {
    return this.words.has(word.toLowerCase());
  }

  /**
   * Generate a single word using the trained Markov chain.
   */
  public generate(options: GenerateOptions = {}): string | null {
    const startWith = options.startsWith || "";
    const endWith = options.endsWith || "";
    const minLength = Math.max(
      options.minLength || 0,
      startWith.length,
      endWith.length
    );
    const maxLength = options.maxLength || -1;
    const allowDuplicates = options.allowDuplicates ?? false;
    const maxAttempts = options.maxAttempts ?? 100;
    const contains = options.contains || "";
    const excludes = options.excludes || "";

    let word = "";
    let attempts = 0;

    // Return null if start.neighbors is empty (no words loaded)
    if (this.start.neighbors.length === 0) {
      return null;
    }

    while (!word.length) {
      attempts++;
      if (attempts >= maxAttempts) {
        return null;
      }

      // Pick a random neighbor of start node
      const nextNodeIndex = Math.floor(Math.random() * this.start.neighbors.length);
      let currentNode = this.start.neighbors[nextNodeIndex];
      word = "";

      while (currentNode && (maxLength < 0 || word.length <= maxLength)) {
        word += currentNode.character;
        const nextIndex = Math.floor(Math.random() * currentNode.neighbors.length);
        currentNode = currentNode.neighbors[nextIndex];
      }

      // Validation checks
      if (
        word.substring(0, startWith.length) !== startWith ||
        word.substring(word.length - endWith.length) !== endWith ||
        (contains && word.indexOf(contains) === -1) ||
        (excludes && word.indexOf(excludes) > -1) ||
        (maxLength >= 0 && word.length > maxLength) ||
        word.length < minLength ||
        (!allowDuplicates && this.isDuplicate(word))
      ) {
        word = "";
      }
    }

    return MarkovChain.capitalize(word);
  }
}

// src/lib/onoma/markov-chain.ts
// Onoma Lab — Markov Chain Engine
// Ported from original markovChainGenerator.js, rewritten in TypeScript.

import { type GenerateOptions } from "./types";

// Accented/diacritic vowel class for multi-cultural support
const VOWELS_CLASS =
  "aeiouyáàâäǎăāãåǻąæǽǣéèėêëěĕēęẹǝəɛíìiîïǐĭīĩįịĳóòôöǒŏōõőọøǿơœúùûüǔŭūũűůųụưýỳŷÿȳỹƴ";

/**
 * Splits a word into syllables using a fast rule-based regex tokenizer.
 */
export function tokenizeIntoSyllables(word: string): string[] {
  const regex = new RegExp(
    `[^${VOWELS_CLASS}]*[${VOWELS_CLASS}]+(?:[^${VOWELS_CLASS}]+(?![${VOWELS_CLASS}]))?|[^${VOWELS_CLASS}]+`,
    "gi"
  );
  return word.match(regex) || [word];
}

export class MarkovNode {
  token: string;
  neighbors: (MarkovNode | null)[];

  constructor(token: string) {
    this.token = token;
    this.neighbors = [];
  }
}

export class MarkovChain {
  private order = 2;
  private mode: "character" | "syllable" = "character";
  private words = new Set<string>();

  // Storing starts and maps per order (for backoff support)
  private starts: Record<number, MarkovNode> = {};
  private maps: Record<number, Record<string, MarkovNode>> = {};

  constructor(order = 2, mode: "character" | "syllable" = "character") {
    this.order = order;
    this.mode = mode;
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
      const isWordChar =
        /[a-zÆÐƎƏƐƔĲŊŒẞÞǷȜæðǝəɛɣĳŋœĸſßþƿȝĄƁÇĐƊĘĦĮƘŁØƠŞȘŢȚŦŲƯY̨Ƴąɓçđɗęħįƙłøơşșţțŧųưy̨ƴÁÀÂÄǍĂĀÃÅǺĄÆǼǢƁĆĊĈČÇĎḌĐƊÐÉÈĖÊËĚĔĒĘẸƎƏƐĠĜǦĞĢƔáàâäǎăāãåǻąæǽǣɓćċĉčçďḍđɗðéèėêëěĕēęẹǝəɛġĝǧğģɣĤḤĦIÍÌİÎÏǏĬĪĨĮỊĲĴĶƘĹĻŁĽĿʼNŃN̈ŇÑŅŊÓÒÔÖǑŎŌÕŐỌØǾƠŒĥḥħıíìiîïǐĭīĩįịĳĵķƙĸĺļłľŀŉńn̈ňñņŋóòôöǒŏōõőọøǿơœŔŘŖŚŜŠŞȘṢẞŤŢṬŦÞÚÙÛÜǓŬŪŨŰŮŲỤƯẂẀŴẄǷÝỲŶŸȲỸƳŹŻŽẒŕřŗſśŝšşșṣßťţṭŧþúùûüǔŭūũűůųụưẃẁŵẅƿýỳŷÿȳỹƴźżžẓ]/i.test(
          prevChar
        );
      if (!isWordChar && capitalized.length > i) {
        capitalized =
          capitalized.slice(0, i) + capitalized.charAt(i).toUpperCase() + capitalized.slice(i + 1);
      }
    }
    return capitalized;
  }

  /**
   * Reset the Markov transition graph and duplicates trie.
   */
  public reset(): void {
    this.words = new Set<string>();
    this.starts = {};
    this.maps = {};
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
    if (!word || !word.trim()) return;
    const lowercaseWord = word.trim().toLowerCase();
    this.words.add(lowercaseWord);

    // Train for all orders from 1 to this.order
    for (let o = 1; o <= this.order; o++) {
      if (!this.starts[o]) {
        this.starts[o] = new MarkovNode("");
      }
      if (!this.maps[o]) {
        this.maps[o] = {};
      }

      let previous = this.starts[o];
      let tokens: string[] = [];

      if (this.mode === "character") {
        tokens = lowercaseWord.split("");
      } else {
        tokens = tokenizeIntoSyllables(lowercaseWord);
      }

      const keyTokens: string[] = [];

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        keyTokens.push(token);
        if (keyTokens.length > o) {
          keyTokens.shift();
        }
        const key = keyTokens.join("|");

        let newNode = this.maps[o][key];
        if (!newNode) {
          newNode = new MarkovNode(token);
          this.maps[o][key] = newNode;
        }

        previous.neighbors.push(newNode);
        previous = newNode;
      }

      // Terminate sequence
      previous.neighbors.push(null);
    }
  }

  /**
   * Check if a generated word exactly matches one of the training words.
   */
  public isDuplicate(word: string): boolean {
    return this.words.has(word.toLowerCase());
  }

  /**
   * Generate a single word using the trained Markov chain, applying Backoff if needed.
   */
  public generate(options: GenerateOptions = {}): string | null {
    // Try generating with the configured order first.
    // If it fails (returns null), back off to lower orders sequentially down to 1.
    for (let o = this.order; o >= 1; o--) {
      const result = this.generateAtOrder(o, options);
      if (result) {
        return result;
      }
    }
    return null;
  }

  /**
   * Generates a candidate name at a specific look-back order.
   */
  private generateAtOrder(o: number, options: GenerateOptions = {}): string | null {
    const startNode = this.starts[o];
    if (!startNode || startNode.neighbors.length === 0) {
      return null;
    }

    const startWith = options.startsWith || "";
    const endWith = options.endsWith || "";
    const minLength = Math.max(options.minLength || 0, startWith.length, endWith.length);
    const maxLength = options.maxLength || -1;
    const allowDuplicates = options.allowDuplicates ?? false;
    const maxAttempts = options.maxAttempts ?? 100;
    const contains = options.contains || "";
    const excludes = options.excludes || "";

    const vowelHarmony = options.vowelHarmony || "none";
    const maxConsonantCluster = options.maxConsonantCluster ?? 3;
    const maxVowelCluster = options.maxVowelCluster ?? 3;
    const allowDoubleLetters = options.allowDoubleLetters ?? true;
    const minSyllables = options.minSyllables || 0;
    const maxSyllables = options.maxSyllables || -1;
    const mustEndWithVowel = options.mustEndWithVowel ?? false;
    const mustEndWithConsonant = options.mustEndWithConsonant ?? false;
    const cvTemplate = options.cvTemplate || "";
    const noInitialClusters = options.noInitialClusters ?? false;
    const noFinalClusters = options.noFinalClusters ?? false;

    const startWithLower = startWith.toLowerCase();
    const endWithLower = endWith.toLowerCase();
    const containsLower = contains.toLowerCase();
    const excludesLower = excludes.toLowerCase();

    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;

      const nextNodeIndex = Math.floor(Math.random() * startNode.neighbors.length);
      let currentNode = startNode.neighbors[nextNodeIndex];
      const wordTokens: string[] = [];

      while (currentNode && (maxLength < 0 || wordTokens.join("").length <= maxLength)) {
        wordTokens.push(currentNode.token);
        const nextIndex = Math.floor(Math.random() * currentNode.neighbors.length);
        currentNode = currentNode.neighbors[nextIndex];
      }

      const candidate = wordTokens.join("");

      // Phonotactic Safeguards Check
      if (candidate.length > 0) {
        // 1. Triple identical letters (e.g. "aaa", "sss")
        if (/(.)\1\1/i.test(candidate)) continue;

        // 2. Double punctuation (e.g. "--", "''")
        if (/[-']{2,}/.test(candidate)) continue;

        // 3. Leading/trailing hyphens/apostrophes
        if (/^[-']|[-']$/.test(candidate)) continue;

        // 4. Double identical letters check (if allowDoubleLetters is false)
        if (!allowDoubleLetters && /(.)\1/i.test(candidate)) continue;

        // 5. Consonant/Vowel cluster limits (using loop-count for precision and safety)
        let consecutiveVowels = 0;
        let consecutiveConsonants = 0;
        let invalidCluster = false;

        for (const char of candidate.toLowerCase()) {
          if (VOWELS_CLASS.includes(char)) {
            consecutiveVowels++;
            consecutiveConsonants = 0;
          } else if (char >= "a" && char <= "z") {
            consecutiveConsonants++;
            consecutiveVowels = 0;
          } else {
            consecutiveVowels = 0;
            consecutiveConsonants = 0;
          }

          if (consecutiveVowels > maxVowelCluster || consecutiveConsonants > maxConsonantCluster) {
            invalidCluster = true;
            break;
          }
        }
        if (invalidCluster) continue;

        // 6. Vowel Harmony check
        if (vowelHarmony !== "none") {
          const frontVowels = "eiyäöüéèêëěēę";
          const backVowels = "aouáàâǎăāãåąóòôǒŏōõúùûǔŭūũ";

          let hasFront = false;
          let hasBack = false;

          for (const char of candidate.toLowerCase()) {
            if (frontVowels.includes(char)) hasFront = true;
            if (backVowels.includes(char)) hasBack = true;
          }

          if (vowelHarmony === "front" && hasBack) continue;
          if (vowelHarmony === "back" && hasFront) continue;
        }

        // 7. Must end with vowel/consonant checks
        if (
          mustEndWithVowel &&
          !VOWELS_CLASS.includes(candidate[candidate.length - 1].toLowerCase())
        ) {
          continue;
        }
        if (
          mustEndWithConsonant &&
          VOWELS_CLASS.includes(candidate[candidate.length - 1].toLowerCase())
        ) {
          continue;
        }

        // 8. Syllable count range
        const syllablesCount = tokenizeIntoSyllables(candidate).length;
        if (minSyllables > 0 && syllablesCount < minSyllables) {
          continue;
        }
        if (maxSyllables >= 0 && syllablesCount > maxSyllables) {
          continue;
        }

        // 9. CV template constraint
        if (cvTemplate && !matchCvTemplate(candidate, cvTemplate)) {
          continue;
        }

        // 10. Initial/Final consonant cluster restrictions
        if (noInitialClusters && startsWithCluster(candidate)) {
          continue;
        }
        if (noFinalClusters && endsWithCluster(candidate)) {
          continue;
        }
      }

      // Validation checks
      if (
        candidate.substring(0, startWithLower.length) !== startWithLower ||
        candidate.substring(candidate.length - endWithLower.length) !== endWithLower ||
        (containsLower && candidate.indexOf(containsLower) === -1) ||
        (excludesLower && candidate.indexOf(excludesLower) > -1) ||
        (maxLength >= 0 && candidate.length > maxLength) ||
        candidate.length < minLength ||
        (!allowDuplicates && this.isDuplicate(candidate))
      ) {
        continue;
      }

      // Return capitalized result
      return MarkovChain.capitalize(candidate);
    }

    return null;
  }

  /**
   * Retrieve the transition statistics for a given prefix.
   */
  public getTransitions(
    prefix: string,
    o = this.order
  ): { token: string | null; count: number; probability: number }[] {
    const lowercase = prefix.trim().toLowerCase();
    let tokens: string[] = [];

    if (this.mode === "character") {
      tokens = lowercase.split("");
    } else {
      tokens = tokenizeIntoSyllables(lowercase);
    }

    // Slice to the trailing 'o' tokens
    if (tokens.length > o) {
      tokens = tokens.slice(tokens.length - o);
    }

    const key = tokens.join("|");
    const node = key ? this.maps[o]?.[key] : this.starts[o];
    if (!node || !node.neighbors || node.neighbors.length === 0) {
      return [];
    }

    const counts = new Map<string | null, number>();
    for (const neighbor of node.neighbors) {
      const t = neighbor ? neighbor.token : null;
      counts.set(t, (counts.get(t) || 0) + 1);
    }

    const total = node.neighbors.length;
    return Array.from(counts.entries())
      .map(([token, count]) => ({
        token,
        count,
        probability: count / total,
      }))
      .sort((a, b) => b.count - a.count);
  }
}

function matchCvTemplate(word: string, template: string): boolean {
  const vowels = "aeiouyáàâäǎăāãåǻąæǽǣéèėêëěĕēęẹǝəɛíìiîïǐĭīĩįịĳóòôöǒŏōõőọøǿơœúùûüǔŭūũűůųụưýỳŷÿȳỹƴ";
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length !== template.length) return false;
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const isVowel = vowels.includes(char);
    const templateChar = template[i].toUpperCase();
    if (templateChar === "V" && !isVowel) return false;
    if (templateChar === "C" && isVowel) return false;
  }
  return true;
}

function startsWithCluster(word: string): boolean {
  const vowels = "aeiouyáàâäǎăāãåǻąæǽǣéèėêëěĕēęẹǝəɛíìiîïǐĭīĩįịĳóòôöǒŏōõőọøǿơœúùûüǔŭūũűůųụưýỳŷÿȳỹƴ";
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length < 2) return false;
  return !vowels.includes(cleaned[0]) && !vowels.includes(cleaned[1]);
}

function endsWithCluster(word: string): boolean {
  const vowels = "aeiouyáàâäǎăāãåǻąæǽǣéèėêëěĕēęẹǝəɛíìiîïǐĭīĩįịĳóòôöǒŏōõőọøǿơœúùûüǔŭūũűůųụưýỳŷÿȳỹƴ";
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length < 2) return false;
  return (
    !vowels.includes(cleaned[cleaned.length - 1]) && !vowels.includes(cleaned[cleaned.length - 2])
  );
}

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

class MarkovNode {
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
    if (!startNode || startNode.neighbors.length === 0) return null;

    const rules = resolveRules(options);
    const maxAttempts = options.maxAttempts ?? 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let currentNode = startNode.neighbors[Math.floor(Math.random() * startNode.neighbors.length)];
      const wordTokens: string[] = [];

      while (
        currentNode &&
        (rules.maxLength < 0 || wordTokens.join("").length <= rules.maxLength)
      ) {
        wordTokens.push(currentNode.token);
        currentNode =
          currentNode.neighbors[Math.floor(Math.random() * currentNode.neighbors.length)];
      }

      const candidate = wordTokens.join("");
      if (
        candidate.length > 0 &&
        PHONOTACTIC_CHECKS.some((violates) => violates(candidate, rules))
      ) {
        continue;
      }
      if (
        violatesConstraints(candidate, rules) ||
        (!rules.allowDuplicates && this.isDuplicate(candidate))
      ) {
        continue;
      }
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

type ResolvedRules = ReturnType<typeof resolveRules>;

/** The options with their defaults applied and the string filters lower-cased. */
function resolveRules(options: GenerateOptions) {
  const startWith = (options.startsWith || "").toLowerCase();
  const endWith = (options.endsWith || "").toLowerCase();
  return {
    startWith,
    endWith,
    contains: (options.contains || "").toLowerCase(),
    excludes: (options.excludes || "").toLowerCase(),
    minLength: Math.max(options.minLength || 0, startWith.length, endWith.length),
    maxLength: options.maxLength || -1,
    allowDuplicates: options.allowDuplicates ?? false,
    vowelHarmony: options.vowelHarmony || "none",
    maxConsonantCluster: options.maxConsonantCluster ?? 3,
    maxVowelCluster: options.maxVowelCluster ?? 3,
    allowDoubleLetters: options.allowDoubleLetters ?? true,
    minSyllables: options.minSyllables || 0,
    maxSyllables: options.maxSyllables || -1,
    mustEndWithVowel: options.mustEndWithVowel ?? false,
    mustEndWithConsonant: options.mustEndWithConsonant ?? false,
    cvTemplate: options.cvTemplate || "",
    noInitialClusters: options.noInitialClusters ?? false,
    noFinalClusters: options.noFinalClusters ?? false,
  };
}

const FRONT_VOWELS = "eiyäöüéèêëěēę";
const BACK_VOWELS = "aouáàâǎăāãåąóòôǒŏōõúùûǔŭūũ";

const isVowel = (char: string) => VOWELS_CLASS.includes(char);
const lettersOnly = (word: string) => word.toLowerCase().replace(/[^a-z]/g, "");

function exceedsClusterLimits(word: string, maxVowels: number, maxConsonants: number): boolean {
  let vowels = 0;
  let consonants = 0;
  for (const char of word.toLowerCase()) {
    if (isVowel(char)) {
      vowels++;
      consonants = 0;
    } else if (char >= "a" && char <= "z") {
      consonants++;
      vowels = 0;
    } else {
      vowels = 0;
      consonants = 0;
    }
    if (vowels > maxVowels || consonants > maxConsonants) return true;
  }
  return false;
}

function breaksVowelHarmony(word: string, harmony: ResolvedRules["vowelHarmony"]): boolean {
  if (harmony === "none") return false;
  const letters = [...word.toLowerCase()];
  return letters.some((char) => (harmony === "front" ? BACK_VOWELS : FRONT_VOWELS).includes(char));
}

function matchCvTemplate(word: string, template: string): boolean {
  const cleaned = lettersOnly(word);
  if (cleaned.length !== template.length) return false;
  return [...cleaned].every((char, i) => {
    const slot = template[i].toUpperCase();
    return slot === "V" ? isVowel(char) : slot === "C" ? !isVowel(char) : true;
  });
}

function startsWithCluster(word: string): boolean {
  const cleaned = lettersOnly(word);
  return cleaned.length >= 2 && !isVowel(cleaned[0]) && !isVowel(cleaned[1]);
}

function endsWithCluster(word: string): boolean {
  const cleaned = lettersOnly(word);
  return (
    cleaned.length >= 2 &&
    !isVowel(cleaned[cleaned.length - 1]) &&
    !isVowel(cleaned[cleaned.length - 2])
  );
}

/** Each check returns true when the candidate breaks a phonotactic rule and must be rejected. */
const PHONOTACTIC_CHECKS: Array<(word: string, rules: ResolvedRules) => boolean> = [
  (word) => /(.)\1\1/i.test(word),
  (word) => /[-']{2,}/.test(word),
  (word) => /^[-']|[-']$/.test(word),
  (word, rules) => !rules.allowDoubleLetters && /(.)\1/i.test(word),
  (word, rules) => exceedsClusterLimits(word, rules.maxVowelCluster, rules.maxConsonantCluster),
  (word, rules) => breaksVowelHarmony(word, rules.vowelHarmony),
  (word, rules) => rules.mustEndWithVowel && !isVowel(word[word.length - 1].toLowerCase()),
  (word, rules) => rules.mustEndWithConsonant && isVowel(word[word.length - 1].toLowerCase()),
  (word, rules) => {
    const syllables = tokenizeIntoSyllables(word).length;
    return (
      (rules.minSyllables > 0 && syllables < rules.minSyllables) ||
      (rules.maxSyllables >= 0 && syllables > rules.maxSyllables)
    );
  },
  (word, rules) => !!rules.cvTemplate && !matchCvTemplate(word, rules.cvTemplate),
  (word, rules) => rules.noInitialClusters && startsWithCluster(word),
  (word, rules) => rules.noFinalClusters && endsWithCluster(word),
];

/** Length and substring filters, checked after the phonotactic rules. */
function violatesConstraints(candidate: string, rules: ResolvedRules): boolean {
  return (
    candidate.substring(0, rules.startWith.length) !== rules.startWith ||
    candidate.substring(candidate.length - rules.endWith.length) !== rules.endWith ||
    (!!rules.contains && !candidate.includes(rules.contains)) ||
    (!!rules.excludes && candidate.includes(rules.excludes)) ||
    (rules.maxLength >= 0 && candidate.length > rules.maxLength) ||
    candidate.length < rules.minLength
  );
}

// src/lib/onoma/lexicon-analytics.ts
// Onoma Lab — Lexicon Analytics & Health Auditing Helpers

/**
 * Computes frequency of each letter (a-z) in the given words.
 * Ignores case and non-alphabetic characters.
 */
export function getLetterFrequencies(words: string[]): { letter: string; frequency: number }[] {
  const counts: Record<string, number> = {};
  let totalLetters = 0;

  for (const word of words) {
    const cleanWord = word.toLowerCase();
    for (const char of cleanWord) {
      if (char >= "a" && char <= "z") {
        counts[char] = (counts[char] || 0) + 1;
        totalLetters++;
      }
    }
  }

  if (totalLetters === 0) return [];

  return Object.entries(counts)
    .map(([letter, count]) => ({
      letter,
      frequency: count / totalLetters,
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Computes n-gram frequencies for the given words.
 * E.g., for n=2 (bigrams) or n=3 (trigrams).
 * Ignores case and filters out non-alphabetic chars within the n-grams.
 */
export function getNgramFrequencies(
  words: string[],
  n: number
): { ngram: string; count: number }[] {
  if (n <= 0) return [];
  const counts: Record<string, number> = {};

  for (const word of words) {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");
    for (let i = 0; i <= cleanWord.length - n; i++) {
      const ngram = cleanWord.substring(i, i + n);
      counts[ngram] = (counts[ngram] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .map(([ngram, count]) => ({ ngram, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculates the Shannon Entropy of the letter distribution in the words list.
 * Measures phonetic diversity of the lexicon.
 * H(X) = -sum( P(x) * log2(P(x)) )
 */
export function calculateEntropy(words: string[]): number {
  const frequencies = getLetterFrequencies(words);
  if (frequencies.length === 0) return 0;

  let entropy = 0;
  for (const item of frequencies) {
    if (item.frequency > 0) {
      entropy -= item.frequency * Math.log2(item.frequency);
    }
  }
  return entropy;
}

/**
 * Common noise, placeholders, or stop words to flag in seed training lists.
 */
const NOISE_WORDS = new Set([
  "and",
  "the",
  "list",
  "name",
  "names",
  "null",
  "undefined",
  "true",
  "false",
  "test",
  "dummy",
  "placeholder",
  "words",
  "seed",
  "seeds",
  "country",
  "city",
  "province",
  "person",
  "organization",
]);

export interface LexiconHealthReport {
  score: number;
  issues: string[];
}

/**
 * Audits a lexicon (list of seed words) for quality issues and computes a health score.
 * A perfect lexicon scores 100. Points are deducted for various clean-up needs.
 */
export function auditLexiconHealth(words: string[]): LexiconHealthReport {
  const issues: string[] = [];
  let score = 100;

  if (words.length === 0) {
    return {
      score: 0,
      issues: ["Lexicon is empty. Please enter training seeds."],
    };
  }

  // 1. Lexicon Size Check (Markov chains need a baseline amount of data)
  if (words.length < 5) {
    score -= 30;
    issues.push(
      "Critical: Extremely small seed list. Markov generator needs at least 5 words to function, ideally 15+."
    );
  } else if (words.length < 15) {
    score -= 10;
    issues.push(
      "Warning: Small seed list. Add more names to increase variation and avoid repetitive outputs."
    );
  }

  // 2. Duplicate Check
  const uniqueWords = new Set(words.map((w) => w.trim().toLowerCase()));
  const duplicateCount = words.length - uniqueWords.size;
  if (duplicateCount > 0) {
    const pct = Math.round((duplicateCount / words.length) * 100);
    score -= Math.min(20, Math.floor(duplicateCount * 2));
    issues.push(`Contains duplicate seeds: ${duplicateCount} duplicates found (${pct}% of list).`);
  }

  // 3. Characters / Symbols check
  // Allow letters, space, hyphen, and single quotes (standard in names like O'Connor or Al-Farabi)
  const allowedCharRegex = /^[a-zA-Z\s'-]+$/;
  let invalidCharCount = 0;
  const invalidSamples: string[] = [];

  for (const word of words) {
    if (!allowedCharRegex.test(word)) {
      invalidCharCount++;
      if (invalidSamples.length < 3) {
        invalidSamples.push(word);
      }
    }
  }

  if (invalidCharCount > 0) {
    score -= Math.min(25, invalidCharCount * 5);
    issues.push(
      `Special characters or numbers found in ${invalidCharCount} word(s) (e.g. ${invalidSamples.join(
        ", "
      )}). Names should only contain letters, spaces, hyphens, or apostrophes.`
    );
  }

  // 4. Word Length Extremes
  let shortCount = 0;
  let longCount = 0;
  for (const word of words) {
    const cleanLen = word.trim().length;
    if (cleanLen > 0 && cleanLen <= 2) {
      shortCount++;
    } else if (cleanLen >= 15) {
      longCount++;
    }
  }

  if (shortCount > 0) {
    const pct = Math.round((shortCount / words.length) * 100);
    if (pct > 20) {
      score -= 10;
      issues.push(
        `High density of very short words (<= 2 chars): ${shortCount} words found (${pct}% of list).`
      );
    }
  }

  if (longCount > 0) {
    score -= Math.min(10, longCount * 2);
    issues.push(
      `Extremely long words (>= 15 chars) detected: ${longCount} word(s) found. May cause awkward generation.`
    );
  }

  // 5. Noise Words
  const foundNoise: string[] = [];
  for (const word of words) {
    const w = word.trim().toLowerCase();
    if (NOISE_WORDS.has(w)) {
      foundNoise.push(word);
    }
  }

  if (foundNoise.length > 0) {
    score -= Math.min(15, foundNoise.length * 5);
    issues.push(`Common noise/placeholder words found: "${foundNoise.slice(0, 3).join('", "')}"`);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
  };
}

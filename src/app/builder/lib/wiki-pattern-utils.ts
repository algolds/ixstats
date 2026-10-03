export interface PatternMatch {
  pattern: RegExp;
  value: string;
  confidence: number;
}

/** Text surrounding a regex match, flattened to one line and ellipsised where cut. */
export function extractEvidence(
  content: string,
  matchIndex: number,
  matchLength: number,
  contextChars = 80
): string {
  const start = Math.max(0, matchIndex - contextChars);
  const end = Math.min(content.length, matchIndex + matchLength + contextChars);
  let snippet = content.slice(start, end).replace(/\n/g, " ").trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";
  return snippet;
}

/** Highest-confidence pattern that matches, recording its evidence snippet once. */
export function findBestMatch(
  content: string,
  patterns: PatternMatch[],
  evidence: string[]
): { value: string | null; confidence: number } {
  let bestValue: string | null = null;
  let bestConfidence = 0;

  for (const { pattern, value, confidence } of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match && confidence > bestConfidence) {
      bestValue = value;
      bestConfidence = confidence;
      const evidenceSnippet = extractEvidence(content, match.index, match[0].length);
      if (!evidence.includes(evidenceSnippet)) {
        evidence.push(evidenceSnippet);
      }
    }
  }

  return { value: bestValue, confidence: bestConfidence };
}

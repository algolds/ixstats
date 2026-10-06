/**
 * Helpers of the differential tests that hold a linear rewrite against the code it replaced: a seeded
 * generator of small texts made of the tokens a pass reads (so unbalanced openers and closers are common),
 * and the real-looking wikitext of src/tests/fixtures/wikitext.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";

/** A seeded generator of `count` small texts of 1 to `maxTokens` of `tokens`. */
export function* randomTexts(
  tokens: readonly string[],
  count: number,
  seed: number,
  maxTokens = 14
): Generator<string> {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const length = 1 + Math.floor(next() * maxTokens);
    let text = "";
    for (let j = 0; j < length; j++) text += tokens[Math.floor(next() * tokens.length)];
    yield text;
  }
}

/** The first (at most five) texts on which `actual` and `expected` disagree. */
export function disagreements<T>(
  texts: Iterable<string>,
  actual: (text: string) => T,
  expected: (text: string) => T
): string[] {
  const bad: string[] = [];
  for (const text of texts) {
    if (!isDeepStrictEqual(actual(text), expected(text))) bad.push(text);
    if (bad.length >= 5) break;
  }
  return bad;
}

/** Every `.wiki` fixture (real pages and the shapes the editor was built against), whole. */
export function fixtureTexts(): string[] {
  const dir = join(__dirname, "../fixtures/wikitext");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".wiki"))
    .map((name) => readFileSync(join(dir, name), "utf8"));
}

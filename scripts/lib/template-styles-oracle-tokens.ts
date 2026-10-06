/**
 * The second, independent judge of what `scopeTemplateStyles` emits (plan 415 third review): the spec tokenizer of
 * @csstools/css-tokenizer, which shares no code with lightningcss (the first oracle, `template-styles-oracle.ts`).
 * Two parsers reading the same output must both find nothing: a bug has to fool both to get through, and a bug in
 * one oracle's reading of an odd construct does not hide a bypass from the other.
 *
 * It reads TOKENS, not a parsed tree: the output is cut into rules the way the spec's "consume a list of rules" does
 * (a prelude up to a `{}` block, blocks matched by their closers), then
 *  - each selector of a style rule must have the article root class in its first compound and must not ask for a
 *    sibling (`+`, `~`) right after it;
 *  - the only at-rule is `@media`, whose block is read as rules again;
 *  - every url token, and every `url(` function holding a string, must resolve (the URL parser) to the page or the
 *    wiki's own origin over https;
 *  - no function that loads a URL without `url(` (`image-set`, `src`, ...) and no `attr(` or `expression(`;
 *  - a rule body holds no `{}` block and no at-keyword at the start of a statement (no nested rule);
 *  - the output has no `<`, which could end the `<style>` element.
 */
import {
  isTokenAtKeyword,
  isTokenDelim,
  isTokenFunction,
  isTokenIdent,
  isTokenString,
  isTokenURL,
  tokenize,
  TokenType,
  type CSSToken,
} from "@csstools/css-tokenizer";
import { ARTICLE_STYLE_ROOT_CLASS } from "../../src/lib/utils/scope-template-styles";
import { OWN_ORIGIN } from "./template-styles-oracle";

const RELATIVE_BASE = "https://relative.invalid/";
const RELATIVE_ORIGIN = new URL(RELATIVE_BASE).origin;

/** The token that closes the block a token opens. */
const CLOSERS: Partial<Record<TokenType, TokenType>> = {
  [TokenType.OpenCurly]: TokenType.CloseCurly,
  [TokenType.OpenParen]: TokenType.CloseParen,
  [TokenType.OpenSquare]: TokenType.CloseSquare,
  [TokenType.Function]: TokenType.CloseParen,
};

/** [start, end) token indexes of one component value: a token, or a whole block. */
type Span = readonly [number, number];

const typeAt = (tokens: readonly CSSToken[], index: number): TokenType | undefined => tokens[index]?.[0];
const isSpace = (tokens: readonly CSSToken[], index: number): boolean => typeAt(tokens, index) === TokenType.Whitespace;
const isSpaceOrComment = (tokens: readonly CSSToken[], index: number): boolean =>
  isSpace(tokens, index) || typeAt(tokens, index) === TokenType.Comment;
const isDelimAt = (tokens: readonly CSSToken[], index: number, value: string): boolean => {
  const token = tokens[index];
  return token !== undefined && isTokenDelim(token) && token[4].value === value;
};

/** The index just past the block opened at `tokens[index]`, nested blocks included. */
function blockEnd(tokens: readonly CSSToken[], index: number): number {
  const closer = CLOSERS[tokens[index]![0]];
  let cursor = index + 1;
  while (cursor < tokens.length && typeAt(tokens, cursor) !== TokenType.EOF) {
    const type = tokens[cursor]![0];
    if (type === closer) return cursor + 1;
    cursor = CLOSERS[type] === undefined ? cursor + 1 : blockEnd(tokens, cursor);
  }
  return cursor;
}

/** The top-level components of `tokens[from, to)`, each block as one. */
function components(tokens: readonly CSSToken[], from: number, to: number): Span[] {
  const spans: Span[] = [];
  for (let cursor = from; cursor < to; ) {
    const end = CLOSERS[tokens[cursor]![0]] === undefined ? cursor + 1 : Math.min(blockEnd(tokens, cursor), to);
    spans.push([cursor, end]);
    cursor = end;
  }
  return spans;
}

/** Why a selector (as components) can match outside the root, or null when it cannot. */
function selectorViolation(tokens: readonly CSSToken[], selector: readonly Span[]): string | null {
  let first = 0;
  while (first < selector.length && isSpace(tokens, selector[first]![0])) first++;
  let hasRoot = false;
  let cursor = first;
  for (; cursor < selector.length; cursor++) {
    const at = selector[cursor]![0];
    if (isSpace(tokens, at) || isDelimAt(tokens, at, ">") || isDelimAt(tokens, at, "+") || isDelimAt(tokens, at, "~")) break;
    if (isDelimAt(tokens, at, ".")) {
      const name = tokens[selector[cursor + 1]?.[0] ?? -1];
      if (name !== undefined && isTokenIdent(name) && name[4].value === ARTICLE_STYLE_ROOT_CLASS) hasRoot = true;
    }
  }
  if (!hasRoot) return "no root class in the first compound";
  let next = cursor;
  while (next < selector.length && typeAt(tokens, selector[next]![0]) === TokenType.Comment) next++;
  const after = selector[next]?.[0] ?? -1;
  if (isDelimAt(tokens, after, "+") || isDelimAt(tokens, after, "~")) return "sibling combinator right after the root";
  if (isSpace(tokens, after)) {
    let beyond = next;
    while (beyond < selector.length && isSpaceOrComment(tokens, selector[beyond]![0])) beyond++;
    const combinator = selector[beyond]?.[0] ?? -1;
    if (isDelimAt(tokens, combinator, "+") || isDelimAt(tokens, combinator, "~")) return "sibling combinator after whitespace";
  }
  return null;
}

const BLOCKED_FUNCTIONS = /^(?:-webkit-|-moz-)?(?:image-set|image|cross-fade|element|paint|src)$|^(?:attr|expression)$/i;

/** Why a browser may fetch `target` from a host the wiki does not own, or null. */
function urlViolation(target: string): string | null {
  try {
    const resolved = new URL(target, RELATIVE_BASE);
    const fine = resolved.protocol === "https:" && (resolved.origin === RELATIVE_ORIGIN || resolved.origin === OWN_ORIGIN);
    return fine ? null : `url ${JSON.stringify(target)} -> ${resolved.href}`;
  } catch {
    return null; // not a URL a browser can fetch
  }
}

/** The urls, blocked functions, nested blocks and nested at-rules of one rule body, tokens[from, to). */
function scanBody(tokens: readonly CSSToken[], from: number, to: number, found: string[]): void {
  for (let index = from; index < to; index++) {
    const token = tokens[index]!;
    if (isTokenURL(token)) {
      const why = urlViolation(token[4].value);
      if (why) found.push(why);
    } else if (isTokenFunction(token)) {
      const name = token[4].value;
      if (name.toLowerCase() === "url") {
        let argument = index + 1;
        while (isSpaceOrComment(tokens, argument)) argument++;
        const literal = tokens[argument];
        if (literal !== undefined && isTokenString(literal)) {
          const why = urlViolation(literal[4].value);
          if (why) found.push(why);
        }
      }
      if (BLOCKED_FUNCTIONS.test(name)) found.push(`fn ${name}(`);
    }
  }
  let statementStart = true;
  for (const [start] of components(tokens, from, to)) {
    const type = typeAt(tokens, start);
    if (type === TokenType.Whitespace || type === TokenType.Comment) continue;
    if (type === TokenType.OpenCurly) found.push("nested {} block in a rule body");
    if (statementStart && isTokenAtKeyword(tokens[start]!)) found.push("nested at-rule at a statement start");
    statementStart = type === TokenType.Semicolon;
  }
}

/** The violations of the rules in tokens[from, to). */
function scanRules(tokens: readonly CSSToken[], from: number, to: number, found: string[]): void {
  const spans = components(tokens, from, to);
  for (let index = 0; index < spans.length; ) {
    const first = tokens[spans[index]![0]]!;
    const type = first[0];
    if (type === TokenType.Whitespace || type === TokenType.Comment || type === TokenType.CDO || type === TokenType.CDC) {
      index++;
      continue;
    }
    // the prelude runs to a `{}` block (the rule's body), or to a `;` after an at-keyword
    let end = index;
    let block: Span | null = null;
    while (end < spans.length) {
      const at = typeAt(tokens, spans[end]![0]);
      if (at === TokenType.OpenCurly) {
        block = spans[end]!;
        break;
      }
      if (at === TokenType.Semicolon && type === TokenType.AtKeyword) break;
      end++;
    }
    if (isTokenAtKeyword(first)) {
      const name = first[4].value.toLowerCase();
      if (name !== "media") found.push(`at-rule @${name}`);
      else if (block) scanRules(tokens, block[0] + 1, block[1] - 1, found);
    } else if (block) {
      const selectors: Span[][] = [[]];
      for (const span of spans.slice(index, end)) {
        if (typeAt(tokens, span[0]) === TokenType.Comma) selectors.push([]);
        else selectors[selectors.length - 1]!.push(span);
      }
      for (const selector of selectors) {
        const why = selectorViolation(tokens, selector);
        if (why) {
          const text = tokens.slice(selector[0]?.[0] ?? 0, selector[selector.length - 1]?.[1] ?? 0).map((token) => token[1]).join("");
          found.push(`SEL ${why}: ${text.slice(0, 60)}`);
        }
      }
      scanBody(tokens, block[0] + 1, block[1] - 1, found);
    }
    index = end + 1;
  }
}

/** Everything in `css` (the scoper's output) that breaks a promise of the scoper, as the spec tokenizer reads it. */
export function tokenViolations(css: string): string[] {
  const found: string[] = [];
  if (css.includes("<")) found.push("output holds <");
  const tokens = tokenize({ css });
  scanRules(tokens, 0, tokens.length, found);
  return found;
}

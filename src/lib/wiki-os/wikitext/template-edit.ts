/**
 * src/lib/wiki-os/wikitext/template-edit.ts — change a template's parameters without rewriting it.
 *
 * `{{Infobox country\n| name = Urcea\n| capital = X\n}}` edited to a new capital keeps every other
 * character: the template name line, the order and spacing of the untouched parameters, comments.
 * Only the changed parameter's value is replaced (its key and the spacing around `=` are kept, and
 * so are comments next to the old value); a new parameter is written in the style of the last one;
 * a parameter that is no longer in the set is dropped. Values are escaped so that they stay one
 * parameter: a top-level `|` becomes `{{!}}`, a `}}` or `{{` that pairs with nothing is wrapped in
 * `<nowiki>`, and a positional value with a top-level `=` is written as `N=value`.
 */

import { findMatchingClosingBraces, findMatchingClosingBrackets } from "./link-parser";
import { matchBraces, matchBrackets } from "./match-index";
import { parseParameterList, splitBalancedPipes } from "./parameter-parser";
import { skipProtectedAt } from "./protected-regions";
import type { WikiParameter } from "./types";

/** The parameters `raw` (a complete `{{…}}`) holds, by key. Null when `raw` is not a complete template. */
export function readTemplateParams(raw: string): Record<string, string> | null {
  if (!raw.startsWith("{{") || !raw.endsWith("}}")) return null;
  return parseParameterList(splitBalancedPipes(raw.slice(2, -2))).params;
}

interface TopLevelHandlers {
  /** The character at `index`, outside balanced `{{…}}`, `[[…]]`, comments and literal tags. */
  char: (index: number) => string;
  /** A balanced `{{…}}` or `[[…]]`, a comment or a literal tag, whole. */
  skipped: (text: string) => string;
  /** A `{{` or `}}` that pairs with nothing. */
  unpaired: (token: "{{" | "}}") => string;
}

/** Walks `value` at its top level, concatenating what the handlers return. */
function scanTopLevel(value: string, handlers: TopLevelHandlers): string {
  const braces = matchBraces(value);
  const brackets = matchBrackets(value);
  let out = "";
  let i = 0;
  while (i < value.length) {
    const protectedEnd = value[i] === "<" ? skipProtectedAt(value, i, true) : null;
    const braceEnd = value.startsWith("{{", i) ? findMatchingClosingBraces(value, i, braces) : -2;
    const bracketEnd = value.startsWith("[[", i) ? findMatchingClosingBrackets(value, i, brackets) : -2;
    if (protectedEnd !== null) {
      out += handlers.skipped(value.slice(i, protectedEnd));
      i = protectedEnd;
    } else if (braceEnd >= 0) {
      out += handlers.skipped(value.slice(i, braceEnd + 2));
      i = braceEnd + 2;
    } else if (bracketEnd >= 0) {
      out += handlers.skipped(value.slice(i, bracketEnd + 2));
      i = bracketEnd + 2;
    } else if (braceEnd === -1) {
      out += handlers.unpaired("{{");
      i += 2;
    } else if (value.startsWith("}}", i)) {
      out += handlers.unpaired("}}");
      i += 2;
    } else {
      out += handlers.char(i);
      i++;
    }
  }
  return out;
}

/** `value` as one parameter value: a top-level `|` is `{{!}}`, an unpaired `{{` or `}}` is literal. */
export function escapeParamValue(value: string): string {
  return scanTopLevel(value, {
    char: (index) => (value[index] === "|" ? "{{!}}" : value[index]!),
    skipped: (text) => text,
    unpaired: (token) => `<nowiki>${token}</nowiki>`,
  });
}

/** Whether `value` has an `=` outside templates, links, comments and literal tags. */
function hasTopLevelEquals(value: string): boolean {
  let found = false;
  scanTopLevel(value, {
    char: (index) => {
      if (value[index] === "=") found = true;
      return "";
    },
    skipped: () => "",
    unpaired: () => "",
  });
  return found;
}

/** `lead key eq value trail` of a named parameter segment (`" capital = X\n"`). */
const NAMED_PART = /^(\s*)([^=]*?)(\s*=\s*)([\s\S]*?)(\s*)$/;
const LEADING_COMMENTS = /^(?:<!--[\s\S]*?-->\s*)+/;
const TRAILING_COMMENTS = /(?:\s*<!--[\s\S]*?-->)+$/;

/** `newValue` in the place of `oldValue`, keeping the comments that stood at its start and end. */
function keepingComments(oldValue: string, newValue: string): string {
  const leading = LEADING_COMMENTS.exec(oldValue)?.[0] ?? "";
  const trailing = TRAILING_COMMENTS.exec(oldValue.slice(leading.length))?.[0] ?? "";
  return `${leading}${newValue}${trailing}`;
}

function replaceValue(part: string, param: WikiParameter, value: string): string {
  const escaped = escapeParamValue(value);
  if (param.isPositional) {
    const [, lead = "", old = "", trail = ""] = /^(\s*)([\s\S]*?)(\s*)$/.exec(part) ?? [];
    const text = keepingComments(old, escaped);
    // A positional value with a top-level `=` would be read as a name: write it as `N=value`.
    return hasTopLevelEquals(escaped) ? `${lead}${param.key}=${text}${trail}` : `${lead}${text}${trail}`;
  }
  const match = NAMED_PART.exec(part);
  return match ? `${match[1]}${match[2]}${match[3]}${keepingComments(match[4]!, escaped)}${match[5]}` : part;
}

/** A segment for a parameter that was not there, in the style of the last named one. */
function newPart(parts: string[], key: string, value: string): string {
  const escaped = escapeParamValue(value);
  for (let i = parts.length - 1; i >= 1; i--) {
    const match = NAMED_PART.exec(parts[i]!);
    if (match) return `${match[1]}${key}${match[3]}${escaped}${match[5]}`;
  }
  return `${key}=${escaped}`;
}

/**
 * `raw` with its parameters set to `values`: a value that differs is replaced in place, a key that is
 * absent from `values` is removed, and keys that are new are added at the end. A name that occurs
 * more than once is edited at its LAST occurrence (MediaWiki uses the last) and the earlier ones are
 * left exactly as written. Null when `raw` is not a complete template.
 */
export function rewriteTemplateParams(
  raw: string,
  values: Readonly<Record<string, string>>
): string | null {
  if (!raw.startsWith("{{") || !raw.endsWith("}}")) return null;
  const parts = splitBalancedPipes(raw.slice(2, -2));
  const { paramList } = parseParameterList(parts);
  const lastOccurrence = new Map<string, number>();
  paramList.forEach((param, offset) => lastOccurrence.set(param.key, offset));
  const next: string[] = [parts[0] ?? ""];

  paramList.forEach((param, offset) => {
    const part = parts[offset + 1]!;
    const value = values[param.key];
    if (value === undefined) return;
    const edited = lastOccurrence.get(param.key) === offset && value !== param.value;
    next.push(edited ? replaceValue(part, param, value) : part);
  });
  for (const [key, value] of Object.entries(values)) {
    if (!lastOccurrence.has(key)) next.push(newPart(parts, key, value));
  }
  return `{{${next.join("|")}}}`;
}

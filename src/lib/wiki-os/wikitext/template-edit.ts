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

import { isBlank, splitBlanks } from "./blank";
import { findMatchingClosingBraces, findMatchingClosingBrackets } from "./link-parser";
import { matchBraces, matchBrackets } from "./match-index";
import { parseParameterList, splitBalancedPipes } from "./parameter-parser";
import { ProtectedScanner, skipProtectedAt } from "./protected-regions";
import type { WikiParameter } from "./types";

/** The parameters `raw` (a complete `{{…}}`) holds, by key. Null when `raw` is not a complete template. */
export function readTemplateParams(raw: string): Record<string, string> | null {
  if (!raw.startsWith("{{") || !raw.endsWith("}}")) return null;
  return parseParameterList(splitBalancedPipes(raw.slice(2, -2))).params;
}

interface TopLevelHandlers {
  /** Plain text outside balanced `{{…}}`, `[[…]]`, comments and literal tags (a run, or one character that opens none). */
  text: (text: string) => string;
  /** A balanced `{{…}}` or `[[…]]`, a comment or a literal tag, whole. */
  skipped: (text: string) => string;
  /** A `{{` or `}}` that pairs with nothing. */
  unpaired: (token: "{{" | "}}") => string;
}

/** What a construct can start with (`<` a comment or a literal tag, a pair of braces or brackets): all before the next is plain text. */
const CONSTRUCT_START = /<|\{\{|\[\[|\}\}/g;

/**
 * Walks `value` at its top level, concatenating what the handlers return. Plain text between two constructs is
 * handed over as one run (a character that opens nothing joins it), and the pieces are joined once: a million
 * `out +=` of one-character strings is slow in some engines.
 */
function scanTopLevel(value: string, handlers: TopLevelHandlers): string {
  const braces = matchBraces(value);
  const brackets = matchBrackets(value);
  const scanner = new ProtectedScanner(value);
  const out: string[] = [];
  let runStart = 0;
  /** Ends the plain text run at `to`, and starts the next one at `resume`. */
  const construct = (to: number, resume: number, handled: string): number => {
    if (to > runStart) out.push(handlers.text(value.slice(runStart, to)));
    out.push(handled);
    runStart = resume;
    return resume;
  };
  let i = 0;
  while (i < value.length) {
    CONSTRUCT_START.lastIndex = i;
    const start = CONSTRUCT_START.exec(value)?.index ?? value.length;
    if (start > i) {
      i = start;
      continue;
    }
    const code = value.charCodeAt(i);
    const protectedEnd = code === 60 ? skipProtectedAt(value, i, true, scanner) : null;
    const braceEnd =
      code === 123 && value.charCodeAt(i + 1) === 123
        ? findMatchingClosingBraces(value, i, braces)
        : -2;
    const bracketEnd =
      code === 91 && value.charCodeAt(i + 1) === 91
        ? findMatchingClosingBrackets(value, i, brackets)
        : -2;
    if (protectedEnd !== null) {
      i = construct(i, protectedEnd, handlers.skipped(value.slice(i, protectedEnd)));
    } else if (braceEnd >= 0) {
      i = construct(i, braceEnd + 2, handlers.skipped(value.slice(i, braceEnd + 2)));
    } else if (bracketEnd >= 0) {
      i = construct(i, bracketEnd + 2, handlers.skipped(value.slice(i, bracketEnd + 2)));
    } else if (braceEnd === -1) {
      i = construct(i, i + 2, handlers.unpaired("{{"));
    } else if (code === 125 && value.charCodeAt(i + 1) === 125) {
      i = construct(i, i + 2, handlers.unpaired("}}"));
    } else {
      i++;
    }
  }
  if (value.length > runStart) out.push(handlers.text(value.slice(runStart)));
  return out.join("");
}

/** `value` as one parameter value: a top-level `|` is `{{!}}`, an unpaired `{{` or `}}` is literal. */
export function escapeParamValue(value: string): string {
  return scanTopLevel(value, {
    text: (text) => text.replaceAll("|", "{{!}}"),
    skipped: (text) => text,
    unpaired: (token) => `<nowiki>${token}</nowiki>`,
  });
}

/** Whether `value` has an `=` outside templates, links, comments and literal tags. */
function hasTopLevelEquals(value: string): boolean {
  let found = false;
  scanTopLevel(value, {
    text: (text) => {
      if (text.includes("=")) found = true;
      return "";
    },
    skipped: () => "",
    unpaired: () => "",
  });
  return found;
}

/**
 * `[lead, key, eq, value, trail]` of a named parameter segment (`" capital = X\n"` is `" "`, `"capital"`, `" = "`,
 * `"X"`, `"\n"`), or null when it has no `=`: what `/^(\s*)([^=]*?)(\s*=\s*)([\s\S]*?)(\s*)$/` captures, scanned
 * once (a run of blanks that no `=` follows made the expression quadratic).
 */
function splitNamedPart(part: string): [string, string, string, string, string] | null {
  let keyStart = 0;
  while (keyStart < part.length && isBlank(part.charCodeAt(keyStart))) keyStart++;
  const equals = part.indexOf("=", keyStart);
  if (equals === -1) return null;
  let keyEnd = equals;
  while (keyEnd > keyStart && isBlank(part.charCodeAt(keyEnd - 1))) keyEnd--;
  let valueStart = equals + 1;
  while (valueStart < part.length && isBlank(part.charCodeAt(valueStart))) valueStart++;
  let valueEnd = part.length;
  while (valueEnd > valueStart && isBlank(part.charCodeAt(valueEnd - 1))) valueEnd--;
  return [
    part.slice(0, keyStart),
    part.slice(keyStart, keyEnd),
    part.slice(keyEnd, valueStart),
    part.slice(valueStart, valueEnd),
    part.slice(valueEnd),
  ];
}

const LEADING_COMMENTS = /^(?:<!--[\s\S]*?-->\s*)+/;

/**
 * The comments (and the blanks before them) that end `text`: what `/(?:\s*<!--[\s\S]*?-->)+$/` matches, which
 * is everything from the first `<!--` that has `-->` after it to the end when the text ends with `-->`, and the
 * blanks before that `<!--`.
 */
function trailingComments(text: string): string {
  if (!text.endsWith("-->")) return "";
  const open = text.indexOf("<!--");
  if (open === -1 || text.length - open < 7) return "";
  let from = open;
  while (from > 0 && isBlank(text.charCodeAt(from - 1))) from--;
  return text.slice(from);
}

/** `newValue` in the place of `oldValue`, keeping the comments that stood at its start and end. */
function keepingComments(oldValue: string, newValue: string): string {
  const leading = LEADING_COMMENTS.exec(oldValue)?.[0] ?? "";
  const trailing = trailingComments(oldValue.slice(leading.length));
  return `${leading}${newValue}${trailing}`;
}

function replaceValue(part: string, param: WikiParameter, value: string): string {
  const escaped = escapeParamValue(value);
  if (param.isPositional) {
    const [lead, old, trail] = splitBlanks(part);
    const text = keepingComments(old, escaped);
    // A positional value with a top-level `=` would be read as a name: write it as `N=value`.
    return hasTopLevelEquals(escaped) ? `${lead}${param.key}=${text}${trail}` : `${lead}${text}${trail}`;
  }
  const match = splitNamedPart(part);
  return match ? `${match[0]}${match[1]}${match[2]}${keepingComments(match[3], escaped)}${match[4]}` : part;
}

/** A segment for a parameter that was not there, in the style of the last named one. */
function newPart(parts: string[], key: string, value: string): string {
  const escaped = escapeParamValue(value);
  for (let i = parts.length - 1; i >= 1; i--) {
    const match = splitNamedPart(parts[i]!);
    if (match) return `${match[0]}${key}${match[2]}${escaped}${match[4]}`;
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

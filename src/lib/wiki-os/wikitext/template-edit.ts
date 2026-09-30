/**
 * src/lib/wiki-os/wikitext/template-edit.ts — change a template's parameters without rewriting it.
 *
 * `{{Infobox country\n| name = Urcea\n| capital = X\n}}` edited to a new capital keeps every other
 * character: the template name line, the order and spacing of the untouched parameters, comments.
 * Only the changed parameter's value is replaced (its key and the spacing around `=` are kept);
 * a new parameter is written in the style of the last one; a parameter that is no longer in the
 * set is dropped.
 */

import { parseParameterList, splitBalancedPipes } from "./parameter-parser";

/** The parameters `raw` (a complete `{{…}}`) holds, by key. Null when `raw` is not a complete template. */
export function readTemplateParams(raw: string): Record<string, string> | null {
  if (!raw.startsWith("{{") || !raw.endsWith("}}")) return null;
  return parseParameterList(splitBalancedPipes(raw.slice(2, -2))).params;
}

/** `lead key eq value trail` of a named parameter segment (`" capital = X\n"`). */
const NAMED_PART = /^(\s*)([^=]*?)(\s*=\s*)([\s\S]*?)(\s*)$/;

function replaceValue(part: string, value: string, isPositional: boolean): string {
  if (isPositional) {
    const [, lead = "", , trail = ""] = /^(\s*)([\s\S]*?)(\s*)$/.exec(part) ?? [];
    return `${lead}${value}${trail}`;
  }
  const match = NAMED_PART.exec(part);
  return match ? `${match[1]}${match[2]}${match[3]}${value}${match[5]}` : part;
}

/** A segment for a parameter that was not there, in the style of the last named one. */
function newPart(parts: string[], key: string, value: string): string {
  for (let i = parts.length - 1; i >= 1; i--) {
    const match = NAMED_PART.exec(parts[i]!);
    if (match) return `${match[1]}${key}${match[3]}${value}${match[5]}`;
  }
  return `${key}=${value}`;
}

/**
 * `raw` with its parameters set to `values`: a value that differs is replaced in place, a key that is
 * absent from `values` is removed, and keys that are new are added at the end. Null when `raw` is not
 * a complete template.
 */
export function rewriteTemplateParams(raw: string, values: Readonly<Record<string, string>>): string | null {
  if (!raw.startsWith("{{") || !raw.endsWith("}}")) return null;
  const parts = splitBalancedPipes(raw.slice(2, -2));
  const { paramList } = parseParameterList(parts);
  const seen = new Set<string>();
  const next: string[] = [parts[0] ?? ""];

  paramList.forEach((param, offset) => {
    seen.add(param.key);
    const value = values[param.key];
    if (value === undefined) return;
    next.push(value === param.value ? parts[offset + 1]! : replaceValue(parts[offset + 1]!, value, Boolean(param.isPositional)));
  });
  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) next.push(newPart(parts, key, value));
  }
  return `{{${next.join("|")}}}`;
}

/**
 * src/lib/wiki-os/wikitext/parameter-parser.ts — MediaWiki Template Parameter Extraction.
 *
 * Robust, balanced pipe and equals splitting that handles nested templates,
 * nested links, tables, comments, and multiline parameter blocks.
 */

import type { WikiParameter } from "./types";

/** Where the `-->` of the comment opened at `at` is, or -1 when it never closes (the rest of the text is comment). */
const commentClose = (text: string, at: number): number => text.indexOf("-->", at + 4);

/**
 * Splits parameter segments by `|`, respecting nested `{{ }}`, `[[ ]]`, `{| |}`, and `<!-- -->`.
 */
export function splitBalancedPipes(text: string): string[] {
  const parts: string[] = [];
  let tmplDepth = 0;
  let linkDepth = 0;
  let tableDepth = 0;
  let start = 0;
  let i = 0;

  while (i < text.length) {
    const code = text.charCodeAt(i);
    const next = text.charCodeAt(i + 1);
    if (code === 60 && text.startsWith("<!--", i)) {
      const end = commentClose(text, i);
      if (end === -1) break;
      i = end + 3;
    } else if (code === 123 && next === 123) {
      tmplDepth++;
      i += 2;
    } else if (code === 125 && next === 125) {
      tmplDepth = Math.max(0, tmplDepth - 1);
      i += 2;
    } else if (code === 91 && next === 91) {
      linkDepth++;
      i += 2;
    } else if (code === 93 && next === 93) {
      linkDepth = Math.max(0, linkDepth - 1);
      i += 2;
    } else if (code === 123 && next === 124) {
      tableDepth++;
      i += 2;
    } else if (code === 124 && next === 125) {
      tableDepth = Math.max(0, tableDepth - 1);
      i += 2;
    } else if (code === 124 && tmplDepth === 0 && linkDepth === 0 && tableDepth === 0) {
      parts.push(text.slice(start, i));
      start = ++i;
    } else {
      i++;
    }
  }

  parts.push(text.slice(start));
  return parts;
}

/**
 * Finds the top-level `=` character index in a parameter segment.
 */
export function findBalancedEquals(part: string): number {
  let tmplDepth = 0;
  let linkDepth = 0;
  let tableDepth = 0;
  let i = 0;

  while (i < part.length) {
    const code = part.charCodeAt(i);
    const next = part.charCodeAt(i + 1);
    if (code === 60 && part.startsWith("<!--", i)) {
      const end = commentClose(part, i);
      if (end === -1) break;
      i = end + 3;
    } else if (code === 123 && next === 123) {
      tmplDepth++;
      i += 2;
    } else if (code === 125 && next === 125) {
      tmplDepth = Math.max(0, tmplDepth - 1);
      i += 2;
    } else if (code === 91 && next === 91) {
      linkDepth++;
      i += 2;
    } else if (code === 93 && next === 93) {
      linkDepth = Math.max(0, linkDepth - 1);
      i += 2;
    } else if (code === 123 && next === 124) {
      tableDepth++;
      i += 2;
    } else if (code === 124 && next === 125) {
      tableDepth = Math.max(0, tableDepth - 1);
      i += 2;
    } else if (code === 61 && tmplDepth === 0 && linkDepth === 0 && tableDepth === 0) {
      return i;
    } else {
      i++;
    }
  }

  return -1;
}

/**
 * Parses raw parameter parts into structured dictionaries and lists.
 */
export function parseParameterList(parts: string[]): {
  params: Record<string, string>;
  paramList: WikiParameter[];
  positional: string[];
} {
  const params: Record<string, string> = {};
  const paramList: WikiParameter[] = [];
  const positional: string[] = [];
  let posIndex = 1;

  for (let idx = 1; idx < parts.length; idx++) {
    const part = parts[idx]!;
    const eqIdx = findBalancedEquals(part);

    if (eqIdx !== -1) {
      const key = part.slice(0, eqIdx).trim();
      const value = part.slice(eqIdx + 1).trim();
      params[key] = value;
      paramList.push({
        key,
        value,
        isPositional: false,
        raw: part,
      });
    } else {
      const value = part.trim();
      positional.push(value);
      const key = String(posIndex);
      params[key] = value;
      paramList.push({
        key,
        value,
        isPositional: true,
        index: posIndex,
        raw: part,
      });
      posIndex++;
    }
  }

  return { params, paramList, positional };
}

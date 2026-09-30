/**
 * src/lib/wiki-os/wikitext/parameter-parser.ts — MediaWiki Template Parameter Extraction.
 *
 * Robust, balanced pipe and equals splitting that handles nested templates,
 * nested links, tables, comments, and multiline parameter blocks.
 */

import type { WikiParameter } from "./types";

/**
 * Splits parameter segments by `|`, respecting nested `{{ }}`, `[[ ]]`, `{| |}`, and `<!-- -->`.
 */
export function splitBalancedPipes(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let tmplDepth = 0;
  let linkDepth = 0;
  let tableDepth = 0;
  let inComment = false;
  let i = 0;

  while (i < text.length) {
    // 1. Comments
    if (!inComment && text.startsWith("<!--", i)) {
      inComment = true;
      current += "<!--";
      i += 4;
      continue;
    }
    if (inComment) {
      if (text.startsWith("-->", i)) {
        inComment = false;
        current += "-->";
        i += 3;
        continue;
      }
      current += text[i];
      i++;
      continue;
    }

    // 2. Templates
    if (text.startsWith("{{", i)) {
      tmplDepth++;
      current += "{{";
      i += 2;
      continue;
    }
    if (text.startsWith("}}", i)) {
      tmplDepth = Math.max(0, tmplDepth - 1);
      current += "}}";
      i += 2;
      continue;
    }

    // 3. Links
    if (text.startsWith("[[", i)) {
      linkDepth++;
      current += "[[";
      i += 2;
      continue;
    }
    if (text.startsWith("]]", i)) {
      linkDepth = Math.max(0, linkDepth - 1);
      current += "]]";
      i += 2;
      continue;
    }

    // 4. Tables
    if (text.startsWith("{|", i)) {
      tableDepth++;
      current += "{|";
      i += 2;
      continue;
    }
    if (text.startsWith("|}", i)) {
      tableDepth = Math.max(0, tableDepth - 1);
      current += "|}";
      i += 2;
      continue;
    }

    // 5. Pipe delimiter at top level
    if (text[i] === "|" && tmplDepth === 0 && linkDepth === 0 && tableDepth === 0) {
      parts.push(current);
      current = "";
      i++;
      continue;
    }

    current += text[i];
    i++;
  }

  parts.push(current);
  return parts;
}

/**
 * Finds the top-level `=` character index in a parameter segment.
 */
export function findBalancedEquals(part: string): number {
  let tmplDepth = 0;
  let linkDepth = 0;
  let tableDepth = 0;
  let inComment = false;
  let i = 0;

  while (i < part.length) {
    if (!inComment && part.startsWith("<!--", i)) {
      inComment = true;
      i += 4;
      continue;
    }
    if (inComment) {
      if (part.startsWith("-->", i)) {
        inComment = false;
        i += 3;
        continue;
      }
      i++;
      continue;
    }

    if (part.startsWith("{{", i)) {
      tmplDepth++;
      i += 2;
      continue;
    }
    if (part.startsWith("}}", i)) {
      tmplDepth = Math.max(0, tmplDepth - 1);
      i += 2;
      continue;
    }

    if (part.startsWith("[[", i)) {
      linkDepth++;
      i += 2;
      continue;
    }
    if (part.startsWith("]]", i)) {
      linkDepth = Math.max(0, linkDepth - 1);
      i += 2;
      continue;
    }

    if (part.startsWith("{|", i)) {
      tableDepth++;
      i += 2;
      continue;
    }
    if (part.startsWith("|}", i)) {
      tableDepth = Math.max(0, tableDepth - 1);
      i += 2;
      continue;
    }

    if (part[i] === "=" && tmplDepth === 0 && linkDepth === 0 && tableDepth === 0) {
      return i;
    }

    i++;
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

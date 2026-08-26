/**
 * src/lib/wiki-os/wikitext/template-parser.ts — Tolerant MediaWiki Template & Parser Function Scanner.
 *
 * Scans balanced and malformed template blocks, preserving 100% of parameters,
 * nested templates, links, tables, and unclosed typing states.
 */

import { splitBalancedPipes, parseParameterList } from "./parameter-parser";
import { classifyTemplate } from "./resolver";
import type { ParsedTemplate, Diagnostic } from "./types";

export interface ScanTemplatesResult {
  templates: ParsedTemplate[];
  diagnostics: Diagnostic[];
}

export function scanTemplates(wikitext: string): ScanTemplatesResult {
  const templates: ParsedTemplate[] = [];
  const diags: Diagnostic[] = [];

  let i = 0;

  while (i < wikitext.length) {
    const openIdx = wikitext.indexOf("{{", i);
    if (openIdx === -1) break;

    let depth = 0;
    let linkDepth = 0;
    let tableDepth = 0;
    let inComment = false;
    let j = openIdx;
    let endIdx = -1;

    while (j < wikitext.length) {
      // 1. Comments
      if (!inComment && wikitext.startsWith("<!--", j)) {
        inComment = true;
        j += 4;
        continue;
      }
      if (inComment) {
        if (wikitext.startsWith("-->", j)) {
          inComment = false;
          j += 3;
          continue;
        }
        j++;
        continue;
      }

      // 2. Links
      if (wikitext.startsWith("[[", j)) {
        linkDepth++;
        j += 2;
        continue;
      }
      if (wikitext.startsWith("]]", j)) {
        linkDepth = Math.max(0, linkDepth - 1);
        j += 2;
        continue;
      }

      // 3. Tables
      if (wikitext.startsWith("{|", j)) {
        tableDepth++;
        j += 2;
        continue;
      }
      if (wikitext.startsWith("|}", j)) {
        tableDepth = Math.max(0, tableDepth - 1);
        j += 2;
        continue;
      }

      // 4. Templates
      if (wikitext.startsWith("{{", j)) {
        depth++;
        j += 2;
        continue;
      }
      if (wikitext.startsWith("}}", j)) {
        depth--;
        j += 2;
        if (depth === 0) {
          endIdx = j;
          break;
        }
        continue;
      }

      j++;
    }

    // Tolerant handling: unclosed template before EOF
    if (endIdx === -1) {
      const raw = wikitext.slice(openIdx);
      const inner = raw.slice(2);
      const parsed = parseTemplateInner(inner, raw, openIdx, wikitext.length, "incomplete");
      if (parsed) {
        templates.push(parsed);
        diags.push({
          severity: "warning",
          message: `Unclosed template: "${parsed.name}"`,
          start: openIdx,
          end: wikitext.length,
          code: "UNCLOSED_TEMPLATE",
        });
      }
      break;
    }

    const raw = wikitext.slice(openIdx, endIdx);
    const inner = raw.slice(2, -2);
    const parsed = parseTemplateInner(inner, raw, openIdx, endIdx, "complete");
    if (parsed) {
      templates.push(parsed);
    }

    i = endIdx;
  }

  return { templates, diagnostics: diags };
}

function parseTemplateInner(
  inner: string,
  raw: string,
  startIndex: number,
  endIndex: number,
  parseState: "complete" | "incomplete"
): ParsedTemplate | null {
  const parts = splitBalancedPipes(inner);
  if (parts.length === 0) return null;

  const rawHead = parts[0]?.trim() ?? "";
  if (!rawHead) return null;

  // 1. Check for Parser Function / Magic Word: {{#if: cond | then | else}} or {{formatnum: 1234}}
  const colonIdx = rawHead.indexOf(":");
  if (colonIdx !== -1 && (rawHead.startsWith("#") || isMagicWordPrefix(rawHead.slice(0, colonIdx)))) {
    const fnName = rawHead.slice(0, colonIdx).trim();
    const expression = rawHead.slice(colonIdx + 1).trim();
    const branches = parts.slice(1);

    return {
      name: fnName,
      params: {},
      paramList: [],
      positional: branches,
      raw,
      source: { start: startIndex, end: endIndex },
      classification: "standard",
      parseState,
      isParserFunction: true,
      functionName: fnName,
      expression,
      branches,
    };
  }

  // 2. Standard or Infobox Template
  const name = rawHead;
  const { params, paramList, positional } = parseParameterList(parts);
  const classification = classifyTemplate(name, params);

  return {
    name,
    params,
    paramList,
    positional,
    raw,
    source: { start: startIndex, end: endIndex },
    classification,
    parseState,
  };
}

function isMagicWordPrefix(prefix: string): boolean {
  const MAGIC_PREFIXES = new Set([
    "formatnum",
    "lc",
    "uc",
    "lcfirst",
    "ucfirst",
    "padleft",
    "padright",
    "urlencode",
    "anchorencode",
    "ns",
    "nse",
    "int",
    "special",
    "filepath",
    "pagename",
    "fullpagename",
    "namespace",
  ]);
  return MAGIC_PREFIXES.has(prefix.toLowerCase().trim());
}

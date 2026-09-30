/**
 * src/lib/wiki-os/wikitext/template-parser.ts — Tolerant MediaWiki Template & Parser Function Scanner.
 *
 * Scans balanced and malformed template blocks, preserving 100% of parameters,
 * nested templates, links, tables, and unclosed typing states.
 */

import { splitBalancedPipes, parseParameterList } from "./parameter-parser";
import { classifyTemplate } from "./resolver";
import { skipProtectedAt } from "./protected-regions";
import type { ParsedTemplate, Diagnostic } from "./types";

export interface ScanTemplatesResult {
  templates: ParsedTemplate[];
  diagnostics: Diagnostic[];
}

export interface ScannedTemplate {
  /** The parsed template, or null when the braces hold no usable name. */
  parsed: ParsedTemplate | null;
  /** Index just after the closing `}}`; the end of the text when the template is never closed. */
  end: number;
  closed: boolean;
}

/** The `{{` of the next template that MediaWiki would expand at or after `from`, or -1. */
function nextTemplateOpen(wikitext: string, from: number): number {
  let i = from;
  let brace = wikitext.indexOf("{{", i);
  while (brace !== -1) {
    const tag = wikitext.indexOf("<", i);
    if (tag === -1 || tag > brace) return brace;
    const end = skipProtectedAt(wikitext, tag);
    i = end ?? tag + 1;
    if (brace < i) brace = wikitext.indexOf("{{", i);
  }
  return -1;
}

/** Scans the template whose `{{` is at `openIdx`: balanced braces, links, tables and comments. */
export function scanTemplateAt(wikitext: string, openIdx: number): ScannedTemplate {
  let depth = 0;
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

    // 2. Literal tags (`<nowiki>}}</nowiki>`)
    if (wikitext.charCodeAt(j) === 60) {
      const skipped = skipProtectedAt(wikitext, j);
      if (skipped !== null) {
        j = skipped;
        continue;
      }
    }

    // 3. Links and tables hold braces of their own
    if (wikitext.startsWith("[[", j) || wikitext.startsWith("]]", j)) {
      j += 2;
      continue;
    }
    if (wikitext.startsWith("{|", j) || wikitext.startsWith("|}", j)) {
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
    const parsed = parseTemplateInner(raw.slice(2), raw, openIdx, wikitext.length, "incomplete");
    return { parsed, end: wikitext.length, closed: false };
  }

  const raw = wikitext.slice(openIdx, endIdx);
  const parsed = parseTemplateInner(raw.slice(2, -2), raw, openIdx, endIdx, "complete");
  return { parsed, end: endIdx, closed: true };
}

/** The warning for a template that runs to the end of the text without closing. */
export function unclosedTemplateDiagnostic(
  parsed: ParsedTemplate,
  openIdx: number,
  textLength: number
): Diagnostic {
  return {
    severity: "warning",
    message: `Unclosed template: "${parsed.name}"`,
    start: openIdx,
    end: textLength,
    code: "UNCLOSED_TEMPLATE",
  };
}

export function scanTemplates(wikitext: string): ScanTemplatesResult {
  const templates: ParsedTemplate[] = [];
  const diags: Diagnostic[] = [];

  let i = 0;

  while (i < wikitext.length) {
    const openIdx = nextTemplateOpen(wikitext, i);
    if (openIdx === -1) break;

    const { parsed, end, closed } = scanTemplateAt(wikitext, openIdx);
    if (parsed) templates.push(parsed);
    if (!closed) {
      if (parsed) diags.push(unclosedTemplateDiagnostic(parsed, openIdx, wikitext.length));
      break;
    }
    i = end;
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
  if (
    colonIdx !== -1 &&
    (rawHead.startsWith("#") || isMagicWordPrefix(rawHead.slice(0, colonIdx)))
  ) {
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

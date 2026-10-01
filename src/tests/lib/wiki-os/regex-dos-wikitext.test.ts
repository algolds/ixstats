/** @jest-environment node */
/**
 * The linear rewrites of the wikitext/ folder (plan F15, the regex-DoS sweep), each held against a verbatim
 * copy of the code it replaced: on 30,000 random small texts made of the tokens the code reads (so unbalanced
 * openers and closers are the common case) and on every real-looking page of src/tests/fixtures/wikitext.
 * The gate that they are fast is regex-dos.test.ts.
 */
import { disagreements, fixtureTexts, randomTexts } from "../../helpers/wikitext-fuzz";
import {
  findMatchingClosingBraces,
  findMatchingClosingBrackets,
  parseInlineLinksAndFormatting,
} from "~/lib/wiki-os/wikitext/link-parser";
import { parseInlineLinksAndFormatting as legacyParseInline } from "./legacy/link-parser";
import { UNINDEXED, matchBraces, matchBrackets } from "~/lib/wiki-os/wikitext/match-index";
import {
  parseParameterList,
  findBalancedEquals,
  splitBalancedPipes,
} from "~/lib/wiki-os/wikitext/parameter-parser";
import {
  ProtectedScanner,
  findTagClose,
  isCommentOnly,
  matchOpenTag,
  skipProtectedAt,
} from "~/lib/wiki-os/wikitext/protected-regions";
import * as legacyProtected from "./legacy/protected-regions";
import { findSectionLine, sectionHeadings } from "~/lib/wiki-os/wikitext/section-locator";
import { linkTargets } from "~/lib/wiki-os/api-compat/scan";
import {
  scanTemplateAt,
  scanTemplates,
  unclosedTemplateDiagnostic,
} from "~/lib/wiki-os/wikitext/template-parser";
import {
  escapeParamValue,
  readTemplateParams,
  rewriteTemplateParams,
} from "~/lib/wiki-os/wikitext/template-edit";
import type { WikiParameter } from "~/lib/wiki-os/wikitext/types";
import {
  isMagicWordLine,
  matchHeading,
  startsRedirect,
} from "~/lib/wiki-os/wikitext/line-patterns";
import { joinMarkedSegments, type MarkedSegment } from "~/lib/wiki-os/wikitext/quote-marks";
import {
  extractTableCellContent,
  splitBalancedDoubleTokens,
} from "~/lib/wiki-os/wikitext/table-parser";

const fixtures = fixtureTexts();

describe("match-index: a scan from an odd position of an opener run is answered from the index", () => {
  /** The pass as it was: odd positions of a run of three or more were left to a scan. */
  function legacyIndex(text: string, open: "{{" | "[[", close: "}}" | "]]"): Int32Array {
    const index = new Int32Array(text.length).fill(UNINDEXED);
    const stack: number[] = [];
    const skipsLinks = open === "{{";
    let i = 0;
    while (i < text.length) {
      if (text.startsWith("<!--", i)) {
        const end = text.indexOf("-->", i + 4);
        if (end === -1) break;
        i = end + 3;
      } else if (text.startsWith(open, i)) {
        index[i] = -1;
        stack.push(i);
        i += 2;
      } else if (text.startsWith(close, i)) {
        const opener = stack.pop();
        if (opener !== undefined) index[opener] = i;
        i += 2;
      } else if (skipsLinks && (text.startsWith("[[", i) || text.startsWith("]]", i))) {
        i += 2;
      } else {
        i++;
      }
    }
    return index;
  }

  const TOKENS = ["[", "[", "[", "]", "]", "{", "{", "}", "}", "a", "|", "x ", "<!--", "-->", "\n"];
  const NO_COMMENTS = TOKENS.filter((token) => !token.includes("-"));
  const kinds = [
    ["[[", "]]", matchBrackets, findMatchingClosingBrackets],
    ["{{", "}}", matchBraces, findMatchingClosingBraces],
  ] as const;

  it.each(kinds)(
    "%s: every entry the old pass had is unchanged, every entry is what a scan answers",
    (open, close, build, scan) => {
      for (const text of [...randomTexts(TOKENS, 30_000, 7, 20), ...fixtures]) {
        const index = build(text);
        const old = legacyIndex(text, open, close);
        for (let at = text.indexOf(open); at !== -1; at = text.indexOf(open, at + 1)) {
          if (old[at] !== UNINDEXED) expect([text, at, index[at]]).toEqual([text, at, old[at]]);
          if (index[at] !== UNINDEXED)
            expect([text, at, index[at]]).toEqual([text, at, scan(text, at)]);
        }
      }
    }
  );

  it.each(kinds)("%s: outside a comment no opener is left to a scan", (open, _close, build) => {
    for (const text of randomTexts(NO_COMMENTS, 30_000, 8, 20)) {
      const index = build(text);
      for (let at = text.indexOf(open); at !== -1; at = text.indexOf(open, at + 1)) {
        expect([text, at, index[at] === UNINDEXED]).toEqual([text, at, false]);
      }
    }
  });
});

// ---- parameter-parser: one pass, slices instead of a character appended at a time -----------------------

/** `splitBalancedPipes` as it was. */
function legacySplitBalancedPipes(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let tmplDepth = 0;
  let linkDepth = 0;
  let tableDepth = 0;
  let inComment = false;
  let i = 0;
  while (i < text.length) {
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

/** `findBalancedEquals` as it was. */
function legacyFindBalancedEquals(part: string): number {
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
    if (part[i] === "=" && tmplDepth === 0 && linkDepth === 0 && tableDepth === 0) return i;
    i++;
  }
  return -1;
}

const PARAMETER_TOKENS = [
  "{{",
  "}}",
  "[[",
  "]]",
  "{|",
  "|}",
  "|",
  "=",
  "<!--",
  "-->",
  "<!-",
  "{",
  "}",
  "[",
  "]",
  "a",
  " ",
  "\n",
  "k=v",
  "x|y",
];

describe("parameter-parser: splitBalancedPipes and findBalancedEquals answer what they answered", () => {
  const texts = [...randomTexts(PARAMETER_TOKENS, 40_000, 11, 18), ...fixtures];

  it("splitBalancedPipes", () => {
    expect(disagreements(texts, splitBalancedPipes, legacySplitBalancedPipes)).toEqual([]);
  });

  it("findBalancedEquals", () => {
    expect(disagreements(texts, findBalancedEquals, legacyFindBalancedEquals)).toEqual([]);
  });
});

// ---- table-parser ------------------------------------------------------------------------------------

/** `splitBalancedDoubleTokens` as it was. */
function legacySplitDouble(text: string, delimiter: "||" | "!!"): string[] {
  const parts: string[] = [];
  let current = "";
  let inLink = 0;
  let inTmpl = 0;
  let inComment = false;
  let i = 0;
  while (i < text.length) {
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
    if (text.startsWith("[[", i)) {
      inLink++;
      current += "[[";
      i += 2;
      continue;
    }
    if (text.startsWith("]]", i)) {
      inLink = Math.max(0, inLink - 1);
      current += "]]";
      i += 2;
      continue;
    }
    if (text.startsWith("{{", i)) {
      inTmpl++;
      current += "{{";
      i += 2;
      continue;
    }
    if (text.startsWith("}}", i)) {
      inTmpl = Math.max(0, inTmpl - 1);
      current += "}}";
      i += 2;
      continue;
    }
    if (text.startsWith(delimiter, i) && inLink === 0 && inTmpl === 0) {
      parts.push(current);
      current = "";
      i += 2;
      continue;
    }
    current += text[i];
    i++;
  }
  parts.push(current);
  return parts;
}

/** `extractTableCellContent` as it was: the attribute test ran on the whole text before every top-level `|`. */
function legacyExtractTableCellContent(rawCell: string): { attributes: string; content: string } {
  let inLink = 0;
  let inTmpl = 0;
  let inComment = false;
  let sepIdx = -1;
  for (let i = 0; i < rawCell.length; i++) {
    if (!inComment && rawCell.startsWith("<!--", i)) {
      inComment = true;
      i += 3;
      continue;
    }
    if (inComment) {
      if (rawCell.startsWith("-->", i)) {
        inComment = false;
        i += 2;
      }
      continue;
    }
    if (rawCell.startsWith("[[", i)) {
      inLink++;
      i++;
      continue;
    }
    if (rawCell.startsWith("]]", i)) {
      inLink = Math.max(0, inLink - 1);
      i++;
      continue;
    }
    if (rawCell.startsWith("{{", i)) {
      inTmpl++;
      i++;
      continue;
    }
    if (rawCell.startsWith("}}", i)) {
      inTmpl = Math.max(0, inTmpl - 1);
      i++;
      continue;
    }
    if (rawCell[i] === "|" && inLink === 0 && inTmpl === 0) {
      const before = rawCell.slice(0, i).trim();
      const hasAttrPattern =
        /[a-zA-Z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s]+)/.test(before) ||
        /^(?:align|valign|bgcolor|width|height|colspan|rowspan|scope|class|style)\b/i.test(before);
      if (hasAttrPattern) {
        sepIdx = i;
        break;
      }
    }
  }
  if (sepIdx !== -1) {
    return {
      attributes: rawCell.slice(0, sepIdx).trim(),
      content: rawCell.slice(sepIdx + 1).trim(),
    };
  }
  return { attributes: "", content: rawCell.trim() };
}

const TABLE_TOKENS = [
  "|",
  "|",
  "||",
  "!!",
  "!",
  " ",
  " ",
  "=",
  '"x"',
  "'q'",
  "style",
  "class",
  "align=",
  "bgcolor",
  "styled",
  "[[a|b]]",
  "[[",
  "]]",
  "{{",
  "}}",
  "<!--",
  "-->",
  "a",
  "-",
  "_",
  "\u00a0",
  "\u2003",
  "\ufeff",
  "\n",
  "x=y",
  "1",
];

describe("table-parser: the cell splitters answer what they answered", () => {
  const texts = [...randomTexts(TABLE_TOKENS, 40_000, 21, 16), ...fixtures];

  it("splitBalancedDoubleTokens, || and !!", () => {
    expect(
      disagreements(
        texts,
        (t) => splitBalancedDoubleTokens(t, "||"),
        (t) => legacySplitDouble(t, "||")
      )
    ).toEqual([]);
    expect(
      disagreements(
        texts,
        (t) => splitBalancedDoubleTokens(t, "!!"),
        (t) => legacySplitDouble(t, "!!")
      )
    ).toEqual([]);
  });

  it("extractTableCellContent", () => {
    expect(disagreements(texts, extractTableCellContent, legacyExtractTableCellContent)).toEqual(
      []
    );
  });

  it("extractTableCellContent, on the cells of every real table", () => {
    const cells = fixtures.flatMap((text) =>
      text.split(/\n/).flatMap((line) => line.split(/\|\||!!/))
    );
    expect(disagreements(cells, extractTableCellContent, legacyExtractTableCellContent)).toEqual(
      []
    );
  });
});

// ---- quote-marks -------------------------------------------------------------------------------------

/** `joinMarkedSegments` as it was: the text split into lines. */
function legacyJoinMarkedSegments(segments: readonly MarkedSegment[]): string {
  let out = "";
  let bold = false;
  let italic = false;
  const quoteTransition = (
    bold0: boolean,
    italic0: boolean,
    bold1: boolean,
    italic1: boolean
  ): string => {
    const closeBold = bold0 && !bold1;
    const closeItalic = italic0 && !italic1;
    const openBold = !bold0 && bold1;
    const openItalic = !italic0 && italic1;
    let marks = "";
    if (closeBold && closeItalic) marks += "'''''";
    else marks += (closeItalic ? "''" : "") + (closeBold ? "'''" : "");
    if (openBold && openItalic) marks += "'''''";
    else marks += (openItalic ? "''" : "") + (openBold ? "'''" : "");
    return marks;
  };
  const moveTo = (nextBold: boolean, nextItalic: boolean): void => {
    out += quoteTransition(bold, italic, nextBold, nextItalic);
    bold = nextBold;
    italic = nextItalic;
  };
  for (const segment of segments) {
    if (!segment.isText) {
      moveTo(segment.bold, segment.italic);
      out += segment.text;
      continue;
    }
    segment.text.split("\n").forEach((line, index) => {
      if (index > 0) {
        moveTo(false, false);
        out += "\n";
      }
      if (line !== "") {
        moveTo(segment.bold, segment.italic);
        out += line;
      }
    });
  }
  moveTo(false, false);
  return out;
}

describe("quote-marks: joinMarkedSegments scans for line breaks instead of splitting", () => {
  it("answers what it answered, on 30,000 random segment lists", () => {
    const pieces = ["a", "b c", "\n", "\n\n", "''", "x\ny", ""];
    const lists: MarkedSegment[][] = [];
    let state = 5;
    const next = (n: number) => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return Math.floor((state / 4294967296) * n);
    };
    for (let i = 0; i < 30_000; i++) {
      lists.push(
        Array.from({ length: 1 + next(5) }, () => ({
          text: Array.from({ length: next(4) }, () => pieces[next(pieces.length)]).join(""),
          bold: next(2) === 1,
          italic: next(2) === 1,
          isText: next(3) !== 0,
        }))
      );
    }
    const bad = lists.filter((list) => joinMarkedSegments(list) !== legacyJoinMarkedSegments(list));
    expect(bad.slice(0, 3)).toEqual([]);
  });
});

// ---- template-edit: blanks and comments scanned, not matched ---------------------------------------------
// template-edit.ts as it was (verbatim, renamed): its regular expressions over blanks and comments.

/** The parameters `raw` (a complete `{{…}}`) holds, by key. Null when `raw` is not a complete template. */
function legacyReadTemplateParams(raw: string): Record<string, string> | null {
  if (!raw.startsWith("{{") || !raw.endsWith("}}")) return null;
  return parseParameterList(splitBalancedPipes(raw.slice(2, -2))).params;
}

interface LegacyTopLevelHandlers {
  /** The character at `index`, outside balanced `{{…}}`, `[[…]]`, comments and literal tags. */
  char: (index: number) => string;
  /** A balanced `{{…}}` or `[[…]]`, a comment or a literal tag, whole. */
  skipped: (text: string) => string;
  /** A `{{` or `}}` that pairs with nothing. */
  unpaired: (token: "{{" | "}}") => string;
}

/** Walks `value` at its top level, concatenating what the handlers return. */
function legacyScanTopLevel(value: string, handlers: LegacyTopLevelHandlers): string {
  const braces = matchBraces(value);
  const brackets = matchBrackets(value);
  const scanner = new ProtectedScanner(value);
  let out = "";
  let i = 0;
  while (i < value.length) {
    const protectedEnd = value[i] === "<" ? skipProtectedAt(value, i, true, scanner) : null;
    const braceEnd = value.startsWith("{{", i) ? findMatchingClosingBraces(value, i, braces) : -2;
    const bracketEnd = value.startsWith("[[", i)
      ? findMatchingClosingBrackets(value, i, brackets)
      : -2;
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
function legacyEscapeParamValue(value: string): string {
  return legacyScanTopLevel(value, {
    char: (index) => (value[index] === "|" ? "{{!}}" : value[index]!),
    skipped: (text) => text,
    unpaired: (token) => `<nowiki>${token}</nowiki>`,
  });
}

/** Whether `value` has an `=` outside templates, links, comments and literal tags. */
function legacyHasTopLevelEquals(value: string): boolean {
  let found = false;
  legacyScanTopLevel(value, {
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
const LEGACY_NAMED_PART = /^(\s*)([^=]*?)(\s*=\s*)([\s\S]*?)(\s*)$/;
const LEGACY_LEADING_COMMENTS = /^(?:<!--[\s\S]*?-->\s*)+/;
const LEGACY_TRAILING_COMMENTS = /(?:\s*<!--[\s\S]*?-->)+$/;

/** `newValue` in the place of `oldValue`, keeping the comments that stood at its start and end. */
function legacyKeepingComments(oldValue: string, newValue: string): string {
  const leading = LEGACY_LEADING_COMMENTS.exec(oldValue)?.[0] ?? "";
  const trailing = LEGACY_TRAILING_COMMENTS.exec(oldValue.slice(leading.length))?.[0] ?? "";
  return `${leading}${newValue}${trailing}`;
}

function legacyReplaceValue(part: string, param: WikiParameter, value: string): string {
  const escaped = legacyEscapeParamValue(value);
  if (param.isPositional) {
    const [, lead = "", old = "", trail = ""] = /^(\s*)([\s\S]*?)(\s*)$/.exec(part) ?? [];
    const text = legacyKeepingComments(old, escaped);
    // A positional value with a top-level `=` would be read as a name: write it as `N=value`.
    return legacyHasTopLevelEquals(escaped)
      ? `${lead}${param.key}=${text}${trail}`
      : `${lead}${text}${trail}`;
  }
  const match = LEGACY_NAMED_PART.exec(part);
  return match
    ? `${match[1]}${match[2]}${match[3]}${legacyKeepingComments(match[4]!, escaped)}${match[5]}`
    : part;
}

/** A segment for a parameter that was not there, in the style of the last named one. */
function legacyNewPart(parts: string[], key: string, value: string): string {
  const escaped = legacyEscapeParamValue(value);
  for (let i = parts.length - 1; i >= 1; i--) {
    const match = LEGACY_NAMED_PART.exec(parts[i]!);
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
function legacyRewriteTemplateParams(
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
    next.push(edited ? legacyReplaceValue(part, param, value) : part);
  });
  for (const [key, value] of Object.entries(values)) {
    if (!lastOccurrence.has(key)) next.push(legacyNewPart(parts, key, value));
  }
  return `{{${next.join("|")}}}`;
}

const EDIT_TOKENS = [
  "{{",
  "}}",
  "[[",
  "]]",
  "|",
  "=",
  " ",
  "  ",
  "\n",
  "\u00a0",
  "<!--",
  "-->",
  "->",
  "-",
  "<!-- c -->",
  "<nowiki>",
  "</nowiki>",
  "a",
  "b",
  "key",
  "k = v",
  "{{!}}",
  "<pre>",
  "</pre>",
  "[[x|y]]",
  "{{t|1}}",
];

describe("template-edit: the same edits, scanned instead of matched", () => {
  const values = [
    "",
    "x",
    "a | b",
    "{{",
    "}}",
    "a = b",
    " <!-- c --> ",
    "<nowiki>{{</nowiki>",
    "[[a|b]] c",
  ];

  it("escapeParamValue and readTemplateParams", () => {
    const texts = [...randomTexts(EDIT_TOKENS, 30_000, 31, 14), ...fixtures];
    expect(disagreements(texts, escapeParamValue, legacyEscapeParamValue)).toEqual([]);
    expect(
      disagreements(
        texts,
        (t) => readTemplateParams(`{{x|${t}}}`),
        (t) => legacyReadTemplateParams(`{{x|${t}}}`)
      )
    ).toEqual([]);
  });

  it("rewriteTemplateParams, on random templates and every real one", () => {
    const templates = [
      ...[...randomTexts(EDIT_TOKENS, 30_000, 32, 14)].map((t) => `{{x|${t}}}`),
      ...fixtures.flatMap((text) => text.match(/\{\{[^{}]*\}\}/g) ?? []),
    ];
    for (const value of values) {
      const set = { a: value, key: value, new_one: value, "1": value };
      expect(
        disagreements(
          templates,
          (t) => rewriteTemplateParams(t, set),
          (t) => legacyRewriteTemplateParams(t, set)
        )
      ).toEqual([]);
    }
    expect(
      disagreements(
        templates,
        (t) => rewriteTemplateParams(t, {}),
        (t) => legacyRewriteTemplateParams(t, {})
      )
    ).toEqual([]);
  });
});

// ---- line-patterns: the block parser's heading, magic-word and redirect lines -----------------------------

describe("line-patterns: scanned, they answer what the expressions answered", () => {
  const HEADING = /^(={1,6})\s*(.+?)\s*\1$/;
  const MAGIC_WORD_LINE = /^(?:__[A-Za-z0-9_]+__[ \t]*)+$/;
  const REDIRECT_LINE = /^#redirect\s*:?\s*\[\[/i;

  const HEADING_TOKENS = [
    "=",
    "=",
    "==",
    "===",
    "======",
    "=======",
    " ",
    " ",
    "\t",
    "\n",
    "\r",
    "\u2028",
    "\u00a0",
    "\u3000",
    "a",
    "b c",
    "[[x]]",
    "'''",
    "{{t}}",
  ];
  const MAGIC_TOKENS = [
    "__",
    "_",
    "TOC",
    "NOTOC",
    "a",
    "1",
    " ",
    "\t",
    "\n",
    "\u00a0",
    "-",
    "__TOC__",
    "__a__ ",
  ];
  const REDIRECT_TOKENS = [
    "#",
    "redirect",
    "REDIRECT",
    "ReDirect",
    "#redirect",
    "#REDIRECT",
    ":",
    " ",
    "\n",
    "\t",
    "\u00a0",
    "[[",
    "[",
    "x",
    "İ",
    "ſ",
  ];

  it("matchHeading: the level and the title", () => {
    const texts = [
      ...randomTexts(HEADING_TOKENS, 60_000, 41, 10),
      ...fixtures.flatMap((t) => t.split("\n")),
    ];
    const regex = (line: string) => {
      const match = HEADING.exec(line);
      return match ? { level: match[1]!.length, title: match[2]! } : null;
    };
    expect(disagreements(texts, matchHeading, regex)).toEqual([]);
  });

  it("isMagicWordLine", () => {
    const texts = [
      ...randomTexts(MAGIC_TOKENS, 60_000, 42, 8),
      ...fixtures.flatMap((t) => t.split("\n")),
    ];
    expect(disagreements(texts, isMagicWordLine, (line) => MAGIC_WORD_LINE.test(line))).toEqual([]);
  });

  it("startsRedirect", () => {
    const texts = [...randomTexts(REDIRECT_TOKENS, 60_000, 43, 8), ...fixtures];
    expect(disagreements(texts, startsRedirect, (line) => REDIRECT_LINE.test(line))).toEqual([]);
  });
});

describe("match-index: an opener the pass did not reach is scanned for, within a budget", () => {
  it("answers what a scan answers, inside a comment and after one that never closes", () => {
    const TOKENS = ["[[", "]]", "{{", "}}", "<!--", "-->", "a", " ", "[", "]"];
    for (const text of randomTexts(TOKENS, 20_000, 9, 14)) {
      for (const [open, build, scan] of [
        ["[[", matchBrackets, findMatchingClosingBrackets],
        ["{{", matchBraces, findMatchingClosingBraces],
      ] as const) {
        const index = build(text);
        for (let at = text.indexOf(open); at !== -1; at = text.indexOf(open, at + 1)) {
          expect([text, at, scan(text, at, index)]).toEqual([text, at, scan(text, at)]);
        }
      }
    }
  });

  it("reads a text of openers after a comment that never closes in linear time", () => {
    const text = `<!--${"[[x ".repeat(200_000)}`;
    const index = matchBrackets(text);
    const started = performance.now();
    for (let at = text.indexOf("[["); at !== -1; at = text.indexOf("[[", at + 1)) {
      findMatchingClosingBrackets(text, at, index);
    }
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});

// ---- template-parser: scanTemplates looks for the next `<` once ---------------------------------------------

/** `scanTemplates` as it was: a search for `<` from every position it looked at. */
function legacyScanTemplates(wikitext: string) {
  const scanner = new ProtectedScanner(wikitext);
  const nextTemplateOpen = (from: number): number => {
    let i = from;
    let brace = wikitext.indexOf("{{", i);
    while (brace !== -1) {
      const tag = wikitext.indexOf("<", i);
      if (tag === -1 || tag > brace) return brace;
      const end = skipProtectedAt(wikitext, tag, false, scanner);
      i = end ?? tag + 1;
      if (brace < i) brace = wikitext.indexOf("{{", i);
    }
    return -1;
  };
  const templates = [];
  const diags = [];
  let i = 0;
  while (i < wikitext.length) {
    const openIdx = nextTemplateOpen(i);
    if (openIdx === -1) break;
    const { parsed, end, closed } = scanTemplateAt(wikitext, openIdx, scanner);
    if (parsed) templates.push(parsed);
    if (!closed) {
      if (parsed) diags.push(unclosedTemplateDiagnostic(parsed, openIdx, wikitext.length));
      break;
    }
    i = end;
  }
  return { templates, diagnostics: diags };
}

describe("template-parser: scanTemplates answers what it answered", () => {
  const TOKENS = [
    "{{",
    "}}",
    "{{a|b}}",
    "{{#if:x|y}}",
    "<nowiki>",
    "</nowiki>",
    "<!--",
    "-->",
    "<pre>",
    "</pre>",
    "<ref>",
    "</ref>",
    "<",
    "a",
    " ",
    "\n",
    "|",
    "=",
    "[[",
    "]]",
  ];
  it("on random texts and the real pages", () => {
    const texts = [...randomTexts(TOKENS, 30_000, 12, 14), ...fixtures];
    expect(disagreements(texts, scanTemplates, legacyScanTemplates)).toEqual([]);
  });
});

// ---- link-parser: the inline parser --------------------------------------------------------------------------

describe("link-parser: parseInlineLinksAndFormatting answers what it answered", () => {
  const INLINE_TOKENS = [
    "[[a]]",
    "[[a|b]]",
    "[[File:x.png|thumb|cap [[y]]]]",
    "[[CountryData:Aurelia|gdp]]",
    "[[Coords:1,2|here]]",
    "{{t|a=b}}",
    "{{MyCountry:gdp}}",
    "{{coord|1|2}}",
    "{{",
    "}}",
    "[[",
    "]]",
    "[",
    "]",
    "[http://a.b]",
    "[http://a.b label]",
    "[https://c.d x y]",
    "[http://",
    "<ref>a</ref>",
    "<ref name=a />",
    "<nowiki>[[x]]</nowiki>",
    "<!-- c -->",
    "<!--",
    ", , ''",
    "a",
    "b c",
    " ",
    "\n",
    "|",
    "=",
    "&amp;",
    "text",
  ];
  it("on 40,000 random texts, plain ones among them, and the real pages line by line", () => {
    const texts = [
      ...randomTexts(INLINE_TOKENS, 40_000, 15, 12),
      ...fixtures.flatMap((t) => t.split("\n")),
    ];
    expect(disagreements(texts, parseInlineLinksAndFormatting, legacyParseInline)).toEqual([]);
  });
});

// ---- protected-regions: one memoized `>` and `-->` search per scan ---------------------------------------------

describe("protected-regions: the scanner answers what the integration branch's scanner answered", () => {
  const TOKENS = [
    "<nowiki>",
    "</nowiki>",
    "</nowiki >",
    "<nowiki ",
    "<pre>",
    "</pre>",
    "<ref name=a>",
    "<ref />",
    "</ref>",
    "<gallery>",
    "</gallery>",
    "<references />",
    "<referencesfoo>",
    "<!--",
    "-->",
    "<!-- x -->",
    "<",
    ">",
    "/",
    " ",
    "a",
    "\n",
    "{{",
    "}}",
  ];

  /** What every `<` of the text answers: the region it starts, the tag it opens and where that closes. */
  function regionsOf(text: string, fresh: boolean): unknown[] {
    const answers: unknown[] = [];
    const scanner = new ProtectedScanner(text);
    const legacy = new legacyProtected.ProtectedScanner(text);
    for (let at = text.indexOf("<"); at !== -1; at = text.indexOf("<", at + 1)) {
      if (fresh) {
        const tag = matchOpenTag(text, at, scanner);
        answers.push(
          skipProtectedAt(text, at, true, scanner),
          skipProtectedAt(text, at, false, scanner),
          tag,
          tag && findTagClose(tag, scanner)
        );
      } else {
        const tag = legacyProtected.matchOpenTag(text, at, legacy);
        answers.push(
          legacyProtected.skipProtectedAt(text, at, true, legacy),
          legacyProtected.skipProtectedAt(text, at, false, legacy),
          tag,
          tag && legacyProtected.findTagClose(tag, legacy)
        );
      }
    }
    return answers;
  }

  it("on random texts of tags and comments, and the real pages", () => {
    const texts = [...randomTexts(TOKENS, 30_000, 31, 14), ...fixtures];
    expect(
      disagreements(
        texts,
        (text) => regionsOf(text, true),
        (text) => regionsOf(text, false)
      )
    ).toEqual([]);
  });

  it("asks isCommentOnly the same of every line", () => {
    const texts = [
      ...randomTexts(TOKENS, 20_000, 32, 8),
      ...fixtures.flatMap((text) => text.split("\n")),
    ];
    expect(disagreements(texts, isCommentOnly, legacyProtected.isCommentOnly)).toEqual([]);
  });

  it("answers a scan that goes back as it answers one that goes forward", () => {
    const text = "<!-- a --><nowiki>x</nowiki><!-- b --><pre>y</pre><!-- c";
    const scanner = new ProtectedScanner(text);
    const opens = [...text.matchAll(/</g)].map((match) => match.index);
    const forward = opens.map((at) => skipProtectedAt(text, at, true, scanner));
    const back = [...opens].reverse().map((at) => skipProtectedAt(text, at, true, scanner));
    expect(back.reverse()).toEqual(forward);
  });
});

// ---- section-locator: findSectionLine's markup stripping and heading match are scans ---------------------------

describe("section-locator: findSectionLine answers what the expressions answered", () => {
  const LEGACY_HEADING = /^(={2,6})\s*(.+?)\s*\1\s*$/u;
  /** `visibleHeadingText` as the integration branch had it. */
  function legacyVisibleHeadingText(text: string): string {
    return text
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/gu, "$1")
      .replace(/'{2,}/gu, "")
      .replace(/<[^>]+>/gu, "")
      .replace(/\s+/gu, " ")
      .trim()
      .toLowerCase();
  }
  function legacyFindSectionLine(wikitext: string, section: string): number | null {
    const target = legacyVisibleHeadingText(section);
    if (!target) return null;
    const index = wikitext.split("\n").findIndex((line) => {
      const heading = LEGACY_HEADING.exec(line)?.[2];
      return heading !== undefined && legacyVisibleHeadingText(heading) === target;
    });
    return index >= 0 ? index + 1 : null;
  }

  const LINE_TOKENS = [
    "=",
    "==",
    "===",
    " ",
    "\t",
    "\r",
    " ",
    " ",
    "a",
    "b c",
    "[[",
    "]]",
    "|",
    "[[x|",
    "[[x]]",
    "'''",
    "''",
    "<",
    ">",
    "<b>",
    "</b>",
    "<>",
    "\n",
  ];

  it("matches a heading line exactly as the expression did, on lines of `=`, blanks and markup", () => {
    const expected = (line: string) => {
      const match = LEGACY_HEADING.exec(line);
      return match ? { level: match[1]!.length, title: match[2]! } : null;
    };
    const lines = [...randomTexts(LINE_TOKENS, 60_000, 33, 10)].map((text) =>
      text.replaceAll("\n", "")
    );
    expect(disagreements(lines, (line) => matchHeading(line, 2, true), expected)).toEqual([]);
  });

  it("finds the same heading for the same section name, on random pages and every real one", () => {
    const names = [
      ...randomTexts(LINE_TOKENS, 400, 34, 8),
      "History",
      "Early life",
      "x",
      "a b c",
      "[[x|Label]]",
      "'''A'''",
    ];
    const pages = [...randomTexts(LINE_TOKENS, 4_000, 35, 14), ...fixtures];
    for (const name of names) {
      expect(
        disagreements(
          pages,
          (page) => findSectionLine(page, name),
          (page) => legacyFindSectionLine(page, name)
        )
      ).toEqual([]);
    }
  });

  it("finds every real page's own headings the same way", () => {
    for (const page of fixtures) {
      for (const heading of sectionHeadings(page).slice(0, 12)) {
        expect(findSectionLine(page, heading.text)).toEqual(
          legacyFindSectionLine(page, heading.text)
        );
      }
    }
  });

  it("finishes a hostile section name and a hostile page in linear time", () => {
    const hostile = [
      "[[".repeat(100_000),
      "<".repeat(200_000),
      "[[a]x".repeat(40_000),
      "== ".repeat(66_000),
      `==${" ".repeat(200_000)}x`,
    ];
    const started = performance.now();
    for (const text of hostile) {
      findSectionLine("== History ==\n", text);
      findSectionLine(text, "History");
    }
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});

// ---- api-compat/scan: linkTargets finds the first stop of a target once ---------------------------------------

describe("api-compat/scan: linkTargets answers what it answered", () => {
  /** `linkTargets` as the integration branch had it: a window of up to 300 characters read from each opener. */
  function legacyLinkTargets(wikitext: string, max: number): string[] {
    const closes = matchBrackets(wikitext);
    const found = new Set<string>();
    for (let open = wikitext.indexOf("[["); open !== -1; open = wikitext.indexOf("[[", open + 2)) {
      const close = closes[open];
      if (close === undefined || close <= 0 || close === UNINDEXED) continue;
      if (found.size >= max) break;
      const limit = Math.min(close, open + 2 + 300);
      let end = open + 2;
      while (end < limit && !"|#\n".includes(wikitext[end]!)) end++;
      if (end === limit && limit < close) continue;
      if (wikitext[end] === "\n") continue;
      const target = wikitext.slice(open + 2, end).trim();
      if (target) found.add(target);
    }
    return [...found];
  }
  const TOKENS = [
    "[[",
    "]]",
    "[[a]]",
    "[[b|c]]",
    "[[d#e]]",
    "[[f\ng]]",
    "|",
    "#",
    "\n",
    " ",
    "x".repeat(150),
    "x".repeat(320),
    "{{",
    "}}",
  ];
  it("on random texts, long targets among them, and the real pages", () => {
    const texts = [...randomTexts(TOKENS, 30_000, 71, 10), ...fixtures];
    expect(
      disagreements(
        texts,
        (text) => linkTargets(text, 5001),
        (text) => legacyLinkTargets(text, 5001)
      )
    ).toEqual([]);
    expect(
      disagreements(
        texts,
        (text) => linkTargets(text, 3),
        (text) => legacyLinkTargets(text, 3)
      )
    ).toEqual([]);
  });
  it("takes time linear in the nested links of a text", () => {
    const started = performance.now();
    linkTargets("[[".repeat(100_000) + "]]".repeat(100_000), 5001);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

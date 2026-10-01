/** @jest-environment node */
/**
 * `cleanWikiMarkup` with no `maxLength` cleans a whole page (the country-import heuristics, the cache and
 * content extractors). Its passes that were regular expressions a text of openers that never close makes
 * quadratic are one-scan functions now (clean-markup-passes.ts). Each is fuzzed here against a verbatim
 * copy of the expression it replaced, and the whole pipeline against a copy of the pipeline as it was.
 */
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { findMatchingClosingBrackets } from "~/lib/wiki-os/wikitext/link-parser";
import { matchBrackets } from "~/lib/wiki-os/wikitext/match-index";
import {
  replaceInlineTemplates,
  stripBareExternalLinks,
  stripComments,
  stripHtmlTags,
  stripNamespacedLinks,
  stripSelfClosingRefs,
  stripTagBlocks,
  stripUnclosedTemplateTail,
  unpackExternalLinks,
} from "~/lib/wiki-os/transformers/clean-markup-passes";
import {
  cleanWikiMarkup,
  stripWikitextFiles,
  unpackInternalLinks,
} from "~/lib/wiki-os/transformers/wikitext-parser";

// ---- the expressions and loops as they were -------------------------------------------------------

const legacy = {
  comments: (t: string) => t.replace(/<!--[\s\S]*?-->/g, ""),
  refBlocks: (t: string) => t.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, ""),
  refSelfClosing: (t: string) => t.replace(/<ref\b[^>]*\/>/gi, ""),
  gallery: (t: string) => t.replace(/<gallery\b[^>]*>[\s\S]*?<\/gallery>/gi, ""),
  math: (t: string) => t.replace(/<math\b[^>]*>[\s\S]*?<\/math>/gi, ""),
  category: (t: string) => t.replace(/\[\[(?:Category|category):[^\]]+\]\]/gi, ""),
  templateLink: (t: string) => t.replace(/\[\[(?:Template|template):[^\]]+\]\]/gi, ""),
  unclosedTail: (t: string) => t.replace(/\{\{[^}]*$/g, ""),
  htmlTags: (t: string) => t.replace(/<[^>]+>/g, ""),
  externalLabelled: (t: string) => t.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1"),
  externalBare: (t: string) => t.replace(/\[https?:\/\/[^\s\]]+\]/g, ""),
  files: (text: string) => {
    let result = "";
    let i = 0;
    const index = matchBrackets(text);
    while (i < text.length) {
      const prefix = text.slice(i, i + 8).toLowerCase();
      if (
        prefix.startsWith("[[file:") ||
        prefix.startsWith("[[image:") ||
        prefix.startsWith("[[media:")
      ) {
        const closeIdx = findMatchingClosingBrackets(text, i, index);
        if (closeIdx !== -1) {
          i = closeIdx + 2;
          continue;
        }
      }
      result += text[i];
      i++;
    }
    return result;
  },
  inlineTemplates: (text: string) => {
    let t = text;
    t = t.replace(
      /\{\{(?:flag|flagcountry|flagicon)\s*\|\s*([^|}]+)[^}]*\}\}/gi,
      (_match, name: string) => (_match.toLowerCase().includes("flagicon") ? "" : name.trim())
    );
    t = t.replace(
      /\{\{(?:quote|blockquote|cite quote)\s*\|\s*([^|}]+)(?:\|([^|}]+))?[^}]*\}\}/gi,
      (_match, quote: string, author?: string) => {
        const q = quote.trim();
        const a = author ? author.trim() : "";
        return `\n\n<blockquote class="my-2 border-l-2 border-primary/50 pl-3 italic text-muted-foreground">${q}${a ? ` &mdash; <span class="font-semibold text-foreground">${a}</span>` : ""}</blockquote>\n\n`;
      }
    );
    t = t.replace(
      /\{\{(?:main|main article|see also|further)\s*\|\s*([^|}]+)[^}]*\}\}/gi,
      (_match, target: string) => {
        const name = target.trim();
        const route = titleToWikiOSRoute(name);
        return `\n\n<p class="text-xs italic text-muted-foreground/80 my-1 font-medium">Main article: <a href="${route}" class="text-primary hover:underline font-semibold">${name}</a></p>\n\n`;
      }
    );
    t = t.replace(
      /\{\{convert\s*\|\s*([\d.]+)\s*\|\s*([^|}]+)\s*\|\s*([^|}]+)[^}]*\}\}/gi,
      (_match, val: string, u1: string) => `${val} ${u1.trim()}`
    );
    t = t.replace(/\{\{lang(?:-[a-z]+)?\s*\|(?:[a-z-]+\|)?([^|}]+)[^}]*\}\}/gi, "$1");
    t = t.replace(/\{\{(?:nowrap|nobr|small|smaller|font)\s*\|\s*([^|}]+)[^}]*\}\}/gi, "$1");
    return t;
  },
};

/** The whole of `cleanWikiMarkup` (and the template pass of the parser) as it was, minus the ceiling. */
function legacyClean(rawText: string): string {
  let text = rawText;
  text = text.replace(/^\[blurb:[^\]]+\]\s*/gi, "");
  text = legacy.comments(text);
  text = text.replace(/__(?:NOTOC|TOC|NOEDITSECTION|FORCETOC|SHOWFACTBOX|DISAMBIG)__/gi, "");
  text = legacy.refSelfClosing(legacy.refBlocks(text));
  text = legacy.math(legacy.gallery(text));
  text = legacy.files(text);
  text = legacy.category(text);
  text = legacy.templateLink(text);
  text = text.replace(/(?:Template|template)\s*:[^\n.<|\]}]*/gi, "");
  text = legacyTemplates(text);
  text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");
  text = legacy.externalBare(legacy.externalLabelled(text));
  text = legacy.htmlTags(text);
  text = text.replace(/^==+[^=]+==+/gm, "");
  text = text.replace(/'''''/g, "").replace(/'''/g, "").replace(/''/g, "");
  text = text.replace(/&\w+;/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

function legacyTemplates(input: string): string {
  if (!input || !input.includes("{{")) return input;
  let text = legacy.inlineTemplates(input);
  text = text.replace(
    /^\{\{(?:Infobox|Sidebar|Taxobox|Navigation|Notice|Short description|About|Redirect|Distinguish|Other uses)\b[\s\S]*?(?=\n\n[A-Z0-9'"]|\n==|$)/gi,
    (match) => {
      const openCount = (match.match(/\{\{/g) || []).length;
      const closeCount = (match.match(/\}\}/g) || []).length;
      if (openCount > closeCount) return "";
      return match;
    }
  );
  let depth = 0;
  while (text.includes("{{") && depth < 20) {
    depth++;
    const prev = text;
    text = text.replace(/\{\{([^{}]*)\}\}/g, (_match, inner: string) => {
      const parts = inner.trim().split("|");
      const templateName = parts[0]?.trim().toLowerCase();
      if (
        templateName === "nowrap" ||
        templateName === "nobr" ||
        templateName === "small" ||
        templateName === "smaller"
      ) {
        return parts.slice(1).join("|").trim();
      }
      if (templateName === "lang" && parts.length >= 3) return parts[2]?.trim() || "";
      if (templateName?.startsWith("formatnum:"))
        return templateName.replace("formatnum:", "").trim();
      return "";
    });
    if (text === prev) break;
  }
  text = legacy.unclosedTail(text);
  text = text.replace(/^[^{]*\}\}/g, "");
  text = text.replace(/\{\{|\}\}/g, "");
  return text;
}

// ---- a seeded generator of small texts made of the tokens these passes read -------------------------

const TOKENS = [
  "{{",
  "}}",
  "{{flag|a}}",
  "{{flagicon|a}}",
  "{{flag|",
  "{{quote|a|b}}",
  "{{blockquote| q }}",
  "{{main|Some page}}",
  "{{convert|12|km|mi}}",
  "{{convert|1|",
  "{{lang|fr|bonjour}}",
  "{{lang-de|x}}",
  "{{nowrap| x }}",
  "{{small|y}}",
  "{{Infobox country\n",
  "{{formatnum:12}}",
  "<ref>",
  "</ref>",
  "<ref name=a/>",
  "<ref name=a />",
  "<REF",
  "<refx>",
  "<ref",
  "<!--",
  "-->",
  "<gallery>",
  "</gallery>",
  "<math>",
  "</MATH>",
  "<b>",
  "</b>",
  "<",
  ">",
  "<>",
  "[[Category:A]]",
  "[[category:",
  "[[Category:]]",
  "[[Template:X]]",
  "[[TEMPLATE:",
  "Template:x",
  "[[File:",
  "[[Image:a|b]]",
  "[[media:c]]",
  "[[a|b]]",
  "[[",
  "]]",
  "[",
  "]",
  "|",
  "[http://a b]",
  "[http://a]",
  "[https://a  ]",
  "[http://a ]",
  "[https://",
  "[http://",
  "[http",
  "http://",
  "[HTTP://a b]",
  " ",
  "  ",
  "\t",
  " ",
  "\n",
  "\n\n",
  "a",
  "bc",
  "'''",
  "==",
  "=",
  "&amp;",
  "}",
  "{",
  "/",
  "s",
  "İ",
  "K",
];

function* randomTexts(count: number, seed: number): Generator<string> {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const length = 1 + Math.floor(next() * 14);
    let text = "";
    for (let j = 0; j < length; j++) text += TOKENS[Math.floor(next() * TOKENS.length)];
    yield text;
  }
}

/** The first texts on which `actual` and `expected` disagree. */
function disagreements(
  actual: (text: string) => string,
  expected: (text: string) => string,
  count = 30_000,
  seed = 4060
): string[] {
  const bad: string[] = [];
  for (const text of randomTexts(count, seed)) {
    if (actual(text) !== expected(text)) bad.push(text);
    if (bad.length >= 5) break;
  }
  return bad;
}

describe("each linear pass answers what its expression answered", () => {
  const cases: Array<[string, (text: string) => string, (text: string) => string]> = [
    ["comments", stripComments, legacy.comments],
    ["<ref>...</ref>", (t) => stripTagBlocks(t, "ref"), legacy.refBlocks],
    ["<ref />", stripSelfClosingRefs, legacy.refSelfClosing],
    ["<gallery>", (t) => stripTagBlocks(t, "gallery"), legacy.gallery],
    ["<math>", (t) => stripTagBlocks(t, "math"), legacy.math],
    ["[[Category:]]", (t) => stripNamespacedLinks(t, "category:"), legacy.category],
    ["[[Template:]]", (t) => stripNamespacedLinks(t, "template:"), legacy.templateLink],
    ["unclosed {{ tail", stripUnclosedTemplateTail, legacy.unclosedTail],
    ["html tags", stripHtmlTags, legacy.htmlTags],
    ["[url label]", unpackExternalLinks, legacy.externalLabelled],
    ["[url]", stripBareExternalLinks, legacy.externalBare],
    ["file links", stripWikitextFiles, legacy.files],
    [
      "internal links",
      unpackInternalLinks,
      (t) => t.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1"),
    ],
  ];

  it.each(cases)("%s, on 30,000 random small texts", (_name, actual, expected) => {
    expect(disagreements(actual, expected)).toEqual([]);
  });

  it("the whole pipeline (every template pass included), on 30,000 random small texts", () => {
    expect(disagreements((t) => cleanWikiMarkup(t), legacyClean, 30_000, 99)).toEqual([]);
  });

  it("replaceInlineTemplates is the expression, applied where its `}}` is", () => {
    const flag = /\{\{(?:flag)\s*\|\s*([^|}]+)[^}]*\}\}/;
    expect(
      replaceInlineTemplates(
        "a {{flag| X }} b {{flag|}} {{FLAG|y}}",
        flag,
        (m) => `<${m[1]?.trim()}>`
      )
    ).toBe("a <X> b {{flag|}} <y>");
    expect(replaceInlineTemplates("{{flag|a", flag, () => "!")).toBe("{{flag|a");
    expect(replaceInlineTemplates("{{flag|a}", flag, () => "!")).toBe("{{flag|a}");
  });
});

// ---- hostile text, whole page (no ceiling) -------------------------------------------------------

describe("cleanWikiMarkup of a whole page (maxLength 0) on 2 MB of hostile text", () => {
  const SIZE = 2_000_000;
  const BUDGET_MS = 500;
  const FAMILIES = [
    "[[",
    "{{",
    "<!--",
    "<ref",
    "<ref>",
    "<gallery>",
    "<math>",
    "[[Category:",
    "[[Template:",
    "[[File:",
    "[http://a ",
    "[http://a",
    "[https://a",
    "<",
    "{{flag|a",
    "{{lang|a",
    "{{quote|a",
    "{{nowrap|a",
    "{{main|a",
    "{{convert|1|a|b",
    "[[a|",
    "==a\n",
    "{{Infobox\n",
    "{{a}{{",
    "}}{{",
    "{{a|",
    "<ref name=a />",
  ];

  it.each(FAMILIES)("reads %j repeated in under 500 ms", (unit) => {
    const text = unit.repeat(Math.ceil(SIZE / unit.length));
    const started = performance.now();
    cleanWikiMarkup(text);
    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
  });

  it.each([
    "{{convert|1|",
    "{{convert|1|a|",
    "{{flag|",
    "{{nowrap|",
    "{{quote|a|",
    "[http://a",
    "<ref>",
    "<!--",
    "[[Category:",
    "<",
    "{{lang|",
  ])("reads %j followed by one long run of blanks in under 500 ms", (head) => {
    const text = head + " ".repeat(SIZE) + "}}";
    const started = performance.now();
    cleanWikiMarkup(text);
    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
  });

  it("reads templates nested 300,000 deep in under 500 ms", () => {
    const text = "{{a".repeat(SIZE / 6) + "}}".repeat(SIZE / 6);
    const started = performance.now();
    cleanWikiMarkup(text);
    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
  });

  it("cleans all of a long page, not its first 20,000 characters", () => {
    const text = "Lead. ".repeat(10_000) + "[[Treaty|the treaty]] {{flag|Urcea}} <ref>x</ref> END";
    expect(cleanWikiMarkup(text).endsWith("the treaty Urcea END")).toBe(true);
  });
});

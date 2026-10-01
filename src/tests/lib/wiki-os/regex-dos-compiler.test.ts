/** @jest-environment node */
/**
 * The linear rewrites behind the fallback compiler (plan F15, the regex-DoS sweep): the infobox value readers,
 * the link rewriters and `parseWikitextToHtml` itself, each held against a verbatim copy of the code it replaced
 * on random small texts made of the tokens the code reads (so unbalanced openers and closers are the common
 * case) and on the real-looking pages of src/tests/fixtures/wikitext. The gate that they are fast is
 * regex-dos.test.ts.
 */
import { disagreements, fixtureTexts, randomTexts } from "../../helpers/wikitext-fuzz";
import { parseInfoboxWithTemplates } from "~/lib/wiki-os/adapters/ixstates/unified-parser";
import {
  replaceInlineTemplates,
  replacePipedLinks,
  replaceSimpleLinks,
  stripUnclosedTemplateTail,
} from "~/lib/wiki-os/transformers/clean-markup-passes";
import { getImageUrl, resolveImageUrl } from "~/lib/wiki-os/transformers/image-url";
import {
  cleanWikiValue,
  firstCoordBody,
  firstFormatnum,
  firstMagnitude,
  firstNumberPair,
  parseInfoboxToHtml,
  parsePopulation,
} from "~/lib/wiki-os/transformers/infobox-parser";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import {
  COMPILE_CEILING,
  imageDimensionAttributes,
  parseWikitextToHtml,
} from "~/lib/wiki-os/transformers/wikitext-parser";
import { findMatchingClosingBrackets } from "~/lib/wiki-os/wikitext/link-parser";
import { splitBalancedPipes } from "~/lib/wiki-os/wikitext/parameter-parser";
import {
  extractTableCellContent,
  splitBalancedDoubleTokens,
} from "~/lib/wiki-os/wikitext/table-parser";
import { parseInfoboxWithTemplates as legacyParseInfoboxWithTemplates } from "./legacy/unified-parser";

const fixtures = fixtureTexts();

// ---- infobox-parser ---------------------------------------------------------------------------------

/** `cleanWikiValue` as it was. */
function legacyCleanWikiValue(raw: string): string {
  let s = raw;
  s = s.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");
  s = s.replace(/'{2,3}/g, "");
  s = s.replace(/\{\{[^}]*\}\}/g, "");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&\w+;/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** `parsePopulation` as it was. */
function legacyParsePopulation(text: string): number | null {
  let clean = text.replace(/\{\{[^}]*\}\}/g, "").trim();
  const millMatch = clean.match(/([\d,.]+)\s*(million|billion|thousand)/i);
  if (millMatch) {
    const num = parseFloat(millMatch[1]!.replace(/,/g, ""));
    const mult = millMatch[2]!.toLowerCase();
    if (!isNaN(num)) {
      if (mult === "billion") return Math.round(num * 1e9);
      if (mult === "million") return Math.round(num * 1e6);
      if (mult === "thousand") return Math.round(num * 1e3);
    }
  }
  const fmtMatch = text.match(/\{\{formatnum[:|](\d[\d,]*)\}\}/i);
  if (fmtMatch) clean = fmtMatch[1]!;
  const num = parseFloat(clean.replace(/[,\s]/g, ""));
  return !isNaN(num) && num > 0 ? Math.round(num) : null;
}

const VALUE_TOKENS = [
  "[[",
  "]]",
  "[[a|b]]",
  "[[a]]",
  "[",
  "]",
  "|",
  "{{",
  "}}",
  "{{x}}",
  "{{coord|",
  "{{formatnum:",
  "{{formatnum|",
  "{{Formatnum:",
  "1",
  "2",
  "12",
  "3.5",
  ".",
  ",",
  "-",
  "- ",
  " ",
  "\n",
  "\u00a0",
  "million",
  "Billion",
  "THOUSAND",
  " million",
  "a",
  "<b>",
  "</b>",
  "<",
  ">",
  "''",
  "'''",
  "&amp;",
  "&",
  ";",
  "N",
  "E",
  "40",
  "79.5",
];

describe("infobox-parser: values are cleaned and read in one scan", () => {
  const texts = [
    ...randomTexts(VALUE_TOKENS, 60_000, 51, 12),
    ...fixtures.flatMap((t) => t.split("\n")),
  ];

  it("cleanWikiValue", () => {
    expect(disagreements(texts, cleanWikiValue, legacyCleanWikiValue)).toEqual([]);
  });

  it("parsePopulation", () => {
    expect(disagreements(texts, parsePopulation, legacyParsePopulation)).toEqual([]);
  });

  it("the {{coord|…}} body, the first pair of numbers, the magnitude and the formatnum value", () => {
    const captures = (text: string) => ({
      body: text.match(/\{\{coord\|([^}]+)\}\}/i)?.[1] ?? null,
      pair: ((m) => (m ? [m[1], m[2]] : null))(text.match(/(-?\d+\.?\d*)\s*[,|]\s*(-?\d+\.?\d*)/)),
      magnitude: ((m) => (m ? [m[1], m[2]] : null))(
        text.match(/([\d,.]+)\s*(million|billion|thousand)/i)
      ),
      formatnum: text.match(/\{\{formatnum[:|](\d[\d,]*)\}\}/i)?.[1] ?? null,
    });
    const scanned = (text: string) => ({
      body: firstCoordBody(text),
      pair: firstNumberPair(text),
      magnitude: firstMagnitude(text),
      formatnum: firstFormatnum(text),
    });
    expect(disagreements(texts, scanned, captures)).toEqual([]);
  });
});

describe("clean-markup-passes: piped and simple links are rewritten where the expression rewrote them", () => {
  const LINK_TOKENS = [
    "[[",
    "]]",
    "[",
    "]",
    "|",
    "a",
    "b c",
    " ",
    "[[a|b]]",
    "[[a]]",
    "[[|x]]",
    "[[a|]]",
    "]]]",
    "[[[",
    "\n",
    "{{",
    "}}",
  ];
  const texts = [...randomTexts(LINK_TOKENS, 60_000, 52, 12), ...fixtures];

  it("replacePipedLinks", () => {
    expect(
      disagreements(
        texts,
        (t) => replacePipedLinks(t, (target, label) => `<${target}>${label}</>`),
        (t) =>
          t.replace(
            /\[\[([^|\]]+)\|([^\]]+)\]\]/g,
            (_m, target: string, label: string) => `<${target}>${label}</>`
          )
      )
    ).toEqual([]);
  });

  it("replaceSimpleLinks", () => {
    expect(
      disagreements(
        texts,
        (t) => replaceSimpleLinks(t, (target) => `<${target}>`),
        (t) => t.replace(/\[\[([^\]]+)\]\]/g, (_m, target: string) => `<${target}>`)
      )
    ).toEqual([]);
  });
});

// ---- wikitext-parser: parseWikitextToHtml, the whole compiler ----------------------------------------------
// The compiler as it was (verbatim from before the sweep, renamed): its regular-expression passes over the text.

/**
 * Strips recursively nested templates (e.g. {{Infobox ... {{flag|...}} ... }})
 * while selectively unpacking useful inline templates (quotes, main links, flags, lang).
 */
function legacyStripWikitextTemplates(input: string): string {
  if (!input || !input.includes("{{")) return input;

  let text = input;

  // 1. Process inline text templates that should render nicely. Each is cut at the first `}}` (see
  // replaceInlineTemplates), so a page of `{{flag|` that never closes is read once, not once per opener.
  // Handle {{flag|Urcea}} -> Urcea, {{flagicon|Urcea}} -> ""
  text = replaceInlineTemplates(
    text,
    /\{\{(?:flag|flagcountry|flagicon)\s*\|\s*([^|}]+)[^}]*\}\}/,
    (match) => (match[0].toLowerCase().includes("flagicon") ? "" : (match[1] ?? "").trim())
  );

  // Handle {{quote|Text|Author}} or {{blockquote|Text}}
  text = replaceInlineTemplates(
    text,
    /\{\{(?:quote|blockquote|cite quote)\s*\|\s*([^|}]+)(?:\|([^|}]+))?[^}]*\}\}/,
    (match) => {
      const q = (match[1] ?? "").trim();
      const a = match[2] ? match[2].trim() : "";
      return `\n\n<blockquote class="my-2 border-l-2 border-primary/50 pl-3 italic text-muted-foreground">${q}${a ? ` &mdash; <span class="font-semibold text-foreground">${a}</span>` : ""}</blockquote>\n\n`;
    }
  );

  // Handle {{main|Article}} or {{see also|Article}} or {{further|Article}}
  text = replaceInlineTemplates(
    text,
    /\{\{(?:main|main article|see also|further)\s*\|\s*([^|}]+)[^}]*\}\}/,
    (match) => {
      const t = (match[1] ?? "").trim();
      const route = titleToWikiOSRoute(t);
      return `\n\n<p class="text-xs italic text-muted-foreground/80 my-1 font-medium">Main article: <a href="${route}" class="text-primary hover:underline font-semibold">${t}</a></p>\n\n`;
    }
  );

  // Handle {{convert|val|unit1|unit2}} -> "val unit1". (No `\s*` around the units: the characters they
  // may hold already include blanks, and a run of blanks there made the expression quadratic.)
  text = replaceInlineTemplates(
    text,
    /\{\{convert\s*\|\s*([\d.]+)\s*\|([^|}]+)\|[^|}]+[^}]*\}\}/,
    (match) => `${match[1] ?? ""} ${(match[2] ?? "").trim()}`
  );

  // Handle {{lang|code|text}} or {{lang-xx|text}}
  text = replaceInlineTemplates(
    text,
    /\{\{lang(?:-[a-z]+)?\s*\|(?:[a-z-]+\|)?([^|}]+)[^}]*\}\}/,
    (match) => match[1] ?? ""
  );

  // Handle {{nowrap|text}}, {{small|text}}, {{smaller|text}}, {{nobr|text}}
  text = replaceInlineTemplates(
    text,
    /\{\{(?:nowrap|nobr|small|smaller|font)\s*\|\s*([^|}]+)[^}]*\}\}/,
    (match) => match[1] ?? ""
  );

  // 2. Strip multiline unclosed top-level templates (e.g. Infobox truncated at end of excerpt)
  text = text.replace(
    /^\{\{(?:Infobox|Sidebar|Taxobox|Navigation|Notice|Short description|About|Redirect|Distinguish|Other uses)\b[\s\S]*?(?=\n\n[A-Z0-9'"]|\n==|$)/gi,
    (match) => {
      const openCount = (match.match(/\{\{/g) || []).length;
      const closeCount = (match.match(/\}\}/g) || []).length;
      // If template is unclosed at the end of the excerpt cut, drop it completely
      if (openCount > closeCount) return "";
      return match;
    }
  );

  // 3. Iteratively strip all remaining balanced {{...}} templates
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
      if (templateName === "lang" && parts.length >= 3) {
        return parts[2]?.trim() || "";
      }
      if (templateName?.startsWith("formatnum:")) {
        return templateName.replace("formatnum:", "").trim();
      }

      return "";
    });

    if (text === prev) break;
  }

  // 4. Cleanup any unclosed {{... at the end or stray unattached }}
  text = stripUnclosedTemplateTail(text);
  text = text.replace(/^[^{]*\}\}/g, "");
  text = text.replace(/\{\{|\}\}/g, "");

  return text;
}

/**
 * Converts MediaWiki wikitables ({| ... |}) to responsive HTML tables.
 */
function legacyParseWikitables(input: string): string {
  if (!input.includes("{|")) return input;

  return input.replace(/\{\|([\s\S]*?)\|\}/g, (_match, content: string) => {
    const lines = content.split("\n");
    let html =
      '\n\n<div class="my-3 overflow-x-auto rounded-xl border border-border/40 bg-card/60 backdrop-blur-md shadow-xs"><table class="w-full text-xs text-left border-collapse">';
    let inRow = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("{|") || trimmed.startsWith("|}")) continue;

      if (trimmed.startsWith("|-")) {
        if (inRow) html += "</tr>";
        html += '<tr class="border-b border-border/30 hover:bg-muted/20 transition-colors">';
        inRow = true;
        continue;
      }

      if (trimmed.startsWith("!")) {
        if (!inRow) {
          html += '<tr class="border-b border-border/40 bg-muted/30">';
          inRow = true;
        }
        const cells = splitBalancedDoubleTokens(trimmed.substring(1), "!!");
        for (const cell of cells) {
          const { attributes, content: cellContent } = extractTableCellContent(cell);
          const attrStr = attributes ? ` ${attributes}` : "";
          html += `<th class="p-2 font-bold text-foreground bg-muted/20 border-r border-border/20 last:border-r-0"${attrStr}>${cellContent}</th>`;
        }
      } else if (trimmed.startsWith("|")) {
        if (!inRow) {
          html += '<tr class="border-b border-border/30 hover:bg-muted/20 transition-colors">';
          inRow = true;
        }
        const cells = splitBalancedDoubleTokens(trimmed.substring(1), "||");
        for (const cell of cells) {
          const { attributes, content: cellContent } = extractTableCellContent(cell);
          const attrStr = attributes ? ` ${attributes}` : "";
          html += `<td class="p-2 text-muted-foreground border-r border-border/20 last:border-r-0"${attrStr}>${cellContent}</td>`;
        }
      }
    }

    if (inRow) html += "</tr>";
    html += "</table></div>\n\n";
    return html;
  });
}

/**
 * Converts wikitext file and image tags to HTML figure/img elements,
 * properly handling nested links and balanced brackets in captions.
 */
function legacyConvertWikitextImages(text: string, wikiSource: string): string {
  let result = "";
  let i = 0;

  while (i < text.length) {
    const prefix = text.slice(i, i + 8).toLowerCase();
    if (prefix.startsWith("[[file:") || prefix.startsWith("[[image:")) {
      const closeIdx = findMatchingClosingBrackets(text, i);
      if (closeIdx !== -1) {
        const raw = text.slice(i, closeIdx + 2);
        const inner = raw.slice(2, -2);
        const colonIdx = inner.indexOf(":");
        const content = inner.slice(colonIdx + 1);
        const parts = splitBalancedPipes(content).map((p) => p.trim());

        if (parts.length > 0 && parts[0]) {
          const rawFileName = parts[0];
          const imageUrl =
            resolveImageUrl(rawFileName, wikiSource as any) ?? getImageUrl(rawFileName);

          if (imageUrl) {
            const captionParts = parts.slice(1).filter((p) => {
              const lower = p.toLowerCase();
              return !(
                lower === "thumb" ||
                lower === "thumbnail" ||
                lower === "frame" ||
                lower === "framed" ||
                lower === "frameless" ||
                lower === "border" ||
                lower === "left" ||
                lower === "right" ||
                lower === "center" ||
                lower === "none" ||
                /^\d+px$/i.test(lower) ||
                /^upright(=[\d.]+)?$/i.test(lower) ||
                lower.startsWith("alt=") ||
                lower.startsWith("link=")
              );
            });

            const caption = captionParts.join(" | ");
            const dimensions = imageDimensionAttributes(parts.slice(1));

            result += `\n\n<figure class="my-3 overflow-hidden rounded-xl border border-border/40 bg-card/60 shadow-xs backdrop-blur-md">
      <img src="${imageUrl}" alt="${caption || rawFileName}" class="max-h-48 w-full object-cover rounded-t-xl" loading="lazy"${dimensions} />
      ${
        caption
          ? `<figcaption class="p-2 text-xs text-muted-foreground font-medium bg-muted/20 border-t border-border/40 leading-tight">${caption}</figcaption>`
          : ""
      }
    </figure>\n\n`;
          }
        }
        i = closeIdx + 2;
        continue;
      }
    }

    result += text[i];
    i++;
  }

  return result;
}

/**
 * Robust wikitext parser that converts raw MediaWiki markup into clean HTML
 * for display in card modals, wiki previews, and lore excerpts.
 */
function legacyParseWikitextToHtml(
  wikitext: string | null | undefined,
  wikiSource: string = "ixwiki"
): string {
  if (!wikitext || !wikitext.trim()) return "";

  let text = wikitext;

  // 1. Strip blurb tags: [blurb:slug|Title]
  text = text.replace(/^\[blurb:[^\]]+\]\s*/gi, "");

  // 2. Strip HTML comments: <!-- ... -->
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // 3. Strip MediaWiki magic words & behavior switches
  text = text.replace(/__(?:NOTOC|TOC|NOEDITSECTION|FORCETOC|SHOWFACTBOX|DISAMBIG)__/gi, "");

  // 4. Parse references / footnotes (<ref>...</ref>)
  const references: string[] = [];
  const refMap = new Map<string, number>();

  text = text.replace(
    /<ref(?:\s+name=["']?([^"'>\s]+)["']?)?(?:\s*\/>|>(.*?)<\/ref>)/gis,
    (_match, name, content) => {
      const cleanName = name ? name.trim() : "";
      if (cleanName && refMap.has(cleanName)) {
        const idx = refMap.get(cleanName)!;
        return `<sup class="reference" id="cite_ref-${idx}"><a href="#cite_note-${idx}">[${idx}]</a></sup>`;
      }
      const idx = references.length + 1;
      if (cleanName) refMap.set(cleanName, idx);
      const refContent = (content || "").trim();
      references.push(refContent || cleanName);
      return `<sup class="reference" id="cite_ref-${idx}"><a href="#cite_note-${idx}">[${idx}]</a></sup>`;
    }
  );

  // 5. Strip galleries & math tags
  text = text.replace(/<gallery\b[^>]*>[\s\S]*?<\/gallery>/gi, "");
  text = text.replace(/<math\b[^>]*>[\s\S]*?<\/math>/gi, "");

  // 6. Convert wikitables to responsive HTML tables
  text = legacyParseWikitables(text);

  // 6b. Extract and convert Infobox template to HTML table before stripping
  const infoboxHtml = parseInfoboxToHtml(text);

  // 7. Strip recursively nested templates: {{...}}
  text = legacyStripWikitextTemplates(text);

  // 8. Strip category tags: [[Category:...]], [Category:...]
  text = text.replace(/\[\[(?:category|Category):[^\]]+\]\]/gi, "");
  text = text.replace(/\[(?:category|Category):[^\]]+\]/gi, "");

  // 8b. Strip Template:Name references from MediaWiki extracts
  text = text.replace(/\[\[(?:Template|template):[^\]]+\]\]/gi, "");
  text = text.replace(/\[(?:Template|template):[^\]]+\]/gi, "");
  text = text.replace(/(?:Template|template)\s*:[^\n.<|\]}]*/gi, "");

  // 9. Convert wikitext images: [[File:name.jpg|thumb|200px|Caption]] or [[Image:name.png|...]]
  text = legacyConvertWikitextImages(text, wikiSource);

  // 10. Convert wikitext headings
  text = text.replace(
    /^====\s*(.*?)\s*====/gm,
    '\n\n<h6 class="text-xs font-bold uppercase tracking-wider text-foreground mt-3 mb-1">$1</h6>\n\n'
  );
  text = text.replace(
    /^===\s*(.*?)\s*===/gm,
    '\n\n<h5 class="text-sm font-bold text-foreground mt-3.5 mb-1.5">$1</h5>\n\n'
  );
  text = text.replace(
    /^==\s*(.*?)\s*==/gm,
    '\n\n<h4 class="text-base font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border/40">$1</h4>\n\n'
  );

  // 11. Convert bullet lists (* item)
  text = text.replace(/(?:^\*\s*.*(?:\n|$))+/gm, (match) => {
    const items = match
      .split(/\n/)
      .map((line) => line.replace(/^\*+\s*/, "").trim())
      .filter(Boolean)
      .map(
        (item) =>
          `<li class="ml-4 list-disc text-muted-foreground my-0.5 leading-relaxed">${item}</li>`
      )
      .join("");
    return items ? `\n\n<ul class="my-2 space-y-1">${items}</ul>\n\n` : "";
  });

  // 12. Convert numbered lists (# item)
  text = text.replace(/(?:^#\s*.*(?:\n|$))+/gm, (match) => {
    const items = match
      .split(/\n/)
      .map((line) => line.replace(/^#+\s*/, "").trim())
      .filter(Boolean)
      .map(
        (item) =>
          `<li class="ml-4 list-decimal text-muted-foreground my-0.5 leading-relaxed">${item}</li>`
      )
      .join("");
    return items ? `\n\n<ol class="my-2 space-y-1">${items}</ol>\n\n` : "";
  });

  // 13. Convert definition/indents (: item)
  text = text.replace(/(?:^[:;]\s*.*(?:\n|$))+/gm, (match) => {
    const items = match
      .split(/\n/)
      .map((line) => line.replace(/^[:;]+\s*/, "").trim())
      .filter(Boolean)
      .map((item) => `<p class="ml-4 text-muted-foreground my-1 leading-relaxed">${item}</p>`)
      .join("");
    return items ? `\n\n${items}\n\n` : "";
  });

  // 14. Convert horizontal rules: ----
  text = text.replace(/^----+/gm, '\n\n<hr class="my-4 border-border/40" />\n\n');

  // 15. Convert bold+italic: '''''text'''''
  text = text.replace(/'''''((?:(?!''''')[\s\S])+)'''''/g, "<strong><em>$1</em></strong>");

  // 16. Convert bold: '''text'''
  text = text.replace(
    /'''((?:(?!''')[\s\S])+)'''/g,
    '<strong class="font-bold text-foreground">$1</strong>'
  );

  // 17. Convert italic: ''text''
  text = text.replace(/''((?:(?!'')[\s\S])+)''/g, '<em class="italic text-foreground/90">$1</em>');

  // 18. Convert strikethrough: <s>text</s>, <del>text</del>, ~~text~~
  text = text.replace(
    /<s>([\s\S]*?)<\/s>|<del>([\s\S]*?)<\/del>|~~([\s\S]*?)~~/gi,
    (_m, g1, g2, g3) => {
      const inner = g1 || g2 || g3 || "";
      return `<del class="line-through opacity-75">${inner}</del>`;
    }
  );

  // 19. Convert underline: <u>text</u>
  text = text.replace(/<u>([\s\S]*?)<\/u>/gi, '<u class="underline decoration-primary/60">$1</u>');

  // 20. Convert code/tt: <code>text</code>, <tt>text</tt>
  text = text.replace(/<code>([\s\S]*?)<\/code>|<tt>([\s\S]*?)<\/tt>/gi, (_m, g1, g2) => {
    const inner = g1 || g2 || "";
    return `<code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-xs text-primary">${inner}</code>`;
  });

  // 21. Convert pre blocks: <pre>text</pre>
  text = text.replace(/<pre>([\s\S]*?)<\/pre>/gi, (_m, content) => {
    return `\n\n<pre class="my-2 overflow-x-auto rounded-lg bg-muted/40 p-3 font-mono text-xs text-foreground">${content}</pre>\n\n`;
  });

  // 22. Convert piped internal links: [[Target Page|Display Label]]
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_match, page: string, label: string) => {
    const route = titleToWikiOSRoute(page.trim());
    return `<a href="${route}" class="text-primary font-semibold hover:underline">${label.trim()}</a>`;
  });

  // 23. Convert simple internal links: [[Target Page]]
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_match, page: string) => {
    const p = page.trim();
    const route = titleToWikiOSRoute(p);
    return `<a href="${route}" class="text-primary font-semibold hover:underline">${p}</a>`;
  });

  // 24. Convert external links with label: [http://example.com Display Label]
  text = text.replace(
    /\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary font-semibold hover:underline inline-flex items-center gap-1">$2</a>'
  );

  // 25. Convert external links without label: [http://example.com]
  text = text.replace(
    /\[(https?:\/\/[^\s\]]+)\]/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">[link]</a>'
  );

  // 25b. Expand references list
  if (references.length > 0) {
    const reflistHtml = `\n\n<ol class="references text-xs space-y-1 my-3 pl-5 list-decimal text-muted-foreground">${references
      .map(
        (ref, i) =>
          `<li id="cite_note-${i + 1}" class="leading-relaxed"><span class="mw-cite-backlink"><a href="#cite_ref-${i + 1}" class="text-wiki mr-1">↑</a></span>${ref}</li>`
      )
      .join("")}</ol>\n\n`;

    if (/<references\b[^>]*\/?>/i.test(text)) {
      text = text.replace(/<references\b[^>]*\/?>/gi, reflistHtml);
    } else if (/\{\{[Rr]eflist[^}]*\}\}/i.test(text)) {
      text = text.replace(/\{\{[Rr]eflist[^}]*\}\}/gi, reflistHtml);
    } else {
      text += `\n\n<h4 class="text-base font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border/40">References</h4>${reflistHtml}`;
    }
  } else {
    text = text.replace(/<references\b[^>]*\/?>/gi, "");
    text = text.replace(/\{\{[Rr]eflist[^}]*\}\}/gi, "");
  }

  // 26. Format Paragraphs
  const rawParagraphs = text.split(/\n\s*\n+/);
  const formattedParagraphs: string[] = [];

  for (const block of rawParagraphs) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;

    // Check if block is already a block-level HTML element
    if (
      trimmedBlock.startsWith("<h4") ||
      trimmedBlock.startsWith("<h5") ||
      trimmedBlock.startsWith("<h6") ||
      trimmedBlock.startsWith("<ul") ||
      trimmedBlock.startsWith("<ol") ||
      trimmedBlock.startsWith("<figure") ||
      trimmedBlock.startsWith("<blockquote") ||
      trimmedBlock.startsWith("<table") ||
      trimmedBlock.startsWith("<div") ||
      trimmedBlock.startsWith("<hr") ||
      trimmedBlock.startsWith("<pre")
    ) {
      formattedParagraphs.push(trimmedBlock);
      continue;
    }

    // Standard paragraph: replace single line breaks with space
    const withBreaks = trimmedBlock.replace(/\n(?!\n)/g, " ");
    formattedParagraphs.push(
      `<p class="text-xs sm:text-sm leading-relaxed text-muted-foreground mb-3">${withBreaks}</p>`
    );
  }

  const htmlOutput = formattedParagraphs.join("\n\n").trim();
  return infoboxHtml ? `${infoboxHtml}\n\n${htmlOutput}` : htmlOutput;
}

const COMPILER_TOKENS = [
  "<ref>",
  "</ref>",
  "<ref name=a>",
  '<ref name="b"/>',
  "<ref name=a/>",
  "<ref name='c' />",
  "<REF",
  "<refx>",
  "<ref ",
  "name=",
  "<references/>",
  "<references>",
  "<references group=x />",
  "{{reflist}}",
  "{{Reflist|2}}",
  "{|",
  "|}",
  "|-",
  "|",
  "!",
  "!!",
  "||",
  'style="a" |',
  "{{Infobox country\n| name = X\n| capital = [[Y]]\n}}",
  "{{Infobox",
  "}}",
  "{{",
  "{{flag|x}}",
  "{{nowrap|n}}",
  "{{quote|q|a}}",
  "{{convert|1|km|mi}}",
  "[[a]]",
  "[[a|b]]",
  "[[",
  "]]",
  "[",
  "]",
  "[[File:a.png|thumb|cap [[x]]]]",
  "[[Image:b.jpg|200px|alt=z]]",
  "[[File:",
  "[[Category:C]]",
  "[Category:D]",
  "[[category:",
  "[[Template:T]]",
  "[Template:U]",
  "Template:X",
  "Template :Y",
  "== H ==",
  "=== H ===",
  "==== H ====",
  "==",
  "===",
  "====",
  "=",
  "\n",
  "\n",
  "\n\n",
  " ",
  " ",
  "\t",
  "\u00a0",
  "\r",
  "* a",
  "# b",
  ": c",
  "; d",
  "----",
  "'''",
  "''",
  "'''''",
  "<s>",
  "</s>",
  "<S>",
  "<del>",
  "</del>",
  "~~",
  "<u>",
  "</u>",
  "<code>",
  "</code>",
  "<tt>",
  "</tt>",
  "<pre>",
  "</pre>",
  "<gallery>",
  "</gallery>",
  "<math>",
  "</math>",
  "<!--",
  "-->",
  "<!-- c -->",
  "[http://a.b]",
  "[http://a.b label]",
  "[http://a.b  ]",
  "[https://c.d x y]",
  "__TOC__",
  "[blurb:x|y] ",
  "<blockquote>q</blockquote>",
  "a",
  "bc",
  "Hello world",
  "Üñï",
  "&amp;",
  "<",
  ">",
  "{",
  "}",
];

describe("wikitext-parser: parseWikitextToHtml answers what it answered", () => {
  it("on 30,000 random small texts", () => {
    const texts = randomTexts(COMPILER_TOKENS, 30_000, 81, 14);
    expect(
      disagreements(
        texts,
        (t) => parseWikitextToHtml(t, "ixwiki"),
        (t) => legacyParseWikitextToHtml(t, "ixwiki")
      )
    ).toEqual([]);
  });

  it("on every real-looking page, whole and cut at every blank line", () => {
    const pieces = fixtures.flatMap((text) => [text, ...text.split(/\n\n+/)]);
    expect(
      disagreements(
        pieces,
        (t) => parseWikitextToHtml(t, "ixwiki"),
        (t) => legacyParseWikitextToHtml(t, "ixwiki")
      )
    ).toEqual([]);
  });

  it("serves a text over its ceiling as escaped source, with a notice, and compiles one at it", () => {
    const over = `<b>${"a & b ".repeat(55_000)}`;
    expect(over.length).toBeGreaterThan(COMPILE_CEILING);
    const html = parseWikitextToHtml(over);
    expect(html.startsWith('<p class="wikios-fallback-notice">')).toBe(true);
    expect(html).toContain('<pre class="wikios-fallback-plain">&lt;b&gt;a &amp; b a &amp; b ');
    expect(html.endsWith("</pre>")).toBe(true);
    expect(html.match(/<pre/g)).toHaveLength(1);
    const atCeiling = "a ".repeat(COMPILE_CEILING / 2);
    expect(atCeiling).toHaveLength(COMPILE_CEILING);
    expect(parseWikitextToHtml(atCeiling)).toBe(
      `<p class="text-xs sm:text-sm leading-relaxed text-muted-foreground mb-3">${atCeiling.trim()}</p>`
    );
  });
});

// ---- adapters/ixstates/unified-parser ----------------------------------------------------------------------

const FIELD_TOKENS = [
  "<ref>",
  "</ref>",
  "<ref name=a>",
  "<ref name=a/>",
  "<ref />",
  "<REF",
  "<refx>y</ref>",
  "<small>",
  "</small>",
  "<nowiki>",
  "</nowiki>",
  "<br>",
  "<br />",
  "<!--",
  "-->",
  "<!-- c -->",
  "[[a]]",
  "[[a|b]]",
  "[[",
  "]]",
  "[[File:x.png|thumb]]",
  "[[x.png|100px]]",
  "{{flag|Urcea}}",
  "{{convert|12|km|mi}}",
  "{{formatnum:1234}}",
  "{{Switcher|[[File:a.png]]|b}}",
  "{{plainlist|a|b}}",
  "{{nts|5}}",
  "{{sort|a|b}}",
  "{{small|s}}",
  "{{HDI data|2020|x|0.9}}",
  "{{start date|2020|1|2}}",
  "'''",
  "''",
  "&amp;",
  " ",
  ",",
  ", ",
  "|",
  "text",
  "Urcea",
  "1,234",
  "5 million",
  "40|N",
  "<b>b</b>",
  "{{x}}",
];

describe("unified-parser: infobox values are cleaned by scanning", () => {
  const infobox = (value: string) =>
    `{{Infobox country\n| conventional_long_name = ${value}\n| capital = ${value}\n| image_flag = ${value}\n| population_estimate = ${value}\n| leader_name1 = ${value}\n}}`;
  it("parseInfoboxWithTemplates answers what it answered, on 25,000 random fields", () => {
    const texts = [...randomTexts(FIELD_TOKENS, 25_000, 121, 12)].map(infobox);
    expect(
      disagreements(
        texts,
        (t) => parseInfoboxWithTemplates(t, "Urcea"),
        (t) => legacyParseInfoboxWithTemplates(t, "Urcea")
      )
    ).toEqual([]);
  });
});

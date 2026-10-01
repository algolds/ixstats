import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { resolveImageUrl, getImageUrl } from "./image-url";
import { parseInfoboxToHtml } from "./infobox-parser";
import { splitBalancedPipes } from "../wikitext/parameter-parser";
import { findMatchingClosingBrackets } from "../wikitext/link-parser";
import { matchBrackets } from "../wikitext/match-index";
import {
  nextFileOpener,
  replaceBareExternalLinks,
  replaceInlineTemplates,
  replaceLabelledExternalLinks,
  replacePipedLinks,
  replaceSimpleLinks,
  stripBareExternalLinks,
  stripComments,
  stripHtmlTags,
  stripNamespacedLinks,
  stripSelfClosingRefs,
  stripTagBlocks,
  stripUnclosedTemplateTail,
  unpackExternalLinks,
  unpackInternalLinks,
} from "./clean-markup-passes";
import {
  hasReferencesTag,
  hasReflist,
  replaceDelimited,
  replaceHeadings,
  replaceReferencesTags,
  replaceReflists,
  replaceRefs,
  replaceWikitables,
  stripNamespacedBrackets,
} from "./compile-passes";
import { extractTableCellContent, splitBalancedDoubleTokens } from "../wikitext/table-parser";

export { unpackInternalLinks };

/**
 * Strips recursively nested templates (e.g. {{Infobox ... {{flag|...}} ... }})
 * while selectively unpacking useful inline templates (quotes, main links, flags, lang).
 */
function stripWikitextTemplates(input: string): string {
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
function parseWikitables(input: string): string {
  if (!input.includes("{|")) return input;

  return replaceWikitables(input, (content) => {
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
 * ` width="…" height="…"` for an image whose wikitext gave its size (`300px`, `300x200px`): the
 * browser reserves the picture's box before it loads. Nothing for a size not given, and the height
 * only when the text names one.
 */
export function imageDimensionAttributes(params: readonly string[]): string {
  for (const param of params) {
    const size = /^(\d+)(?:x(\d+))?px$/i.exec(param.trim());
    if (size) return ` width="${size[1]}"${size[2] ? ` height="${size[2]}"` : ""}`;
  }
  return "";
}

/**
 * Converts wikitext file and image tags to HTML figure/img elements,
 * properly handling nested links and balanced brackets in captions.
 */
function convertWikitextImages(text: string, wikiSource: string): string {
  let result = "";
  let i = 0;
  // Where every `[[` closes, from one pass: scanning forward from each opener would be quadratic on a page
  // with thousands of openers that never close.
  const index = matchBrackets(text);

  while (i < text.length) {
    // Text between links is copied whole, not a character at a time.
    const open = text.indexOf("[[", i);
    if (open === -1) break;
    result += text.slice(i, open);
    i = open;
    const prefix = text.slice(i, i + 8).toLowerCase();
    if (prefix.startsWith("[[file:") || prefix.startsWith("[[image:")) {
      const closeIdx = findMatchingClosingBrackets(text, i, index);
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

  return result + text.slice(i);
}

/**
 * Strips wikitext file, image, and media links, properly handling nested brackets.
 */
export function stripWikitextFiles(text: string): string {
  const pieces: string[] = [];
  let copied = 0;
  let from = 0;
  // Where every `[[` closes, from one pass: scanning forward from each opener would be quadratic on a page
  // with thousands of openers that never close.
  const index = matchBrackets(text);

  for (;;) {
    const open = nextFileOpener(text, from);
    if (open === -1) break;
    const closeIdx = findMatchingClosingBrackets(text, open, index);
    if (closeIdx === -1) {
      from = open + 1;
      continue;
    }
    pieces.push(text.slice(copied, open));
    copied = from = closeIdx + 2;
  }
  pieces.push(text.slice(copied));
  return pieces.join("");
}

/**
 * ponytail: COMPILE_CEILING, 300,000 characters: the most wikitext `parseWikitextToHtml` compiles. It is
 * the in-process fallback for a page MediaWiki could not render (a reader's page or an old revision, an
 * editor preview) and compiles lore cards and feed excerpts in the browser. Page text is user-controlled
 * and up to 2,000,000 characters and the compiler is a chain of regular-expression passes, so above this
 * a text is shown as its escaped source (`plainFallbackHtml`): a hostile page costs one copy, not a compile.
 */
export const COMPILE_CEILING = 300_000;

/** The source of a page too large to compile: HTML-escaped in a `<pre>`, under a short notice. */
export function plainFallbackHtml(wikitext: string): string {
  const escaped = wikitext.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return (
    '<p class="wikios-fallback-notice">This page is too large to format right now, so its source text is shown as it is.</p>' +
    `<pre class="wikios-fallback-plain">${escaped}</pre>`
  );
}

/**
 * Robust wikitext parser that converts raw MediaWiki markup into clean HTML
 * for display in card modals, wiki previews, and lore excerpts.
 */
export function parseWikitextToHtml(
  wikitext: string | null | undefined,
  wikiSource: string = "ixwiki"
): string {
  if (!wikitext || !wikitext.trim()) return "";
  if (wikitext.length > COMPILE_CEILING) return plainFallbackHtml(wikitext);

  let text = wikitext;

  // 1. Strip blurb tags: [blurb:slug|Title]
  text = text.replace(/^\[blurb:[^\]]+\]\s*/gi, "");

  // 2. Strip HTML comments: <!-- ... -->
  text = stripComments(text);

  // 3. Strip MediaWiki magic words & behavior switches
  text = text.replace(/__(?:NOTOC|TOC|NOEDITSECTION|FORCETOC|SHOWFACTBOX|DISAMBIG)__/gi, "");

  // 4. Parse references / footnotes (<ref>...</ref>)
  const references: string[] = [];
  const refMap = new Map<string, number>();

  text = replaceRefs(text, ({ name, content }) => {
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
  });

  // 5. Strip galleries & math tags
  text = stripTagBlocks(text, "gallery");
  text = stripTagBlocks(text, "math");

  // 6. Convert wikitables to responsive HTML tables
  text = parseWikitables(text);

  // 6b. Extract and convert Infobox template to HTML table before stripping
  const infoboxHtml = parseInfoboxToHtml(text);

  // 7. Strip recursively nested templates: {{...}}
  text = stripWikitextTemplates(text);

  // 8. Strip category tags: [[Category:...]], [Category:...]
  text = stripNamespacedLinks(text, "category:");
  text = stripNamespacedBrackets(text, "category:");

  // 8b. Strip Template:Name references from MediaWiki extracts
  text = stripNamespacedLinks(text, "template:");
  text = stripNamespacedBrackets(text, "template:");
  text = text.replace(/(?:Template|template)\s*:[^\n.<|\]}]*/gi, "");

  // 9. Convert wikitext images: [[File:name.jpg|thumb|200px|Caption]] or [[Image:name.png|...]]
  text = convertWikitextImages(text, wikiSource);

  // 10. Convert wikitext headings
  text = replaceHeadings(
    text,
    4,
    (title) =>
      `\n\n<h6 class="text-xs font-bold uppercase tracking-wider text-foreground mt-3 mb-1">${title}</h6>\n\n`
  );
  text = replaceHeadings(
    text,
    3,
    (title) => `\n\n<h5 class="text-sm font-bold text-foreground mt-3.5 mb-1.5">${title}</h5>\n\n`
  );
  text = replaceHeadings(
    text,
    2,
    (title) =>
      `\n\n<h4 class="text-base font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border/40">${title}</h4>\n\n`
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
  const strike = (inner: string) => `<del class="line-through opacity-75">${inner}</del>`;
  text = replaceDelimited(text, [
    { open: "<s>", close: "</s>", render: strike },
    { open: "<del>", close: "</del>", render: strike },
    { open: "~~", close: "~~", render: strike },
  ]);

  // 19. Convert underline: <u>text</u>
  text = replaceDelimited(text, [
    {
      open: "<u>",
      close: "</u>",
      render: (inner) => `<u class="underline decoration-primary/60">${inner}</u>`,
    },
  ]);

  // 20. Convert code/tt: <code>text</code>, <tt>text</tt>
  const code = (inner: string) =>
    `<code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-xs text-primary">${inner}</code>`;
  text = replaceDelimited(text, [
    { open: "<code>", close: "</code>", render: code },
    { open: "<tt>", close: "</tt>", render: code },
  ]);

  // 21. Convert pre blocks: <pre>text</pre>
  text = replaceDelimited(text, [
    {
      open: "<pre>",
      close: "</pre>",
      render: (content) =>
        `\n\n<pre class="my-2 overflow-x-auto rounded-lg bg-muted/40 p-3 font-mono text-xs text-foreground">${content}</pre>\n\n`,
    },
  ]);

  // 22. Convert piped internal links: [[Target Page|Display Label]]
  text = replacePipedLinks(text, (page, label) => {
    const route = titleToWikiOSRoute(page.trim());
    return `<a href="${route}" class="text-primary font-semibold hover:underline">${label.trim()}</a>`;
  });

  // 23. Convert simple internal links: [[Target Page]]
  text = replaceSimpleLinks(text, (page) => {
    const p = page.trim();
    const route = titleToWikiOSRoute(p);
    return `<a href="${route}" class="text-primary font-semibold hover:underline">${p}</a>`;
  });

  // 24. Convert external links with label: [http://example.com Display Label]
  text = replaceLabelledExternalLinks(
    text,
    (url, label) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary font-semibold hover:underline inline-flex items-center gap-1">${label}</a>`
  );

  // 25. Convert external links without label: [http://example.com]
  text = replaceBareExternalLinks(
    text,
    (url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">[link]</a>`
  );

  // 25b. Expand references list
  if (references.length > 0) {
    const reflistHtml = `\n\n<ol class="references text-xs space-y-1 my-3 pl-5 list-decimal text-muted-foreground">${references
      .map(
        (ref, i) =>
          `<li id="cite_note-${i + 1}" class="leading-relaxed"><span class="mw-cite-backlink"><a href="#cite_ref-${i + 1}" class="text-wiki mr-1">↑</a></span>${ref}</li>`
      )
      .join("")}</ol>\n\n`;

    if (hasReferencesTag(text)) {
      text = replaceReferencesTags(text, reflistHtml);
    } else if (hasReflist(text)) {
      text = replaceReflists(text, reflistHtml);
    } else {
      text += `\n\n<h4 class="text-base font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border/40">References</h4>${reflistHtml}`;
    }
  } else {
    text = replaceReferencesTags(text, "");
    text = replaceReflists(text, "");
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

/**
 * ponytail: the most an EXCERPT (`cleanWikiMarkup` with `maxLength > 0`) reads of a text, 20,000
 * characters: it only shows the lead of the page, and `saveArticle` and the inbound sync already cut to
 * this length, so a hostile 2 MB page costs what 20,000 characters cost. A caller that cleans a whole
 * section (`maxLength` 0: the country-import heuristics, the cache and content extractors) gets all of
 * the text, and every pass reads it in linear time (clean-markup-passes.ts); the ones that stayed regular
 * expressions cannot run away (anchored, or bounded by the next `=`, `}` or line end).
 */
export const CLEAN_MARKUP_CEILING = 20_000;

/**
 * ponytail: Single authoritative plaintext wikitext cleaner.
 * Strips all wikitext markup, templates, tags, references, and formatting into clean plain text.
 * An excerpt (`maxLength > 0`) reads at most CLEAN_MARKUP_CEILING characters of `rawText`; with
 * `maxLength` 0 the whole text is cleaned.
 */
export function cleanWikiMarkup(rawText: string | null | undefined, maxLength: number = 0): string {
  if (!rawText || !rawText.trim()) return "";

  let text =
    maxLength > 0 && rawText.length > CLEAN_MARKUP_CEILING
      ? rawText.slice(0, CLEAN_MARKUP_CEILING)
      : rawText;

  // 1. Strip blurb tags: [blurb:slug|Title]
  text = text.replace(/^\[blurb:[^\]]+\]\s*/gi, "");

  // 2. Strip HTML comments: <!-- ... -->
  text = stripComments(text);

  // 3. Strip MediaWiki magic words & behavior switches
  text = text.replace(/__(?:NOTOC|TOC|NOEDITSECTION|FORCETOC|SHOWFACTBOX|DISAMBIG)__/gi, "");

  // 4. Strip ref tags: <ref>...</ref> or <ref ... />
  text = stripTagBlocks(text, "ref");
  text = stripSelfClosingRefs(text);

  // 5. Strip gallery and math tags
  text = stripTagBlocks(text, "gallery");
  text = stripTagBlocks(text, "math");

  // 6. Strip file/image links: [[File:...]], [[Image:...]]
  text = stripWikitextFiles(text);

  // 7. Strip category links: [[Category:...]]
  text = stripNamespacedLinks(text, "category:");

  // 8. Strip Template references: [[Template:...]] or Template:Foo
  text = stripNamespacedLinks(text, "template:");
  text = text.replace(/(?:Template|template)\s*:[^\n.<|\]}]*/gi, "");

  // 9. Iteratively strip nested templates: {{...}}
  text = stripWikitextTemplates(text);

  // 10. Unpack internal links: [[Target|Label]] -> Label, [[Target]] -> Target
  text = unpackInternalLinks(text);

  // 11. Convert external links [url text] -> text or [url] -> ""
  text = unpackExternalLinks(text);
  text = stripBareExternalLinks(text);

  // 12. Strip HTML tags
  text = stripHtmlTags(text);

  // 13. Strip headings: == Heading ==
  text = text.replace(/^==+[^=]+==+/gm, "");

  // 14. Strip bold/italic formatting
  text = text.replace(/'''''/g, "").replace(/'''/g, "").replace(/''/g, "");

  // 15. Clean up entities and whitespace
  text = text.replace(/&\w+;/g, " ");
  text = text.replace(/\s+/g, " ").trim();

  if (maxLength > 0 && text.length > maxLength) {
    return text.slice(0, maxLength).trim() + "…";
  }

  return text;
}

/**
 * Strips all wikitext markup, templates, tags, and formatting into a clean plain text excerpt (default max 300 chars).
 */
export function cleanWikitextExcerpt(
  rawText: string | null | undefined,
  maxLength: number = 300
): string {
  return cleanWikiMarkup(rawText, maxLength);
}

/** Alias for cleanWikiMarkup / cleanWikitextExcerpt */
export const cleanExcerpt = cleanWikiMarkup;

/**
 * Calculates raw text byte size
 */
export function calculateRawTextBytes(text: string | null | undefined): number {
  return Buffer.byteLength(text || "", "utf8");
}

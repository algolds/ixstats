import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { resolveImageUrl, getImageUrl } from "./image-url";
import { parseInfoboxToHtml } from "./infobox-parser";

function escapeHtmlLike(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ParseOptions {
  /**
   * Replace unrecognized {{templates}} with visible, machine-detectable
   * placeholder spans instead of deleting them. Used by the editor's
   * wikitext→HTML conversion so unknown templates survive mode switching.
   * Default false (display callers expect stripping).
   */
  preserveUnknownTemplates?: boolean;
}

const SIMPLE_UNWRAP_NAMES = new Set(["nowrap", "nobr", "small", "smaller"]);

/**
 * Preserve-mode scanner: replaces every OUTERMOST balanced {{…}} invocation
 * whose name is not whitelisted with a placeholder span carrying the FULL
 * original wikitext (nested invocations intact). Whitelisted simple unwrap
 * templates are applied inline, exactly like the stripping loop does.
 */
function preserveUnknownTemplates(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const open = input.indexOf("{{", i);
    if (open === -1) {
      out += input.slice(i);
      break;
    }
    // depth-scan for the matching close
    let depth = 0;
    let j = open;
    let end = -1;
    while (j < input.length - 1) {
      const two = input.slice(j, j + 2);
      if (two === "{{") {
        depth++;
        j += 2;
        continue;
      }
      if (two === "}}") {
        depth--;
        j += 2;
        if (depth === 0) {
          end = j;
          break;
        }
        continue;
      }
      j++;
    }
    if (end === -1) {
      out += input.slice(i);
      break;
    }

    const full = input.slice(open, end);
    const inner = full.slice(2, -2);
    const name = inner.split("|")[0]?.trim() ?? "";

    if (name.startsWith("formatnum:")) {
      out += input.slice(i, open) + name.replace(/^formatnum:/i, "").trim();
      i = end;
      continue;
    }
    if (SIMPLE_UNWRAP_NAMES.has(name.toLowerCase())) {
      const parts = inner.split("|");
      out += input.slice(i, open) + parts.slice(1).join("|").trim();
      i = end;
      continue;
    }
    if (name.startsWith("lang")) {
      const parts = inner.split("|");
      out += input.slice(i, open) + (parts.length >= 3 ? (parts[2] ?? "").trim() : "");
      i = end;
      continue;
    }

    const placeholder = `<span class="wikios-template-placeholder" data-wikios-template="${encodeURIComponent(full)}" contenteditable="false">\ud83e\udda9 ${escapeHtmlLike(name)}</span>`;
    out += input.slice(i, open) + placeholder;
    i = end;
  }
  return out;
}

/**
 * Strips recursively nested templates (e.g. {{Infobox ... {{flag|...}} ... }})
 * while selectively unpacking useful inline templates (quotes, main links, flags, lang).
 */
function stripWikitextTemplates(input: string, preserve = false): string {
  if (!input || !input.includes("{{")) return input;

  let text = input;

  // 1. Process inline text templates that should render nicely
  // Handle {{flag|Urcea}} -> Urcea, {{flagicon|Urcea}} -> ""
  text = text.replace(
    /\{\{(?:flag|flagcountry|flagicon)\s*\|\s*([^|}]+)[^}]*\}\}/gi,
    (_match, name: string) => {
      return _match.toLowerCase().includes("flagicon") ? "" : name.trim();
    }
  );

  // Handle {{quote|Text|Author}} or {{blockquote|Text}}
  text = text.replace(
    /\{\{(?:quote|blockquote|cite quote)\s*\|\s*([^|}]+)(?:\|([^|}]+))?[^}]*\}\}/gi,
    (_match, quote: string, author?: string) => {
      const q = quote.trim();
      const a = author ? author.trim() : "";
      return `\n\n<blockquote class="my-2 border-l-2 border-primary/50 pl-3 italic text-muted-foreground">${q}${a ? ` &mdash; <span class="font-semibold text-foreground">${a}</span>` : ""}</blockquote>\n\n`;
    }
  );

  // Handle {{main|Article}} or {{see also|Article}} or {{further|Article}}
  text = text.replace(
    /\{\{(?:main|main article|see also|further)\s*\|\s*([^|}]+)[^}]*\}\}/gi,
    (_match, target: string) => {
      const t = target.trim();
      const route = titleToWikiOSRoute(t);
      return `\n\n<p class="text-[11px] italic text-muted-foreground/80 my-1 font-medium">Main article: <a href="${route}" class="text-primary hover:underline font-semibold">${t}</a></p>\n\n`;
    }
  );

  // Handle {{convert|val|unit1|unit2}} -> "val unit1"
  text = text.replace(
    /\{\{convert\s*\|\s*([\d.]+)\s*\|\s*([^|}]+)\s*\|\s*([^|}]+)[^}]*\}\}/gi,
    (_match, val: string, u1: string) => {
      return `${val} ${u1.trim()}`;
    }
  );

  // Handle {{lang|code|text}} or {{lang-xx|text}}
  text = text.replace(/\{\{lang(?:-[a-z]+)?\s*\|(?:[a-z-]+\|)?([^|}]+)[^}]*\}\}/gi, "$1");

  // Handle {{nowrap|text}}, {{small|text}}, {{smaller|text}}, {{nobr|text}}
  text = text.replace(/\{\{(?:nowrap|nobr|small|smaller|font)\s*\|\s*([^|}]+)[^}]*\}\}/gi, "$1");

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

      if (!preserve) return "";
      // Preserve unknown templates as visible, machine-detectable placeholders
      const wt = `{{${inner.trim()}}}`;
      return `<span class="wikios-template-placeholder" data-wikios-template="${encodeURIComponent(wt)}" contenteditable="false">🧩 ${escapeHtmlLike(parts[0]?.trim() ?? "Template")}</span>`;
    });

    if (text === prev) break;
  }

  // 4. Cleanup any unclosed {{... at the end or stray unattached }}
  text = text.replace(/\{\{[^}]*$/g, "");
  text = text.replace(/^[^{]*\}\}/g, "");
  text = text.replace(/\{\{|\}\}/g, "");

  return text;
}

/**
 * Converts MediaWiki wikitables ({| ... |}) to responsive HTML tables.
 */
function parseWikitables(input: string): string {
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
        const cells = trimmed.substring(1).split("!!");
        for (const cell of cells) {
          const cleanCell = cell.replace(/^[^|]*\|/, "").trim(); // strip cell attributes like style="..." if present
          html += `<th class="p-2 font-bold text-foreground bg-muted/20 border-r border-border/20 last:border-r-0">${cleanCell}</th>`;
        }
      } else if (trimmed.startsWith("|")) {
        if (!inRow) {
          html += '<tr class="border-b border-border/30 hover:bg-muted/20 transition-colors">';
          inRow = true;
        }
        const cells = trimmed.substring(1).split("||");
        for (const cell of cells) {
          const cleanCell = cell.replace(/^[^|]*\|/, "").trim(); // strip cell attributes
          html += `<td class="p-2 text-muted-foreground border-r border-border/20 last:border-r-0">${cleanCell}</td>`;
        }
      }
    }

    if (inRow) html += "</tr>";
    html += "</table></div>\n\n";
    return html;
  });
}

/**
 * Robust wikitext parser that converts raw MediaWiki markup into clean HTML
 * for display in card modals, wiki previews, and lore excerpts.
 */
export function parseWikitextToHtml(
  wikitext: string | null | undefined,
  wikiSource: string = "ixwiki",
  options: ParseOptions = {}
): string {
  if (!wikitext || !wikitext.trim()) return "";

  let text = wikitext;

  // 1. Strip blurb tags: [blurb:slug|Title]
  text = text.replace(/^\[blurb:[^\]]+\]\s*/gi, "");

  // 2. Strip HTML comments: <!-- ... -->
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // 3. Strip MediaWiki magic words & behavior switches
  text = text.replace(/__(?:NOTOC|TOC|NOEDITSECTION|FORCETOC|SHOWFACTBOX|DISAMBIG)__/gi, "");

  // 4. Strip ref tags: <ref>...</ref> or <ref ... />
  text = text.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "");
  text = text.replace(/<ref\b[^>]*\/>/gi, "");

  // 5. Strip galleries & math tags
  text = text.replace(/<gallery\b[^>]*>[\s\S]*?<\/gallery>/gi, "");
  text = text.replace(/<math\b[^>]*>[\s\S]*?<\/math>/gi, "");

  // 6. Convert wikitables to responsive HTML tables
  text = parseWikitables(text);

  // 6b. Extract and convert Infobox template to HTML table before stripping
  const infoboxHtml = parseInfoboxToHtml(text);

  // 6c. Preserve mode: keep unknown templates as placeholders (balanced scan,
  // nested invocations stay intact), then let the normal pipeline handle the rest.
  if (options.preserveUnknownTemplates === true) {
    text = preserveUnknownTemplates(text);
  }

  // 7. Strip recursively nested templates: {{...}}
  text = stripWikitextTemplates(text, options.preserveUnknownTemplates === true);

  // 8. Strip category tags: [[Category:...]], [Category:...]
  text = text.replace(/\[\[(?:category|Category):[^\]]+\]\]/gi, "");
  text = text.replace(/\[(?:category|Category):[^\]]+\]/gi, "");

  // 8b. Strip Template:Name references from MediaWiki extracts
  text = text.replace(/\[\[(?:Template|template):[^\]]+\]\]/gi, "");
  text = text.replace(/\[(?:Template|template):[^\]]+\]/gi, "");
  text = text.replace(/(?:Template|template)\s*:[^\n.<|\]}]*/gi, "");

  // 9. Convert wikitext images: [[File:name.jpg|thumb|200px|Caption]] or [[Image:name.png|...]]
  text = text.replace(/\[\[(?:File|Image):([^\]]+)\]\]/gi, (_match, content: string) => {
    const parts = content.split("|").map((p) => p.trim());
    if (parts.length === 0 || !parts[0]) return "";

    const rawFileName = parts[0];
    const imageUrl = resolveImageUrl(rawFileName, wikiSource as any) ?? getImageUrl(rawFileName);
    if (!imageUrl) return "";

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

    return `\n\n<figure class="my-3 overflow-hidden rounded-xl border border-border/40 bg-card/60 shadow-xs backdrop-blur-md">
      <img src="${imageUrl}" alt="${caption || rawFileName}" class="max-h-48 w-full object-cover rounded-t-xl" loading="lazy" />
      ${
        caption
          ? `<figcaption class="p-2 text-[11px] text-muted-foreground font-medium bg-muted/20 border-t border-border/40 leading-tight">${caption}</figcaption>`
          : ""
      }
    </figure>\n\n`;
  });

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
    return `<code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[11px] text-primary">${inner}</code>`;
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
 * ponytail: Single authoritative plaintext wikitext cleaner.
 * Strips all wikitext markup, templates, tags, references, and formatting into clean plain text.
 */
export function cleanWikiMarkup(rawText: string | null | undefined, maxLength: number = 0): string {
  if (!rawText || !rawText.trim()) return "";

  let text = rawText;

  // 1. Strip blurb tags: [blurb:slug|Title]
  text = text.replace(/^\[blurb:[^\]]+\]\s*/gi, "");

  // 2. Strip HTML comments: <!-- ... -->
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // 3. Strip MediaWiki magic words & behavior switches
  text = text.replace(/__(?:NOTOC|TOC|NOEDITSECTION|FORCETOC|SHOWFACTBOX|DISAMBIG)__/gi, "");

  // 4. Strip ref tags: <ref>...</ref> or <ref ... />
  text = text.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "");
  text = text.replace(/<ref\b[^>]*\/>/gi, "");

  // 5. Strip gallery and math tags
  text = text.replace(/<gallery\b[^>]*>[\s\S]*?<\/gallery>/gi, "");
  text = text.replace(/<math\b[^>]*>[\s\S]*?<\/math>/gi, "");

  // 6. Strip file/image links: [[File:...]], [[Image:...]]
  text = text.replace(/\[\[(?:File|Image|Media):[^\]]+\]\]/gi, "");

  // 7. Strip category links: [[Category:...]]
  text = text.replace(/\[\[(?:Category|category):[^\]]+\]\]/gi, "");

  // 8. Strip Template references: [[Template:...]] or Template:Foo
  text = text.replace(/\[\[(?:Template|template):[^\]]+\]\]/gi, "");
  text = text.replace(/(?:Template|template)\s*:[^\n.<|\]}]*/gi, "");

  // 9. Iteratively strip nested templates: {{...}}
  text = stripWikitextTemplates(text);

  // 10. Unpack internal links: [[Target|Label]] -> Label, [[Target]] -> Target
  text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");

  // 11. Convert external links [url text] -> text or [url] -> ""
  text = text.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1");
  text = text.replace(/\[https?:\/\/[^\s\]]+\]/g, "");

  // 12. Strip HTML tags
  text = text.replace(/<[^>]+>/g, "");

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

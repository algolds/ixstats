/**
 * File and image links in wikitext, for the fallback compiler (`parseWikitextToHtml`): drawn as figures, stripped, or,
 * when a card sheet hides a card's art, left out with links to file pages read as plain words.
 */
import { findMatchingClosingBrackets } from "../wikitext/link-parser";
import { matchBrackets } from "../wikitext/match-index";
import { splitBalancedPipes } from "../wikitext/parameter-parser";
import { nextFileOpener } from "./clean-markup-passes";
import { getImageUrl, resolveImageUrl, type ExtendedWikiSource } from "./image-url";

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
          // `resolveImageUrl` looks the wiki up in its route table, so one without a route gets IxWiki's.
          const source = wikiSource as ExtendedWikiSource;
          const imageUrl = resolveImageUrl(rawFileName, source) ?? getImageUrl(rawFileName);

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

/** A link to a file's page rather than the file: `[[:File:Name|words]]`, also `Image:` and `Media:`. */
const FILE_PAGE_LINK = /\[\[:((?:file|image|media):[^\]|]*)(?:\|([^\]]*))?\]\]/gi;

/** File-page links read as their words (or the file title), for text that must not lead to the file. */
function unlinkFilePages(text: string): string {
  return text.replace(FILE_PAGE_LINK, (_link, target: string, words: string | undefined) =>
    words ? words : target
  );
}

/** Step 9 of the compiler: file and image links drawn as figures, or with `images` off left out entirely. */
export function renderFileLinks(text: string, wikiSource: string, images: boolean): string {
  return images
    ? convertWikitextImages(text, wikiSource)
    : unlinkFilePages(stripWikitextFiles(text));
}

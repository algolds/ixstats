/**
 * The lore writer's word count (docs/specs/2026-10-24-native-lore-design.md, "Aids"): the words the
 * author wrote in a piece's wikitext. Templates (the infobox), headings, references, comments, tags, category and
 * file links are left out; a link counts by its label. Pure.
 */

/** A template with no template inside it. */
const INNERMOST_TEMPLATE = /\{\{[^{}]*\}\}/g;
/** Nested templates are removed from the inside out; past this depth the rest is counted as written. */
const TEMPLATE_DEPTH = 8;

const STRIPPED: readonly RegExp[] = [
  /<!--[\s\S]*?-->/g,
  /<ref\b[^>]*\/>/gi,
  /<ref\b[^>]*>[\s\S]*?<\/ref>/gi,
  /\[\[\s*(?:category|file|image)\s*:[^\]]*\]\]/gi,
  /^=+[^\n]*=+[ \t]*$/gm,
  /<[^>]+>/g,
];

function withoutTemplates(wikitext: string): string {
  let text = wikitext;
  for (let depth = 0; depth < TEMPLATE_DEPTH; depth++) text = text.replace(INNERMOST_TEMPLATE, " ");
  return text;
}

export function loreWordCount(wikitext: string): number {
  const text = STRIPPED.reduce(
    (rest, markup) => rest.replace(markup, " "),
    withoutTemplates(wikitext)
  )
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s*([^\]]*)\]/g, "$1");
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

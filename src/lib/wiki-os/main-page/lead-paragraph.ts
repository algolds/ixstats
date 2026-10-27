/**
 * lead-paragraph.ts — the first real paragraph of article HTML, as plain text (the Main Page's almanac shows it).
 */

import { stripHtmlTags } from "../transformers/clean-markup-passes";
import { PARAGRAPHS, blocks, scanHtml } from "../transformers/html-scan";

/** The lead paragraph of article HTML as plain text, skipping empty and infobox paragraphs. */
export function leadParagraph(html: string): string {
  let lead = "";
  for (const [start, end] of blocks(scanHtml(html), PARAGRAPHS)) {
    const paragraph = html.slice(start, end);
    if (paragraph.length > 25 && !/infobox|mw-empty-elt/i.test(paragraph)) {
      lead = paragraph;
      break;
    }
  }
  return stripHtmlTags(lead)
    .replace(/\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

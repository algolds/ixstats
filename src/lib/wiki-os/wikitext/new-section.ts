/**
 * new-section.ts — "Add topic" on a talk page: `?action=edit&section=new` opens the editor on the
 * page's text with an empty `== New topic ==` section appended (MediaWiki's "new section" form).
 */

/** The heading of the section "Add topic" starts; the editor opens with the cursor on it. */
export const NEW_SECTION_HEADING = "New topic";

/** `wikitext` with an empty level-2 section appended, separated from what comes before by a blank line. */
export function appendNewSection(wikitext: string): string {
  const heading = `== ${NEW_SECTION_HEADING} ==\n\n`;
  const existing = wikitext.trimEnd();
  return existing === "" ? heading : `${existing}\n\n${heading}`;
}

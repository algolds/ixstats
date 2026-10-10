/**
 * Forum wikitext goes through MediaWiki's parser (render.ts): what only makes sense on a wiki page, or would
 * expand as the render account, is refused or stripped first. Pure.
 */
export const MAX_POST_WIKITEXT = 50_000;

export class WikitextRefusal extends Error {}

const SIGNATURE = /~{4,5}/;
const SUBST = /\{\{\s*(?:safe)?subst\s*:/i;
const CATEGORY = /\[\[\s*Category\s*:[^\]]*\]\]/gi; // [[:Category:X]] (a link) starts with a colon and is kept
const SWITCHES = /__[A-Z]+__/g;
const DISPLAYTITLE = /\{\{\s*DISPLAYTITLE\s*:[^}]*\}\}/gi;

export function guardWikitext(raw: string): string {
  if (raw.length > MAX_POST_WIKITEXT) {
    throw new WikitextRefusal(`A post can be at most ${MAX_POST_WIKITEXT} characters.`);
  }
  if (SIGNATURE.test(raw)) {
    throw new WikitextRefusal(
      "Signatures (~~~~) are not used on the forum; your name is shown on every post."
    );
  }
  if (SUBST.test(raw)) throw new WikitextRefusal("subst: is not supported in forum posts.");
  const text = raw.replace(CATEGORY, "").replace(SWITCHES, "").replace(DISPLAYTITLE, "");
  if (!text.trim()) throw new WikitextRefusal("A post needs some text.");
  return text;
}

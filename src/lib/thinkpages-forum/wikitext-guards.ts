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

function strip(text: string): string {
  return text.replace(CATEGORY, "").replace(SWITCHES, "").replace(DISPLAYTITLE, "");
}

/** Stripping can join the text around a removed token into a new one, so strip until nothing more goes. */
function stripAll(raw: string): string {
  let text = strip(raw);
  for (let next = strip(text); next !== text; next = strip(text)) text = next;
  return text;
}

export function guardWikitext(raw: string): string {
  if (raw.length > MAX_POST_WIKITEXT) {
    throw new WikitextRefusal(`A post can be at most ${MAX_POST_WIKITEXT} characters.`);
  }
  // Strip first: a switch inside "{{sub__NOTOC__st:X}}" would otherwise reassemble a forbidden token after the checks.
  const text = stripAll(raw);
  if (SIGNATURE.test(text)) {
    throw new WikitextRefusal(
      "Signatures (~~~~) are not used on the forum; your name is shown on every post."
    );
  }
  if (SUBST.test(text)) throw new WikitextRefusal("subst: is not supported in forum posts.");
  if (!text.trim()) throw new WikitextRefusal("A post needs some text.");
  return text;
}

/**
 * sister-embed.ts: the live embed of a sister wiki page (IIWiki, AltHistory) in a WikiOS page, as plain data.
 *
 * Classic's `Template:Sister` (scripts/ops/mediawiki/Template-Sister.wikitext) renders a link box that carries
 * `data-sister-wiki`, `data-sister-title`, `data-sister-mode` and `data-sister-section`. The reader finds each box
 * (`SISTER_EMBED_SELECTOR`), reads it with `sisterEmbedRequestOf` and asks `wikios.sisterEmbed` for that request, for
 * at most `MAX_SISTER_EMBEDS` boxes per page; the rest stay link boxes. Nothing read from the attributes is ever
 * spliced into HTML: the request is data, validated here and again by the procedure's input schema.
 *
 * Client-safe: pure, no wiki call.
 */
import { SISTER_READER_IDS, type SisterReaderId } from "~/lib/wiki-os/wiki-hosts";

export const SISTER_EMBED_MODES = ["page", "section", "infobox", "card"] as const;
export type SisterEmbedMode = (typeof SISTER_EMBED_MODES)[number];

export interface SisterEmbedRequest {
  wiki: SisterReaderId;
  title: string;
  mode: SisterEmbedMode;
  /** The heading, in `section` mode only; null otherwise. */
  section: string | null;
}

/** A `Template:Sister` box in rendered HTML. */
export const SISTER_EMBED_SELECTOR = "[data-sister-wiki]";
/** Live embeds per page; the boxes after these stay link boxes (as `WikiEmbed.tsx`'s forum embeds). */
export const MAX_SISTER_EMBEDS = 10;

const MAX_TITLE_LENGTH = 255;
const MAX_SECTION_LENGTH = 255;
/** Characters no MediaWiki title holds (`#` starts a fragment). */
const TITLE_FORBIDDEN = /[#<>[\]{}|]/;

/** Whether `title` is one MediaWiki could hold: 1 to 255 characters, none of `# < > [ ] { } |`. */
export function isSisterEmbedTitle(title: string): boolean {
  return title.length > 0 && title.length <= MAX_TITLE_LENGTH && !TITLE_FORBIDDEN.test(title);
}

function isSisterReaderId(wiki: string): wiki is SisterReaderId {
  return (SISTER_READER_IDS as readonly string[]).includes(wiki);
}

function isEmbedMode(mode: string): mode is SisterEmbedMode {
  return (SISTER_EMBED_MODES as readonly string[]).includes(mode);
}

/** The part asked for: a section only in `section` mode, and `section` mode only with a section (else the page). */
export function embedPart(
  mode: SisterEmbedMode,
  section: string | null
): Pick<SisterEmbedRequest, "mode" | "section"> {
  if (mode !== "section") return { mode, section: null };
  return section === null ? { mode: "page", section: null } : { mode, section };
}

/** A section heading of 1 to 255 characters, or null. */
function usableSection(section: string): string | null {
  return section.length > 0 && section.length <= MAX_SECTION_LENGTH ? section : null;
}

/** The embed a `Template:Sister` box asks for, or null when it names no wiki WikiOS reads or no valid title. */
export function sisterEmbedRequestOf(element: Element): SisterEmbedRequest | null {
  const read = (name: string) => (element.getAttribute(`data-sister-${name}`) ?? "").trim();
  const wiki = read("wiki").toLowerCase();
  const title = read("title");
  if (!isSisterReaderId(wiki) || !isSisterEmbedTitle(title)) return null;
  const mode = read("mode");
  return {
    wiki,
    title,
    ...embedPart(isEmbedMode(mode) ? mode : "page", usableSection(read("section"))),
  };
}

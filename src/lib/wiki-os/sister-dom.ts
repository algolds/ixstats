// src/lib/wiki-os/sister-dom.ts
// The names sister wiki content (IIWiki, AltHistory) carries in the reader's DOM. A sister reader page's ids are
// prefixed (`sanitizeSisterHtml`), so none collides with an id of the app, though a link into a section names the
// wiki's own id; a live embed in an IxWiki page sits in a `SISTER_EMBED_CLASS` element. Client-safe and pure.

/** The prefix of every id of a sister reader page, so none can collide with (or clobber) an id of the app. */
export const SISTER_ID_PREFIX = "sister-";
/** A live sister embed's own element (SisterEmbed.tsx): nothing inside one is mounted on or given edit links. */
export const SISTER_EMBED_CLASS = "wikios-sister-embed";

/**
 * Where a location hash lands on a sister reader page: `#History` names the wiki's id, which the page holds as
 * `sister-History`. `id` is that element's id (the hash decoded), `hash` the location hash naming it (as written).
 * Null for an empty hash.
 */
export function sisterHashTarget(hash: string): { id: string; hash: string } | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // a malformed escape is kept as written
  }
  return { id: `${SISTER_ID_PREFIX}${id}`, hash: `#${SISTER_ID_PREFIX}${raw}` };
}

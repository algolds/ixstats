// src/lib/wiki-os/lean-article.ts
// The lean first response of an article for a reader who is not signed in (plan 413, item 8c).
//
// A server-rendered page carries its article twice: as DOM, and again in the React Server Components
// flight (the query cache the client hydrates from). For a 290 KB article that is a second 290 KB,
// escaped, which gzip (a 32 KB window) cannot fold into the first. In lean mode the flight carries
// short markers instead of the three HTML parts:
//
//   - the server renders the page from the real HTML (the page handed it to the SSR render through a
//     process-wide stash, under a token: both renders are in the same process. A part can be read
//     again (a retried SSR render finds it); an entry is forgotten after a few seconds, and when 200
//     newer ones exist);
//   - the browser, hydrating, finds the three parts where they already are, in the DOM, by element id.
//
// Only a document request of an anonymous reader is lean. A client-side navigation (it asks for the
// flight, and has no DOM to read) and a signed-in reader get the full data, as ever, and a marker the
// browser cannot resolve (it came from an earlier page load) is re-fetched.

export type LeanPart = "body" | "infobox" | "notices";

export interface LeanArticleParts {
  body: string;
  infobox: string | null;
  notices: string | null;
}

const MARKER_PREFIX = "wikios-lean:";
const MARKER = /^wikios-lean:([0-9a-f-]{36}):(body|infobox|notices)$/;
/** The server keeps an article's HTML for its own SSR render this long: a render follows the request at once. */
const STASH_TTL_MS = 5_000;
/** Most articles kept at once; the oldest goes first. */
const STASH_MAX_ENTRIES = 200;

/** The stand-in for one part of the article in the flight. */
export function leanMarker(token: string, part: LeanPart): string {
  return `${MARKER_PREFIX}${token}:${part}`;
}

export function parseLeanMarker(
  value: string | null | undefined
): { token: string; part: LeanPart } | null {
  const match = value ? MARKER.exec(value) : null;
  return match ? { token: match[1]!, part: match[2] as LeanPart } : null;
}

/** The id of the element that holds a part of the article, which the browser reads it back from. */
export function leanElementId(token: string, part: LeanPart): string {
  return `wikios-lean-${token}-${part}`;
}

/** Whether lean mode is switched on (WIKIOS_LEAN_FLIGHT=1): off until it has been checked in a browser. */
export function leanFlightEnabled(): boolean {
  return process.env.WIKIOS_LEAN_FLIGHT === "1";
}

// ─── The server's stash ───────────────────────────────────────────

interface StashedArticle {
  /** The HTML of the parts the SSR render reads. */
  parts: Partial<Record<LeanPart, string>>;
  expires: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __wikiosLeanStash: Map<string, StashedArticle> | undefined;
}

const stash = (): Map<string, StashedArticle> => (globalThis.__wikiosLeanStash ??= new Map());

/** The entry of a token, or undefined when there is none or it has expired (then it is dropped). */
function liveEntry(token: string): StashedArticle | undefined {
  const entries = stash();
  const entry = entries.get(token);
  if (entry && entry.expires <= Date.now()) {
    entries.delete(token);
    return undefined;
  }
  return entry;
}

/** Keep `parts` for the SSR render of this request; returns the token its markers carry. */
export function stashLeanArticle(parts: LeanArticleParts): string {
  const token = globalThis.crypto.randomUUID();
  const entries = stash();
  const now = Date.now();
  // The Map is in insertion order, which is expiry order: drop what has expired, then the oldest over the cap
  for (const [key, entry] of entries) {
    if (entry.expires > now && entries.size < STASH_MAX_ENTRIES) break;
    entries.delete(key);
  }
  entries.set(token, {
    parts: {
      body: parts.body,
      ...(parts.infobox === null ? {} : { infobox: parts.infobox }),
      ...(parts.notices === null ? {} : { notices: parts.notices }),
    },
    expires: now + STASH_TTL_MS,
  });
  return token;
}

/** A part of a stashed article, or null. Reading does not use it up: a retried SSR render needs it again. */
function readStashed(token: string, part: LeanPart): string | null {
  return liveEntry(token)?.parts[part] ?? null;
}

// ─── Reading a marker back ────────────────────────────────────────

/** Where this code runs; a test can say otherwise (Jest's jsdom has a window on the "server" too). */
export const leanEnvironment = { isServer: () => typeof window === "undefined" };

/**
 * The HTML a marker stands for, or `value` itself when it is not a marker. Null when it cannot be
 * found: the server's stash has expired, or the browser has no element for it, or an empty one (the
 * marker is from an earlier page load). The server reads the part from the stash; the browser reads
 * the element's HTML from the DOM the server rendered.
 */
export function resolveLeanHtml(value: string | null | undefined): string | null {
  const marker = parseLeanMarker(value);
  if (!marker) return value ?? null;
  if (leanEnvironment.isServer()) return readStashed(marker.token, marker.part);
  // an element with nothing in it is not the article either (a part that is a marker is never empty)
  return document.getElementById(leanElementId(marker.token, marker.part))?.innerHTML || null;
}

/** Whether `resolveLeanHtml` would find the HTML of a marker, without reading it. A value that is no marker is resolved. */
export function isLeanResolvable(value: string | null | undefined): boolean {
  const marker = parseLeanMarker(value);
  if (!marker) return true;
  if (leanEnvironment.isServer()) return readStashed(marker.token, marker.part) !== null;
  return !!document.getElementById(leanElementId(marker.token, marker.part))?.firstChild;
}

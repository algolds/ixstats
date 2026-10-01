// src/lib/wiki-os/lean-article.ts
// The lean first response of an article for a reader who is not signed in (plan 413, item 8c).
//
// A server-rendered page carries its article twice: as DOM, and again in the React Server Components
// flight (the query cache the client hydrates from). For a 290 KB article that is a second 290 KB,
// escaped, which gzip (a 32 KB window) cannot fold into the first. In lean mode the flight carries
// short markers instead of the three HTML parts:
//
//   - the server renders the page from the real HTML (the page handed it to the SSR render through a
//     process-wide stash, under a token, for a minute: both renders are in the same process);
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
/** The server keeps an article's HTML for its own SSR render this long. */
const STASH_TTL_MS = 60_000;

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

declare global {
  // eslint-disable-next-line no-var
  var __wikiosLeanStash: Map<string, LeanArticleParts> | undefined;
}

const stash = (): Map<string, LeanArticleParts> => (globalThis.__wikiosLeanStash ??= new Map());

/** Keep `parts` for the SSR render of this request; returns the token its markers carry. */
export function stashLeanArticle(parts: LeanArticleParts): string {
  const token = globalThis.crypto.randomUUID();
  const entries = stash();
  entries.set(token, parts);
  const expiry = setTimeout(() => entries.delete(token), STASH_TTL_MS);
  if (typeof expiry === "object") expiry.unref(); // never keeps the process alive
  return token;
}

function readStashed(token: string, part: LeanPart): string | null {
  const parts = stash().get(token);
  return parts ? parts[part] : null;
}

// ─── Reading a marker back ────────────────────────────────────────

/** Where this code runs; a test can say otherwise (Jest's jsdom has a window on the "server" too). */
export const leanEnvironment = { isServer: () => typeof window === "undefined" };

/**
 * The HTML a marker stands for, or `value` itself when it is not a marker. Null when it cannot be
 * found: the server's stash has expired, or the browser has no element for it (the marker is from an
 * earlier page load). The server reads the stash; the browser reads the element's HTML from the DOM
 * the server rendered.
 */
export function resolveLeanHtml(value: string | null | undefined): string | null {
  const marker = parseLeanMarker(value);
  if (!marker) return value ?? null;
  if (leanEnvironment.isServer()) return readStashed(marker.token, marker.part);
  return document.getElementById(leanElementId(marker.token, marker.part))?.innerHTML ?? null;
}

/** Whether `resolveLeanHtml` would find the HTML of a marker, without reading it. A value that is no marker is resolved. */
export function isLeanResolvable(value: string | null | undefined): boolean {
  const marker = parseLeanMarker(value);
  if (!marker) return true;
  if (leanEnvironment.isServer()) return readStashed(marker.token, marker.part) !== null;
  return document.getElementById(leanElementId(marker.token, marker.part)) !== null;
}

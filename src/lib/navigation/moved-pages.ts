/**
 * Pages that moved to another section for good, beside the old card addresses (`src/lib/cards/hub-routes.ts`).
 * Client-safe; `src/proxy.ts` answers each old address with a 308, since a redirect thrown by a page would stream as a
 * 200 under the section's loading boundary.
 */
import { stripBasePath } from "~/lib/base-path";

/** Old address → new address. */
const MOVED_PAGES: ReadonlyMap<string, string> = new Map([
  // The Exchange left the Vault, then Labs, for its own app (docs/specs/2026-11-06-exchange-overhaul-design.md).
  ["/vault/exchange", "/exchange"],
  ["/labs/exchange", "/exchange"],
]);

/**
 * The new home of a page that moved, keeping the request's query (`search`, with or without its `?`), re-encoded so a
 * `?` inside a value stays in it; null for every other address.
 */
export function movedPageRedirectFor(pathname: string, search: string): string | null {
  const target = MOVED_PAGES.get(stripBasePath(pathname).replace(/\/+$/, ""));
  if (!target) return null;
  const query = new URLSearchParams(search).toString();
  return query ? `${target}?${query}` : target;
}

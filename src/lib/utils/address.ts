/**
 * An absolute URL as a path with its query changed, keeping the pathname, the rest of the query and the hash: what
 * `history.pushState` and `replaceState` take when a page rewrites its own query (pass `window.location.href`).
 */
export function addressWith(href: string, change: (query: URLSearchParams) => void): string {
  const url = new URL(href);
  change(url.searchParams);
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

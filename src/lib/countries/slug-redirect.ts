/**
 * Where an old country address redirects: the same page and query under the country's current
 * slug (`/countries/old/factbook/economy?x=1` → `/countries/new/factbook/economy?x=1`).
 */

/**
 * The request header the proxy sets to the requested path and query (always overwritten, so a
 * client cannot supply it). Layouts cannot see the path below their own segment without it.
 */
export const REQUEST_PATH_HEADER = "x-ixstates-request-path";

const decodeSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/**
 * The redirect target for `oldSlug` → `newSlug`, keeping whatever followed the old slug in
 * `requestPath` (a path with an optional query, without the base path). Without a request path,
 * or when the old slug is not in it (a rewritten address), the country's page.
 */
export function countrySlugRedirectPath(
  requestPath: string | null | undefined,
  oldSlug: string,
  newSlug: string
): string {
  const base = `/countries/${encodeURIComponent(newSlug)}`;
  if (!requestPath) return base;
  const queryAt = requestPath.indexOf("?");
  const pathname = queryAt === -1 ? requestPath : requestPath.slice(0, queryAt);
  const query = queryAt === -1 ? "" : requestPath.slice(queryAt);
  const segments = pathname.split("/").filter(Boolean);
  const old = oldSlug.toLowerCase();
  const at = segments.findIndex((segment) => decodeSegment(segment).toLowerCase() === old);
  const rest =
    at === -1
      ? ""
      : segments
          .slice(at + 1)
          .map((segment) => `/${segment}`)
          .join("");
  return `${base}${rest}${query}`;
}

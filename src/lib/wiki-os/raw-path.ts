/**
 * raw-path.ts — how `src/proxy.ts` hands `/api/wiki/raw` the page a `/wiki/<title>?action=raw` URL
 * named. Next 16 keeps the original query string for a rewritten route handler, so a `path` query
 * parameter added to the rewrite never arrives; the path travels in this request header instead.
 * The proxy sets it in the rewrite branch only (overwriting whatever the client sent) and strips a
 * client's own copy from any direct request to the raw route; the route reads it only for a request
 * that also carries `action=raw`.
 */

export const RAW_PATH_HEADER = "x-wikios-raw-path";

/** The raw route's own path: a direct request names the page in `?path=` instead. */
export const RAW_ROUTE_PATH = "/api/wiki/raw";

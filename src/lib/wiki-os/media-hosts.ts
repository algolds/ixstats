/**
 * The wiki media host allowlist (plan 401): IxWiki's host, and each sister wiki's own host and upload
 * CDNs from `wiki-hosts.ts`. The MediaWiki media proxies, `wikios.downloadFile` and the link-card
 * images (`src/lib/og`) fetch wiki files only from these hosts.
 */
import { mediaWikiOrigin } from "./config";
import { SISTER_WIKI_HOSTS, sisterWikiFileHosts } from "./wiki-hosts";

const ALLOWED_MEDIA_HOSTS: ReadonlySet<string> = new Set([
  new URL(mediaWikiOrigin()).hostname,
  ...Object.values(SISTER_WIKI_HOSTS).flatMap(sisterWikiFileHosts),
]);

/** True when `rawUrl` is an http(s) URL whose host belongs to a configured wiki or its media CDN. */
export function isAllowedMediaUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      (url.protocol === "https:" || url.protocol === "http:") && ALLOWED_MEDIA_HOSTS.has(url.hostname)
    );
  } catch {
    return false;
  }
}

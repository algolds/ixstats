/**
 * The wiki media host allowlist (plan 401): IxWiki's host, and each sister wiki's own host and upload
 * CDNs from `wiki-hosts.ts`. The MediaWiki media proxies, `wikios.downloadFile` and the link-card
 * images (`src/lib/og`) fetch wiki files only from these hosts.
 */
import { mediaWikiOrigin } from "./config";
import { SISTER_WIKI_HOSTS, sisterWikiFileHosts, type SisterWikiId } from "./wiki-hosts";

/** A wiki whose files are read: IxWiki or a sister wiki (Commons included). */
export type FileWiki = "ixwiki" | SisterWikiId;

const ALLOWED_MEDIA_HOSTS: ReadonlySet<string> = new Set([
  new URL(mediaWikiOrigin()).hostname,
  ...Object.values(SISTER_WIKI_HOSTS).flatMap(sisterWikiFileHosts),
]);

/** True when `rawUrl` is an http(s) URL whose host belongs to a configured wiki or its media CDN. */
export function isAllowedMediaUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      ALLOWED_MEDIA_HOSTS.has(url.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * The hosts one wiki's files come from: a sister wiki's own host and upload CDNs; for IxWiki, its own host and
 * Commons' (IxWiki shows Commons files through InstantCommons).
 */
export function wikiFileHosts(wiki: FileWiki): ReadonlySet<string> {
  if (wiki !== "ixwiki") return new Set(sisterWikiFileHosts(SISTER_WIKI_HOSTS[wiki]));
  return new Set([
    new URL(mediaWikiOrigin()).hostname,
    ...sisterWikiFileHosts(SISTER_WIKI_HOSTS.commons),
  ]);
}

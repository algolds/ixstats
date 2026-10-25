/**
 * import-origin.ts — which dumps WikiOS imports (spec A8): classic MediaWiki's, and nothing else.
 *
 * A dump WikiOS imports must say where it came from (`<siteinfo>`), have been written by MediaWiki (its
 * `<generator>` starts with "MediaWiki "), and, for IxWiki, come from classic itself: the host of its `<base>` is the
 * host of classic's origin. A dump from anywhere else would put pages in WikiOS that classic never had and the mirror
 * never sends back. A sister wiki's dump (another source) is only held to the first two.
 */

import { IXWIKI } from "~/lib/identity/wiki-names";
import type { SiteInfo } from "./types";

export type DumpOriginVerdict = { ok: true } | { ok: false; reason: string };

const MEDIAWIKI_GENERATOR = /^MediaWiki /;
const ACCEPTED: DumpOriginVerdict = { ok: true };
const refuse = (reason: string): DumpOriginVerdict => ({ ok: false, reason });

/** The host of an absolute URL (the URL parser lower-cases it), or null when `url` is not one. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Whether WikiOS imports a dump of `source` that says `siteinfo` about itself, `classicOrigin` being classic's origin. */
export function checkDumpOrigin(
  siteinfo: SiteInfo | null,
  source: string,
  classicOrigin: string
): DumpOriginVerdict {
  if (!siteinfo) {
    return refuse(
      "The dump has no <siteinfo>: only a MediaWiki dump, which says where it came from, is imported."
    );
  }
  if (!MEDIAWIKI_GENERATOR.test(siteinfo.generator)) {
    return refuse(
      `The dump was made by ${JSON.stringify(siteinfo.generator)}, not MediaWiki: only MediaWiki dumps are imported.`
    );
  }
  if (source !== IXWIKI) return ACCEPTED;
  const host = hostOf(siteinfo.base);
  const classic = hostOf(classicOrigin);
  if (host === null || host !== classic) {
    return refuse(
      `The dump comes from ${host ?? "an unknown wiki"}, not ${classic ?? "classic"}: only classic's own dumps are imported.`
    );
  }
  return ACCEPTED;
}

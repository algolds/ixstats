/**
 * import-origin.ts — which dumps WikiOS imports (spec A8): classic MediaWiki's, and nothing else.
 *
 * A dump WikiOS imports must say where it came from (`<siteinfo>`), have been written by MediaWiki (its
 * `<generator>` starts with "MediaWiki "), and, for IxWiki, come from classic itself: its `<base>` is on the host of
 * classic's origin, or that host's `www.` alias, the same rule a link to the wiki is recognised by (`isUrlOnHost`). A
 * dump from anywhere else would put pages in WikiOS that classic never had and the mirror never sends back. A sister
 * wiki's dump (another source) is only held to the first two.
 */

import { IXWIKI } from "~/lib/identity/wiki-names";
import { isUrlOnHost } from "../config";
import type { SiteInfo } from "./types";

export type DumpOriginVerdict = { ok: true } | { ok: false; reason: string };

const MEDIAWIKI_GENERATOR = /^MediaWiki /;
const ACCEPTED: DumpOriginVerdict = { ok: true };
const refuse = (reason: string): DumpOriginVerdict => ({ ok: false, reason });

/** Whether `base` is on classic's host, `classicOrigin`'s; refused outright when that origin is not a URL. */
function checkBase(base: string, classicOrigin: string): DumpOriginVerdict {
  if (!URL.canParse(classicOrigin)) {
    return refuse(
      `Classic's origin ${JSON.stringify(classicOrigin)} is not a URL, so no dump can be checked against it.`
    );
  }
  const classic = new URL(classicOrigin).host;
  return isUrlOnHost(base, classic)
    ? ACCEPTED
    : refuse(
        `The dump's base ${JSON.stringify(base)} is not on classic ${classic}: only classic's own dumps are imported.`
      );
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
  return source === IXWIKI ? checkBase(siteinfo.base, classicOrigin) : ACCEPTED;
}

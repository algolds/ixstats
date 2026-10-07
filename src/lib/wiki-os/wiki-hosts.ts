// src/lib/wiki-os/wiki-hosts.ts
// The sister wikis: other people's MediaWikis that IxStats reads where they live. One entry per wiki, and the
// only place their hosts are spelled. Client-safe (pure data, no environment reads).
//
// Adding a MediaWiki host is adding an entry here. Every allowlist is built from this list: the api.php proxy
// and the media proxy (`src/app/api/mediawiki/_config.ts`, `_media-response.ts`), the wiki sources WikiOS can
// read (`WIKI_SOURCES` in `config.ts`), account proof (`account-proof.ts`), realm wiki settings
// (`src/lib/realms/realm-wiki-settings.ts`) and the original-file fetch of realm discovery. A host that is not
// here is never fetched: a realm names a wiki by its `id`, never by a URL, so no setting can point the server at
// another host.
//
// Entry format (see `SisterWikiHost`):
//   id           the key every caller uses: `?source=<id>`, `/api/mediawiki/<id>/...`, `Realm.settings.wiki.source`
//   name         shown to people
//   origin       https origin, no path and no trailing slash
//   apiPath      the path of its api.php under `origin`
//   mediaHosts   other hosts its `imageinfo` URLs point at (an upload CDN); fetched for image files only
//   reader       true when WikiOS reads its pages (a WikiSource), its accounts can be linked and a realm can use
//                it as its wiki; false for a media-only wiki (Commons)
//   proxy        the media and api.php proxies' per-wiki behaviour (see `WikiConfig` in `_config.ts`)
//
// IxWiki is not here: WikiOS owns it, and its host comes from `wikiosConfig` (plan 415).

export interface SisterWikiHost {
  readonly name: string;
  readonly origin: string;
  readonly apiPath: string;
  readonly description: string;
  readonly mediaHosts: readonly string[];
  readonly reader: boolean;
  readonly proxy: {
    /** Origins allowed to call the api.php proxy cross-origin; the wiki's own origins are always included. */
    readonly extraCorsOrigins: readonly string[];
    /** Any origin may call the api.php proxy. */
    readonly anyCorsOrigin?: boolean;
    /** Detect a Cloudflare challenge page and answer 503 instead of passing HTML through. */
    readonly detectCloudflare: boolean;
    /** Retries (with back-off) when `imageinfo` resolution answers 403. */
    readonly resolveRetries: number;
    /** Sub-path prefix whose files are fetched through wsrv.nl instead of the origin. */
    readonly directImagePrefix?: string;
  };
}

export const SISTER_WIKI_HOSTS = {
  iiwiki: {
    name: "IIWiki",
    origin: "https://iiwiki.com",
    apiPath: "/api.php",
    description: "SimFic and Alt-History Encyclopedia",
    mediaHosts: [],
    reader: true,
    proxy: {
      extraCorsOrigins: ["https://www.iiwiki.com"],
      detectCloudflare: true,
      resolveRetries: 0,
      directImagePrefix: "images/",
    },
  },
  althistory: {
    name: "AltHistory Wiki",
    origin: "https://althistory.fandom.com",
    apiPath: "/api.php",
    description: "Alternative History and Speculative Fiction Encyclopedia",
    mediaHosts: ["static.wikia.nocookie.net"],
    reader: true,
    proxy: { extraCorsOrigins: [], anyCorsOrigin: true, detectCloudflare: false, resolveRetries: 2 },
  },
  commons: {
    name: "Commons",
    origin: "https://commons.wikimedia.org",
    apiPath: "/w/api.php",
    description: "Wikimedia Commons, the free media repository",
    mediaHosts: ["upload.wikimedia.org"],
    reader: false,
    proxy: { extraCorsOrigins: ["https://upload.wikimedia.org"], detectCloudflare: false, resolveRetries: 0 },
  },
} as const satisfies Record<string, SisterWikiHost>;

type Hosts = typeof SISTER_WIKI_HOSTS;
export type SisterWikiId = keyof Hosts;

/** The sister wikis WikiOS reads pages of (`reader: true`). */
export type SisterReaderId = { [K in SisterWikiId]: Hosts[K]["reader"] extends true ? K : never }[SisterWikiId];

export function sisterWikiHost(id: string): SisterWikiHost | null {
  return Object.hasOwn(SISTER_WIKI_HOSTS, id) ? SISTER_WIKI_HOSTS[id as SisterWikiId] : null;
}

/** Every sister wiki id, in entry order. */
export const SISTER_WIKI_IDS = Object.keys(SISTER_WIKI_HOSTS) as SisterWikiId[];

/** The sister wikis WikiOS reads pages of, in entry order. */
export const SISTER_READER_IDS = SISTER_WIKI_IDS.filter(
  (id): id is SisterReaderId => SISTER_WIKI_HOSTS[id].reader
);

/** The sister wiki's own api.php (no development proxy). */
export function sisterWikiApiUrl(host: SisterWikiHost): string {
  return `${host.origin}${host.apiPath}`;
}

/** The hosts a sister wiki's files may be fetched from: its own and its upload CDNs. */
export function sisterWikiFileHosts(host: SisterWikiHost): string[] {
  return [new URL(host.origin).hostname, ...host.mediaHosts];
}

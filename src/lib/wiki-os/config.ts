// src/lib/wiki-os/config.ts
// Single source of truth for WikiOS and MediaWiki configuration (plan 415, v1 decision D14):
// the wiki's name, its public host and its MediaWiki endpoints are read from the environment once,
// here. No other file spells the host or re-derives it from `process.env`. The sister wikis' hosts are listed
// in `wiki-hosts.ts`.

import { SISTER_READER_IDS, SISTER_WIKI_HOSTS, type SisterReaderId } from "./wiki-hosts";

export const DEFAULT_USER_AGENT = "IxStats-Builder";
export const MEDIAWIKI_TARGET_VERSION = "1.45.1";

/** The public host when `NEXT_PUBLIC_MEDIAWIKI_URL` is unset: the only place the host is spelled. */
const FALLBACK_PUBLIC_BASE_URL = "https://ixwiki.com";

/** IxWiki, or a sister wiki WikiOS reads pages of (`reader: true` in `wiki-hosts.ts`). */
export type WikiSource = "ixwiki" | SisterReaderId;

export interface WikiSourceConfig {
  name: string;
  baseUrl: string;
  apiEndpoint: string;
  description?: string;
  userAgent: string;
}

/** What `buildWikiosConfig` reads; each field is one environment variable, `undefined` when unset. */
export interface WikiosConfigInput {
  /** `NEXT_PUBLIC_MEDIAWIKI_URL`: the public origin of the wiki. */
  publicUrl?: string | undefined;
  /** `WIKIOS_MEDIAWIKI_INTERNAL_URL`: the loopback `api.php` the private render engine answers on. */
  internalApiUrl?: string | undefined;
  /** `WIKIOS_MEDIAWIKI_API`: the `api.php` the mirror writes through. */
  writeApiUrl?: string | undefined;
  /** `WIKIOS_MEDIAWIKI_BOT_USER`: the mirror's bot login (`Name@BotName`). */
  botUser?: string | undefined;
  /** `WIKIOS_TEMPLATESTYLES`: unset, empty, `1`, `true`, `on` or `yes` leaves TemplateStyles on; any other value turns it off. */
  templateStyles?: string | undefined;
}

export interface WikiosConfig {
  readonly siteName: string;
  /** The name of namespace 4: "IxWiki" in `IxWiki:Getting started`. */
  readonly projectNamespace: string;
  /** The public origin with no trailing slash: `https://ixwiki.com`. */
  readonly publicBaseUrl: string;
  /** Its host (with the port, if any): what a link to the wiki is recognised by. */
  readonly publicHost: string;
  /** Where articles live under the origin: `/wiki/`. */
  readonly articlePath: string;
  /** Sent to every wiki WikiOS reads; the sister wikis allow-list it. */
  readonly userAgent: string;
  /**
   * Whether an article's TemplateStyles `<style>` blocks survive the sanitizer (scoped and filtered). On when
   * `WIKIOS_TEMPLATESTYLES` is unset, empty, `1`, `true`, `on` or `yes`; any other value (`0`, `off`, a typo) is off,
   * so the lever fails closed: it is the emergency switch if a CSS bypass is reported, and removes every `<style>`
   * again (the behaviour before plan 415). Part of the sanitizer fingerprint, so toggling it re-renders stored bundles.
   * Server-side only (a browser bundle never sees `WIKIOS_TEMPLATESTYLES`); every `sanitizeWikiArticleHtml` caller runs on the server today.
   */
  readonly templateStyles: boolean;
  readonly mediawiki: {
    /** The public `api.php`: what a browser or an outside tool would call. */
    readonly publicApiUrl: string;
    /** The `api.php` every server-side call uses: the loopback engine when configured, else the public one. */
    readonly internalApiUrl: string;
    /** The `api.php` the mirror writes through. */
    readonly writeApiUrl: string;
    /** The mirror's bot login; `undefined` when none is configured (the mirror then stays off). */
    readonly botUser: string | undefined;
  };
}

function trimTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    throw new Error(`NEXT_PUBLIC_MEDIAWIKI_URL is not a URL: "${origin}"`);
  }
}

/** The configuration for `input`; a pure function, so a test can build one for any environment. */
export function buildWikiosConfig(input: WikiosConfigInput): WikiosConfig {
  const publicBaseUrl = trimTrailingSlashes(
    blankToUndefined(input.publicUrl) ?? FALLBACK_PUBLIC_BASE_URL
  );
  const publicApiUrl = `${publicBaseUrl}/api.php`;
  const internalApiUrl = blankToUndefined(input.internalApiUrl) ?? publicApiUrl;
  return Object.freeze({
    siteName: "WikiOS",
    projectNamespace: "IxWiki",
    publicBaseUrl,
    publicHost: hostOf(publicBaseUrl),
    articlePath: "/wiki/",
    userAgent: DEFAULT_USER_AGENT,
    templateStyles: /^(?:|1|true|on|yes)$/i.test(input.templateStyles?.trim() ?? ""),
    mediawiki: Object.freeze({
      publicApiUrl,
      internalApiUrl,
      writeApiUrl: blankToUndefined(input.writeApiUrl) ?? internalApiUrl,
      botUser: blankToUndefined(input.botUser),
    }),
  });
}

// Each variable is named in full: a browser bundle only replaces the `process.env.NEXT_PUBLIC_*` it can see.
export const wikiosConfig: WikiosConfig = buildWikiosConfig({
  publicUrl: process.env.NEXT_PUBLIC_MEDIAWIKI_URL,
  internalApiUrl: process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL,
  writeApiUrl: process.env.WIKIOS_MEDIAWIKI_API,
  botUser: process.env.WIKIOS_MEDIAWIKI_BOT_USER,
  templateStyles: process.env.WIKIOS_TEMPLATESTYLES,
});

/**
 * Whether production has no private render engine: `NODE_ENV=production` and `WIKIOS_MEDIAWIKI_INTERNAL_URL` unset,
 * blank, on the public wiki's host (`isMediaWikiUrl`) or IxStates itself (`isIxStatesUrl`), so server-side calls would
 * load the public `api.php` or loop back into WikiOS (plan 2026-10-25 B3, "Loopback required").
 * Renders (`renderArticleViaMediaWiki`, the editor preview, the stale-render batch) and mirror writes (unless
 * `WIKIOS_MEDIAWIKI_API` names a private write URL itself, `mirrorWriteUrlProblem`) then refuse rather than load the public wiki.
 * The low-volume reads (inbound sync, lore cards, the Lorewards fallback, account proof) keep the public fallback, so
 * an ordinary deploy without the runbook's step 4 stays safe. Dev and test never count as missing.
 * Read from `env` at call time, not from the frozen `wikiosConfig`. Server-side only.
 */
export function loopbackRendererMissing(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  if (env.NODE_ENV !== "production") return false;
  const internal = env.WIKIOS_MEDIAWIKI_INTERNAL_URL?.trim();
  // On the public wiki's host it is not private, and IxStates itself would parse through WikiOS's own api.php and
  // recurse: either counts as missing.
  return !internal || isMediaWikiUrl(internal) || isIxStatesUrl(internal, env);
}

/** Hosts that only this server reaches (`URL.hostname` is lower-case and brackets IPv6). */
const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/;

/**
 * Whether `url` is IxStates itself, where a mirror write would land in WikiOS (its `/w/api.php`): a path under the
 * app's base path (at a segment boundary), or a loopback host on the app's port (`PORT`, else production's 3550 from
 * start-production.sh). An unparseable URL is not.
 */
function isIxStatesUrl(url: string, env: Readonly<Record<string, string | undefined>>): boolean {
  if (!URL.canParse(url, "http://relative.invalid")) return false;
  const { hostname, port, pathname } = new URL(url, "http://relative.invalid");
  const base = (env.NEXT_PUBLIC_BASE_PATH || env.BASE_PATH || "").trim().replace(/\/+$/, "");
  if (base && (pathname === base || pathname.startsWith(`${base}/`))) return true;
  return LOOPBACK_HOST.test(hostname) && port === (env.PORT?.trim() || "3550");
}

/** The setting that leaves the mirror nowhere it may write in production (`mirrorWriteUrlProblem`). */
export type MirrorWriteUrlProblem = "WIKIOS_MEDIAWIKI_INTERNAL_URL" | "WIKIOS_MEDIAWIKI_API";

/**
 * Why the mirror may not write in production (plan 2026-10-25 B3), or null when it may. The write URL is
 * WIKIOS_MEDIAWIKI_API when set, else the internal one: so a WIKIOS_MEDIAWIKI_API on the public wiki's host is refused
 * whether or not the internal URL is set, and without it the private render engine must be configured
 * (`loopbackRendererMissing`). A write URL that is IxStates itself (`isIxStatesUrl`) is refused too, or the mirror
 * would write into WikiOS. Dev and test are never refused. Read from `env` at call time. Server-side only.
 */
export function mirrorWriteUrlProblem(
  env: Readonly<Record<string, string | undefined>> = process.env
): MirrorWriteUrlProblem | null {
  if (env.NODE_ENV !== "production") return null;
  const api = env.WIKIOS_MEDIAWIKI_API?.trim();
  if (api) return isMediaWikiUrl(api) || isIxStatesUrl(api, env) ? "WIKIOS_MEDIAWIKI_API" : null;
  return loopbackRendererMissing(env) ? "WIKIOS_MEDIAWIKI_INTERNAL_URL" : null;
}

/** Whether the mirror has nowhere it may write: the worker then skips every cycle and the jobs wait. */
export function mirrorWriteUrlMissing(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return mirrorWriteUrlProblem(env) !== null;
}

/** The public origin, with no trailing slash: where a browser reaches the wiki. */
export function mediaWikiOrigin(): string {
  return wikiosConfig.publicBaseUrl;
}

/**
 * The wiki's `api.php`. A server-side call asks for the `internal` one (the loopback engine when
 * configured); the `public` one is for a URL a browser or an outside tool follows.
 */
export function mediaWikiApiUrl({ internal }: { internal: boolean }): string {
  return internal ? wikiosConfig.mediawiki.internalApiUrl : wikiosConfig.mediawiki.publicApiUrl;
}

/** `/wiki/` path segment for a title: underscores, percent-encoded, ":" and "/" kept literal. */
export function titleUrlPath(title: string): string {
  return encodeURIComponent(title.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2F/g, "/");
}

/** The public URL of a page of the wiki (default IxWiki, else the sister wiki `source`). */
export function publicArticleUrl(title: string, source: WikiSource = "ixwiki"): string {
  return `${getWikiBaseUrl(source)}${wikiosConfig.articlePath}${titleUrlPath(title)}`;
}

/** The public URL of a file the wiki's host serves: `path` is `/images/8/88/Flag.svg` or `images/8/88/Flag.svg`. */
export function mediaWikiImageUrl(path: string): string {
  return `${wikiosConfig.publicBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Whether `url` (absolute or protocol-relative) is on `host` or its `www.` alias. */
export function isUrlOnHost(url: string, host: string): boolean {
  try {
    const found = new URL(url, "https://relative.invalid").host;
    return found === host || found === `www.${host}`;
  } catch {
    return false;
  }
}

/** Whether `url` is on the wiki's own host (or its `www.` alias): an absolute or protocol-relative URL. */
export function isMediaWikiUrl(url: string): boolean {
  return isUrlOnHost(url, wikiosConfig.publicHost);
}

/** A regular-expression source matching the wiki's host or its `www.` alias, for detecting a link to it. */
export function mediaWikiHostPattern(): string {
  return `(?:www\\.)?${wikiosConfig.publicHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
}

/** The title of the page a link on the wiki's own host points at (`https://<host>/wiki/Title`), or null. */
export function wikiTitleFromArticleUrl(url: string | null | undefined): string | null {
  const segment = url
    ? new RegExp(`${mediaWikiHostPattern()}\\/wiki\\/([^#?]+)`).exec(url)?.[1]
    : undefined;
  if (!segment) return null;
  try {
    return decodeURIComponent(segment).replace(/_/g, " ");
  } catch {
    return segment.replace(/_/g, " ");
  }
}

export const WIKI_SOURCES: Record<WikiSource, WikiSourceConfig> = {
  ixwiki: {
    name: wikiosConfig.siteName,
    baseUrl: wikiosConfig.publicBaseUrl,
    apiEndpoint: "/api.php",
    description:
      "The bespoke two-decades old geopolitical worldbuilding community & fictional encyclopedia",
    userAgent: DEFAULT_USER_AGENT,
  },
  // The sister wikis WikiOS reads, from their entries in wiki-hosts.ts.
  ...(Object.fromEntries(
    SISTER_READER_IDS.map((id): [SisterReaderId, WikiSourceConfig] => {
      const host = SISTER_WIKI_HOSTS[id];
      return [
        id,
        {
          name: host.name,
          baseUrl: host.origin,
          apiEndpoint: host.apiPath,
          description: host.description,
          userAgent: DEFAULT_USER_AGENT,
        },
      ];
    })
  ) as Record<SisterReaderId, WikiSourceConfig>),
};

export function getWikiBaseUrl(source: WikiSource = "ixwiki"): string {
  return WIKI_SOURCES[source]?.baseUrl ?? wikiosConfig.publicBaseUrl;
}

function isWikiSource(value: string): value is WikiSource {
  return Object.hasOwn(WIKI_SOURCES, value);
}

/** A `?source=` value as a wiki source; anything else reads as ixwiki. */
export function parseWikiSource(value: string | null | undefined): WikiSource {
  return value && isWikiSource(value) ? value : "ixwiki";
}

/**
 * `wikios.getArticleHtml` input: an IxWiki page by title alone, so the reader, the server render and
 * hover prefetch share one cache key. `followRedirect: false` is `?redirect=no`: the redirect page itself.
 */
export function articleHtmlInput(
  title: string,
  source: WikiSource,
  { followRedirect = true }: { followRedirect?: boolean } = {}
): { title: string; wikiSource?: WikiSource; redirect?: "no" } {
  if (source !== "ixwiki") return { title, wikiSource: source };
  return followRedirect ? { title } : { title, redirect: "no" };
}

/** The WikiOS reader path for a page; a page of another wiki carries `?source=`. */
export function wikiReaderPath(title: string, source: WikiSource = "ixwiki"): string {
  const path = `/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  return source === "ixwiki" ? path : `${path}?source=${source}`;
}

/**
 * Get the appropriate MediaWiki API URL based on context and wiki source. IxWiki's is the internal
 * one (the private render engine when configured): this is for server-side calls.
 */
export function getMediaWikiApiUrl(source: WikiSource = "ixwiki"): string {
  if (source === "ixwiki") return mediaWikiApiUrl({ internal: true });
  if (source === "iiwiki") {
    if (process.env.IIWIKI_DEV_PROXY_URL) {
      return process.env.IIWIKI_DEV_PROXY_URL;
    }
    if (process.env.NODE_ENV === "development") {
      return "https://maps.ixwiki.com/api/mediawiki/iiwiki/api.php";
    }
  }
  const wikiConfig = WIKI_SOURCES[source] ?? WIKI_SOURCES.ixwiki;
  return `${wikiConfig.baseUrl}${wikiConfig.apiEndpoint}`;
}

// ---------------------------------------------------------------------------
// Uploads (plan 411)
//
// Server-side limits and paths. They are NOT part of the frozen `wikiosConfig`: the three `get*` readers look at the
// environment on every call (their contract, and their tests set WIKIOS_MAX_IMAGE_AREA, WIKIOS_MAX_SVG_BYTES and
// WIKIOS_UPLOAD_DIR after this module has loaded), and none of them names the wiki's host or endpoints.
// ---------------------------------------------------------------------------

/**
 * The largest upload WikiOS takes, in bytes. A decimal 10 MB, not 10 MiB: the request body (the file itself, see
 * app/api/wiki/upload) must stay under Next's `experimental.proxyClientMaxBodySize` (10 MiB by default), which clones
 * a proxied body and silently truncates it past that size. Raise the two together (docs/operations/wikios-v1-cutover.md).
 */
export const MAX_UPLOAD_BYTES = 10_000_000;

/** The file types an upload may be, by extension. The bytes are what decide: see core/file-sniff.ts. */
export const UPLOAD_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "pdf"] as const;

/**
 * The most pixels (width times height) a raster upload may have: MediaWiki's `$wgMaxImageArea` default, 12.5 megapixels,
 * above which it cannot make a thumbnail of the file. WikiOS refuses such an upload as MediaWiki's own would end up useless.
 * A wiki that raised `$wgMaxImageArea` sets WIKIOS_MAX_IMAGE_AREA to the same number. An SVG is a drawing and is not held to it
 * (it is held to the byte limit like every file). Server only.
 */
export const DEFAULT_MAX_IMAGE_AREA = 12_500_000;

export function getMaxImageArea(): number {
  const configured = Number(process.env.WIKIOS_MAX_IMAGE_AREA);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_IMAGE_AREA;
}

/**
 * The largest SVG upload, in bytes: half the general limit. An SVG is read by a scan (core/svg-scan.ts) that takes
 * about a second at 10 MB in the worst case, and MediaWiki deployments commonly cap SVGs at a few megabytes. Set
 * WIKIOS_MAX_SVG_BYTES to change it (never above `MAX_UPLOAD_BYTES`, which holds first). Server only.
 */
export const DEFAULT_MAX_SVG_BYTES = 5_000_000;

export function getMaxSvgBytes(): number {
  const configured = Number(process.env.WIKIOS_MAX_SVG_BYTES);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_SVG_BYTES;
}

/** Where WikiOS keeps an upload until MediaWiki holds it too: WIKIOS_UPLOAD_DIR, else `.wikios-uploads` under the app. Server only. */
export function getUploadDir(): string {
  return process.env.WIKIOS_UPLOAD_DIR || `${process.cwd()}/.wikios-uploads`;
}

/** The path WikiOS serves an upload from while it alone holds the bytes (`wiki_assets.url`); the file's name follows. */
export const STAGED_FILE_PATH = "/api/wiki/file/";

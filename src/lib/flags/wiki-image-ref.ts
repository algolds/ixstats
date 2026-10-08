/**
 * A country's flag or coat of arms as a wiki file, and the local file it becomes. Realm nations get their images
 * from their wiki's infobox as URLs on this app's media proxy (`/api/mediawiki/<wiki>/wiki/Special:FilePath/<file>`
 * or `/api/mediawiki/<wiki>/images/...`) or as https URLs on the wiki, which the proxy fetches on every view.
 * `scripts/realms/localize-realm-flags.ts` turns them into files in `public/flags/` the way IxWorld's flags are.
 *
 * Any wiki WikiOS reads (IxWiki and the sister wikis of `wiki-hosts.ts`) is understood; nothing names a realm.
 * Pure and client-safe.
 */
import { getBasePath } from "~/lib/base-path";
import { WIKI_SOURCES, type WikiSource } from "~/lib/wiki-os/config";
import { SISTER_READER_IDS, SISTER_WIKI_HOSTS } from "~/lib/wiki-os/wiki-hosts";

export interface WikiImageRef {
  source: WikiSource;
  /** The file's name without `File:`, spaces for underscores ("Flag of Euandria.png"). */
  fileName: string;
}

export type ImageField = "flag" | "coatOfArms";
const IMAGE_FIELDS: readonly ImageField[] = ["flag", "coatOfArms"];

/** Where local flag and arms files are served from (`public/flags/`), as IxWorld's `Country.flag` stores them. */
export const LOCAL_FLAG_PREFIX = "/flags/";

const PROXY_PREFIX = "/api/mediawiki/";
const HASH_DIR = /^[0-9a-f]$/;
const HASH_SUBDIR = /^[0-9a-f]{2}$/;
const BAD_FILE_CHARS = /[/\\#<>[\]|{}]/;

function isWikiSource(id: string): id is WikiSource {
  return Object.hasOwn(WIKI_SOURCES, id);
}

/** Each wiki's own host, and a sister wiki's upload CDN (`mediaHosts`), to the wiki. */
const HOST_SOURCES: ReadonlyMap<string, WikiSource> = new Map<string, WikiSource>([
  ...Object.keys(WIKI_SOURCES)
    .filter(isWikiSource)
    .map((id): [string, WikiSource] => [new URL(WIKI_SOURCES[id].baseUrl).hostname, id]),
  ...SISTER_READER_IDS.flatMap((id) =>
    SISTER_WIKI_HOSTS[id].mediaHosts.map((host): [string, WikiSource] => [host, id])
  ),
]);

function decode(segment: string | undefined): string | null {
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** A file name from a path segment: no `File:`, spaces for underscores, nothing MediaWiki forbids. */
function fileTitle(segment: string | undefined): string | null {
  const name = decode(segment)
    ?.replace(/^(?:file|image):/i, "")
    .replace(/_/g, " ")
    .trim();
  return name && !BAD_FILE_CHARS.test(name) ? name : null;
}

/** The file of `wiki/Special:FilePath/<file>`, or of an `/images/` path (after `thumb` and the hash directories). */
function fileFromSegments(segments: string[]): string | null {
  if (segments[0] === "wiki" && /^Special:FilePath$/i.test(segments[1] ?? "")) {
    return segments.length === 3 ? fileTitle(segments[2]) : null;
  }
  const at = segments.indexOf("images");
  if (at < 0) return null;
  const rest = segments.slice(at + 1);
  if (rest[0] === "thumb") rest.shift();
  return HASH_DIR.test(rest[0] ?? "") && HASH_SUBDIR.test(rest[1] ?? "")
    ? fileTitle(rest[2])
    : null;
}

function pathSegments(path: string): string[] {
  return (path.split(/[?#]/)[0] ?? "").split("/").filter(Boolean);
}

function fromHttpsUrl(value: string): WikiImageRef | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const source = HOST_SOURCES.get(url.hostname);
  const fileName = source ? fileFromSegments(pathSegments(url.pathname)) : null;
  return source && fileName ? { source, fileName } : null;
}

function fromProxyPath(value: string): WikiImageRef | null {
  const base = getBasePath();
  const path = base && value.startsWith(`${base}/`) ? value.slice(base.length) : value;
  if (!path.startsWith(PROXY_PREFIX)) return null;
  const [source = "", ...segments] = pathSegments(path.slice(PROXY_PREFIX.length));
  const fileName = isWikiSource(source) ? fileFromSegments(segments) : null;
  return isWikiSource(source) && fileName ? { source, fileName } : null;
}

/** The wiki file a stored flag or arms URL shows, or null when it is not one (a local file, an upload, another host). */
export function parseWikiImageRef(value: string | null | undefined): WikiImageRef | null {
  if (!value) return null;
  return /^https:\/\//i.test(value) ? fromHttpsUrl(value) : fromProxyPath(value);
}

/** A slug folded to `[a-z0-9]` runs joined by single hyphens. */
function slugPart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The local file of a realm nation's image: `<realm>--<country>.<ext>` for a flag, `<realm>--<country>--arms.<ext>`
 * for arms. The realm prefix keeps realms apart from each other and from IxWorld's `<country>.<ext>` files; slugs
 * never hold `--`, so the name is unambiguous. Null when a slug folds to nothing.
 */
export function localImageFileName(
  realmSlug: string,
  countrySlug: string,
  field: ImageField,
  ext: string
): string | null {
  const realm = slugPart(realmSlug);
  const country = slugPart(countrySlug);
  if (!realm || !country) return null;
  return `${realm}--${country}${field === "coatOfArms" ? "--arms" : ""}.${ext}`;
}

export interface ImageCountry {
  id: string;
  slug: string;
  flag: string | null;
  coatOfArms: string | null;
}

export interface ImageTask {
  countryId: string;
  countrySlug: string;
  field: ImageField;
  current: string;
  ref: WikiImageRef;
}

export interface ImageSkip {
  countrySlug: string;
  field: ImageField;
  reason: "local" | "not a wiki file";
}

/** What localizing these countries' images would do: a task per wiki file, and why the other images stay. */
export function planImageLocalization(countries: readonly ImageCountry[]): {
  tasks: ImageTask[];
  skipped: ImageSkip[];
} {
  const tasks: ImageTask[] = [];
  const skipped: ImageSkip[] = [];
  for (const country of countries) {
    for (const field of IMAGE_FIELDS) {
      const current = country[field];
      if (!current) continue;
      const ref = parseWikiImageRef(current);
      if (ref) {
        tasks.push({ countryId: country.id, countrySlug: country.slug, field, current, ref });
      } else {
        const reason = current.startsWith(LOCAL_FLAG_PREFIX) ? "local" : "not a wiki file";
        skipped.push({ countrySlug: country.slug, field, reason });
      }
    }
  }
  return { tasks, skipped };
}

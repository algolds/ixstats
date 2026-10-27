/**
 * IxStates' public URL: the origin of `APP_URL` (server) or `NEXT_PUBLIC_APP_URL`, plus the deployment's base path,
 * once. Every absolute link IxStates hands to something outside it (feeds, Discord, edge purges, story-chain sections
 * on the wiki) is built here. Only the origin of the variable is read, so a base path written into it is never doubled.
 *
 * With neither set (or not an http(s) URL): dev uses the wiki's origin, which also serves IxStates under its base path;
 * production throws, naming the variable, because a link on the wrong host is worse than an error. In production a
 * loopback host (`localhost`, `*.localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`: `.env.example`'s value) counts as missing
 * too, and the other variable is not tried. The check runs when a link is built, never at import, so a missing
 * variable fails only the links that need it.
 *
 * Server and client safe: no MediaWiki calls.
 */
import { withBasePath } from "~/lib/base-path";
import { mediaWikiOrigin, wikiReaderPath, type WikiSource } from "~/lib/wiki-os/config";

/** Hosts no visitor can reach IxStates on (`URL.hostname` is lower-case and brackets IPv6). */
const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$|\.localhost$/;

/** `value` as an http(s) URL, or null when it is unset or not such a URL. */
function httpUrl(value: string | undefined): URL | null {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  return /^https?:$/.test(url.protocol) ? url : null;
}

/**
 * IxStates' public origin (`https://ixwiki.com`), with no path. Throws in production when it is not configured or is a
 * loopback host. Each variable is read by its literal name, so Next inlines `NEXT_PUBLIC_APP_URL` in client bundles.
 */
export function appOrigin(): string {
  const [name, value] = process.env.APP_URL
    ? ["APP_URL", process.env.APP_URL]
    : ["NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL];
  const production = process.env.NODE_ENV === "production";
  const url = httpUrl(value);
  if (url && !(production && LOOPBACK_HOST.test(url.hostname))) return url.origin;
  if (production) {
    throw new Error(
      `${name} is not a public http(s) URL (${value ?? "unset"}): set NEXT_PUBLIC_APP_URL (or APP_URL) to IxStates' public origin; no absolute link is built on a wrong host.`
    );
  }
  return new URL(mediaWikiOrigin()).origin;
}

/** An absolute IxStates URL for a root-relative app `path` (no base path needed); an absolute URL is returned as it is. */
export function appUrl(path: string): string {
  if (/^(?:https?:)?\/\//i.test(path)) return path;
  return `${appOrigin()}${withBasePath(path)}`;
}

/** The absolute URL of a page in the WikiOS reader. */
export function wikiPermalink(title: string, source: WikiSource = "ixwiki"): string {
  return appUrl(wikiReaderPath(title, source));
}

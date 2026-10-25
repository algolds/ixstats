/**
 * IxStates' public URL: the origin of `APP_URL` (server) or `NEXT_PUBLIC_APP_URL`, plus the deployment's base path,
 * once. Every absolute link IxStates hands to something outside it (feeds, Discord, edge purges, story-chain sections
 * on the wiki) is built here. Only the origin of the variable is read, so a base path written into it is never doubled.
 *
 * With neither set (or not an http(s) URL): dev uses the wiki's origin, which also serves IxStates under its base path;
 * production throws, naming the variable, because a link on the wrong host is worse than an error. The check runs when
 * a link is built, never at import, so a missing variable fails only the links that need it.
 *
 * Server and client safe: no MediaWiki calls.
 */
import { withBasePath } from "~/lib/base-path";
import { mediaWikiOrigin, wikiReaderPath, type WikiSource } from "~/lib/wiki-os/config";

/** The http(s) origin of `value`, or null when it is unset or not such a URL. */
function httpOrigin(value: string | undefined): string | null {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  return /^https?:$/.test(url.protocol) ? url.origin : null;
}

/** IxStates' public origin (`https://ixwiki.com`), with no path. Throws in production when it is not configured. */
export function appOrigin(): string {
  const origin = httpOrigin(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL);
  if (origin) return origin;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL (or APP_URL) is not set to an http(s) URL: IxStates has no public origin to build an absolute link on."
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

/**
 * Old profile and passport links that wiki pages still carry, resolved to the current pages when a page is
 * rendered: `/thinkpages/profile/<u>` and `/thinkpages/u/<u>` open the persona profile, `/id/@<u>` and
 * `/@<u>/<tab>` open the passport (`/@<u>?tab=<tab>`). A link keeps the IxWiki origin it already has, and a base
 * path it has becomes the current one (the old `/projects/ixstats` included); a link to any other site is not
 * touched.
 */

const BASE_PATH = "/projects/ixstates";
const OLD_BASE_PATH = "/projects/ixstats";
const SITE = String.raw`((?:https?:\/\/(?:www\.)?ixwiki\.com)?)(\/projects\/(?:ixstates|ixstats))?`;
const PERSONA = new RegExp(
  String.raw`^${SITE}\/thinkpages\/(?:profile|u)\/([^/?#]+)\/?([?#].*)?$`,
  "u"
);
const PASSPORT = new RegExp(
  String.raw`^${SITE}(\/id)?\/@([^/?#]+)(?:\/([\w-]+))?\/?(?:\?([^#]*))?(#.*)?$`,
  "u"
);

/** The link's origin, then the current base path when the link had a base path. */
function siteOf(origin: string, base: string | undefined): string {
  return `${origin}${base ? BASE_PATH : ""}`;
}

/** The current page for an old profile or passport `href`, or `href` itself when it is neither. */
export function currentProfileHref(href: string): string {
  const persona = PERSONA.exec(href);
  if (persona) {
    const [, origin, base, user, rest = ""] = persona;
    return `${siteOf(origin, base)}/dashboard/profile/${user}${rest}`;
  }

  const passport = PASSPORT.exec(href);
  if (!passport) return href;
  const [, origin, base, id, user, tab, query, hash = ""] = passport;
  if (!id && !tab && base !== OLD_BASE_PATH) return href;
  // The path's tab wins over a `tab=` already in the query; the rest of the query stays byte for byte.
  const rest = (query ?? "")
    .split("&")
    .filter((part) => part && (!tab || !/^tab(=|$)/u.test(part)));
  const search = [...(tab ? [`tab=${tab}`] : []), ...rest].join("&");
  return `${siteOf(origin, base)}/@${user}${search ? `?${search}` : ""}${hash}`;
}

const HREF = /href="([^"]*)"/gu;

/** `html` with each link's `href` resolved by `currentProfileHref`. */
export function currentProfileLinks(html: string): string {
  if (!html.includes("/thinkpages/") && !html.includes("/@")) return html;
  return html.replace(HREF, (_match, href: string) => `href="${currentProfileHref(href)}"`);
}

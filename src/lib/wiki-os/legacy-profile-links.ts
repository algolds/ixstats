/**
 * Old profile and passport links that wiki pages still carry, resolved to the current pages when a page is
 * rendered: `/thinkpages/profile/<u>` and `/thinkpages/u/<u>` open the persona profile, `/id/@<u>` and
 * `/@<u>/<tab>` open the passport (`/@<u>?tab=<tab>`). A link keeps the base path and the IxWiki origin it
 * already has; a link to any other site is not touched.
 */

const SITE = String.raw`((?:https?:\/\/(?:www\.)?ixwiki\.com)?(?:\/projects\/ixstates)?)`;
const PERSONA = new RegExp(
  String.raw`^${SITE}\/thinkpages\/(?:profile|u)\/([^/?#]+)\/?([?#].*)?$`,
  "u"
);
const PASSPORT = new RegExp(
  String.raw`^${SITE}(\/id)?\/@([^/?#]+)(?:\/([\w-]+))?\/?(?:\?([^#]*))?(#.*)?$`,
  "u"
);

/** The current page for an old profile or passport `href`, or `href` itself when it is neither. */
export function currentProfileHref(href: string): string {
  const persona = PERSONA.exec(href);
  if (persona) return `${persona[1]}/dashboard/profile/${persona[2]}${persona[3] ?? ""}`;

  const passport = PASSPORT.exec(href);
  if (!passport) return href;
  const [, site, id, user, tab, query, hash = ""] = passport;
  if (!id && !tab) return href;
  // The path's tab wins over a `tab=` already in the query; the rest of the query stays byte for byte.
  const rest = (query ?? "")
    .split("&")
    .filter((part) => part && (!tab || !/^tab(=|$)/u.test(part)));
  const search = [...(tab ? [`tab=${tab}`] : []), ...rest].join("&");
  return `${site}/@${user}${search ? `?${search}` : ""}${hash}`;
}

const HREF = /href="([^"]*)"/gu;

/** `html` with each link's `href` resolved by `currentProfileHref`. */
export function currentProfileLinks(html: string): string {
  if (!html.includes("/thinkpages/") && !html.includes("/@")) return html;
  return html.replace(HREF, (_match, href: string) => `href="${currentProfileHref(href)}"`);
}

/**
 * An article's links as the country page shows them (with no base path, every link already is). WikiOS stores article HTML with root-relative links
 * (`/wiki/Title`, profile links): on IxStates's deployment those would leave the app for the classic wiki at the
 * site's root, so each one gets the base path, as a Next `<Link>` would give it. MediaWiki's own paths (`/images/`,
 * `/w/`) stay at the root, where they live. Pure.
 *
 * The HTML is already sanitized (WikiOS's view bundle). Only the value of an `<a>` tag's `href` changes, and only by
 * a constant prefix, so nothing can be let in: text cannot hold a literal `<a` (it is escaped as `&lt;`), and a quoted
 * attribute value cannot hold a literal `"`.
 */

const ROOT_LINK = /(<a\b[^>]*?\shref=")(\/(?!\/)[^"]*)"/gi;
const MEDIAWIKI_PATH = /^\/(?:images|w)(?:\/|$)/;

export function linksUnderBasePath(html: string, basePath: string): string {
  return html.replace(ROOT_LINK, (match, head: string, path: string) => {
    const under = path === basePath || path.startsWith(`${basePath}/`);
    return under || MEDIAWIKI_PATH.test(path) ? match : `${head}${basePath}${path}"`;
  });
}

/**
 * An article's HTML as the country page shows it. All three transforms work on WikiOS's already-sanitized view
 * bundle and only ever change attribute values or a heading tag's level, by fixed rules, so nothing can be let in:
 * text cannot hold a literal `<` followed by a tag name (it is serialized as `&lt;`), and a double-quoted attribute
 * value cannot hold a literal `"`. Each looks only inside a tag. Pure.
 */

const LINK = /(<a\b[^>]*?\shref=")(\/[^"]*)"/gi;
/** The app's own routes in article links; every other root path (`/index.php`, `/api.php`, `/images/`) is MediaWiki's. */
const APP_PATH = /^\/(?:wiki\/|dashboard\/|@)/;

/** Whether `path` already carries the base path: the base path itself, or it followed by `/`, `?` or `#`. */
function underBasePath(path: string, basePath: string): boolean {
  return path === basePath || ["/", "?", "#"].some((next) => path.startsWith(basePath + next));
}

/**
 * WikiOS stores article links root-relative and without the base path (`/wiki/Title`, `/@handle`): on IxStates's
 * deployment they would leave the app for the classic wiki at the site's root, so each app link gets the base path,
 * as a Next `<Link>` would give it. The same allowlist as WikiOS's reader hrefs (`/wiki/`, `/dashboard/`, `/@`).
 */
export function linksUnderBasePath(html: string, basePath: string): string {
  return html.replace(LINK, (match, head: string, path: string) =>
    APP_PATH.test(path) && !underBasePath(path, basePath) ? `${head}${basePath}${path}"` : match
  );
}

const TAG = /<[a-z][^>]*>/gi;
const ID = /(\sid=")([^"]*)"/gi;
const FRAGMENT = /(\shref="#)([^"]+)"/gi;
const ID_REFS =
  /(\saria-(?:activedescendant|controls|describedby|details|errormessage|flowto|labelledby|owns)=")([^"]*)"/gi;

const escapeAttribute = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Between a prefix and the page's own id. A chapter id (`loreChapterId`) always encodes it (as `.3A`), so a scoped id
 * names one chapter and one page id: a piece titled "Senate-History" never meets "Senate"'s History section, and a
 * section named "heading" never meets the chapter's own `<chapter>-heading`.
 */
const SCOPE_SEPARATOR = ":";

/**
 * The page's ids made its own: MediaWiki numbers footnotes (`cite_note-1`) and names headings the same way on every
 * page, so several pages on one screen would share ids, and a footnote in one would jump to another's note. Every
 * `id`, every `href="#…"` and every aria id reference gets `<prefix>:`.
 */
export function scopeArticleIds(html: string, prefix: string): string {
  const scoped = escapeAttribute(prefix);
  const scope = (id: string) => `${scoped}${SCOPE_SEPARATOR}${id}`;
  return html.replace(TAG, (tag) =>
    tag
      .replace(ID, (_m, head: string, id: string) => `${head}${scope(id)}"`)
      .replace(FRAGMENT, (_m, head: string, id: string) => `${head}${scope(id)}"`)
      .replace(
        ID_REFS,
        (_m, head: string, ids: string) =>
          `${head}${ids.split(/\s+/).filter(Boolean).map(scope).join(" ")}"`
      )
  );
}

const HEADING = /<(\/?)h([1-6])(?=[\s>/])/gi;
/** A piece's own sections sit under its `h3` title. */
const HEADING_SHIFT = 2;

/** The page's headings moved down two levels (h2 to h4, and so on, never past h6), to follow a piece's h3 title. */
export function shiftArticleHeadings(html: string): string {
  return html.replace(
    HEADING,
    (_m, close: string, level: string) => `<${close}h${Math.min(6, Number(level) + HEADING_SHIFT)}`
  );
}

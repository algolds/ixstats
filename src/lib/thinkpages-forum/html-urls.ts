/**
 * URLs inside stored post HTML (phase 4). Stored HTML is environment-free: uploads and imported attachments are
 * root-relative (`/images/uploads/…`), so the renderer puts them under the deployment's base path. Pure; the
 * caller passes `withBasePath`, which leaves a path that already carries the base path alone (the editor's
 * downloaded-image picks arrive prefixed), so rebasing is idempotent.
 */
import { mapHtmlRuns } from "~/lib/action-links";

// One attribute of a tag, its quoted value consumed whole so a match never starts inside another value.
const ATTRIBUTE = /(\s+)([^\s"'>/=]+)(?:(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
const URL_ATTRIBUTES = new Set(["src", "href"]);
// Root-relative: one slash, not `//host` or `/\host` (both reach another host).
const ROOT_RELATIVE = /^"\/(?![/\\])/;
const IMAGE_WITH_SRC = /<img\b(?:"[^"]*"|'[^']*'|[^>"'])*?\ssrc="\s*[^"\s]/i;

function rebaseAttribute(
  match: string,
  space: string,
  name: string,
  equals: string | undefined,
  value: string | undefined,
  base: (path: string) => string
): string {
  if (!value || !URL_ATTRIBUTES.has(name.toLowerCase()) || !ROOT_RELATIVE.test(value)) return match;
  return `${space}${name}${equals}"${base(value.slice(1, -1))}"`;
}

/** `src="/…"` and `href="/…"` in tags (never in text) rewritten through `base`; every other URL left alone. */
export function rebaseRootRelativeUrls(html: string, base: (path: string) => string): string {
  return mapHtmlRuns(html, {
    markup: (tag) =>
      tag.replace(
        ATTRIBUTE,
        (match, space: string, name: string, equals?: string, value?: string) =>
          rebaseAttribute(match, space, name, equals, value, base)
      ),
  });
}

/** Whether the HTML holds an `<img>` with a non-empty `src` (an image counts as post content). */
export const hasImageSrc = (html: string) => IMAGE_WITH_SRC.test(html);

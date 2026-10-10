/**
 * XenForo's custom wiki BBCode (`[wikilink]`, `[wikisummary]`, `[wikiinfobox]`, `[wikiimage=W]`) as forum markup the
 * post body renders as wiki links and embeds. The title is user text, so it only ever reaches an attribute escaped,
 * and the link is built here from the title alone: the wiki's article URL (`wiki-os/config.ts`) plus the title, never from a URL the author
 * wrote. A title that is not a plausible MediaWiki title (markup characters, a line break, bracket, pipe, brace, `#`,
 * empty or dot path segments, over 255 characters) leaves its tags as literal text, so nothing the author typed is
 * lost. An escaped tag (`\[wikiimage=300]…[/wikiimage]`) is literal text too.
 */
import { mediaWikiOrigin, wikiosConfig } from "~/lib/wiki-os/config";
import { replacePairs, type PairSpec } from "./bbcode-pairs";
import { escapeHtml, unescapeHtml } from "./html-text";

const TITLE_MAX = 255;
const WIDTH_MAX = 1200;

const FORBIDDEN_TITLE_CHARS = new Set('<>"[]{}|#');
const isControl = (char: string): boolean => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127;

/** The title as the author wrote it (trimmed), or null when it must not become a link. */
function titleOf(content: string): string | null {
  const title = unescapeHtml(content).trim();
  if (!title || title.length > TITLE_MAX) return null;
  if ([...title].some((c) => FORBIDDEN_TITLE_CHARS.has(c) || isControl(c))) return null;
  return title.split("/").every((part) => part !== "" && part !== "." && part !== "..")
    ? title
    : null;
}

/** The wiki page URL, escaped for an attribute; null for a title that cannot be percent-encoded. */
function hrefOf(title: string): string | null {
  try {
    const path = title
      .replace(/ /g, "_")
      .split("/")
      .map((part) => encodeURIComponent(part).replace(/%3A/gi, ":"))
      .join("/");
    return escapeHtml(`${mediaWikiOrigin()}${wikiosConfig.articlePath}${path}`);
  } catch {
    return null;
  }
}

/** The tags as text: brackets as entities, so no later step reads them as tags. */
const literal = (tag: string, opener: string, content: string): string =>
  `&#91;${tag}${opener.slice(0, -1)}&#93;${content}&#91;/${tag}&#93;`;

type Render = (title: string, href: string, opener: RegExpExecArray) => string;

function wikiTag(tag: string, rest: RegExp, render: Render): PairSpec {
  return {
    tag,
    rest,
    render: (opener, content) => {
      const title = titleOf(content);
      const href = title === null ? null : hrefOf(title);
      return title === null || href === null
        ? literal(tag, opener[0], content)
        : render(title, href, opener);
    },
  };
}

const widthAttr = (option: string | undefined): string => {
  if (!option || !/^\d{1,6}$/.test(option)) return "";
  return ` data-width="${Math.min(Math.max(parseInt(option, 10), 1), WIDTH_MAX)}"`;
};

const embed =
  (kind: string, attrs: (opener: RegExpExecArray) => string = () => ""): Render =>
  (title, href, opener) => {
    const text = escapeHtml(title);
    return `<div class="forum-wiki-embed" data-wiki-embed="${kind}" data-wiki-title="${text}"${attrs(opener)}><a href="${href}">${text}</a></div>`;
  };

const WIKI_TAGS: PairSpec[] = [
  wikiTag("wikilink", /\]/y, (title, href) => {
    const text = escapeHtml(title);
    return `<a href="${href}" class="forum-wikilink" data-wiki-title="${text}">${text}</a>`;
  }),
  wikiTag("wikisummary", /\]/y, embed("summary")),
  wikiTag("wikiinfobox", /\]/y, embed("infobox")),
  wikiTag(
    "wikiimage",
    /(?:=([^\]]*))?\]/y,
    embed("image", (opener) => widthAttr(opener[1]))
  ),
];

// `\[wikiimage=300]…[/wikiimage]`: the backslash stays, the tags become text. The content class stops at the next
// `[`, so a scan never runs past the following tag.
const ESCAPED_PAIR = /\\\[(wiki(?:link|summary|infobox|image))((?:=[^[\]]*)?)\]([^[]*)\[\/\1\]/gi;
const ESCAPED_OPENER = /\\\[(wiki(?:link|summary|infobox|image)(?:=[^[\]]*)?)\]/gi;

const protectEscaped = (html: string): string =>
  html
    .replace(ESCAPED_PAIR, "\\&#91;$1$2&#93;$3&#91;/$1&#93;")
    .replace(ESCAPED_OPENER, "\\&#91;$1&#93;");

/** Works on the escaped body (bbcode.ts step 17b), before line breaks become `<br />`. */
export function replaceWikiTags(html: string): string {
  return WIKI_TAGS.reduce((out, spec) => replacePairs(out, spec), protectEscaped(html));
}

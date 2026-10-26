/**
 * sanitize-sister-html.ts: `sanitizeSisterHtml`, the trust boundary for HTML another wiki (IIWiki, AltHistory) rendered,
 * for the reader or an embed. It is the article sanitizer (`sanitize-html.ts`: its config, its shared hooks, its
 * TemplateStyles filter and depth guard) with a stricter style policy and the hooks below; see `sanitizeSisterHtml`.
 */
import type { Config } from "dompurify";
import { stripClassTokens } from "~/lib/thinkpages-forum/strip-positioning";
import { SISTER_ID_PREFIX } from "~/lib/wiki-os/sister-dom";
import { isSisterMediaPath, sisterMediaPath } from "~/lib/wiki-os/sister-media";
import { filterSrcset } from "~/lib/wiki-os/transformers/srcset";
import type { SisterReaderId } from "~/lib/wiki-os/wiki-hosts";
import {
  createArticlePurifier,
  nestedTooDeepSource,
  WIKI_ARTICLE_SANITIZE_CONFIG,
} from "./sanitize-html";
import { cleanStyleDeclarations, type StylePolicy } from "./scope-template-styles";

type Purifier = ReturnType<typeof createArticlePurifier>;

export { SISTER_ID_PREFIX };

/** What `position` may be in a sister page: nothing that leaves the article (`fixed`, `sticky`, a `var()`, ...). */
const IN_FLOW_POSITIONS = new Set([
  "static",
  "relative",
  "absolute",
  "inherit",
  "initial",
  "unset",
  "revert",
]);
const POSITION_PROPERTY = /^(?:-[a-z]+-)?position$/;
/** Position keywords that take an element out of the article: a custom property holding one is dropped too. */
const OUT_OF_FLOW_POSITIONS = new Set(["fixed", "sticky", "-webkit-sticky"]);
/** Attributes whose value is a list of ids: they name the prefixed ids too. */
const ID_REFERENCE_ATTRIBUTES = new Set([
  "headers",
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-owns",
  "aria-flowto",
  "aria-activedescendant",
  "aria-details",
  "aria-errormessage",
]);
/** The data attributes a sister page keeps: TemplateStyles' marker (the style filter reads it) and table sorting. */
const KEPT_DATA_ATTRIBUTES = new Set(["data-mw-deduplicate", "data-sort-value", "data-sort-type"]);
/**
 * Class namespaces the app styles (WikiOS, Facet, Clerk, the forum, MapLibre, Lorewards, the map): a sister page
 * naming one would borrow the app's own fixed popovers, sheets and overlays.
 */
const APP_CLASS_PREFIXES = [
  "wikios-",
  "facet-",
  "cl-",
  "forum-",
  "maplibregl-",
  "loreward-",
  "ixmap-",
];
/** The app classes WikiOS's own transform adds to a page (red links, edit sections): harmless, and styled for it. */
const TRANSFORM_CLASSES = new Set(["wikios-redlink", "wikios-edit-section"]);
/** Tailwind utilities sized by the viewport (`h-screen`, `w-dvw`, `min-h-svh`, `size-lvh`, ...). */
const VIEWPORT_UTILITY = /^(?:min-|max-)?(?:h|w|size)-(?:screen|[dls]v[hw])$/;
const EXTERNAL_LINK_REL = "noopener noreferrer nofollow";
/** Relative links resolve against this; one that comes out on any other origin leaves IxStates. */
const LINK_BASE = "https://ixstates.invalid";

/**
 * The CSS a sister page may keep, in a `style` attribute (`cleanStyleDeclarations`) or TemplateStyles: beyond what the
 * TemplateStyles rules block (`expression(`, `behavior`, `-moz-binding`, `image-set(`, ...), a declaration goes when a
 * `url()` in it is not of the wiki's media proxy, or when it positions an element out of the article (`fixed`, `sticky`,
 * a `var()`). A style that cannot be read with certainty goes whole.
 */
function sisterStylePolicy(wiki: SisterReaderId): StylePolicy {
  return {
    allowsUrl: (target) => isSisterMediaPath(target, wiki),
    allowsDeclaration: (property, value) => {
      const keyword = (value.split("!")[0] ?? "").trim();
      if (POSITION_PROPERTY.test(property)) return IN_FLOW_POSITIONS.has(keyword);
      return !(property.startsWith("--") && OUT_OF_FLOW_POSITIONS.has(keyword));
    },
  };
}

/** Whether a class token is the app's: one of its namespaces (but the transform's own), or a viewport-sized utility. */
function isAppClass(token: string): boolean {
  if (TRANSFORM_CLASSES.has(token)) return false;
  const utility = (token.split(":").pop() ?? token).replace(/^!/, "");
  return (
    APP_CLASS_PREFIXES.some((prefix) => utility.startsWith(prefix)) ||
    VIEWPORT_UTILITY.test(utility)
  );
}

/** A sister page's classes without those that position an element (`stripClassTokens`) and without the app's own. */
function sisterClasses(value: string): string | null {
  const kept = stripClassTokens(value)
    .split(" ")
    .filter((token) => token !== "" && !isAppClass(token));
  return kept.length > 0 ? kept.join(" ") : null;
}

/** An id, an id reference or an in-page link of a reader page, prefixed (see SISTER_ID_PREFIX); null when `name` is none. */
function prefixedIdValue(name: string, value: string): string | null {
  if (name === "id") return `${SISTER_ID_PREFIX}${value}`;
  if (name === "href")
    return value.startsWith("#") && value.length > 1
      ? `#${SISTER_ID_PREFIX}${value.slice(1)}`
      : value;
  if (!ID_REFERENCE_ATTRIBUTES.has(name)) return null;
  return value
    .split(/\s+/)
    .map((id) => `${SISTER_ID_PREFIX}${id}`)
    .join(" ");
}

/** Whether `href` leaves IxStates: it resolves, as a browser reads it, on another origin. */
function isExternalHref(href: string): boolean {
  try {
    return new URL(href, LINK_BASE).origin !== LINK_BASE;
  } catch {
    return false;
  }
}

/** A lazy image (Fandom's): an empty or `data:` placeholder `src` gives way to `data-src`, a missing `srcset` to `data-srcset`. */
function useLazySource(img: Element): void {
  const src = img.getAttribute("src")?.trim() ?? "";
  const lazySrc = img.getAttribute("data-src");
  if (lazySrc && (src === "" || src.toLowerCase().startsWith("data:")))
    img.setAttribute("src", lazySrc);
  const lazySrcset = img.getAttribute("data-srcset");
  if (lazySrcset && !img.hasAttribute("srcset")) img.setAttribute("srcset", lazySrcset);
}

/**
 * An attribute of a sister page, rewritten or dropped: what loads goes through the media proxy or goes, classes and
 * data attributes lose what the app's own CSS reacts to, and ids are prefixed.
 */
function sisterAttributeValue(
  name: string,
  value: string,
  wiki: SisterReaderId,
  policy: StylePolicy
): string | null {
  switch (name) {
    case "src":
      return sisterMediaPath(value, wiki);
    case "srcset":
      return filterSrcset(value, (url) => sisterMediaPath(url, wiki)) || null;
    case "style":
      return cleanStyleDeclarations(value, policy) || null;
    case "class":
      return sisterClasses(value);
    default:
      if (name.startsWith("data-")) return KEPT_DATA_ATTRIBUTES.has(name) ? value : null;
      return prefixedIdValue(name, value) ?? value;
  }
}

/** An element after its attributes are sanitized: an image with no source goes; an external link is inert. */
function finishSisterElement(node: Element): void {
  if (node.tagName === "IMG" && !node.getAttribute("src")) {
    node.remove();
    return;
  }
  const href = node.tagName === "A" ? node.getAttribute("href") : null;
  if (href !== null && isExternalHref(href)) {
    node.setAttribute("rel", EXTERNAL_LINK_REL);
    node.removeAttribute("target");
  }
}

const sisterPurifiers = new Map<SisterReaderId, Purifier>();

/** One instance per wiki: the article's (shared hooks, TemplateStyles under the sister policy) plus the sister hooks. */
function getSisterPurifier(wiki: SisterReaderId): Purifier {
  const existing = sisterPurifiers.get(wiki);
  if (existing) return existing;
  const policy = sisterStylePolicy(wiki);
  const created = createArticlePurifier(policy);
  created.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName === "img") useLazySource(node as Element);
  });
  created.addHook("uponSanitizeAttribute", (_node, event) => {
    const value = sisterAttributeValue(event.attrName, event.attrValue, wiki, policy);
    if (value === null) event.keepAttr = false;
    else event.attrValue = value;
  });
  created.addHook("afterSanitizeAttributes", (node) => finishSisterElement(node as Element));
  sisterPurifiers.set(wiki, created);
  return created;
}

const SISTER_EMBED_SANITIZE_CONFIG: Config = {
  ...WIKI_ARTICLE_SANITIZE_CONFIG,
  FORBID_TAGS: [...(WIKI_ARTICLE_SANITIZE_CONFIG.FORBID_TAGS ?? []), "style"],
  FORBID_ATTR: [...(WIKI_ARTICLE_SANITIZE_CONFIG.FORBID_ATTR ?? []), "id"],
};

/**
 * Sister wiki HTML (IIWiki, AltHistory: a page that wiki rendered, for the reader or an embed). The trust boundary for
 * another wiki's markup: the article sanitizer (and its depth guard), plus
 *  - images only through that wiki's media proxy (`sisterMediaPath`; a lazy image's `data-src` first); any other image
 *    goes, `srcset` keeps only the candidates that map, `data-src`/`data-srcset` never stay;
 *  - styles without an off-proxy `url()`, `expression()`, `behavior`, `-moz-binding`, `image-set()` or a `fixed`/`sticky`
 *    position, in `style` attributes and TemplateStyles alike;
 *  - no class the app styles (its namespaces, its positioning and viewport utilities) and no data attribute but
 *    TemplateStyles' marker and table sorting, so nothing in the page switches on the app's own fixed or page-wide CSS;
 *  - ids prefixed `sister-` (with the in-page links and id references that name them), so none collides with the app's;
 *  - external links `rel="noopener noreferrer nofollow"` with no `target`.
 * An embed (`embed: true`) also has no `<style>` and no `id`: it sits inside another page. The reader also contains a
 * sister page in a box of its own (`.wikios-sister-article`: layout and paint containment, isolation).
 */
export function sanitizeSisterHtml(
  html: string,
  wiki: SisterReaderId,
  options: { embed: boolean }
): string {
  if (!html) return "";
  const config = options.embed ? SISTER_EMBED_SANITIZE_CONFIG : WIKI_ARTICLE_SANITIZE_CONFIG;
  return nestedTooDeepSource(html) ?? getSisterPurifier(wiki).sanitize(html, config);
}

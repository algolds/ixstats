/**
 * sanitize-sister-html.ts: `sanitizeSisterHtml`, the trust boundary for HTML another wiki (IIWiki, AltHistory) rendered,
 * for the reader or an embed. It is the article sanitizer (`sanitize-html.ts`: its config, its shared hooks, its
 * TemplateStyles filter and depth guard) with a stricter style policy and the hooks below; see `sanitizeSisterHtml`.
 */
import type { Config } from "dompurify";
import { stripClassTokens } from "~/lib/thinkpages-forum/strip-positioning";
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
    allowsDeclaration: (property, value) =>
      !POSITION_PROPERTY.test(property) ||
      IN_FLOW_POSITIONS.has((value.split("!")[0] ?? "").trim()),
  };
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

/** An attribute of a sister page, rewritten or dropped: what loads goes through the media proxy or goes. */
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
    case "data-src":
    case "data-srcset":
      return null;
    case "style":
      return cleanStyleDeclarations(value, policy) || null;
    case "class":
      return stripClassTokens(value) || null;
    default:
      return value;
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
 *    position, in `style` attributes and TemplateStyles alike, and classes without the app's positioning utilities;
 *  - external links `rel="noopener noreferrer nofollow"` with no `target`.
 * An embed (`embed: true`) also has no `<style>` and no `id`: it sits inside another page.
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

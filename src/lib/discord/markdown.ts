/**
 * ThinkPages HTML to Discord Markdown
 *
 * Converts a ThinkPages post's HTML into the markdown Discord renders in an embed.
 * Parses the markup as XML first and falls back to regex rewriting when it will not parse.
 */

import { DOMParser, type Element as XmlElement, type Node as XmlNode } from "@xmldom/xmldom";
import { appUrl } from "~/lib/app-url";
import { WIKI_SOURCES, parseWikiSource } from "~/lib/wiki-os/config";
import { readerLinkPath } from "~/lib/wiki-os/wiki-link-target";

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function autoCloseHtmlTags(html: string): string {
  const tags = [
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "del",
    "strike",
    "code",
    "pre",
    "p",
    "a",
    "ul",
    "ol",
    "li",
  ];
  let closedHtml = html;

  for (const tag of tags) {
    const openCount = (closedHtml.match(new RegExp(`<${tag}\\b[^>]*>`, "gi")) || []).length;
    const closeCount = (closedHtml.match(new RegExp(`</${tag}>`, "gi")) || []).length;

    if (openCount > closeCount) {
      const missing = openCount - closeCount;
      closedHtml += `</${tag}>`.repeat(missing);
    }
  }

  return closedHtml;
}

export function htmlToDiscordMarkdown(html: string): string {
  if (!html) return "";

  const closedHtml = autoCloseHtmlTags(html);

  try {
    const parser = new DOMParser({
      onError: (level, message) => {
        if (level === "fatalError") {
          throw new Error(message);
        }
      },
    });

    const doc = parser.parseFromString(`<div>${closedHtml}</div>`, "text/xml");
    const root = doc.documentElement;
    if (root) {
      const result = convertNodeToMarkdown(root).trim();
      return result.replace(/\n{3,}/g, "\n\n");
    }
  } catch (err) {
    console.warn("[htmlToDiscordMarkdown] XML parsing failed, using regex fallback:", err);
  }

  return fallbackHtmlToMarkdown(closedHtml);
}

/** Site-relative links become absolute so they work outside IxStates. */
const absoluteUrl = (href: string) => (href.startsWith("/") ? appUrl(href) : href);

/** Discord's inline markdown characters (link brackets, emphasis, code, spoilers), and the backslash escaping them. */
const MARKDOWN_CHARACTER = /[\\[\]()*_~`|]/g;

/** `text` with every markdown character escaped, so a page title reads as text, inside link text or out. */
const escapeMarkdown = (text: string) => text.replace(MARKDOWN_CHARACTER, "\\$&");

/**
 * A wiki embed: the page in the WikiOS reader on the app URL (`appUrl(wikiReaderPath)`, `?source=` for a sister wiki),
 * naming its wiki. A title that would climb out of `/wiki/` (`readerLinkPath`) is named with no link. The title is
 * escaped, and the URL carries `(` and `)` percent-encoded (`encodeURIComponent` leaves them), so neither can end the
 * link early.
 */
const wikiEmbedMarkdown = (title: string, summary: string, source: string) => {
  const wiki = parseWikiSource(source);
  const path = readerLinkPath(title, wiki);
  const url = path && appUrl(path).replaceAll("(", "%28").replaceAll(")", "%29");
  const name = url ? `[${escapeMarkdown(title)}](${url})` : escapeMarkdown(title);
  return `\n**Wiki Embed: ${name}**\n*Source: ${WIKI_SOURCES[wiki].name}*\n> ${summary}\n`;
};

/** Markdown wrapping per element; tags not listed pass their children through. */
const TAG_MARKDOWN: Record<string, (children: string) => string> = {
  p: (c) => `\n${c}\n`,
  strong: (c) => `**${c}**`,
  b: (c) => `**${c}**`,
  em: (c) => `*${c}*`,
  i: (c) => `*${c}*`,
  u: (c) => `__${c}__`,
  s: (c) => `~~${c}~~`,
  del: (c) => `~~${c}~~`,
  strike: (c) => `~~${c}~~`,
  code: (c) => `\`${c}\``,
  pre: (c) => `\`\`\`\n${c}\n\`\`\``,
  ul: (c) => `\n${c}\n`,
  ol: (c) => `\n${c}\n`,
  li: (c) => `- ${c.trim()}\n`,
  br: () => "\n",
};

function convertNodeToMarkdown(node: XmlNode | null): string {
  if (!node) return "";
  if (node.nodeType === 3) return decodeHtmlEntities(node.nodeValue || "");
  if (node.nodeType !== 1) return "";

  // nodeType 1 is an element
  const element = node as XmlElement;
  const tagName = element.tagName.toLowerCase();
  const children = Array.from(element.childNodes || [])
    .map((child) => convertNodeToMarkdown(child))
    .join("");
  const attr = (name: string): string => element.getAttribute?.(name) || "";

  switch (tagName) {
    case "div":
      return attr("data-wikiembed") === "true"
        ? wikiEmbedMarkdown(
            attr("data-title"),
            attr("data-summary"),
            attr("data-source") || "ixwiki"
          )
        : children;
    case "a":
      return `[${children}](${absoluteUrl(attr("href"))})`;
    case "img":
      return `[Image: ${attr("alt") || "image"}](${attr("src")})`;
    default:
      return TAG_MARKDOWN[tagName]?.(children) ?? children;
  }
}

function fallbackHtmlToMarkdown(html: string): string {
  // Tag pairs whose content is wrapped as-is
  const wrap =
    (tags: string[], open: string, close = open) =>
    (text: string) =>
      tags.reduce(
        (acc, tag) =>
          acc.replace(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "gi"), `${open}$1${close}`),
        text
      );

  let text = html.replace(
    /<div[^>]*data-wikiembed="true"[^>]*data-title="([^"]+)"[^>]*data-summary="([^"]*)"[^>]*data-source="([^"]*)"[^>]*><\/div>/gi,
    (_: string, title: string, summary: string, source: string) =>
      wikiEmbedMarkdown(
        decodeHtmlEntities(title),
        decodeHtmlEntities(summary),
        decodeHtmlEntities(source || "ixwiki")
      )
  );

  // Structural elements
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(?:p|ul|ol)[^>]*>|<\/(?:p|ul|ol)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n");

  // Inline formatting
  text = wrap(["strong", "b"], "**")(text);
  text = wrap(["em", "i"], "*")(text);
  text = wrap(["u"], "__")(text);
  text = wrap(["s", "del", "strike"], "~~")(text);
  text = wrap(["code"], "`")(text);
  text = wrap(["pre"], "```\n", "\n```")(text);

  text = text
    .replace(
      /<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi,
      (_: string, href: string, content: string) => `[${content}](${absoluteUrl(href)})`
    )
    .replace(
      /<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*\/?>/gi,
      (_: string, src: string, alt: string) => `[Image: ${alt || "image"}](${src})`
    )
    .replace(/<[^>]+>/g, "");

  return decodeHtmlEntities(text)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

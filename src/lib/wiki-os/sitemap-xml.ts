/**
 * sitemap-xml.ts — the XML of the sitemap index and of one sitemap file, and robots.txt. Pure:
 * `origin` is the public host ("https://ixwiki.com"), the entries come from `sitemap-service`.
 */

import { canonicalizeTitle } from "./core/title";
import type { SitemapEntry } from "./core/sitemap-service";

export const XML_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
} as const;

const XML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** `text` safe inside XML element content and attribute values. */
export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';
const XMLNS = "http://www.sitemaps.org/schemas/sitemap/0.9";

/** The index of `pageCount` sitemap files, `<origin>/wiki-sitemap/<n>`. */
export function sitemapIndexXml(origin: string, pageCount: number): string {
  const files = Array.from(
    { length: pageCount },
    (_, index) =>
      `  <sitemap><loc>${escapeXml(`${origin}/wiki-sitemap/${index + 1}`)}</loc></sitemap>\n`
  ).join("");
  return `${XML_HEAD}<sitemapindex xmlns="${XMLNS}">\n${files}</sitemapindex>\n`;
}

/** One sitemap file: a `<url>` for each page that has a canonical URL. */
export function sitemapPageXml(origin: string, entries: readonly SitemapEntry[]): string {
  const urls = entries
    .flatMap((entry) => {
      const canon = canonicalizeTitle(entry.title);
      if (!canon) return [];
      const loc = escapeXml(`${origin}/wiki/${canon.urlPath}`);
      return [
        `  <url><loc>${loc}</loc><lastmod>${entry.lastModified.toISOString()}</lastmod></url>\n`,
      ];
    })
    .join("");
  return `${XML_HEAD}<urlset xmlns="${XMLNS}">\n${urls}</urlset>\n`;
}

/** robots.txt: read the articles, leave the tools and every view of a page that is not its text. */
export function robotsTxt(origin: string): string {
  return [
    "User-agent: *",
    "Allow: /wiki/",
    "Disallow: /util/",
    "Disallow: /api/",
    "Disallow: /wiki/Special:",
    "Disallow: /*?action=",
    "Disallow: /*?*action=",
    "Disallow: /*?oldid=",
    "Disallow: /*?*oldid=",
    "Disallow: /*?diff=",
    "Disallow: /*?*diff=",
    "Disallow: /*?*redirect=no",
    "",
    `Sitemap: ${origin}/wiki-sitemap`,
    "",
  ].join("\n");
}

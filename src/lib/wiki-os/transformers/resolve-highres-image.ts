import { safeDecodeURI } from "./safe-decode";

export interface HighResWikiImageResult {
  highResSrc: string;
  thumbSrc: string;
  alt: string;
  filename: string;
  fileUrl: string;
  isSvg: boolean;
}

function cleanFileName(raw: string): string {
  return safeDecodeURI(raw).replace(/_/g, " ").trim();
}

const stripQuery = (url: string): string => url.split(/[?#]/)[0]!;

/**
 * Universal MediaWiki and Wikimedia Commons de-thumbnailing:
 * - https://ixwiki.com/images/thumb/8/8c/File.jpg/300px-File.jpg -> https://ixwiki.com/images/8/8c/File.jpg
 * - /api/mediawiki/ixwiki/images/thumb/8/8c/File.jpg/300px-File.jpg -> /api/mediawiki/ixwiki/images/8/8c/File.jpg
 * - https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Logo.svg/300px-Logo.svg.png -> .../wikipedia/commons/a/ab/Logo.svg
 * - https://static.wikia.nocookie.net/.../revision/latest/scale-to-width-down/300 -> .../revision/latest
 */
function deThumbnail(src: string): { highResSrc: string; filename: string } {
  const match = src.match(
    /(.*(?:\/images|\/wikipedia\/commons|\/wikipedia\/en)\/)thumb(\/[^?#]+)\/[^/?#]+(?:\?[^#]*)?$/i
  );
  if (match?.[1] && match[2]) {
    const subpath = match[2].replace(/^\//, "");
    return {
      highResSrc: `${match[1]}${subpath}`,
      filename: cleanFileName(stripQuery(subpath).split("/").pop() || ""),
    };
  }
  if (src.includes("/revision/latest/scale-to-width-down/")) {
    return { highResSrc: src.split("/scale-to-width-down/")[0]!, filename: "" };
  }
  return { highResSrc: src, filename: "" };
}

/** File name carried by a link to a File:/Image: page or Special:FilePath. */
function filenameFromLink(href: string): string {
  const rawName =
    /\/wiki\/(?:File|Image):([^?#&]+)/i.exec(href)?.[1] ||
    /\/wiki\/Special:FilePath\/([^?#&]+)/i.exec(href)?.[1];
  return rawName ? cleanFileName(rawName) : "";
}

/**
 * Given an <img> element and an optional parent <a> link, resolves the 100% highest-quality
 * original master file URL for full-screen lightbox inspection.
 */
export function resolveHighResWikiImage(
  img: HTMLImageElement,
  link?: HTMLAnchorElement | null
): HighResWikiImageResult {
  const thumbSrc = img.getAttribute("src") || img.src || "";
  const alt = img.getAttribute("alt") || img.title || "";
  const linkHref = link?.getAttribute("href") || "";

  let { highResSrc, filename } = deThumbnail(thumbSrc);

  // Vector SVG recovery: restore the true .svg behind a rasterized .svg.png
  highResSrc = highResSrc.replace(/\.svg\.png$/, ".svg");

  // Without a de-thumbnailed URL, the last (largest) srcset candidate is the best render available
  if (highResSrc === thumbSrc) {
    const candidates = (img.getAttribute("srcset") ?? "")
      .split(",")
      .map((c) => c.trim().split(/\s+/));
    const highest = candidates[candidates.length - 1]?.[0];
    if (highest?.startsWith("http")) highResSrc = highest;
  }

  filename ||= filenameFromLink(linkHref);
  filename ||= cleanFileName(stripQuery(highResSrc).split("/").pop() || "Wiki Media");

  // fileUrl points to a readable wiki description page
  const fileUrl =
    linkHref || (filename ? `/wiki/File:${encodeURIComponent(filename.replace(/ /g, "_"))}` : "");
  const isSvg =
    highResSrc.toLowerCase().includes(".svg") || filename.toLowerCase().endsWith(".svg");

  return { highResSrc, thumbSrc, alt: alt || filename, filename, fileUrl, isSvg };
}

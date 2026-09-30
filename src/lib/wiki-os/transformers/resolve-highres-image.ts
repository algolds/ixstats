import { safeDecodeURI } from "./safe-decode";

export interface HighResWikiImageResult {
  highResSrc: string;
  thumbSrc: string;
  alt: string;
  filename: string;
  fileUrl: string;
  isSvg: boolean;
}

/**
 * Clean and decode a filename or URL component.
 */
function cleanFileName(raw: string): string {
  return safeDecodeURI(raw).replace(/_/g, " ").trim();
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

  let highResSrc = thumbSrc;
  let filename = "";
  let fileUrl = linkHref;

  // 1. Primary Strategy: Universal MediaWiki & Wikimedia Commons de-thumbnailing
  // Matches:
  // - https://ixwiki.com/images/thumb/8/8c/File.jpg/300px-File.jpg -> https://ixwiki.com/images/8/8c/File.jpg
  // - /images/thumb/a/ab/File.svg/300px-File.svg.png -> /images/a/ab/File.svg
  // - /api/mediawiki/ixwiki/images/thumb/8/8c/File.jpg/300px-File.jpg -> /api/mediawiki/ixwiki/images/8/8c/File.jpg
  // - https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Logo.svg/300px-Logo.svg.png -> .../wikipedia/commons/a/ab/Logo.svg
  // - https://static.wikia.nocookie.net/.../revision/latest/scale-to-width-down/300 -> .../revision/latest
  const mwThumbMatch = thumbSrc.match(
    /(.*(?:\/images|\/wikipedia\/commons|\/wikipedia\/en)\/)thumb(\/[^?#]+)\/[^/?#]+(?:\?[^#]*)?$/i
  );
  if (mwThumbMatch && mwThumbMatch[1] && mwThumbMatch[2]) {
    const baseDir = mwThumbMatch[1];
    const subpath = mwThumbMatch[2].replace(/^\//, "");
    highResSrc = `${baseDir}${subpath}`;
    const cleanSub = subpath.split("?")[0]!.split("#")[0]!;
    const parts = cleanSub.split("/");
    filename = cleanFileName(parts[parts.length - 1] || "");
  } else if (thumbSrc.includes("/revision/latest/scale-to-width-down/")) {
    // Fandom / Wikia scaling
    highResSrc = thumbSrc.split("/scale-to-width-down/")[0]!;
  }

  // 2. Vector SVG recovery: if ending in .svg.png, restore true vector .svg
  if (highResSrc.endsWith(".svg.png")) {
    highResSrc = highResSrc.replace(/\.svg\.png$/i, ".svg");
  }

  // 3. Inspect srcset for highest-resolution render fallback if de-thumb wasn't possible
  if (highResSrc === thumbSrc) {
    const srcset = img.getAttribute("srcset");
    if (srcset) {
      const candidates = srcset.split(",").map((s) => s.trim().split(/\s+/));
      const highest = candidates[candidates.length - 1]?.[0];
      if (highest && highest.startsWith("http")) {
        highResSrc = highest;
      }
    }
  }

  // 4. If filename not found yet, try parent link href
  if (!filename && linkHref) {
    const fileMatch = linkHref.match(/\/wiki\/(?:File|Image|file|image):([^?#&]+)/i);
    const specialMatch = linkHref.match(/\/wiki\/Special:FilePath\/([^?#&]+)/i);
    const rawName = fileMatch?.[1] || specialMatch?.[1];
    if (rawName) {
      filename = cleanFileName(rawName);
    }
  }

  // 5. If filename is still empty, derive from cleaned highResSrc
  if (!filename) {
    const clean = highResSrc.split("?")[0]!.split("#")[0]!;
    const segments = clean.split("/");
    filename = cleanFileName(segments[segments.length - 1] || "Wiki Media");
  }

  // 6. Ensure fileUrl points to a readable wiki description page
  if (!fileUrl && filename) {
    fileUrl = `/wiki/File:${encodeURIComponent(filename.replace(/ /g, "_"))}`;
  }

  const isSvg =
    highResSrc.toLowerCase().includes(".svg") || filename.toLowerCase().endsWith(".svg");

  return {
    highResSrc,
    thumbSrc,
    alt: alt || filename,
    filename,
    fileUrl,
    isSvg,
  };
}

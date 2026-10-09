import { withBasePath } from "~/lib/base-path";
import { isMediaWikiUrl, publicArticleUrl } from "~/lib/wiki-os/config";

export interface CommonsImage {
  pageid: number;
  title: string;
  thumbUrl: string;
  url: string;
  descriptionUrl: string;
  width: number;
  height: number;
  mime: string;
  description: string;
  artist: string;
  license: string;
}

function getImageType(mime: string, title: string): "jpg" | "png" | "svg" | "other" {
  const m = (mime || "").toLowerCase();
  const t = (title || "").toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg") || t.endsWith(".jpg") || t.endsWith(".jpeg"))
    return "jpg";
  if (m.includes("png") || t.endsWith(".png")) return "png";
  if (m.includes("svg") || t.endsWith(".svg")) return "svg";
  return "other";
}

/** The shape of an image, or null when its size is not known (vectors and some wiki files). */
function getImageOrientation(
  width: number,
  height: number
): "landscape" | "portrait" | "square" | null {
  if (!width || !height) return null;
  const ratio = width / height;
  if (ratio > 1.1) return "landscape";
  if (ratio < 0.9) return "portrait";
  return "square";
}

export type ImageTypeFilter = "all" | "jpg" | "png" | "svg";
export type ImageOrientationFilter = "all" | "landscape" | "portrait" | "square";

const MIME_TERMS: Record<ImageTypeFilter, string> = {
  all: "",
  jpg: "filemime:image/jpeg",
  png: "filemime:image/png",
  svg: "filemime:image/svg+xml",
};

/** The Commons search term that limits results to one file type ("" for all types). */
export function commonsMimeTerm(filter: ImageTypeFilter): string {
  return MIME_TERMS[filter];
}

export function matchesImageFilters(
  img: CommonsImage,
  fileType: ImageTypeFilter,
  orientation: ImageOrientationFilter
): boolean {
  return (
    (fileType === "all" || getImageType(img.mime ?? "", img.title) === fileType) &&
    (orientation === "all" || getImageOrientation(img.width, img.height) === orientation)
  );
}

/** Appends `incoming` images not already present (by url). */
export function dedupeImages(existing: CommonsImage[], incoming: CommonsImage[]): CommonsImage[] {
  const seen = new Set(existing.map((img) => img.url));
  const fresh: CommonsImage[] = [];
  for (const img of incoming) {
    if (seen.has(img.url)) continue;
    seen.add(img.url);
    fresh.push(img);
  }
  return [...existing, ...fresh];
}

export type WikiSubSource = "ixwiki" | "iiwiki";

interface WikiFileRecord {
  name: string;
  size: number;
  width: number;
  height: number;
  mime?: string;
  url?: string;
  /** A reduced-size preview; absent or null when the server has none. */
  thumbUrl?: string | null;
}

/** Route direct wiki file URLs through the local MediaWiki proxy. */
function proxyWikiFileUrl(rawUrl: string): string {
  // IxWiki's files are on its configured public host (not necessarily ixwiki.com).
  if (isMediaWikiUrl(rawUrl)) {
    return withBasePath(rawUrl.replace(/^(?:https?:)?\/\/[^/]+\//, "/api/mediawiki/ixwiki/"));
  }
  for (const host of ["iiwiki", "ixwiki"]) {
    if (rawUrl.includes(`${host}.com/`)) {
      return withBasePath(
        rawUrl.replace(new RegExp(`^https?://(www\\.)?${host}\\.com/`), `/api/mediawiki/${host}/`)
      );
    }
  }
  return rawUrl;
}

/** Shape IxWiki/IIWiki file-search hits like Commons images (identified by their url; `pageid` is the position). */
export function wikiFilesToImages(files: WikiFileRecord[], source: WikiSubSource): CommonsImage[] {
  const isIiwiki = source === "iiwiki";
  return files.map((img, index) => {
    const url = proxyWikiFileUrl(img.url || "");
    const sizeKb = (img.size / 1024).toFixed(1);
    return {
      pageid: index,
      title: img.name.startsWith("File:") ? img.name : `File:${img.name}`,
      thumbUrl: img.thumbUrl ? proxyWikiFileUrl(img.thumbUrl) : url,
      url,
      descriptionUrl: publicArticleUrl(`File:${img.name}`, isIiwiki ? "iiwiki" : "ixwiki"),
      width: img.width || 0,
      height: img.height || 0,
      mime: img.mime || "image/png",
      description: isIiwiki
        ? `External upload on IIWiki. Size: ${sizeKb} KB`
        : `Local upload on IxWiki. Size: ${sizeKb} KB`,
      artist: "",
      license: "",
    };
  });
}

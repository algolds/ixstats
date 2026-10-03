import { withBasePath } from "~/lib/base-path";

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

function getImageOrientation(
  width: number,
  height: number
): "landscape" | "portrait" | "square" {
  if (!width || !height) return "landscape";
  const ratio = width / height;
  if (ratio > 1.1) return "landscape";
  if (ratio < 0.9) return "portrait";
  return "square";
}

export type ImageTypeFilter = "all" | "jpg" | "png" | "svg";
export type ImageOrientationFilter = "all" | "landscape" | "portrait" | "square";

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

/** Appends `incoming` images not already present (by pageid). */
export function dedupeImages(existing: CommonsImage[], incoming: CommonsImage[]): CommonsImage[] {
  const seen = new Set(existing.map((img) => img.pageid));
  return [...existing, ...incoming.filter((img) => !seen.has(img.pageid))];
}

export type WikiSubSource = "ixwiki" | "iiwiki";

interface WikiFileRecord {
  name: string;
  size: number;
  width: number;
  height: number;
  mime?: string;
  url?: string;
}

/** Route direct wiki file URLs through the local MediaWiki proxy. */
function proxyWikiFileUrl(rawUrl: string): string {
  for (const host of ["iiwiki", "ixwiki"]) {
    if (rawUrl.includes(`${host}.com/`)) {
      return withBasePath(
        rawUrl.replace(new RegExp(`^https?://(www\\.)?${host}\\.com/`), `/api/mediawiki/${host}/`)
      );
    }
  }
  return rawUrl;
}

/** Shape IxWiki/IIWiki file-search hits like Commons images (synthetic, source-offset page ids). */
export function wikiFilesToImages(files: WikiFileRecord[], source: WikiSubSource): CommonsImage[] {
  const isIiwiki = source === "iiwiki";
  const offset = isIiwiki ? 2000000 : 1000000;
  return files.map((img, index) => {
    const url = proxyWikiFileUrl(img.url || "");
    const sizeKb = (img.size / 1024).toFixed(1);
    return {
      pageid: index + offset,
      title: img.name.startsWith("File:") ? img.name : `File:${img.name}`,
      thumbUrl: url,
      url,
      descriptionUrl: `https://${source}.com/wiki/File:${encodeURIComponent(img.name)}`,
      width: img.width || 0,
      height: img.height || 0,
      mime: img.mime || "image/png",
      description: isIiwiki
        ? `External upload on IIWiki. Size: ${sizeKb} KB`
        : `Local upload on IxWiki. Size: ${sizeKb} KB`,
      artist: isIiwiki ? "IIWiki Contributor" : "IxWiki Contributor",
      license: "CC BY-SA 3.0",
    };
  });
}

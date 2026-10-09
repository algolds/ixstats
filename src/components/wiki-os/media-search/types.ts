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
  /** The file's BlurHash, shown while its thumbnail loads (wiki sources only). */
  blurhash?: string | null;
}

/** A minimal image for a url that is not on a loaded page (a shared `file=` link): only the url is known. */
export function imageFromUrl(url: string): CommonsImage {
  const lastSegment = (url.split(/[?#]/)[0] ?? "").split("/").filter(Boolean).pop() ?? "";
  let name = lastSegment;
  try {
    name = decodeURIComponent(lastSegment);
  } catch {
    // keep the raw segment when it holds a malformed escape
  }
  return {
    pageid: 0,
    title: name.replace(/_/g, " "),
    thumbUrl: url,
    url,
    descriptionUrl: url,
    width: 0,
    height: 0,
    mime: "",
    description: "",
    artist: "",
    license: "",
  };
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

/** The sources of the Wiki tab: two wikis, the images imported from the old forum, and the signed-in user's own uploads. */
export type WikiSubSource = "ixwiki" | "iiwiki" | "forum" | "mine";

interface WikiFileRecord {
  name: string;
  size: number;
  width: number;
  height: number;
  mime?: string;
  url?: string;
  /** A reduced-size preview; absent or null when the server has none. */
  thumbUrl?: string | null;
  /** The file's BlurHash; absent or null when none was made. */
  blurhash?: string | null;
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

const SOURCE_DESCRIPTIONS: Record<WikiSubSource, string> = {
  ixwiki: "Local upload on IxWiki",
  iiwiki: "External upload on IIWiki",
  forum: "Imported from the old forum",
  mine: "Your upload",
};

/** The page that describes a file: its wiki page for the two wikis, the file itself for forum and own uploads. */
function descriptionUrlFor(name: string, source: WikiSubSource, url: string): string {
  if (source === "forum" || source === "mine") return url;
  return publicArticleUrl(`File:${name}`, source);
}

/** Shape repository file hits like Commons images (identified by their url; `pageid` is the position). */
export function wikiFilesToImages(files: WikiFileRecord[], source: WikiSubSource): CommonsImage[] {
  return files.map((img, index) => {
    const url = proxyWikiFileUrl(img.url || "");
    const sizeKb = (img.size / 1024).toFixed(1);
    return {
      pageid: index,
      title: img.name.startsWith("File:") ? img.name : `File:${img.name}`,
      thumbUrl: img.thumbUrl ? proxyWikiFileUrl(img.thumbUrl) : url,
      url,
      descriptionUrl: descriptionUrlFor(img.name, source, url),
      width: img.width || 0,
      height: img.height || 0,
      mime: img.mime || "image/png",
      description: `${SOURCE_DESCRIPTIONS[source]}. Size: ${sizeKb} KB`,
      artist: "",
      license: "",
      blurhash: img.blurhash ?? null,
    };
  });
}

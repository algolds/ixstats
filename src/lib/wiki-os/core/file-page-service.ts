/**
 * file-page-service.ts — where the file behind a `File:` page lives: WikiOS's own `wiki_assets` row
 * when there is one, else the path MediaWiki's MD5-sharded `images/` directory keeps it at.
 */

import { getImageUrl } from "../transformers/image-url";
import { ArticleRepository } from "./article-repository";
import { MediaAssetService } from "./media-asset-service";
import { canonicalizeTitle } from "./title";

export interface FileInfo {
  /** The file name without the `File:` prefix, spaces not underscores. */
  name: string;
  url: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  sizeBytes: number | null;
}

/**
 * The file called `rawName` ("Flag of Eurth.svg", with or without `File:`), or null when WikiOS has
 * neither an asset row for it nor a description page: a file can only be told from a missing one by
 * one of the two, because the `images/` path is computed, not looked up.
 */
export async function getFileInfo(rawName: string): Promise<FileInfo | null> {
  const page = canonicalizeTitle(`File:${rawName.replace(/^(?:file|image):/i, "")}`);
  if (!page) return null;

  const asset = await MediaAssetService.findAsset(page.base);
  if (asset) {
    return {
      name: page.base,
      url: asset.url,
      thumbUrl: asset.thumbnailUrl ?? null,
      width: asset.width ?? null,
      height: asset.height ?? null,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
    };
  }

  const described = (await ArticleRepository.findMissingTitles([page.title])).length === 0;
  if (!described) return null;
  return {
    name: page.base,
    url: getImageUrl(page.base),
    thumbUrl: null,
    width: null,
    height: null,
    mimeType: null,
    sizeBytes: null,
  };
}

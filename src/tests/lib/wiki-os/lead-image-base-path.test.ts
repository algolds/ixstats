/** @jest-environment node */
/**
 * C (plan 2026-10-25 sister wikis, Task 13 browser check): under the production base path a sister page's images are
 * already proxied with the base path (`sanitizeSisterHtml`). Its lead image, the hero, keeps that one URL; it is not
 * wrapped again as an IxWiki path (`/projects/ixstates/api/mediawiki/ixwiki/projects/ixstates/api/...`, a 404).
 */
import {
  extractLeadImage,
  getMd5ShardPath,
  normalizeWikiImageUrl,
  resolveStoredImageUrl,
} from "~/lib/wiki-os/transformers/image-url";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";

const BASE = "/projects/ixstates";
const SISTER_FLAG = `${BASE}/api/mediawiki/althistory/wiki/Special:FilePath/Flag_of_Poland.svg`;
const STAGED_UPLOAD = "/api/wiki/file/Flag_of_Eurth.png";
const STAGED_UPLOAD_WITH_BASE = `${BASE}${STAGED_UPLOAD}`;

let savedBasePath: string | undefined;
beforeEach(() => {
  savedBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = BASE;
});
afterEach(() => {
  if (savedBasePath === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = savedBasePath;
});

describe("a proxied image under the base path", () => {
  it("keeps its one URL", () => {
    expect(normalizeWikiImageUrl(SISTER_FLAG)).toBe(SISTER_FLAG);
  });

  it("is a sister page's lead image as it stands", () => {
    const infobox = `<table class="infobox"><tr><td><img src="${SISTER_FLAG}" width="125" height="78"></td></tr></table>`;
    expect(extractLeadImage(infobox)?.url).toBe(SISTER_FLAG);
  });

  it("still sends a bare IxWiki path through the IxWiki proxy", () => {
    expect(normalizeWikiImageUrl("/images/a/ab/Flag.png")).toBe(
      `${BASE}/api/mediawiki/ixwiki/images/a/ab/Flag.png`
    );
  });

  it("keeps a staged WikiOS upload on /api/wiki/file/ under the base path instead of wrapping it in the MediaWiki proxy", () => {
    expect(normalizeWikiImageUrl(STAGED_UPLOAD)).toBe(STAGED_UPLOAD_WITH_BASE);
    expect(normalizeWikiImageUrl(STAGED_UPLOAD_WITH_BASE)).toBe(STAGED_UPLOAD_WITH_BASE);
    expect(resolveStoredImageUrl(STAGED_UPLOAD)).toBe(STAGED_UPLOAD_WITH_BASE);
  });

  it("canonicalizes MD5 shard paths identically between MediaAssetService and image-url", () => {
    for (const raw of [
      "caphiria_flag.svg",
      "File:caphiria flag.svg",
      "Image:Caphiria%20flag.svg",
      "  flag of\u200Beurth.png  ",
    ]) {
      const fromTransformer = getMd5ShardPath(raw);
      const fromService = MediaAssetService.getMd5ShardPath(raw);
      expect(fromService.cleanName).toBe(fromTransformer.cleanName);
      expect(fromService.shard).toBe(fromTransformer.shard);
    }
  });
});

/** @jest-environment node */
/**
 * C (plan 2026-10-25 sister wikis, Task 13 browser check): under the production base path a sister page's images are
 * already proxied with the base path (`sanitizeSisterHtml`). Its lead image, the hero, keeps that one URL; it is not
 * wrapped again as an IxWiki path (`/projects/ixstates/api/mediawiki/ixwiki/projects/ixstates/api/...`, a 404).
 */
import { extractLeadImage, normalizeWikiImageUrl } from "~/lib/wiki-os/transformers/image-url";

const BASE = "/projects/ixstates";
const SISTER_FLAG = `${BASE}/api/mediawiki/althistory/wiki/Special:FilePath/Flag_of_Poland.svg`;

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
});

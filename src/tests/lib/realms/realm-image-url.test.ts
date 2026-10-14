/** @jest-environment node */
/** Realm banners and thumbnails: an https:// address, an upload, or an image picked from the repository. */
import { isRealmImageUrl } from "~/lib/realms/realm-region";
import { UPLOADS_URL_PREFIX } from "~/server/shared/upload-storage";

describe("isRealmImageUrl", () => {
  it("accepts nothing, https addresses and images from the upload route", () => {
    expect(isRealmImageUrl("")).toBe(true);
    expect(isRealmImageUrl("  ")).toBe(true);
    expect(isRealmImageUrl("https://img.example/banner.png")).toBe(true);
    expect(isRealmImageUrl(`${UPLOADS_URL_PREFIX}uploaded_1759600000000_ab12cd34_banner.png`)).toBe(
      true
    );
  });

  it("accepts the repository picker's site-served images, stored without the base path", () => {
    expect(isRealmImageUrl(`/images/downloaded/downloaded_${"a1".repeat(16)}.png`)).toBe(true);
    expect(isRealmImageUrl("/api/mediawiki/ixwiki/images/a/ab/Flag_of_Aurelia.png")).toBe(true);
    expect(isRealmImageUrl("/api/mediawiki/commons/Special:Filepath/Coat_of_arms_(1900).svg")).toBe(
      true
    );
  });

  it("refuses other schemes, other local paths and traversal", () => {
    for (const bad of [
      "http://img.example/banner.png",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "//img.example/banner.png",
      "/images/uploads/banner.png",
      "/images/flags/aurelia.png",
      "/images/uploads/uploaded_../../secret",
      "/images/uploads/uploaded_a b.png",
      "/images/downloaded/banner.png",
      "/api/upload/image",
      "/api/mediawiki/ixwiki/../../admin",
      "/api/mediawiki/ixwiki/a.png?x=1",
      "/projects/ixstats/images/uploads/uploaded_1_ab12cd34_banner.png",
    ]) {
      expect(isRealmImageUrl(bad)).toBe(false);
    }
  });
});

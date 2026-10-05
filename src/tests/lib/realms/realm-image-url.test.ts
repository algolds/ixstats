/** @jest-environment node */
/** Realm banners and thumbnails: an https:// address, or an image uploaded through /api/upload/image. */
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
    ]) {
      expect(isRealmImageUrl(bad)).toBe(false);
    }
  });
});

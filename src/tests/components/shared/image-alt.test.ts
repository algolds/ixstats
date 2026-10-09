import { altFromImageUrl } from "~/components/shared/editor/imageAlt";

describe("altFromImageUrl", () => {
  it("decodes the file name, drops the extension and turns underscores into spaces", () => {
    expect(altFromImageUrl("https://x/wiki/Map_of_Ix%C3%A9.png")).toBe("Map of Ixé");
  });

  it("strips a thumbnail prefix and the raster suffix of an svg thumbnail", () => {
    expect(altFromImageUrl("https://x/thumb/a/ab/Flag_of_Ix.svg/960px-Flag_of_Ix.svg.png")).toBe(
      "Flag of Ix"
    );
  });

  it("ignores query strings and fragments", () => {
    expect(altFromImageUrl("/images/uploads/photo_one.jpg?w=300#top")).toBe("photo one");
  });

  it("survives malformed escapes and urls without a file name", () => {
    expect(altFromImageUrl("/a/100%.png")).toBe("100%");
    expect(altFromImageUrl("")).toBe("");
  });
});

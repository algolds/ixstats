import { imageWikitext } from "~/components/wiki-os/editor/ImageInsertForm";

describe("imageWikitext", () => {
  it("defaults to a right-aligned thumbnail", () => {
    expect(imageWikitext("File:Flag.svg")).toBe("[[File:Flag.svg|thumb|right]]");
  });

  it("writes the chosen size and alignment", () => {
    expect(imageWikitext("File:Flag.svg", "frame", "left")).toBe("[[File:Flag.svg|frame|left]]");
  });

  it("leaves the size out for full size", () => {
    expect(imageWikitext("File:Flag.svg", "", "center")).toBe("[[File:Flag.svg|center]]");
  });

  it("leaves the alignment out for none", () => {
    expect(imageWikitext("File:Flag.svg", "thumb", "none")).toBe("[[File:Flag.svg|thumb]]");
  });

  it("trims the caption and drops one that is only whitespace", () => {
    expect(imageWikitext("File:Flag.svg", "thumb", "right", "  The flag ")).toBe(
      "[[File:Flag.svg|thumb|right|The flag]]"
    );
    expect(imageWikitext("File:Flag.svg", "thumb", "right", "   ")).toBe(
      "[[File:Flag.svg|thumb|right]]"
    );
  });

  it("adds the File: prefix when the title has none", () => {
    expect(imageWikitext("Flag.svg")).toBe("[[File:Flag.svg|thumb|right]]");
  });
});

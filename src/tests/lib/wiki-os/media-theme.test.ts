import { describe, it, expect } from "@jest/globals";
import {
  detectMediaType,
  getImageIdentifier,
  getStoredMediaThemeMode,
  mediaThemeAttributes,
  normalizeMediaMode,
  setStoredMediaThemeMode,
} from "~/lib/wiki-os/transformers/media-theme";
import { resolveHighResWikiImage } from "~/lib/wiki-os/transformers/resolve-highres-image";

describe("WikiOS Media Theme System", () => {
  describe("detectMediaType", () => {
    it("detects SVG images from file extensions and URLs", () => {
      expect(detectMediaType("https://ixwiki.com/images/a/ab/National_Emblem.svg")).toBe("svg");
      expect(detectMediaType("/images/thumb/1/12/Flag.svg/300px-Flag.svg.png")).toBe("svg");
      expect(detectMediaType("/api/mediawiki/ixwiki/wiki/Special:FilePath/Coat_of_arms.svg")).toBe(
        "svg"
      );
    });

    it("detects math formulas from LaTeX/MathML markers", () => {
      expect(detectMediaType("https://ixwiki.com/images/math/a/b/c/abc123.png")).toBe("math");
      expect(detectMediaType("/load.php?modules=ext.math")).toBe("math");
    });

    it("detects diagrams and schematics", () => {
      expect(detectMediaType("/images/Trade_Flow_Diagram.png")).toBe("diagram");
      expect(detectMediaType("/images/Government_Structure_Chart.png")).toBe("diagram");
      expect(detectMediaType("/images/Acoustic_Schematic.png")).toBe("diagram");
    });

    it("detects raster photographs", () => {
      expect(detectMediaType("/images/President_Portrait.jpg")).toBe("photo");
      expect(detectMediaType("/images/Mountain_Landscape.jpeg")).toBe("photo");
      expect(detectMediaType("/images/Historical_Photo_1920.webp")).toBe("photo");
    });

    it("handles unknown or empty inputs gracefully", () => {
      expect(detectMediaType("")).toBe("unknown");
      expect(detectMediaType("/images/sample_asset.bin")).toBe("unknown");
    });
  });

  describe("normalizeMediaMode", () => {
    it("normalizes modes to canonical 2 modes (auto, plinth)", () => {
      expect(normalizeMediaMode("adaptive")).toBe("auto");
      expect(normalizeMediaMode("plate")).toBe("plinth");
      expect(normalizeMediaMode("plinth")).toBe("plinth");
      expect(normalizeMediaMode("auto")).toBe("auto");
      expect(normalizeMediaMode(null)).toBe("auto");
    });
  });

  describe("mediaThemeAttributes", () => {
    it("names the picture's kind and nothing about the theme or the reader's mode", () => {
      expect(mediaThemeAttributes("svg")).toEqual({ "data-media-kind": "svg" });
      expect(mediaThemeAttributes("photo")).toEqual({ "data-media-kind": "photo" });
    });

    it("carries a picture's own mode when it has one, so it can win over the reader's", () => {
      expect(mediaThemeAttributes("diagram", "plinth")).toEqual({
        "data-media-kind": "diagram",
        "data-media-mode": "plinth",
      });
      expect(mediaThemeAttributes("math", "auto")).toEqual({
        "data-media-kind": "math",
        "data-media-mode": "auto",
      });
    });
  });

  describe("the reader's stored mode", () => {
    afterEach(() => {
      jest.restoreAllMocks();
      setStoredMediaThemeMode("auto");
      localStorage.clear();
    });

    it("is kept in storage and mirrored on <html>, where the stylesheet reads it", () => {
      setStoredMediaThemeMode("plate");
      expect(localStorage.getItem("wikios-media-theme-mode")).toBe("plinth");
      expect(document.documentElement.getAttribute("data-media-theme")).toBe("plinth");
      expect(getStoredMediaThemeMode()).toBe("plinth");
    });

    it("lasts the session when the browser blocks storage", () => {
      jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      setStoredMediaThemeMode("plinth");
      expect(getStoredMediaThemeMode()).toBe("plinth");
      expect(document.documentElement.getAttribute("data-media-theme")).toBe("plinth");
    });
  });

  describe("getImageIdentifier", () => {
    it("extracts clean filename from URL", () => {
      expect(getImageIdentifier("https://ixwiki.com/images/Flag_of_Valoria.svg")).toBe(
        "Flag_of_Valoria.svg"
      );
      expect(
        getImageIdentifier("/thumb/a/ab/Seal_of_Ix.svg/300px-Seal_of_Ix.svg.png?ts=2026")
      ).toBe("300px-Seal_of_Ix.svg.png");
    });
  });
});

describe("resolveHighResWikiImage", () => {
  it("de-thumbnails standard MediaWiki raster images", () => {
    const mockImg = {
      getAttribute: (attr: string) => {
        if (attr === "src")
          return "https://ixwiki.com/images/thumb/8/8a/Steve_Jobs.jpg/300px-Steve_Jobs.jpg";
        if (attr === "alt") return "Steve Jobs portrait";
        return null;
      },
      src: "https://ixwiki.com/images/thumb/8/8a/Steve_Jobs.jpg/300px-Steve_Jobs.jpg",
    } as unknown as HTMLImageElement;

    const result = resolveHighResWikiImage(mockImg);
    expect(result.highResSrc).toBe("https://ixwiki.com/images/8/8a/Steve_Jobs.jpg");
    expect(result.filename).toBe("Steve Jobs.jpg");
    expect(result.thumbSrc).toBe(
      "https://ixwiki.com/images/thumb/8/8a/Steve_Jobs.jpg/300px-Steve_Jobs.jpg"
    );
    expect(result.isSvg).toBe(false);
  });

  it("recovers original vector SVG from rasterized .svg.png thumbnail", () => {
    const mockImg = {
      getAttribute: (attr: string) => {
        if (attr === "src")
          return "https://ixwiki.com/images/thumb/4/41/Apple_Logo.svg/200px-Apple_Logo.svg.png";
        if (attr === "alt") return "Apple Logo";
        return null;
      },
      src: "https://ixwiki.com/images/thumb/4/41/Apple_Logo.svg/200px-Apple_Logo.svg.png",
    } as unknown as HTMLImageElement;

    const result = resolveHighResWikiImage(mockImg);
    expect(result.highResSrc).toBe("https://ixwiki.com/images/4/41/Apple_Logo.svg");
    expect(result.filename).toBe("Apple Logo.svg");
    expect(result.isSvg).toBe(true);
  });

  it("de-thumbnails direct Wikimedia Commons uploads and recovers vector SVGs", () => {
    const mockImg = {
      getAttribute: (attr: string) => {
        if (attr === "src") {
          return "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/World_Map_1689.svg/500px-World_Map_1689.svg.png";
        }
        return null;
      },
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/World_Map_1689.svg/500px-World_Map_1689.svg.png",
    } as unknown as HTMLImageElement;

    const result = resolveHighResWikiImage(mockImg);
    expect(result.highResSrc).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/d/d4/World_Map_1689.svg"
    );
    expect(result.filename).toBe("World Map 1689.svg");
    expect(result.isSvg).toBe(true);
  });
});

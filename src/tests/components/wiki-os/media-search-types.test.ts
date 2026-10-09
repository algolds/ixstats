/**
 * Image repository helpers: wiki files are identified by url (never by position), use their reduced-size preview
 * when the server has one, invent no author or licence, and an image of unknown size matches no orientation.
 */
import {
  commonsMimeTerm,
  dedupeImages,
  matchesImageFilters,
  wikiFilesToImages,
  type CommonsImage,
} from "~/components/wiki-os/media-search/types";

const wikiFile = (name: string, over: Record<string, unknown> = {}) => ({
  name,
  size: 2048,
  width: 800,
  height: 600,
  mime: "image/png",
  url: `https://iiwiki.com/images/a/ab/${name}`,
  ...over,
});

const image = (url: string, over: Partial<CommonsImage> = {}): CommonsImage => ({
  pageid: 0,
  title: "File:X.png",
  thumbUrl: url,
  url,
  descriptionUrl: "",
  width: 800,
  height: 600,
  mime: "image/png",
  description: "",
  artist: "",
  license: "",
  ...over,
});

describe("wikiFilesToImages", () => {
  it("uses the server's thumbnail when there is one, and the file itself otherwise", () => {
    const [withThumb, without] = wikiFilesToImages(
      [
        wikiFile("Map.png", {
          thumbUrl: "https://iiwiki.com/images/thumb/a/ab/Map.png/300px-Map.png",
        }),
        wikiFile("Flag.png", { thumbUrl: null }),
      ],
      "iiwiki"
    );
    expect(withThumb!.thumbUrl).toContain(
      "/api/mediawiki/iiwiki/images/thumb/a/ab/Map.png/300px-Map.png"
    );
    expect(withThumb!.url).toContain("/api/mediawiki/iiwiki/images/a/ab/Map.png");
    expect(without!.thumbUrl).toBe(without!.url);
  });

  it("falls back to the file when the record has no thumbUrl field at all", () => {
    const [only] = wikiFilesToImages([wikiFile("Map.png")], "iiwiki");
    expect(only!.thumbUrl).toBe(only!.url);
  });

  it("copies the blurhash, and gives null when the record has none", () => {
    const [withHash, without] = wikiFilesToImages(
      [wikiFile("Map.png", { blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj" }), wikiFile("Flag.png")],
      "ixwiki"
    );
    expect(withHash!.blurhash).toBe("LEHV6nWB2yk8pyo0adR*.7kCMdnj");
    expect(without!.blurhash).toBeNull();
  });

  it("uses the file's own url as the description page for forum and own uploads", () => {
    const record = wikiFile("Pic.png", { url: "https://cdn.example/forum/pic.png" });
    const [forum] = wikiFilesToImages([record], "forum");
    const [mine] = wikiFilesToImages([record], "mine");
    expect(forum!.descriptionUrl).toBe("https://cdn.example/forum/pic.png");
    expect(forum!.descriptionUrl).toBe(forum!.url);
    expect(mine!.descriptionUrl).toBe(mine!.url);
    expect(forum!.description).toContain("forum");
  });

  it("invents no author or licence", () => {
    const [only] = wikiFilesToImages([wikiFile("Map.png")], "ixwiki");
    expect(only!.artist).toBe("");
    expect(only!.license).toBe("");
  });
});

describe("dedupeImages", () => {
  it("identifies images by url, ignoring the page id", () => {
    const a = image("https://x/a.png", { pageid: 1 });
    const aAgain = image("https://x/a.png", { pageid: 9 });
    const b = image("https://x/b.png", { pageid: 1 });
    expect(dedupeImages([a], [aAgain, b])).toEqual([a, b]);
  });

  it("drops repeats inside the incoming batch", () => {
    const a = image("https://x/a.png");
    expect(dedupeImages([], [a, a])).toEqual([a]);
  });
});

describe("matchesImageFilters", () => {
  it("excludes an image of unknown size from a specific orientation, but not from All", () => {
    const vector = image("https://x/v.svg", { width: 0, height: 0, mime: "image/svg+xml" });
    expect(matchesImageFilters(vector, "all", "landscape")).toBe(false);
    expect(matchesImageFilters(vector, "all", "all")).toBe(true);
  });

  it("sorts known sizes into landscape, portrait and square", () => {
    expect(matchesImageFilters(image("a", { width: 1200, height: 800 }), "all", "landscape")).toBe(
      true
    );
    expect(matchesImageFilters(image("b", { width: 800, height: 1200 }), "all", "portrait")).toBe(
      true
    );
    expect(matchesImageFilters(image("c", { width: 1000, height: 1000 }), "all", "square")).toBe(
      true
    );
    expect(matchesImageFilters(image("d", { width: 1000, height: 1000 }), "all", "landscape")).toBe(
      false
    );
  });
});

describe("commonsMimeTerm", () => {
  it("maps each file type to a Commons mime term, and All to nothing", () => {
    expect(commonsMimeTerm("all")).toBe("");
    expect(commonsMimeTerm("jpg")).toBe("filemime:image/jpeg");
    expect(commonsMimeTerm("png")).toBe("filemime:image/png");
    expect(commonsMimeTerm("svg")).toBe("filemime:image/svg+xml");
  });
});

/**
 * Plan 413 (item 6): the page's first picture loads eagerly and every other lazily; the lead image
 * comes with its file's size; the hero asks for a thumbnail of a large photo, never the full file.
 */
import { transformArticleHtml, transformImages } from "~/lib/wiki-os/transformers/html-transformer";
import {
  HERO_IMAGE_WIDTH,
  extractLeadImage,
  extractLeadImageFromHtml,
  heroImage,
} from "~/lib/wiki-os/transformers/image-url";
import { imageDimensionAttributes } from "~/lib/wiki-os/transformers/wikitext-parser";

const img = (name: string, attrs = "") =>
  `<img src="https://ixwiki.com/images/a/ab/${name}" ${attrs}>`;

describe("transformImages: the first picture is eager", () => {
  it("keeps the first image eager when asked, and the rest lazy", () => {
    const out = transformImages(
      `${img("A.png")}<p>text</p>${img("B.png")}${img("C.png")}`,
      "ixwiki",
      {
        eagerFirst: true,
      }
    );

    const tags = out.match(/<img[^>]*>/g)!;
    expect(tags[0]).toContain('loading="eager"');
    expect(tags[1]).toContain('loading="lazy"');
    expect(tags[2]).toContain('loading="lazy"');
  });

  it("skips tiny icons when choosing the first picture, and respects a loading attribute already there", () => {
    const out = transformImages(
      `${img("Icon.png", 'width="16" height="16"')}${img("Photo.png", 'width="300"')}${img("Own.png", 'loading="lazy"')}`,
      "ixwiki",
      { eagerFirst: true }
    );

    const tags = out.match(/<img[^>]*>/g)!;
    expect(tags[0]).toContain('loading="lazy"'); // the icon
    expect(tags[1]).toContain('loading="eager"'); // the photo
    expect(tags[2]).toContain('loading="lazy"'); // its own, untouched
  });

  it("is lazy everywhere by default (template previews, other callers)", () => {
    const out = transformImages(`${img("A.png")}${img("B.png")}`, "ixwiki");
    expect(out.match(/loading="eager"/g)).toBeNull();
    expect(out.match(/loading="lazy"/g)).toHaveLength(2);
  });

  it("an article's infobox picture is the eager one; the body's first is eager only without an infobox", () => {
    const withInfobox = transformArticleHtml(
      `<table class="infobox"><tr><td>${img("Info.png", 'width="300"')}</td></tr></table><p>Lead</p>${img("Body.png", 'width="300"')}`,
      "/wiki"
    );
    expect(withInfobox.infoboxHtml).toContain('loading="eager"');
    expect(withInfobox.contentHtml).toContain('loading="lazy"');
    expect(withInfobox.contentHtml).not.toContain('loading="eager"');

    const withoutInfobox = transformArticleHtml(
      `<p>Lead</p>${img("Body.png", 'width="300"')}`,
      "/wiki"
    );
    expect(withoutInfobox.contentHtml).toContain('loading="eager"');
  });
});

describe("extractLeadImage", () => {
  const html =
    '<table class="infobox"><tr><td><img src="https://ixwiki.com/images/thumb/a/ab/Flag.png/330px-Flag.png" ' +
    'width="330" height="220" data-file-width="3000" data-file-height="2000"></td></tr></table>';

  it("returns the lead image with its file's size, and the same URL as before", () => {
    const lead = extractLeadImage(html);

    expect(lead).toEqual({
      url: extractLeadImageFromHtml(html),
      fileWidth: 3000,
      fileHeight: 2000,
    });
    expect(lead!.url).toContain("/api/mediawiki/ixwiki/images/thumb/a/ab/Flag.png/330px-Flag.png");
  });

  it("has no size when the HTML does not say, and is null without an image", () => {
    expect(
      extractLeadImage(
        '<table class="infobox"><tr><td><img src="https://ixwiki.com/images/a/ab/X.png"></td></tr></table>'
      )
    ).toMatchObject({
      fileWidth: null,
      fileHeight: null,
    });
    expect(extractLeadImage("<p>none</p>")).toBeNull();
    expect(extractLeadImage(null)).toBeNull();
  });
});

describe("heroImage", () => {
  const thumb = "/api/mediawiki/ixwiki/images/thumb/a/ab/Flag.png/330px-Flag.png";
  const original = "/api/mediawiki/ixwiki/images/a/ab/Flag.png";

  it("asks for a 1280 px thumbnail of a photo wider than that, with its size", () => {
    expect(heroImage(thumb, 3000, 2000)).toEqual({
      src: "/api/mediawiki/ixwiki/images/thumb/a/ab/Flag.png/1280px-Flag.png",
      original,
      width: HERO_IMAGE_WIDTH,
      height: 853,
    });
    // the same from the file's own URL
    expect(heroImage(original, 3000, 2000).src).toBe(
      "/api/mediawiki/ixwiki/images/thumb/a/ab/Flag.png/1280px-Flag.png"
    );
  });

  it("serves the file itself when it is no wider than the hero, is a vector, or its size is unknown", () => {
    expect(heroImage(thumb, 1200, 800)).toEqual({
      src: original,
      original,
      width: 1200,
      height: 800,
    });
    const svg = "/api/mediawiki/ixwiki/images/thumb/a/ab/Seal.svg/330px-Seal.svg.png";
    expect(heroImage(svg, 5000, 5000).src).toBe("/api/mediawiki/ixwiki/images/a/ab/Seal.svg");
    expect(heroImage(thumb, null, null)).toEqual({
      src: original,
      original,
      width: null,
      height: null,
    });
  });

  it("leaves an address that is not a hashed /images/ path alone", () => {
    const other = "https://example.com/pictures/flag.png";
    expect(heroImage(other, 4000, 3000).src).toBe(other);
  });
});

describe("imageDimensionAttributes (the fallback compiler)", () => {
  it("emits the size the wikitext gave", () => {
    expect(imageDimensionAttributes(["thumb", "300px", "A caption"])).toBe(' width="300"');
    expect(imageDimensionAttributes(["300x200px"])).toBe(' width="300" height="200"');
    expect(imageDimensionAttributes(["thumb", "right"])).toBe("");
  });
});

/** Factbook covers: only each block's own candidate articles, the owner's pin first. */
import {
  buildProfileMedia,
  type CoverCandidates,
} from "~/app/countries/[slug]/_utils/profileLayer";

const article = (title: string, imageUrl: string | null, summary: string | null = null) => ({
  title,
  slug: title.replace(/ /g, "_"),
  summary,
  imageUrl,
  readingTime: 5,
});
const covers = (partial: Partial<CoverCandidates>): CoverCandidates => ({
  economy: [],
  state: [],
  foreign: [],
  ...partial,
});
const recordArticle = (title: string, imageUrl: string) => ({
  id: title,
  ...article(title, imageUrl),
});

describe("buildProfileMedia covers", () => {
  it("never puts a sports page on Foreign affairs, whatever the public record holds", () => {
    const media = buildProfileMedia(
      { articles: [recordArticle("Caphirian Football League", "/images/a/ab/League.jpg")] },
      "Caphiria",
      covers({})
    );
    expect(media.sectionCovers.foreign).toBeNull();
  });

  it("captions and links the block's top article even when a later one supplies the image", () => {
    const media = buildProfileMedia(
      null,
      "Caphiria",
      covers({
        economy: [
          article("Economy of Caphiria", null, "The imperial economy."),
          article("Central Bank of Caphiria", "/images/a/ab/Bank.jpg"),
        ],
      })
    );
    expect(media.sectionCovers.economy).toEqual({
      url: "/images/a/ab/Bank.jpg",
      caption: "Economy of Caphiria",
      href: "/wiki/Economy_of_Caphiria",
      summary: "The imperial economy.",
      readingTime: 5,
    });
  });

  it("prefers a raster image over an SVG and never uses one image twice", () => {
    const shared = "/images/a/ab/Palace.jpg";
    const media = buildProfileMedia(
      null,
      "Caphiria",
      covers({
        economy: [article("Economy of Caphiria", shared)],
        state: [
          article("Government of Caphiria", "/images/a/ab/Seal.svg"),
          article("Corcillum", shared),
        ],
      })
    );
    expect(media.sectionCovers.economy?.url).toBe(shared);
    expect(media.sectionCovers.state?.url).toBe("/images/a/ab/Seal.svg");
  });

  it("puts the owner's pinned image first", () => {
    const media = buildProfileMedia(
      { cardImages: { diplomacy: "/images/uploads/pinned.jpg" } },
      "Caphiria",
      covers({ foreign: [article("Foreign relations of Caphiria", "/images/a/ab/Treaty.jpg")] })
    );
    expect(media.sectionCovers.foreign?.url).toBe("/images/uploads/pinned.jpg");
    expect(media.sectionCovers.foreign?.caption).toBe("Foreign relations of Caphiria");
  });

  it("keeps an imageless block's link (no url) and leaves blocks without candidates null", () => {
    const media = buildProfileMedia(
      null,
      "Caphiria",
      covers({ state: [article("Government of Caphiria", null)] })
    );
    expect(media.sectionCovers.state).toMatchObject({
      url: null,
      caption: "Government of Caphiria",
    });
    expect(media.sectionCovers.economy).toBeNull();
  });
});

/** Plan 403: the article page's canonical <link> uses the title's canonical URL path. */
import { generateMetadata } from "~/app/(wiki-os)/wiki/[slug]/page";

jest.mock("~/app/(wiki-os)/wiki/[slug]/ArticlePageClient", () => ({
  __esModule: true,
  default: () => null,
}));

const canonicalFor = async (slug: string): Promise<string | undefined> => {
  const metadata = await generateMetadata({ params: Promise.resolve({ slug }) });
  return metadata.alternates?.canonical as string | undefined;
};

describe("article page generateMetadata", () => {
  it("points the canonical link at the canonical spelling of the title", async () => {
    await expect(canonicalFor("foo_bar")).resolves.toBe("https://ixwiki.com/wiki/Foo_bar");
    await expect(canonicalFor("nato")).resolves.toBe("https://ixwiki.com/wiki/Nato");
    await expect(canonicalFor("NATO")).resolves.toBe("https://ixwiki.com/wiki/NATO");
  });

  it("decodes the segment once and keeps ':' and '/' literal", async () => {
    await expect(canonicalFor("Portal%3AEurth")).resolves.toBe(
      "https://ixwiki.com/wiki/Portal:Eurth"
    );
    await expect(canonicalFor("100%25_Pure")).resolves.toBe("https://ixwiki.com/wiki/100%25_Pure");
    await expect(canonicalFor("Foo%2Fbar")).resolves.toBe("https://ixwiki.com/wiki/Foo/bar");
  });

  it("drops a fragment typed into the path", async () => {
    await expect(canonicalFor("Foo%23Bar")).resolves.toBe("https://ixwiki.com/wiki/Foo");
  });

  it("falls back to the typed title when MediaWiki would refuse it", async () => {
    await expect(canonicalFor("a%5Bb")).resolves.toBe("https://ixwiki.com/wiki/a%5Bb");
    await expect(canonicalFor("%E0%A4%A")).resolves.toBe("https://ixwiki.com/wiki/%25E0%25A4%25A");
  });

  it("gives tool routes, special, category and user pages no canonical link", async () => {
    for (const slug of [
      "recent_changes",
      "Special%3ARandom",
      "category:foo",
      "user%3Ajane",
      "User_talk:jane",
    ]) {
      await expect(generateMetadata({ params: Promise.resolve({ slug }) })).resolves.toEqual({});
    }
  });
});

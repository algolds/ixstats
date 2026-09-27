import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";

const mockFindMany = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    wikiArticle: {
      findMany: (args: { where: object }) => mockFindMany(args),
    },
  },
}));

beforeEach(() => mockFindMany.mockReset());

test("returns only titles with no article, matching slug or title case-insensitively", async () => {
  mockFindMany.mockResolvedValue([
    { slug: "treaty_of_oakhaven", title: "Treaty of Oakhaven" },
    { slug: "", title: "Caphiria" },
  ]);

  const missing = await ArticleRepository.findMissingTitles([
    "Treaty of oakhaven",
    "Caphiria",
    "Nowhere Land",
  ]);

  expect(missing).toEqual(["Nowhere Land"]);
  expect(mockFindMany).toHaveBeenCalledTimes(1);
});

test("skips the query when there is nothing to check", async () => {
  await expect(ArticleRepository.findMissingTitles([])).resolves.toEqual([]);
  expect(mockFindMany).not.toHaveBeenCalled();
});

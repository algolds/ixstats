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

test("returns only titles with no article, comparing canonical titles exactly", async () => {
  mockFindMany.mockResolvedValue([{ title: "Treaty of Oakhaven" }, { title: "Caphiria" }]);

  const missing = await ArticleRepository.findMissingTitles([
    "Treaty_of_Oakhaven",
    "caphiria",
    "Treaty of oakhaven",
    "Nowhere Land",
  ]);

  // "Treaty of oakhaven" is a different MediaWiki page from "Treaty of Oakhaven".
  expect(missing).toEqual(["Treaty of oakhaven", "Nowhere Land"]);
  expect(mockFindMany).toHaveBeenCalledTimes(1);
  expect(mockFindMany).toHaveBeenCalledWith({
    where: {
      source: "ixwiki",
      title: { in: ["Treaty of Oakhaven", "Caphiria", "Treaty of oakhaven", "Nowhere Land"] },
    },
    select: { title: true },
  });
});

test("reports a title MediaWiki would refuse as missing without querying for it", async () => {
  mockFindMany.mockResolvedValue([]);

  await expect(ArticleRepository.findMissingTitles(["a[b", "Talk:"])).resolves.toEqual([
    "a[b",
    "Talk:",
  ]);
  expect(mockFindMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { source: "ixwiki", title: { in: [] } } })
  );
});

test("skips the query when there is nothing to check", async () => {
  await expect(ArticleRepository.findMissingTitles([])).resolves.toEqual([]);
  expect(mockFindMany).not.toHaveBeenCalled();
});

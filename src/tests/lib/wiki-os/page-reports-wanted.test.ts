const mockGroupBy = jest.fn();
const mockFindMany = jest.fn();
const mockLinkTitles = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    wikiLink: {
      groupBy: (...a: unknown[]) => mockGroupBy(...a),
      findMany: (...a: unknown[]) => mockLinkTitles(...a),
    },
    wikiArticle: { findMany: (...a: unknown[]) => mockFindMany(...a) },
  },
}));

import { PageReports } from "~/lib/wiki-os/core/page-reports";

const group = (targetSlug: string, count: number) => ({
  targetSlug,
  _count: { targetSlug: count },
});

describe("PageReports.getWantedPages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockLinkTitles.mockResolvedValue([]);
  });

  it("groups the red links of the realm's published articles, most linked first", async () => {
    mockGroupBy.mockResolvedValue([group("Missing_page", 5), group("Other_gap", 2)]);

    const result = await PageReports.getWantedPages(10, "ixwiki");

    expect(mockGroupBy).toHaveBeenCalledWith({
      by: ["targetSlug"],
      where: {
        targetArticleId: null,
        isExternal: false,
        sourceArticle: { source: "ixwiki", status: "PUBLISHED" },
      },
      _count: { targetSlug: true },
      orderBy: [{ _count: { targetSlug: "desc" } }, { targetSlug: "asc" }],
      take: 20,
    });
    expect(result).toEqual([
      { targetSlug: "Missing_page", title: "Missing page", linkCount: 5 },
      { targetSlug: "Other_gap", title: "Other gap", linkCount: 2 },
    ]);
  });

  it("shows the title the links name, and a slug stored without one as a title", async () => {
    mockGroupBy.mockResolvedValue([group("treaty_of_oakhaven", 3), group("old_gap", 1)]);
    mockLinkTitles.mockResolvedValue([
      { targetSlug: "treaty_of_oakhaven", targetTitle: "Treaty of Oakhaven" },
    ]);

    const result = await PageReports.getWantedPages(10, "ixwiki");

    expect(mockLinkTitles).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          targetSlug: { in: ["treaty_of_oakhaven", "old_gap"] },
          targetTitle: { not: null },
          targetArticleId: null,
        }),
      })
    );
    expect(result).toEqual([
      { targetSlug: "treaty_of_oakhaven", title: "Treaty of Oakhaven", linkCount: 3 },
      { targetSlug: "old_gap", title: "Old gap", linkCount: 1 },
    ]);
  });

  it("drops a slug that has an article in the realm", async () => {
    mockGroupBy.mockResolvedValue([group("now_exists", 9), group("still_missing", 1)]);
    mockFindMany.mockResolvedValue([{ slug: "now_exists" }]);

    const result = await PageReports.getWantedPages(10, "ixwiki");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source: "ixwiki", slug: { in: ["now_exists", "still_missing"] } },
      })
    );
    expect(result.map((r) => r.targetSlug)).not.toContain("now_exists");
    expect(result.map((r) => r.targetSlug)).toEqual(["still_missing"]);
  });

  it("cuts the result to the limit after dropping existing slugs", async () => {
    mockGroupBy.mockResolvedValue([group("a", 4), group("b", 3), group("c", 2)]);
    mockFindMany.mockResolvedValue([{ slug: "a" }]);

    const result = await PageReports.getWantedPages(1, "ixwiki");

    expect(result.map((r) => r.targetSlug)).toEqual(["b"]);
  });

  it("returns an empty list when the database fails", async () => {
    mockGroupBy.mockRejectedValue(new Error("down"));

    await expect(PageReports.getWantedPages(10, "ixwiki")).resolves.toEqual([]);
  });
});

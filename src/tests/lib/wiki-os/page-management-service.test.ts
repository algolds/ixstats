/** @jest-environment node */
/**
 * Plan 403: a page move writes the canonical form of the new title. Plan 402: redirectTargetSlug
 * holds a canonical TITLE, so the move writes one and the broken-redirect report compares titles.
 */
import { PageManagementService } from "~/lib/wiki-os/core/page-management-service";

const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();
const mockLinkUpdateMany = jest.fn();
const mockLogCreate = jest.fn();

jest.mock("~/server/db", () => {
  const tx = {
    wikiArticle: {
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
      create: (...a: unknown[]) => mockCreate(...a),
    },
    wikiLink: { updateMany: (...a: unknown[]) => mockLinkUpdateMany(...a) },
    wikiLog: { create: (...a: unknown[]) => mockLogCreate(...a) },
  };
  return {
    db: {
      $transaction: (cb: (t: typeof tx) => unknown) => cb(tx),
      wikiArticle: { findMany: (...a: unknown[]) => mockFindMany(...a) },
    },
  };
});

const original = { id: "orig", title: "Old name", namespace: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  mockFindFirst.mockResolvedValueOnce(original).mockResolvedValueOnce(null);
  mockUpdate.mockResolvedValue({ id: "orig" });
  mockCreate.mockResolvedValue({ id: "redirect" });
  mockLinkUpdateMany.mockResolvedValue({ count: 2 });
  mockLogCreate.mockResolvedValue({});
});

describe("PageManagementService.movePage", () => {
  it("moves to the canonical title, slug and namespace, whatever spelling was typed", async () => {
    const result = await PageManagementService.movePage("old_name", "talk:new_name", "tidy", "u1");

    expect(result).toMatchObject({ success: true, newSlug: "talk:new_name", linksUpdated: 2 });
    expect(mockUpdate.mock.calls[0]?.[0].data).toMatchObject({
      title: "Talk:New name",
      slug: "talk:new_name",
      namespace: 1,
      namespacePrefix: "Talk",
    });
    expect(mockFindFirst.mock.calls[1]?.[0].where.OR).toEqual([
      { slug: "talk:new_name" },
      { title: "Talk:New name" },
    ]);
    expect(mockCreate.mock.calls[0]?.[0].data).toMatchObject({
      wikitext: "#REDIRECT [[Talk:New name]]",
      redirectTargetSlug: "Talk:New name",
    });
    expect(mockLogCreate.mock.calls[0]?.[0].data).toMatchObject({ title: "Talk:New name" });
  });

  it("refuses a destination MediaWiki would refuse, before touching the database", async () => {
    await expect(PageManagementService.movePage("Old name", "a[b", "x", "u1")).rejects.toThrow(
      "Invalid title"
    );
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("still refuses a move onto the same page", async () => {
    await expect(PageManagementService.movePage("Old name", "old_name", "x", "u1")).rejects.toThrow(
      "identical"
    );
  });
});

describe("PageManagementService.getBrokenRedirects", () => {
  const redirectRow = (id: string, title: string, redirectTargetSlug: string) => ({
    id,
    title,
    slug: title.toLowerCase().replace(/ /g, "_"),
    redirectTargetSlug,
  });

  it("compares the stored target title with published article titles, not slugs", async () => {
    mockFindMany
      .mockResolvedValueOnce([
        redirectRow("r1", "Old name", "Foo bar"),
        redirectRow("r2", "Gone", "Missing page"),
      ])
      .mockResolvedValueOnce([{ title: "Foo bar" }]);

    const broken = await PageManagementService.getBrokenRedirects(10);

    expect(broken).toEqual([
      { id: "r2", title: "Gone", slug: "gone", targetSlug: "Missing page" },
    ]);
    expect(mockFindMany.mock.calls[1]?.[0]).toEqual({
      where: {
        source: "ixwiki",
        title: { in: ["Foo bar", "Missing page"] },
        status: "PUBLISHED",
      },
      select: { title: true },
    });
  });

  it("canonicalizes a stored target before comparing", async () => {
    mockFindMany
      .mockResolvedValueOnce([redirectRow("r1", "Old name", "talk:new_name")])
      .mockResolvedValueOnce([{ title: "Talk:New name" }]);

    await expect(PageManagementService.getBrokenRedirects(10)).resolves.toEqual([]);
    expect(mockFindMany.mock.calls[1]?.[0].where.title).toEqual({ in: ["Talk:New name"] });
  });

  it("scopes both queries to the realm and honours the limit", async () => {
    mockFindMany
      .mockResolvedValueOnce([
        redirectRow("r1", "A", "X1"),
        redirectRow("r2", "B", "X2"),
        redirectRow("r3", "C", "X3"),
      ])
      .mockResolvedValueOnce([]);

    const broken = await PageManagementService.getBrokenRedirects(2, "iiwiki");

    expect(broken.map((b) => b.id)).toEqual(["r1", "r2"]);
    expect(mockFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { source: "iiwiki", redirectTargetSlug: { not: null } },
      take: 4,
    });
    expect(mockFindMany.mock.calls[1]?.[0].where.source).toBe("iiwiki");
  });

  it("reports nothing when there are no redirects", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await expect(PageManagementService.getBrokenRedirects(10)).resolves.toEqual([]);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });
});

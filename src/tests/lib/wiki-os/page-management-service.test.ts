/** @jest-environment node */
/** Plan 403: a page move writes the canonical form of the new title. */
import { PageManagementService } from "~/lib/wiki-os/core/page-management-service";

const mockFindFirst = jest.fn();
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
  return { db: { $transaction: (cb: (t: typeof tx) => unknown) => cb(tx) } };
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
      redirectTargetSlug: "talk:new_name",
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

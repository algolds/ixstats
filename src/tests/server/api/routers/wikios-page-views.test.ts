/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));
const mockPageInfo = jest.fn();
const mockListPages = jest.fn();
const mockMemberPage = jest.fn();
const mockFileInfo = jest.fn();
jest.mock("~/lib/wiki-os/core/page-info-service", () => ({
  __esModule: true,
  getPageInfo: (...a: unknown[]) => mockPageInfo(...a),
}));
jest.mock("~/lib/wiki-os/core/page-list-service", () => ({
  __esModule: true,
  listPages: (...a: unknown[]) => mockListPages(...a),
}));
jest.mock("~/lib/wiki-os/core/category-service", () => ({
  __esModule: true,
  CATEGORY_PAGE_SIZE: 200,
  CategoryService: { getMemberPage: (...a: unknown[]) => mockMemberPage(...a) },
}));
const mockAssertVisible = jest.fn();
jest.mock("~/lib/wiki-os/permissions", () => ({
  __esModule: true,
  assertTitleVisible: (...a: unknown[]) => mockAssertVisible(...a),
}));
jest.mock("~/lib/wiki-os/core/file-page-service", () => ({
  __esModule: true,
  getFileInfo: (...a: unknown[]) => mockFileInfo(...a),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosPageViewsRouter } from "~/server/api/routers/wikios/page-views";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const caller = () =>
  createCallerFactory(wikiosPageViewsRouter)(
    createMockRouterContext({ auth: null, user: null }) as never
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockAssertVisible.mockResolvedValue(undefined);
});

describe("wikios page-view queries (plan 412)", () => {
  it("getPageInfo answers for a page and is NOT_FOUND for one that does not exist", async () => {
    mockPageInfo.mockResolvedValueOnce({ title: "Foo" });
    await expect(caller().getPageInfo({ title: "Foo" })).resolves.toEqual({ title: "Foo" });

    mockPageInfo.mockResolvedValueOnce(null);
    await expect(caller().getPageInfo({ title: "Nowhere" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("getPageInfo hides a deleted page from a reader who may not see it, before reading anything (plan 409)", async () => {
    mockAssertVisible.mockRejectedValue(new TRPCError({ code: "NOT_FOUND" }));

    await expect(caller().getPageInfo({ title: "Deleted page" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockAssertVisible).toHaveBeenCalledWith(expect.anything(), "Deleted page");
    expect(mockPageInfo).not.toHaveBeenCalled();
  });

  it("listPages defaults to the main namespace, 200 pages from the start, and bounds its input", async () => {
    mockListPages.mockResolvedValue({ pages: [], next: null });
    await caller().listPages({});

    expect(mockListPages).toHaveBeenCalledWith({ namespace: 0, prefix: "", from: "", limit: 200 });
    for (const input of [{ namespace: -1 }, { namespace: 1.5 }, { limit: 501 }, { limit: 0 }]) {
      await expect(caller().listPages(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(mockListPages).toHaveBeenCalledTimes(1);
  });

  it("getCategoryPage asks for one page of 200 from `from`, strictly after `after`", async () => {
    mockMemberPage.mockResolvedValue({ members: [], total: 0, next: null });
    await caller().getCategoryPage({ category: "Countries", from: "Au" });
    expect(mockMemberPage).toHaveBeenCalledWith("Countries", { from: "Au", after: "", limit: 200 });

    await caller().getCategoryPage({ category: "Countries", from: "Au", after: "Aurelia" });
    expect(mockMemberPage).toHaveBeenLastCalledWith("Countries", {
      from: "Au",
      after: "Aurelia",
      limit: 200,
    });
  });

  it("getFileInfo answers null for an unknown file", async () => {
    mockFileInfo.mockResolvedValue(null);
    await expect(caller().getFileInfo({ file: "Nope.svg" })).resolves.toBeNull();
  });
});

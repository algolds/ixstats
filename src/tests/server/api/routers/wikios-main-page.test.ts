/** @jest-environment node */
const mockGetMainPageData = jest.fn();
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));
jest.mock("~/lib/wiki-os/services/main-page-service", () => ({
  __esModule: true,
  getMainPageData: (...a: unknown[]) => mockGetMainPageData(...a),
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { createMockRouterContext } from "~/tests/helpers/router-context";

describe("wikios.getMainPage (plan 413)", () => {
  it("is one call into the main-page service, open to anonymous readers", async () => {
    const page = {
      featured: null,
      almanac: null,
      recentChanges: [],
      stats: {},
      categories: [],
      prompt: null,
    };
    mockGetMainPageData.mockResolvedValue(page);
    const caller = createCallerFactory(wikiosPageContentRouter)(
      createMockRouterContext({ auth: null, user: null }) as never
    );

    await expect(caller.getMainPage()).resolves.toBe(page);
    expect(mockGetMainPageData).toHaveBeenCalledTimes(1);
  });
});

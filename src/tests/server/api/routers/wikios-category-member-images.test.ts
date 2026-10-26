/** @jest-environment node */
/**
 * A category's members carry their titles as the category stores them, with underscores; their lead images are looked
 * up among the published articles under the spaced title too, which is how articles store theirs.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: {
      findMany: jest.fn(async () => [
        {
          title: "Senate of Caphiria",
          slug: "senate_of_caphiria",
          leadImageUrl: "/images/senate.png",
          wikitext: "",
        },
      ]),
    },
  },
}));
jest.mock("~/lib/wiki-os/services/category-members", () => ({
  loadCategoryMembers: jest.fn(async () => ({
    members: [
      {
        pageid: 1,
        title: "Senate_of_Caphiria",
        type: "page",
        ns: 0,
        isSubcategory: false,
        imageUrl: null,
      },
    ],
    hasMore: false,
  })),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getParentCategories: jest.fn(),
  batchFetchThumbnails: jest.fn(async () => new Map()),
}));

import { describe, expect, it } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosCategoriesRouter } from "~/server/api/routers/wikios/categories";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { db } from "~/server/db";

describe("getCategoryMembers lead images", () => {
  it("looks a member's article up under its spaced title as well", async () => {
    const caller = createCallerFactory(wikiosCategoriesRouter)(
      createMockRouterContext({ auth: null, user: null }) as never
    );
    const { members } = await caller.getCategoryMembers({ category: "Caphiria lore" });

    const where = jest.mocked(db.wikiArticle.findMany).mock.calls[0]?.[0]?.where as {
      OR: unknown[];
    };
    expect(where.OR).toContainEqual({ title: { in: ["Senate of Caphiria"] } });
    expect(members[0]?.imageUrl).toBeTruthy();
  });
});

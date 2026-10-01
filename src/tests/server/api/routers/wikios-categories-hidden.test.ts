/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
// Plan 406: categories MediaWiki hides (maintenance and tracking categories) are not listed.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { wikiCategory: { findMany: jest.fn() } },
  isDatabaseReadOnly: true,
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosCategoriesRouter } from "~/server/api/routers/wikios/categories";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { db } from "~/server/db";

const findMany = jest.mocked(db.wikiCategory.findMany);

const caller = () =>
  createCallerFactory(wikiosCategoriesRouter)(
    createMockRouterContext({ auth: null, user: null }) as never
  );

const category = (name: string) =>
  ({ name, slug: name.toLowerCase(), _count: { members: 3, children: 0 } }) as never;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("category lists leave out hidden categories (plan 406)", () => {
  it("the category search", async () => {
    findMany.mockResolvedValue([category("Countries")]);

    await caller().searchCategories({ query: "Count", wiki: "ixwiki" });

    expect(findMany.mock.calls[0]?.[0]?.where).toMatchObject({ hidden: false });
  });

  it("the category search browsing from a letter", async () => {
    findMany.mockResolvedValue([category("Countries")]);

    await caller().searchCategories({ from: "C", wiki: "ixwiki" });

    expect(findMany.mock.calls[0]?.[0]?.where).toMatchObject({ hidden: false });
  });

  it("the biggest categories", async () => {
    findMany.mockResolvedValue([category("Countries")]);

    await caller().getCategories({ wiki: "ixwiki", limit: 10 });

    expect(findMany.mock.calls[0]?.[0]?.where).toEqual({ hidden: false });
  });
});

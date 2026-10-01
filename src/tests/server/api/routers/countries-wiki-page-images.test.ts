/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
//
// Plan 418 (A9): `getPageImages` looks a title up on the wiki it is asked for. A country's images are looked up
// on IxWiki's page first and then on iiwiki's, as its intro and sections already are.
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getArticleIntro: jest.fn(),
  getPageSections: jest.fn(),
  getPageImages: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { wikiProcedures } from "~/server/api/routers/countries/wiki";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { getPageImages } from "~/lib/wiki-os/adapters/mediawiki/bridge";

const caller = () =>
  createCallerFactory(createTRPCRouter(wikiProcedures))(
    createMockRouterContext({ auth: null, user: null }) as never
  );

const image = { title: "File:Map.png", url: "u", thumbUrl: "t", width: 800, height: 600 };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("countries.getWikiPageImages", () => {
  it("answers with IxWiki's images when its page has some, asking no other wiki", async () => {
    jest.mocked(getPageImages).mockResolvedValue([image]);

    expect(await caller().getWikiPageImages({ countryName: "Caphiria Images One" })).toEqual([image]);
    expect(jest.mocked(getPageImages).mock.calls.map(([, opts]) => opts?.wiki)).toEqual(["ixwiki"]);
  });

  it("falls back to iiwiki's page when IxWiki has none", async () => {
    jest.mocked(getPageImages).mockResolvedValueOnce(null).mockResolvedValueOnce([image]);

    expect(await caller().getWikiPageImages({ countryName: "Elmeria Images Two" })).toEqual([image]);
    expect(jest.mocked(getPageImages).mock.calls.map(([, opts]) => opts?.wiki)).toEqual([
      "ixwiki",
      "iiwiki",
    ]);
  });

  it("is null when neither wiki has images, or both fail", async () => {
    jest.mocked(getPageImages).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("down"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await caller().getWikiPageImages({ countryName: "Nowhere Images Three" })).toBeNull();
  });
});

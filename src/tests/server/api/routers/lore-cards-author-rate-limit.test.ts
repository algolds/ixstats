/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
/**
 * `loreCards.getCardAuthorInfo` answers anyone and reads the article's history from its wiki (IxWiki, IIWiki behind
 * Cloudflare, AltHistory on Fandom), so it sits on the shared `public` rate-limit bucket: an anonymous caller cannot
 * make the server hammer a sister wiki.
 */
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => true, check: jest.fn() },
}));
jest.mock("~/lib/wiki-os/adapters/ixstates/lore-card-generator", () => ({
  __esModule: true,
  wikiLoreCardGenerator: { fetchArticleAuthorInfoBatch: jest.fn() },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { rateLimiter } from "~/lib/cache";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import { loreCardsWikiRouter } from "~/server/api/routers/lore-cards/wiki";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const check = jest.mocked(rateLimiter.check);
const caller = () =>
  createCallerFactory(loreCardsWikiRouter)(
    createMockRouterContext({
      auth: null,
      user: null,
      db: createMockPrisma(),
      rateLimitIdentifier: "ip:203.0.113.7",
    }) as never
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest
    .mocked(wikiLoreCardGenerator.fetchArticleAuthorInfoBatch)
    .mockResolvedValue(new Map([["kiro", { creator: "Kir", displayAuthor: "Kir" }]]));
});

describe("loreCards.getCardAuthorInfo rate limit", () => {
  it("counts each request against the public bucket for the client, and still answers", async () => {
    check.mockResolvedValue({ success: true, remaining: 99, resetAt: new Date() });

    await expect(
      caller().getCardAuthorInfo({ articleTitle: "Kiro", source: "althistory" })
    ).resolves.toMatchObject({ authorInfo: { displayAuthor: "Kir" } });
    expect(check).toHaveBeenCalledWith("ip:203.0.113.7", "public", {
      maxRequests: 100,
      windowMs: 60_000,
    });
  });

  it("refuses a client over the limit before asking any wiki", async () => {
    check.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date() });

    await expect(
      caller().getCardAuthorInfo({ articleTitle: "Kiro", source: "iiwiki" })
    ).rejects.toThrow(/Too many requests/);
    expect(wikiLoreCardGenerator.fetchArticleAuthorInfoBatch).not.toHaveBeenCalled();
  });
});

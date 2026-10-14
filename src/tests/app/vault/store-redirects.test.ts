/** @jest-environment node */
/**
 * The Store is /vault/store. Its old addresses (/vault/marketplace, /vault/market, /vault/packs, /vault/trading) forward
 * there, and the marketplace redirect keeps the query string it came with, re-encoded.
 */
jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

import { describe, expect, it } from "@jest/globals";
import MarketPage from "~/app/vault/market/page";
import MarketplacePage from "~/app/vault/marketplace/page";
import PacksPage from "~/app/vault/packs/page";
import TradingPage from "~/app/vault/trading/page";

describe("Store redirects", () => {
  it.each([
    ["market", MarketPage, "/vault/store?tab=auctions"],
    ["packs", PacksPage, "/vault/store?tab=store"],
    ["trading", TradingPage, "/vault/store?tab=trading"],
  ])("sends /vault/%s to the matching Store tab", async (_name, Page, target) => {
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(`redirect:${target}`);
  });

  it.each([
    ["market", MarketPage, "auctions"],
    ["packs", PacksPage, "store"],
    ["trading", TradingPage, "trading"],
  ])(
    "keeps the query /vault/%s came with, and its own tab wins over an incoming tab",
    async (_name, Page, tab) => {
      const failure = await Page({
        searchParams: Promise.resolve({ tab: "wrong", item: "a b", id: ["x", "y"] }),
      }).catch((error: Error) => error);
      const url = new URL((failure as Error).message.replace("redirect:", ""), "http://x");
      expect(url.pathname).toBe("/vault/store");
      expect(url.searchParams.getAll("tab")).toEqual([tab]);
      expect(url.searchParams.get("item")).toBe("a b");
      expect(url.searchParams.getAll("id")).toEqual(["x", "y"]);
    }
  );

  it("sends /vault/marketplace to /vault/store, keeping the query", async () => {
    await expect(
      MarketplacePage({ searchParams: Promise.resolve({ tab: "auctions", id: ["a", "b c"] }) })
    ).rejects.toThrow("redirect:/vault/store?tab=auctions&id=a&id=b+c");
  });

  it("sends a bare /vault/marketplace to a bare /vault/store", async () => {
    await expect(MarketplacePage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "redirect:/vault/store"
    );
  });
});

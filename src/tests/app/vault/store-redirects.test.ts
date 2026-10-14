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
  ])("sends /vault/%s to the matching Store tab", (_name, Page, target) => {
    expect(() => Page()).toThrow(`redirect:${target}`);
  });

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

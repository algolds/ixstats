/**
 * The Store keeps packs, cosmetics and upgrades; its old Auctions and Trading tabs live in the cards hub's Market.
 * src/proxy.ts moves those old links (a redirect thrown by this page would stream as a 200 under the Vault's loading
 * boundary), so the page only renders the shop.
 */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({ redirect: jest.fn(), permanentRedirect: jest.fn() }));
jest.mock("~/components/vault/sections/marketplace/VaultStoreTab", () => ({
  VaultStoreTab: ({ initialView }: { initialView?: string | null }) => (
    <p>Shop on {initialView ?? "its default view"}</p>
  ),
}));

import { permanentRedirect, redirect } from "next/navigation";
import VaultStorePage from "~/app/vault/store/page";

describe("/vault/store", () => {
  it("opens the shop on the view a link names", async () => {
    render(await VaultStorePage({ searchParams: Promise.resolve({ view: "my-packs" }) }));
    expect(screen.getByRole("heading", { level: 1, name: "Store" })).toBeInTheDocument();
    expect(screen.getByText("Shop on my-packs")).toBeInTheDocument();
  });

  it("takes the first view when a link repeats it, and the default view without one", async () => {
    render(
      await VaultStorePage({ searchParams: Promise.resolve({ view: ["cosmetics", "upgrades"] }) })
    );
    render(await VaultStorePage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Shop on cosmetics")).toBeInTheDocument();
    expect(screen.getByText("Shop on its default view")).toBeInTheDocument();
  });

  it("leaves the old auction and trading tabs to the proxy and renders the shop", async () => {
    render(await VaultStorePage({ searchParams: Promise.resolve({ tab: "auctions" }) }));
    render(await VaultStorePage({ searchParams: Promise.resolve({ tab: "trading", card: "c1" }) }));
    expect(screen.getAllByText("Shop on its default view")).toHaveLength(2);
    expect(redirect).not.toHaveBeenCalled();
    expect(permanentRedirect).not.toHaveBeenCalled();
  });
});

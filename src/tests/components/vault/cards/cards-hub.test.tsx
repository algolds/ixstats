/** The cards hub: four tabs, each its own address, and the query each pane reads and writes. */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
jest.mock("~/components/vault/cards/MinePane", () => ({
  MinePane: jest.fn(() => <p>Mine pane</p>),
}));
jest.mock("~/components/vault/cards/SetsPane", () => ({
  SetsPane: jest.fn(() => <p>Sets pane</p>),
}));
jest.mock("~/components/vault/cards/ExplorePane", () => ({
  ExplorePane: jest.fn(() => <p>Explore pane</p>),
}));
jest.mock("~/components/vault/cards/market/MarketPane", () => ({
  MarketPane: jest.fn(() => <p>Market pane</p>),
}));

import { CardsHub } from "~/components/vault/cards/CardsHub";
import { ExplorePane } from "~/components/vault/cards/ExplorePane";
import { MinePane } from "~/components/vault/cards/MinePane";
import { SetsPane } from "~/components/vault/cards/SetsPane";
import { MarketPane } from "~/components/vault/cards/market/MarketPane";

/** The props a mocked pane last rendered with. */
function lastProps<P>(pane: (props: P) => React.ReactNode): P {
  const calls = jest.mocked(pane).mock.calls;
  return calls[calls.length - 1]![0];
}

const at = (address: string) => window.history.replaceState(null, "", address);
const search = () => window.location.search;

let pushState: jest.SpyInstance;
let replaceState: jest.SpyInstance;

beforeEach(() => {
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
});

/** Spies on the history writes the pane callbacks make, after the test has set its address. */
function spyOnHistory() {
  pushState = jest.spyOn(window.history, "pushState");
  replaceState = jest.spyOn(window.history, "replaceState");
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe("CardsHub", () => {
  it("names the page and offers the four tabs, each controlling the one panel", () => {
    at("/vault/cards/mine");
    render(<CardsHub initialTab="mine" />);
    expect(screen.getByRole("heading", { level: 1, name: "Cards" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Cards" })).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Mine", "Sets", "Market", "Explore"]);
    expect(screen.getByRole("tab", { name: "Mine" })).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel", { name: "Mine" });
    expect(tabs.map((t) => t.getAttribute("aria-controls"))).toEqual(Array(4).fill(panel.id));
    expect(panel).toHaveTextContent("Mine pane");
  });

  // The hub has no header toolbar, so its first row pads by Halo's floating band (3.5rem), as the Wallet does.
  it("starts its tabs below the shell's floating header, so the header never takes their taps", () => {
    at("/vault/cards/mine");
    render(<CardsHub initialTab="mine" />);
    expect(screen.getByRole("tablist", { name: "Cards" }).closest(".pt-14")).not.toBeNull();
  });

  it("switches tabs in place, showing only that tab's pane", () => {
    at("/vault/cards/mine");
    render(<CardsHub initialTab="mine" />);
    spyOnHistory();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Sets" }));
    expect(pushState).toHaveBeenCalledWith(null, "", "/vault/cards/sets");
    expect(screen.getByRole("tabpanel", { name: "Sets" })).toHaveTextContent("Sets pane");
    expect(screen.queryByText("Mine pane")).toBeNull();
  });

  it("moves focus along the tabs with the arrow keys, and switches only on Enter or Space", async () => {
    at("/vault/cards/mine");
    render(<CardsHub initialTab="mine" />);
    spyOnHistory();
    const tab = (name: string) => screen.getByRole("tab", { name });
    tab("Mine").focus();
    fireEvent.keyDown(tab("Mine"), { key: "ArrowRight" });
    await waitFor(() => expect(tab("Sets")).toHaveFocus());
    expect(pushState).not.toHaveBeenCalled();
    expect(screen.getByRole("tabpanel", { name: "Mine" })).toHaveTextContent("Mine pane");
    fireEvent.keyDown(tab("Sets"), { key: "Enter" });
    expect(pushState).toHaveBeenCalledWith(null, "", "/vault/cards/sets");
    expect(screen.getByRole("tabpanel", { name: "Sets" })).toHaveTextContent("Sets pane");
  });

  it("opens the card sheet from Mine", () => {
    at("/vault/cards/mine");
    render(<CardsHub initialTab="mine" />);
    act(() => lastProps(MinePane).onOpenCard("c1"));
    expect(search()).toBe("?card=c1");
  });

  it("hands the Market its query, and keeps each change in the address", () => {
    at("/vault/cards/market?tab=selling&sell=o7&for=c9");
    render(<CardsHub initialTab="market" />);
    expect(lastProps(MarketPane)).toMatchObject({
      tab: "selling",
      sellOwnershipId: "o7",
      forCardId: "c9",
    });
    spyOnHistory();
    const market = lastProps(MarketPane);
    act(() => market.onSellHandled());
    expect(search()).toBe("?tab=selling&for=c9");
    act(() => market.onClearFor());
    expect(search()).toBe("?tab=selling");
    act(() => market.onTabChange("trades"));
    expect(search()).toBe("?tab=trades");
    act(() => market.onTabChange("browse"));
    expect(search()).toBe("");
    expect(replaceState).toHaveBeenCalledTimes(4);
    expect(pushState).not.toHaveBeenCalled();
    act(() => market.onOpenCard("c2"));
    expect(search()).toBe("?card=c2");
  });

  it("opens Browse for a market address without a known tab", () => {
    at("/vault/cards/market?tab=auctions");
    render(<CardsHub initialTab="market" />);
    expect(lastProps(MarketPane)).toMatchObject({
      tab: "browse",
      sellOwnershipId: null,
      forCardId: null,
    });
  });

  it("gives Sets its showcase: opening one is a step back can undo, closing one is not", () => {
    at("/vault/cards/sets?showcase=s1");
    render(<CardsHub initialTab="sets" />);
    expect(lastProps(SetsPane).showcaseId).toBe("s1");
    spyOnHistory();
    act(() => lastProps(SetsPane).onShowcaseChange("s2"));
    expect(pushState).toHaveBeenCalledWith(null, "", "/vault/cards/sets?showcase=s2");
    act(() => lastProps(SetsPane).onShowcaseChange(null));
    expect(replaceState).toHaveBeenCalledWith(null, "", "/vault/cards/sets");
    act(() => lastProps(SetsPane).onOpenCard("c3"));
    expect(search()).toBe("?card=c3");
  });

  it("keeps the address's fragment when it rewrites the query", () => {
    at("/vault/cards/sets#binders");
    render(<CardsHub initialTab="sets" />);
    spyOnHistory();
    act(() => lastProps(SetsPane).onShowcaseChange("s2"));
    expect(pushState).toHaveBeenCalledWith(null, "", "/vault/cards/sets?showcase=s2#binders");
    act(() => lastProps(SetsPane).onShowcaseChange(null));
    expect(replaceState).toHaveBeenCalledWith(null, "", "/vault/cards/sets#binders");
  });

  it("gives Sets no showcase when the address has none", () => {
    at("/vault/cards/sets");
    render(<CardsHub initialTab="sets" />);
    expect(lastProps(SetsPane).showcaseId).toBeNull();
  });

  it("gives Explore its realm and keeps the suggestion dialog in the address", () => {
    at("/vault/cards/explore?realm=nationstates&suggest=1");
    render(<CardsHub initialTab="explore" />);
    expect(lastProps(ExplorePane)).toMatchObject({
      initialRealmSlug: "nationstates",
      suggesting: true,
    });
    spyOnHistory();
    act(() => lastProps(ExplorePane).onSuggestingChange(false));
    expect(search()).toBe("?realm=nationstates");
    act(() => lastProps(ExplorePane).onSuggestingChange(true));
    expect(search()).toBe("?realm=nationstates&suggest=1");
    expect(pushState).not.toHaveBeenCalled();
    act(() => lastProps(ExplorePane).onOpenCard("c4"));
    expect(search()).toBe("?realm=nationstates&suggest=1&card=c4");
  });

  it("opens Explore without a realm or the dialog when the address names neither", () => {
    at("/vault/cards/explore?suggest=0");
    render(<CardsHub initialTab="explore" />);
    expect(lastProps(ExplorePane)).toMatchObject({ initialRealmSlug: null, suggesting: false });
  });
});

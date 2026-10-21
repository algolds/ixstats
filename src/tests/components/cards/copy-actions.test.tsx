/**
 * The actions on one held copy in the card sheet: which show for which copy (plain, locked, listed, bound, signed,
 * retired, in a fusion group), the value from the server, and where focus goes when a copy dialog closes.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/hooks/cards/useSheetEconomy", () => ({
  useSheetEconomy: jest.fn(),
  useEconomyNumbers: jest.fn(),
}));
jest.mock("~/hooks/cards/useCopyActions", () => ({ useCopyActions: jest.fn() }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { useEconomyNumbers, useSheetEconomy } from "~/hooks/cards/useSheetEconomy";
import { useCopyActions } from "~/hooks/cards/useCopyActions";
import { COPIES_HEADING_ID, CopyActions } from "~/components/cards/sheet/CopyActions";
import type { CardSheetData, SheetCopy } from "~/lib/cards/hub/sheet";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

// The list form's featured Switch measures itself.
beforeAll(stubResizeObserver);

type Done = { onSuccess?: () => void };

const sheetCopy = (over: Partial<SheetCopy> = {}) =>
  ({
    face: {
      cardId: "c1",
      copy: { ownershipId: "a", finish: "STANDARD", serialNumber: 4, level: 1 },
    },
    experience: 0,
    acquiredAt: new Date("2026-11-01T00:00:00Z"),
    isLocked: false,
    inscription: null,
    trail: [],
    ...over,
  }) as SheetCopy;
const card = (over: Partial<CardSheetData["card"]> = {}) =>
  ({
    id: "c1",
    title: "Aurelia",
    isBound: false,
    isRetired: false,
    ...over,
  }) as CardSheetData["card"];
const economyCopy = (over: object = {}) => ({
  ownershipId: "a",
  finish: "STANDARD",
  value: 120,
  dust: 50,
  breakdownBlocker: null,
  canSign: true,
  listingId: null,
  auctionId: null,
  ...over,
});
const economy = (over: object = {}, copies = [economyCopy()]) => ({
  data: {
    cardId: "c1",
    isBound: false,
    wishlisted: false,
    signerName: "@ixnay",
    copies,
    fusionGroups: [],
    craft: null,
    ...over,
  },
});
const showEconomy = (value: ReturnType<typeof economy> | { data: undefined }) =>
  jest.mocked(useSheetEconomy).mockReturnValue(value as never);

const mutation = () => ({
  mutate: jest.fn((_input: object, done?: Done) => done?.onSuccess?.()),
  isPending: false,
});
let actions: Record<
  "list" | "listMany" | "breakDown" | "fuse" | "sign",
  ReturnType<typeof mutation>
>;

const renderActions = (copy = sheetCopy(), sheetCard = card()) =>
  render(
    <>
      <h3 id={COPIES_HEADING_ID} tabIndex={-1}>
        Your copies
      </h3>
      <CopyActions copy={copy} card={sheetCard} onAddToShowcase={jest.fn()} />
    </>
  );
const button = (name: string) => screen.queryByRole("button", { name });
const shown = () =>
  ["Add to showcase", "List", "Fuse", "Break down", "Sign"].filter((name) => button(name));

beforeEach(() => {
  actions = {
    list: mutation(),
    listMany: mutation(),
    breakDown: mutation(),
    fuse: mutation(),
    sign: mutation(),
  };
  jest.mocked(useCopyActions).mockReturnValue(actions as never);
  jest.mocked(useEconomyNumbers).mockReturnValue({ data: undefined } as never);
});

describe("CopyActions", () => {
  it("offers showcase, list, auction, break down and sign for a plain copy, with its value", () => {
    showEconomy(economy());
    renderActions();
    expect(shown()).toEqual(["Add to showcase", "List", "Break down", "Sign"]);
    expect(screen.getByRole("link", { name: "Sell at auction" }).getAttribute("href")).toBe(
      "/vault/cards/market?tab=selling&sell=a"
    );
    expect(screen.getByRole("link", { name: "Offer in a trade" }).getAttribute("href")).toBe(
      "/vault/cards/market?tab=trades&trade=new&give=a"
    );
    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.queryByText("Retired")).toBeNull();
    expect(useSheetEconomy).toHaveBeenCalledWith("c1");
  });

  it("offers fuse only to a copy in a ready group", () => {
    showEconomy(
      economy({
        fusionGroups: [{ finish: "STANDARD", next: "FOIL", ownershipIds: ["a", "b", "c"] }],
      })
    );
    const { unmount } = renderActions();
    expect(button("Fuse")).toBeTruthy();
    unmount();
    showEconomy(
      economy({
        fusionGroups: [{ finish: "STANDARD", next: "FOIL", ownershipIds: ["b", "c", "d"] }],
      })
    );
    renderActions();
    expect(button("Fuse")).toBeNull();
  });

  it("offers a listed copy no sale, workshop or signing, and points to Selling", () => {
    showEconomy(
      economy({}, [economyCopy({ listingId: "l1", canSign: false, breakdownBlocker: "x" })])
    );
    renderActions(sheetCopy({ isLocked: true }));
    expect(shown()).toEqual(["Add to showcase"]);
    expect(screen.queryByRole("link", { name: "Sell at auction" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Offer in a trade" })).toBeNull();
    expect(screen.getByRole("link", { name: "See it in Selling" }).getAttribute("href")).toBe(
      "/vault/cards/market?tab=selling"
    );
  });

  it("points a copy at auction to Selling too, but not a copy locked in a trade", () => {
    showEconomy(
      economy({}, [economyCopy({ auctionId: "x1", canSign: false, breakdownBlocker: "x" })])
    );
    const { unmount } = renderActions(sheetCopy({ isLocked: true }));
    expect(screen.getByRole("link", { name: "See it in Selling" })).toBeTruthy();
    unmount();
    showEconomy(economy({}, [economyCopy({ canSign: false, breakdownBlocker: "x" })]));
    renderActions(sheetCopy({ isLocked: true }));
    expect(screen.queryByRole("link", { name: "See it in Selling" })).toBeNull();
    expect(shown()).toEqual(["Add to showcase"]);
  });

  it("offers only the showcase and signing on a bound card", () => {
    showEconomy(
      economy({ isBound: true }, [
        economyCopy({ breakdownBlocker: "Bound cards can't be broken down." }),
      ])
    );
    renderActions(sheetCopy(), card({ isBound: true }));
    expect(shown()).toEqual(["Add to showcase", "Sign"]);
    expect(screen.queryByRole("link", { name: "Sell at auction" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Offer in a trade" })).toBeNull();
  });

  it("still sells a signed copy, but never breaks it down or signs it again", () => {
    showEconomy(
      economy({}, [
        economyCopy({ canSign: false, breakdownBlocker: "Signed copies can't be broken down." }),
      ])
    );
    renderActions();
    expect(shown()).toEqual(["Add to showcase", "List"]);
    expect(screen.getByRole("link", { name: "Sell at auction" })).toBeTruthy();
  });
  it("offers only the showcase and the auction form until the economy has loaded", () => {
    showEconomy({ data: undefined });
    renderActions();
    expect(shown()).toEqual(["Add to showcase"]);
    expect(screen.getByRole("link", { name: "Sell at auction" })).toBeTruthy();
  });
  it("opens each dialog for its own action", () => {
    showEconomy(
      economy({
        fusionGroups: [{ finish: "STANDARD", next: "FOIL", ownershipIds: ["a", "b", "c"] }],
      })
    );
    renderActions();
    const opens: Array<[string, string]> = [
      ["List", "List Aurelia"],
      ["Fuse", "Fuse 3 Standard copies into one Foil?"],
      ["Break down", "Break down this copy for 50 dust?"],
      ["Sign", "Sign Aurelia"],
    ];
    for (const [action, title] of opens) {
      fireEvent.click(screen.getByRole("button", { name: action }));
      expect(screen.getByRole("heading", { name: title })).toBeTruthy();
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      expect(screen.queryByRole("heading", { name: title })).toBeNull();
    }
  });
});

describe("CopyActions focus", () => {
  it("keeps a confirm dialog open while its action fails", () => {
    actions.breakDown.mutate = jest.fn();
    showEconomy(economy());
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Break down" }));
    fireEvent.click(screen.getByRole("button", { name: "Break down" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
});

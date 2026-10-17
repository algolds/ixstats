import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      cardMarket: {
        getActiveAuctions: { invalidate: jest.fn() },
        getMyActiveAuctions: { invalidate: jest.fn() },
      },
      cards: { listMine: { invalidate: jest.fn() } },
    }),
    cards: { listMine: { useQuery: jest.fn() } },
    cardMarket: { createAuction: { useMutation: jest.fn() } },
  },
}));
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));

import { api } from "~/trpc/react";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { CreateAuctionModal } from "~/components/vault/cards/market/CreateAuctionModal";

const realm = { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false };
const row = (ownershipId: string, serialNumber: number, isLocked = false) => ({
  face: {
    cardId: "c1",
    title: "Caphiria",
    rarity: "EPIC" as const,
    cardType: "LORE" as const,
    realm,
    artwork: null,
    silhouette: false,
    number: 1,
    season: null,
    isRetired: false,
    copy: { ownershipId, finish: "FOIL" as const, serialNumber, level: 1 },
  },
  value: 100,
  copies: 3,
  acquiredAt: new Date("2026-10-01T00:00:00Z"),
  isLocked,
});

let mutate: jest.Mock;
let onSuccess: (result: { message: string }) => void = () => undefined;

beforeEach(() => {
  mutate = jest.fn();
  jest.mocked(api.cards.listMine.useQuery).mockReturnValue({
    data: { rows: [row("o1", 4), row("o2", 9), row("o3", 12, true)] },
    isLoading: false,
  } as never);
  jest.mocked(api.cardMarket.createAuction.useMutation).mockImplementation(((options: {
    onSuccess: typeof onSuccess;
  }) => {
    onSuccess = options.onSuccess;
    return { mutate, isPending: false };
  }) as never);
});

const field = (name: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });
const list = () => screen.getByRole("button", { name: "List it" });

describe("CreateAuctionModal", () => {
  it("lists copies, not cards, and leaves out a copy already listed or traded", () => {
    render(<CreateAuctionModal open onClose={jest.fn()} />);
    const copies = within(screen.getByRole("list", { name: "Your cards" })).getAllByRole("button");
    expect(copies).toHaveLength(2);
    expect(copies[0]).toHaveTextContent("Caphiria#4 · Foil");
    expect(copies[1]).toHaveTextContent("Caphiria#9 · Foil");
    expect(screen.queryByText(/#12/)).toBeNull();
  });

  it("lists the copy picked, at the prices typed", () => {
    render(<CreateAuctionModal open onClose={jest.fn()} />);
    expect(list()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /#9/ }));
    expect(screen.getByRole("button", { name: /#9/ })).toHaveAttribute("aria-pressed", "true");
    field(/Starting price/, "40");
    field(/Buy-now price/, "90");
    fireEvent.click(list());
    expect(mutate).toHaveBeenCalledWith({
      cardId: "o2",
      startingPrice: 40,
      buyoutPrice: 90,
      duration: "60",
    });
  });

  it("starts on the copy the sheet sent, and leaves the buy-now price out when it is empty", () => {
    render(<CreateAuctionModal open onClose={jest.fn()} initialOwnershipId="o1" />);
    expect(screen.getByRole("button", { name: /#4/ })).toHaveAttribute("aria-pressed", "true");
    field(/Starting price/, "25");
    fireEvent.click(screen.getByRole("radio", { name: "30 minutes" }));
    fireEvent.click(list());
    expect(mutate).toHaveBeenCalledWith({
      cardId: "o1",
      startingPrice: 25,
      buyoutPrice: undefined,
      duration: "30",
    });
  });

  it("refuses a buy-now price at or under the start, and prices that are not whole IxC", () => {
    render(<CreateAuctionModal open onClose={jest.fn()} initialOwnershipId="o1" />);
    field(/Starting price/, "50");
    field(/Buy-now price/, "50");
    fireEvent.click(list());
    expect(vaultNotify.error).toHaveBeenCalledWith(
      "The buy-now price must be above the starting price"
    );
    field(/Buy-now price/, "60.5");
    expect(list()).toBeDisabled();
    field(/Buy-now price/, "");
    field(/Starting price/, "0");
    expect(list()).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("closes once the copy is listed", () => {
    const onClose = jest.fn();
    render(<CreateAuctionModal open onClose={onClose} initialOwnershipId="o1" />);
    onSuccess({ message: "Auction created" });
    expect(vaultNotify.success).toHaveBeenCalledWith("Auction created");
    expect(onClose).toHaveBeenCalled();
  });
});

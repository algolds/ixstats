import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/hooks/cards/useCopyActions", () => ({ useCopyActions: jest.fn() }));
jest.mock("~/hooks/cards/useSheetEconomy", () => ({ useEconomyNumbers: jest.fn() }));
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));

import { useCopyActions } from "~/hooks/cards/useCopyActions";
import { useEconomyNumbers } from "~/hooks/cards/useSheetEconomy";
import { CARD_ECONOMY_DEFAULTS } from "~/lib/cards/economy-config";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { BulkListDialog } from "~/components/vault/cards/BulkListDialog";

type Listed = { ownershipId: string; listingId: string | null; error: string | null };
type Done = { onSuccess?: (results: Listed[]) => void };

const copy = (ownershipId: string, title: string, value: number, serialNumber = 1) => ({
  ownershipId,
  title,
  finish: "STANDARD" as const,
  serialNumber,
  value,
});
const copies = [copy("a", "Aurelia", 120, 3), copy("b", "Burgundie", 80, 7)];
let mutate: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mutate = jest.fn();
  jest.mocked(useCopyActions).mockReturnValue({ listMany: { mutate, isPending: false } } as never);
  jest
    .mocked(useEconomyNumbers)
    .mockReturnValue({ data: { economy: CARD_ECONOMY_DEFAULTS, feeRatePct: 10 } } as never);
});

const dialog = (onDone = jest.fn(), list = copies) =>
  render(<BulkListDialog open onOpenChange={jest.fn()} copies={list} onDone={onDone} />);

describe("BulkListDialog", () => {
  it("lists each selected copy at its own price", () => {
    dialog();
    fireEvent.change(screen.getByLabelText("Price for Burgundie Standard #7 in IxC"), {
      target: { value: "95" },
    });
    // The listing rule in the words the sheet's List and the auction form use, then the total.
    expect(
      screen.getByText(
        "Listing costs 5 IxC, and 2.5 IxC comes back if the card does not sell. Each listing stays up for 14 days."
      )
    ).toBeTruthy();
    expect(screen.getByText("Listing 2 copies costs 10 IxC.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "List 2 copies" }));
    expect(mutate).toHaveBeenCalledWith(
      {
        items: [
          { ownershipId: "a", price: 120 },
          { ownershipId: "b", price: 95 },
        ],
        isFeatured: false,
      },
      expect.anything()
    );
  });

  it("starts each price at the copy's value, whole and within the market's range", () => {
    dialog(jest.fn(), [
      copy("a", "Aurelia", 0),
      copy("b", "Burgundie", 80.6),
      copy("c", "Caphiria", 5_000_000),
    ]);
    expect(screen.getByLabelText("Price for Aurelia Standard #1 in IxC")).toHaveValue("1");
    expect(screen.getByLabelText("Price for Burgundie Standard #1 in IxC")).toHaveValue("81");
    expect(screen.getByLabelText("Price for Caphiria Standard #1 in IxC")).toHaveValue("1000000");
  });

  it("tells copies of one card apart by finish and serial", () => {
    dialog(jest.fn(), [
      copy("a", "Aurelia", 10, 3),
      { ...copy("b", "Aurelia", 10, 12), finish: "FOIL" as const },
    ]);
    expect(screen.getByLabelText("Price for Aurelia Standard #3 in IxC")).toBeTruthy();
    expect(screen.getByLabelText("Price for Aurelia Foil #12 in IxC")).toBeTruthy();
  });

  it("holds the listing while a price is not a whole IxC in range, and marks it", () => {
    dialog();
    const price = screen.getByLabelText("Price for Aurelia Standard #3 in IxC");
    fireEvent.change(price, { target: { value: "1.5" } });
    expect(price).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Price for Burgundie Standard #7 in IxC")).toHaveAttribute(
      "aria-invalid",
      "false"
    );
    fireEvent.click(screen.getByRole("button", { name: "List 2 copies" }));
    expect(mutate).not.toHaveBeenCalled();
  });

  it("waits for the economy numbers, so the fee it states is the real one", () => {
    jest.mocked(useEconomyNumbers).mockReturnValue({ data: undefined } as never);
    dialog();
    expect(screen.getByRole("button", { name: "List 2 copies" })).toBeDisabled();
    expect(screen.queryByText(/costs/)).toBeNull();
  });

  it("says when listing is free", () => {
    jest.mocked(useEconomyNumbers).mockReturnValue({
      data: { economy: { ...CARD_ECONOMY_DEFAULTS, listingFee: 0 }, feeRatePct: 10 },
    } as never);
    dialog();
    expect(screen.getByText("Listing is free. Each listing stays up for 14 days.")).toBeTruthy();
    expect(screen.queryByText(/^Listing 2 copies/)).toBeNull();
  });

  it("is done once every copy is listed", () => {
    mutate.mockImplementation((_input: object, done: Done) =>
      done.onSuccess?.([
        { ownershipId: "a", listingId: "l1", error: null },
        { ownershipId: "b", listingId: "l2", error: null },
      ])
    );
    const onDone = jest.fn();
    dialog(onDone);
    fireEvent.click(screen.getByRole("button", { name: "List 2 copies" }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(vaultNotify.success).toHaveBeenCalledWith("2 copies are on the market.", "Listed");
  });

  it("keeps the copies that were not listed, says why, and lists only those again", () => {
    mutate.mockImplementationOnce((_input: object, done: Done) =>
      done.onSuccess?.([
        { ownershipId: "a", listingId: "l1", error: null },
        { ownershipId: "b", listingId: null, error: "You need 5 IxC to list this copy." },
      ])
    );
    const onDone = jest.fn();
    dialog(onDone);
    fireEvent.click(screen.getByRole("button", { name: "List 2 copies" }));
    expect(onDone).not.toHaveBeenCalled();
    expect(vaultNotify.success).toHaveBeenCalledWith("1 copy is on the market.", "Listed");
    expect(screen.getByRole("alert")).toHaveTextContent("1 of 2 copies could not be listed.");
    expect(screen.queryByLabelText("Price for Aurelia Standard #3 in IxC")).toBeNull();
    const price = screen.getByLabelText("Price for Burgundie Standard #7 in IxC");
    const why = screen.getByText("You need 5 IxC to list this copy.");
    expect(price.getAttribute("aria-describedby")).toContain(why.id);
    // One copy left: the listing rule says its cost, with no total beside it.
    expect(screen.getByText(/^Listing costs 5 IxC/)).toBeTruthy();
    expect(screen.queryByText(/^Listing 1 copy/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "List 1 copy" }));
    expect(mutate).toHaveBeenLastCalledWith(
      { items: [{ ownershipId: "b", price: 80 }], isFeatured: false },
      expect.anything()
    );
  });

  it("toasts nothing when no copy was listed", () => {
    mutate.mockImplementation((_input: object, done: Done) =>
      done.onSuccess?.([
        { ownershipId: "a", listingId: null, error: "The market is closed." },
        { ownershipId: "b", listingId: null, error: "The market is closed." },
      ])
    );
    dialog();
    fireEvent.click(screen.getByRole("button", { name: "List 2 copies" }));
    expect(vaultNotify.success).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("2 of 2 copies could not be listed.");
    expect(screen.getAllByText("The market is closed.")).toHaveLength(2);
  });
});

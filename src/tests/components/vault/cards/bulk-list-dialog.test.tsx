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

const copies = [
  { ownershipId: "a", title: "Aurelia", value: 120 },
  { ownershipId: "b", title: "Burgundie", value: 80 },
];
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
    fireEvent.change(screen.getByLabelText("Price for Burgundie in IxC"), {
      target: { value: "95" },
    });
    expect(screen.getByText("Listing 2 copies costs 10 IxC.")).toBeTruthy();
    expect(
      screen.getByText(
        "Each listing stays up for 14 days, and 2.5 IxC of its fee comes back if the copy does not sell."
      )
    ).toBeTruthy();
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
      { ownershipId: "a", title: "Aurelia", value: 0 },
      { ownershipId: "b", title: "Burgundie", value: 80.6 },
      { ownershipId: "c", title: "Caphiria", value: 5_000_000 },
    ]);
    expect(screen.getByLabelText("Price for Aurelia in IxC")).toHaveValue("1");
    expect(screen.getByLabelText("Price for Burgundie in IxC")).toHaveValue("81");
    expect(screen.getByLabelText("Price for Caphiria in IxC")).toHaveValue("1000000");
  });

  it("holds the listing while a price is not a whole IxC in range, and marks it", () => {
    dialog();
    const price = screen.getByLabelText("Price for Aurelia in IxC");
    fireEvent.change(price, { target: { value: "1.5" } });
    expect(price).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Price for Burgundie in IxC")).toHaveAttribute(
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
    expect(screen.getByText("Listing is free.")).toBeTruthy();
    expect(screen.getByText("Each listing stays up for 14 days.")).toBeTruthy();
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
    expect(screen.queryByLabelText("Price for Aurelia in IxC")).toBeNull();
    const price = screen.getByLabelText("Price for Burgundie in IxC");
    const why = screen.getByText("You need 5 IxC to list this copy.");
    expect(price.getAttribute("aria-describedby")).toContain(why.id);
    expect(screen.getByText("Listing 1 copy costs 5 IxC.")).toBeTruthy();
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

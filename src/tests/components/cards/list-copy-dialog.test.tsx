/**
 * Listing one copy at a fixed price: the fee, the refund share and the seller's net come from the server's numbers,
 * and only a whole price in range can be listed.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/hooks/cards/useSheetEconomy", () => ({ useEconomyNumbers: jest.fn() }));
jest.mock("~/hooks/cards/useCopyActions", () => ({ useCopyActions: jest.fn() }));

import { useEconomyNumbers } from "~/hooks/cards/useSheetEconomy";
import { useCopyActions } from "~/hooks/cards/useCopyActions";
import { CARD_ECONOMY_DEFAULTS } from "~/lib/cards/economy-config";
import { ListCopyDialog, parsePrice } from "~/components/cards/sheet/economy/ListCopyDialog";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

// The featured Switch measures itself.
beforeAll(stubResizeObserver);

const numbers = (over: object = {}, feeRatePct = 10) => ({
  data: { economy: { ...CARD_ECONOMY_DEFAULTS, ...over }, feeRatePct },
});

function setup(
  props: {
    suggestedPrice?: number;
    numbers?: ReturnType<typeof numbers> | { data: undefined; isError?: boolean };
  } = {}
) {
  const mutate = jest.fn();
  const onDone = jest.fn();
  jest.mocked(useCopyActions).mockReturnValue({ list: { mutate, isPending: false } } as never);
  jest.mocked(useEconomyNumbers).mockReturnValue((props.numbers ?? numbers()) as never);
  render(
    <ListCopyDialog
      open
      onOpenChange={jest.fn()}
      onDone={onDone}
      cardTitle="Aurelia"
      ownershipId="a"
      suggestedPrice={props.suggestedPrice ?? 120}
    />
  );
  return { mutate, onDone };
}
const price = (value: string) =>
  fireEvent.change(screen.getByLabelText("Price in IxC"), { target: { value } });

describe("ListCopyDialog", () => {
  it("lists at the typed price and spells out the fees", () => {
    const { mutate, onDone } = setup();
    price("500");
    expect(
      screen.getByText(
        "Listing costs 5 IxC, and 2.5 IxC comes back if the card does not sell. It stays up for 14 days."
      )
    ).toBeTruthy();
    expect(screen.getByText("You receive 450 IxC after the market fee.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "List for 500 IxC" }));
    expect(mutate).toHaveBeenCalledWith(
      { ownershipId: "a", price: 500, isFeatured: false },
      expect.anything()
    );
    mutate.mock.calls[0]![1].onSuccess();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("starts at the copy's value, rounded to a whole IxC", () => {
    setup({ suggestedPrice: 119.6 });
    expect((screen.getByLabelText("Price in IxC") as HTMLInputElement).value).toBe("120");
  });

  it("starts a copy worth nothing at 1 IxC", () => {
    setup({ suggestedPrice: 0 });
    expect((screen.getByLabelText("Price in IxC") as HTMLInputElement).value).toBe("1");
  });

  it("charges the featured fee when the listing is featured", () => {
    const { mutate } = setup();
    fireEvent.click(screen.getByRole("switch", { name: "Feature it at the top of Browse" }));
    expect(screen.getByText(/^Listing costs 10 IxC, and 5 IxC comes back/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "List for 120 IxC" }));
    expect(mutate.mock.calls[0]![0]).toEqual({ ownershipId: "a", price: 120, isFeatured: true });
  });

  it("names no market fee on a sale at or under the threshold", () => {
    setup();
    price("100");
    expect(screen.getByText("You receive 100 IxC.")).toBeTruthy();
    price("101");
    expect(screen.getByText("You receive 91 IxC after the market fee.")).toBeTruthy();
  });

  it("will not list at a price that is not a whole number of IxC in range", () => {
    const { mutate } = setup();
    for (const value of ["2.5", "0", "", "1000001", "abc"]) {
      price(value);
      const submit = screen.getByRole("button", { name: "Enter a price" });
      expect(submit.hasAttribute("disabled")).toBe(true);
      expect(screen.getByLabelText("Price in IxC").getAttribute("aria-invalid")).toBe("true");
    }
    fireEvent.submit(screen.getByLabelText("Price in IxC").closest("form")!);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("describes the price field with its rule", () => {
    setup();
    const field = screen.getByLabelText("Price in IxC");
    const hint = document.getElementById(field.getAttribute("aria-describedby") ?? "");
    expect(hint?.textContent).toBe("A whole number of IxC, from 1 to 1,000,000.");
    expect(field.getAttribute("aria-invalid")).toBe("false");
  });

  it("starts a copy worth more than the cap at the cap, so it opens listable", () => {
    const { mutate } = setup({ suggestedPrice: 4_000_000 });
    expect((screen.getByLabelText("Price in IxC") as HTMLInputElement).value).toBe("1000000");
    fireEvent.click(screen.getByRole("button", { name: "List for 1,000,000 IxC" }));
    expect(mutate.mock.calls[0]![0]).toMatchObject({ price: 1_000_000 });
  });

  it("will not list until the fees are shown, so a fee is never paid unseen", () => {
    const { mutate } = setup({ numbers: { data: undefined } });
    expect(screen.queryByText(/Listing costs/)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Loading the listing fee");
    expect(screen.getByRole("button", { name: "List for 120 IxC" })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText("Price in IxC").closest("form")!);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("says why it cannot list when the fees did not load", () => {
    setup({ numbers: { data: undefined, isError: true } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The listing fee did not load, so this copy cannot be listed yet."
    );
    expect(screen.getByRole("button", { name: "List for 120 IxC" })).toBeDisabled();
  });
});

describe("parsePrice", () => {
  it("takes a whole IxC price from 1 to the cap", () => {
    expect([parsePrice("1"), parsePrice("1000000"), parsePrice(" 42 ")]).toEqual([
      1, 1_000_000, 42,
    ]);
    expect([parsePrice("0"), parsePrice("1000001"), parsePrice("2.5"), parsePrice("")]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});

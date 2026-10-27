/**
 * Listing one copy at a fixed price: the fee, the refund share and the seller's net come from the server's numbers,
 * and only a whole price in range can be listed.
 */
import "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/hooks/cards/useSheetEconomy", () => ({ useEconomyNumbers: jest.fn() }));
jest.mock("~/hooks/cards/useCopyActions", () => ({ useCopyActions: jest.fn() }));

import { useEconomyNumbers } from "~/hooks/cards/useSheetEconomy";
import { useCopyActions } from "~/hooks/cards/useCopyActions";
import { CARD_ECONOMY_DEFAULTS } from "~/lib/cards/economy-config";
import { ListCopyDialog } from "~/components/cards/sheet/economy/ListCopyDialog";
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

describe("ListCopyDialog", () => {
  it("will not list until the fees are shown, so a fee is never paid unseen", () => {
    const { mutate } = setup({ numbers: { data: undefined } });
    expect(screen.queryByText(/Listing costs/)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Loading the listing fee");
    expect(screen.getByRole("button", { name: "List for 120 IxC" })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText("Price in IxC").closest("form")!);
    expect(mutate).not.toHaveBeenCalled();
  });
});

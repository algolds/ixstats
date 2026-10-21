import "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/hooks/cards/useCopyActions", () => ({ useCopyActions: jest.fn() }));
jest.mock("~/hooks/cards/useSheetEconomy", () => ({ useEconomyNumbers: jest.fn() }));
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));

import { useCopyActions } from "~/hooks/cards/useCopyActions";
import { useEconomyNumbers } from "~/hooks/cards/useSheetEconomy";
import { CARD_ECONOMY_DEFAULTS } from "~/lib/cards/economy-config";
import { BulkListDialog, type BulkListCopy } from "~/components/vault/cards/BulkListDialog";

const copy = (
  ownershipId: string,
  title: string,
  value: number,
  serialNumber = 1
): BulkListCopy => ({
  ownershipId,
  title,
  finish: "STANDARD",
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
  it("waits for the economy numbers, so the fee it states is the real one", () => {
    jest.mocked(useEconomyNumbers).mockReturnValue({ data: undefined } as never);
    dialog();
    expect(screen.getByRole("button", { name: "List 2 copies" })).toBeDisabled();
    expect(screen.queryByText(/costs/)).toBeNull();
  });
});

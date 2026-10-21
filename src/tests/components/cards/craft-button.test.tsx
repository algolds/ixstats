/** Crafting a Standard copy from the sheet: the server's quote, the dust the player lacks, and why a card can't be. */
import "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/hooks/cards/useMarketActions", () => ({ useMarketActions: jest.fn() }));

import { useMarketActions } from "~/hooks/cards/useMarketActions";
import { CraftButton } from "~/components/cards/sheet/economy/CraftButton";
import type { CraftOfferView } from "~/hooks/cards/useSheetEconomy";

const offer = (over: Partial<CraftOfferView> = {}): CraftOfferView => ({
  cardId: "c1",
  realmId: "default",
  verdict: { ok: true },
  quote: { dust: 40, credits: 10 },
  dust: 100,
  ...over,
});

function setup(over: Partial<CraftOfferView> = {}, isPending = false) {
  const mutate = jest.fn();
  jest.mocked(useMarketActions).mockReturnValue({ craft: { mutate, isPending } } as never);
  render(<CraftButton cardId="c1" offer={offer(over)} />);
  return mutate;
}

describe("CraftButton", () => {
  it("crafts when the player has the realm's dust", () => {
    const mutate = setup();
    fireEvent.click(screen.getByRole("button", { name: "Craft for 40 dust and 10 IxC" }));
    expect(mutate).toHaveBeenCalledWith({ cardId: "c1" });
  });

  it("crafts with exactly the dust it needs", () => {
    const mutate = setup({ dust: 40 });
    fireEvent.click(screen.getByRole("button", { name: "Craft for 40 dust and 10 IxC" }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/dust this needs/)).toBeNull();
  });

  it("says how much dust is missing", () => {
    const mutate = setup({ dust: 15 });
    const button = screen.getByRole("button", { name: "Craft for 40 dust and 10 IxC" });
    expect(button.hasAttribute("disabled")).toBe(true);
    const hint = screen.getByText("You have 15 of the 40 dust this needs.");
    expect(button.getAttribute("aria-describedby")).toBe(hint.id);
    fireEvent.click(button);
    expect(mutate).not.toHaveBeenCalled();
  });
  it("holds the button while a craft is under way", () => {
    setup({}, true);
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  });

  it("explains why a card can't be crafted", () => {
    setup({ verdict: { ok: false, reason: "Legendary cards can't be crafted." } });
    expect(screen.getByText("Legendary cards can't be crafted.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

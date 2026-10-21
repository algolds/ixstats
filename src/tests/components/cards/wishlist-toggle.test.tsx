/** The sheet header's wishlist and per-card mute toggles. */
import "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/hooks/cards/useSheetEconomy", () => ({ useSheetEconomy: jest.fn() }));
jest.mock("~/hooks/cards/useMarketActions", () => ({
  useMarketActions: jest.fn(),
  useCardMute: jest.fn(),
}));

import { useSheetEconomy } from "~/hooks/cards/useSheetEconomy";
import { useCardMute, useMarketActions } from "~/hooks/cards/useMarketActions";
import { MuteToggle } from "~/components/cards/sheet/economy/MuteToggle";
import { WishlistToggle } from "~/components/cards/sheet/economy/WishlistToggle";

const economy = (data: object | undefined) =>
  jest.mocked(useSheetEconomy).mockReturnValue({ data } as never);

describe("WishlistToggle", () => {
  it("adds to and removes from the wishlist", () => {
    const wish = jest.fn();
    const unwish = jest.fn();
    jest.mocked(useMarketActions).mockReturnValue({
      wish: { mutate: wish, isPending: false },
      unwish: { mutate: unwish, isPending: false },
    } as never);
    economy({ wishlisted: false, isBound: false });
    const { rerender } = render(<WishlistToggle cardId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Add to wishlist" }));
    expect(wish).toHaveBeenCalledWith({ cardId: "c1" });
    expect(unwish).not.toHaveBeenCalled();

    economy({ wishlisted: true, isBound: false });
    rerender(<WishlistToggle cardId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "On your wishlist" }));
    expect(unwish).toHaveBeenCalledWith({ cardId: "c1" });
    expect(wish).toHaveBeenCalledTimes(1);
  });
  it("offers no wishlist for a bound card, or before the card's economy arrives", () => {
    jest
      .mocked(useMarketActions)
      .mockReturnValue({ wish: { isPending: false }, unwish: { isPending: false } } as never);
    economy({ wishlisted: false, isBound: true });
    const { rerender } = render(<WishlistToggle cardId="c1" />);
    expect(screen.queryByRole("button")).toBeNull();
    economy(undefined);
    rerender(<WishlistToggle cardId="c1" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("MuteToggle", () => {
  const mute = (data: boolean | undefined, isPending = false) => {
    const mutate = jest.fn();
    jest.mocked(useMarketActions).mockReturnValue({ setMute: { mutate, isPending } } as never);
    jest.mocked(useCardMute).mockReturnValue({ data } as never);
    return mutate;
  };

  it("mutes notices about the card", () => {
    const mutate = mute(false);
    render(<MuteToggle cardId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Mute notices about this card" }));
    expect(mutate).toHaveBeenCalledWith({ cardId: "c1", muted: true });
    expect(useCardMute).toHaveBeenCalledWith("c1");
  });

  it("unmutes a muted card", () => {
    const mutate = mute(true);
    render(<MuteToggle cardId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Unmute notices about this card" }));
    expect(mutate).toHaveBeenCalledWith({ cardId: "c1", muted: false });
  });
});

/**
 * The copy mutations of the sheet and Mine: every one reads the card screens again through the one refresh, a burn
 * (break down, fuse) also reads the showcases again, and a failure is toasted.
 */
import { renderHook } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const mutation = () => ({ useMutation: jest.fn((options: object) => ({ options })) });
  return {
    api: {
      cardMarket: { createListing: mutation(), createListings: mutation() },
      crafting: { breakDown: mutation(), fuse: mutation() },
      cards: { inscribe: mutation() },
    },
  };
});
jest.mock("~/hooks/useCardsRefresh", () => {
  const refreshCards = jest.fn();
  return { useCardsRefresh: () => refreshCards };
});
jest.mock("~/hooks/useShowcaseRefresh", () => {
  const refreshShowcases = jest.fn();
  return { useShowcaseRefresh: () => refreshShowcases };
});
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));

import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { useShowcaseRefresh } from "~/hooks/useShowcaseRefresh";
import { useCopyActions } from "~/hooks/cards/useCopyActions";
import { vaultNotify } from "~/lib/vault/vault-notifications";

interface Options {
  onSuccess: (result: object) => void;
  onError: (error: { message: string }) => void;
}
type Action = "list" | "listMany" | "breakDown" | "fuse" | "sign";

const RESULTS: Record<Action, object> = {
  list: { id: "l1" },
  listMany: [{ ownershipId: "a", listingId: "l1", error: null }],
  breakDown: {
    broken: 2,
    dust: [
      { realmId: "r1", amount: 30 },
      { realmId: "r2", amount: 20 },
    ],
  },
  fuse: { ownershipId: "a", finish: "FOIL", serialNumber: 4 },
  sign: { inscription: "gg", name: "@ixnay" },
};

function optionsOf(action: Action): Options {
  const { result } = renderHook(() => useCopyActions());
  return (result.current[action] as never as { options: Options }).options;
}

const refreshCards = () => useCardsRefresh();
const refreshShowcases = () => useShowcaseRefresh();

beforeEach(() => jest.clearAllMocks());

describe("useCopyActions", () => {
  it.each<[Action, boolean]>([
    ["list", false],
    ["listMany", false],
    ["breakDown", true],
    ["fuse", true],
    ["sign", false],
  ])("%s reads the card screens again, and the showcases only after a burn", (action, burns) => {
    optionsOf(action).onSuccess(RESULTS[action]);
    expect(refreshCards()).toHaveBeenCalledTimes(1);
    expect(refreshShowcases()).toHaveBeenCalledTimes(burns ? 1 : 0);
  });

  it.each<Action>(["list", "listMany", "breakDown", "fuse", "sign"])(
    "%s toasts a failure and reads nothing again",
    (action) => {
      optionsOf(action).onError({ message: "This copy is locked." });
      expect(vaultNotify.error).toHaveBeenCalledWith("This copy is locked.");
      expect(refreshCards()).not.toHaveBeenCalled();
    }
  );

  it("says what each single action did", () => {
    optionsOf("list").onSuccess(RESULTS.list);
    optionsOf("breakDown").onSuccess(RESULTS.breakDown);
    optionsOf("fuse").onSuccess(RESULTS.fuse);
    optionsOf("sign").onSuccess(RESULTS.sign);
    expect(jest.mocked(vaultNotify.success).mock.calls).toEqual([
      ["Your copy is on the market.", "Listed"],
      ["You got 50 dust.", "Broken down"],
      ["Copy #4 is now Foil.", "Fused"],
      ["Your inscription travels with this copy.", "Signed"],
    ]);
  });
});

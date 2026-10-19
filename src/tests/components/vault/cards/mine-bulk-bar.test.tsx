import React, { useRef, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("~/hooks/cards/useCopyActions", () => ({ useCopyActions: jest.fn() }));
jest.mock("~/hooks/cards/useSheetEconomy", () => ({ useEconomyNumbers: jest.fn() }));
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));

import { useCopyActions } from "~/hooks/cards/useCopyActions";
import { useEconomyNumbers } from "~/hooks/cards/useSheetEconomy";
import { CARD_ECONOMY_DEFAULTS } from "~/lib/cards/economy-config";
import type { MineRow } from "~/lib/cards/hub/mine";
import {
  MineBulkBar,
  selectedCopyOf,
  type SelectedCopy,
} from "~/components/vault/cards/MineBulkBar";

const pick = (id: string, over: Partial<SelectedCopy> = {}): SelectedCopy => ({
  ownershipId: id,
  cardId: "c1",
  title: "Aurelia",
  value: 100,
  rarity: "RARE",
  finish: "STANDARD",
  importDiscounted: false,
  inscription: null,
  isLocked: false,
  isBound: false,
  ...over,
});
const many = (n: number) => Array.from({ length: n }, (_, i) => pick(`o${i}`));

type Done = { onSuccess?: () => void };
let actions: Record<"breakDown" | "fuse" | "listMany", { mutate: jest.Mock; isPending: boolean }>;

beforeEach(() => {
  actions = {
    breakDown: { mutate: jest.fn(), isPending: false },
    fuse: { mutate: jest.fn(), isPending: false },
    listMany: { mutate: jest.fn(), isPending: false },
  };
  jest.mocked(useCopyActions).mockReturnValue(actions as never);
  jest
    .mocked(useEconomyNumbers)
    .mockReturnValue({ data: { economy: CARD_ECONOMY_DEFAULTS, feeRatePct: 10 } } as never);
});

const bar = (copies: SelectedCopy[], onDone = jest.fn()) =>
  render(<MineBulkBar copies={copies} onAddToShowcase={jest.fn()} onDone={onDone} />);

describe("MineBulkBar", () => {
  it("fuses exactly three copies of one card at one finish", () => {
    bar([pick("a"), pick("b"), pick("c")]);
    fireEvent.click(screen.getByRole("button", { name: "Fuse 3" }));
    expect(screen.getByText("Fuse 3 Standard copies into one Foil?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fuse" }));
    expect(actions.fuse.mutate).toHaveBeenCalledWith(
      { ownershipIds: ["a", "b", "c"] },
      expect.anything()
    );
  });

  it("hides fuse for a mixed selection and names the dust a break down gives", () => {
    bar([pick("a"), pick("b", { cardId: "c2", rarity: "COMMON" })]);
    expect(screen.queryByRole("button", { name: /Fuse/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Break down 2" }));
    expect(screen.getByText("Break down 2 copies for 55 dust?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Break down" }));
    expect(actions.breakDown.mutate).toHaveBeenCalledWith(
      { ownershipIds: ["a", "b"] },
      expect.anything()
    );
  });

  it("prices an imported copy's dust at its share, and says one copy as one", () => {
    bar([pick("a", { importDiscounted: true })]);
    fireEvent.click(screen.getByRole("button", { name: "Break down 1" }));
    expect(screen.getByText("Break down 1 copy for 12 dust?")).toBeTruthy();
  });

  it("explains why the selection can't be broken down, and keeps Add to showcase", () => {
    bar([pick("a"), pick("b", { inscription: "gg" })]);
    const breakDown = screen.getByRole("button", { name: "Break down 2" });
    expect(breakDown.hasAttribute("disabled")).toBe(true);
    const reason = screen.getByText("Signed copies can't be broken down.");
    expect(breakDown.getAttribute("aria-describedby")).toBe(reason.id);
    // The reason is announced as the selection changes.
    expect(reason.closest("[aria-live]")?.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByRole("button", { name: "Add to showcase" })).toBeTruthy();
    // A signed copy may still be listed.
    expect(screen.getByRole("button", { name: "List 2" })).toBeEnabled();
  });

  it("offers nothing but Done with no selection", () => {
    bar([]);
    expect(screen.getByText("0 selected")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Break down/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /List/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Add to showcase" }).hasAttribute("disabled")).toBe(
      true
    );
  });

  it("announces the count in the bar", () => {
    bar([pick("a"), pick("b")]);
    const group = screen.getByRole("group", { name: "Selected cards" });
    expect(screen.getByText("2 selected").getAttribute("aria-live")).toBe("polite");
    expect(group).toContainElement(screen.getByText("2 selected"));
  });

  it("offers a bound copy for neither sale nor fusion, and says why it can't be broken down", () => {
    bar([pick("a", { isBound: true }), pick("b", { isBound: true }), pick("c", { isBound: true })]);
    expect(screen.queryByRole("button", { name: /List/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Fuse/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Break down 3" })).toBeDisabled();
    expect(screen.getByText("Bound cards can't be broken down.")).toBeTruthy();
  });

  it("offers a locked copy for neither sale nor fusion, and says why it can't be broken down", () => {
    bar([pick("a", { isLocked: true }), pick("b"), pick("c")]);
    expect(screen.queryByRole("button", { name: /List/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Fuse/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Break down 3" })).toBeDisabled();
    expect(
      screen.getByText("A copy that is listed or in a trade can't be broken down.")
    ).toBeTruthy();
  });

  it("does not fuse past Holo, though Holo copies still break down", () => {
    bar([
      pick("a", { finish: "HOLO" }),
      pick("b", { finish: "HOLO" }),
      pick("c", { finish: "HOLO" }),
    ]);
    expect(screen.queryByRole("button", { name: /Fuse/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Break down 3" })).toBeEnabled();
  });

  it("keeps a retired copy, worth nothing, listable and breakable, from 1 IxC", () => {
    bar([pick("a", { value: 0 })]);
    expect(screen.getByRole("button", { name: "Break down 1" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "List 1" }));
    expect(screen.getByLabelText("Price for Aurelia in IxC")).toHaveValue("1");
  });

  it("lists at most 20 and breaks down at most 100 copies at a time, and says so", () => {
    const first = bar(many(20));
    expect(screen.getByRole("button", { name: "List 20" })).toBeEnabled();
    first.unmount();
    const second = bar(many(100));
    expect(screen.getByRole("button", { name: "Break down 100" })).toBeEnabled();
    second.unmount();
    const { unmount } = bar(many(21));
    expect(screen.getByRole("button", { name: "List 21" })).toBeDisabled();
    expect(screen.getByText("List up to 20 copies at a time.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Break down 21" })).toBeEnabled();
    unmount();
    bar(many(101));
    expect(screen.getByRole("button", { name: "Break down 101" })).toBeDisabled();
    expect(screen.getByText("Break down up to 100 copies at a time.")).toBeTruthy();
  });

  it("waits for the economy numbers before offering the workshop actions", () => {
    jest.mocked(useEconomyNumbers).mockReturnValue({ data: undefined } as never);
    bar([pick("a")]);
    expect(screen.queryByRole("button", { name: /Break down/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Add to showcase" })).toBeEnabled();
  });

  it("keeps the dialog and the selection when a break down does not go through", () => {
    const onDone = jest.fn();
    bar([pick("a")], onDone);
    fireEvent.click(screen.getByRole("button", { name: "Break down 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Break down" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("ends select mode once a burn goes through, and gives focus to the place the pane names", async () => {
    actions.breakDown.mutate.mockImplementation((_input: object, done: Done) => done.onSuccess?.());
    function Pane() {
      const after = useRef<HTMLButtonElement>(null);
      const [selecting, setSelecting] = useState(true);
      return (
        <>
          <button ref={after} type="button">
            Select
          </button>
          {selecting && (
            <MineBulkBar
              copies={[pick("a")]}
              onAddToShowcase={jest.fn()}
              onDone={() => setSelecting(false)}
              focusAfter={after}
            />
          )}
        </>
      );
    }
    render(<Pane />);
    fireEvent.click(screen.getByRole("button", { name: "Break down 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Break down" }));
    expect(screen.queryByRole("group", { name: "Selected cards" })).toBeNull();
    await waitFor(() => expect(screen.getByRole("button", { name: "Select" })).toHaveFocus());
  });

  it("ends select mode once a fusion goes through", () => {
    actions.fuse.mutate.mockImplementation((_input: object, done: Done) => done.onSuccess?.());
    const onDone = jest.fn();
    bar([pick("a"), pick("b"), pick("c")], onDone);
    fireEvent.click(screen.getByRole("button", { name: "Fuse 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Fuse" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("selectedCopyOf", () => {
  const row = (over: Partial<MineRow> = {}): MineRow => ({
    face: {
      cardId: "c1",
      title: "Aurelia",
      rarity: "RARE",
      cardType: "LORE",
      realm: { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
      artwork: null,
      silhouette: false,
      number: 1,
      season: null,
      isRetired: false,
      copy: { ownershipId: "o1", finish: "FOIL", serialNumber: 4, level: 1 },
    },
    value: 80,
    copies: 1,
    acquiredAt: new Date("2026-10-01T00:00:00Z"),
    isLocked: false,
    isBound: false,
    inscription: "gg",
    importDiscounted: true,
    inOffer: false,
    ...over,
  });

  it("is the row as the bulk actions judge it", () => {
    expect(selectedCopyOf(row())).toEqual({
      ownershipId: "o1",
      cardId: "c1",
      title: "Aurelia",
      value: 80,
      rarity: "RARE",
      finish: "FOIL",
      importDiscounted: true,
      inscription: "gg",
      isLocked: false,
      isBound: false,
    });
    expect(selectedCopyOf(row({ isBound: true, isLocked: true }))).toMatchObject({
      isBound: true,
      isLocked: true,
    });
  });

  it("counts a copy a pending trade offer names as locked, so it neither fuses nor breaks down", () => {
    const offered = selectedCopyOf(row({ inscription: null, inOffer: true }))!;
    expect(offered.isLocked).toBe(true);
    bar([offered, pick("b", { finish: "FOIL" }), pick("c", { finish: "FOIL" })]);
    expect(screen.queryByRole("button", { name: /Fuse/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /List/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Break down 3" })).toBeDisabled();
    expect(
      screen.getByText("A copy that is listed or in a trade can't be broken down.")
    ).toBeTruthy();
  });

  it("is null for a row without a copy", () => {
    expect(selectedCopyOf(row({ face: { ...row().face, copy: null } }))).toBeNull();
  });
});

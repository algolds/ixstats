import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const invalidate = () => ({ invalidate: jest.fn() });
  const utils = {
    cards: { listMyShowcases: invalidate(), getShowcase: invalidate(), getMyDisplay: invalidate() },
    ixnayid: { getPassport: invalidate() },
  };
  return {
    api: {
      useUtils: () => utils,
      cards: {
        listMine: { useQuery: jest.fn() },
        createShowcase: { useMutation: jest.fn() },
        updateShowcase: { useMutation: jest.fn() },
        addToShowcase: { useMutation: jest.fn() },
      },
    },
  };
});
jest.mock("~/hooks/useDebounce", () => ({ useDebounce: <T,>(value: T) => value }));
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { keepPreviousData } from "@tanstack/react-query";
import { api } from "~/trpc/react";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { SHOWCASE_LIMITS } from "~/lib/cards/face/showcase-limits";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { MinePage, MineRow } from "~/lib/cards/hub/mine";
import { ShowcaseEditorDialog } from "~/components/vault/cards/ShowcaseEditorDialog";
import { ShowcasePickerDialog } from "~/components/vault/cards/ShowcasePickerDialog";
import { failingMutation, fakeMutation } from "~/tests/helpers/fake-mutation";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

// Radix's switch measures itself inside a form.
beforeAll(stubResizeObserver);

const realm = { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false };
const face = (n: number): CardFaceData => ({
  cardId: `c${n}`,
  title: `Card ${n}`,
  rarity: "RARE",
  cardType: "LORE",
  realm,
  artwork: null,
  silhouette: false,
  number: n,
  season: null,
  isRetired: false,
  copy: { ownershipId: `o${n}`, finish: "STANDARD", serialNumber: n, level: 1 },
});
const row = (n: number, isBound = false): MineRow => ({
  face: face(n),
  value: 10,
  copies: 1,
  acquiredAt: new Date("2026-10-01"),
  isLocked: false,
  isBound,
  inscription: null,
  importDiscounted: false,
  inOffer: false,
});
const page = (rows: MineRow[], total = rows.length): MinePage => ({
  rows,
  total,
  nextCursor: null,
  realms: [realm],
  totalCopies: total,
});
const mine = (data: MinePage | undefined, state: Partial<Record<string, boolean>> = {}) =>
  jest
    .mocked(api.cards.listMine.useQuery)
    .mockReturnValue({ data, isLoading: false, isError: false, ...state } as never);

type MutationName = "createShowcase" | "updateShowcase" | "addToShowcase";

const mockMutation = <TInput, TData>(name: MutationName, respond?: (input: TInput) => TData) =>
  fakeMutation(jest.mocked(api.cards[name].useMutation), respond);

const utils = () => api.useUtils().cards;

beforeEach(() => {
  jest.clearAllMocks();
  mockMutation("createShowcase");
  mockMutation("updateShowcase");
  mockMutation("addToShowcase");
  mine(page([]));
});

describe("ShowcaseEditorDialog", () => {
  const editable = {
    id: "s1",
    name: "Best",
    description: "My best",
    isPublic: true,
    pinned: true,
  };
  const openEditor = (showcase: typeof editable | null, onSaved = jest.fn()) => {
    render(
      <ShowcaseEditorDialog
        showcase={showcase}
        onSaved={onSaved}
        trigger={<button type="button">Open editor</button>}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    return { dialog: screen.getByRole("dialog"), onSaved };
  };

  it("makes a new private showcase, then hands back its id", () => {
    const create = mockMutation("createShowcase", () => ({ id: "s9" }));
    const { dialog, onSaved } = openEditor(null);
    expect(within(dialog).getByText("New showcase")).toBeInTheDocument();
    const save = within(dialog).getByRole("button", { name: "Create" });
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "  Shiny  " } });
    expect(within(dialog).getByRole("switch")).not.toBeChecked();
    fireEvent.click(save);
    expect(create).toHaveBeenCalledWith({ name: "Shiny", description: undefined, isPublic: false });
    expect(onSaved).toHaveBeenCalledWith("s9");
    expect(utils().listMyShowcases.invalidate).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("edits every field, and warns that making a pinned showcase private unpins it", () => {
    const update = mockMutation("updateShowcase", () => undefined);
    const { dialog, onSaved } = openEditor(editable);
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Best");
    expect(within(dialog).getByLabelText("Description, optional")).toHaveValue("My best");
    const visible = within(dialog).getByRole("switch", { name: "Other players can see it" });
    expect(visible).toBeChecked();
    expect(within(dialog).queryByText("Making it private unpins it from your wallet.")).toBeNull();
    fireEvent.click(visible);
    const warning = within(dialog).getByText("Making it private unpins it from your wallet.");
    expect(visible).toHaveAttribute("aria-describedby", warning.id);
    fireEvent.change(within(dialog).getByLabelText("Description, optional"), {
      target: { value: " " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(update).toHaveBeenCalledWith({
      showcaseId: "s1",
      name: "Best",
      description: undefined,
      isPublic: false,
    });
    expect(onSaved).toHaveBeenCalledWith("s1");
    expect(utils().getShowcase.invalidate).toHaveBeenCalledWith({ showcaseId: "s1" });
    expect(utils().getMyDisplay.invalidate).toHaveBeenCalled();
  });
  it("says what went wrong and stays open", () => {
    failingMutation(
      jest.mocked(api.cards.createShowcase.useMutation),
      "You can keep up to 20 showcases."
    );
    const { dialog, onSaved } = openEditor(null);
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "One more" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    expect(vaultNotify.error).toHaveBeenCalledWith("You can keep up to 20 showcases.");
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("ShowcasePickerDialog", () => {
  const openPicker = (existing: ReadonlySet<string> = new Set(), focusAfterAdd = jest.fn()) => {
    render(
      <ShowcasePickerDialog
        showcaseId="s1"
        existing={existing}
        focusAfterAdd={focusAfterAdd}
        trigger={<button type="button">Open picker</button>}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Open picker" }));
    return screen.getByRole("dialog");
  };

  it("picks copies from Mine, bound ones included, and leaves out those already in", () => {
    const add = mockMutation("addToShowcase", () => ({ added: 2 }));
    mine(page([row(1), row(2, true), row(3)]));
    const dialog = openPicker(new Set(["o1"]));
    expect(api.cards.listMine.useQuery).toHaveBeenCalledWith(
      { search: undefined, sort: "acquired", limit: 120 },
      { placeholderData: keepPreviousData }
    );
    expect(within(dialog).queryByRole("button", { name: /Card 1,/ })).toBeNull();
    expect(within(dialog).queryByText(/Showing your newest/)).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Card 2, Rare, Standard, Ixnay" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Card 3, Rare, Standard, Ixnay" }));
    expect(
      within(dialog).getByRole("button", { name: "Card 2, Rare, Standard, Ixnay" })
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add 2 cards" }));
    expect(add).toHaveBeenCalledWith({ showcaseId: "s1", ownershipIds: ["o2", "o3"] });
    expect(utils().getShowcase.invalidate).toHaveBeenCalledWith({ showcaseId: "s1" });
    expect(utils().getMyDisplay.invalidate).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("adds nothing until a card is picked, and a second press takes the pick back", () => {
    mine(page([row(1)]));
    const dialog = openPicker();
    expect(within(dialog).getByRole("button", { name: "Add 0 cards" })).toBeDisabled();
    const card = within(dialog).getByRole("button", { name: "Card 1, Rare, Standard, Ixnay" });
    fireEvent.click(card);
    expect(within(dialog).getByRole("button", { name: "Add 1 card" })).toBeEnabled();
    fireEvent.click(card);
    expect(within(dialog).getByRole("button", { name: "Add 0 cards" })).toBeDisabled();
  });

  it("searches Mine and keeps the picks made under another search", () => {
    const add = mockMutation("addToShowcase", () => ({ added: 2 }));
    mine(page([row(1)]));
    const dialog = openPicker();
    fireEvent.click(within(dialog).getByRole("button", { name: "Card 1, Rare, Standard, Ixnay" }));
    mine(page([row(2)]));
    fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search your cards" }), {
      target: { value: " card 2 " },
    });
    expect(api.cards.listMine.useQuery).toHaveBeenLastCalledWith(
      { search: "card 2", sort: "acquired", limit: 120 },
      { placeholderData: keepPreviousData }
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Card 2, Rare, Standard, Ixnay" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add 2 cards" }));
    expect(add).toHaveBeenCalledWith({ showcaseId: "s1", ownershipIds: ["o1", "o2"] });
  });
  it("holds the picks to the room left in the showcase", () => {
    mine(page([row(101), row(102)]));
    const existing = new Set(
      Array.from({ length: SHOWCASE_LIMITS.items - 1 }, (_, i) => `o${i + 1}`)
    );
    const dialog = openPicker(existing);
    expect(within(dialog).getByText("Room for 1 more card.")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Card 101, Rare, Standard, Ixnay" })
    );
    expect(within(dialog).getByRole("button", { name: "Add 1 card" })).toBeEnabled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Card 102, Rare, Standard, Ixnay" })
    );
    expect(within(dialog).getByRole("button", { name: "Add 2 cards" })).toBeDisabled();
    expect(
      within(dialog).getByText("Too many picked. This showcase has room for 1 more card.")
    ).toBeInTheDocument();
  });

  it.each([
    ["no cards at all", page([]), "", "You have no cards yet"],
    ["no match for the search", page([]), "zzz", "No cards match this search"],
    ["every card already in", page([row(1)]), "", "These cards are already in this showcase"],
  ])("says when there is nothing to pick: %s", (_label, data, search, title) => {
    mine(data);
    const dialog = openPicker(new Set(["o1"]));
    if (search) {
      fireEvent.change(within(dialog).getByRole("searchbox"), { target: { value: search } });
    }
    expect(within(dialog).getByText(title)).toBeInTheDocument();
  });
  it("says what went wrong and keeps the picks", () => {
    failingMutation(
      jest.mocked(api.cards.addToShowcase.useMutation),
      "A card you picked is no longer yours."
    );
    mine(page([row(1)]));
    const dialog = openPicker();
    fireEvent.click(within(dialog).getByRole("button", { name: "Card 1, Rare, Standard, Ixnay" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add 1 card" }));
    expect(vaultNotify.error).toHaveBeenCalledWith("A card you picked is no longer yours.");
    expect(within(dialog).getByRole("button", { name: "Add 1 card" })).toBeEnabled();
  });
});

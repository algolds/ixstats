import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const invalidate = () => ({ invalidate: jest.fn() });
  const utils = {
    cards: { listMyShowcases: invalidate(), getShowcase: invalidate(), getMyDisplay: invalidate() },
    ixnayid: { getPassport: invalidate() },
  };
  const mutation = () => ({ useMutation: jest.fn() });
  return {
    api: {
      useUtils: () => utils,
      cards: {
        listMyShowcases: { useQuery: jest.fn() },
        getShowcase: { useQuery: jest.fn() },
        listMine: { useQuery: jest.fn() },
        createShowcase: mutation(),
        updateShowcase: mutation(),
        deleteShowcase: mutation(),
        addToShowcase: mutation(),
        removeFromShowcase: mutation(),
        pinShowcase: mutation(),
      },
    },
  };
});
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));

import { skipToken } from "@tanstack/react-query";
import { api } from "~/trpc/react";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { SHOWCASE_LIMITS } from "~/lib/cards/face/showcase-limits";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { MinePage } from "~/lib/cards/hub/mine";
import type { ShowcaseSummary, ShowcaseView } from "~/lib/cards/hub/showcases";
import { SetsPane } from "~/components/vault/cards/SetsPane";
import { fakeMutation } from "~/tests/helpers/fake-mutation";

const realm = { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false };
const face = (n: number, overrides: Partial<CardFaceData> = {}): CardFaceData => ({
  cardId: `c${n}`,
  title: n === 1 ? "Caphiria" : `Card ${n}`,
  rarity: "EPIC",
  cardType: "LORE",
  realm,
  artwork: `https://art/c${n}.png`,
  silhouette: false,
  number: n,
  season: null,
  isRetired: false,
  copy: { ownershipId: `o${n}`, finish: "STANDARD", serialNumber: n, level: 1 },
  ...overrides,
});

const summary = (overrides: Partial<ShowcaseSummary> = {}): ShowcaseSummary => ({
  id: "s1",
  name: "Best of Ixnay",
  description: null,
  isPublic: true,
  pinned: false,
  itemCount: 3,
  cover: face(1),
  ...overrides,
});

const view = (overrides: Partial<ShowcaseView> = {}): ShowcaseView => ({
  id: "s1",
  name: "Best",
  description: null,
  isPublic: true,
  pinned: false,
  ownerName: "@me",
  isOwner: true,
  items: [{ itemId: "i1", face: face(1) }],
  ...overrides,
});

type MutationName =
  | "createShowcase"
  | "updateShowcase"
  | "deleteShowcase"
  | "addToShowcase"
  | "removeFromShowcase"
  | "pinShowcase";

const mockMutation = <TInput, TData>(name: MutationName, respond?: (input: TInput) => TData) =>
  fakeMutation(jest.mocked(api.cards[name].useMutation), respond);
const utils = () => api.useUtils().cards;

const listed = (data: ShowcaseSummary[]) =>
  jest
    .mocked(api.cards.listMyShowcases.useQuery)
    .mockReturnValue({ data, isLoading: false, isError: false } as never);
const shown = (
  data: ShowcaseView | null | undefined,
  state: Partial<Record<string, boolean>> = {}
) =>
  jest
    .mocked(api.cards.getShowcase.useQuery)
    .mockReturnValue({ data, isLoading: false, isError: false, ...state } as never);

const renderPane = (showcaseId: string | null = null) => {
  const onOpenCard = jest.fn();
  const onShowcaseChange = jest.fn();
  const pane = (id: string | null) => (
    <SetsPane onOpenCard={onOpenCard} showcaseId={id} onShowcaseChange={onShowcaseChange} />
  );
  const { rerender } = render(pane(showcaseId));
  return { onOpenCard, onShowcaseChange, showPane: (id: string | null) => rerender(pane(id)) };
};
const tile = "Open Best of Ixnay, 3 cards, public";

beforeEach(() => {
  jest.clearAllMocks();
  for (const name of [
    "createShowcase",
    "updateShowcase",
    "deleteShowcase",
    "addToShowcase",
    "removeFromShowcase",
    "pinShowcase",
  ] as const) {
    mockMutation(name);
  }
  listed([]);
  shown(undefined);
  jest
    .mocked(api.cards.listMine.useQuery)
    .mockReturnValue({ data: undefined, isLoading: true, isError: false } as never);
});

describe("SetsPane, the list", () => {
  it("lists showcases, marks the pinned one, and keeps a place for set binders", () => {
    listed([summary({ pinned: true, itemCount: 12 })]);
    const { onShowcaseChange } = renderPane();
    expect(screen.getByText("Pinned")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByText("12 cards")).toBeInTheDocument();
    expect(screen.getByText("No set binders yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Best of Ixnay, 12 cards, pinned" }));
    expect(onShowcaseChange).toHaveBeenCalledWith("s1");
  });

  it("asks for no showcase while the list shows", () => {
    renderPane();
    expect(api.cards.getShowcase.useQuery).toHaveBeenCalledWith(skipToken);
  });

  it("marks a private showcase, and draws an empty one face down", () => {
    listed([summary({ isPublic: false, itemCount: 0, cover: null })]);
    renderPane();
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("0 cards")).toBeInTheDocument();
    const empty = screen.getByRole("button", { name: "Open Best of Ixnay, 0 cards, private" });
    expect(empty.querySelector(".card-face-down")).not.toBeNull();
  });

  it("says what to do when there are no showcases yet", () => {
    renderPane();
    expect(screen.getByText("No showcases yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New showcase" })).toBeEnabled();
  });

  it("stops new showcases at the limit, and says why", () => {
    listed(
      Array.from({ length: SHOWCASE_LIMITS.perPlayer }, (_, i) =>
        summary({ id: `s${i}`, name: `Showcase ${i}` })
      )
    );
    renderPane();
    expect(screen.getByRole("button", { name: "New showcase" })).toBeDisabled();
    expect(
      screen.getByText(`You have ${SHOWCASE_LIMITS.perPlayer} showcases, the most you can keep.`)
    ).toBeInTheDocument();
  });

  it("offers to try again when the list did not load", () => {
    const refetch = jest.fn();
    jest
      .mocked(api.cards.listMyShowcases.useQuery)
      .mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch } as never);
    renderPane();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe("SetsPane, one showcase", () => {
  it("asks for the showcase in the address, and waits for it", () => {
    shown(undefined, { isLoading: true });
    renderPane("s1");
    expect(api.cards.getShowcase.useQuery).toHaveBeenCalledWith({ showcaseId: "s1" });
    expect(screen.queryByText("Showcases")).toBeNull();
  });

  it("lets the owner pin, remove a card and add cards", () => {
    const pin = mockMutation("pinShowcase", () => ({ pinned: true }));
    const remove = mockMutation("removeFromShowcase", () => undefined);
    shown(view());
    renderPane("s1");
    fireEvent.click(screen.getByRole("button", { name: "Pin to wallet" }));
    expect(pin).toHaveBeenCalledWith({ showcaseId: "s1", pinned: true });
    // The pin moved off whichever showcase held it, so every cached showcase reads again.
    expect(utils().getShowcase.invalidate).toHaveBeenCalledWith();
    expect(utils().listMyShowcases.invalidate).toHaveBeenCalled();
    expect(utils().getMyDisplay.invalidate).toHaveBeenCalled();
    // The Passport's highlight is the pinned showcase too.
    expect(api.useUtils().ixnayid.getPassport.invalidate).toHaveBeenCalled();
    jest.clearAllMocks();
    fireEvent.click(screen.getByRole("button", { name: "Remove Caphiria" }));
    expect(remove).toHaveBeenCalledWith({ showcaseId: "s1", ownershipId: "o1" });
    expect(utils().getShowcase.invalidate).toHaveBeenCalledWith({ showcaseId: "s1" });
    expect(screen.getByRole("button", { name: "Add cards" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByText("By @me")).toBeNull();
  });

  it("unpins a pinned showcase", () => {
    const pin = mockMutation("pinShowcase", () => ({ pinned: false }));
    shown(view({ pinned: true }));
    renderPane("s1");
    expect(screen.getByText("Pinned")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unpin from wallet" }));
    expect(pin).toHaveBeenCalledWith({ showcaseId: "s1", pinned: false });
    expect(vaultNotify.error).not.toHaveBeenCalled();
    expect(utils().getShowcase.invalidate).toHaveBeenCalledWith();
    expect(utils().getMyDisplay.invalidate).toHaveBeenCalled();
  });

  it("says why a private showcase cannot be pinned", () => {
    shown(view({ isPublic: false }));
    renderPane("s1");
    const pin = screen.getByRole("button", { name: "Pin to wallet" });
    expect(pin).toBeDisabled();
    const reason = screen.getByText(
      "Only a public showcase can be pinned. Make it public in Edit."
    );
    expect(pin).toHaveAttribute("aria-describedby", reason.id);
    expect(screen.getByText("Private")).toBeInTheDocument();
  });

  it("says so when a pin does not land", () => {
    mockMutation("pinShowcase", () => ({ pinned: false }));
    shown(view());
    renderPane("s1");
    fireEvent.click(screen.getByRole("button", { name: "Pin to wallet" }));
    expect(vaultNotify.error).toHaveBeenCalledWith(
      "Not pinned. Make the showcase public before you pin it."
    );
  });

  it("stops adding to a full showcase, and says why", () => {
    const items = Array.from({ length: SHOWCASE_LIMITS.items }, (_, i) => ({
      itemId: `i${i}`,
      face: face(i + 1),
    }));
    shown(view({ items }));
    renderPane("s1");
    const add = screen.getByRole("button", { name: "Add cards" });
    expect(add).toBeDisabled();
    const reason = screen.getByText(
      `This showcase is full. It holds up to ${SHOWCASE_LIMITS.items} cards.`
    );
    expect(add).toHaveAttribute("aria-describedby", reason.id);
  });

  it("opens the owner's cards from the showcase", () => {
    shown(view());
    const { onOpenCard } = renderPane("s1");
    fireEvent.click(screen.getByRole("button", { name: "Caphiria, Epic, Standard, Ixnay" }));
    expect(onOpenCard).toHaveBeenCalledWith("c1", { kind: "showcase", id: "s1" });
  });

  it("opens another player's showcase cards with their art, read only", () => {
    shown(
      view({ id: "s2", name: "Ann's", description: "Mine", ownerName: "Caphiria", isOwner: false })
    );
    const { onOpenCard } = renderPane("s2");
    // The server names the owner (a handle, or the nation of a player with none); the view adds nothing.
    expect(screen.getByText("By Caphiria")).toBeInTheDocument();
    expect(screen.getByText("Mine")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pin/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add cards" })).toBeNull();
    expect(screen.queryByText("Public")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Caphiria, Epic, Standard, Ixnay" }));
    expect(onOpenCard).toHaveBeenCalledWith("c1", { kind: "showcase", id: "s2" });
  });

  it("calls another player's showcase owner a player when the server has no name for them", () => {
    shown(view({ id: "s2", ownerName: null, isOwner: false }));
    renderPane("s2");
    expect(screen.getByText("By a player")).toBeInTheDocument();
  });

  it("draws a retired copy with the placeholder face", () => {
    shown(view({ items: [{ itemId: "i1", face: face(1, { isRetired: true, artwork: null }) }] }));
    renderPane("s1");
    const card = screen.getByRole("button", { name: "Caphiria, Epic, Standard, Ixnay, retired" });
    expect(card.querySelector("img")).toBeNull();
    expect(within(card).getByText("Retired")).toBeInTheDocument();
  });

  it("offers the owner of an empty showcase one way to add cards", () => {
    shown(view({ items: [] }));
    renderPane("s1");
    expect(screen.getByText("No cards in this showcase yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add cards" })).toHaveLength(1);
  });

  it("gives the showcase's heading focus after an add, which may have disabled Add cards", async () => {
    const add = mockMutation("addToShowcase", () => ({ added: 1 }));
    const mine: MinePage = {
      rows: [
        {
          face: face(2),
          value: 1,
          copies: 1,
          acquiredAt: new Date(),
          isLocked: false,
          isBound: false,
        },
      ],
      total: 1,
      nextCursor: null,
      realms: [realm],
      totalCopies: 1,
    };
    jest
      .mocked(api.cards.listMine.useQuery)
      .mockReturnValue({ data: mine, isLoading: false, isError: false } as never);
    shown(view());
    renderPane("s1");
    fireEvent.click(screen.getByRole("button", { name: "Add cards" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Card 2, Epic, Standard, Ixnay" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add 1 card" }));
    expect(add).toHaveBeenCalledWith({ showcaseId: "s1", ownershipIds: ["o2"] });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Best" })).toHaveFocus());
  });

  it("names each Remove after its own copy when two share a title", () => {
    const remove = mockMutation("removeFromShowcase");
    const second = face(1, {
      copy: { ownershipId: "o9", finish: "FOIL", serialNumber: 9, level: 1 },
    });
    shown(
      view({
        items: [
          { itemId: "i1", face: face(1) },
          { itemId: "i9", face: second },
        ],
      })
    );
    renderPane("s1");
    expect(screen.queryByRole("button", { name: "Remove Caphiria" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove Caphiria, Epic, Foil, Ixnay, #9" }));
    expect(remove).toHaveBeenCalledWith({ showcaseId: "s1", ownershipId: "o9" });
    expect(
      screen.getByRole("button", { name: "Remove Caphiria, Epic, Standard, Ixnay, #1" })
    ).toBeInTheDocument();
  });

  it("goes back to the list, and focus goes to its heading", () => {
    shown(view());
    const { onShowcaseChange, showPane } = renderPane("s1");
    fireEvent.click(screen.getByRole("button", { name: "Sets" }));
    expect(onShowcaseChange).toHaveBeenCalledWith(null);
    showPane(null);
    expect(screen.getByRole("heading", { name: "Showcases" })).toHaveFocus();
  });

  it("takes no focus on the first screen, and gives a showcase's heading focus when it opens", () => {
    shown(view({ id: "s9", name: "Shiny" }));
    const { showPane } = renderPane(null);
    expect(document.body).toHaveFocus();
    showPane("s9");
    expect(screen.getByRole("heading", { name: "Shiny" })).toHaveFocus();
  });

  it("gives an opened showcase's heading no focus on the first screen", () => {
    shown(view());
    renderPane("s1");
    expect(screen.getByRole("heading", { name: "Best" })).not.toHaveFocus();
  });

  it("deletes the showcase after asking, then goes back to the list", () => {
    const destroy = mockMutation("deleteShowcase", () => undefined);
    shown(view());
    const { onShowcaseChange, showPane } = renderPane("s1");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByText("Your cards stay in Mine. Only the showcase goes.")
    ).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete showcase" }));
    expect(destroy).toHaveBeenCalledWith({ showcaseId: "s1" });
    expect(onShowcaseChange).toHaveBeenCalledWith(null);
    showPane(null);
    expect(screen.getByRole("heading", { name: "Showcases" })).toHaveFocus();
    expect(utils().listMyShowcases.invalidate).toHaveBeenCalled();
  });
});

describe("SetsPane, a showcase it cannot show", () => {
  it.each([
    ["private, gone or an old name link", { data: null }],
    ["a showcase that did not load", { data: undefined, isError: true }],
  ])("shows the list quietly for %s", (_label, state) => {
    jest
      .mocked(api.cards.getShowcase.useQuery)
      .mockReturnValue({ isLoading: false, isError: false, ...state } as never);
    listed([summary()]);
    const { onShowcaseChange } = renderPane("best-of-ixnay");
    expect(screen.getByRole("heading", { name: "Showcases" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: tile })).toBeInTheDocument();
    expect(vaultNotify.error).not.toHaveBeenCalled();
    // The address lets go of it, so pressing its tile again asks for it afresh.
    expect(onShowcaseChange).toHaveBeenCalledTimes(1);
    expect(onShowcaseChange).toHaveBeenCalledWith(null);
  });

  it("takes no focus when an address's showcase turns out unknown on the first screen", () => {
    shown(undefined, { isLoading: true });
    const { showPane } = renderPane("best-of-ixnay");
    shown(null);
    showPane("best-of-ixnay");
    showPane(null);
    expect(screen.getByRole("heading", { name: "Showcases" })).not.toHaveFocus();
  });

  it("keeps the address while the showcase loads, and once it shows", () => {
    shown(undefined, { isLoading: true });
    const { onShowcaseChange, showPane } = renderPane("s1");
    shown(view());
    showPane("s1");
    expect(screen.getByRole("heading", { name: "Best" })).toBeInTheDocument();
    expect(onShowcaseChange).not.toHaveBeenCalled();
  });
});

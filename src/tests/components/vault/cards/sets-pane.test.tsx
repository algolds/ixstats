import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const invalidate = () => ({ invalidate: jest.fn() });
  const utils = {
    cards: { listMyShowcases: invalidate(), getShowcase: invalidate(), getMyDisplay: invalidate() },
  };
  const mutation = () => ({ useMutation: jest.fn() });
  return {
    api: {
      useUtils: () => utils,
      cards: {
        listMyShowcases: { useQuery: jest.fn() },
        getShowcase: { useQuery: jest.fn() },
        listMine: { useQuery: jest.fn(() => ({ data: undefined, isLoading: true })) },
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
import type { ShowcaseSummary, ShowcaseView } from "~/lib/cards/hub/showcases";
import { SetsPane } from "~/components/vault/cards/SetsPane";

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
  ownerHandle: "me",
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

interface MutationOptions<TData, TInput> {
  onSuccess?: (data: TData, input: TInput) => void;
  onError?: (error: { message: string }) => void;
}

/** Stands in for the server: `mutate` records its input, then answers with what `respond` returns, if anything. */
function mockMutation<TInput, TData>(name: MutationName, respond?: (input: TInput) => TData) {
  const mutate = jest.fn<void, [TInput]>();
  jest.mocked(api.cards[name].useMutation).mockImplementation(((
    options: MutationOptions<TData, TInput> = {}
  ) => ({
    mutate: (input: TInput) => {
      mutate(input);
      if (respond) options.onSuccess?.(respond(input), input);
    },
    isPending: false,
  })) as never);
  return mutate;
}

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
  render(
    <SetsPane onOpenCard={onOpenCard} showcaseId={showcaseId} onShowcaseChange={onShowcaseChange} />
  );
  return { onOpenCard, onShowcaseChange };
};

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
});

describe("SetsPane, the list", () => {
  it("lists showcases, marks the pinned one, and keeps a place for set binders", () => {
    listed([summary({ pinned: true })]);
    const { onShowcaseChange } = renderPane();
    expect(screen.getByText("Pinned")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByText("3 cards")).toBeInTheDocument();
    expect(screen.getByText("No set binders yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Best of Ixnay" }));
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
    const tile = screen.getByRole("button", { name: "Open Best of Ixnay" });
    expect(tile.querySelector(".card-face-down")).not.toBeNull();
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
    const pin = mockMutation("pinShowcase");
    const remove = mockMutation("removeFromShowcase");
    shown(view());
    renderPane("s1");
    fireEvent.click(screen.getByRole("button", { name: "Pin to wallet" }));
    expect(pin).toHaveBeenCalledWith({ showcaseId: "s1", pinned: true });
    fireEvent.click(screen.getByRole("button", { name: "Remove Caphiria" }));
    expect(remove).toHaveBeenCalledWith({ showcaseId: "s1", ownershipId: "o1" });
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
    expect(api.useUtils().cards.getMyDisplay.invalidate).toHaveBeenCalled();
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
      view({ id: "s2", name: "Ann's", description: "Mine", ownerHandle: "ann", isOwner: false })
    );
    const { onOpenCard } = renderPane("s2");
    expect(screen.getByText("By @ann")).toBeInTheDocument();
    expect(screen.getByText("Mine")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pin/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add cards" })).toBeNull();
    expect(screen.queryByText("Public")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Caphiria, Epic, Standard, Ixnay" }));
    expect(onOpenCard).toHaveBeenCalledWith("c1", { kind: "showcase", id: "s2" });
  });

  it("draws a retired copy with the placeholder face", () => {
    shown(view({ items: [{ itemId: "i1", face: face(1, { isRetired: true, artwork: null }) }] }));
    renderPane("s1");
    const card = screen.getByRole("button", { name: "Caphiria, Epic, Standard, Ixnay, retired" });
    expect(card.querySelector("img")).toBeNull();
    expect(within(card).getByText("Retired")).toBeInTheDocument();
  });

  it("says when a showcase has no cards yet", () => {
    shown(view({ items: [] }));
    renderPane("s1");
    expect(screen.getByText("No cards in this showcase yet")).toBeInTheDocument();
  });

  it("goes back to the list", () => {
    shown(view());
    const { onShowcaseChange } = renderPane("s1");
    fireEvent.click(screen.getByRole("button", { name: "Sets" }));
    expect(onShowcaseChange).toHaveBeenCalledWith(null);
  });

  it("deletes the showcase after asking, then goes back to the list", () => {
    const destroy = mockMutation("deleteShowcase", () => undefined);
    shown(view());
    const { onShowcaseChange } = renderPane("s1");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByText("Your cards stay in Mine. Only the showcase goes.")
    ).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete showcase" }));
    expect(destroy).toHaveBeenCalledWith({ showcaseId: "s1" });
    expect(onShowcaseChange).toHaveBeenCalledWith(null);
    expect(api.useUtils().cards.listMyShowcases.invalidate).toHaveBeenCalled();
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
    renderPane("best-of-ixnay");
    expect(screen.getByRole("heading", { name: "Showcases" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Best of Ixnay" })).toBeInTheDocument();
    expect(vaultNotify.error).not.toHaveBeenCalled();
  });
});

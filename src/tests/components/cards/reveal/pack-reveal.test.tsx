import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const invalidateMyPacks = jest.fn();
  return {
    api: {
      useUtils: () => ({ cardPacks: { getMyPacks: { invalidate: invalidateMyPacks } } }),
      cardPacks: { openPack: { useMutation: jest.fn() } },
    },
  };
});
jest.mock("~/hooks/useCardsRefresh", () => {
  const refreshCards = jest.fn();
  return { useCardsRefresh: () => refreshCards };
});
jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: jest.fn(() => true),
}));
jest.mock("~/components/cards/pack-opening/PackHolographicCover", () => ({
  PackHolographicCover: () => <div />,
}));
jest.mock("~/components/cards/reveal/reveal-feedback", () => ({ playRevealFeedback: jest.fn() }));
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

import { api } from "~/trpc/react";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { playRevealFeedback } from "~/components/cards/reveal/reveal-feedback";
import { PackReveal } from "~/components/cards/reveal/PackReveal";
import type { CardFaceData } from "~/lib/cards/face/types";

const refreshCards = jest.mocked(useCardsRefresh());
const realm = { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false };
const face = (n: number, rarity: CardFaceData["rarity"]): CardFaceData => ({
  cardId: `c${n}`,
  title: `Card ${n}`,
  rarity,
  cardType: "LORE",
  realm,
  artwork: null,
  silhouette: false,
  number: n,
  season: null,
  isRetired: false,
  copy: { ownershipId: `o${n}`, finish: "STANDARD", serialNumber: n, level: 1 },
});
const faces = [face(1, "COMMON"), face(2, "EPIC"), face(3, "RARE")];
const pack = { name: "Ixnay starter", packType: "BASIC", guaranteedRarity: null, artwork: null };
const conflict = { message: "This pack has already been opened", data: { code: "CONFLICT" } };

interface OpenPackOptions {
  onSuccess: (data: { faces: CardFaceData[] }) => void;
  onError: (err: { message: string; data?: { code: string } }) => void;
}

type Props = React.ComponentProps<typeof PackReveal>;

/**
 * Renders the reveal. `answer` opens the pack as soon as it is asked (the default), or leaves it pending; `pulled` is
 * what the pack gives.
 */
function setup(
  overrides: Partial<Props> = {},
  { answer = "now", pulled = faces }: { answer?: "now" | "later"; pulled?: CardFaceData[] } = {}
) {
  let options: OpenPackOptions | undefined;
  const mutate = jest.fn(() => {
    if (answer === "now") options?.onSuccess({ faces: pulled });
  });
  jest.mocked(api.cardPacks.openPack.useMutation).mockImplementation(((opts: OpenPackOptions) => {
    options = opts;
    return { mutate, isPending: false };
  }) as never);
  const props: Props = {
    open: true,
    userPackId: "up1",
    pack,
    onOpenCard: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  const view = render(<PackReveal {...props} />);
  return { props, mutate, options: () => options, rerender: view.rerender };
}

const openPack = () => fireEvent.click(screen.getByRole("button", { name: "Open pack" }));
const faceDown = () => screen.queryAllByRole("button", { name: /face down/ });
const press = (key: string) => fireEvent.keyDown(screen.getByRole("dialog"), { key });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useFacetReducedMotion).mockReturnValue(true);
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe("PackReveal", () => {
  it("opens the pack, fans the cards out face down, and turns them one at a time", () => {
    const { mutate } = setup();
    openPack();
    expect(mutate).toHaveBeenCalledWith({ userPackId: "up1" });
    expect(faceDown()).toHaveLength(3);
    press("ArrowRight");
    expect(
      screen.getByRole("img", { name: "Card 1, Common, Standard, Ixnay" })
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Card 1, Common, Standard, Ixnay");
    expect(playRevealFeedback).toHaveBeenLastCalledWith("COMMON", true);
  });

  it("shows Mine, the display and Explore the new copies, and the Store one pack fewer", () => {
    setup();
    openPack();
    expect(refreshCards).toHaveBeenCalledTimes(1);
    expect(api.useUtils().cardPacks.getMyPacks.invalidate).toHaveBeenCalled();
  });
  it("turns the next card on a swipe either way, but not on a short drag", () => {
    setup();
    openPack();
    const dialog = screen.getByRole("dialog");
    // jsdom has no PointerEvent, so a MouseEvent of that type carries the coordinates.
    const swipe = (from: number, to: number) => {
      fireEvent(dialog, new MouseEvent("pointerdown", { bubbles: true, clientX: from }));
      fireEvent(dialog, new MouseEvent("pointerup", { bubbles: true, clientX: to }));
    };
    swipe(200, 190);
    expect(faceDown()).toHaveLength(3);
    swipe(200, 100);
    expect(faceDown()).toHaveLength(2);
    act(() => jest.advanceTimersByTime(1000));
    swipe(100, 200);
    expect(faceDown()).toHaveLength(1);
  });

  it("reveals everything on Esc instead of closing, then sums up with real actions", () => {
    const { props } = setup({ nextPack: { id: "up2", name: "Another" }, onOpenNext: jest.fn() });
    openPack();
    press("Escape");
    expect(props.onClose).not.toHaveBeenCalled();
    expect(faceDown()).toHaveLength(0);
    // One cue for the lot, at the rarest card's strength.
    expect(playRevealFeedback).toHaveBeenCalledTimes(1);
    expect(playRevealFeedback).toHaveBeenCalledWith("EPIC", true);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Best pull: Epic")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Mine" })).toHaveAttribute(
      "href",
      "/vault/cards/mine"
    );
    fireEvent.click(screen.getByRole("button", { name: "Card 2, Epic, Standard, Ixnay" }));
    expect(props.onOpenCard).toHaveBeenCalledWith("c2");
    fireEvent.click(screen.getByRole("button", { name: "Open the next pack" }));
    expect(props.onOpenNext).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(props.onClose).toHaveBeenCalled();
  });
  it("says a pack whose cards could not be shown is open, with its cards in Mine", () => {
    // The open committed but its faces could not be read; a pack always holds cards, so none means that.
    const { props } = setup({}, { pulled: [] });
    openPack();
    expect(screen.getByRole("heading", { name: "Your pack is open" })).toHaveFocus();
    expect(screen.getByText("Its cards are in Mine.")).toBeInTheDocument();
    expect(screen.queryByText("This pack had no cards")).toBeNull();
    expect(screen.queryByRole("list", { name: "Cards pulled" })).toBeNull();
    const mine = screen.getByRole("link", { name: "Go to Mine" });
    expect(mine).toHaveAttribute("href", "/vault/cards/mine");
    fireEvent.click(mine);
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe("PackReveal, opening twice", () => {
  it("opens the pack once on a double tap, and a CONFLICT after the cards keeps the reveal", () => {
    const { mutate, options } = setup({}, { answer: "later" });
    act(() => {
      openPack();
      openPack();
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    act(() => {
      options()?.onSuccess({ faces });
      options()?.onError(conflict);
    });
    expect(screen.queryByText(conflict.message)).toBeNull();
    expect(faceDown()).toHaveLength(3);
  });

  it("says a pack already open is open, with its cards in Mine, and refreshes both lists", () => {
    // Opened in another tab, or by a first try that failed after it committed and was retried.
    const { props, options } = setup({}, { answer: "later" });
    openPack();
    act(() => options()?.onError(conflict));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This pack is already open. Its cards are in Mine."
    );
    expect(screen.queryByRole("button", { name: "Open pack" })).toBeNull();
    expect(refreshCards).toHaveBeenCalledTimes(1);
    expect(api.useUtils().cardPacks.getMyPacks.invalidate).toHaveBeenCalled();
    const mine = screen.getByRole("link", { name: "Go to Mine" });
    expect(mine).toHaveAttribute("href", "/vault/cards/mine");
    fireEvent.click(mine);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("shows a failure of another kind and lets a retry through", () => {
    const { mutate, options } = setup({}, { answer: "later" });
    openPack();
    act(() =>
      options()?.onError({
        message: "Failed to open pack",
        data: { code: "INTERNAL_SERVER_ERROR" },
      })
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to open pack");
    expect(refreshCards).not.toHaveBeenCalled();
    openPack();
    expect(mutate).toHaveBeenCalledTimes(2);
  });
});

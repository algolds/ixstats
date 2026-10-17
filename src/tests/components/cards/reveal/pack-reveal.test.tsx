import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const invalidateMyPacks = jest.fn();
  const invalidateMine = jest.fn();
  return {
    api: {
      useUtils: () => ({
        cardPacks: { getMyPacks: { invalidate: invalidateMyPacks } },
        cards: { listMine: { invalidate: invalidateMine } },
      }),
      cardPacks: { openPack: { useMutation: jest.fn() } },
    },
  };
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
import { playRevealFeedback } from "~/components/cards/reveal/reveal-feedback";
import { PackReveal } from "~/components/cards/reveal/PackReveal";
import type { CardFaceData } from "~/lib/cards/face/types";

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

/** Renders the reveal. `answer` opens the pack as soon as it is asked (the default), or leaves it pending. */
function setup(overrides: Partial<Props> = {}, answer: "now" | "later" = "now") {
  let options: OpenPackOptions | undefined;
  const mutate = jest.fn(() => {
    if (answer === "now") options?.onSuccess({ faces });
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
  render(<PackReveal {...props} />);
  return { props, mutate, options: () => options };
}

const openPack = () => fireEvent.click(screen.getByRole("button", { name: "Open pack" }));
const faceDown = () => screen.queryAllByRole("button", { name: /face down/ });
const press = (key: string) => fireEvent.keyDown(screen.getByRole("dialog"), { key });

beforeEach(() => {
  jest.clearAllMocks();
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

  it("shows Mine the new copies and the Store one pack fewer", () => {
    setup();
    openPack();
    const utils = api.useUtils();
    expect(utils.cards.listMine.invalidate).toHaveBeenCalled();
    expect(utils.cardPacks.getMyPacks.invalidate).toHaveBeenCalled();
  });

  it("holds a rarer card for its beat before the next turns", () => {
    setup();
    openPack();
    fireEvent.click(screen.getByRole("button", { name: "Card 2 of 3, face down" }));
    expect(playRevealFeedback).toHaveBeenLastCalledWith("EPIC", true);
    press("ArrowRight");
    expect(faceDown()).toHaveLength(2);
    act(() => jest.advanceTimersByTime(1000));
    press("ArrowRight");
    expect(faceDown()).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Card 3, Rare, Standard, Ixnay" })).toBeInTheDocument();
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

  it("reveals everything with its button too", () => {
    setup();
    openPack();
    fireEvent.click(screen.getByRole("button", { name: "Reveal all" }));
    expect(faceDown()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("closes on Esc once every card is up", () => {
    const { props } = setup();
    openPack();
    press("Escape");
    press("Escape");
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("skips straight to the summary, with no next pack to offer", () => {
    setup();
    openPack();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByText("Best pull: Epic")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open the next pack" })).toBeNull();
  });
});

describe("PackReveal, opening twice", () => {
  it("opens the pack once on a double tap, and a CONFLICT after the cards keeps the reveal", () => {
    const { mutate, options } = setup({}, "later");
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

  it("shows the error when the pack was opened elsewhere and no cards came, and lets a retry through", () => {
    const { mutate, options } = setup({}, "later");
    openPack();
    act(() => options()?.onError(conflict));
    expect(screen.getByText(conflict.message)).toBeInTheDocument();
    openPack();
    expect(mutate).toHaveBeenCalledTimes(2);
  });
});

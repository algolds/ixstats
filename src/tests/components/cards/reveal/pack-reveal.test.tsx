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
  uncollected: false,
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
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useFacetReducedMotion).mockReturnValue(true);
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe("PackReveal", () => {
  it("shows Mine, the display and Explore the new copies, and the Store one pack fewer", () => {
    setup();
    openPack();
    expect(refreshCards).toHaveBeenCalledTimes(1);
    expect(api.useUtils().cardPacks.getMyPacks.invalidate).toHaveBeenCalled();
  });
});

describe("PackReveal, opening twice", () => {
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
});

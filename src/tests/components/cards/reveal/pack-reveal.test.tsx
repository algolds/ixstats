import { act, fireEvent, render, screen } from "@testing-library/react";
import type { CardFaceData, CardRarity } from "~/lib/cards/face/types";

let mockReduceMotion = false;
let mockOpenSuccess: ((data: { faces: CardFaceData[] }) => void) | null = null;

jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: () => mockReduceMotion,
}));

jest.mock("~/hooks/useCardsRefresh", () => ({
  useCardsRefresh: () => jest.fn(),
}));

jest.mock("~/components/cards/reveal/reveal-feedback", () => ({
  playRevealFeedback: jest.fn(),
}));

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      cardPacks: { getMyPacks: { invalidate: jest.fn() } },
    }),
    cardPacks: {
      openPack: {
        useMutation: (opts: { onSuccess: (data: { faces: CardFaceData[] }) => void }) => {
          mockOpenSuccess = opts.onSuccess;
          return {
            isPending: false,
            mutate: () => {
              opts.onSuccess({ faces: PULLED_FACES });
            },
          };
        },
      },
    },
  },
}));

import { PackReveal } from "~/components/cards/reveal/PackReveal";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";

const REALM = {
  id: "default",
  slug: "ixnay",
  name: "Ixnay",
  crestUrl: null,
  isSystem: false,
};

function makeFace(id: string, title: string, rarity: CardRarity): CardFaceData {
  return {
    cardId: id,
    title,
    rarity,
    cardType: "LORE",
    realm: REALM,
    artwork: null,
    uncollected: false,
    number: 1,
    season: null,
    isRetired: false,
    copy: {
      ownershipId: `own-${id}`,
      finish: "HOLO",
      serialNumber: 1,
      level: 1,
    },
  };
}

const PULLED_FACES: CardFaceData[] = [
  makeFace("c1", "First Dawn", "COMMON"),
  makeFace("c2", "Second Sun", "LEGENDARY"),
  makeFace("c3", "Third Star", "RARE"),
];

function dispatchPointer(
  target: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup",
  coords: { clientX: number; clientY: number; pointerId?: number; button?: number }
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: coords.clientX,
    clientY: coords.clientY,
    button: coords.button ?? 0,
  });
  Object.defineProperty(event, "pointerId", { value: coords.pointerId ?? 1 });
  Object.defineProperty(event, "pointerType", { value: "touch" });
  act(() => {
    target.dispatchEvent(event);
  });
}

beforeEach(() => {
  mockReduceMotion = false;
  mockOpenSuccess = null;
});

describe("PackReveal two-sided CardFlip and mobile velocity pager", () => {
  it("renders two-sided CardFlip slots and turns cards from .card-face-down to CardFace + CardTilt", () => {
    render(
      <PackReveal
        open
        userPackId="up-1"
        pack={{
          name: "Founders Pack",
          packType: "ELITE",
          guaranteedRarity: "EPIC",
          artwork: null,
        }}
        onOpenCard={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(mockOpenSuccess).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));

    const flips = document.querySelectorAll("[data-slot='card-flip']");
    expect(flips).toHaveLength(3);

    // Before turning Card 2, its front face is inert and its face-down button is live
    const secondFlip = flips[1]!;
    expect(secondFlip.querySelector(".card-face-down")).not.toBeNull();
    expect(secondFlip.querySelector("[inert]")).not.toBeNull();

    // Turning Card 2 flips it to the front and activates CardTilt/CardHolo for Legendary rarity
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Card 2 of 3, face down" }));
    });
    expect(secondFlip.querySelector(".card-holo")).not.toBeNull();
  });

  it("tracks horizontal pointer drag with pointer capture and advances on swipe/velocity", () => {
    render(
      <PackReveal
        open
        userPackId="up-2"
        pack={{
          name: "Starter Pack",
          packType: "BASIC",
          guaranteedRarity: null,
          artwork: null,
        }}
        onOpenCard={jest.fn()}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));

    const pager = document.querySelector<HTMLDivElement>("[data-slot='reveal-pager']");
    expect(pager).not.toBeNull();
    const captureSpy = jest.fn();
    pager!.setPointerCapture = captureSpy;
    pager!.hasPointerCapture = () => true;
    pager!.releasePointerCapture = jest.fn();

    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    // Drag left across threshold to advance to card 2
    dispatchPointer(pager!, "pointerdown", { pointerId: 7, clientX: 200, clientY: 100 });
    dispatchPointer(pager!, "pointermove", { pointerId: 7, clientX: 180, clientY: 100 });
    dispatchPointer(pager!, "pointermove", { pointerId: 7, clientX: 110, clientY: 102 });
    dispatchPointer(pager!, "pointerup", { pointerId: 7, clientX: 110, clientY: 102 });

    expect(captureSpy).toHaveBeenCalledWith(7);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });
});

describe("PackHolographicCover CSS theme encapsulation and >=12px type floor", () => {
  it("uses data-pack-theme + .pack-cover-base, hides sm label with sr-only at text-xs, and stays static unless lg", () => {
    const { container, rerender } = render(
      <PackHolographicCover packType="ELITE" guaranteedRarity="LEGENDARY" size="sm" />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-pack-theme", "ELITE");
    expect(root.querySelector(".pack-cover-base")).not.toBeNull();
    expect(root.querySelector(".pack-core-pulse")).not.toBeNull();
    expect(root.className).not.toContain("perspective");
    expect(root.innerHTML).not.toContain("text-[7px]");
    expect(screen.getByText("Cards")).toHaveClass("sr-only");

    // Fullscreen lg enables pointer tilt unless Reduce Motion is on
    rerender(<PackHolographicCover packType="PREMIUM" guaranteedRarity="RARE" size="lg" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("perspective");

    mockReduceMotion = true;
    rerender(<PackHolographicCover packType="EVENT" guaranteedRarity="RARE" size="lg" />);
    expect((container.firstElementChild as HTMLElement).className).not.toContain("perspective");
  });
});

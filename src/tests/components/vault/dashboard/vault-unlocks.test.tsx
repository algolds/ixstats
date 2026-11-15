/** The Vault's achievements deck: its header, and turning it with a mouse drag as a finger swipe does. */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    achievements: {
      getMySummary: { useQuery: jest.fn() },
      getNextUnlock: { useQuery: jest.fn() },
    },
  },
}));

import { api } from "~/trpc/react";
import { VaultUnlocks } from "~/components/vault/sections/dashboard/VaultUnlocks";

const unlock = (key: string, title: string) => ({
  key,
  title,
  rarity: "Rare",
  category: "collection",
  iconUrl: null,
  reward: 100,
});

const WIDTH = 300;
const scrollTo = jest.fn();

beforeAll(() => {
  // jsdom has no PointerEvent: without one, fireEvent's pointer events carry no pointerType or clientX
  class TestPointerEvent extends MouseEvent {
    readonly pointerType: string;
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? "";
      this.pointerId = init.pointerId ?? 0;
    }
  }
  globalThis.PointerEvent ??= TestPointerEvent as typeof PointerEvent;
  // jsdom has no ResizeObserver; the deck only re-measures its slide with it
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => WIDTH,
  });
  HTMLElement.prototype.scrollTo = scrollTo as typeof HTMLElement.prototype.scrollTo;
});

beforeEach(() => {
  scrollTo.mockClear();
  jest.mocked(api.achievements.getMySummary.useQuery).mockReturnValue({
    data: { recent: [unlock("a", "Weekly Winner"), unlock("b", "First Loreward")] },
  } as never);
  jest.mocked(api.achievements.getNextUnlock.useQuery).mockReturnValue({ data: null } as never);
});

const track = () =>
  screen
    .getByRole("region", { name: "Achievements" })
    .querySelector("[data-slot=vault-unlocks-track]")!;

/** A mouse press at `from`, a move to `to` and a release there, in px along the track. */
function drag(from: number, to: number) {
  const el = track() as HTMLElement;
  fireEvent.pointerDown(el, { pointerType: "mouse", button: 0, clientX: from, pointerId: 1 });
  fireEvent.pointerMove(el, { pointerType: "mouse", clientX: to, pointerId: 1 });
  fireEvent.pointerUp(el, { pointerType: "mouse", clientX: to, pointerId: 1 });
}

describe("VaultUnlocks", () => {
  it("heads the deck Achievements, renders semantic category chips, and lists category mastery links", () => {
    jest.mocked(api.achievements.getMySummary.useQuery).mockReturnValue({
      data: {
        unlocked: 5,
        activeTotal: 20,
        categories: [
          { category: "Cards", earned: 3, total: 8 },
          { category: "Diplomacy", earned: 2, total: 6 },
          { category: "Lorewards", earned: 0, total: 6 },
        ],
        recent: [
          unlock("a", "Weekly Winner"),
          { ...unlock("b", "Envoy Treaty"), category: "Diplomacy" },
        ],
      },
    } as never);

    render(<VaultUnlocks />);
    const region = screen.getByRole("region", { name: "Achievements" });
    expect(region).toBeInTheDocument();
    expect(screen.getByText("Achievements")).toBeVisible();
    expect(screen.getByText("5/20")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute(
      "href",
      "/vault/achievements"
    );

    // Slide category chips carry semantic domain washes ("collection" -> Cards in pink; Diplomacy in teal)
    const chips = region.querySelectorAll("[data-slot='milestone-category-chip']");
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveClass("bg-pink/15", "text-pink-ink");
    expect(chips[1]).toHaveClass("bg-teal/15", "text-teal-ink");

    // Bottom category mastery strip links each domain directly to /vault/achievements?category=...
    const masteryStrip = region.querySelector(
      "[data-slot='vault-unlocks-categories']"
    ) as HTMLElement;
    expect(masteryStrip).toBeInTheDocument();
    const diplomacyLink = screen.getByRole("link", { name: /Diplomacy\s*2\/6/ });
    expect(diplomacyLink).toHaveAttribute("href", "/vault/achievements?category=Diplomacy");
    expect(diplomacyLink).toHaveClass("bg-teal/15", "text-teal-ink");
  });

  it("turns to the next slide when the mouse drags it left past a sixth of its width, and back when dragged right", () => {
    render(<VaultUnlocks />);
    drag(250, 150);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: WIDTH });
    track().scrollLeft = WIDTH;
    drag(100, 200);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0 });
  });

  it("settles back on the same slide after a short drag, and never past the last one", () => {
    render(<VaultUnlocks />);
    drag(200, 180);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0 });
    track().scrollLeft = WIDTH;
    drag(250, 50);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: WIDTH });
  });

  it("does not follow the slide's link at the end of a drag, but does on a plain click", () => {
    render(<VaultUnlocks />);
    const link = screen.getByRole("link", { name: /Weekly Winner/ });
    drag(250, 150);
    expect(fireEvent.click(link)).toBe(false);
    expect(fireEvent.click(link)).toBe(true);
  });

  it("projects velocity so a brisk short flick advances to the next slide without exceeding 1/6 width", () => {
    let clock = 1000;
    const nowSpy = jest.spyOn(performance, "now").mockImplementation(() => clock);
    try {
      render(<VaultUnlocks />);
      const el = track() as HTMLElement;
      fireEvent.pointerDown(el, { pointerType: "mouse", button: 0, clientX: 200, pointerId: 2 });
      clock += 32;
      fireEvent.pointerMove(el, { pointerType: "mouse", clientX: 170, pointerId: 2 });
      clock += 8;
      fireEvent.pointerUp(el, { pointerType: "mouse", clientX: 170, pointerId: 2 });
      expect(scrollTo).toHaveBeenLastCalledWith({ left: WIDTH });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("keeps tracking across pointerLeave while captured and snaps back cleanly on pointerCancel", () => {
    const captureSpy = jest.fn();
    HTMLElement.prototype.setPointerCapture = captureSpy;
    render(<VaultUnlocks />);
    const el = track() as HTMLElement;

    fireEvent.pointerDown(el, { pointerType: "mouse", button: 0, clientX: 250, pointerId: 3 });
    expect(captureSpy).toHaveBeenCalledWith(3);
    fireEvent.pointerMove(el, { pointerType: "mouse", clientX: 220, pointerId: 3 });
    fireEvent.pointerLeave(el, { pointerType: "mouse", clientX: 220, pointerId: 3 });
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.pointerMove(el, { pointerType: "mouse", clientX: 150, pointerId: 3 });
    fireEvent.pointerUp(el, { pointerType: "mouse", clientX: 150, pointerId: 3 });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: WIDTH });

    scrollTo.mockClear();
    el.scrollLeft = 0;
    fireEvent.pointerDown(el, { pointerType: "mouse", button: 0, clientX: 250, pointerId: 4 });
    fireEvent.pointerMove(el, { pointerType: "mouse", clientX: 140, pointerId: 4 });
    fireEvent.pointerCancel(el, { pointerType: "mouse", clientX: 140, pointerId: 4 });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0 });
  });
});

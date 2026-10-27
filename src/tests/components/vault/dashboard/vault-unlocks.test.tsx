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
  it("heads the deck Achievements, which names the carousel", () => {
    render(<VaultUnlocks />);
    expect(screen.getByRole("region", { name: "Achievements" })).toBeInTheDocument();
    expect(screen.getByText("Achievements")).toBeVisible();
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
});

/**
 * The agenda lists five items, then "Show all"; the page scrolls, never the list. Completing an
 * item (its circle, as in Reminders) raises a toast with Undo on the press, and Undo brings it back.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AgendaItem } from "~/components/mycountry/shell/agenda";

const info = jest.fn();

const item = (n: number): AgendaItem => ({
  id: `issue:${n}`,
  kind: "issue",
  title: `Issue ${n}`,
  preview: "Needs a decision",
  statusLabel: "Priority issue",
  icon: () => null,
  tone: "neutral",
  receivedAt: null,
  urgency: null,
  flagged: false,
});

jest.mock("~/trpc/react", () => {
  const empty = { useQuery: () => ({ data: undefined, isLoading: false }) };
  return {
    api: {
      intent: { getTree: empty },
      elections: { getElections: empty },
      nationalIssues: { getMyIssues: empty },
      exchange: { getTreasury: empty, getRealmCorporateSummary: empty },
    },
  };
});
jest.mock("~/hooks/useNationClock", () => ({
  useNationClock: () => ({ multiplier: 1, calendar: null }),
  useClockNow: () => 1,
}));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({ info }) }));
jest.mock("~/components/mycountry/shell/DirectiveStatusLine", () => ({
  DirectiveStatusLine: () => null,
}));
jest.mock("~/components/mycountry/shell/agenda", () => ({
  deriveAgendaItems: () => Array.from({ length: 7 }, (_, i) => item(i + 1)),
  formatAgendaTime: () => null,
}));

import { ExecutiveAgenda } from "~/components/mycountry/shell/ExecutiveAgenda";

beforeAll(() => {
  // jsdom lacks PointerEvent, so Testing Library falls back to Event (dropping clientX).
  if (typeof globalThis.PointerEvent === "undefined") {
    class PolyfillPointerEvent extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
        this.pointerType = params.pointerType ?? "touch";
      }
    }
    globalThis.PointerEvent = PolyfillPointerEvent as typeof globalThis.PointerEvent;
  }
});

beforeEach(() => {
  info.mockClear();
  window.localStorage.clear();
});

describe("ExecutiveAgenda", () => {
  it("shows five items and a Show all control instead of an inner scroller", () => {
    render(<ExecutiveAgenda countryId="c1" />);
    expect(screen.getAllByRole("button", { name: /^Mark done:/ })).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Show all (7)" }));
    expect(screen.getAllByRole("button", { name: /^Mark done:/ })).toHaveLength(7);
    expect(screen.getByRole("list").className).not.toMatch(/overflow-y-auto/);
  });

  it("raises an Undo toast on the press, and Undo keeps the item", () => {
    render(<ExecutiveAgenda countryId="c1" />);
    const done = screen.getByRole("button", { name: "Mark done: Issue 1" });
    fireEvent.click(done);

    expect(info).toHaveBeenCalledWith(
      "Hidden from your agenda",
      "Issue 1",
      expect.objectContaining({ actions: [expect.objectContaining({ label: "Undo" })] })
    );
    expect(done).toBeDisabled();

    const [{ actions }] = info.mock.calls[0]!.slice(2) as [{ actions: { onClick: () => void }[] }];
    React.act(() => actions[0]!.onClick());

    expect(screen.getByRole("button", { name: "Mark done: Issue 1" })).toBeEnabled();
    expect(window.localStorage.getItem("ixstats:agenda-done:c1")).toBe("[]");
  });

  it("exposes a trailing swipe-to-complete action and commits a full swipe left with Undo", () => {
    jest.useFakeTimers();
    try {
      const { container } = render(<ExecutiveAgenda countryId="c1" />);
      const swipeBtn = screen.getByRole("button", { name: "Hide from agenda: Issue 1" });
      expect(swipeBtn).toHaveAttribute("tabindex", "-1");

      const draggable = container.querySelector<HTMLElement>(
        '[data-swipeable-row="agenda-issue:1"] .cursor-auto'
      )!;

      // Pulling past commit and dragging back before release cancels without completing
      fireEvent.pointerDown(draggable, { pointerId: 1, clientX: 280, button: 0 });
      fireEvent.pointerMove(draggable, { pointerId: 1, clientX: 20 });
      fireEvent.pointerMove(draggable, { pointerId: 1, clientX: 275 });
      fireEvent.pointerUp(draggable, { pointerId: 1, clientX: 275 });
      React.act(() => {
        jest.advanceTimersByTime(400);
      });
      expect(info).not.toHaveBeenCalled();

      // Full swipe left past the commit threshold (65% of default 300px width = 195px)
      fireEvent.pointerDown(draggable, { pointerId: 2, clientX: 280, button: 0 });
      fireEvent.pointerMove(draggable, { pointerId: 2, clientX: 240 });
      fireEvent.pointerMove(draggable, { pointerId: 2, clientX: 20 });
      fireEvent.pointerUp(draggable, { pointerId: 2, clientX: 20 });
      React.act(() => {
        jest.advanceTimersByTime(400);
      });

      expect(info).toHaveBeenCalledWith(
        "Hidden from your agenda",
        "Issue 1",
        expect.objectContaining({ actions: [expect.objectContaining({ label: "Undo" })] })
      );
      expect(window.localStorage.getItem("ixstats:agenda-done:c1")).toBe('["issue:1"]');

      const [{ actions }] = info.mock.calls[0]!.slice(2) as [
        { actions: { onClick: () => void }[] },
      ];
      React.act(() => actions[0]!.onClick());
      expect(window.localStorage.getItem("ixstats:agenda-done:c1")).toBe("[]");
      expect(screen.getByRole("button", { name: "Mark done: Issue 1" })).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});

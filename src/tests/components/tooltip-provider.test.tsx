import { act, fireEvent, render, screen } from "@testing-library/react";

import { Tooltip, TooltipProvider } from "~/components/ui/tooltip";

const hover = (el: Element) => fireEvent.pointerMove(el, { pointerType: "mouse" });
const contentOf = (text: string) =>
  [...document.querySelectorAll<HTMLElement>('[data-slot="tooltip-content"]')].find((n) =>
    n.textContent?.includes(text)
  );

describe("Tooltip timing", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("waits before the first tooltip and opens its neighbour instantly", () => {
    render(
      <TooltipProvider>
        <Tooltip content="Alpha">
          <button>a</button>
        </Tooltip>
        <Tooltip content="Beta">
          <button>b</button>
        </Tooltip>
      </TooltipProvider>
    );
    hover(screen.getByText("a"));
    act(() => jest.advanceTimersByTime(300));
    expect(contentOf("Alpha")).toBeUndefined();
    act(() => jest.advanceTimersByTime(250));
    expect(contentOf("Alpha")).toBeDefined();

    // Moving straight on to a neighbour (jsdom has no geometry for Radix's leave grace area).
    hover(screen.getByText("b"));
    expect(contentOf("Beta")?.getAttribute("data-state")).toBe("instant-open");
  });

  it("works with no provider ancestor", () => {
    render(
      <Tooltip content="Solo">
        <button>s</button>
      </Tooltip>
    );
    hover(screen.getByText("s"));
    act(() => jest.advanceTimersByTime(600));
    expect(contentOf("Solo")).toBeDefined();
  });
});

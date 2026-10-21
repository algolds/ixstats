import "node:fs";
import "node:path";
import { useRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useCiteTooltips } from "~/components/wiki-os/reader/useCiteTooltips";

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  const tooltip = useCiteTooltips(ref);
  return (
    <>
      <div ref={ref}>
        <p>
          Claim
          <sup className="reference">
            <a href="#cite_note-1">[1]</a>
          </sup>
        </p>
        <ol className="references">
          <li id="cite_note-1">
            <span className="mw-cite-backlink">^</span> A source
          </li>
        </ol>
      </div>
      {tooltip}
    </>
  );
}

describe("citation tooltip surface", () => {
  beforeAll(() => {
    // jsdom has no CSS.escape.
    (globalThis as { CSS?: unknown }).CSS ??= {};
    const css = globalThis.CSS as { escape?: (value: string) => string };
    css.escape ??= (value) => value;
  });
  describe("hide delay", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("stays open when the pointer moves from the citation onto the tooltip within the delay", () => {
      render(<Harness />);
      const link = screen.getByRole("link", { name: "[1]" });
      act(() => {
        fireEvent.mouseEnter(link);
      });
      // The capture-phase mouseleave fires for the <a> and again for its <sup class="reference">.
      act(() => {
        fireEvent.mouseLeave(link);
        fireEvent.mouseLeave(link.closest("sup")!);
      });
      act(() => {
        jest.advanceTimersByTime(100);
        fireEvent.mouseEnter(screen.getByRole("tooltip"));
      });
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(screen.getByRole("tooltip").getAttribute("data-state")).toBe("open");
    });

    it("closes once the pointer has left for longer than the delay", () => {
      render(<Harness />);
      const link = screen.getByRole("link", { name: "[1]" });
      act(() => {
        fireEvent.mouseEnter(link);
        fireEvent.mouseLeave(link);
      });
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(screen.queryByRole("tooltip")?.getAttribute("data-state") ?? "closed").not.toBe(
        "open"
      );
    });
  });
});

import fs from "node:fs";
import path from "node:path";
import React, { useRef } from "react";
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

  it("is the popover overlay, and nothing inside it paints a second surface", () => {
    render(<Harness />);
    act(() => {
      fireEvent.mouseEnter(screen.getByRole("link", { name: "[1]" }));
    });
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.getAttribute("class")).toMatch(/\bfacet-overlay\b/);
    expect(tooltip.textContent).toContain("A source");
    const inner = tooltip.querySelector(".wikios-cite-tooltip-inner");
    expect(inner).not.toBeNull();
    for (const el of [inner!, ...Array.from(inner!.querySelectorAll("*"))]) {
      expect(el.getAttribute("class") ?? "").not.toMatch(/(^|\s)(bg-|border|shadow|p-|px-|py-)/);
      expect(el.getAttribute("style") ?? "").not.toMatch(/background|border|box-shadow/);
    }
  });

  it("leaves the inner footnote with type only: no background, border, shadow, padding or arrow", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/wiki-os/content.css"), "utf8");
    const rule = /\.wikios-cite-tooltip-inner\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toContain("font-family");
    expect(rule).not.toMatch(/background|border|box-shadow|padding/);
    expect(css).not.toContain(".wikios-cite-tooltip-inner::after");
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

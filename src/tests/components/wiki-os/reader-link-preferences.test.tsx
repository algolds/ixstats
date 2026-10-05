/**
 * WK-14: the WikiOS reader honours "Citation tooltips" and "Open links in a new tab"
 * (Settings → WikiOS options, stored in localStorage).
 */
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
          See <a href="/wiki/Other_Page">Other page</a> and <a href="#History">History</a>.
          <sup className="reference">
            <a href="#cite_note-1">[1]</a>
          </sup>
        </p>
        <ol className="references">
          <li id="cite_note-1">A source</li>
        </ol>
      </div>
      {tooltip}
    </>
  );
}

describe("reader link preferences", () => {
  let openSpy: jest.SpyInstance;

  beforeAll(() => {
    (globalThis as { CSS?: unknown }).CSS ??= {};
    const css = globalThis.CSS as { escape?: (value: string) => string };
    css.escape ??= (value) => value;
  });

  beforeEach(() => {
    localStorage.clear();
    openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => openSpy.mockRestore());

  it("shows citation tooltips by default and hides them when switched off", () => {
    const { unmount } = render(<Harness />);
    act(() => {
      fireEvent.mouseEnter(screen.getByRole("link", { name: "[1]" }));
    });
    expect(screen.getByRole("tooltip").textContent).toContain("A source");
    unmount();

    localStorage.setItem("wikios:showCitationTooltips", "false");
    render(<Harness />);
    act(() => {
      fireEvent.mouseEnter(screen.getByRole("link", { name: "[1]" }));
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("follows links in place by default", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("link", { name: "Other page" }));
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("opens article links in a new tab when switched on, but not in-page anchors", () => {
    localStorage.setItem("wikios:openInNewTab", "true");
    render(<Harness />);

    const followed = fireEvent.click(screen.getByRole("link", { name: "Other page" }));
    expect(followed).toBe(false); // default prevented
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("/wiki/Other_Page"),
      "_blank",
      "noopener,noreferrer"
    );

    openSpy.mockClear();
    fireEvent.click(screen.getByRole("link", { name: "History" }));
    fireEvent.click(screen.getByRole("link", { name: "[1]" }));
    expect(openSpy).not.toHaveBeenCalled();
  });
});

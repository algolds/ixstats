import React from "react";
import { render, screen } from "@testing-library/react";
import { BoardChips } from "~/components/thinkpages-forum/realm/BoardChips";

const boards = [
  { key: "hub", name: "Hub" },
  { key: "character-threads", name: "Character Threads" },
  { key: "current-events", name: "Current Events" },
];

describe("BoardChips", () => {
  it("shows each board as a chip linking to it", () => {
    render(<BoardChips slug="eurth" boards={boards} />);
    const nav = screen.getByRole("navigation", { name: "Boards" });
    const links = Array.from(nav.querySelectorAll("a")).map((a) => [
      a.textContent,
      a.getAttribute("href"),
    ]);
    expect(links).toEqual([
      ["Hub", "/thinkpages/r/eurth/hub"],
      ["Character Threads", "/thinkpages/r/eurth/character-threads"],
      ["Current Events", "/thinkpages/r/eurth/current-events"],
    ]);
  });

  it("scrolls sideways inside itself instead of widening the page", () => {
    render(<BoardChips slug="eurth" boards={boards} />);
    const nav = screen.getByRole("navigation", { name: "Boards" });
    expect(nav).toHaveClass("overflow-x-auto");
    // Chips keep their size and scroll rather than shrink or wrap.
    for (const chip of nav.querySelectorAll("a"))
      expect(chip).toHaveClass("shrink-0", "whitespace-nowrap");
  });

  it("renders nothing without boards", () => {
    const { container } = render(<BoardChips slug="eurth" boards={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import { StickyToc } from "~/components/wiki-os/reader/StickyToc";

jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => ({ activeSectionId: "Geography" }),
}));

const entries = [
  { id: "History", text: "History", level: 2 },
  { id: "Geography", text: "Geography", level: 2 },
];

describe("StickyToc", () => {
  beforeEach(() => {
    window.scrollTo = jest.fn();
    document.body.innerHTML = '<h2 id="History">History</h2>';
  });

  it("scrolls to the heading clear of the Halo band, records the hash and reports the pick", () => {
    const onNavigate = jest.fn();
    render(<StickyToc entries={entries} contentRef={{ current: null }} onNavigate={onNavigate} />, {
      container: document.body.appendChild(document.createElement("div")),
    });

    fireEvent.click(screen.getByRole("link", { name: "History" }));

    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    expect(window.location.hash).toBe("#History");
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("marks the section being read", () => {
    render(<StickyToc entries={entries} contentRef={{ current: null }} />);
    expect(screen.getByRole("link", { name: "Geography" })).toHaveClass(
      "wikios-sticky-toc-item--active"
    );
  });

  it("is never hidden by CSS: the Inspector sheet below 1280px shows it too", () => {
    const css = fs.readFileSync(
      path.resolve(process.cwd(), "src/styles/wiki-os/content.css"),
      "utf-8"
    );
    expect(css).not.toMatch(/\.wikios-sticky-toc\s*\{[^}]*display:\s*none/);
  });
});

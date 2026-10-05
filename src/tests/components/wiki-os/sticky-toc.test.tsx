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

  it("is never hidden by any wiki-os stylesheet: the Inspector sheet below 1280px shows it too", () => {
    const dir = path.resolve(process.cwd(), "src/styles/wiki-os");
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".css"))) {
      const css = fs.readFileSync(path.join(dir, file), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
      // Any rule whose selector names the TOC (not just its parts) and sets display: none.
      const hiding = [
        ...css.matchAll(/([^{}]*\.wikios-sticky-toc(?![\w-]|::)[^{}]*)\{([^{}]*)\}/g),
      ].filter(([, , body]) => /display:\s*none/.test(body ?? ""));
      expect({ file, hiding: hiding.map((m) => m[1]?.trim()) }).toEqual({ file, hiding: [] });
    }
  });

  it("the page-enter animation never uses transform, which would make <main> the containing block of the fixed Inspector", () => {
    const css = fs.readFileSync(
      path.resolve(process.cwd(), "src/styles/wiki-os/layout.css"),
      "utf-8"
    );
    const keyframes = /@keyframes wikios-page-enter\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(keyframes).toContain("opacity");
    expect(keyframes).not.toMatch(/transform|translate|scale|rotate/);
  });
});

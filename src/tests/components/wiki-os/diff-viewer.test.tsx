/**
 * Plan 413: the viewer draws the server's hunks (no diff of its own), separates them with "…", and
 * highlights word ranges as text.
 */
import { render, screen } from "@testing-library/react";
import { DiffViewer } from "~/components/diff-viewer";
import { diffWikitext } from "~/lib/wiki-os/transformers/wikitext-diff";
describe("DiffViewer with server hunks", () => {
  it("marks changed words in a <mark>, from ranges, and never renders line text as HTML", () => {
    const { hunks } = diffWikitext("<b>hi</b> brown fox", "<b>hi</b> red fox");

    const { container } = render(<DiffViewer hunks={hunks} layout="unified" />);

    expect([...container.querySelectorAll("mark")].map((m) => m.textContent)).toEqual([
      "brown",
      "red",
    ]);
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>hi</b>");
  });
  it("refuses to diff a text over 2 MB in the browser", () => {
    render(<DiffViewer oldCode="" newCode={"x".repeat(2 * 1024 * 1024 + 1)} />);

    expect(screen.getByText(/too large to display/)).toBeInTheDocument();
  });
});

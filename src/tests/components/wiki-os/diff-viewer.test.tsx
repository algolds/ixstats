/**
 * Plan 413: the viewer draws the server's hunks (no diff of its own), separates them with "…", and
 * highlights word ranges as text.
 */
import { render, screen } from "@testing-library/react";
import { DiffViewer } from "~/components/diff-viewer";
import { diffWikitext } from "~/lib/wiki-os/transformers/wikitext-diff";

const lines = (count: number): string[] => Array.from({ length: count }, (_, i) => `line ${i + 1}`);

describe("DiffViewer with server hunks", () => {
  it("draws only the hunk rows with a gap row between hunks", () => {
    const base = lines(1000);
    const changed = [...base];
    changed[99] = "line 100 edited";
    changed[799] = "line 800 edited";
    const { hunks } = diffWikitext(base.join("\n"), changed.join("\n"));

    const { container } = render(<DiffViewer hunks={hunks} layout="unified" />);

    // 16 line rows and the "… N unchanged lines …" row before each hunk
    expect(container.querySelectorAll("tbody tr")).toHaveLength(18);
    expect(screen.getAllByText(/unchanged lines/)).toHaveLength(2);
    expect(screen.getByText(/96 unchanged lines/)).toBeInTheDocument();
  });

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
  it("still diffs two texts it is handed (small suggested edits), with the shared bounded diff", () => {
    const { container } = render(<DiffViewer oldCode={"a\nb"} newCode={"a\nc"} layout="split" />);

    expect(container.textContent).toContain("b");
    expect(container.textContent).toContain("c");
  });

  it("refuses to diff a text over 2 MB in the browser", () => {
    render(<DiffViewer oldCode="" newCode={"x".repeat(2 * 1024 * 1024 + 1)} />);

    expect(screen.getByText(/too large to display/)).toBeInTheDocument();
  });
  it("shows a notice instead of a diff when the server says it is too large, with its counts", () => {
    const { container } = render(
      <DiffViewer hunks={[]} tooLarge added={1_000_000} removed={1_000_000} />
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "This diff is too large to display (1,000,000 lines added, 1,000,000 removed)."
    );
    expect(screen.queryByText("There are no differences.")).toBeNull();
    expect(container.querySelector("table")).toBeNull();
  });

  it("draws the first changes of a truncated diff, with a notice and the whole diff's totals", () => {
    const base = lines(40);
    const changed = [...base];
    changed[5] = "line 6 edited";
    const { hunks } = diffWikitext(base.join("\n"), changed.join("\n"));

    const { container } = render(
      <DiffViewer
        oldTitle="a"
        newTitle="b"
        hunks={hunks}
        truncated
        added={77}
        removed={66}
        layout="unified"
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent(/only the first changes are shown/);
    expect(screen.getByText("+77")).toBeInTheDocument();
    expect(screen.getByText("-66")).toBeInTheDocument();
    expect(container.textContent).toContain("line 6 edited");
  });
});

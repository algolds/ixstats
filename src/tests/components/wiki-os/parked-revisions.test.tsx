/**
 * Plan 2026-10-24 Task 10: an overwritten revision (a save a later one on the other wiki replaced, stored with
 * `parked`) is listed and badged "overwritten", never taken for the page's latest revision by the rollback button, and,
 * being kept in the history with its text, can be restored like any other revision.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { OverwrittenBadge } from "~/components/wiki-os/shared/OverwrittenBadge";
import { ScrubbableRevisionTimeline } from "~/components/wiki-os/history/ScrubbableRevisionTimeline";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ wikios: { getHistory: { invalidate: jest.fn() } } }),
    wikios: {
      revertToRevision: {
        useMutation: () => ({ mutate: jest.fn(), reset: jest.fn(), isPending: false, error: null }),
      },
      rollback: { useMutation: () => ({ mutate: jest.fn(), isPending: false, error: null }) },
      getDiff: { useQuery: () => ({ data: undefined, isLoading: false, error: null }) },
    },
  },
}));
jest.mock("~/components/diff-viewer", () => ({ DiffViewer: () => <div data-testid="diff" /> }));

const revision = (id: string, author: string, parked = false) => ({
  id,
  articleId: "a1",
  author,
  summary: null,
  minor: false,
  byteSize: 10,
  parked,
  createdAt: new Date("2026-06-01T00:00:00Z"),
  wikitext: "text",
});

describe("OverwrittenBadge", () => {
  it("says the revision was overwritten and is kept in the history, in semantic tokens", () => {
    render(<OverwrittenBadge />);

    const badge = screen.getByText("overwritten");
    expect(badge).toHaveAttribute(
      "title",
      "Kept in the history: a later edit on the other wiki was kept"
    );
    expect(badge.className).not.toMatch(/(?:rose|red|amber)-\d/);
  });
});

describe("ScrubbableRevisionTimeline with an overwritten revision", () => {
  it("badges the overwritten revision where it is selected, and in the comparison picker", () => {
    render(
      <ScrubbableRevisionTimeline
        title="Foo"
        revisions={[revision("9001", "carol", true), revision("r2", "bob"), revision("r1", "amy")]}
      />
    );

    expect(screen.getAllByText("overwritten")).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Compare revision" }), {
      key: "ArrowDown",
    });
    expect(screen.getByRole("option", { name: /Latest.*overwritten/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /r2 • bob/ }).textContent).not.toContain(
      "overwritten"
    );
  });

  it("rolls back the page's real last editor, never the author of an overwritten revision", () => {
    render(
      <ScrubbableRevisionTimeline
        title="Foo"
        revisions={[revision("9001", "carol", true), revision("r2", "bob"), revision("r1", "bob")]}
      />
    );

    expect(screen.getByRole("button", { name: "Rollback bob" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rollback carol/ })).toBeNull();
  });

  it("offers the revert to an overwritten revision: its text is kept, so it can come back", () => {
    render(
      <ScrubbableRevisionTimeline
        title="Foo"
        // the revision compared with (index 1) is the overwritten one
        revisions={[revision("r3", "bob"), revision("9001", "carol", true), revision("r1", "amy")]}
      />
    );

    expect(screen.getByRole("button", { name: /Revert to this version/ })).toBeInTheDocument();
    expect(screen.queryByText(/never went live/)).toBeNull();
  });
});

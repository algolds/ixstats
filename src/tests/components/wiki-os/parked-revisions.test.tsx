/**
 * Plan 406 follow-up: a parked revision (a MediaWiki edit that conflicted with WikiOS's head) is listed,
 * badged with Facet tokens, and never taken for the page's latest revision by the rollback button.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { ParkedBadge } from "~/components/wiki-os/shared/ParkedBadge";
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

describe("ParkedBadge", () => {
  it("says the edit is not live, in semantic Facet tokens (no hard-coded palette)", () => {
    render(<ParkedBadge />);

    const badge = screen.getByText("conflict, not live");
    expect(badge.className).toContain("text-destructive");
    expect(badge.className).toContain("border-destructive/40");
    expect(badge.className).not.toMatch(/(?:rose|red|amber)-\d/);
    expect(badge).toHaveAttribute("title", expect.stringContaining("not the live text"));
  });
});

describe("ScrubbableRevisionTimeline with a parked revision", () => {
  it("badges the parked revision where it is selected, and nothing else", () => {
    render(
      <ScrubbableRevisionTimeline
        title="Foo"
        revisions={[revision("9001", "carol", true), revision("r2", "bob"), revision("r1", "amy")]}
      />
    );

    // Revision A (index 0) is the parked one and carries the badge; Revision B is not badged.
    expect(screen.getAllByText("conflict, not live")).toHaveLength(1);
    // The picker of the comparison revision names it too (a Facet Select: its options show once open).
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Compare revision" }), {
      key: "ArrowDown",
    });
    expect(screen.getByRole("option", { name: /Latest.*conflict, not live/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /r2 • bob/ }).textContent).not.toContain("conflict");
  });

  it("rolls back the page's real last editor, never the author of a parked revision", () => {
    render(
      <ScrubbableRevisionTimeline
        title="Foo"
        revisions={[revision("9001", "carol", true), revision("r2", "bob"), revision("r1", "bob")]}
      />
    );

    expect(screen.getByRole("button", { name: "Rollback bob" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rollback carol/ })).toBeNull();
  });

  it("offers no rollback when the only consecutive pair is made of a parked revision", () => {
    render(
      <ScrubbableRevisionTimeline
        title="Foo"
        revisions={[revision("9001", "bob", true), revision("r2", "bob"), revision("r1", "amy")]}
      />
    );

    expect(screen.queryByRole("button", { name: /Rollback/ })).toBeNull();
  });

  it("offers no revert to a parked revision: it never was the page's text", () => {
    render(
      <ScrubbableRevisionTimeline
        title="Foo"
        // the revision compared with (index 1) is the parked one
        revisions={[revision("r3", "bob"), revision("9001", "carol", true), revision("r1", "amy")]}
      />
    );

    expect(screen.queryByRole("button", { name: /Revert to this version/ })).toBeNull();
    expect(screen.getByText(/r9001 never went live, so it cannot be restored/)).toBeInTheDocument();
  });

  it("still offers the revert when the revision compared with is live", () => {
    render(
      <ScrubbableRevisionTimeline
        title="Foo"
        revisions={[revision("r3", "bob"), revision("r2", "carol"), revision("r1", "amy")]}
      />
    );

    expect(screen.getByRole("button", { name: /Revert to this version/ })).toBeInTheDocument();
  });
});

describe("ScrubbableRevisionTimeline with a hidden author (MediaWiki revision deletion)", () => {
  const hidden = (id: string) => ({ ...revision(id, "x"), author: null });

  it("offers no rollback of an author whose name is hidden, and says who it is in the list", () => {
    render(
      <ScrubbableRevisionTimeline
        title="Foo"
        revisions={[hidden("r3"), hidden("r2"), revision("r1", "amy")]}
      />
    );

    expect(screen.queryByRole("button", { name: /Rollback/ })).toBeNull();
    expect(screen.getAllByText("Community Contributor").length).toBeGreaterThan(0);
  });

  it("still offers it for a named author", () => {
    render(
      <ScrubbableRevisionTimeline
        title="Foo"
        revisions={[revision("r3", "bob"), revision("r2", "bob"), revision("r1", "amy")]}
      />
    );

    expect(screen.getByRole("button", { name: "Rollback bob" })).toBeInTheDocument();
  });
});

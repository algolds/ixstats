/**
 * Plan 402: a revert or rollback the server refuses (an import placeholder, a revision of another
 * page, a blanking revert) shows the server's reason instead of failing silently.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ScrubbableRevisionTimeline } from "~/components/wiki-os/history/ScrubbableRevisionTimeline";
import DiffPage from "~/app/(wiki-os)/util/diff/page";

const revertError = { message: "This revision's text has not been imported yet." };
const rollbackError = { message: "Not enough revisions to roll back." };
const revertReset = jest.fn();

let revertState: { error: { message: string } | null; isSuccess: boolean } = {
  error: null,
  isSuccess: false,
};
let rollbackState: { error: { message: string } | null } = { error: null };

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ wikios: { getHistory: { invalidate: jest.fn() } } }),
    wikios: {
      revertToRevision: {
        useMutation: () => ({
          mutate: jest.fn(),
          reset: revertReset,
          isPending: false,
          ...revertState,
        }),
      },
      rollback: {
        useMutation: () => ({ mutate: jest.fn(), isPending: false, ...rollbackState }),
      },
      getRevisionContent: {
        useQuery: () => ({ data: { wikitext: "old", title: "Foo", source: "ixwiki" } }),
      },
      getDiff: {
        useQuery: () => ({
          data: {
            diffHtml: "",
            oldWikitext: "old",
            newWikitext: "new",
            from: { revid: "r1", user: "amy", timestamp: "", comment: "" },
            to: { revid: "r2", user: "bob", timestamp: "", comment: "" },
          },
          isLoading: false,
          error: null,
        }),
      },
    },
  },
}));
jest.mock("~/components/diff-viewer", () => ({ DiffViewer: () => <div data-testid="diff" /> }));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("from=r1&to=r2"),
}));

const revisions = ["r2", "r1"].map((id, index) => ({
  id,
  articleId: "a1",
  author: index === 0 ? "bob" : "amy",
  summary: null,
  minor: false,
  byteSize: 10,
  createdAt: new Date("2026-06-01T00:00:00Z"),
  wikitext: id === "r2" ? "new" : "old",
}));

const renderTimeline = () =>
  render(<ScrubbableRevisionTimeline title="Foo" slug="foo" revisions={revisions} />);

beforeEach(() => {
  jest.clearAllMocks();
  revertState = { error: null, isSuccess: false };
  rollbackState = { error: null };
});

describe("ScrubbableRevisionTimeline revert and rollback errors", () => {
  it("shows no error line before anything fails", () => {
    renderTimeline();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the reason a rollback was refused", () => {
    rollbackState = { error: rollbackError };
    renderTimeline();

    expect(screen.getByRole("alert")).toHaveTextContent(rollbackError.message);
  });

  it("shows the reason a revert was refused inside the confirmation, and clears it on a new try", () => {
    revertState = { error: revertError, isSuccess: false };
    renderTimeline();
    fireEvent.click(screen.getByRole("button", { name: /Revert to this version/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(revertError.message);
    expect(screen.getByRole("button", { name: "Confirm Revert" })).toBeInTheDocument();
    expect(revertReset).toHaveBeenCalled();
  });
});

describe("Revision diff page revert errors", () => {
  it("shows the reason a revert was refused", () => {
    revertState = { error: revertError, isSuccess: false };
    render(<DiffPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(revertError.message);
  });

  it("shows no error line for a clean page", () => {
    render(<DiffPage />);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

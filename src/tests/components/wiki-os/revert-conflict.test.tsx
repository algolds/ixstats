/**
 * Plan 2026-10-24 Task 13 (A6): a revert or rollback carries the head it read, and an edit that landed since comes back
 * as an edit conflict (`{ success: false, editConflict: true }`), with nothing saved. The history timeline and the diff
 * view say so, and never show it as a success: the revert's confirmation stays open with the reason.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ScrubbableRevisionTimeline } from "~/components/wiki-os/history/ScrubbableRevisionTimeline";
import { RevisionDiffView } from "~/components/wiki-os/history/RevisionDiffView";

const CONFLICT = {
  success: false,
  editConflict: true,
  currentWikitext: "Gamma's text",
  currentRevisionRef: "r9",
};
const SAVED = { success: true, title: "Foo", revisionId: "r10" };

type MutationOptions = { onSuccess?: (result: object) => void };
let mockRevertData: object | undefined;
let mockRollbackData: object | undefined;
let mockRevertOptions: MutationOptions = {};
const mockInvalidate = jest.fn();

jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("~/components/wiki-os/history/RestoreOverwrittenButton", () => ({
  RestoreOverwrittenButton: () => null,
}));
jest.mock("~/components/diff-viewer", () => ({ DiffViewer: () => <div data-testid="diff" /> }));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ wikios: { getHistory: { invalidate: mockInvalidate } } }),
    wikios: {
      revertToRevision: {
        useMutation: (options: MutationOptions) => {
          mockRevertOptions = options;
          return {
            mutate: jest.fn(),
            reset: jest.fn(),
            isPending: false,
            error: null,
            data: mockRevertData,
          };
        },
      },
      rollback: {
        useMutation: () => ({
          mutate: jest.fn(),
          isPending: false,
          error: null,
          data: mockRollbackData,
        }),
      },
      getDiff: {
        useQuery: () => ({
          data: {
            from: { revid: "11", user: "amy" },
            to: { revid: "12", user: "bob" },
            hunks: [],
            trailingSkipped: 0,
            tooLarge: false,
            truncated: false,
            added: 0,
            removed: 0,
          },
          isLoading: false,
          error: null,
        }),
      },
      getRevisionContent: { useQuery: () => ({ data: undefined }) },
    },
  },
}));

const revision = (id: string, author: string) => ({
  id,
  articleId: "a1",
  author,
  summary: null,
  minor: false,
  byteSize: 10,
  createdAt: new Date("2026-06-01T00:00:00Z"),
});

const timeline = () =>
  render(
    <ScrubbableRevisionTimeline
      title="Foo"
      revisions={[revision("r3", "bob"), revision("r2", "bob"), revision("r1", "amy")]}
    />
  );

const EDITED_SINCE = "Someone edited the page since the history loaded. Nothing was saved.";

beforeEach(() => {
  mockRevertData = undefined;
  mockRollbackData = undefined;
  mockRevertOptions = {};
  mockInvalidate.mockClear();
});

describe("ScrubbableRevisionTimeline after a revert or rollback", () => {
  it("says a rollback that met a newer edit saved nothing", () => {
    mockRollbackData = CONFLICT;
    timeline();

    expect(screen.getByRole("alert")).toHaveTextContent(EDITED_SINCE);
  });

  it("shows nothing for a rollback that saved", () => {
    mockRollbackData = SAVED;
    timeline();

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the revert's confirmation open with the reason after an edit conflict, and closes it after a save", () => {
    timeline();
    fireEvent.click(screen.getByRole("button", { name: /Revert to this version/ }));
    expect(screen.getByText("Confirm revert action")).toBeInTheDocument();

    act(() => mockRevertOptions.onSuccess?.(CONFLICT));
    expect(screen.getByText("Confirm revert action")).toBeInTheDocument();
    expect(mockInvalidate).toHaveBeenCalledWith({ title: "Foo" });

    act(() => mockRevertOptions.onSuccess?.(SAVED));
    expect(screen.queryByText("Confirm revert action")).toBeNull();
  });

  it("names the edit since in the confirmation", () => {
    mockRevertData = CONFLICT;
    timeline();
    fireEvent.click(screen.getByRole("button", { name: /Revert to this version/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(EDITED_SINCE);
  });
});

describe("RevisionDiffView after a revert", () => {
  const view = () => render(<RevisionDiffView torev="12" backHref="/wiki/Foo" backLabel="Back" />);

  it("says a revert that met a newer edit saved nothing, and never that it succeeded", () => {
    mockRevertData = CONFLICT;
    view();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Someone edited the page since this comparison loaded. Nothing was saved."
    );
    expect(screen.queryByText(/Successfully reverted/)).toBeNull();
  });

  it("says a revert that saved succeeded", () => {
    mockRevertData = SAVED;
    view();

    expect(screen.getByText("Successfully reverted to revision r11.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the confirmation open after an edit conflict, and closes it after a save", () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: /Revert to r11/ }));
    expect(screen.getByRole("button", { name: "Confirm Revert" })).toBeInTheDocument();

    act(() => mockRevertOptions.onSuccess?.(CONFLICT));
    expect(screen.getByRole("button", { name: "Confirm Revert" })).toBeInTheDocument();

    act(() => mockRevertOptions.onSuccess?.(SAVED));
    expect(screen.queryByRole("button", { name: "Confirm Revert" })).toBeNull();
  });
});

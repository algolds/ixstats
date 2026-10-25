/**
 * Plan 2026-10-24 Task 10: the diff an overwritten author's notice links to (`?conflict=<id>`) offers "Restore my text"
 * to that author only (the server says whom: `wikios.overwrittenRestorable`), and the click saves their text again as
 * a new edit (`wikios.restoreOverwritten`). An edit made since shows the edit conflict: nothing was saved. Without
 * `?conflict=` the diff is a plain diff, with no button and no question asked. An overwritten revision can be reverted
 * to like any other.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { RevisionDiffView } from "~/components/wiki-os/history/RevisionDiffView";

let mockSearch = "";
let mockRestorable = true;
let mockRestoreData: object | undefined;
let mockFromParked = false;
let mockFromRevid = "wk-1";
let mockRestorePending = false;
let mockRestoreError: { message: string } | null = null;
const mockRestore = jest.fn();
const mockRestorableQuery = jest.fn();

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("~/components/diff-viewer", () => ({ DiffViewer: () => <div data-testid="diff" /> }));
jest.mock("~/trpc/react", () => ({
  api: {
    wikios: {
      getDiff: {
        useQuery: () => ({
          data: {
            from: { revid: mockFromRevid, user: "alpha", parked: mockFromParked },
            to: { revid: "101", user: "Bob", parked: false },
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
      revertToRevision: {
        useMutation: () => ({ mutate: jest.fn(), reset: jest.fn(), isPending: false, error: null }),
      },
      overwrittenRestorable: {
        useQuery: (input: object, options: { enabled: boolean }) => {
          mockRestorableQuery(input, options);
          return { data: options.enabled ? { restorable: mockRestorable } : undefined };
        },
      },
      restoreOverwritten: {
        useMutation: () => ({
          mutate: mockRestore,
          isPending: mockRestorePending,
          error: mockRestoreError,
          data: mockRestoreData,
        }),
      },
    },
  },
}));

const view = (fromrev?: string) =>
  render(
    <RevisionDiffView fromrev={fromrev} torev="101" backHref="/wiki/Caphiria" backLabel="Back" />
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch = "";
  mockRestorable = true;
  mockRestoreData = undefined;
  mockFromParked = false;
  mockFromRevid = "wk-1";
  mockRestorePending = false;
  mockRestoreError = null;
});

describe("Restore my text on the notice's diff", () => {
  it("offers its author the restore, which saves the overwritten revision named in the link", () => {
    mockSearch = "?diff=101&oldid=wk-1&conflict=c1";
    view("wk-1");

    fireEvent.click(screen.getByRole("button", { name: "Restore my text" }));

    expect(mockRestorableQuery).toHaveBeenCalledWith(
      { conflictId: "c1", ref: "wk-1" },
      expect.objectContaining({ enabled: true })
    );
    expect(mockRestore).toHaveBeenCalledWith({ conflictId: "c1", ref: "wk-1" });
  });

  it("restores the older revision the diff shows when the link names none", () => {
    mockSearch = "?conflict=c1";
    view();

    fireEvent.click(screen.getByRole("button", { name: "Restore my text" }));

    expect(mockRestore).toHaveBeenCalledWith({ conflictId: "c1", ref: "wk-1" });
  });

  it("asks nothing on a diff with no older revision to restore", () => {
    mockSearch = "?conflict=c1";
    mockFromRevid = "";
    view();

    expect(mockRestorableQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    );
  });

  it("holds the button while the restore is saving, and says why one was refused", () => {
    mockSearch = "?conflict=c1";
    mockRestorePending = true;
    mockRestoreError = { message: "Only the author of that text can restore it." };
    view("wk-1");

    expect(screen.getByRole("button", { name: "Restore my text" })).toBeDisabled();
    expect(screen.getByText("Only the author of that text can restore it.")).toBeInTheDocument();
  });

  it("shows nothing to someone who did not write it", () => {
    mockSearch = "?conflict=c1";
    mockRestorable = false;
    view("wk-1");

    expect(screen.queryByRole("button", { name: "Restore my text" })).toBeNull();
  });

  it("asks nothing and shows nothing on a diff without ?conflict=", () => {
    view("wk-1");

    expect(screen.queryByRole("button", { name: "Restore my text" })).toBeNull();
    expect(mockRestorableQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    );
  });

  it("says the text is back once restored, and offers no second restore", () => {
    mockSearch = "?conflict=c1";
    mockRestoreData = { success: true, revisionId: "r9" };
    view("wk-1");

    expect(screen.getByText("Your text is back, as a new edit of the page.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore my text" })).toBeNull();
  });

  it("says nothing was saved when the page was edited since", () => {
    mockSearch = "?conflict=c1";
    mockRestoreData = {
      success: false,
      editConflict: true,
      currentWikitext: "Gamma's text",
      currentRevisionRef: "r8",
    };
    view("wk-1");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Someone edited the page since. Nothing was saved"
    );
  });

  it("offers the revert to an overwritten revision like any other", () => {
    mockFromParked = true;
    view("wk-1");

    expect(screen.getByRole("button", { name: /Revert to rwk-1/ })).toBeInTheDocument();
    expect(screen.queryByText(/never went live/)).toBeNull();
  });
});

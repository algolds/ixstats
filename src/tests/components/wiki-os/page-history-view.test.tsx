/**
 * Plan 413: the history view loads 50 revisions and "Older 50" asks for the next page by cursor.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { PageHistoryView } from "~/components/wiki-os/history/PageHistoryView";

const entry = (revid: string) => ({
  revid,
  user: "amy",
  timestamp: "2026-06-01T00:00:00.000Z",
  comment: "",
  size: 10,
  byteDelta: 1,
  minor: false,
  sha1: null,
});

const mockFetch = jest.fn();
let firstPage: { revisions: ReturnType<typeof entry>[]; hasMore: boolean } | undefined = {
  revisions: [entry("r3"), entry("r2")],
  hasMore: true,
};
let firstError: { message: string } | null = null;
const mockRefetch = jest.fn();
const timelineProps = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ wikios: { getHistory: { fetch: mockFetch } } }),
    wikios: {
      getHistory: {
        useQuery: () => ({
          data: firstPage,
          isLoading: false,
          error: firstError,
          refetch: mockRefetch,
        }),
      },
    },
  },
}));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock("~/components/wiki-os/history/ScrubbableRevisionTimeline", () => ({
  ScrubbableRevisionTimeline: (props: { revisions: { id: string }[] }) => {
    timelineProps(props);
    return <div data-testid="timeline">{props.revisions.map((r) => r.id).join(",")}</div>;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  firstPage = { revisions: [entry("r3"), entry("r2")], hasMore: true };
  firstError = null;
});

describe("PageHistoryView paging", () => {
  it("asks for 50, and shows no Older button when the first page is all there is", () => {
    firstPage = { revisions: [entry("r1")], hasMore: false };
    render(<PageHistoryView title="Foo" slug="Foo" />);

    expect(screen.queryByRole("button", { name: /Older/ })).toBeNull();
  });

  it("loads the next 50 after the last revision shown and appends them", async () => {
    mockFetch.mockResolvedValue({ revisions: [entry("r1")], hasMore: false });
    render(<PageHistoryView title="Foo" slug="Foo" />);
    expect(screen.getByTestId("timeline")).toHaveTextContent("r3,r2");

    fireEvent.click(screen.getByRole("button", { name: "Older 50" }));

    await waitFor(() => expect(screen.getByTestId("timeline")).toHaveTextContent("r3,r2,r1"));
    expect(mockFetch).toHaveBeenCalledWith({ title: "Foo", limit: 50, before: "r2" });
    // the last page was the end of the history: the button is gone
    expect(screen.queryByRole("button", { name: /Older/ })).toBeNull();
  });

  it("shows the reason an older page could not be loaded and keeps the button", async () => {
    mockFetch.mockRejectedValue(new Error("Too many requests"));
    render(<PageHistoryView title="Foo" slug="Foo" />);

    fireEvent.click(screen.getByRole("button", { name: "Older 50" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
    expect(screen.getByRole("button", { name: "Older 50" })).toBeInTheDocument();
  });
});

describe("PageHistoryView when the history cannot be loaded", () => {
  it("says so, with the reason and a way to try again, instead of 'no revision history'", () => {
    firstPage = undefined;
    firstError = { message: "Too many requests" };
    render(<PageHistoryView title="Foo" slug="Foo" />);

    expect(screen.getByRole("alert")).toHaveTextContent("The history of Foo could not be loaded");
    expect(screen.getByRole("alert")).toHaveTextContent("Too many requests");
    expect(screen.queryByTestId("timeline")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});

/**
 * Plan 2026-10-24 Task 10: the admin conflict log (WikiOS settings) lists each collision's page, the change that was
 * kept and on which wiki, what it overwrote and by whom, who was told on which channel, the trail, and its state; an
 * old park shows as history only, told to nobody. Older rows load on demand.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ConflictLogSection } from "~/app/admin/wikios-settings/ConflictLogSection";

const mockFetchNextPage = jest.fn();
let mockPages: Array<{ items: object[]; nextCursor: string | null }> = [];
let mockHasNextPage = false;

jest.mock("~/trpc/react", () => ({
  api: {
    wikios: {
      listConflicts: {
        useInfiniteQuery: () => ({
          data: { pages: mockPages },
          isLoading: false,
          hasNextPage: mockHasNextPage,
          isFetchingNextPage: false,
          fetchNextPage: mockFetchNextPage,
        }),
      },
    },
  },
}));

const shown = (over: object) => ({
  side: "classic",
  action: "edit",
  ref: "101",
  label: "revision 101",
  at: new Date("2026-10-24T12:00:00Z"),
  author: null,
  ...over,
});

const row = (over: object) => ({
  id: "conflict-1",
  shortId: "flict-1",
  title: "Caphiria",
  articleId: "a1",
  createdAt: new Date("2026-10-24T12:00:05Z"),
  state: "pending",
  legacy: false,
  winner: shown({}),
  overwritten: [],
  notices: [],
  trail: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockHasNextPage = false;
  mockPages = [];
});

describe("ConflictLogSection", () => {
  it("lists page, winner, overwritten, notices and legacy rows", () => {
    mockPages = [
      {
        items: [
          row({
            overwritten: [
              shown({ side: "wikios", ref: "wk-1", label: "revision 140", author: "alpha" }),
              shown({ action: "move", ref: "mwlog:7", label: "move, log 7", author: "Carol" }),
              shown({ ref: "102", label: "revision 102", author: null }),
            ],
            notices: [
              { who: "alpha", channel: "in-app", at: "2026-10-24T12:01:00Z" },
              { who: "Carol", channel: "talk-page", at: "2026-10-24T12:01:00Z", undelivered: null },
              {
                who: "10.0.0.7",
                channel: "talk-page",
                at: "2026-10-24T12:01:00Z",
                undelivered: "Not delivered: talk page deleted",
              },
            ],
            trail: "revision 150",
          }),
          row({
            id: "legacy-park-r1",
            shortId: "y-park-r1",
            title: "Old page",
            state: "legacy",
            legacy: true,
            winner: shown({
              side: "wikios",
              ref: "w-1",
              label: "WikiOS revision w-legacy, not in MediaWiki yet",
            }),
            overwritten: [shown({ ref: "90", label: "revision 90", author: "Old" })],
          }),
        ],
        nextCursor: null,
      },
    ];

    render(<ConflictLogSection />);

    const [first, legacy] = screen.getAllByRole("row").slice(1);
    const cells = within(first!);
    expect(cells.getByText("Caphiria")).toBeInTheDocument();
    expect(cells.getByText("revision 101")).toBeInTheDocument();
    expect(cells.getByText("on classic MediaWiki")).toBeInTheDocument();
    expect(cells.getByText("Trail: revision 150")).toBeInTheDocument();
    expect(cells.getByText("revision 140 by alpha, on WikiOS")).toBeInTheDocument();
    expect(cells.getByText("move, log 7 by Carol, on classic MediaWiki")).toBeInTheDocument();
    expect(cells.getByText("revision 102, on classic MediaWiki")).toBeInTheDocument();
    expect(cells.getByText("alpha, in-app")).toBeInTheDocument();
    expect(cells.getByText("Carol, talk page")).toBeInTheDocument();
    expect(cells.getByText("10.0.0.7, talk page")).toBeInTheDocument();
    expect(cells.getAllByText("Not delivered: talk page deleted")).toHaveLength(1);
    expect(cells.getByText("pending")).toBeInTheDocument();

    const old = within(legacy!);
    expect(old.getByText("Old page")).toBeInTheDocument();
    expect(old.getByText("revision 90 by Old, on classic MediaWiki")).toBeInTheDocument();
    expect(old.getByText("old park, nobody told")).toBeInTheDocument();
  });

  it("says when the log is empty", () => {
    mockPages = [{ items: [], nextCursor: null }];

    render(<ConflictLogSection />);

    expect(
      screen.getByText("No conflicts: the two wikis have not overwritten each other.")
    ).toBeInTheDocument();
  });

  it("loads older rows on demand", () => {
    mockPages = [{ items: [row({})], nextCursor: "c0" }];
    mockHasNextPage = true;

    render(<ConflictLogSection />);
    fireEvent.click(screen.getByRole("button", { name: "Load older conflicts" }));

    expect(mockFetchNextPage).toHaveBeenCalled();
  });
});

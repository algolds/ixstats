/** The History tab: chronicle and feed as one list, with filter chips and a feed-only range. */
import { fireEvent, render, screen } from "@testing-library/react";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { HistoryTab } from "~/components/country-profile/history/HistoryTab";

const feedQuery = jest.fn();
let activities: {
  id: string;
  type: string;
  source: string;
  title: string;
  description: string;
  timestamp: string;
}[] = [];
jest.mock("~/trpc/react", () => ({
  api: {
    activities: {
      getCountryActivity: {
        useQuery: (input: unknown) => {
          feedQuery(input);
          return { data: { activities }, isLoading: false };
        },
      },
    },
  },
}));
jest.mock("~/components/action-links/DiscussionCountsProvider", () => ({
  DiscussionCountsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/components/action-links/DiscussedIn", () => ({ DiscussedInBadge: () => null }));

const layer = (chronicle: number) =>
  ({
    countryId: "c1",
    identity: { name: "Caphiria" },
    chronicle: Array.from({ length: chronicle }, (_, i) => ({
      id: `entry-${i}`,
      kind: i === 0 ? "founding" : "decision",
      title: i === 0 ? "Kingdom founded" : `Decision ${i}`,
      detail: null,
      year: i === 0 ? -480 : 2040 + i / 10,
      dateLabel: i === 0 ? "480 BC" : `${i} March 2041`,
      source: i === 0 ? "wiki" : "ixtime",
    })),
  }) as unknown as CountryProfileLayer;

beforeEach(() => {
  feedQuery.mockClear();
  activities = [
    {
      id: "a1",
      type: "economic",
      source: "activity",
      title: "Trade surplus",
      description: "Exports up",
      timestamp: new Date().toISOString(),
    },
  ];
});

describe("HistoryTab", () => {
  it("lists the chronicle and the feed together", () => {
    render(<HistoryTab layer={layer(2)} />);
    expect(screen.getByText("Kingdom founded")).toBeInTheDocument();
    expect(screen.getByText("Trade surplus")).toBeInTheDocument();
    expect(screen.getByText("480 BC")).toBeInTheDocument();
  });

  it("shows only the chronicle under Record", () => {
    render(<HistoryTab layer={layer(2)} />);
    fireEvent.click(screen.getByRole("radio", { name: "Record" }));
    expect(screen.getByText("Kingdom founded")).toBeInTheDocument();
    expect(screen.queryByText("Trade surplus")).toBeNull();
  });

  it("applies the range to the feed query only", () => {
    render(<HistoryTab layer={layer(2)} />);
    fireEvent.click(screen.getByRole("radio", { name: "7 days" }));
    expect(feedQuery).toHaveBeenLastCalledWith(expect.objectContaining({ timeRange: "7d" }));
    expect(screen.getByText("Kingdom founded")).toBeInTheDocument();
  });

  it("caps a long timeline until asked for more", () => {
    render(<HistoryTab layer={layer(40)} />);
    expect(screen.queryByText("Decision 1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByText("Decision 1")).toBeInTheDocument();
  });

  it("offers more when the feed filled its first page, even under a feed filter", () => {
    activities = Array.from({ length: 20 }, (_, i) => ({
      id: `a${i}`,
      type: "economic",
      source: "activity",
      title: `Economic item ${i}`,
      description: "",
      timestamp: new Date(Date.now() - i * 60_000).toISOString(),
    }));
    render(<HistoryTab layer={layer(0)} />);
    fireEvent.click(screen.getByRole("radio", { name: "Economic" }));
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(feedQuery).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50 }));
  });

  it("says so when nothing matches", () => {
    activities = [];
    render(<HistoryTab layer={layer(0)} />);
    expect(screen.getByText("Nothing in this period")).toBeInTheDocument();
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import { api } from "~/trpc/react";
import { OverviewTab } from "~/app/admin/cards/overview";

const summary = {
  total: 10,
  byType: [{ key: "NS", count: 7 }],
  byRarity: [{ key: "ULTRA_RARE", count: 4 }],
  byRealm: [{ key: "iiwiki", label: "IIWiki", count: 10 }],
  pendingReview: 2,
  activeJobs: 1,
  openTakedowns: 3,
  overdueTakedowns: 1,
};
const activity = [
  {
    id: "audit-1",
    at: new Date("2026-10-28T10:00:00Z"),
    kind: "audit",
    title: "Rarity overridden",
    subject: "Ahkmala",
    detail: "Rarity COMMON → RARE: a banner",
    actor: "Admin Isles",
    ok: true,
  },
  {
    id: "sync-1",
    at: new Date("2026-10-28T08:00:00Z"),
    kind: "sync",
    title: "NationStates region sync: lazarus",
    subject: null,
    detail: null,
    actor: "System",
    ok: false,
  },
];

/** A query result in the shape the tab reads. */
const query = <T,>(data: T | undefined, state: { isLoading?: boolean; isError?: boolean } = {}) =>
  ({ data, isLoading: state.isLoading ?? false, isError: state.isError ?? false }) as never;

const serve = (summaryResult: never, activityResult: never) => {
  jest.mocked(api.cards.admin.overview.summary.useQuery).mockReturnValue(summaryResult);
  jest.mocked(api.cards.admin.overview.activity.useQuery).mockReturnValue(activityResult);
};

describe("OverviewTab", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-28T12:00:00Z"));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the counts, what waits on an admin, and the feed", () => {
    serve(query(summary), query(activity));
    render(<OverviewTab />);
    expect(screen.getByText("Waiting for review")).toBeInTheDocument();
    expect(screen.getByText("1 overdue")).toBeInTheDocument();
    expect(screen.getByText("NationStates")).toBeInTheDocument();
    expect(screen.getByText("Ultra rare")).toBeInTheDocument();
    expect(screen.getByText("IIWiki")).toBeInTheDocument();
    expect(screen.getByText("Rarity overridden: Ahkmala")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("shows who acted, and each detail in the admin's labels", () => {
    serve(query(summary), query(activity));
    render(<OverviewTab />);
    expect(screen.getByText("Rarity Common → Rare: a banner")).toBeInTheDocument();
    expect(screen.queryByText(/COMMON/)).not.toBeInTheDocument();
    expect(screen.getByText("Admin Isles")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("NationStates region sync: lazarus")).toBeInTheDocument();
  });

  it("dates the feed relatively, one separated row per item", () => {
    serve(query(summary), query(activity));
    render(<OverviewTab />);
    expect(screen.getByText("2h ago")).toHaveAttribute("dateTime", "2026-10-28T10:00:00.000Z");
    expect(screen.getByText("4h ago")).toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(list).toHaveAttribute("data-content", "feed");
    expect(list.children).toHaveLength(2);
  });

  it("shows a dash for every count, and no feed, until they load", () => {
    serve(query(undefined, { isLoading: true }), query(undefined, { isLoading: true }));
    render(<OverviewTab />);
    expect(screen.getAllByText("–")).toHaveLength(4);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText("No card activity yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says the feed is empty only once it has loaded empty", () => {
    serve(query(summary), query([]));
    render(<OverviewTab />);
    expect(screen.getByText("No card activity yet")).toBeInTheDocument();
  });

  it("says which part failed to load, instead of a dash", () => {
    serve(query(undefined, { isError: true }), query(undefined, { isError: true }));
    render(<OverviewTab />);
    expect(screen.getAllByRole("alert").map((line) => line.textContent)).toEqual([
      "Card counts did not load. Retrying every 30 seconds.",
      "Card activity did not load. Retrying every 30 seconds.",
    ]);
    expect(screen.queryByText("–")).not.toBeInTheDocument();
  });

  it("keeps the last counts when a later refresh fails", () => {
    serve(query(summary, { isError: true }), query(activity));
    render(<OverviewTab />);
    expect(screen.getByText("1 overdue")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

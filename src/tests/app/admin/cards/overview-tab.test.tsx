import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
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
      title: "Card granted",
      detail: "Granted Elm #3",
      actor: "clerk_admin",
      ok: true,
    },
    {
      id: "sync-1",
      at: new Date("2026-10-28T08:00:00Z"),
      kind: "sync",
      title: "NationStates region sync: lazarus",
      detail: null,
      actor: null,
      ok: false,
    },
  ];
  return {
    api: {
      cards: {
        admin: {
          overview: {
            summary: { useQuery: () => ({ data: summary, isLoading: false }) },
            activity: { useQuery: () => ({ data: activity, isLoading: false }) },
          },
        },
      },
    },
  };
});

import { OverviewTab } from "~/app/admin/cards/overview";

describe("OverviewTab", () => {
  it("shows the counts, what waits on an admin, and the feed", () => {
    render(<OverviewTab />);
    expect(screen.getByText("Waiting for review")).toBeInTheDocument();
    expect(screen.getByText("1 overdue")).toBeInTheDocument();
    expect(screen.getByText("NationStates")).toBeInTheDocument();
    expect(screen.getByText("Ultra rare")).toBeInTheDocument();
    expect(screen.getByText("IIWiki")).toBeInTheDocument();
    expect(screen.getByText("Card granted")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});

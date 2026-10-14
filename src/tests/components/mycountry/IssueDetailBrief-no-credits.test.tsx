import { render, screen } from "@testing-library/react";

const resolvedIssue = {
  id: "i1",
  countryId: "c1",
  title: "Port strike",
  description: "Dockworkers walked out.",
  longDescription: null,
  domain: "economic",
  severity: "medium",
  urgency: 40,
  status: "responded",
  intentId: null,
  deadlineIxTime: null,
  chosenOptionId: "opt-1",
  responseOptions: "[]",
  consequenceLog: "Negotiated a settlement.",
  // A row written before the column was dropped must not surface a reward badge.
  ixCreditsAwarded: 25,
};

const mutation = () => ({ mutate: jest.fn(), isPending: false });
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      nationalIssues: {
        getIssue: { invalidate: jest.fn() },
        getMyIssues: { invalidate: jest.fn() },
        getPendingCount: { invalidate: jest.fn() },
      },
    }),
    nationalIssues: {
      getIssue: { useQuery: () => ({ data: resolvedIssue, isLoading: false }) },
      getReconReveal: { useQuery: () => ({ data: undefined, refetch: jest.fn() }) },
      respond: { useMutation: () => mutation() },
      dismiss: { useMutation: () => mutation() },
      commissionRecon: { useMutation: () => mutation() },
    },
    quickActions: { createMeeting: { useMutation: () => mutation() } },
  },
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));

import { IssueDetailBrief } from "~/components/mycountry/shared/headers/IssueDetailBrief";

describe("IssueDetailBrief outcome", () => {
  it("shows the resolution and never an IxCredits reward", () => {
    const { container } = render(<IssueDetailBrief issueId="i1" />);
    expect(screen.getByText("Decision Made")).toBeTruthy();
    expect(screen.getByText("Negotiated a settlement.")).toBeTruthy();
    expect(container.textContent).not.toContain("+25");
    expect(container.textContent).not.toMatch(/IxCredits/i);
  });
});

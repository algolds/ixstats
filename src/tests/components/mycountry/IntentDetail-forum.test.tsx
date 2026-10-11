import React from "react";
import { render, screen } from "@testing-library/react";

const directive = jest.fn();
const intent = {
  id: "i1",
  goal: "Create jobs",
  tier: "moderate",
  category: "economy",
  status: "active",
  summary: null,
  changesJson: "[]",
  parentId: null,
  target: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
};

jest.mock("~/trpc/react", () => ({
  api: {
    intent: {
      getTree: {
        useQuery: () => ({
          data: { roots: [intent], allIntents: [intent] },
          isLoading: false,
          refetch: jest.fn(),
        }),
      },
      getLinkedIssues: {
        useQuery: () => ({ data: { progress: 0, resolvedCount: 0, totalCount: 0, issues: [] } }),
      },
      updateStatus: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
    },
    actionLinks: {
      directiveActivity: {
        useQuery: (input: { intentId: string }, options: { enabled: boolean }) =>
          directive(input, options),
      },
    },
  },
}));
jest.mock("~/components/action-links/ShareToRealmButton", () => ({
  ShareToRealmButton: ({ activityId }: { activityId: string }) => (
    <button type="button">Share {activityId}</button>
  ),
}));
jest.mock("~/components/mycountry/shared/modals/ThinkPagesShareModal", () => ({
  ThinkPagesShareModal: () => null,
}));

import { IntentDetail } from "~/components/mycountry/shell/IntentDetail";

describe("IntentDetail forum share", () => {
  beforeEach(() => directive.mockReset());

  it("looks the directive's row up by its intent and offers the forum share beside the feed share", () => {
    directive.mockReturnValue({ data: { activityId: "dir-i1" } });
    render(<IntentDetail countryId="c1" intentId="i1" />);
    expect(directive).toHaveBeenCalledWith(
      { intentId: "i1" },
      expect.objectContaining({ enabled: true })
    );
    expect(screen.getByRole("button", { name: "Share dir-i1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Share to the feed/ })).toBeInTheDocument();
  });

  it("offers no forum share for a directive without a public row (an older one)", () => {
    directive.mockReturnValue({ data: null });
    render(<IntentDetail countryId="c1" intentId="i1" />);
    expect(screen.queryByRole("button", { name: /^Share dir/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Share to the feed/ })).toBeInTheDocument();
  });
});

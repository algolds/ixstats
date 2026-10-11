import React from "react";
import { render, screen } from "@testing-library/react";

const captured = jest.fn();
jest.mock("~/components/action-links/DiscussionCountsProvider", () => ({
  DiscussionCountsProvider: ({
    activityIds,
    children,
  }: {
    activityIds: string[];
    children: React.ReactNode;
  }) => {
    captured(activityIds);
    return <>{children}</>;
  },
}));
jest.mock("~/components/action-links/DiscussedIn", () => ({
  DiscussedInBadge: ({ activityId }: { activityId: string }) => (
    <span data-testid="badge">{activityId}</span>
  ),
}));
jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiLinkPreview: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/trpc/react", () => ({
  api: {
    activities: {
      getCountryActivity: {
        useQuery: () => ({
          isLoading: false,
          data: {
            activities: [
              {
                id: "a1",
                type: "directive",
                source: "activity",
                title: "Create jobs",
                description: "Testland declared a moderate directive in economy.",
                timestamp: new Date(),
                engagement: { likes: 0, comments: 0, shares: 0 },
                metadata: null,
              },
              {
                id: "t1",
                type: "social",
                source: "thinkpages",
                title: "A post",
                description: "A post",
                timestamp: new Date(),
                engagement: { likes: 0, comments: 0, shares: 0 },
                metadata: null,
              },
            ],
          },
        }),
      },
    },
  },
}));

import { CountryActivityPanel } from "~/app/countries/[slug]/_components/CountryActivityPanel";

describe("CountryActivityPanel discussed-in badge", () => {
  it("shows the badge on activity rows only, with one counts request for them", () => {
    render(<CountryActivityPanel countryId="c1" countryName="Testland" />);
    expect(screen.getAllByTestId("badge").map((b) => b.textContent)).toEqual(["a1"]);
    expect(captured).toHaveBeenLastCalledWith(["a1"]);
  });
});

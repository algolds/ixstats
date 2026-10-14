import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/components/achievements/tabs/CountryLeaderboards", () => ({
  CountryLeaderboards: () => <div data-testid="country-boards" />,
}));
jest.mock("~/components/achievements/tabs/LeaderboardTab", () => ({
  LeaderboardTab: () => <div data-testid="player-board" />,
}));
jest.mock("~/components/shell/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import LeaderboardsPage from "~/app/leaderboards/page";

describe("/leaderboards", () => {
  it("is the country boards, not the Vault player board", () => {
    render(<LeaderboardsPage />);
    expect(screen.getByRole("heading", { name: "Global leaderboards" })).toBeInTheDocument();
    expect(screen.getByTestId("country-boards")).toBeInTheDocument();
    expect(screen.queryByTestId("player-board")).toBeNull();
  });
});

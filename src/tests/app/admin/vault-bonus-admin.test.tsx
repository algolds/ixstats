import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const mutate = jest.fn();

// One data object for every render: the component copies it into its form in an effect keyed on it.
jest.mock("~/trpc/react", () => {
  const data = {
    enabled: 1,
    newPlayer: 5000,
    wikiImport: 2500,
    nsPerCard: 50,
    nsCap: 5000,
    achievementCommon: 100,
    achievementUncommon: 250,
    achievementRare: 500,
    achievementEpic: 1000,
    achievementLegendary: 2500,
    forumActionReward: 5,
    forumActionDailyCap: 3,
  };
  const refetch = jest.fn();
  return {
    api: {
      cards: {
        getBonusConfig: { useQuery: () => ({ isLoading: false, refetch, data }) },
        setBonusConfig: { useMutation: () => ({ mutate, isPending: false }) },
      },
    },
  };
});
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));

import { VaultBonusAdmin } from "~/app/admin/vault/VaultBonusAdmin";

describe("VaultBonusAdmin forum group", () => {
  beforeEach(() => mutate.mockClear());

  it("lists the forum action reward and daily cap with their units", () => {
    render(<VaultBonusAdmin />);
    expect(screen.getByText("Forum actions")).toBeInTheDocument();
    expect(screen.getByText("Reward per action")).toBeInTheDocument();
    expect(screen.getByText("Rewarded actions per day")).toBeInTheDocument();
    expect(screen.getByText("per day")).toBeInTheDocument();
  });

  it("saves an edited reward with the rest of the form", () => {
    render(<VaultBonusAdmin />);
    fireEvent.change(screen.getByLabelText("Reward per action"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Bonus Policies/ }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ forumActionReward: 8, forumActionDailyCap: 3 })
    );
  });

  it("makes the daily cap a whole-number input from 0 to 100", () => {
    render(<VaultBonusAdmin />);
    const cap = screen.getByLabelText("Rewarded actions per day");
    expect(cap).toHaveAttribute("step", "1");
    expect(cap).toHaveAttribute("min", "0");
    expect(cap).toHaveAttribute("max", "100");
  });

  it("bounds the reward at 1000 and leaves the other credit fields unbounded", () => {
    render(<VaultBonusAdmin />);
    expect(screen.getByLabelText("Reward per action")).toHaveAttribute("max", "1000");
    expect(screen.getByLabelText("New player bonus")).not.toHaveAttribute("max");
    expect(screen.getByLabelText("New player bonus")).toHaveAttribute("step", "any");
  });

  it("rounds a fractional daily cap instead of sending the fraction", () => {
    render(<VaultBonusAdmin />);
    fireEvent.change(screen.getByLabelText("Rewarded actions per day"), {
      target: { value: "4.6" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Bonus Policies/ }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ forumActionDailyCap: 5 }));
  });

  it("clamps a daily cap past the server's limit to 100", () => {
    render(<VaultBonusAdmin />);
    fireEvent.change(screen.getByLabelText("Rewarded actions per day"), {
      target: { value: "250" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Bonus Policies/ }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ forumActionDailyCap: 100 }));
  });
});

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const mutate = jest.fn();

// One data object for every render: the component copies it into its form in an effect keyed on it.
jest.mock("~/trpc/react", () => {
  const data = {
    enabled: 1,
    newPlayer: 5000,
    nsPerCard: 50,
    nsCap: 5000,
    achievementCommon: 100,
    achievementUncommon: 250,
    achievementRare: 500,
    achievementEpic: 1000,
    achievementLegendary: 2500,
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

describe("VaultBonusAdmin", () => {
  beforeEach(() => mutate.mockClear());

  it("lists no forum action or wiki import fields, which no longer pay", () => {
    render(<VaultBonusAdmin />);
    expect(screen.queryByText("Forum actions")).not.toBeInTheDocument();
    expect(screen.queryByText("Reward per action")).not.toBeInTheDocument();
    expect(screen.queryByText("Wiki country import")).not.toBeInTheDocument();
    expect(screen.getByLabelText("New player bonus")).toBeInTheDocument();
  });

  it("saves an edited amount with the rest of the form", () => {
    render(<VaultBonusAdmin />);
    fireEvent.change(screen.getByLabelText("New player bonus"), { target: { value: "4000" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Bonus Policies/ }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ newPlayer: 4000, nsCap: 5000 }));
  });
});

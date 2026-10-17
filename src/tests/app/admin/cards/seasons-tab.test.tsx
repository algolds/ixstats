import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    cards: {
      admin: { seasons: { get: { useQuery: jest.fn() }, set: { useMutation: jest.fn() } } },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));

import { api } from "~/trpc/react";
import { SeasonsTab } from "~/app/admin/cards/seasons";

it("sets the card season and says nation editions arrive with seasons", () => {
  const set = jest.fn();
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { seasons: { get: { invalidate: jest.fn() } } } },
  } as never);
  jest.mocked(api.cards.admin.seasons.get.useQuery).mockReturnValue({ data: 3 } as never);
  jest
    .mocked(api.cards.admin.seasons.set.useMutation)
    .mockReturnValue({ mutate: set, isPending: false } as never);
  render(<SeasonsTab />);
  fireEvent.change(screen.getByLabelText("Card season"), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "Save season" }));
  expect(set).toHaveBeenCalledWith({ season: 4 });
  expect(screen.getByText("Nation editions start with site seasons")).toBeInTheDocument();
});

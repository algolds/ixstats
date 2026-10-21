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

const set = jest.fn();

const serve = (query: { data?: number; isError?: boolean }) => {
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { seasons: { get: { invalidate: jest.fn() } } } },
  } as never);
  jest.mocked(api.cards.admin.seasons.get.useQuery).mockReturnValue(query as never);
  jest
    .mocked(api.cards.admin.seasons.set.useMutation)
    .mockReturnValue({ mutate: set, isPending: false } as never);
};

const type = (value: string) =>
  fireEvent.change(screen.getByLabelText("Card season"), { target: { value } });
const saveButton = () => screen.getByRole("button", { name: "Save season" });

beforeEach(() => set.mockClear());

it("sets the card season and says nation editions arrive with seasons", () => {
  serve({ data: 3 });
  render(<SeasonsTab />);
  type("4");
  fireEvent.click(saveButton());
  expect(set).toHaveBeenCalledWith({ season: 4 });
  expect(screen.getByText("Nation editions start with site seasons")).toBeInTheDocument();
});

it("keeps Save off while the season is unchanged", () => {
  serve({ data: 3 });
  render(<SeasonsTab />);
  expect(saveButton()).toBeDisabled();
  type("4");
  expect(saveButton()).toBeEnabled();
  type("3");
  expect(saveButton()).toBeDisabled();
});

it.each(["0", "101", "-1", "2.5"])("hints and blocks Save for %s", (value) => {
  serve({ data: 3 });
  render(<SeasonsTab />);
  type(value);
  expect(screen.getByText("Enter a whole number from 1 to 100.")).toBeInTheDocument();
  expect(saveButton()).toBeDisabled();
});

it("says so when the season did not load", () => {
  serve({ isError: true });
  render(<SeasonsTab />);
  expect(screen.getByRole("alert")).toHaveTextContent("The card season did not load");
});

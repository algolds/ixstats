/** Suggesting a lore card: free, for an article with no card, and the player sees how each suggestion went. */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    cards: {
      mySuggestions: { useQuery: jest.fn() },
      suggestCard: { useMutation: jest.fn() },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/cards/suggest/ArticleSearch", () => ({
  ArticleSearch: ({ id, onSelect }: { id?: string; onSelect: (title: string) => void }) => (
    <input id={id} onChange={(event) => onSelect(event.target.value)} />
  ),
}));

import { api } from "~/trpc/react";
import { CardSuggestionForm } from "~/components/cards/suggest/CardSuggestionForm";

describe("CardSuggestionForm", () => {
  it("suggests the chosen article from the chosen wiki, and lists the player's suggestions", () => {
    const suggest = jest.fn();
    jest.mocked(api.useUtils).mockReturnValue({
      cards: { mySuggestions: { invalidate: jest.fn() } },
    } as never);
    jest.mocked(api.cards.mySuggestions.useQuery).mockReturnValue({
      data: [
        {
          id: "r1",
          articleTitle: "Oak",
          wikiSource: "ixwiki",
          status: "REJECTED",
          requestedAt: new Date(),
          rejectionReason: "Not a lore article",
        },
      ],
    } as never);
    jest
      .mocked(api.cards.suggestCard.useMutation)
      .mockReturnValue({ mutate: suggest, isPending: false } as never);

    render(<CardSuggestionForm />);
    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.getByText("IxWiki · Not a lore article")).toBeInTheDocument();

    const send = screen.getByRole("button", { name: "Suggest this article" });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "IIWiki" }));
    fireEvent.change(screen.getByLabelText("Article"), { target: { value: "Elm" } });
    fireEvent.click(send);
    expect(suggest).toHaveBeenCalledWith({ source: "iiwiki", title: "Elm" });
  });
});

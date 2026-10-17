/** The Curation tab: the review queue (imports wait here before packs) and players' free suggestions. */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    cards: {
      admin: {
        overview: { realms: { useQuery: jest.fn() } },
        curation: {
          queue: { useQuery: jest.fn() },
          review: { useMutation: jest.fn() },
          suggestions: { useQuery: jest.fn() },
          acceptSuggestion: { useMutation: jest.fn() },
          declineSuggestion: { useMutation: jest.fn() },
        },
      },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { api } from "~/trpc/react";
import { CurationTab } from "~/app/admin/cards/curation";

const curation = api.cards.admin.curation;

function setUp() {
  const review = jest.fn();
  const accept = jest.fn();
  const decline = jest.fn();
  jest.mocked(api.useUtils).mockReturnValue({
    cards: {
      admin: {
        curation: { queue: { invalidate: jest.fn() }, suggestions: { invalidate: jest.fn() } },
        overview: { summary: { invalidate: jest.fn() } },
      },
    },
  } as never);
  jest
    .mocked(api.cards.admin.overview.realms.useQuery)
    .mockReturnValue({ data: [{ id: "iiwiki", name: "IIWiki", isSystem: true }] } as never);
  jest.mocked(curation.queue.useQuery).mockReturnValue({
    data: {
      cards: [
        {
          id: "card_1",
          title: "Union Assembly",
          cardType: "LORE",
          rarity: "RARE",
          wikiSource: "iiwiki",
          wikiArticleTitle: "Union Assembly",
          wikiExcerpt: "The legislature.",
          createdAt: new Date(),
          realm: { id: "iiwiki", name: "IIWiki" },
          artLicence: {
            status: "UNKNOWN",
            licence: null,
            attribution: null,
            descriptionUrl: "https://iiwiki.com/wiki/File:Assembly.png",
          },
        },
      ],
      total: 1,
      nextCursor: null,
    },
  } as never);
  jest
    .mocked(curation.review.useMutation)
    .mockReturnValue({ mutate: review, isPending: false } as never);
  jest.mocked(curation.suggestions.useQuery).mockReturnValue({
    data: [
      {
        id: "req_1",
        articleTitle: "Elm",
        wikiSource: "iiwiki",
        realmName: "IIWiki",
        status: "PENDING",
        requestedAt: new Date(),
        rejectionReason: null,
      },
    ],
  } as never);
  jest
    .mocked(curation.acceptSuggestion.useMutation)
    .mockReturnValue({ mutate: accept, isPending: false } as never);
  jest
    .mocked(curation.declineSuggestion.useMutation)
    .mockReturnValue({ mutate: decline, isPending: false } as never);
  return { review, accept, decline };
}

/** Radix tabs switch on mouse down, as a pointer press does. */
const openSuggestions = () =>
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Suggestions" }), { button: 0 });

const giveReason = (reason: string) =>
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: reason } });

describe("CurationTab", () => {
  it("approves the chosen pending cards, and accepts a suggestion", () => {
    const { review, accept } = setUp();
    render(<CurationTab />);
    expect(screen.getByText("Licence unknown")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the article" })).toHaveAttribute(
      "href",
      "/wiki/Union_Assembly?source=iiwiki"
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Union Assembly" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve 1" }));
    expect(review).toHaveBeenCalledWith({ decision: "APPROVE", cardIds: ["card_1"] });

    openSuggestions();
    fireEvent.click(screen.getByRole("button", { name: "Make a card" }));
    expect(accept).toHaveBeenCalledWith({ requestId: "req_1" });
  });

  it("rejects the chosen cards with a reason", () => {
    const { review } = setUp();
    render(<CurationTab />);
    expect(screen.getByRole("button", { name: "Reject 0" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Union Assembly" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject 1" }));
    expect(screen.getByRole("dialog", { name: "Reject 1 card" })).toBeInTheDocument();
    giveReason("Wrong region");
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(review).toHaveBeenCalledWith({
      decision: "REJECT",
      cardIds: ["card_1"],
      note: "Wrong region",
    });
  });

  it("asks before approving every card the filter shows", () => {
    const { review } = setUp();
    render(<CurationTab />);
    fireEvent.click(screen.getByRole("button", { name: "Approve all 1" }));
    expect(review).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Approve all" }));
    expect(review).toHaveBeenCalledWith({ decision: "APPROVE", filter: { realm: "admin" } });
  });

  it("filters the queue, and a filter change clears the choice", () => {
    const { review } = setUp();
    render(<CurationTab />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Union Assembly" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Realm" }));
    fireEvent.click(screen.getByRole("option", { name: "IIWiki" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Type" }));
    fireEvent.click(screen.getByRole("option", { name: "Lore" }));
    expect(jest.mocked(curation.queue.useQuery)).toHaveBeenLastCalledWith({
      realm: "iiwiki",
      cardType: "LORE",
      limit: 100,
    });
    expect(screen.getByRole("button", { name: "Approve 0" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Approve all 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve all" }));
    expect(review).toHaveBeenCalledWith({
      decision: "APPROVE",
      filter: { realm: "iiwiki", cardType: "LORE" },
    });
  });

  it("declines a suggestion with the reason the player will see", () => {
    const { decline } = setUp();
    render(<CurationTab />);
    openSuggestions();
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    giveReason("Not a lore article");
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(decline).toHaveBeenCalledWith({ requestId: "req_1", reason: "Not a lore article" });
  });
});

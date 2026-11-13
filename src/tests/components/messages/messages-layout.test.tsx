import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    notifications: {
      getUserNotifications: {
        useQuery: () => ({ data: undefined }),
      },
    },
    wikios: {
      getRecentChanges: {
        useQuery: () => ({ data: undefined }),
      },
    },
  },
}));

import MessagesRouteLayout from "~/app/messages/layout";
import MessagesLoading from "~/app/messages/loading";
import { MessagesConversationPanel } from "~/components/messages/MessagesConversationPanel";
import { MessagesLayout } from "~/components/messages/MessagesLayout";

describe("Messages layout & Facet 5 Lens support", () => {
  it("stretches near full width without a centered max-w-7xl cap", () => {
    const { container } = render(
      <MessagesRouteLayout>
        <div data-testid="child">Content</div>
      </MessagesRouteLayout>
    );

    const wrapper = container.firstElementChild!;
    expect(wrapper).toHaveClass("w-full");
    expect(wrapper).not.toHaveClass("max-w-7xl");
    expect(screen.getByRole("heading", { name: "Messages" })).toHaveClass("sr-only");
  });

  it("renders MessagesLayout on a Facet 5 LensCard over the monogram planes and stops interactive monogram when a conversation is open", () => {
    const { container, rerender } = render(
      <MessagesLayout
        rail={<div>Inbox rail</div>}
        thread={<div>Thread stream</div>}
        hasThread={false}
      />
    );

    const lensCard = container.querySelector("[data-slot='lens-card']")!;
    expect(lensCard).toBeInTheDocument();
    expect(lensCard).toHaveAttribute("data-monogram-interactive", "true");
    expect(lensCard.querySelectorAll(".facet-monogram")).toHaveLength(2);

    const card = lensCard.querySelector("[data-slot='card']")!;
    expect(card).toHaveAttribute("data-variant", "lens");
    expect(card).toHaveClass("facet-lens");
    expect(screen.getByRole("region", { name: "Conversations" })).toHaveTextContent("Inbox rail");
    expect(screen.getByRole("region", { name: "Thread", hidden: true })).toHaveTextContent(
      "Thread stream"
    );

    rerender(
      <MessagesLayout
        rail={<div>Inbox rail</div>}
        thread={<div>Thread stream</div>}
        hasThread={true}
      />
    );

    expect(lensCard).toHaveAttribute("data-monogram-interactive", "false");
    expect(lensCard.querySelectorAll(".facet-monogram")).toHaveLength(2);
  });

  it("renders MessagesLoading on the same Facet 5 LensCard surface", () => {
    const { container } = render(<MessagesLoading />);
    const card = container.querySelector("[data-slot='card']")!;
    expect(card).toHaveAttribute("data-variant", "lens");
    expect(card).toHaveClass("facet-lens");
  });

  it("renders MessagesConversationPanel without channel filter tabs and keeps pinned + all non-thinktank threads", () => {
    render(
      <MessagesConversationPanel
        activeFolder="conversations"
        conversations={[]}
        isLoading={false}
        searchQuery=""
        onSearchChange={jest.fn()}
        selectedConversationId={null}
        onSelectConversation={jest.fn()}
        currentUserId="user-1"
        onNewConversation={jest.fn()}
      />
    );

    expect(screen.getByLabelText("Search messages")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New/i })).toBeInTheDocument();
    expect(screen.getByText("System messages")).toBeInTheDocument();
    expect(screen.getByText("LoreBot")).toBeInTheDocument();
    expect(screen.queryByLabelText("Channel filter")).not.toBeInTheDocument();
  });
});

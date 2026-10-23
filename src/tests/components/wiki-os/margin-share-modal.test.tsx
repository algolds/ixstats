/**
 * Margin's share modal lists the viewer's recent conversations by the names messaging gives their other participants,
 * never by an old wiki name.
 */
import { render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    messages: {
      getConversationsByFolder: { useQuery: jest.fn() },
      sendMessage: { useMutation: jest.fn(() => ({ mutate: jest.fn() })) },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));

import { api } from "~/trpc/react";
import { MarginShareModal } from "~/components/wiki-os/margin/modals/MarginShareModal";

function renderWith(conversations: object[]) {
  jest
    .mocked(api.messages.getConversationsByFolder.useQuery)
    .mockReturnValue({ data: { conversations, nextCursor: null } } as never);
  render(
    <MarginShareModal
      isOpen
      onClose={jest.fn()}
      articleTitle="Urcea"
      quoteText="A quote"
      isAuthenticated
    />
  );
}

it("names each conversation by its other participants", () => {
  renderWith([
    {
      id: "c1",
      name: null,
      otherParticipants: [
        { displayName: "Urcea", wikiUsername: "Wiki Ruler" },
        { displayName: "Caphiria" },
      ],
    },
  ]);
  expect(screen.getByText("Urcea, Caphiria")).toBeTruthy();
  expect(screen.queryByText(/Wiki Ruler/)).toBeNull();
});

it("falls back to the conversation's name, then to Conversation", () => {
  renderWith([
    { id: "c1", name: "Summit", otherParticipants: [] },
    { id: "c2", name: null, otherParticipants: [] },
  ]);
  expect(screen.getByText("Summit")).toBeTruthy();
  expect(screen.getByText("Conversation")).toBeTruthy();
});

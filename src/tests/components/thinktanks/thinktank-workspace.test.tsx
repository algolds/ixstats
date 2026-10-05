import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const refetch = jest.fn();
let byId: Record<string, unknown> = {};
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      thinkpages: {
        getThinktankById: { invalidate: jest.fn() },
        getThinktanks: { invalidate: jest.fn() },
      },
    }),
    thinkpages: {
      getThinktanks: { useQuery: () => ({ data: [], isLoading: false }) },
      getThinktankById: { useQuery: () => byId },
      joinThinktank: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
      leaveThinktank: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
    },
  },
}));
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: { id: "u1" } }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/lib/sound/cuelume", () => ({
  soundEffects: { press: jest.fn(), success: jest.fn(), error: jest.fn(), release: jest.fn() },
}));
jest.mock("~/components/thinktanks/ThinktankLayout", () => ({
  ThinktankLayout: ({ workspacePanel }: { workspacePanel: React.ReactNode }) => (
    <div>{workspacePanel}</div>
  ),
}));
jest.mock("~/components/thinktanks/ThinktankDirectory", () => ({
  ThinktankDirectory: () => null,
}));
jest.mock("~/components/thinktanks/ThinktankHeader", () => ({ ThinktankHeader: () => null }));
jest.mock("~/components/thinktanks/ThinktankFeedTab", () => ({ ThinktankFeedTab: () => null }));
jest.mock("~/components/thinktanks/ThinktankPapersTab", () => ({
  ThinktankPapersTab: () => null,
}));
jest.mock("~/components/thinktanks/ThinktankRosterTab", () => ({
  ThinktankRosterTab: () => null,
}));
jest.mock("~/components/thinktanks/ThinktankChatTab", () => ({ ThinktankChatTab: () => null }));
jest.mock("~/components/thinktanks/ThinktankSettingsModal", () => ({
  ThinktankSettingsModal: () => null,
}));
jest.mock("~/components/thinktanks/ThinktankCreateModal", () => ({
  ThinktankCreateModal: () => null,
}));

// eslint-disable-next-line import/first
import { ThinktankWorkspace } from "~/components/thinktanks/ThinktankWorkspace";

beforeEach(() => {
  push.mockClear();
  refetch.mockClear();
});

describe("ThinktankWorkspace group states", () => {
  it("says the group was not found when the fetch succeeded with nothing", () => {
    byId = { data: null, isLoading: false, isError: false, refetch };
    render(<ThinktankWorkspace initialGroupId="g1" />);
    expect(screen.getByText("Group not found")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this ThinkTank")).toBeNull();
  });

  it("shows a retryable error, not 'not found', when the fetch failed", () => {
    byId = { data: undefined, isLoading: false, isError: true, refetch };
    render(<ThinktankWorkspace initialGroupId="g1" />);
    expect(screen.getByText("Couldn't load this ThinkTank")).toBeInTheDocument();
    expect(screen.queryByText("Group not found")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

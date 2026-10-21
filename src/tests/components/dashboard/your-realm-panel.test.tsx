import "react";
import { render, screen, within } from "@testing-library/react";
import type { BoardPreviewMessage } from "~/lib/thinkpages-forum/preview";
import type { BoardPreview } from "~/server/modules/thinkpages-forum/board-preview";

interface PanelOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
  retry?: boolean;
}

const state: {
  panel: BoardPreview | null | undefined;
  counts: { realmBoardNew: number } | undefined;
  loading: boolean;
  panelOptions: PanelOptions | undefined;
  countsOptions: PanelOptions | undefined;
  signedIn: boolean;
} = {
  panel: undefined,
  counts: undefined,
  loading: false,
  panelOptions: undefined,
  countsOptions: undefined,
  signedIn: true,
};

jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ isSignedIn: state.signedIn }),
}));

jest.mock("~/trpc/react", () => ({
  api: {
    thinkpagesForum: {
      realmPanel: {
        useQuery: (_input: undefined, options: PanelOptions) => {
          state.panelOptions = options;
          return { data: state.panel, isLoading: state.loading };
        },
      },
      navCounts: {
        useQuery: (_input: undefined, options: PanelOptions) => {
          state.countsOptions = options;
          return { data: state.counts };
        },
      },
    },
  },
}));

import { YourRealmPanel } from "~/components/dashboard/sections/YourRealmPanel";

const panel = (messages: BoardPreviewMessage[] = []): BoardPreview => ({
  realm: { slug: "eurth", name: "Eurth", emblemUrl: "/img/e.png", thumbnail: null },
  messages,
});
const message = (
  id: string,
  name: string,
  excerpt: string,
  persona = false
): BoardPreviewMessage => ({
  id,
  author: {
    name,
    avatarUrl: null,
    flagUrl: persona ? null : "https://flags.example/e.png",
    persona,
    personaType: persona ? "media" : null,
  },
  excerpt,
  createdAt: new Date(Date.now() - 60_000),
  href: `/thinkpages/r/eurth#post-${id}`,
});

beforeEach(() => {
  state.panel = undefined;
  state.counts = undefined;
  state.loading = false;
  state.panelOptions = undefined;
  state.countsOptions = undefined;
  state.signedIn = true;
});

describe("YourRealmPanel", () => {
  it("renders nothing without a realm", () => {
    state.panel = null;
    const { container } = render(<YourRealmPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the read has no data and is not loading (signed out or failed)", () => {
    const { container } = render(<YourRealmPanel />);
    expect(container).toBeEmptyDOMElement();
  });
  it("names the realm, counts the new messages and lists the latest three", () => {
    state.panel = panel([
      message("p3", "jane", "Third"),
      message("p2", "Eurth Daily", "Second", true),
      message("p1", "bob", "First"),
    ]);
    state.counts = { realmBoardNew: 4 };
    render(<YourRealmPanel />);
    const region = screen.getByRole("region", { name: "Your realm, Eurth" });
    expect(region).toHaveAttribute("data-content", "entity");
    expect(within(region).getByRole("heading", { name: "Eurth" })).toBeInTheDocument();
    expect(within(region).getByText("4 new on the board")).toBeInTheDocument();
    expect(within(region).getAllByRole("link", { name: /Third|Second|First/ })).toHaveLength(3);
    expect(within(region).getByRole("link", { name: "Open the board" })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth"
    );
    expect(within(region).getByRole("link", { name: "Forums" })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth/hub"
    );
  });
  it("enables both reads only for a signed-in viewer", () => {
    state.panel = panel([]);
    const { unmount } = render(<YourRealmPanel />);
    expect(state.panelOptions).toMatchObject({ enabled: true });
    expect(state.countsOptions).toMatchObject({ enabled: true });
    unmount();
    state.signedIn = false;
    render(<YourRealmPanel />);
    expect(state.panelOptions).toMatchObject({ enabled: false });
    expect(state.countsOptions).toMatchObject({ enabled: false });
  });
});

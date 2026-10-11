import React from "react";
import { render, screen, within } from "@testing-library/react";
import type { BoardPreviewMessage } from "~/lib/thinkpages-forum/preview";
import type { BoardPreview } from "~/server/modules/thinkpages-forum/board-preview";

interface PanelOptions {
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
  retry?: boolean;
}

const state: {
  panel: BoardPreview | null | undefined;
  counts: { watchedUnread: number; realmBoardNew: number } | undefined;
  loading: boolean;
  panelOptions: PanelOptions | undefined;
} = { panel: undefined, counts: undefined, loading: false, panelOptions: undefined };

jest.mock("~/trpc/react", () => ({
  api: {
    thinkpagesForum: {
      realmPanel: {
        useQuery: (_input: undefined, options: PanelOptions) => {
          state.panelOptions = options;
          return { data: state.panel, isLoading: state.loading };
        },
      },
      navCounts: { useQuery: () => ({ data: state.counts }) },
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
});

describe("YourRealmPanel", () => {
  it("renders nothing without a realm", () => {
    state.panel = null;
    const { container } = render(<YourRealmPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the read has not answered and is not loading", () => {
    const { container } = render(<YourRealmPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a skeleton while loading", () => {
    state.loading = true;
    const { container } = render(<YourRealmPanel />);
    expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("names the realm, counts the new messages and lists the latest three", () => {
    state.panel = panel([
      message("p3", "jane", "Third"),
      message("p2", "Eurth Daily", "Second", true),
      message("p1", "bob", "First"),
    ]);
    state.counts = { watchedUnread: 0, realmBoardNew: 4 };
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

  it("shows the realm emblem on every viewport", () => {
    state.panel = panel([message("p1", "jane", "Hi")]);
    const { container } = render(<YourRealmPanel />);
    expect(container.querySelector("img[src*='e.png']")).not.toBeNull();
    expect(container.querySelector(".hidden")).toBeNull();
  });

  it("keeps the two links at the coarse-pointer touch height", () => {
    state.panel = panel([]);
    render(<YourRealmPanel />);
    expect(screen.getByRole("link", { name: "Open the board" }).className).toContain(
      "pointer-coarse:min-h-11"
    );
    expect(screen.getByRole("link", { name: "Forums" }).className).toContain(
      "pointer-coarse:min-h-11"
    );
  });

  it("caps the count label at 99+", () => {
    state.panel = panel([message("p1", "jane", "Hi")]);
    state.counts = { watchedUnread: 0, realmBoardNew: 100 };
    render(<YourRealmPanel />);
    expect(screen.getByText("99+ new on the board")).toBeInTheDocument();
  });

  it("says the member is up to date when nothing is new, or while the count is unknown", () => {
    state.panel = panel([message("p1", "jane", "Hi")]);
    state.counts = { watchedUnread: 0, realmBoardNew: 0 };
    const { rerender } = render(<YourRealmPanel />);
    expect(screen.getByText("Up to date on the board")).toBeInTheDocument();
    state.counts = undefined;
    rerender(<YourRealmPanel />);
    expect(screen.getByText("Up to date on the board")).toBeInTheDocument();
  });

  it("explains an empty board and still links to it", () => {
    state.panel = panel([]);
    render(<YourRealmPanel />);
    expect(screen.getByText("No messages on the board yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the board" })).toBeInTheDocument();
  });

  it("refreshes once a minute at most, not on focus, and does not retry", () => {
    state.panel = panel([]);
    render(<YourRealmPanel />);
    expect(state.panelOptions).toMatchObject({
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    });
  });
});

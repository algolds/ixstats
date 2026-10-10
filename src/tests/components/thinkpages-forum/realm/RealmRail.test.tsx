import React from "react";
import { render, screen, within } from "@testing-library/react";
import {
  BoardsPanel,
  OnlinePanel,
  RecentActionsPanel,
  railHasContent,
  type RailAction,
  type RailBoard,
} from "~/components/thinkpages-forum/realm/RealmRail";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const boards: RailBoard[] = [
  {
    key: "hub",
    name: "Hub",
    description: "Out-of-character talk for the realm.",
    icAllowed: false,
    postRole: "any",
    threadCount: 4,
    lastPostAt: ago(5),
    latest: { threadId: "t1", threadTitle: "Harbour tax", at: ago(5) },
  },
  {
    key: "character-threads",
    name: "Character Threads",
    description: "",
    icAllowed: true,
    postRole: "any",
    threadCount: 0,
    lastPostAt: null,
    latest: null,
  },
];

const action = (n: number): RailAction => ({
  id: `activity:${n}`,
  at: ago(n * 60),
  kind: "activity",
  text: `Action ${n}`,
  href: null,
});

describe("BoardsPanel", () => {
  it("lists each board as a link to it, with its latest thread and how long ago", () => {
    render(<BoardsPanel slug="eurth" boards={boards} />);
    expect(screen.getByRole("heading", { level: 2, name: "Boards" })).toBeInTheDocument();
    const hub = screen.getByRole("link", { name: /Hub/ });
    expect(hub).toHaveAttribute("href", "/thinkpages/r/eurth/hub");
    expect(within(hub).getByText("Harbour tax")).toBeInTheDocument();
    expect(within(hub).getByText("5m ago")).toBeInTheDocument();
  });

  it("says a board with no thread is empty", () => {
    render(<BoardsPanel slug="eurth" boards={boards} />);
    const link = screen.getByRole("link", { name: /Character Threads/ });
    expect(link).toHaveAttribute("href", "/thinkpages/r/eurth/character-threads");
    expect(within(link).getByText("No threads yet")).toBeInTheDocument();
  });

  it("renders nothing without boards", () => {
    render(<BoardsPanel slug="eurth" boards={[]} />);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});

describe("OnlinePanel", () => {
  it("counts who is online now", () => {
    render(<OnlinePanel online={6} />);
    expect(screen.getByRole("heading", { level: 2, name: "Online now" })).toBeInTheDocument();
    expect(screen.getByText("6 online")).toBeInTheDocument();
  });

  it("says one person is online", () => {
    render(<OnlinePanel online={1} />);
    expect(screen.getByText("1 online")).toBeInTheDocument();
  });

  it("is left out while the count is unknown", () => {
    render(<OnlinePanel online={null} />);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});

describe("RecentActionsPanel", () => {
  it("names the realm and shows each action with its age, five at most", () => {
    render(<RecentActionsPanel realmName="Eurth" actions={[1, 2, 3, 4, 5, 6].map(action)} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Recent actions in Eurth" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("Action 1")).toBeInTheDocument();
    expect(screen.getByText("1h ago")).toBeInTheDocument();
    expect(screen.queryByText("Action 6")).toBeNull();
  });

  it("renders nothing without actions", () => {
    render(<RecentActionsPanel realmName="Eurth" actions={[]} />);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});

describe("railHasContent", () => {
  const none = { boards: [], online: null, actions: [], canManageSettings: false };

  it("is false when no panel has anything to show", () => {
    expect(railHasContent(none)).toBe(false);
  });

  it("is true when any one panel has", () => {
    expect(railHasContent({ ...none, boards })).toBe(true);
    expect(railHasContent({ ...none, online: 0 })).toBe(true);
    expect(railHasContent({ ...none, actions: [action(1)] })).toBe(true);
    expect(railHasContent({ ...none, canManageSettings: true })).toBe(true);
  });
});

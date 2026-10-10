import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const mutations: Record<string, jest.Mock> = {};
  const mutation = (name: string) => ({
    useMutation: () => ({ mutateAsync: mutations[name], isPending: false }),
  });
  return {
    mutations,
    api: {
      useUtils: () => ({
        thinkpagesForum: { isThreadStashed: { invalidate: () => Promise.resolve() } },
      }),
      thinkpagesForum: {
        isThreadStashed: { useQuery: () => ({ data: { stashed: false }, isLoading: false }) },
        stashThread: mutation("stashThread"),
        unstashThread: mutation("unstashThread"),
        report: mutation("report"),
      },
      thinkpagesForumMod: {
        setThreadFlag: mutation("setThreadFlag"),
        moveThread: mutation("moveThread"),
      },
    },
  };
});
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
  return { notify, useNotify: () => notify };
});
// Radix DropdownMenu opens on pointer events jsdom does not model; render its items inline.
jest.mock("~/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: (event: Event) => void;
  }) => (
    <button type="button" role="menuitem" onClick={() => onSelect?.(new Event("select"))}>
      {children}
    </button>
  ),
}));

import { ThreadActions } from "~/components/thinkpages-forum/thread/ThreadActions";

const { mutations } = jest.requireMock<{ mutations: Record<string, jest.Mock> }>("~/trpc/react");

function data(over: object = {}) {
  return {
    thread: { id: "t1", locked: false, pinned: false, hidden: false, archived: false },
    style: "ic",
    canModerate: true,
    moderable: true,
    viewerIsAuthor: false,
    moderatorTools: { categories: [{ key: "side", name: "Side", realm: null }] },
    ...over,
  } as never;
}

const refresh = () => Promise.resolve();

describe("ThreadActions in a compact header", () => {
  it("makes Stash and Report icon buttons that keep their accessible names", () => {
    render(
      <ThreadActions
        data={data({ canModerate: false, moderable: false })}
        signedIn
        compact
        refresh={refresh}
      />
    );
    // Icon-only: no visible text, but an accessible name.
    const stash = screen.getByRole("button", { name: "Stash thread" });
    const report = screen.getByRole("button", { name: "Report thread" });
    expect(stash).toHaveTextContent("");
    expect(report).toHaveTextContent("");
    expect(screen.queryByText("In character")).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("offers the moderator one Thread actions menu", () => {
    render(<ThreadActions data={data()} signedIn compact refresh={refresh} />);
    const buttons = screen.getAllByRole("button");
    // Stash and the menu trigger; a moderator is not offered Report.
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Thread actions",
      "Stash thread",
    ]);
    const menu = screen.getByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent)
    ).toEqual(["Lock", "Pin", "Hide", "Archive", "Move"]);
  });

  it("runs an unconfirmed action straight from the menu", async () => {
    const setThreadFlag = jest.fn(() => Promise.resolve());
    mutations.setThreadFlag = setThreadFlag;
    render(<ThreadActions data={data()} signedIn compact refresh={refresh} />);
    fireEvent.click(screen.getByRole("menuitem", { name: "Lock" }));
    await waitFor(() =>
      expect(setThreadFlag).toHaveBeenCalledWith({ threadId: "t1", flag: "locked", value: true })
    );
  });

  it("keeps the confirmation dialogs for Hide and Archive", async () => {
    const setThreadFlag = jest.fn(() => Promise.resolve());
    mutations.setThreadFlag = setThreadFlag;
    render(<ThreadActions data={data()} signedIn compact refresh={refresh} />);
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide" }));
    expect(setThreadFlag).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Hide this thread" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hide thread" }));
    await waitFor(() =>
      expect(setThreadFlag).toHaveBeenCalledWith({ threadId: "t1", flag: "hidden", value: true })
    );
  });

  it("opens the move dialog from the menu", async () => {
    const moveThread = jest.fn(() => Promise.resolve());
    mutations.moveThread = moveThread;
    render(<ThreadActions data={data()} signedIn compact refresh={refresh} />);
    fireEvent.click(screen.getByRole("menuitem", { name: "Move" }));
    const dialog = screen.getByRole("alertdialog", { name: "Move this thread" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Move thread" }));
    await waitFor(() =>
      expect(moveThread).toHaveBeenCalledWith({ threadId: "t1", to: { key: "side" } })
    );
  });

  it("leaves Move out of the menu when there is nowhere to move to", () => {
    render(
      <ThreadActions
        data={data({ moderatorTools: { categories: [] } })}
        signedIn
        compact
        refresh={refresh}
      />
    );
    expect(screen.queryByRole("menuitem", { name: "Move" })).toBeNull();
  });
});

describe("ThreadActions in a wide header", () => {
  it("keeps the labelled buttons and the In character badge", () => {
    render(
      <ThreadActions
        data={data({ canModerate: false, moderable: false })}
        signedIn
        compact={false}
        refresh={refresh}
      />
    );
    expect(screen.getByText("In character")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stash thread" })).toHaveTextContent("Stash thread");
    expect(screen.getByRole("button", { name: "Report thread" })).toHaveTextContent(
      "Report thread"
    );
  });

  it("still gives a moderator the one Thread actions menu, never a row of buttons beside the top chrome", () => {
    render(<ThreadActions data={data()} signedIn compact={false} refresh={refresh} />);
    expect(screen.getByRole("button", { name: "Thread actions" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("menu"))
        .getAllByRole("menuitem")
        .map((i) => i.textContent)
    ).toEqual(["Lock", "Pin", "Hide", "Archive", "Move"]);
    expect(screen.queryByRole("button", { name: "Lock" })).toBeNull();
  });
});

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
        thinkpagesForum: {
          isThreadStashed: { invalidate: () => Promise.resolve() },
          thread: { invalidate: () => Promise.resolve() },
          navCounts: { invalidate: () => Promise.resolve() },
          category: { invalidate: () => Promise.resolve() },
          categories: { invalidate: () => Promise.resolve() },
          realmSection: { invalidate: () => Promise.resolve() },
        },
      }),
      thinkpagesForum: {
        isThreadStashed: { useQuery: () => ({ data: { stashed: false }, isLoading: false }) },
        stashThread: mutation("stashThread"),
        unstashThread: mutation("unstashThread"),
        watchThread: mutation("watchThread"),
        unwatchThread: mutation("unwatchThread"),
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

jest.mock("~/components/thinkpages-forum/advert", () => ({
  AdvertLockButton: ({ iconOnly }: { iconOnly?: boolean }) => (
    <button type="button" data-icon-only={String(!!iconOnly)}>
      Lock advert
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
  it("offers the moderator one Thread actions menu", () => {
    render(<ThreadActions data={data()} signedIn compact refresh={refresh} />);
    const buttons = screen.getAllByRole("button");
    // Watch, Stash and the menu trigger; a moderator is not offered Report.
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Thread actions",
      "Watch thread",
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
  it("offers Watch beside Stash to a signed-in reader, and no Watch to a signed-out one", () => {
    const { rerender } = render(
      <ThreadActions data={data({ watching: false })} signedIn refresh={refresh} compact={false} />
    );
    const watch = screen.getByRole("button", { name: "Watch thread" });
    expect(watch).toHaveAttribute("aria-pressed", "false");
    expect(watch).toHaveTextContent("Watch");
    rerender(
      <ThreadActions data={data({ watching: true })} signedIn refresh={refresh} compact={false} />
    );
    const watching = screen.getByRole("button", { name: "Watch thread" });
    expect(watching).toHaveAttribute("aria-pressed", "true");
    expect(watching).toHaveTextContent("Watching");
    rerender(<ThreadActions data={data()} signedIn={false} refresh={refresh} compact={false} />);
    expect(screen.queryByRole("button", { name: /Watch/ })).toBeNull();
  });

  it("watches and stops watching through the thread's own id", async () => {
    mutations.watchThread = jest.fn(() => Promise.resolve({ watching: true }));
    mutations.unwatchThread = jest.fn(() => Promise.resolve({ watching: false }));
    const { rerender } = render(
      <ThreadActions data={data({ watching: false })} signedIn refresh={refresh} compact={false} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Watch thread" }));
    await waitFor(() => expect(mutations.watchThread).toHaveBeenCalledWith({ threadId: "t1" }));
    rerender(
      <ThreadActions data={data({ watching: true })} signedIn refresh={refresh} compact={false} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Watch thread" }));
    await waitFor(() => expect(mutations.unwatchThread).toHaveBeenCalledWith({ threadId: "t1" }));
  });
});

describe("the advert lock", () => {
  const advert = (over: object = {}) => ({
    realmSlug: "eurth",
    realmName: "Eurth",
    canManage: true,
    closed: false,
    canLock: true,
    ...over,
  });
  const reader = { canModerate: false, moderable: false };
  const lockedThread = { id: "t1", locked: true, pinned: false, hidden: false, archived: false };

  it("offers Lock when the server says the viewer may, as an icon in a compact header", () => {
    render(
      <ThreadActions
        data={data({ ...reader, advert: advert() })}
        signedIn
        compact
        refresh={refresh}
      />
    );
    expect(screen.getByRole("button", { name: "Lock advert" })).toHaveAttribute(
      "data-icon-only",
      "true"
    );
  });
  it("offers nothing on a locked advert: unlocking is the thread bar's", () => {
    render(
      <ThreadActions
        data={data({ ...reader, thread: lockedThread, advert: advert() })}
        signedIn
        compact
        refresh={refresh}
      />
    );
    expect(screen.queryByRole("button", { name: /advert/i })).toBeNull();
  });

  it("is left to the thread bar when the viewer moderates the thread", () => {
    render(<ThreadActions data={data({ advert: advert() })} signedIn compact refresh={refresh} />);
    expect(screen.queryByRole("button", { name: /advert/i })).toBeNull();
  });

  it("is not offered unless the server allows it, nor on an ordinary thread", () => {
    for (const over of [
      { advert: advert({ canManage: false, canLock: false }) },
      { advert: advert({ closed: true, canLock: false }) },
      { advert: null },
    ]) {
      const { unmount } = render(
        <ThreadActions data={data({ ...reader, ...over })} signedIn compact refresh={refresh} />
      );
      expect(screen.queryByRole("button", { name: /advert/i })).toBeNull();
      unmount();
    }
  });
});

/** Halo notification tray: truthful loading/error/empty states, honest mark-all feedback, info colour, one badge count. */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NotificationsView } from "~/components/halo/views/NotificationsView";
import { CompactView } from "~/components/halo/views/CompactView";
import { getColors, type NotificationItem } from "~/components/halo/views/tray/types";
import { useNotificationStore } from "~/stores/notificationStore";

interface QueryState {
  data?: unknown;
  isLoading: boolean;
  isError: boolean;
  refetch: jest.Mock;
}
const idle = (): QueryState => ({
  data: undefined,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
});

let notificationsQuery: QueryState = idle();
let messagesQuery: QueryState = idle();
const markAllAsReadAsync = jest.fn();
const markAllMessagesAsync = jest.fn();
const mockNotify = { success: jest.fn(), error: jest.fn() };
let mockMessageUnread = 0;

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      notifications: {
        getUserNotifications: { invalidate: jest.fn() },
        getUnreadCount: { invalidate: jest.fn() },
      },
    }),
    notifications: {
      getUserNotifications: { useQuery: () => notificationsQuery },
      markAsRead: { useMutation: () => ({ mutate: jest.fn() }) },
      dismissNotification: { useMutation: () => ({ mutate: jest.fn() }) },
      markAllAsRead: {
        useMutation: () => ({ mutateAsync: markAllAsReadAsync, isPending: false }),
      },
    },
    messages: {
      getConversationsByFolder: { useQuery: () => messagesQuery },
      markAllAsRead: {
        useMutation: () => ({ mutateAsync: markAllMessagesAsync, isPending: false }),
      },
    },
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: { id: "u1" }, isLoaded: true, isSignedIn: true }),
}));
jest.mock("~/components/halo/HaloPrimitives", () => ({
  ...jest.requireActual("~/components/halo/HaloPrimitives"),
  useHaloSize: () => ({ size: "tall", setSize: jest.fn() }),
}));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));
jest.mock("~/hooks/useMessageUnreadCount", () => ({
  useMessageUnreadCount: () => ({ totalUnread: mockMessageUnread }),
}));
jest.mock("~/hooks/useContextHour", () => ({ useContextHour: () => 9 }));
jest.mock("~/hooks/useHydrated", () => ({ useHydrated: () => true }));
jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => ({
    activeSectionId: null,
    tocEntries: [],
    narratorState: null,
    themeColors: null,
  }),
}));
jest.mock("~/components/ui/pretext", () => ({
  PreText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

function resetStore() {
  useNotificationStore.setState({
    notifications: [],
    stats: useNotificationStore.getState().stats,
  });
}

beforeEach(() => {
  notificationsQuery = idle();
  messagesQuery = idle();
  mockMessageUnread = 0;
  markAllAsReadAsync.mockReset();
  markAllMessagesAsync.mockReset();
  mockNotify.success.mockReset();
  mockNotify.error.mockReset();
  resetStore();
});

// Radix tabs activate on mouse down.
const openMessagesTab = () =>
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Messages/ }), { button: 0 });

describe("NotificationsView states", () => {
  it("shows skeletons, not the empty copy, while notifications load", () => {
    notificationsQuery = { ...idle(), isLoading: true };
    render(<NotificationsView onClose={jest.fn()} />);
    expect(screen.queryByText("No notifications")).toBeNull();
    expect(screen.getByRole("status", { name: "Loading notifications" })).toBeInTheDocument();
  });

  it("offers a retry when notifications fail to load", () => {
    notificationsQuery = { ...idle(), isError: true };
    render(<NotificationsView onClose={jest.fn()} />);
    expect(screen.queryByText("No notifications")).toBeNull();
    expect(screen.getByText("Couldn't load notifications")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(notificationsQuery.refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the empty copy once loaded with nothing", () => {
    notificationsQuery = { ...idle(), data: { notifications: [], unreadCount: 0 } };
    render(<NotificationsView onClose={jest.fn()} />);
    expect(screen.getByText("No notifications")).toBeInTheDocument();
  });

  it("shows message skeletons and a message retry on the Messages tab", () => {
    messagesQuery = { ...idle(), isLoading: true };
    const { unmount } = render(<NotificationsView onClose={jest.fn()} />);
    openMessagesTab();
    expect(screen.queryByText("No recent messages")).toBeNull();
    expect(screen.getByRole("status", { name: "Loading messages" })).toBeInTheDocument();
    unmount();

    messagesQuery = { ...idle(), isError: true };
    render(<NotificationsView onClose={jest.fn()} />);
    openMessagesTab();
    expect(screen.getByText("Couldn't load messages")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(messagesQuery.refetch).toHaveBeenCalledTimes(1);
  });

  describe("Read all", () => {
    beforeEach(() => {
      notificationsQuery = { ...idle(), data: { notifications: [], unreadCount: 2 } };
    });

    it("announces success only after the mutation resolves", async () => {
      let resolve: () => void = () => {};
      markAllAsReadAsync.mockReturnValue(new Promise<void>((r) => (resolve = r)));
      render(<NotificationsView onClose={jest.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /Read all/ }));
      expect(mockNotify.success).not.toHaveBeenCalled();
      await act(async () => {
        resolve();
      });
      expect(mockNotify.success).toHaveBeenCalledWith("All marked as read");
      expect(mockNotify.error).not.toHaveBeenCalled();
    });

    it("reports a failure instead of success", async () => {
      markAllAsReadAsync.mockRejectedValue(new Error("boom"));
      render(<NotificationsView onClose={jest.fn()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Read all/ }));
      });
      expect(mockNotify.error).toHaveBeenCalledWith("Couldn't mark everything as read");
      expect(mockNotify.success).not.toHaveBeenCalled();
    });
  });
});

describe("tray colours", () => {
  it("paints info blue", () => {
    expect(getColors({ type: "info" } as NotificationItem).text).toBe("text-info");
  });
  it("defaults to info when nothing says otherwise", () => {
    expect(getColors({} as NotificationItem).text).toBe("text-info");
  });
  it("leaves warning as caution", () => {
    expect(getColors({ type: "warning" } as NotificationItem).text).toBe("text-caution");
  });
});

describe("unread count", () => {
  const add = (id: string, status: "delivered" | "dismissed") => ({
    id,
    title: id,
    message: id,
    category: "system" as const,
    priority: "medium" as const,
    status,
    timestamp: Date.now(),
  });

  it("counts each store notification once and skips dismissed ones", () => {
    useNotificationStore.setState({
      notifications: [add("a", "delivered"), add("b", "delivered")] as never,
    });
    // Goes through the real calculateStats, which fills `stats.unread`.
    useNotificationStore.getState().updateNotification("b", { status: "dismissed" });
    expect(useNotificationStore.getState().stats.unread).toBe(1);
    notificationsQuery = { ...idle(), data: { notifications: [], unreadCount: 0 } };

    render(
      <CompactView
        mode="compact"
        isSticky={false}
        isCollapsed={false}
        setIsCollapsed={jest.fn()}
        setIsUserInteracting={jest.fn()}
        onSwitchMode={jest.fn()}
        activePlugin={null}
        pluginCenter={null}
        pluginActions={undefined}
        pluginBadge={undefined}
      />
    );
    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeInTheDocument();
  });
});

/** Halo in-app router navigation tests (Plan 462 Steps 3–4). */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { HaloProvider, SIZE_PRESETS } from "~/components/halo/HaloPrimitives";
import { MyCountryView } from "~/components/halo/plugins/mycountry/views/MyCountryView";
import { NotificationsView } from "~/components/halo/views/NotificationsView";
import { SettingsView } from "~/components/halo/views/SettingsView";

const mockPush = jest.fn();

let mockNotifications: Array<Record<string, unknown>> = [];
let mockConversations: Array<Record<string, unknown>> = [];

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/",
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      countries: { invalidate: jest.fn() },
      notifications: {
        invalidate: jest.fn(),
        getUserNotifications: { invalidate: jest.fn() },
        getUnreadCount: { invalidate: jest.fn() },
      },
    }),
    notifications: {
      getUserNotifications: {
        useQuery: () => ({
          data: { notifications: mockNotifications, unreadCount: 0 },
          isLoading: false,
          isError: false,
          refetch: jest.fn(),
        }),
      },
      markAsRead: { useMutation: () => ({ mutate: jest.fn() }) },
      dismissNotification: { useMutation: () => ({ mutate: jest.fn() }) },
      markAllAsRead: { useMutation: () => ({ mutateAsync: jest.fn(), isPending: false }) },
    },
    messages: {
      getConversationsByFolder: {
        useQuery: () => ({
          data: { conversations: mockConversations },
          isLoading: false,
          isError: false,
          refetch: jest.fn(),
        }),
      },
      markAllAsRead: { useMutation: () => ({ mutateAsync: jest.fn(), isPending: false }) },
    },
    users: {
      getProfile: {
        useQuery: () => ({
          data: {
            countryId: "c1",
            country: {
              id: "c1",
              name: "Caphiria",
              slug: "caphiria",
              currentGdpPerCapita: 40000,
              currentTotalGdp: 800000000000,
              currentPopulation: 20000000,
            },
          },
          isLoading: false,
          isError: false,
          refetch: jest.fn(),
        }),
      },
    },
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: { id: "u1", firstName: "Ada" }, isLoaded: true, isSignedIn: true }),
  SignOutButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/context/theme-context", () => ({
  nextTheme: (t: string) => t,
  useTheme: () => ({
    theme: "dark",
    effectiveTheme: "dark",
    toggleTheme: jest.fn(),
    compactMode: false,
    toggleCompactMode: jest.fn(),
  }),
}));
jest.mock("~/components/wiki-os/shared/MediaThemeContext", () => ({
  useWikiMediaTheme: () => ({ mediaThemeMode: "auto", setMediaThemeMode: jest.fn() }),
}));
jest.mock("~/hooks/useSoundSettings", () => ({
  useSoundSettings: () => ({ enabled: true, setEnabled: jest.fn(), previewSound: jest.fn() }),
}));
jest.mock("~/hooks/usePermissions", () => ({ useCanOpenAdmin: () => true }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/hooks/useMessageUnreadCount", () => ({
  useMessageUnreadCount: () => ({ totalUnread: 0 }),
}));
jest.mock("~/components/shared/country-actions/CountryActionsProvider", () => ({
  useOpenCountryActions: () => jest.fn(),
}));
jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: () => null,
}));
jest.mock("~/components/ui/pretext", () => ({
  PreText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

beforeEach(() => {
  mockPush.mockReset();
  mockNotifications = [];
  mockConversations = [];
});

describe("Halo views router navigation (Step 3)", () => {
  it("uses router.push for relative notification and message URLs and hard navigation for external URLs", () => {
    mockNotifications = [
      {
        id: "n-rel",
        title: "Treaty signed",
        message: "Internal link",
        href: "/mycountry/diplomacy",
        read: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: "n-ext",
        title: "Forum bulletin",
        message: "External link",
        href: "https://ixwiki.com/wiki/Main_Page",
        read: true,
        createdAt: new Date().toISOString(),
      },
    ];
    mockConversations = [
      {
        id: "conv-42",
        name: "Diplomatic channel",
        unreadCount: 1,
        lastMessage: null,
      },
    ];

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <HaloProvider initialSize={SIZE_PRESETS.TALL}>
          <NotificationsView onClose={jest.fn()} />
        </HaloProvider>
      );

      // SwipeActionButton renders "Open" buttons in Leading/Trailing slots for n.href
      const openBtns = screen.getAllByRole("button", { name: "Open" });
      fireEvent.click(openBtns[0]!);
      expect(mockPush).toHaveBeenCalledWith("/mycountry/diplomacy");
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      mockPush.mockReset();
      fireEvent.click(openBtns[openBtns.length - 1]!);
      expect(mockPush).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Messages tab -> conversation click
      mockPush.mockReset();
      consoleErrorSpy.mockClear();
      fireEvent.mouseDown(screen.getByRole("tab", { name: /Messages/i }), { button: 0 });
      fireEvent.click(screen.getByRole("button", { name: /Diplomatic channel/i }));
      expect(mockPush).toHaveBeenCalledWith("/messages?conversation=conv-42");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("uses router.push in SettingsView and MyCountryView", () => {
    const onClose = jest.fn();
    const { unmount } = render(
      <HaloProvider initialSize={SIZE_PRESETS.MEDIUM}>
        <SettingsView onClose={onClose} />
      </HaloProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /Admin/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/admin");
    unmount();

    mockPush.mockReset();
    onClose.mockReset();
    render(<MyCountryView onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Diplomacy/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/mycountry/diplomacy");
  });
});

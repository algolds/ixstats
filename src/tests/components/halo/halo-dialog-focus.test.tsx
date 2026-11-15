/** Halo dialog semantics, focus management, outside-tap close, and real button controls (Plan 461). */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { CommandPalette } from "~/components/halo";
import { Halo, HaloProvider, SIZE_PRESETS } from "~/components/halo/HaloPrimitives";
import { DIPluginProvider, useActiveDIPlugin } from "~/components/halo/plugin-context";
import { AccountView } from "~/components/halo/views/account/AccountView";
import { WikiNarratorPlayer } from "~/components/halo/plugins/wiki/components/WikiNarratorPlayer";
import { WikiHalo } from "~/components/halo/plugins/wiki/WikiHalo";
import { CompactView } from "~/components/halo/views/CompactView";
import { ExpandedView } from "~/components/halo/views/ExpandedView";
import { SettingsView } from "~/components/halo/views/SettingsView";
import type { ViewMode } from "~/components/halo/types";

let mockSignedIn = false;
let mockUserObj: { id: string; firstName?: string; imageUrl?: string } | null = null;
let mockProfileData: unknown = null;

let mockWikiContext: Record<string, unknown> = {
  articleTitle: null,
  activeSectionId: null,
  tocEntries: [],
  navigateToSection: jest.fn(),
  narratorState: null,
  narratorActions: null,
  themeColors: null,
};
let mockHasNarratorAccess = true;
let mockCanOpenAdmin = false;

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    countries: {
      getSelectList: { useQuery: () => ({ data: undefined }) },
      getByIdBasic: { useQuery: () => ({ data: undefined, isLoading: false }) },
      getActivityRingsData: { useQuery: () => ({ data: undefined, isLoading: false }) },
      flags: {
        resolveBatch: { useQuery: () => ({ data: {}, isLoading: false, isError: false }) },
      },
    },
    wikios: { advancedSearch: { useQuery: () => ({ data: undefined }) } },
    realms: {
      getSelectList: { useQuery: () => ({ data: undefined, isLoading: false }) },
      myNations: { useQuery: () => ({ data: undefined, isLoading: false }) },
    },
    notifications: { getUnreadCount: { useQuery: () => ({ data: { count: 0 } }) } },
    ixnayid: {
      getMyPassportCard: {
        useQuery: () => ({
          data: {
            preview: true,
            handle: "ada",
            displayName: "Ada",
            avatarUrl: null,
            primaryNation: null,
            lorewards: null,
            realmCount: 1,
            nationCount: 1,
            joinedAt: "2025-01-01T00:00:00Z",
            signature: null,
            bio: null,
          },
          isLoading: false,
        }),
      },
    },
    vault: {
      getEquippedCosmeticsFor: { useQuery: () => ({ data: undefined }) },
    },
    users: {
      getProfile: {
        useQuery: () => ({ data: mockProfileData, isLoading: false, isError: false }),
      },
      setActiveNation: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
    },
    onoma: {
      getSpeechConfig: { useQuery: () => ({ data: undefined }) },
      getKokoroVoices: { useQuery: () => ({ data: undefined }) },
    },
    useUtils: () => ({
      countries: { invalidate: jest.fn() },
      notifications: { invalidate: jest.fn() },
      users: { getProfile: { invalidate: jest.fn() } },
      realms: { myNations: { invalidate: jest.fn() } },
    }),
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: mockUserObj, isLoaded: true, isSignedIn: mockSignedIn }),
  useAuth: () => ({ signOut: jest.fn() }),
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
jest.mock("~/components/shared/country-actions/CountryActionsProvider", () => ({
  useOpenCountryActions: () => jest.fn(),
}));
jest.mock("~/hooks/useSoundSettings", () => ({
  useSoundSettings: () => ({ enabled: true, setEnabled: jest.fn(), previewSound: jest.fn() }),
}));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({}) }));
jest.mock("~/hooks/usePermissions", () => ({
  useCanOpenAdmin: () => mockCanOpenAdmin,
  useHasNarratorAccess: () => mockHasNarratorAccess,
}));
jest.mock("~/components/shared/country-hero/CountryHeroCard", () => ({
  HeroDetailModal: () => null,
}));
jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: () => null,
}));
jest.mock("~/hooks/useContextHour", () => ({ useContextHour: () => 9 }));
jest.mock("~/hooks/useMessageUnreadCount", () => ({
  useMessageUnreadCount: () => ({ totalUnread: 0 }),
}));
jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => mockWikiContext,
}));
jest.mock("~/components/ui/pretext", () => ({
  PreText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
jest.mock("~/hooks/usePlayAsTarget", () => ({
  usePlayAsTarget: () => "",
}));
jest.mock("~/components/halo/views/NotificationsView", () => ({
  NotificationsView: ({ onClose }: { onClose: () => void }) => (
    <div>
      <button type="button" onClick={onClose}>
        Close notifications
      </button>
    </div>
  ),
}));

beforeEach(() => {
  mockSignedIn = false;
  mockUserObj = null;
  mockProfileData = null;
  mockCanOpenAdmin = false;
  localStorage.clear();
  mockWikiContext = {
    articleTitle: null,
    activeSectionId: null,
    tocEntries: [],
    navigateToSection: jest.fn(),
    narratorState: null,
    narratorActions: null,
    themeColors: null,
  };
});

function renderExpanded(mode: ViewMode, activePlugin?: { id: string } | null) {
  return render(
    <HaloProvider initialSize={SIZE_PRESETS.MEDIUM}>
      <ExpandedView
        mode={mode}
        onClose={jest.fn()}
        onSwitchMode={jest.fn()}
        searchQuery=""
        setSearchQuery={jest.fn()}
        searchFilter="all"
        setSearchFilter={jest.fn()}
        debouncedSearchQuery=""
        searchResults={[]}
        activePlugin={activePlugin ?? null}
      />
    </HaloProvider>
  );
}

describe("ExpandedView dialog semantics & focus (Step 1)", () => {
  it("renders a non-modal dialog labelled 'Quick settings' and takes focus in settings mode", async () => {
    renderExpanded("settings");
    await act(async () => {});

    const dialog = screen.getByRole("dialog", { name: "Quick settings" });
    expect(dialog).toHaveAttribute("id", "halo-panel");
    expect(dialog).toHaveAttribute("aria-modal", "false");
    expect(dialog).toHaveFocus();
  });

  it.each([
    ["search", null, "Search"],
    ["notifications", null, "Notifications and messages"],
    ["settings", null, "Quick settings"],
    ["mycountry", null, "Account"],
    ["plugin:wiki", { id: "wiki" }, "Wiki"],
  ] as const)("labels mode %s as %s", async (mode, plugin, expectedLabel) => {
    renderExpanded(mode, plugin);
    await act(async () => {});
    expect(screen.getByRole("dialog", { name: expectedLabel })).toBeInTheDocument();
  });

  it("does not steal focus when the Halo tour popover currently holds focus", async () => {
    const tourPopover = document.createElement("div");
    tourPopover.setAttribute("data-slot", "virtual-anchor-popover");
    const tourBtn = document.createElement("button");
    tourBtn.textContent = "Next";
    tourPopover.appendChild(tourBtn);
    document.body.appendChild(tourPopover);
    tourBtn.focus();
    expect(tourBtn).toHaveFocus();

    renderExpanded("settings");
    await act(async () => {});

    expect(tourBtn).toHaveFocus();
    tourPopover.remove();
  });
});

describe("Trigger ARIA & focus return on close (Step 2)", () => {
  it("marks the Settings trigger as a dialog trigger and returns focus to it on close", async () => {
    render(<CommandPalette />);
    await act(async () => {});

    const settingsBtn = screen.getByRole("button", { name: "Settings" });
    expect(settingsBtn).toHaveAttribute("aria-haspopup", "dialog");
    expect(settingsBtn).not.toHaveAttribute("aria-controls");
    expect(settingsBtn).toHaveAttribute("data-halo-trigger", "settings");

    fireEvent.click(settingsBtn);
    const dialog = await screen.findByRole("dialog", { name: "Quick settings" });
    expect(dialog).toHaveFocus();

    const closeBtn = await screen.findByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    });

    const restoredSettingsBtn = screen.getByRole("button", { name: "Settings" });
    expect(restoredSettingsBtn).toHaveFocus();
  });

  it("preserves 630px ULTRA width when switching directly from SettingsView to SearchView via Cmd+K", async () => {
    const { container } = render(<CommandPalette />);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("dialog", { name: "Quick settings" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(await screen.findByRole("dialog", { name: "Search" })).toBeInTheDocument();

    const island = container.querySelector<HTMLElement>("#command-palette");
    expect(island?.style.width).toBe("630px");
  });
});

describe("Outside pointerdown closes Halo (Step 3)", () => {
  it("collapses expanded Halo on pointerdown outside while ignoring external dialogs", async () => {
    render(<CommandPalette />);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("dialog", { name: "Quick settings" })).toBeInTheDocument();

    const otherDialog = document.createElement("div");
    otherDialog.setAttribute("role", "dialog");
    document.body.appendChild(otherDialog);
    fireEvent.pointerDown(otherDialog);
    expect(screen.getByRole("dialog", { name: "Quick settings" })).toBeInTheDocument();
    otherDialog.remove();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Quick settings" })).toBeNull();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });
});

function ActivePluginCompactHarness() {
  const activePlugin = useActiveDIPlugin();
  return (
    <HaloProvider initialSize={SIZE_PRESETS.COMPACT_TALL}>
      <CompactView
        mode="compact"
        onSwitchMode={jest.fn()}
        activePlugin={activePlugin}
        pluginCenter={activePlugin?.center}
        pluginCenterActions={activePlugin?.centerActions}
        pluginActions={activePlugin?.actions}
        pluginBadge={activePlugin?.badge}
      />
    </HaloProvider>
  );
}

describe("Pill centre real buttons & no nested buttons (Step 4)", () => {
  it("renders WikiHalo section trigger beside the centre button with zero nested buttons and keeps Account 1 click away", () => {
    mockWikiContext = {
      articleTitle: "Caphiria",
      activeSectionId: "history",
      tocEntries: [{ id: "history", text: "Early history", level: 2 }],
      navigateToSection: jest.fn(),
      narratorState: null,
      narratorActions: null,
      themeColors: null,
    };

    const { container } = render(
      <DIPluginProvider>
        <WikiHalo />
        <ActivePluginCompactHarness />
      </DIPluginProvider>
    );

    expect(container.querySelectorAll("button button")).toHaveLength(0);
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
    const sectionBtn = screen.getByRole("button", { name: "Early history" });
    expect(sectionBtn.className).toContain("focus-visible:outline-tint");
    expect(sectionBtn.className).toContain("pointer-coarse:after:min-h-11");
    expect(screen.getByRole("button", { name: "Account" })).toHaveAttribute(
      "data-halo-trigger",
      "mycountry"
    );
  });

  it("yields Halo's center to the Account greeting on non-article Wiki routes and exposes a Wiki workspace action", () => {
    mockWikiContext = {
      articleTitle: "Main Page",
      activeSectionId: null,
      tocEntries: [],
      navigateToSection: jest.fn(),
      narratorState: null,
      narratorActions: null,
      themeColors: null,
    };

    render(
      <DIPluginProvider>
        <WikiHalo />
        <ActivePluginCompactHarness />
      </DIPluginProvider>
    );

    expect(screen.getByRole("button", { name: /Account/i })).toHaveAttribute(
      "data-halo-trigger",
      "mycountry"
    );
    expect(screen.getByRole("button", { name: "Wiki workspace" })).toHaveAttribute(
      "data-halo-trigger",
      "plugin:profile"
    );
  });

  it("renders WikiHalo narrator play/pause beside the centre button with aria-label and zero nested buttons", () => {
    mockWikiContext = {
      articleTitle: "Caphiria",
      activeSectionId: "history",
      tocEntries: [{ id: "history", text: "Early history", level: 2 }],
      navigateToSection: jest.fn(),
      narratorState: { isPlaying: true, activeBlockIndex: 1, totalBlocks: 5 },
      narratorActions: { play: jest.fn(), pause: jest.fn() },
      themeColors: null,
    };

    const { container } = render(
      <DIPluginProvider>
        <WikiHalo />
        <ActivePluginCompactHarness />
      </DIPluginProvider>
    );

    expect(container.querySelectorAll("button button")).toHaveLength(0);
    const pauseBtn = screen.getByRole("button", { name: "Pause narration" });
    expect(pauseBtn.className).toContain("focus-visible:outline-tint");
    expect(pauseBtn.className).toContain("pointer-coarse:after:min-h-11");
  });
});

describe("Sign-out button, chapter tick tooltips, and metric aria-pressed (Step 5)", () => {
  it("renders SettingsView Sign out as a real <button>", () => {
    mockSignedIn = true;
    mockUserObj = { id: "u1", firstName: "Ada" };

    render(
      <HaloProvider initialSize={SIZE_PRESETS.MEDIUM}>
        <SettingsView onClose={jest.fn()} />
      </HaloProvider>
    );

    const signOutBtn = screen.getByRole("button", { name: /Sign out/i });
    expect(signOutBtn.tagName).toBe("BUTTON");
  });

  it("switches MyCountry and Passport sides via SegmentedControl with zero nested buttons, and gates Halo material to admins", async () => {
    mockSignedIn = true;
    mockUserObj = { id: "u1", firstName: "Ada" };
    mockProfileData = {
      countryId: "c1",
      membershipTier: "mycountry_premium",
      country: {
        id: "c1",
        name: "Caphiria",
      },
    };

    const { container, unmount } = render(<AccountView onClose={jest.fn()} />);
    expect(container.querySelectorAll("button button")).toHaveLength(0);
    expect(screen.getByRole("radio", { name: "MyCountry" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByText("Premium")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Passport" }));
    expect(await screen.findByRole("link", { name: "Your Passport, @ada" })).toBeInTheDocument();
    expect(container.querySelectorAll("button button")).toHaveLength(0);
    unmount();

    // Non-admin does not see Halo material toggle in SettingsView
    const { unmount: unmountSettings } = render(
      <HaloProvider initialSize={SIZE_PRESETS.MEDIUM}>
        <SettingsView onClose={jest.fn()} />
      </HaloProvider>
    );
    expect(screen.queryByRole("radiogroup", { name: "Halo material" })).toBeNull();
    unmountSettings();

    // Admin sees Halo material toggle and can switch between Lens and Chrome + Lens
    mockCanOpenAdmin = true;
    const { container: haloContainer } = render(
      <HaloProvider initialSize={SIZE_PRESETS.MEDIUM}>
        <Halo id="dynamic-island-halo">
          <SettingsView onClose={jest.fn()} />
        </Halo>
      </HaloProvider>
    );
    const island = haloContainer.querySelector("#dynamic-island-halo");
    expect(island?.className).toContain("facet-lens");
    fireEvent.click(screen.getByRole("radio", { name: "Chrome, Lens inside" }));
    expect(island?.className).toContain("facet-chrome");
  });

  it("renders WikiNarratorPlayer chapter ticks as labelled buttons without custom hover span", () => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as never;

    const { container } = render(
      <WikiNarratorPlayer
        visibleToc={[{ id: "geo", text: "Geography", level: 2 }]}
        sectionOffsets={{ geo: 25 }}
        narratorState={{ isPlaying: false, activeBlockIndex: 0, totalBlocks: 4 }}
        narratorActions={{ jumpToSection: jest.fn() }}
      />
    );

    const tick = screen.getByRole("button", { name: "Geography" });
    expect(tick.tagName).toBe("BUTTON");
    expect(tick.getAttribute("data-slot")).toBe("tooltip-trigger");
    expect(container.querySelector(".group-hover\\/tick\\:opacity-100")).toBeNull();
  });
});

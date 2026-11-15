/** Halo dialog semantics, focus management, outside-tap close, and real button controls (Plan 461). */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { CommandPalette } from "~/components/halo";
import { HaloProvider, SIZE_PRESETS } from "~/components/halo/HaloPrimitives";
import { ExpandedView } from "~/components/halo/views/ExpandedView";
import type { ViewMode } from "~/components/halo/types";

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
}));
jest.mock("~/trpc/react", () => ({
  api: {
    countries: { getSelectList: { useQuery: () => ({ data: undefined }) } },
    wikios: { advancedSearch: { useQuery: () => ({ data: undefined }) } },
    notifications: { getUnreadCount: { useQuery: () => ({ data: { count: 0 } }) } },
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: null, isLoaded: true, isSignedIn: false }),
  useAuth: () => ({ signOut: jest.fn() }),
}));
jest.mock("~/context/theme-context", () => ({
  useTheme: () => ({ toggleTheme: jest.fn(), toggleCompactMode: jest.fn() }),
}));
jest.mock("~/hooks/useSoundSettings", () => ({ useSoundSettings: () => ({}) }));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({}) }));
jest.mock("~/hooks/usePermissions", () => ({ useCanOpenAdmin: () => false }));
jest.mock("~/hooks/useContextHour", () => ({ useContextHour: () => 9 }));
jest.mock("~/hooks/useMessageUnreadCount", () => ({
  useMessageUnreadCount: () => ({ totalUnread: 0 }),
}));
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
jest.mock("~/hooks/usePlayAsTarget", () => ({
  usePlayAsTarget: () => "",
}));
jest.mock("~/components/halo/views/SettingsView", () => ({
  SettingsView: ({ onClose }: { onClose: () => void }) => (
    <div>
      <button type="button" onClick={onClose}>
        Close settings
      </button>
    </div>
  ),
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
jest.mock("~/components/halo/plugins/mycountry/views/MyCountryView", () => ({
  MyCountryView: ({ onClose }: { onClose: () => void }) => (
    <div>
      <button type="button" onClick={onClose}>
        Close account
      </button>
    </div>
  ),
}));

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
  it("wires aria-expanded, aria-controls, and returns focus to the Settings trigger on close", async () => {
    render(<CommandPalette />);
    await act(async () => {});

    const settingsBtn = screen.getByRole("button", { name: "Settings" });
    expect(settingsBtn).toHaveAttribute("aria-expanded", "false");
    expect(settingsBtn).toHaveAttribute("aria-controls", "halo-panel");
    expect(settingsBtn).toHaveAttribute("data-halo-trigger", "settings");

    fireEvent.click(settingsBtn);
    const dialog = await screen.findByRole("dialog", { name: "Quick settings" });
    expect(dialog).toHaveFocus();

    const closeBtn = await screen.findByRole("button", { name: "Close settings" });
    fireEvent.click(closeBtn);

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    });

    const restoredSettingsBtn = screen.getByRole("button", { name: "Settings" });
    expect(restoredSettingsBtn).toHaveFocus();
  });
});

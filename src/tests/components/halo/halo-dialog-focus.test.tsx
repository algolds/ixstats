/** Halo dialog semantics, focus management, outside-tap close, and real button controls (Plan 461). */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { HaloProvider, SIZE_PRESETS } from "~/components/halo/HaloPrimitives";
import { ExpandedView } from "~/components/halo/views/ExpandedView";
import type { ViewMode } from "~/components/halo/types";

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

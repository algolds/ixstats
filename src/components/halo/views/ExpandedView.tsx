import { AnimatePresence } from "motion/react";
import { HaloContainer } from "../HaloPrimitives";
import dynamic from "next/dynamic";
import type { ExpandedViewProps, DIPlugin, ViewMode } from "../types";
import { Button } from "~/components/ui/button";
import { setPlayAsCookie } from "~/app/admin/users/play-as-cookie";
import { usePlayAsTarget } from "~/hooks/usePlayAsTarget";

function dialogLabelForMode(mode: ViewMode, activePlugin?: DIPlugin | null): string {
  if (mode === "search") return "Search";
  if (mode === "notifications") return "Notifications and messages";
  if (mode === "settings") return "Quick settings";
  if (mode === "mycountry") return "Account";
  if (mode.startsWith("plugin:")) {
    const raw = activePlugin?.id || mode.slice(7);
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Plugin";
  }
  return "Halo";
}

// The views are not needed until the Halo opens, so each is its own chunk fetched then; the fallback
// keeps the island's height stable while the chunk loads.
const viewLoading = () => <div className="h-40" aria-busy="true" />;
const SearchView = dynamic(() => import("./SearchView").then((m) => m.SearchView), {
  ssr: false,
  loading: viewLoading,
});
const NotificationsView = dynamic(
  () => import("./NotificationsView").then((m) => m.NotificationsView),
  { ssr: false, loading: viewLoading }
);
const SettingsView = dynamic(() => import("./SettingsView").then((m) => m.SettingsView), {
  ssr: false,
  loading: viewLoading,
});
const MyCountryView = dynamic(
  () => import("../plugins/mycountry/views/MyCountryView").then((m) => m.MyCountryView),
  { ssr: false, loading: viewLoading }
);

export function ExpandedView({
  mode,
  onClose,
  onSwitchMode,
  searchQuery,
  setSearchQuery,
  searchFilter,
  setSearchFilter,
  debouncedSearchQuery,
  searchResults,
  isSearchPending,
  activePlugin,
}: ExpandedViewProps & { activePlugin?: DIPlugin | null }) {
  const targetUser = usePlayAsTarget();
  const isImpersonating = targetUser !== "";

  const handleStopImpersonating = () => {
    localStorage.removeItem("ixstats.play_as_user");
    setPlayAsCookie(false);
    window.location.href = "/admin/users";
  };

  // Don't render if mode is compact
  if (mode === "compact") {
    return null;
  }

  return (
    <div
      id="halo-panel"
      role="dialog"
      aria-modal="false"
      aria-label={dialogLabelForMode(mode, activePlugin)}
      tabIndex={-1}
      ref={(el) => {
        if (
          el &&
          !el.contains(document.activeElement) &&
          !document.activeElement?.closest('[data-slot="virtual-anchor-popover"]')
        ) {
          el.focus({ preventScroll: true });
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.preventDefault();
          if (mode === "search" && searchQuery) {
            setSearchQuery("");
            setSearchFilter("all");
          } else {
            onClose();
          }
        }
      }}
      className="relative max-h-[80vh] w-full overflow-y-auto text-left outline-none"
      style={{ scrollbarWidth: "thin" }}
    >
      {isImpersonating && (
        <div className="border-red/20 bg-red/10 text-footnote text-red flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 font-medium">
            <span className="bg-red size-2 rounded-full" />
            <span>
              Playing as: <span className="font-mono">{targetUser}</span>
            </span>
          </div>
          <Button type="button" variant="destructive" size="sm" onClick={handleStopImpersonating}>
            Stop
          </Button>
        </div>
      )}
      <AnimatePresence mode="wait">
        {mode === "search" && (
          <HaloContainer key="search" className="w-full">
            <SearchView
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              debouncedSearchQuery={debouncedSearchQuery}
              searchResults={searchResults}
              isSearchPending={isSearchPending}
              closeDropdown={onClose}
            />
          </HaloContainer>
        )}
        {mode === "notifications" && (
          <HaloContainer key="notifications" className="w-full">
            <NotificationsView onClose={onClose} />
          </HaloContainer>
        )}
        {mode === "settings" && (
          <HaloContainer key="settings" className="w-full">
            <SettingsView onClose={onClose} />
          </HaloContainer>
        )}
        {mode === "mycountry" && (
          <HaloContainer key="mycountry" className="w-full">
            <MyCountryView onClose={onClose} />
          </HaloContainer>
        )}

        {/* Plugin-provided expanded views */}
        {typeof mode === "string" &&
          mode.startsWith("plugin:") &&
          (() => {
            const viewName = mode.slice(7); // strip "plugin:" prefix
            const PluginView = activePlugin?.expandedViews?.[viewName];
            if (!PluginView) return null;
            return (
              <HaloContainer key={mode} className="w-full">
                <PluginView
                  onClose={onClose}
                  onSwitchMode={onSwitchMode}
                  filter={activePlugin?.filter}
                  context={activePlugin?.context}
                />
              </HaloContainer>
            );
          })()}
      </AnimatePresence>
    </div>
  );
}

import { useSyncExternalStore } from "react";
import { AnimatePresence } from "motion/react";
import { HaloContainer } from "../HaloPrimitives";
import dynamic from "next/dynamic";
import type { ExpandedViewProps, DIPlugin } from "../types";
import { Button } from "~/components/ui/button";
import { setPlayAsCookie } from "~/app/admin/users/play-as-cookie";

// The views are not needed until the Halo opens, so each is its own chunk fetched then (plan 457); the
// fallback keeps the island's height stable while the chunk loads.
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

const subscribeNever = () => () => {};
/** The admin "play as" target, re-read on every render (each mode switch re-renders this). */
const readPlayAs = () => {
  try {
    return localStorage.getItem("ixstats.play_as_user") ?? "";
  } catch {
    return "";
  }
};

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
  const targetUser = useSyncExternalStore(subscribeNever, readPlayAs, () => "");
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
      className="relative max-h-[80vh] w-full overflow-y-auto text-left"
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

import React from "react";
import { SearchView } from "./SearchView";
import { NotificationsView } from "./NotificationsView";
import { SettingsView } from "./SettingsView";
import { MyCountryDIView } from "./MyCountryDIView";
import type { ExpandedViewProps, DIPlugin } from "./types";

export function ExpandedView({
  mode,
  onClose,
  searchQuery,
  setSearchQuery,
  searchFilter,
  setSearchFilter,
  debouncedSearchQuery,
  searchResults,
  countriesData,
  activePlugin,
}: ExpandedViewProps & { activePlugin?: DIPlugin | null }) {
  // Don't render if mode is compact or cycling
  if (mode === "compact" || mode === "cycling") {
    return null;
  }

  return (
    <div
      className="relative max-h-[80vh] w-full overflow-y-auto text-left"
      style={{ scrollbarWidth: "thin" }}
    >
      {mode === "search" && (
        <SearchView
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          debouncedSearchQuery={debouncedSearchQuery}
          searchResults={searchResults}
          countriesData={countriesData}
          closeDropdown={onClose}
        />
      )}
      {mode === "notifications" && <NotificationsView onClose={onClose} />}
      {mode === "settings" && <SettingsView onClose={onClose} />}
      {mode === "mycountry" && <MyCountryDIView onClose={onClose} />}

      {/* Plugin-provided expanded views */}
      {typeof mode === "string" &&
        mode.startsWith("plugin:") &&
        (() => {
          const viewName = mode.slice(7); // strip "plugin:" prefix
          const PluginView = activePlugin?.expandedViews?.[viewName];
          if (!PluginView) return null;
          return <PluginView onClose={onClose} />;
        })()}
    </div>
  );
}

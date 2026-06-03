import React from "react";
import { AnimatePresence } from "motion/react";
import { DynamicContainer } from "../ui/dynamic-island";
import { SearchView } from "./SearchView";
import { NotificationsView } from "./NotificationsView";
import { SettingsView } from "./SettingsView";
import { MyCountryDIView } from "./MyCountryDIView";
import type { ExpandedViewProps, DIPlugin } from "./types";

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
      <AnimatePresence mode="wait">
        {mode === "search" && (
          <DynamicContainer key="search" className="w-full">
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
          </DynamicContainer>
        )}
        {mode === "notifications" && (
          <DynamicContainer key="notifications" className="w-full">
            <NotificationsView onClose={onClose} />
          </DynamicContainer>
        )}
        {mode === "settings" && (
          <DynamicContainer key="settings" className="w-full">
            <SettingsView onClose={onClose} />
          </DynamicContainer>
        )}
        {mode === "mycountry" && (
          <DynamicContainer key="mycountry" className="w-full">
            <MyCountryDIView onClose={onClose} />
          </DynamicContainer>
        )}

        {/* Plugin-provided expanded views */}
        {typeof mode === "string" &&
          mode.startsWith("plugin:") &&
          (() => {
            const viewName = mode.slice(7); // strip "plugin:" prefix
            const PluginView = activePlugin?.expandedViews?.[viewName];
            if (!PluginView) return null;
            return (
              <DynamicContainer key={mode} className="w-full">
                <PluginView
                  onClose={onClose}
                  onSwitchMode={onSwitchMode}
                  filter={activePlugin?.filter}
                  context={activePlugin?.context}
                />
              </DynamicContainer>
            );
          })()}
      </AnimatePresence>
    </div>
  );
}

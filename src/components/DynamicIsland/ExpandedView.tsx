import React, { useState, useEffect } from "react";
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
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [targetUser, setTargetUser] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const playAs = localStorage.getItem("ixstats.play_as_user");
      setIsImpersonating(!!playAs);
      setTargetUser(playAs || "");
    }
  }, [mode]);

  const handleStopImpersonating = () => {
    localStorage.removeItem("ixstats.play_as_user");
    window.location.href = "/admin/user-management";
  };

  // Don't render if mode is compact or cycling
  if (mode === "compact" || mode === "cycling") {
    return null;
  }

  return (
    <div
      className="relative max-h-[80vh] w-full overflow-y-auto text-left"
      style={{ scrollbarWidth: "thin" }}
    >
      {isImpersonating && (
        <div className="flex items-center justify-between border-b border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-600 dark:text-red-400">
          <div className="flex items-center gap-2 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
            </span>
            <span>Playing as: <span className="font-mono">{targetUser}</span></span>
          </div>
          <button
            onClick={handleStopImpersonating}
            className="rounded bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 transition-colors"
          >
            Stop
          </button>
        </div>
      )}
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

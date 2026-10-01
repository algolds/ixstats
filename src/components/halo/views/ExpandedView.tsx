import React, { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { DynamicContainer } from "../HaloPrimitives";
import { SearchView } from "./SearchView";
import { NotificationsView } from "./NotificationsView";
import { SettingsView } from "./SettingsView";
import { MyCountryView } from "../plugins/mycountry";
import type { ExpandedViewProps, DIPlugin } from "../types";
import { Button } from "~/components/ui/button";

function ExpandedViewComponent({
  mode,
  onClose,
  onSwitchMode,
  searchQuery,
  setSearchQuery,
  searchFilter,
  setSearchFilter,
  debouncedSearchQuery,
  searchResults,
  activePlugin,
}: ExpandedViewProps & { activePlugin?: DIPlugin | null }) {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [targetUser, setTargetUser] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const playAs = localStorage.getItem("ixstats.play_as_user");
      // oxlint-disable-next-line
      setIsImpersonating(!!playAs);
      setTargetUser(playAs || "");
    }
    // oxlint-disable-next-line
  }, [mode]);

  const handleStopImpersonating = () => {
    localStorage.removeItem("ixstats.play_as_user");
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
            <span className="relative flex h-2 w-2">
              <span className="bg-red absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
              <span className="bg-red relative inline-flex h-2 w-2 rounded-full"></span>
            </span>
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
          <DynamicContainer key="search" className="w-full">
            <SearchView
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              debouncedSearchQuery={debouncedSearchQuery}
              searchResults={searchResults}
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
            <MyCountryView onClose={onClose} />
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

export const ExpandedView = React.memo(ExpandedViewComponent);

import React from "react";
import { SearchView } from "./SearchView";
import { NotificationsView } from "./NotificationsView";
import { SettingsView } from "./SettingsView";
import { CrisisView } from "./CrisisView";
import type { ExpandedViewProps } from "./types";

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
  crisisEvents,
}: ExpandedViewProps) {
  // Don't render if mode is compact or cycling
  if (mode === "compact" || mode === "cycling") {
    return null;
  }

  return (
    <div className="absolute top-full left-1/2 z-[10002] mt-2 w-[95vw] sm:w-[90vw] md:w-[600px] lg:max-w-4xl -translate-x-1/2 transform">
      <div
        className="command-palette-dropdown border-border relative mx-auto w-full overflow-hidden rounded-xl shadow-2xl dark:border-white/10"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        {/* Refraction border effects */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-white/30 to-transparent" />
          <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
        </div>

        <div className="relative z-10">
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
          {mode === "crisis" && <CrisisView crises={crisisEvents || []} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}

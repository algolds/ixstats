"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { RiBookOpenLine, RiSettings3Line } from "react-icons/ri";
import { Settings } from "lucide-react";

/**
 * WikiHeader Component — Apple-Design Dossier Header
 *
 * Compact glass bar with segmented view controls:
 * - Title & country description (connected pill removed)
 * - Segmented tab controls (Wiki Synced Dossier vs Native Canvas Lore)
 * - Settings icon button triggering LoreScanner Preferences
 */
interface WikiHeaderProps {
  /** Country name for display */
  countryName: string;
  /** Currently active view tab */
  activeView: "sections" | "native_lore" | "settings";
  /** Callback to change active view */
  setActiveView: (view: "sections" | "native_lore" | "settings") => void;
  /** Callback to open LoreScanner preferences modal */
  onOpenSettings?: () => void;
  /** User's clearance level */
  viewerClearanceLevel: string;
  /** Optional flag image URL for background overlay */
  flagImageUrl?: string;
}

export const WikiHeader: React.FC<WikiHeaderProps> = ({
  countryName,
  activeView,
  setActiveView,
  onOpenSettings,
  viewerClearanceLevel,
  flagImageUrl,
}) => {
  const navTabs = [
    { id: "sections", label: "Wiki Synced", icon: RiBookOpenLine },
    { id: "native_lore", label: "Native Canvas Lore", icon: RiBookOpenLine },
  ] as const;

  return (
    <div className="bg-card/40 relative overflow-hidden rounded-2xl border border-white/10 p-3.5 shadow-sm backdrop-blur-xl sm:p-4">
      {/* Country Flag Subtle Background Overlay */}
      {flagImageUrl && (
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]">
          <img
            src={flagImageUrl}
            alt="Flag background"
            className="h-full w-full scale-150 object-cover object-center blur-sm"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="from-background/90 via-background/70 to-background/90 absolute inset-0 bg-gradient-to-r" />
        </div>
      )}

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Compact Title & Description */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-500/15 text-blue-400">
            <RiBookOpenLine className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-foreground text-base font-extrabold tracking-tight">
              National Dossier
            </h2>
            <p className="text-muted-foreground line-clamp-1 text-[11px]">
              Lore & intelligence database for{" "}
              <strong className="text-foreground">{countryName}</strong>
            </p>
          </div>
        </div>

        {/* Right: Apple Segmented Control + Settings Button */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Segmented Tab Control */}
          <div className="flex items-center rounded-xl border border-white/10 bg-black/30 p-1 backdrop-blur-md">
            {navTabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveView(tab.id as any)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-[0.98]",
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                  )}
                >
                  <TabIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* LoreScanner Preferences Settings Button */}
          {onOpenSettings && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSettings}
              title="LoreScanner Preferences & Sync Settings"
              className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-xl border border-white/10 bg-white/[0.03] p-0 transition-all hover:bg-white/[0.06] active:scale-[0.97]"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

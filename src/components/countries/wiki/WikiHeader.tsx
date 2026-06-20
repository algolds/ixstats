"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { RiBookOpenLine, RiShieldLine, RiRefreshLine, RiSettings3Line } from "react-icons/ri";

/**
 * WikiHeader Component
 *
 * Displays the header section for Wiki Intelligence tab with:
 * - Flag background overlay
 * - Title and connection status badge (CONNECTED/LIMITED)
 * - Refresh button with loading state
 * - Navigation tabs (Dossier, Analysis, Settings)
 */
interface WikiHeaderProps {
  /** Country name for display */
  countryName: string;
  /** Whether country has infobox data (determines CONNECTED/LIMITED status) */
  hasInfobox: boolean;
  /** Currently active view tab */
  activeView: "sections" | "conflicts" | "settings";
  /** Callback to change active view */
  setActiveView: (view: "sections" | "conflicts" | "settings") => void;
  /** Callback to refresh wiki data */
  onRefresh: () => void;
  /** Whether refresh is currently in progress */
  isRefreshing: boolean;
  /** Number of data conflicts detected */
  dataConflictsCount: number;
  /** User's clearance level (hides settings tab for PUBLIC users) */
  viewerClearanceLevel: string;
  /** Optional flag image URL for background overlay */
  flagImageUrl?: string;
}

export const WikiHeader: React.FC<WikiHeaderProps> = ({
  countryName,
  hasInfobox,
  activeView,
  setActiveView,
  onRefresh,
  isRefreshing,
  dataConflictsCount,
  viewerClearanceLevel,
  flagImageUrl,
}) => {
  return (
    <div className="glass-hierarchy-child relative overflow-hidden rounded-lg">
      {/* Country Flag Background */}
      {flagImageUrl && (
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
          <img
            src={flagImageUrl}
            alt="Flag background"
            className="h-full w-full scale-150 object-cover object-center blur-sm"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="from-background/80 via-background/60 to-background/80 absolute inset-0 bg-gradient-to-r"></div>
        </div>
      )}

      <div className="relative p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-500/20 p-2 backdrop-blur-sm">
              <RiBookOpenLine className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Wiki Intelligence</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-blue-500/30 text-blue-400">
              {hasInfobox ? "CONNECTED" : "LIMITED"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
            >
              <RiRefreshLine className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { id: "sections", label: "Dossier", icon: RiBookOpenLine },
            {
              id: "conflicts",
              label: `Data Analysis ${dataConflictsCount > 0 ? `(${dataConflictsCount})` : ""}`,
              icon: RiShieldLine,
            },
            // Only show settings for authenticated users with higher clearance
            ...(viewerClearanceLevel !== "PUBLIC"
              ? [{ id: "settings", label: "Discovery Settings", icon: RiSettings3Line }]
              : []),
          ].map((view) => {
            const ViewIcon = view.icon;
            return (
              <Button
                key={view.id}
                variant={activeView === view.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveView(view.id as "sections" | "conflicts" | "settings")}
                className="flex items-center gap-2"
              >
                <ViewIcon className="h-4 w-4" />
                {view.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

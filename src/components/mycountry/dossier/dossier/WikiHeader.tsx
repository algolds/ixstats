"use client";

import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import React from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { OpenBook as BookOpen, Page as FileText, Settings } from "iconoir-react";

interface WikiHeaderProps {
  countryName: string;
  activeView: "sections" | "native_lore";
  setActiveView: (view: "sections" | "native_lore") => void;
  viewerClearanceLevel: string;
  flagImageUrl?: string;
}

export const WikiHeader: React.FC<WikiHeaderProps> = ({
  countryName,
  activeView,
  setActiveView,
  viewerClearanceLevel,
  flagImageUrl,
}) => {
  const navTabs = [
    { id: "sections", label: "Wiki Synced", icon: BookOpen },
    { id: "native_lore", label: "Native Canvas Lore", icon: FileText },
  ] as const;

  return (
    <FacetCard depth={1} className="overflow-hidden rounded-2xl p-3.5 sm:p-4">
      {/* Country Flag Subtle Background Overlay */}
      {flagImageUrl && (
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]">
          <img src={flagImageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left Side: Title and Clearance Badge */}
        <div className="flex items-center gap-2.5">
          <BookOpen className="text-muted-foreground h-5 w-5 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-foreground text-sm font-semibold">
                {countryName} Sovereign Dossier
              </h2>
              <Badge variant="outline">{viewerClearanceLevel}</Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              Declassified intelligence briefing and nation lore factbook.
            </p>
          </div>
        </div>

        {/* Right Side: Segmented Controls & Settings */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Segmented Tab Control */}
          <div className="bg-muted/50 flex items-center rounded-xl p-1" role="tablist">
            {navTabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveView(tab.id)}
                  data-cuelume-press="page"
                  data-cuelume-hover="tick"
                  className={cn(
                    "focus-visible:ring-ring flex min-h-8 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-[background-color,color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]",
                    isActive
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <TabIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Centralized WikiOS Settings Link */}
          <Link
            href="/settings?tab=wikios"
            data-cuelume-press="soft"
            title="WikiOS Settings & Lore Scanner"
            aria-label="WikiOS settings"
            className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring flex h-8 w-8 items-center justify-center rounded-lg transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </FacetCard>
  );
};

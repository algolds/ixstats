"use client";

import React from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import {
  OpenBook as BookOpen,
  Page as FileText,
  Settings,
} from "iconoir-react";
import { soundEffects } from "~/lib/sound/cuelume";

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
    <div className="bg-card/40 relative overflow-hidden rounded-2xl border border-white/10 p-3.5 shadow-sm backdrop-blur-xl sm:p-4">
      {/* Country Flag Subtle Background Overlay */}
      {flagImageUrl && (
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]">
          <img
            src={flagImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left Side: Title and Clearance Badge */}
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl border border-blue-500/25 bg-blue-500/15 p-2 text-blue-400">
            <BookOpen className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-foreground text-sm font-extrabold tracking-tight">
                {countryName} Sovereign Dossier
              </h2>
              <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">
                {viewerClearanceLevel}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              Declassified intelligence briefing and nation lore factbook.
            </p>
          </div>
        </div>

        {/* Right Side: Segmented Controls & Settings */}
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
                  onClick={() => {
                    soundEffects.press();
                    setActiveView(tab.id);
                  }}
                  data-cuelume-press="soft"
                  className={cn(
                    "facet-interactive flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-[0.98]",
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

          {/* Centralized WikiOS Settings Link */}
          <Link
            href="/settings?tab=wikios"
            data-cuelume-press="soft"
            title="WikiOS Settings & Lore Scanner"
            className="facet-interactive flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-muted-foreground transition-all hover:bg-white/[0.06] hover:text-foreground active:scale-[0.97]"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};

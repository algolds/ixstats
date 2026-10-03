"use client";
import { Badge } from "~/components/ui/badge";
import React from "react";
import Link from "next/link";
import { OpenBook as BookOpen, Page as FileText, Settings } from "iconoir-react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Card } from "~/components/ui/card";

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
    <Card className="rounded-card overflow-hidden p-4 sm:p-4">
      {/* Country Flag Subtle Background Overlay */}
      {flagImageUrl && (
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]">
          <img src={flagImageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left Side: Title and Clearance Badge */}
        <div className="flex items-center gap-2">
          <BookOpen className="text-label-secondary h-5 w-5 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-label text-headline">{countryName} Sovereign Dossier</h2>
              <Badge variant="outline">{viewerClearanceLevel}</Badge>
            </div>
            <p className="text-label-secondary text-footnote">
              Declassified intelligence briefing and nation lore factbook.
            </p>
          </div>
        </div>

        {/* Right Side: Segmented Controls & Settings */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Segmented Tab Control */}
          <SegmentedControl
            aria-label="Dossier view"
            asTabs
            value={activeView}
            onValueChange={(v) => setActiveView(v as typeof activeView)}
            options={navTabs.map((tab) => ({
              value: tab.id,
              label: tab.label,
              icon: <tab.icon aria-hidden />,
            }))}
          />

          {/* Centralized WikiOS Settings Link */}
          <Link
            href="/settings?tab=wikios"
            title="WikiOS Settings & Lore Scanner"
            aria-label="WikiOS settings"
            className="text-label-secondary hover:text-label hover:bg-fill-3 focus-visible:ring-tint rounded-control flex h-8 w-8 items-center justify-center transition-[background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </Card>
  );
};

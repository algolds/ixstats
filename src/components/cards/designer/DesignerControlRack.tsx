"use client";

import React, { useState, useCallback } from "react";
import {
  OpenBook as BookOpen,
  Crown as Gem,
  Coins,
  Folder as FolderOpen,
  NavArrowDown as ChevronDown,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import type { CardDesignState, CardDesignPreset } from "./types";

import { RackIdentitySection } from "./rack/RackIdentitySection";
import { RackAppearanceSection } from "./rack/RackAppearanceSection";
import { RackEconomySection } from "./rack/RackEconomySection";
import { RackPresetsSection } from "./rack/RackPresetsSection";
import { RackPublishBar } from "./rack/RackPublishBar";

export interface DesignerControlRackProps {
  state: CardDesignState;
  onChange: (updater: (prev: CardDesignState) => CardDesignState) => void;
  onOpenIconBrowser: (target: "emblem" | "watermark") => void;
  onOpenLoreImport: () => void;
  onPublish: () => void;
  isPublishing: boolean;
  presets: CardDesignPreset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (preset: CardDesignPreset) => void;
  onDeletePreset: (id: string) => void;
}

export const DesignerControlRack = React.memo<DesignerControlRackProps>(
  function DesignerControlRack({
    state,
    onChange,
    onOpenIconBrowser,
    onOpenLoreImport,
    onPublish,
    isPublishing,
    presets,
    onSavePreset,
    onLoadPreset,
    onDeletePreset,
  }) {
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
      identity: true,
      materials: true,
      economy: false,
      presets: false,
    });

    const toggleSection = useCallback((key: string) => {
      setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    return (
      <div className="flex flex-col space-y-4">
        {/* Section 1: Overview & Basic Info */}
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <button
            type="button"
            onClick={() => toggleSection("identity")}
            className="text-foreground hover:bg-muted/40 flex w-full items-center justify-between p-4 text-sm font-semibold transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="text-primary h-4 w-4" />
              <span>Overview & Basic Info</span>
            </div>
            <ChevronDown
              className={cn(
                "text-muted-foreground h-4 w-4 transition-transform",
                openSections.identity && "rotate-180"
              )}
            />
          </button>

          {openSections.identity && (
            <div className="border-border space-y-4 border-t p-4 pt-0">
              <RackIdentitySection
                state={state}
                onChange={onChange}
                onOpenLoreImport={onOpenLoreImport}
              />
            </div>
          )}
        </div>

        {/* Section 2: Appearance & Artwork */}
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <button
            type="button"
            onClick={() => toggleSection("materials")}
            className="text-foreground hover:bg-muted/40 flex w-full items-center justify-between p-4 text-sm font-semibold transition-colors"
          >
            <div className="flex items-center gap-2">
              <Gem className="text-primary h-4 w-4" />
              <span>Appearance & Artwork</span>
            </div>
            <ChevronDown
              className={cn(
                "text-muted-foreground h-4 w-4 transition-transform",
                openSections.materials && "rotate-180"
              )}
            />
          </button>

          {openSections.materials && (
            <div className="border-border space-y-4 border-t p-4 pt-0">
              <RackAppearanceSection
                state={state}
                onChange={onChange}
                onOpenIconBrowser={onOpenIconBrowser}
              />
            </div>
          )}
        </div>

        {/* Section 3: Economy & Print Supply */}
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <button
            type="button"
            onClick={() => toggleSection("economy")}
            className="text-foreground hover:bg-muted/40 flex w-full items-center justify-between p-4 text-sm font-semibold transition-colors"
          >
            <div className="flex items-center gap-2">
              <Coins className="text-primary h-4 w-4" />
              <span>Economy & Print Supply</span>
            </div>
            <ChevronDown
              className={cn(
                "text-muted-foreground h-4 w-4 transition-transform",
                openSections.economy && "rotate-180"
              )}
            />
          </button>

          {openSections.economy && (
            <div className="border-border space-y-3 border-t p-4 pt-0">
              <RackEconomySection state={state} onChange={onChange} />
            </div>
          )}
        </div>

        {/* Section 4: Design Presets */}
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <button
            type="button"
            onClick={() => toggleSection("presets")}
            className="text-foreground hover:bg-muted/40 flex w-full items-center justify-between p-4 text-sm font-semibold transition-colors"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="text-primary h-4 w-4" />
              <span>Saved Design Presets</span>
            </div>
            <ChevronDown
              className={cn(
                "text-muted-foreground h-4 w-4 transition-transform",
                openSections.presets && "rotate-180"
              )}
            />
          </button>

          {openSections.presets && (
            <div className="border-border space-y-3 border-t p-4 pt-0">
              <RackPresetsSection
                presets={presets}
                onSavePreset={onSavePreset}
                onLoadPreset={onLoadPreset}
                onDeletePreset={onDeletePreset}
              />
            </div>
          )}
        </div>

        {/* Section 5: Publish Action Bar */}
        <RackPublishBar
          onPublish={onPublish}
          isPublishing={isPublishing}
          isDisabled={!state.title.trim()}
        />
      </div>
    );
  }
);

DesignerControlRack.displayName = "DesignerControlRack";

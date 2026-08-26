/**
 * CardDesignerStudio Component
 *
 * Primary interactive hub for the 3D Card Designer.
 * Clean Facet design system architecture with live 3D physics,
 * vector icon library, multi-archive lore import, and direct DB publishing.
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { DesignerStage3D } from "./DesignerStage3D";
import { DesignerControlRack } from "./DesignerControlRack";
import { GameIconsBrowser } from "./GameIconsBrowser";
import { LoreImportDrawer } from "./LoreImportDrawer";
import {
  type CardDesignState,
  type CardDesignPreset,
  type GameIconItem,
  DEFAULT_DESIGN_STATE,
} from "./types";

const LOCAL_STORAGE_PRESETS_KEY = "ix_card_designer_presets_v1";

export const CardDesignerStudio: React.FC = () => {
  const notify = useNotify();
  const [state, setState] = useState<CardDesignState>(DEFAULT_DESIGN_STATE);
  const [presets, setPresets] = useState<CardDesignPreset[]>([]);
  const [iconBrowserOpen, setIconBrowserOpen] = useState(false);
  const [targetIconSlot, setTargetIconSlot] = useState<"emblem" | "watermark">("emblem");
  const [loreDrawerOpen, setLoreDrawerOpen] = useState(false);

  // Load presets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_PRESETS_KEY);
      if (saved) {
        // oxlint-disable-next-line
        setPresets(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Failed to read designer presets from localStorage:", e);
    }
  }, []);

  // Save presets helper
  const updatePresets = useCallback((newPresets: CardDesignPreset[]) => {
    setPresets(newPresets);
    try {
      localStorage.setItem(LOCAL_STORAGE_PRESETS_KEY, JSON.stringify(newPresets));
    } catch (e) {
      console.warn("Failed to persist presets:", e);
    }
  }, []);

  const handleSavePreset = useCallback(
    (name: string) => {
      const newPreset: CardDesignPreset = {
        id: `preset-${Date.now()}`,
        name,
        createdAt: Date.now(),
        state: { ...state },
      };
      const updated = [newPreset, ...presets];
      updatePresets(updated);
      notify.success(`Preset "${name}" saved!`);
    },
    [state, presets, updatePresets, notify]
  );

  const handleLoadPreset = useCallback(
    (preset: CardDesignPreset) => {
      setState(preset.state);
      notify.info(`Loaded preset "${preset.name}"`);
    },
    [notify]
  );

  const handleDeletePreset = useCallback(
    (id: string) => {
      const updated = presets.filter((p) => p.id !== id);
      updatePresets(updated);
      notify.info("Preset deleted.");
    },
    [presets, updatePresets, notify]
  );

  const handleOpenIconBrowser = useCallback((slot: "emblem" | "watermark") => {
    setTargetIconSlot(slot);
    setIconBrowserOpen(true);
  }, []);

  const handleSelectIcon = useCallback(
    (icon: GameIconItem, slot: "emblem" | "watermark") => {
      if (slot === "emblem") {
        setState((p) => ({ ...p, emblemIcon: icon }));
        notify.success(`Set "${icon.name}" as Center Emblem`);
      } else {
        setState((p) => ({ ...p, watermarkIcon: icon }));
        notify.success(`Set "${icon.name}" as Background Watermark`);
      }
    },
    [notify]
  );

  const handleLoreImport = useCallback(
    (importedData: Partial<CardDesignState>) => {
      setState((prev) => ({ ...prev, ...importedData }));
      notify.success(`Imported lore for "${importedData.title ?? "Article"}"!`);
    },
    [notify]
  );

  // Publish Card to DB Mutation
  const publishMutation = api.loreCards.createCustomDesignedCard.useMutation({
    onSuccess: (res) => {
      notify.success(res.message);
    },
    onError: (err) => {
      notify.error(err.message || "Failed to publish card.");
    },
  });

  const handlePublish = useCallback(() => {
    publishMutation.mutate({
      title: state.title,
      description: state.description,
      category: state.category,
      subcategory: state.subcategory,
      rarity: state.rarity as any,
      season: state.season,
      cardType: state.cardType,
      marketValue: state.marketValue,
      totalSupply: state.isLimitedSupply ? state.totalSupply : null,
      wikiSource: state.wikiSource,
      wikiArticleTitle: state.wikiArticleTitle,
      wikiExcerpt: state.wikiExcerpt,
      artworkUrl: state.artworkUrl ?? undefined,
      artworkCredit:
        state.artworkSource === "WIKI_FETCHED"
          ? `${state.wikiSource.toUpperCase()} Article`
          : undefined,
      attributes: {
        designerCreated: true,
        materialFinish: state.materialFinish,
        surfaceRefraction: state.surfaceRefraction,
        particleDensity: state.particleDensity,
        enableArtwork: state.enableArtwork,
        artworkOpacity: state.artworkOpacity,
      },

      metadata: {
        emblemIcon: state.emblemIcon,
        emblemScale: state.emblemScale,
        emblemColor: state.emblemColor,
        watermarkIcon: state.watermarkIcon,
        watermarkOpacity: state.watermarkOpacity,
        watermarkScale: state.watermarkScale,
        accentColorOverride: state.accentColorOverride,
        foilSheen: state.foilSheen,
        holographicIntensity: state.holographicIntensity,
        customSubtitle: state.customSubtitle,
      },
    });
  }, [state, publishMutation]);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Main Two-Column Split Workspace */}
      <div className="grid flex-1 grid-cols-1 items-start gap-6 p-6 lg:grid-cols-12">
        {/* Left Column: 3D Physics Viewport (5 of 12 cols = ~42%) */}
        <div className="bg-card border-border flex h-[calc(100vh-140px)] max-h-[820px] min-h-[580px] flex-col self-start overflow-hidden rounded-2xl border shadow-xs lg:sticky lg:top-4 lg:col-span-5">
          <DesignerStage3D state={state} onReset={() => setState(DEFAULT_DESIGN_STATE)} />
        </div>

        {/* Right Column: Multi-Section Tuning Rack (7 of 12 cols = ~58%) */}
        <div className="bg-card border-border flex max-h-[calc(100vh-140px)] flex-col self-start overflow-y-auto rounded-2xl border p-6 shadow-xs lg:sticky lg:top-4 lg:col-span-7">
          <DesignerControlRack
            state={state}
            onChange={setState}
            onOpenIconBrowser={handleOpenIconBrowser}
            onOpenLoreImport={() => setLoreDrawerOpen(true)}
            onPublish={handlePublish}
            isPublishing={publishMutation.isPending}
            presets={presets}
            onSavePreset={handleSavePreset}
            onLoadPreset={handleLoadPreset}
            onDeletePreset={handleDeletePreset}
          />
        </div>
      </div>

      {/* 4,180+ Game-Icons Picker Modal */}
      <GameIconsBrowser
        isOpen={iconBrowserOpen}
        onClose={() => setIconBrowserOpen(false)}
        targetSlot={targetIconSlot}
        selectedIcon={targetIconSlot === "emblem" ? state.emblemIcon : state.watermarkIcon}
        onSelect={handleSelectIcon}
      />

      {/* Lore Import Suite Modal (IxWiki / IIWiki / WikiOS / Stash) */}
      <LoreImportDrawer
        isOpen={loreDrawerOpen}
        onClose={() => setLoreDrawerOpen(false)}
        onImport={handleLoreImport}
        initialSource={state.wikiSource}
      />
    </div>
  );
};

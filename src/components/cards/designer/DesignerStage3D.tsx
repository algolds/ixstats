"use client";
/**
 * DesignerStage3D Component
 *
 * Interactive 3D physical stage for live card designing.
 * Consumes the canonical Card3DViewer and CardDetailsModal components.
 *
 * ponytail: simplified single-source card rendering wrapper
 */

import React, { useState, useMemo } from "react";
import {
  Undo as RotateCcw,
  Refresh as RotateCw,
  Expand as Maximize2,
  ControlSlider as SlidersHorizontal,
} from "iconoir-react";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Card3DViewer } from "~/components/cards/display/Card3DViewer";
import { CardDetailsModal } from "~/components/cards/display/CardDetailsModal";
import type { CardInstance } from "~/types/cards-display";
import type { CardDesignState } from "./types";
import type { CardRarity } from "@prisma/client";

interface DesignerStage3DProps {
  state: CardDesignState;
  className?: string;
  onReset?: () => void;
}

export const DesignerStage3D = React.memo<DesignerStage3DProps>(({ state, className, onReset }) => {
  const [side, setSide] = useState<"front" | "back">("front");
  const [resetKey, setResetKey] = useState(0);
  const [isExpandedModalOpen, setIsExpandedModalOpen] = useState(false);

  const handleReset = () => {
    setSide("front");
    setResetKey((k) => k + 1);
    if (onReset) {
      onReset();
    }
  };

  const previewCardInstance = useMemo<CardInstance>(() => {
    const textContent = state.description || state.wikiExcerpt || "";
    return {
      id: "preview-designer-card",
      title: state.title || "Untitled Card",
      description: textContent,
      artwork: state.artworkUrl || "",
      artworkUrl: state.artworkUrl || null,
      artworkSource: state.artworkSource || "PROCEDURAL",
      cardType: state.cardType || "WIKI_LORE",
      category: state.category,
      subcategory: state.subcategory,
      rarity: (state.rarity || "EPIC") as CardRarity,
      season: state.season || 1,
      nsCardId: null,
      nsSeason: null,
      nsData: null,
      wikiSource: state.wikiSource || "ixwiki",
      wikiArticleTitle: state.wikiArticleTitle || state.title,
      wikiExcerpt: textContent,
      wikiUrl: state.wikiArticleTitle
        ? `/wikios/${encodeURIComponent(state.wikiArticleTitle)}`
        : null,
      countryId: null,
      stats: { power: 100, defense: 100, diplomaticImpact: 100 },
      metadata: {
        emblemIcon: state.emblemIcon,
        emblemScale: state.emblemScale,
        emblemColor: state.emblemColor,
        watermarkIcon: state.watermarkIcon,
        watermarkOpacity: state.watermarkOpacity,
        watermarkScale: state.watermarkScale,
        watermarkColor: state.watermarkColor,
        accentColorOverride: state.accentColorOverride,
        foilSheen: state.foilSheen,
        holographicIntensity: state.holographicIntensity,
        customSubtitle: state.customSubtitle,
        enableCategoryTint: state.enableCategoryTint,
      },
      marketValue: state.marketValue || 6000,
      totalSupply: state.totalSupply || 100,
      level: 1,
      evolutionStage: 1,
      enhancements: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTrade: null,
      artworkVariants: null,
    };
  }, [state]);

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-between gap-4 p-4",
        className
      )}
    >
      {/* 3D Physical Card Stage */}
      <div className="flex min-h-[420px] w-full flex-1 items-center justify-center">
        <Card3DViewer
          key={resetKey}
          card={previewCardInstance}
          size="large"
          initialSide={side}
          enableFlip={true}
          enableDragRotation={true}
          enableMouseTracking={true}
          onFlip={(newSide) => setSide(newSide)}
        />
      </div>

      {/* Stage Toolbar Controls */}
      <div className="border-border bg-card/80 flex w-full shrink-0 items-center justify-between rounded-2xl border p-2.5 text-xs shadow-xs backdrop-blur-md">
        <div className="text-foreground flex items-center gap-2 text-xs font-semibold">
          <SlidersHorizontal className="text-primary h-3.5 w-3.5" />
          <span>Card Controls</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSide((s) => (s === "front" ? "back" : "front"))}
            className="border-border/80 bg-background hover:bg-muted text-foreground h-7 cursor-pointer gap-1.5 rounded-lg px-2.5 text-xs font-medium shadow-2xs"
          >
            <RotateCw className="text-primary h-3.5 w-3.5" />
            <span>Rotate ({side === "front" ? "Front" : "Back"})</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="border-border/80 bg-background hover:bg-muted text-foreground h-7 cursor-pointer gap-1.5 rounded-lg px-2.5 text-xs font-medium shadow-2xs"
          >
            <RotateCcw className="text-primary h-3.5 w-3.5" />
            <span>Reset</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpandedModalOpen(true)}
            className="border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary h-7 cursor-pointer gap-1.5 rounded-lg px-2.5 text-xs font-semibold shadow-2xs"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>Expand</span>
          </Button>
        </div>
      </div>

      {/* Platform Standard Card Details Modal */}
      {isExpandedModalOpen && (
        <CardDetailsModal
          card={previewCardInstance}
          open={isExpandedModalOpen}
          onClose={() => setIsExpandedModalOpen(false)}
        />
      )}
    </div>
  );
});

DesignerStage3D.displayName = "DesignerStage3D";

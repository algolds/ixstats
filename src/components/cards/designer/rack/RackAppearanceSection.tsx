import React from "react";
import { MediaImage as ImageIcon, BookStack as Library, Palette } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { getCategoryLabel } from "~/lib/cards/category-theme";
import type { CardDesignState } from "../types";
import { COLOR_PRESETS } from "./rack-constants";

interface RackAppearanceSectionProps {
  state: CardDesignState;
  onChange: (updater: (prev: CardDesignState) => CardDesignState) => void;
  onOpenIconBrowser: (target: "emblem" | "watermark") => void;
}

export const RackAppearanceSection = React.memo(function RackAppearanceSection({
  state,
  onChange,
  onOpenIconBrowser,
}: RackAppearanceSectionProps) {
  return (
    <div className="space-y-4">
      {/* Artwork subsection */}
      <div className="border-border bg-muted/20 space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <div className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
            <ImageIcon className="text-primary h-4 w-4" />
            <span>Card Artwork & Media</span>
          </div>
          {state.artworkUrl && (
            <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-[11px]">
              <input
                type="checkbox"
                checked={state.enableArtwork}
                onChange={(e) => onChange((p) => ({ ...p, enableArtwork: e.target.checked }))}
                className="accent-primary h-3.5 w-3.5 rounded-md"
              />
              <span>Show on Card</span>
            </label>
          )}
        </div>

        {state.artworkUrl ? (
          <div className="border-border bg-card flex items-center justify-between rounded-lg border p-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="bg-muted border-border flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                <img
                  src={proxyCardArtwork(state.artworkUrl)}
                  alt="Artwork"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-foreground truncate text-xs font-semibold">
                  {state.artworkSource === "WIKI_FETCHED"
                    ? "Wiki Article Artwork"
                    : "Custom Artwork"}
                </div>
                <div className="text-muted-foreground truncate font-mono text-[10px]">
                  {state.artworkUrl}
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange((p) => ({ ...p, artworkUrl: null, enableArtwork: false }))}
              className="text-muted-foreground hover:text-destructive h-6 shrink-0 px-2 text-xs"
            >
              Clear
            </Button>
          </div>
        ) : (
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">
              Direct Image URL (or search via Lore Import)
            </label>
            <Input
              value={state.artworkUrl || ""}
              onChange={(e) =>
                onChange((p) => ({
                  ...p,
                  artworkUrl: e.target.value || null,
                  enableArtwork: Boolean(e.target.value),
                  artworkSource: "FLAG",
                }))
              }
              placeholder="https://..."
              className="h-8 font-mono text-xs"
            />
          </div>
        )}

        {state.artworkUrl && state.enableArtwork && (
          <div className="flex items-center gap-3 pt-1">
            <span className="text-muted-foreground shrink-0 text-xs font-medium">
              Artwork Opacity:
            </span>
            <input
              type="range"
              min="0.10"
              max="1.0"
              step="0.05"
              value={state.artworkOpacity ?? 0.85}
              onChange={(e) => onChange((p) => ({ ...p, artworkOpacity: Number(e.target.value) }))}
              className="bg-muted accent-primary h-1 flex-1 rounded-lg"
            />
            <span className="text-foreground w-8 text-right font-mono text-xs">
              {Math.round((state.artworkOpacity ?? 0.85) * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Icons and Sigils */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Primary Emblem */}
        <div className="border-border bg-muted/20 space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-xs font-semibold">Primary Icon</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenIconBrowser("emblem")}
              className="h-6 gap-1 px-2 text-[10px]"
            >
              <Library className="text-primary h-3 w-3" />
              4,100+ Icons
            </Button>
          </div>

          {state.emblemIcon ? (
            <div className="border-border bg-card flex items-center justify-between rounded-lg border p-1.5">
              <div className="flex items-center gap-2">
                <div className="bg-muted border-border flex h-6 w-6 items-center justify-center rounded border p-0.5">
                  <img
                    src={state.emblemIcon.path}
                    alt={state.emblemIcon.name}
                    className="h-full w-full object-contain invert filter dark:filter-none"
                  />
                </div>
                <span className="max-w-[90px] truncate text-xs font-medium">
                  {state.emblemIcon.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange((p) => ({ ...p, emblemIcon: null }))}
                className="text-muted-foreground hover:text-destructive h-5 px-1 text-[10px]"
              >
                Reset
              </Button>
            </div>
          ) : (
            <div className="text-muted-foreground text-[11px] italic">
              Default {getCategoryLabel(state.category)} Sigil
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <span className="text-muted-foreground shrink-0 text-[11px]">Scale:</span>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={state.emblemScale}
              onChange={(e) => onChange((p) => ({ ...p, emblemScale: Number(e.target.value) }))}
              className="bg-muted accent-primary h-1 flex-1 rounded-lg"
            />
            <span className="text-foreground w-7 text-right font-mono text-[11px]">
              {state.emblemScale.toFixed(2)}x
            </span>
          </div>

          {/* Emblem Color Swatches */}
          <div className="border-border/40 space-y-1.5 border-t pt-2">
            <div className="flex items-center justify-between">
              <span className="text-foreground text-[11px] font-semibold">Emblem Color</span>
              <span className="text-primary font-mono text-[10px]">
                {state.emblemColor ? state.emblemColor.toUpperCase() : "Auto"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {COLOR_PRESETS.map((preset) => {
                const isActive = (state.emblemColor || "") === preset.value;
                return (
                  <button
                    key={`emblem-${preset.id}`}
                    type="button"
                    title={preset.label}
                    onClick={() => onChange((p) => ({ ...p, emblemColor: preset.value }))}
                    className={cn(
                      "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all",
                      preset.bgClass,
                      isActive
                        ? "ring-primary ring-offset-background scale-110 border-white shadow-xs ring-2 ring-offset-2"
                        : "border-border/60 opacity-80 hover:scale-105 hover:opacity-100"
                    )}
                  />
                );
              })}
              <label
                className="border-border bg-card relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border transition-all hover:scale-105"
                title="Custom Hex Color"
              >
                <input
                  type="color"
                  value={state.emblemColor || "#f59e0b"}
                  onChange={(e) => onChange((p) => ({ ...p, emblemColor: e.target.value }))}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <Palette className="text-muted-foreground h-3 w-3" />
              </label>
            </div>
          </div>
        </div>

        {/* Watermark Icon */}
        <div className="border-border bg-muted/20 space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-xs font-semibold">Background Pattern</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenIconBrowser("watermark")}
              className="h-6 gap-1 px-2 text-[10px]"
            >
              <Library className="text-primary h-3 w-3" />
              Open
            </Button>
          </div>

          {state.watermarkIcon ? (
            <div className="border-border bg-card flex items-center justify-between rounded-lg border p-1.5">
              <div className="flex items-center gap-2">
                <div className="bg-muted border-border flex h-6 w-6 items-center justify-center rounded border p-0.5">
                  <img
                    src={state.watermarkIcon.path}
                    alt={state.watermarkIcon.name}
                    className="h-full w-full object-contain invert filter dark:filter-none"
                  />
                </div>
                <span className="max-w-[90px] truncate text-xs font-medium">
                  {state.watermarkIcon.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange((p) => ({ ...p, watermarkIcon: null }))}
                className="text-muted-foreground hover:text-destructive h-5 px-1 text-[10px]"
              >
                Reset
              </Button>
            </div>
          ) : (
            <div className="text-muted-foreground text-[11px] italic">
              Default {getCategoryLabel(state.category)} Watermark
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <span className="text-muted-foreground shrink-0 text-[11px]">Opacity:</span>
            <input
              type="range"
              min="0.05"
              max="0.70"
              step="0.05"
              value={state.watermarkOpacity}
              onChange={(e) =>
                onChange((p) => ({ ...p, watermarkOpacity: Number(e.target.value) }))
              }
              className="bg-muted accent-primary h-1 flex-1 rounded-lg"
            />
            <span className="text-foreground w-7 text-right font-mono text-[11px]">
              {Math.round(state.watermarkOpacity * 100)}%
            </span>
          </div>

          {/* Watermark Color Swatches */}
          <div className="border-border/40 space-y-1.5 border-t pt-2">
            <div className="flex items-center justify-between">
              <span className="text-foreground text-[11px] font-semibold">Watermark Color</span>
              <span className="text-primary font-mono text-[10px]">
                {state.watermarkColor ? state.watermarkColor.toUpperCase() : "Auto"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {COLOR_PRESETS.map((preset) => {
                const isActive = (state.watermarkColor || "") === preset.value;
                return (
                  <button
                    key={`watermark-${preset.id}`}
                    type="button"
                    title={preset.label}
                    onClick={() => onChange((p) => ({ ...p, watermarkColor: preset.value }))}
                    className={cn(
                      "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all",
                      preset.bgClass,
                      isActive
                        ? "ring-primary ring-offset-background scale-110 border-white shadow-xs ring-2 ring-offset-2"
                        : "border-border/60 opacity-80 hover:scale-105 hover:opacity-100"
                    )}
                  />
                );
              })}
              <label
                className="border-border bg-card relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border transition-all hover:scale-105"
                title="Custom Hex Color"
              >
                <input
                  type="color"
                  value={state.watermarkColor || "#f59e0b"}
                  onChange={(e) => onChange((p) => ({ ...p, watermarkColor: e.target.value }))}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <Palette className="text-muted-foreground h-3 w-3" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Hue Override */}
      <div className="border-border flex items-center justify-between border-t pt-2">
        <div>
          <span className="text-foreground block text-xs font-medium">Custom Hue Override</span>
          <span className="text-muted-foreground text-[10px]">
            Overrides base material gradient hue
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={state.accentColorOverride || "#6366f1"}
            onChange={(e) => onChange((p) => ({ ...p, accentColorOverride: e.target.value }))}
            className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent"
          />
          {state.accentColorOverride && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange((p) => ({ ...p, accentColorOverride: "" }))}
              className="text-muted-foreground h-6 px-1.5 text-xs"
            >
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
